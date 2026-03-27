/**
 * ImageGenerationService
 *
 * Orchestrates AI image generation with multi-provider fallback,
 * IndexedDB caching (binary data), and LRU eviction.
 *
 * Image binary data goes to IndexedDB — not localStorage — to avoid the ~5 MB
 * localStorage quota on iOS Safari. (localStorage is only used for lightweight
 * metadata: TTL, size, provider, etc.)
 *
 * Provider priority: NanoBanana (primary) → Gemini (fallback)
 *
 * Cache key format: `img-cache-{postId}-{style}`
 * Metadata key (localStorage): `img-cache-meta`
 */

import type {
  ServiceResult,
  GeneratedImage,
  ImageCacheMetadata,
  CacheStats,
  ImageStyle,
  ImageGenerationConfig,
} from '../types';
import type { IImageProvider } from '../providers/imageProvider.interface';

// ─── Cache constants ─────────────────────────────────────────────────────────

const CACHE_KEY_PREFIX = 'img-cache-';
const CACHE_META_KEY = 'img-cache-meta';
const DEFAULT_MAX_CACHE_BYTES = 200 * 1024 * 1024; // 200 MB (IndexedDB can handle this)
const DEFAULT_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ─── IndexedDB helpers ────────────────────────────────────────────────────────
// Image binary data (base64 strings) is stored in IndexedDB, not localStorage,
// to avoid the ~5 MB localStorage cap on iOS Safari.

const IDB_NAME = 'echolearn_images';
const IDB_STORE = 'images';
const IDB_VERSION = 1;

function openImageDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => { db.close(); resolve((req.result as string | undefined) ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function idbClear(): Promise<void> {
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// ─── Service ──────────────────────────────────────────────────────────────────

class ImageGenerationService {
  private providers: IImageProvider[] = [];
  private config: ImageGenerationConfig = {
    maxCacheSizeBytes: DEFAULT_MAX_CACHE_BYTES,
    cacheTtlMs: DEFAULT_CACHE_TTL_MS,
    requestTimeoutMs: 15_000,
    maxRetries: 3,
  };

  /**
   * Register image providers in priority order.
   * The first provider is tried first; subsequent ones are fallbacks.
   */
  setProviders(providers: IImageProvider[]): void {
    this.providers = providers;
  }

  /**
   * Update runtime configuration (API keys, cache limits, etc.).
   */
  configure(config: Partial<ImageGenerationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Generate an image for the given post + style combo.
   * Checks the cache first; falls back through providers on miss.
   * Logs generation time for performance monitoring.
   */
  async generateImage(
    postId: string,
    prompt: string,
    style: ImageStyle,
  ): Promise<ServiceResult<GeneratedImage>> {
    // 1. Cache hit?
    const cached = await this.retrieveCachedImage(postId, style);
    if (cached) {
      return { success: true, data: cached };
    }

    // 2. Try each provider in order.
    let lastError = 'No providers configured';
    const t0 = Date.now();

    for (const provider of this.providers) {
      try {
        const providerStart = Date.now();
        const result = await provider.generate(prompt, style, {
          timeoutMs: this.config.requestTimeoutMs,
          maxRetries: this.config.maxRetries,
        });
        const elapsed = Date.now() - providerStart;

        if (result.success && result.data) {
          const image: GeneratedImage = {
            ...result.data,
            postId,
          };
          // Cache the successful result.
          await this.cacheImage(postId, [image]);
          console.debug(
            `[ImageGenerationService] ${provider.name} generated image in ${elapsed}ms (total: ${Date.now() - t0}ms)`,
          );
          return { success: true, data: image };
        }
        lastError = result.error?.message ?? 'Provider returned no data';
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.warn(`[ImageGenerationService] Provider ${provider.name} failed:`, lastError);
      }
    }

    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: `All image providers failed. Last error: ${lastError}`,
        retryable: true,
      },
    };
  }

  /**
   * Persist a set of generated images to the IndexedDB cache.
   * Metadata (TTL, size, provider) stays in localStorage — it's tiny.
   * Binary image data goes to IndexedDB to avoid the ~5 MB localStorage cap.
   */
  async cacheImage(postId: string, images: GeneratedImage[]): Promise<void> {
    const meta = this._loadMeta();
    const now = Date.now();

    await this._evictExpiredAndOverLimit(meta);

    for (const image of images) {
      const cacheKey = this._cacheKey(postId, image.style);
      const payload = JSON.stringify(image);
      const sizeBytes = new Blob([payload]).size;

      try {
        await idbSet(cacheKey, payload);
      } catch (err) {
        console.error('[ImageGenerationService] IndexedDB write failed — image will not be cached:', err);
        continue;
      }

      meta[cacheKey] = {
        postId,
        style: image.style,
        provider: image.provider,
        generatedAt: image.generatedAt,
        cachedAt: now,
        expiresAt: now + this.config.cacheTtlMs,
        sizeBytes,
      };
    }

    this._saveMeta(meta);
  }

  /**
   * Retrieve a cached image by postId + style.
   * Returns null on cache miss or if the entry has expired.
   */
  async retrieveCachedImage(postId: string, style: ImageStyle): Promise<GeneratedImage | null> {
    const cacheKey = this._cacheKey(postId, style);
    const meta = this._loadMeta();
    const entry = meta[cacheKey];

    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      await this._removeCacheEntry(cacheKey, meta);
      return null;
    }

    try {
      const raw = await idbGet(cacheKey);
      if (!raw) {
        // Data missing despite valid metadata — clean up metadata.
        delete meta[cacheKey];
        this._saveMeta(meta);
        return null;
      }
      return JSON.parse(raw) as GeneratedImage;
    } catch {
      await this._removeCacheEntry(cacheKey, meta);
      return null;
    }
  }

  /**
   * Delete all cached images and reset metadata.
   */
  async clearImageCache(): Promise<void> {
    localStorage.removeItem(CACHE_META_KEY);
    try {
      await idbClear();
    } catch (err) {
      console.warn('[ImageGenerationService] IndexedDB clear failed:', err);
    }
  }

  /**
   * Return stats about the current image cache.
   */
  getCacheStats(): CacheStats {
    const meta = this._loadMeta();
    const entries = Object.values(meta);

    if (entries.length === 0) {
      return { totalSizeBytes: 0, itemCount: 0, oldestItemAt: null, newestItemAt: null };
    }

    const totalSizeBytes = entries.reduce((sum, e) => sum + e.sizeBytes, 0);
    const cachedAts = entries.map((e) => e.cachedAt);

    return {
      totalSizeBytes,
      itemCount: entries.length,
      oldestItemAt: Math.min(...cachedAts),
      newestItemAt: Math.max(...cachedAts),
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private _cacheKey(postId: string, style: ImageStyle): string {
    return `${CACHE_KEY_PREFIX}${postId}-${style}`;
  }

  private _loadMeta(): Record<string, ImageCacheMetadata> {
    try {
      const raw = localStorage.getItem(CACHE_META_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, ImageCacheMetadata>;
    } catch {
      return {};
    }
  }

  private _saveMeta(meta: Record<string, ImageCacheMetadata>): void {
    try {
      localStorage.setItem(CACHE_META_KEY, JSON.stringify(meta));
    } catch {
      // ignore
    }
  }

  private async _removeCacheEntry(cacheKey: string, meta: Record<string, ImageCacheMetadata>): Promise<void> {
    delete meta[cacheKey];
    this._saveMeta(meta);
    try { await idbDelete(cacheKey); } catch { /* non-fatal */ }
  }

  /**
   * Remove expired entries and enforce the total size limit via LRU.
   * Fire-and-forget IndexedDB deletes — metadata is the source of truth.
   */
  private async _evictExpiredAndOverLimit(meta: Record<string, ImageCacheMetadata>): Promise<void> {
    const now = Date.now();
    const toDelete: string[] = [];

    // Collect expired keys.
    for (const [key, entry] of Object.entries(meta)) {
      if (now > entry.expiresAt) {
        toDelete.push(key);
        delete meta[key];
      }
    }

    // Enforce size limit via LRU (oldest cachedAt first).
    let totalBytes = Object.values(meta).reduce((sum, e) => sum + e.sizeBytes, 0);
    if (totalBytes > this.config.maxCacheSizeBytes) {
      const sorted = Object.entries(meta).sort(([, a], [, b]) => a.cachedAt - b.cachedAt);
      for (const [key, entry] of sorted) {
        if (totalBytes <= this.config.maxCacheSizeBytes) break;
        totalBytes -= entry.sizeBytes;
        toDelete.push(key);
        delete meta[key];
      }
    }

    if (toDelete.length > 0) {
      this._saveMeta(meta);
      await Promise.allSettled(toDelete.map(idbDelete));
    }
  }
}

export const imageGenerationService = new ImageGenerationService();

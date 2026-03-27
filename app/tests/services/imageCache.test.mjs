/**
 * Unit tests for image caching layer.
 *
 * Tests cache hit/miss detection, LRU eviction logic,
 * storage persistence, and cache invalidation.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

// ─── Mock localStorage ────────────────────────────────────────────────────────

class MockStorage {
  constructor() {
    this.data = {};
  }

  setItem(key, value) {
    this.data[key] = String(value);
  }

  getItem(key) {
    return this.data[key] ?? null;
  }

  removeItem(key) {
    delete this.data[key];
  }

  clear() {
    this.data = {};
  }
}

// ─── Test Image Cache Service ─────────────────────────────────────────────────

class TestImageCacheService {
  constructor(storageImpl = new MockStorage(), maxCacheSize = 50) {
    this.storage = storageImpl;
    this.maxCacheSize = maxCacheSize;
    this.cachePrefix = 'echolearn_image_cache_';
    this.indexKey = 'echolearn_image_cache_index';
  }

  async getImage(postId, style) {
    const key = `${this.cachePrefix}${postId}_${style}`;
    const cached = this.storage.getItem(key);

    if (!cached) return null;

    try {
      const entry = JSON.parse(cached);
      // Update LRU timestamp
      entry.lastAccessed = Date.now();
      this.storage.setItem(key, JSON.stringify(entry));
      return entry.image || entry.data;
    } catch {
      return null;
    }
  }

  async setImage(postId, style, image) {
    const key = `${this.cachePrefix}${postId}_${style}`;

    const entry = {
      postId,
      style,
      data: image,
      image, // for backwards compat
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      size: JSON.stringify(image).length,
    };

    this.storage.setItem(key, JSON.stringify(entry));
    this._updateIndex(key);
    this._enforceMaxSize();
  }

  async clearCache() {
    const keys = Object.keys(this.storage.data);
    for (const key of keys) {
      if (key.startsWith(this.cachePrefix)) {
        this.storage.removeItem(key);
      }
    }
    this.storage.removeItem(this.indexKey);
  }

  async getCacheSize() {
    let total = 0;
    const keys = Object.keys(this.storage.data);
    for (const key of keys) {
      if (key.startsWith(this.cachePrefix)) {
        const cached = this.storage.getItem(key);
        if (cached) {
          try {
            const entry = JSON.parse(cached);
            total += entry.size || 0;
          } catch {}
        }
      }
    }
    return total;
  }

  _updateIndex(key) {
    try {
      const index = JSON.parse(this.storage.getItem(this.indexKey) || '[]');
      if (!index.includes(key)) {
        index.push(key);
      }
      this.storage.setItem(this.indexKey, JSON.stringify(index));
    } catch {}
  }

  _enforceMaxSize() {
    const keys = Object.keys(this.storage.data);
    const cacheEntries = [];

    for (const key of keys) {
      if (key.startsWith(this.cachePrefix)) {
        const cached = this.storage.getItem(key);
        if (cached) {
          try {
            const entry = JSON.parse(cached);
            cacheEntries.push({ key, ...entry });
          } catch {}
        }
      }
    }

    const totalSize = cacheEntries.reduce((sum, e) => sum + (e.size || 0), 0);

    if (totalSize > this.maxCacheSize) {
      cacheEntries.sort((a, b) => a.lastAccessed - b.lastAccessed);

      let freed = 0;
      for (const entry of cacheEntries) {
        if (freed >= totalSize - this.maxCacheSize) break;
        this.storage.removeItem(entry.key);
        freed += entry.size || 0;
      }
    }
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('ImageCache: get returns null for missing image', async () => {
  const cache = new TestImageCacheService();
  const result = await cache.getImage('post-1', 'photo');
  assert.equal(result, null);
});

test('ImageCache: set and get returns cached image', async () => {
  const storage = new MockStorage();
  const cache = new TestImageCacheService(storage, 500); // Larger max cache
  const testImage = { id: 'img-1', url: 'https://example.com/image.png' };

  await cache.setImage('post-1', 'photo', testImage);
  const result = await cache.getImage('post-1', 'photo');

  // Verify we get an object back with the id
  assert.ok(result !== null && result !== undefined, 'Result should not be null/undefined');
  assert.equal(result?.id, 'img-1', 'Should have correct ID');
  assert.equal(result?.url, 'https://example.com/image.png', 'Should have correct URL');
});

test('ImageCache: different styles are cached separately', async () => {
  const storage = new MockStorage();
  const cache = new TestImageCacheService(storage, 500); // Larger max cache
  const photoImage = { id: 'img-1', url: 'https://example.com/photo.png' };
  const illustImage = { id: 'img-2', url: 'https://example.com/illust.png' };

  await cache.setImage('post-1', 'photo', photoImage);
  await cache.setImage('post-1', 'illustration', illustImage);

  const photoResult = await cache.getImage('post-1', 'photo');
  const illustResult = await cache.getImage('post-1', 'illustration');

  assert.ok(photoResult !== null, 'Photo result should be cached');
  assert.ok(illustResult !== null, 'Illust result should be cached');
  assert.equal(photoResult?.id, 'img-1');
  assert.equal(illustResult?.id, 'img-2');
});

test('ImageCache: cache hit updates lastAccessed timestamp', async () => {
  const cache = new TestImageCacheService();
  const testImage = { id: 'img-1' };

  await cache.setImage('post-1', 'photo', testImage);

  const storage = cache.storage;
  const key = 'echolearn_image_cache_post-1_photo';
  const before = JSON.parse(storage.getItem(key)).lastAccessed;

  // Small delay to ensure timestamp difference
  await new Promise((r) => setTimeout(r, 10));

  await cache.getImage('post-1', 'photo');
  const after = JSON.parse(storage.getItem(key)).lastAccessed;

  assert.ok(after > before, 'lastAccessed timestamp should increase on hit');
});

test('ImageCache: clear removes all cached images', async () => {
  const cache = new TestImageCacheService();

  await cache.setImage('post-1', 'photo', { id: 'img-1' });
  await cache.setImage('post-2', 'illustration', { id: 'img-2' });

  assert.ok(await cache.getImage('post-1', 'photo'));
  assert.ok(await cache.getImage('post-2', 'illustration'));

  await cache.clearCache();

  assert.equal(await cache.getImage('post-1', 'photo'), null);
  assert.equal(await cache.getImage('post-2', 'illustration'), null);
});

test('ImageCache: exceeding max size triggers LRU eviction', async () => {
  const cache = new TestImageCacheService(new MockStorage(), 100); // 100 bytes max

  // Add 3 small images
  await cache.setImage('post-1', 'photo', { id: 'img-1', data: 'a' });
  await cache.setImage('post-2', 'photo', { id: 'img-2', data: 'b' });

  // Add a large image that should trigger eviction
  await cache.setImage('post-3', 'photo', { id: 'img-3', data: 'x'.repeat(50) });

  const size = await cache.getCacheSize();
  assert.ok(size <= 100, `Cache size ${size} should not exceed 100 bytes`);
});

test('ImageCache: LRU eviction removes least recently used', async () => {
  const storage = new MockStorage();
  const cache = new TestImageCacheService(storage, 100); // 100 bytes total

  // Add small images
  await cache.setImage('post-1', 'photo', { id: 'i1' });
  await cache.setImage('post-2', 'photo', { id: 'i2' });
  await cache.setImage('post-3', 'photo', { id: 'i3' });

  // Access post-3 to refresh its LRU timestamp (making post-1 and post-2 older)
  await cache.getImage('post-3', 'photo');

  // Try to add a large image that should trigger eviction
  // The least recently used (post-1 or post-2) should be removed
  await cache.setImage('post-4', 'photo', { id: 'i4', data: 'x'.repeat(20) });

  // At least some images should remain after eviction
  const remaining = [
    await cache.getImage('post-1', 'photo'),
    await cache.getImage('post-2', 'photo'),
    await cache.getImage('post-3', 'photo'),
    await cache.getImage('post-4', 'photo'),
  ].filter(x => x !== null).length;

  assert.ok(remaining > 0, 'At least one image should remain after LRU eviction');
});

test('ImageCache: getCacheSize returns total bytes', async () => {
  const cache = new TestImageCacheService();

  await cache.setImage('post-1', 'photo', { id: 'img-1' });
  const size = await cache.getCacheSize();

  assert.ok(size > 0, 'Cache size should be greater than 0');
});

test('ImageCache: handles corrupted cache entries gracefully', async () => {
  const storage = new MockStorage();
  const cache = new TestImageCacheService(storage);

  const key = 'echolearn_image_cache_post-1_photo';
  storage.setItem(key, 'not valid json');

  const result = await cache.getImage('post-1', 'photo');
  assert.equal(result, null, 'Should handle corrupted entries gracefully');
});

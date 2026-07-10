import type { AppPreferences, AppSettings, ServiceResult, SupportedLocale } from '../types';

const STORAGE_KEY = 'trellis_settings';

export const FEED_DEFAULTS = {
  postRetentionDays: 7 as number | null,
  dailyGenerationCapMultiplier: 5,
  bonusPostCap: 8,
} as const;

const defaultSettings: AppSettings = {
  llm: {
    provider: 'openai',
    apiKey: '',
    baseUrl: '',
    model: 'gpt-4o',
    isConfigured: false,
  },
  // Phase 55.1 GAP-E — optional low-latency generation model. Disabled/unset by default
  // so existing users see NO behavior change (resolveGenerationConfig falls back to `llm`).
  // MUST be present here for deepMerge() to default pre-feature stored settings (deepMerge
  // iterates Object.keys(defaults), so an absent key would never be filled in) — this is the
  // additive-optional defaulting path, NOT a migration (CLAUDE.md feedback_no_normalize_for_optional_fields).
  fastModel: {
    enabled: false,
    provider: 'openai',
    apiKey: '',
    baseUrl: '',
    model: 'gpt-4o-mini',
    isConfigured: false,
  },
  embedding: {
    provider: 'openai',
    apiKey: '',
    model: 'text-embedding-3-small',
    baseUrl: '',
    dimensions: 256,
    isConfigured: false,
  },
  embeddingDebug: {
    // Legacy dead slider value — kept for backwards-compat; UI no longer renders it (D-05).
    similarityThreshold: 0.65,
    showScores: false,
    // Phase 55 D-05 per-threshold knobs. deepMerge() spreads { ...defaults, ...stored }
    // for the embeddingDebug object, so a pre-feature stored config (with only
    // similarityThreshold/showScores) loads these defaults automatically — this IS the
    // Pitfall-3 shape-change defaulting for the kept settings key (no migration needed).
    debugEnabled: false,
    offTopicThreshold: 0.75,
    maliciousThreshold: 0.82,
    anchorDedupThreshold: 0.82,
  },
  zerotier: {
    networkId: '',
    isConnected: false,
    virtualIp: undefined,
  },
  preferences: {
    theme: 'system',
    locale: 'en',
    language: 'en',
    onboardingCompleted: false,
    aiConsentGiven: false,
  },
  imageGeneration: {
    nanoBananaApiKey: '',
    geminiApiKey: '',
    geminiModel: 'gemini-3.1-flash-image-preview',
    maxCacheSizeMb: 50,
    cacheTtlDays: 30,
    primaryProvider: 'auto' as const,
    enabled: true,
  },
  feed: {
    postRetentionDays: FEED_DEFAULTS.postRetentionDays,
    dailyGenerationCapMultiplier: FEED_DEFAULTS.dailyGenerationCapMultiplier,
    bonusPostCap: FEED_DEFAULTS.bonusPostCap,
  },
};

function deepMerge(defaults: AppSettings, stored: Partial<AppSettings>): AppSettings {
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof AppSettings)[]) {
    const dv = defaults[key];
    const sv = stored[key];
    if (sv !== undefined && sv !== null && typeof dv === 'object' && !Array.isArray(dv)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[key] = { ...(dv as object), ...(sv as object) };
    } else if (sv !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[key] = sv;
    }
  }
  return result;
}

const SUPPORTED_LOCALE_CODES: readonly SupportedLocale[] = ['en', 'zh', 'es', 'ja'];

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultSettings };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const merged = deepMerge(defaultSettings, parsed);
    // Migration (D-20): if stored preferences have no `locale` but do have legacy `language`,
    // copy it across (normalized to a supported code; unsupported → 'en').
    const storedPrefs = (parsed.preferences ?? {}) as Partial<AppPreferences>;
    if (!storedPrefs.locale && storedPrefs.language) {
      const candidate = String(storedPrefs.language).toLowerCase().split('-')[0];
      merged.preferences.locale = (
        (SUPPORTED_LOCALE_CODES as readonly string[]).includes(candidate) ? candidate : 'en'
      ) as SupportedLocale;
    }
    return merged;
  } catch {
    return { ...defaultSettings };
  }
}

function save(settings: AppSettings): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export const settingsService = {
  async getAll(): Promise<ServiceResult<AppSettings>> {
    return { success: true, data: load() };
  },

  async get<K extends keyof AppSettings>(key: K): Promise<ServiceResult<AppSettings[K]>> {
    const settings = load();
    return { success: true, data: settings[key] };
  },

  async set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<ServiceResult<void>> {
    const settings = load();
    settings[key] = value;
    if (!save(settings)) {
      return { success: false, error: { code: 'DATABASE_ERROR', message: 'Storage quota exceeded. Free up space and try again.', retryable: false } };
    }
    return { success: true };
  },

  async reset(): Promise<ServiceResult<AppSettings>> {
    save(defaultSettings);
    return { success: true, data: { ...defaultSettings } };
  },

  getSync(): AppSettings {
    return load();
  },
};

import type { AppSettings, ServiceResult } from '../../types';

const STORAGE_KEY = 'echolearn_settings';

const defaultSettings: AppSettings = {
  llm: {
    provider: 'openai',
    apiKey: '',
    baseUrl: '',
    model: 'gpt-4o',
    isConfigured: false,
  },
  tts: {
    provider: 'openai',
    apiKey: '',
    baseUrl: '',
    voice: 'alloy',
    speed: 1.0,
    isConfigured: false,
  },
  zerotier: {
    networkId: '',
    isConnected: false,
    virtualIp: undefined,
  },
  podcast: {
    sleepTime: '22:00',
    advanceMinutes: 60,
    autoGenerate: true,
  },
  review: {
    dailyLimit: 20,
    notificationsEnabled: false,
    reminderTime: '09:00',
  },
  preferences: {
    theme: 'system',
    language: 'en',
    onboardingCompleted: false,
    aiConsentGiven: false,
  },
};

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultSettings };
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return { ...defaultSettings };
  }
}

function save(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

export const mockSettingsService = {
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
    save(settings);
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

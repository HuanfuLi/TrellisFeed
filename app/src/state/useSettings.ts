import { useState, useEffect, useCallback } from 'react';
import type { AppSettings, ServiceError } from '../types';
import { settingsService } from '../services/settings.service';

interface UseSettingsReturn {
  settings: AppSettings | null;
  isLoading: boolean;
  error: ServiceError | null;
  set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  reload: () => Promise<void>;
  reset: () => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ServiceError | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    const result = await settingsService.getAll();
    if (result.success && result.data) {
      setSettings(result.data);
    } else {
      setError(result.error ?? null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const set = useCallback(async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const result = await settingsService.set(key, value);
    if (result.success) {
      setSettings((prev) => prev ? { ...prev, [key]: value } : null);
    } else {
      setError(result.error ?? null);
    }
  }, []);

  const reset = useCallback(async () => {
    const result = await settingsService.reset();
    if (result.success && result.data) {
      setSettings(result.data);
    }
  }, []);

  return { settings, isLoading, error, set, reload, reset };
}

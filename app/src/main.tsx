import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import i18n from './locales';
import App from './App.tsx';
import { AppProvider } from './state/AppProvider.tsx';
import { applyTheme } from './lib/theme';
import { settingsService } from './services/settings.service';
import { migrateLegacyKeys } from './services/legacy-migration.service';
import { bindI18nLeaf } from './lib/i18n-leaf';

// Phase 37 (TECHDEBT-01): Wire the leaf shim to the live i18next instance.
// Identity defaults stay in place for tests that don't import this file.
// Cast: i18next's `t` is typed against the literal-key union from i18n.d.ts
// module augmentation; the leaf shim intentionally widens to `string` so any
// caller can pass any key. The bind is byte-stable; the cast erases only the
// compile-time narrowness, not runtime behavior.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
bindI18nLeaf(i18n.t.bind(i18n) as any, () => i18n.language);

// Migrate pre-rebrand echolearn_* localStorage keys to trellis_* before any
// service reads from storage. Idempotent — safe on every boot.
migrateLegacyKeys();

// Apply theme before first paint to prevent flash of wrong theme
applyTheme(settingsService.getSync().preferences.theme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);

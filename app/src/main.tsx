import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './locales';
import App from './App.tsx';
import { AppProvider } from './state/AppProvider.tsx';
import { applyTheme } from './lib/theme';
import { settingsService } from './services/settings.service';

// Apply theme before first paint to prevent flash of wrong theme
applyTheme(settingsService.getSync().preferences.theme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);

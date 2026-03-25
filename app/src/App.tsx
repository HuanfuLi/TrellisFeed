import { useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet, ScrollRestoration } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { BottomNavigation } from './components/BottomNavigation';
import { ToastContainer } from './components/ui/Toast';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { HomeScreen } from './screens/HomeScreen';
import { AskScreen } from './screens/AskScreen';
import { QuestionDetailScreen } from './screens/QuestionDetailScreen';
import { PlannerScreen } from './screens/PlannerScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { PodcastScreen } from './screens/PodcastScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { GraphScreen } from './screens/GraphScreen';
import { PostDetailScreen } from './screens/PostDetailScreen';
import { mockSettingsService } from './services/mock/settings.mock';
import { hydrateFromSQLite } from './services/question.service';
import { applyTheme } from './lib/theme';
import { PageTransition } from './components/PageTransition';

function RootLayout() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--surface)' }}>
      {/* Fixed shield that covers the status bar area so scrolled content never shows under it */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 'var(--safe-area-top)',
          backgroundColor: 'var(--surface)',
          zIndex: 200,
        }}
      />
      {/* paddingTop clears the status bar; paddingBottom clears the bottom nav + home indicator */}
      <div style={{
        paddingTop: 'var(--safe-area-top)',
        paddingBottom: 'calc(80px + var(--safe-area-bottom))',
      }}>
        <Outlet />
      </div>
      <ScrollRestoration />
      <BottomNavigation />
      <ToastContainer />
    </div>
  );
}

function HomeRedirect() {
  const settings = mockSettingsService.getSync();
  if (!settings.preferences.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }
  return <Navigate to="/home" replace />;
}

const router = createBrowserRouter([
  {
    path: '/onboarding',
    element: <OnboardingScreen />,
  },
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'home', element: <PageTransition><HomeScreen /></PageTransition> },
      { path: 'posts/:id', element: <PageTransition><PostDetailScreen /></PageTransition> },
      { path: 'ask', element: <PageTransition><AskScreen /></PageTransition> },
      { path: 'ask/:id', element: <PageTransition><QuestionDetailScreen /></PageTransition> },
      { path: 'graph', element: <PageTransition><GraphScreen /></PageTransition> },
      { path: 'planner', element: <PageTransition><PlannerScreen /></PageTransition> },
      { path: 'review', element: <PageTransition><ReviewScreen /></PageTransition> },
      { path: 'podcast', element: <PageTransition><PodcastScreen /></PageTransition> },
      { path: 'settings', element: <PageTransition><SettingsScreen /></PageTransition> },
    ],
  },
]);

export default function App() {
  // Hydrate questions from SQLite on app start (no-op on web)
  useEffect(() => { void hydrateFromSQLite(); }, []);

  // Keep theme in sync when the OS switches between light/dark while app is open
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const { theme } = mockSettingsService.getSync().preferences;
      if (theme === 'system') applyTheme('system');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // On Capacitor, matchMedia doesn't fire after resume — re-apply theme when app returns to foreground
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let listenerHandle: Awaited<ReturnType<typeof CapApp.addListener>> | null = null;
    void CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        const { theme } = mockSettingsService.getSync().preferences;
        applyTheme(theme);
      }
    }).then((handle) => { listenerHandle = handle; });
    return () => { void listenerHandle?.remove(); };
  }, []);

  // Android hardware back button — navigate back in history, or exit app at root
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let listenerHandle: Awaited<ReturnType<typeof CapApp.addListener>> | null = null;
    void CapApp.addListener('backButton', () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        void CapApp.exitApp();
      }
    }).then((handle) => { listenerHandle = handle; });
    return () => { void listenerHandle?.remove(); };
  }, []);

  return <RouterProvider router={router} />;
}

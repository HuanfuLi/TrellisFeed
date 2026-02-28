import { useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { BottomNavigation } from './components/BottomNavigation';
import { ToastContainer } from './components/ui/Toast';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { HomeScreen } from './screens/HomeScreen';
import { AskScreen } from './screens/AskScreen';
import { QuestionDetailScreen } from './screens/QuestionDetailScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { PodcastScreen } from './screens/PodcastScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { mockSettingsService } from './services/mock/settings.mock';
import { applyTheme } from './lib/theme';

function RootLayout() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--surface)' }}>
      <div style={{ paddingBottom: '80px' }}>
        <Outlet />
      </div>
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
      { path: 'home', element: <HomeScreen /> },
      { path: 'ask', element: <AskScreen /> },
      { path: 'ask/:id', element: <QuestionDetailScreen /> },
      { path: 'calendar', element: <CalendarScreen /> },
      { path: 'review', element: <ReviewScreen /> },
      { path: 'podcast', element: <PodcastScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
    ],
  },
]);

export default function App() {
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

  return <RouterProvider router={router} />;
}

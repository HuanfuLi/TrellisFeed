import { useEffect, useRef, useState } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet, ScrollRestoration, useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Loader2 } from 'lucide-react';
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
import { SettingsAIScreen } from './screens/settings/SettingsAIScreen';
import { SettingsContentScreen } from './screens/settings/SettingsContentScreen';
import { SettingsFeaturesScreen } from './screens/settings/SettingsFeaturesScreen';
import { SettingsDataScreen } from './screens/settings/SettingsDataScreen';
import { GraphScreen } from './screens/GraphScreen';
import { SwipeTabContainer } from './components/SwipeTabContainer';
import { PostDetailScreen } from './screens/PostDetailScreen';
import PostHistoryScreen from './screens/PostHistoryScreen';
import { AnchorDetailScreen } from './screens/AnchorDetailScreen';
import { ClusterDetailScreen } from './screens/ClusterDetailScreen';
import { settingsService } from './services/settings.service';
import { hydrateFromSQLite } from './services/question.service';
import { hydratePlannerFromSQLite } from './services/planner.service';
import { useKeyboard } from './state/useKeyboard';
import { bootstrapImageGeneration } from './services/imageGeneration.bootstrap';
import { applyTheme } from './lib/theme';
import { PageTransition } from './components/PageTransition';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startVoiceRecording, stopVoiceRecording, MicPermissionDeniedError } from './lib/voice-recorder';
import { transcribeAudio } from './providers/stt';
import { toast } from './lib/toast';
import { startScheduler, stopScheduler } from './services/scheduler.service';
import { scheduleNativeNotifications } from './services/scheduler.native';
import { HeaderScrollContext } from './lib/header-scroll-context';

const SCREEN_ROUTES = ['/home', '/planner', '/ask', '/graph', '/settings'] as const;

function RootLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isTopLevelScreen = SCREEN_ROUTES.some(r => location.pathname === r);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const recordingActiveRef = useRef(false);

  // Sub-screen exit animation: cache outlet content so it stays visible during fade-out.
  // Detection is synchronous (setState-during-render) to avoid a one-frame gap where
  // the overlay unmounts before the exit animation starts.
  const [subScreenClosing, setSubScreenClosing] = useState(false);
  const prevIsTopLevelRef = useRef(isTopLevelScreen);
  const cachedOutletRef = useRef<React.ReactNode>(null);
  const outlet = <Outlet />;
  if (!isTopLevelScreen) cachedOutletRef.current = outlet;

  if (!prevIsTopLevelRef.current && isTopLevelScreen && !subScreenClosing) {
    setSubScreenClosing(true);
    setHeaderScrolled(false);
  }
  prevIsTopLevelRef.current = isTopLevelScreen;

  const showSubScreen = !isTopLevelScreen || subScreenClosing;

  useEffect(() => {
    if (subScreenClosing) {
      const timer = setTimeout(() => setSubScreenClosing(false), 200);
      return () => clearTimeout(timer);
    }
  }, [subScreenClosing]);

  useKeyboard();

  const handleAskLongPress = async () => {
    if (recordingActiveRef.current) return;
    try {
      await startVoiceRecording();
      recordingActiveRef.current = true;
      setIsRecording(true);
    } catch (err) {
      console.error('[VoiceAsk] start failed:', err);
      if (err instanceof MicPermissionDeniedError) {
        toast('Microphone permission denied. Check app settings.', 'error');
      } else {
        const code = err instanceof Error ? err.message : String(err);
        if (code.includes('MICROPHONE_BEING_USED')) {
          toast('Microphone is in use by another app.', 'error');
        } else if (code.includes('DEVICE_CANNOT_VOICE_RECORD')) {
          toast('Recording not supported on this device.', 'error');
        } else {
          toast(`Could not start recording: ${code}`, 'error');
        }
      }
    }
  };

  const handleAskLongPressRelease = async () => {
    if (!recordingActiveRef.current) return;
    recordingActiveRef.current = false;
    setIsRecording(false);
    setIsTranscribing(true);
    try {
      const blob = await stopVoiceRecording();
      const settings = settingsService.getSync();
      const text = await transcribeAudio(blob, settings.tts);
      navigate('/ask', { state: { prompt: text?.trim() || '' } });
    } catch (err) {
      console.error('[VoiceAsk] stop/transcribe failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      toast(
        msg.includes('API key') || msg.includes('No API')
          ? 'Add your API key in Speech Recognition settings.'
          : `Transcription failed: ${msg}`,
        'error',
      );
    } finally {
      setIsTranscribing(false);
    }
  };

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

      {/* Swipe container for top-level screens */}
      <SwipeTabContainer
        routes={SCREEN_ROUTES}
        screens={[
          /* Home — manages its own scroll container (height: 100dvh) */
          <div key="home" style={{ paddingTop: 'var(--safe-area-top)' }}>
            <HomeScreen />
          </div>,
          /* Planner — needs scroll wrapper (no internal scroll container) */
          <div key="planner" style={{
            paddingTop: 'var(--safe-area-top)',
            paddingBottom: 'calc(80px + var(--safe-area-bottom))',
            height: '100dvh',
            boxSizing: 'border-box',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            touchAction: 'pan-y',
          } as React.CSSProperties}>
            <PlannerScreen />
          </div>,
          /* Ask — manages its own flex layout and scroll */
          <div key="ask" style={{ paddingTop: 'var(--safe-area-top)' }}>
            <AskScreen />
          </div>,
          /* Graph — needs scroll wrapper */
          <div key="graph" style={{
            paddingTop: 'var(--safe-area-top)',
            paddingBottom: 'calc(80px + var(--safe-area-bottom))',
            height: '100dvh',
            boxSizing: 'border-box',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            touchAction: 'pan-y',
          } as React.CSSProperties}>
            <GraphScreen />
          </div>,
          /* Settings — needs scroll wrapper */
          <div key="settings" style={{
            paddingTop: 'var(--safe-area-top)',
            paddingBottom: 'calc(80px + var(--safe-area-bottom))',
            height: '100dvh',
            boxSizing: 'border-box',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            touchAction: 'pan-y',
          } as React.CSSProperties}>
            <SettingsScreen />
          </div>,
        ]}
      >
        {/* Children rendered outside the strip (fixed position elements) */}
        <BottomNavigation
          onAskLongPress={() => void handleAskLongPress()}
          onAskLongPressRelease={() => void handleAskLongPressRelease()}
          isTopLevelScreen={isTopLevelScreen}
        />
        {/* Recording / transcribing indicator for the nav bar long-press flow */}
        {(isRecording || isTranscribing) && (
          <div
            style={{
              position: 'fixed',
              bottom: 'calc(88px + var(--safe-area-bottom))',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              backgroundColor: 'var(--surface-variant)',
              borderRadius: '999px',
              boxShadow: 'var(--shadow-2)',
              zIndex: 101,
              fontSize: '0.82rem',
              color: 'var(--foreground)',
              whiteSpace: 'nowrap',
              animation: 'fade-in 0.15s ease',
            }}
          >
            {isTranscribing ? (
              <>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary-40)', flexShrink: 0 }} />
                Transcribing…
              </>
            ) : (
              <>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  backgroundColor: 'var(--danger)', flexShrink: 0,
                  animation: 'mic-pulse 1.4s ease-in-out infinite',
                  display: 'inline-block',
                }} />
                Release to send
              </>
            )}
          </div>
        )}
        <ToastContainer />
      </SwipeTabContainer>

      {/* Outlet for sub-screens (rendered on top of swipe container) */}
      {showSubScreen && (
        <>
        <div style={{
          position: 'fixed',
          inset: '-200px 0',
          zIndex: 49,
          backgroundColor: 'var(--surface)',
          pointerEvents: 'none',
          animation: subScreenClosing ? 'fade-out 0.2s ease forwards' : undefined,
        }} />
        <div
          onScroll={(e) => {
            const nextScrolled = e.currentTarget.scrollTop > 4;
            if (nextScrolled !== headerScrolled) setHeaderScrolled(nextScrolled);
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
            backgroundColor: 'var(--surface)',
            paddingTop: 'var(--safe-area-top)',
            paddingBottom: 'var(--safe-area-bottom)',
            overflow: 'auto',
            overscrollBehavior: 'contain',
            animation: subScreenClosing ? 'sub-screen-out 0.2s ease forwards' : 'sub-screen-in 0.2s ease',
            pointerEvents: subScreenClosing ? 'none' : 'auto',
          }}
        >
          <HeaderScrollContext.Provider value={{ scrolled: headerScrolled }}>
            {subScreenClosing ? cachedOutletRef.current : outlet}
          </HeaderScrollContext.Provider>
        </div>
        </>
      )}

      <ScrollRestoration />
    </div>
  );
}

function HomeRedirect() {
  const settings = settingsService.getSync();
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
    element: <ErrorBoundary><RootLayout /></ErrorBoundary>,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'home', element: null },
      { path: 'posts/:id', element: <PageTransition><PostDetailScreen /></PageTransition> },
      { path: 'ask', element: null },
      { path: 'ask/:id', element: <PageTransition><QuestionDetailScreen /></PageTransition> },
      { path: 'anchor/:id', element: <PageTransition><AnchorDetailScreen /></PageTransition> },
      { path: 'cluster/:id', element: <PageTransition><ClusterDetailScreen /></PageTransition> },
      { path: 'graph', element: null },
      { path: 'planner', element: null },
      { path: 'history', element: <PageTransition><PostHistoryScreen /></PageTransition> },
      { path: 'review', element: <PageTransition><ReviewScreen /></PageTransition> },
      { path: 'podcast', element: <PageTransition><PodcastScreen /></PageTransition> },
      { path: 'settings', element: null },
      { path: 'settings/ai', element: <PageTransition><SettingsAIScreen /></PageTransition> },
      { path: 'settings/content', element: <PageTransition><SettingsContentScreen /></PageTransition> },
      { path: 'settings/features', element: <PageTransition><SettingsFeaturesScreen /></PageTransition> },
      { path: 'settings/data', element: <PageTransition><SettingsDataScreen /></PageTransition> },
      { path: '*', element: <Navigate to="/home" replace /> },
    ],
  },
]);

export default function App() {
  // Hydrate data from SQLite on app start (no-op on web)
  useEffect(() => {
    void hydrateFromSQLite();
    void hydratePlannerFromSQLite();
    // Bootstrap image generation providers with keys from user settings.
    bootstrapImageGeneration();
    // Start foreground scheduler (60s poll + app resume checks)
    startScheduler();
    // Schedule native OS notifications for podcast/review reminders
    void scheduleNativeNotifications();
    return () => { stopScheduler(); };
  }, []);

  // Keep theme in sync when the OS switches between light/dark while app is open
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const { theme } = settingsService.getSync().preferences;
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
        const { theme } = settingsService.getSync().preferences;
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

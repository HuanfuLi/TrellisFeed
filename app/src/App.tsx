import { useEffect, useRef, useState } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet, ScrollRestoration, useNavigate } from 'react-router-dom';
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
import { GraphScreen } from './screens/GraphScreen';
import { PostDetailScreen } from './screens/PostDetailScreen';
import { AnchorDetailScreen } from './screens/AnchorDetailScreen';
import { ClusterDetailScreen } from './screens/ClusterDetailScreen';
import { mockSettingsService } from './services/mock/settings.mock';
import { hydrateFromSQLite } from './services/question.service';
import { hydratePlannerFromSQLite } from './services/planner.service';
import { bootstrapImageGeneration } from './services/imageGeneration.bootstrap';
import { applyTheme } from './lib/theme';
import { PageTransition } from './components/PageTransition';
import { startVoiceRecording, stopVoiceRecording, MicPermissionDeniedError } from './lib/voice-recorder';
import { transcribeAudio } from './providers/stt';
import { toast } from './lib/toast';

function RootLayout() {
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  // Guard against starting a new recording while one is already active
  const recordingActiveRef = useRef(false);

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
      const settings = mockSettingsService.getSync();
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
      {/* paddingTop clears the status bar; paddingBottom clears the bottom nav + home indicator */}
      <div style={{
        paddingTop: 'var(--safe-area-top)',
        paddingBottom: 'calc(80px + var(--safe-area-bottom))',
      }}>
        <Outlet />
      </div>
      <ScrollRestoration />
      <BottomNavigation
        onAskLongPress={() => void handleAskLongPress()}
        onAskLongPressRelease={() => void handleAskLongPressRelease()}
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
                backgroundColor: '#E53935', flexShrink: 0,
                animation: 'mic-pulse 1.4s ease-in-out infinite',
                display: 'inline-block',
              }} />
              Release to send
            </>
          )}
        </div>
      )}
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
      { path: 'anchor/:id', element: <PageTransition><AnchorDetailScreen /></PageTransition> },
      { path: 'cluster/:id', element: <PageTransition><ClusterDetailScreen /></PageTransition> },
      { path: 'graph', element: <PageTransition><GraphScreen /></PageTransition> },
      { path: 'planner', element: <PageTransition><PlannerScreen /></PageTransition> },
      { path: 'review', element: <PageTransition><ReviewScreen /></PageTransition> },
      { path: 'podcast', element: <PageTransition><PodcastScreen /></PageTransition> },
      { path: 'settings', element: <PageTransition><SettingsScreen /></PageTransition> },
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
  }, []);

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

import { useEffect, useRef, useState } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet, ScrollRestoration, useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Loader2 } from 'lucide-react';
import { BottomNavigation } from './components/BottomNavigation';
import { ToastContainer } from './components/ui/Toast';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ResearchSetupScreen } from './screens/ResearchSetupScreen';
import { ResearchDiagnosticsScreen } from './screens/ResearchDiagnosticsScreen';
import { SwipeTabContainer } from './components/SwipeTabContainer';
import { PostDetailScreen } from './screens/PostDetailScreen';
import SavedScreen from './screens/SavedScreen';
import { settingsService } from './services/settings.service';
import { hydrateFromSQLite } from './services/question.service';
// Phase 55 D-12 boot orchestration — every migrated heavy-store service's hydrate.
import { hydrateDailyPostsFromSQLite } from './services/concept-feed.service';
import { hydrateQueueFromSQLite } from './services/post-queue.service';
import { hydratePostHistoryFromSQLite } from './services/post-history.service';
import { hydrateEngagementFromSQLite } from './services/engagement.service';
import { studyContextService } from './services/study-context.service';
import { clearLegacyHeavyLocalStorageKeys } from './services/db.service';
// Phase 55.1-07 GAP-C — boot pre-warm of the filter-corpus embedding cache so the
// first ask doesn't pay the 124-sequential-embed cold path (measured dominant
// cold-start stall — see scripts/profile-cold-start.mjs).
import { prewarmFilterCorpus } from './services/filter-corpus.service';
import { useKeyboard } from './state/useKeyboard';
import { bootstrapImageGeneration } from './services/imageGeneration.bootstrap';
import { applyTheme } from './lib/theme';
import { PageTransition } from './components/PageTransition';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HeaderScrollContext } from './lib/header-scroll-context';

const SCREEN_ROUTES = ['/home', '/settings'] as const;

/** Left-edge band (px) where a back-swipe can begin — matches iOS's own screen-edge gesture. */
const EDGE_SWIPE_ZONE = 28;
/** Horizontal travel (px) needed to commit the back-swipe on release. */
const EDGE_SWIPE_COMMIT_PX = 70;

function RootLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isTopLevelScreen = SCREEN_ROUTES.some(r => location.pathname === r);
  const [headerScrolled, setHeaderScrolled] = useState(false);

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

  // ── iOS-style edge-swipe back (sub-screens only) ────────────────────────
  // Commit-on-release rather than a finger-following drag: sub-screen Headers
  // portal to document.body (see Header.tsx), so translating this overlay
  // would slide the content out from under a header pinned to the viewport.
  // Navigating instead reuses the existing `sub-screen-out` exit animation.
  const edgeSwipeRef = useRef({ x: 0, y: 0, active: false });

  const onSubScreenTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      edgeSwipeRef.current.active = false;
      return;
    }
    const t = e.touches[0];
    edgeSwipeRef.current = { x: t.clientX, y: t.clientY, active: t.clientX <= EDGE_SWIPE_ZONE };
  };

  const onSubScreenTouchEnd = (e: React.TouchEvent) => {
    const start = edgeSwipeRef.current;
    if (!start.active) return;
    edgeSwipeRef.current.active = false;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = Math.abs(t.clientY - start.y);
    // Rightward, decisively horizontal, past the commit distance.
    if (dx >= EDGE_SWIPE_COMMIT_PX && dx > dy * 1.5) navigate(-1);
  };

  const onSubScreenTouchCancel = () => {
    edgeSwipeRef.current.active = false;
  };

  useEffect(() => {
    if (subScreenClosing) {
      const timer = setTimeout(() => setSubScreenClosing(false), 200);
      return () => clearTimeout(timer);
    }
  }, [subScreenClosing]);

  const keyboardOpen = useKeyboard();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--surface)', overflowX: 'hidden' }}>
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
          isTopLevelScreen={isTopLevelScreen}
          keyboardOpen={keyboardOpen}
        />
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
          onTouchStart={onSubScreenTouchStart}
          onTouchEnd={onSubScreenTouchEnd}
          onTouchCancel={onSubScreenTouchCancel}
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
  if (!studyContextService.isBound()) {
    return <Navigate to="/research-setup" replace />;
  }
  const settings = settingsService.getSync();
  if (!settings.preferences.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }
  return <Navigate to="/home" replace />;
}

/** Ensure deep links cannot reveal participant routes before researcher binding. */
function ParticipantRouteGate() {
  if (!studyContextService.isBound()) {
    return <Navigate to="/research-setup" replace />;
  }
  return <RootLayout />;
}

const router = createBrowserRouter([
  {
    path: '/research-setup',
    element: <ResearchSetupScreen />,
  },
  {
    path: '/research-diagnostics',
    element: <ResearchDiagnosticsScreen />,
  },
  {
    path: '/onboarding',
    element: <OnboardingScreen />,
  },
  {
    path: '/',
    element: <ErrorBoundary><ParticipantRouteGate /></ErrorBoundary>,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'home', element: null },
      { path: 'posts/:id', element: <PageTransition><PostDetailScreen /></PageTransition> },
      { path: 'saved', element: <PageTransition><SavedScreen /></PageTransition> },
      { path: 'settings', element: null },
      { path: '*', element: <Navigate to="/home" replace /> },
    ],
  },
]);

// Phase 55-07: hydrate EVERY migrated heavy-store service's in-memory mirror
// from IndexedDB once on boot. AWAITED (Promise.all) before the main app
// renders — IndexedDB reads are async and the in-memory mirrors are now the SOLE
// synchronous read path, so first render MUST wait for hydration or post-boot
// reads return empty (empty-feed flash, premature refill against an empty queue).
// Each hydrate emits its own resync event (GRAPH_UPDATED / SESSION_UPDATED /
// ENGAGEMENT_CHANGED / COLLECTIONS_CHANGED / FLASHCARDS_CREATED) so always-mounted
// screens re-read without a refresh.
//
// AFTER hydration completes, the one-time D-11 cutover sweep removes the now-stale
// legacy heavy localStorage keys — ONLY after the mirrors are restored from
// IndexedDB, never before (a pre-hydrate clear would discard data if IndexedDB
// were somehow staler; the dual-write means IndexedDB is current).
async function hydrateAllFromSQLite(): Promise<void> {
  await Promise.all([
    hydrateFromSQLite(),            // questions
    hydrateDailyPostsFromSQLite(),  // concept-feed daily-posts cache
    hydrateQueueFromSQLite(),       // post-queue state
    hydratePostHistoryFromSQLite(), // post history
    hydrateEngagementFromSQLite(),  // saved/liked/dismissed
    studyContextService.hydrate(),   // immutable participant identity
  ]);
  // One-time stale-key sweep (quota reclamation) — safe now that every mirror is
  // populated from the durable IndexedDB store.
  clearLegacyHeavyLocalStorageKeys();
}

export default function App() {
  // Gate first render on hydration so post-boot synchronous mirror reads have
  // data (no empty-feed flash, no premature refill against an empty queue).
  const [hydrated, setHydrated] = useState(false);

  // Hydrate data from IndexedDB on app start, THEN reveal the app.
  useEffect(() => {
    let cancelled = false;
    void hydrateAllFromSQLite().finally(() => {
      if (!cancelled) setHydrated(true);
    });
    // Bootstrap image generation providers with keys from user settings.
    bootstrapImageGeneration();
    // Phase 55.1-07 GAP-C — fire-and-forget boot warm-up of the filter-corpus
    // embedding cache. The malicious RAW-ARGMAX pre-gate runs filterQuestion
    // BEFORE chatStream on every ask; on a cold cache that pays 124 sequential
    // corpus embeds (~6.9s in-process, measured) and dominates the first
    // roundtrip. Warming it here at boot — NOT awaited, so it never delays first
    // paint — lets the first ask hit the warm localStorage cache. Non-blocking,
    // key-absent/offline-safe (no-ops when embedding is unconfigured, swallows
    // embed errors). See scripts/profile-cold-start.mjs for the measurement.
    void prewarmFilterCorpus(settingsService.getSync().embedding);
    return () => { cancelled = true; };
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

  // Minimal neutral loading placeholder until the IndexedDB hydration resolves.
  // Plain on purpose — a spinner on the app surface color avoids a flash of an
  // empty feed / premature feed-refill against an empty in-memory queue.
  if (!hydrated) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--surface)',
        }}
      >
        <Loader2
          size={28}
          style={{ animation: 'spin 1s linear infinite', color: 'var(--primary-40)' }}
        />
      </div>
    );
  }

  return <RouterProvider router={router} />;
}

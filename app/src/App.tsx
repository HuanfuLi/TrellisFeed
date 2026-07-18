import { useEffect, useRef, useState } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet, ScrollRestoration, useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
import { hydratePostHistoryFromSQLite } from './services/post-history.service';
import { hydrateEngagementFromSQLite } from './services/engagement.service';
import { studyContextService } from './services/study-context.service';
import { clearLegacyHeavyLocalStorageKeys } from './services/db.service';
// Phase 55.1-07 GAP-C — boot pre-warm of the filter-corpus embedding cache so the
// first ask doesn't pay the 124-sequential-embed cold path (measured dominant
// cold-start stall — see scripts/profile-cold-start.mjs).
import { prewarmFilterCorpus } from './services/filter-corpus.service';
import { useKeyboard } from './state/useKeyboard';
import { applyTheme } from './lib/theme';
import { PageTransition } from './components/PageTransition';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HeaderScrollContext } from './lib/header-scroll-context';
import { interactionLog } from './services/interaction-log.service';
import { eventBus } from './lib/event-bus';
import { hasAffirmativeResearchConsent, resolveParticipantRoute } from './services/research-consent.service';
import { contentPoolRepository, type ContentPoolRepositorySnapshot } from './services/content-pool.repository';
import { hydratePostQa } from './services/post-qa.service';
import {
  flushPendingUploads,
  reconcileResearchOutbox,
  registerRetryTriggers,
} from './services/upload-queue.service';

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
  const decision = resolveParticipantRoute(studyContextService.isBound());
  if (decision === 'research-setup') {
    return <Navigate to="/research-setup" replace />;
  }
  if (decision === 'onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  return <Navigate to="/home" replace />;
}

/** Ensure deep links cannot reveal participant routes before researcher binding. */
function ParticipantRouteGate() {
  const decision = resolveParticipantRoute(studyContextService.isBound());
  if (decision === 'research-setup') {
    return <Navigate to="/research-setup" replace />;
  }
  if (decision === 'onboarding') return <Navigate to="/onboarding" replace />;
  return <RootLayout />;
}

function OnboardingRouteGate() {
  const decision = resolveParticipantRoute(studyContextService.isBound());
  if (decision === 'research-setup') return <Navigate to="/research-setup" replace />;
  if (decision === 'participant') return <Navigate to="/home" replace />;
  return <OnboardingScreen />;
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
    element: <OnboardingRouteGate />,
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

// Hydrate every active durable mirror before revealing participant routes.
// The frozen pool is validated/imported in the same barrier, so Home never sees
// a partial bundle or falls back to a generated/network content path.
//
// AFTER hydration completes, the one-time D-11 cutover sweep removes the now-stale
// legacy heavy localStorage keys — ONLY after the mirrors are restored from
// IndexedDB, never before (a pre-hydrate clear would discard data if IndexedDB
// were somehow staler; the dual-write means IndexedDB is current).
async function hydrateAllFromSQLite(): Promise<ContentPoolRepositorySnapshot> {
  const [, , , , contentPool] = await Promise.all([
    hydrateFromSQLite(),            // questions
    hydratePostHistoryFromSQLite(), // post history
    hydrateEngagementFromSQLite(),  // saved/liked/dismissed
    studyContextService.hydrate(),   // immutable participant identity
    contentPoolRepository.hydrate(), // validated, version-pinned frozen pool
    hydratePostQa(),                 // canonical same-post Q&A records
  ]);
  // One-time stale-key sweep (quota reclamation) — safe now that every mirror is
  // populated from the durable IndexedDB store.
  clearLegacyHeavyLocalStorageKeys();
  return contentPool;
}

export default function App() {
  const { t } = useTranslation();
  // Gate first render on hydration so synchronous repository reads are ready.
  const [hydrated, setHydrated] = useState(false);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [hydrationAttempt, setHydrationAttempt] = useState(0);
  const sessionStartedAtRef = useRef<number | null>(null);

  const startResearchSession = () => {
    if (!studyContextService.isBound() || !hasAffirmativeResearchConsent() || sessionStartedAtRef.current !== null) return;
    sessionStartedAtRef.current = Date.now();
    void interactionLog.record('app_open').catch(() => { /* observer only */ });
  };

  const endResearchSession = () => {
    const startedAt = sessionStartedAtRef.current;
    if (startedAt === null) return;
    sessionStartedAtRef.current = null;
    void interactionLog.record('session_end', {
      durationMs: Math.max(0, Date.now() - startedAt),
    }).catch(() => { /* observer only */ });
  };

  // Hydrate data from IndexedDB on app start, THEN reveal the app.
  useEffect(() => {
    let cancelled = false;
    let disposeRetryTriggers: (() => void) | null = null;
    setPoolError(null);
    void hydrateAllFromSQLite().then(async (contentPool) => {
      if (cancelled) return;
      if (studyContextService.isBound()) {
        disposeRetryTriggers = registerRetryTriggers();
        if (hasAffirmativeResearchConsent()) {
          await reconcileResearchOutbox();
          if (cancelled) return;
          void flushPendingUploads();
        }
      }
      if (contentPool.status === 'ready') {
        setHydrated(true);
        startResearchSession();
      } else {
        setPoolError(contentPool.errorCode ?? 'POOL_IMPORT_FAILED');
      }
    }).catch(() => {
      if (!cancelled) setPoolError('POOL_IMPORT_FAILED');
    });
    // Phase 55.1-07 GAP-C — fire-and-forget boot warm-up of the filter-corpus
    // embedding cache. The malicious RAW-ARGMAX pre-gate runs filterQuestion
    // BEFORE chatStream on every ask; on a cold cache that pays 124 sequential
    // corpus embeds (~6.9s in-process, measured) and dominates the first
    // roundtrip. Warming it here at boot — NOT awaited, so it never delays first
    // paint — lets the first ask hit the warm localStorage cache. Non-blocking,
    // key-absent/offline-safe (no-ops when embedding is unconfigured, swallows
    // embed errors). See scripts/profile-cold-start.mjs for the measurement.
    void prewarmFilterCorpus(settingsService.getSync().embedding);
    const unsubscribeIdentity = eventBus.subscribe('RESEARCH_IDENTITY_BOUND', () => {
      startResearchSession();
    });
    return () => {
      cancelled = true;
      disposeRetryTriggers?.();
      unsubscribeIdentity();
    };
  }, [hydrationAttempt]);

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
    let listenerHandle: Awaited<ReturnType<typeof CapApp.addListener>> | null = null;
    const handlePageHide = () => endResearchSession();
    const handlePageShow = () => startResearchSession();
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);
    if (Capacitor.isNativePlatform()) {
      void CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          startResearchSession();
          const { theme } = settingsService.getSync().preferences;
          applyTheme(theme);
        } else {
          endResearchSession();
        }
      }).then((handle) => { listenerHandle = handle; });
    }
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
      void listenerHandle?.remove();
    };
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
  if (poolError) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'var(--surface)',
          color: 'var(--foreground)',
        }}
      >
        <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 12px', fontSize: 22 }}>{t('errorBoundary.title')}</h1>
          <p style={{ margin: '0 0 8px', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
            {t('errorBoundary.fallbackMessage')}
          </p>
          <code style={{ display: 'block', marginBottom: 20, fontSize: 12, color: 'var(--muted-foreground)' }}>
            {poolError}
          </code>
          <button
            type="button"
            onClick={() => setHydrationAttempt((attempt) => attempt + 1)}
            style={{
              minHeight: 44,
              padding: '0 20px',
              border: 0,
              borderRadius: 'var(--radius-xl)',
              background: 'var(--primary-40)',
              color: 'white',
              font: 'inherit',
              fontWeight: 600,
            }}
          >
            {t('home.history.errorRetry')}
          </button>
        </div>
      </div>
    );
  }

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

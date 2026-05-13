import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bookmark, BookOpen, CheckSquare, Headphones, Sparkles, AlertCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { type InfoFlowItem } from '../components/InfoFlow';
import { MasonryFeed } from '../components/MasonryFeed';
import { LongPressMenu } from '../components/LongPressMenu';
import { VineProgress } from '../components/VineProgress';
import { Confetti } from '../components/Confetti';
import { ScrollToTopFAB } from '../components/ScrollToTopFAB';
import { PullUpHint, PULL_THRESHOLD } from '../components/PullUpHint';
import { infiniteScrollService } from '../services/infiniteScroll.service';
import { postQueueService } from '../services/post-queue.service';
import { postHistoryService } from '../services/post-history.service';
import type { DailyPost, Question } from '../types';
import { useQuestions } from '../state/useQuestions';
import { useReview } from '../state/useReview';
import { usePodcast } from '../state/usePodcast';
import { plannerService } from '../services/planner.service';
import { plannerAutoGenService } from '../services/plannerAutoGen.service';
import { settingsService } from '../services/settings.service';
import { conceptFeedService } from '../services/concept-feed.service';
import { dailyReadService, getConceptQuota } from '../services/daily-read.service';
import { engagementService } from '../services/engagement.service';
import { trellisCreditsService } from '../services/trellis-credits.service';
import { eventBus } from '../lib/event-bus';
import { today, getGreeting } from '../lib/date';
import { toast } from '../lib/toast';



export function HomeScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { questions, isLoading: questionsLoading } = useQuestions();
  const { reviewCount } = useReview();
  const { getPodcastForDate } = usePodcast();
  // Phase 43 gap-closure 43-15 — warm-start tier metadata captured at
  // useState construction time. Read by the mount-once useEffect below to
  // (a) splice the seeded ids out of postQueueService._state.posts so
  // loadNextBatch cannot re-pop them (the duplicate-key root cause from
  // UAT Test 12); (b) seed infiniteScrollService.seenPostIds as
  // defense-in-depth at the service-level dedup boundary. See
  // .planning/debug/duplicate-post-keys-after-force-new-day.md.
  const warmStartTierRef = useRef<{ tier: 'cache' | 'yesterday' | 'history' | 'empty'; seededIds: string[] }>({ tier: 'empty', seededIds: [] });

  const [dailyPosts, setDailyPosts] = useState<DailyPost[]>(() => {
    // Warm start (D-30): If today's cache is empty, show yesterday's remaining queue
    const cached = conceptFeedService.getCachedDailyPosts();
    if (cached.length > 0) {
      warmStartTierRef.current = { tier: 'cache', seededIds: cached.map(p => p.id) };
      return cached;
    }
    postQueueService.loadQueue();
    const yesterday = postQueueService.getYesterdayQueue();
    if (yesterday.length > 0) {
      const slice = yesterday.slice(0, 8);
      warmStartTierRef.current = { tier: 'yesterday', seededIds: slice.map(p => p.id) };
      return slice;
    }
    // D-32 fallback: show last 4 from history
    const history = postHistoryService.getPosts().slice(0, 4);
    warmStartTierRef.current = { tier: 'history', seededIds: history.map(p => p.id) };
    return history;
  });
  // Phase 36 GAP-A: Capture warm-start presence at mount BEFORE the async
  // getDailyPosts call. Used as the disambiguator inside the .then handler
  // to decide whether an empty getDailyPosts return is a normal cold-start
  // (warm-start was seeded → queue not ready yet, no error UI) or a genuine
  // error (no warm-start AND empty fetch → "Check your API keys" UI).
  //
  // Ref-snapshot pattern (NOT functional updater) chosen for two reasons:
  // 1. Strict Mode compatibility: React.StrictMode (main.tsx:14) double-invokes
  //    state updater functions in dev. Calling setGenerationError(true) inside
  //    a setDailyPosts(prev => ...) updater violates the React purity contract
  //    (updater functions must be side-effect-free).
  // 2. The warm-start presence is a fact-at-mount, not a continuously-derived
  //    value — useRef is the canonical place for "snapshot at construction
  //    time, read in async callbacks" data.
  // See .planning/debug/cold-start-empty-feed.md.
  const warmStartHadPostsRef = useRef(dailyPosts.length > 0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const isLoadingMoreRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Phase 43-06: LongPressMenu host state (LP-01..LP-04). HomeScreen owns the
  // sheet's open + post/anchor context state; MasonryFeed long-press emits
  // `onLongPress(postId, anchorId)` (43-03 contract) which hydrates these and
  // opens the bottom-sheet. engagementVersion bumps on ANCHOR_DISMISSED /
  // ENGAGEMENT_CHANGED so MasonryFeed's per-tile corner-icon useMemo
  // dep arrays re-run (Phase 42 leaf-discipline D-04).
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPostId, setMenuPostId] = useState<string | null>(null);
  const [menuAnchorId, setMenuAnchorId] = useState<string | null>(null);
  const [engagementVersion, setEngagementVersion] = useState(0);

  const handleLongPress = useCallback((postId: string, anchorId: string) => {
    setMenuPostId(postId);
    setMenuAnchorId(anchorId);
    setMenuOpen(true);
  }, []);
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  // Phase 43 gap-closure 43-15 — mount-once: if the warm-start initializer
  // seeded dailyPosts from the yesterday-queue tier, remove those ids from
  // postQueueService._state.posts AND seed infiniteScrollService.seenPostIds
  // so the next loadNextBatch (swipe-for-more) cannot re-pop them.
  //
  // PRIMARY: removeByIds makes the two stores (warm-start dailyPosts +
  // postQueueService._state.posts) mutually exclusive — the structural
  // fix per UAT Test 12 root_cause approach (A).
  //
  // DEFENSE-IN-DEPTH: seedSeen primes infiniteScrollService.seenPostIds so
  // the existing dedup at infiniteScroll.service.ts:50 also catches any
  // future overlap — approach (B) from UAT root_cause.
  //
  // Cache tier (Plan 36-11 stale-cache rejection passed; today's served
  // posts) does NOT need this cleanup — those posts came from the cache,
  // not from _state.posts. History tier likewise. Only the yesterday-tier
  // path needs the splice + seed.
  //
  // See .planning/debug/duplicate-post-keys-after-force-new-day.md.
  useEffect(() => {
    const { tier, seededIds } = warmStartTierRef.current;
    if (tier === 'yesterday' && seededIds.length > 0) {
      postQueueService.removeByIds(seededIds);
      infiniteScrollService.seedSeen(seededIds);
    } else if (tier === 'cache' || tier === 'history') {
      // Seed the seenPostIds set even for cache + history tiers — if a
      // future loadNextBatch ever returns one of these ids (e.g., a
      // post-history fallback that ended up in trellis_post_queue),
      // service-level dedup catches it.
      if (seededIds.length > 0) {
        infiniteScrollService.seedSeen(seededIds);
      }
    }
  }, []);

  // D-22b (Phase 33 Plan 06): snapshot settings reads to avoid re-evaluating
  // settingsService.getSync() on every render. /home is always-mounted (Phase 22
  // swipe-tab architecture) so it re-renders frequently on event-bus emissions.
  // Snapshot pattern is per CONTEXT D-22 option (b) — subscribe-once-on-mount.
  // Settings changes during a single home-screen mount are rare (user navigates to
  // /settings, changes a value, navigates back). If invalidation becomes needed,
  // add an event-bus subscription that calls a setter; the snapshot pattern
  // already supports it.
  const [settingsSnapshot] = useState(() => {
    const s = settingsService.getSync();
    return {
      showConnectionScores: s.embeddingDebug.showScores,
    };
  });

  // Stable ref so the onLoadMore callback can access latest questions
  // without re-creating the callback (which would reset scroll listeners).
  const questionsRef = useRef<Question[]>(questions);
  questionsRef.current = questions;

  const todayDate = today();
  const todayPodcast = getPodcastForDate(todayDate);

  useEffect(() => {
    // Don't fetch posts until questions have finished loading — running with
    // an empty-but-loading questions array would wipe the cache and flash the feed.
    if (questionsLoading) return;

    const refreshPlannerSummary = () => {
      setSuggestedMoveCount(plannerAutoGenService.getMoves().length + plannerService.getSuggestedChunks().length);
    };

    const refreshFeed = () => {
      let cancelled = false;
      void conceptFeedService.getDailyPosts(questions).then((posts) => {
        if (!cancelled) setDailyPosts(posts);
      }).catch((err) => console.warn('[HomeScreen] feed refresh failed:', err));
      return () => { cancelled = true; };
    };

    let cancelled = false;
    setIsGenerating(true);
    setGenerationError(false);
    void conceptFeedService.getDailyPosts(questions).then((posts) => {
      if (!cancelled) {
        // Warm-start guard (Phase 36 GAP-A): getDailyPosts returns [] on a new-day
        // cold start by design (today's queue empty; refillQueue runs in background).
        // The useState initializer at lines 38-47 may have already seeded dailyPosts
        // with yesterday's leftover queue via postQueueService.getYesterdayQueue().
        // Only overwrite when getDailyPosts returns actual posts — top-level setter,
        // pure (Strict Mode safe).
        if (posts.length > 0) {
          setDailyPosts(posts);
        }
        setIsGenerating(false);
        // Error-gate suppression (Phase 36 GAP-A): only flag generationError when
        // BOTH today's getDailyPosts returned [] AND no warm-start fallback was
        // seeded at mount (warmStartHadPostsRef captured pre-fetch). If warm-start
        // was present, the user can see content and the empty `posts` is a normal
        // cold-start condition, not an error. Original 6cda914e error-gate intent
        // (genuinely broken API keys) is preserved by the !warmStartHadPostsRef.current
        // condition — no warm-start AND no fetch result = real error.
        // Top-level conditional setter (no nested setState — Strict Mode safe).
        if (posts.length === 0 && questions.length > 0 && !warmStartHadPostsRef.current) {
          setGenerationError(true);
        }
      }
    }).catch((err) => {
      console.warn('[HomeScreen] feed generation failed:', err);
      if (!cancelled) {
        setIsGenerating(false);
        setGenerationError(true);
      }
    });
    refreshPlannerSummary();

    const unsubPlanner = eventBus.subscribe('PLANNER_UPDATED', (event) => {
      refreshPlannerSummary();
      if (event.payload.reason !== 'chunk') {
        conceptFeedService.clearCache();
        refreshFeed();
      }
    });

    const unsubPostDeleted = eventBus.subscribe('POST_DELETED', (event) => {
      setDailyPosts((prev) => prev.filter((p) => p.id !== event.payload.id));
    });

    const delayedRefreshTimer = setTimeout(() => {
      if (!cancelled) refreshFeed();
    }, 8000);

    return () => {
      cancelled = true;
      clearTimeout(delayedRefreshTimer);
      unsubPlanner();
      unsubPostDeleted();
    };
  }, [questions, questionsLoading]);

  // Re-sync feed from cache when navigating back to /home.
  // Mirrors the line-38 useState initializer's fallback chain (tier 1: cache,
  // tier 2: yesterday's rehydrated queue). The initializer runs ONCE at mount
  // — HomeScreen is always-mounted in SwipeTabContainer, so navigate('/home')
  // does NOT remount it. Without this re-fallback, after Plan 36-15's
  // SettingsDataScreen mutation invalidates the daily-posts cache,
  // getCachedDailyPosts() returns [] and the feed renders empty — the
  // rehydrated _state.posts (Plan 36-11 Task 2) sits unreachable until the
  // next async getDailyPosts run (which is mount-only, not navigation-fired).
  // Phase 36-14 — closes the runtime half of round-4 sub-issue (b).
  //
  // Phase 43 gap-closure 43-15 — when tier-2 (yesterday-queue) fires, also
  // remove the seeded ids from _state.posts so loadNextBatch cannot re-pop
  // them (the duplicate-key root cause from UAT Test 12). seedSeen is the
  // defense-in-depth at the service-level dedup boundary.
  useEffect(() => {
    if (location.pathname !== '/home') return;
    const cached = conceptFeedService.getCachedDailyPosts();
    if (cached.length > 0) {
      setDailyPosts(cached);
      // Seed seenPostIds for cache tier too (defense-in-depth)
      infiniteScrollService.seedSeen(cached.map(p => p.id));
      return;
    }
    // Tier-2 fallback: yesterday's UNSERVED queue, rehydrated by
    // postQueueService.load()'s date-mismatch branch (Plan 36-11 Task 2).
    // This is the runtime mirror of the line-38 useState initializer's tier 2.
    postQueueService.loadQueue();
    const yesterdayQueue = postQueueService.getYesterdayQueue();
    if (yesterdayQueue.length > 0) {
      const slice = yesterdayQueue.slice(0, 8);
      setDailyPosts(slice);
      // Phase 43 gap-closure 43-15 — splice the seeded ids out of
      // _state.posts so loadNextBatch cannot re-pop them on the next
      // swipe-for-more. seedSeen primes the service-level dedup as
      // defense-in-depth. See .planning/debug/duplicate-post-keys-after-
      // force-new-day.md.
      const seededIds = slice.map(p => p.id);
      postQueueService.removeByIds(seededIds);
      infiniteScrollService.seedSeen(seededIds);
      return;
    }
    // Both tiers empty — preserve current behavior (set to empty so the
    // generic empty-state rendering takes over). The async getDailyPosts
    // flow elsewhere will repopulate when its triggers fire.
    setDailyPosts([]);
  }, [location.pathname]);

  // Load handler — called on intentional pull-and-release gesture.
  // Generates posts AND their images before adding to the feed so cards
  // appear fully ready (no skeleton → image pop-in).
  const handleLoad = useCallback(async () => {
    if (isLoadingMoreRef.current) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      // Pop 8 per swipe — bumped from 4 on 2026-05-10 for the masonry feed (operator
      // request: half-width tiles consume twice as fast as the prior single-column
      // InlineInfoFlow). See CLAUDE.md "Concept Feed Generation Pipeline" — paired
      // with REFILL_THRESHOLD bump 16 → 24 in post-queue.service.ts.
      const newPosts = await infiniteScrollService.loadNextBatch(questionsRef.current, 8);
      if (newPosts.length > 0) {
        // Phase 33 UAT-4 fix (2026-04-20): only pre-generate images for posts
        // that actually RENDER an image. Previously this loop ran generateImage
        // for every post regardless of presentationStyle, and with a real
        // Gemini/NanoBanana key each call hit the provider for seconds —
        // blocking the swipe on "Loading more posts" for 10-30s while 3 of 4
        // generations were thrown away (video/short/news/text-art ignore the
        // result). Now we only wait for the subset that will use the image.
        // Dev-mode instrumentation (2026-04-21): track what styles the queue
        // is actually serving so "no image posts" regressions surface per-pop.
        if (import.meta.env.DEV) {
          const styles: Record<string, number> = {};
          for (const p of newPosts) {
            const k = p.presentationStyle ?? 'unknown';
            styles[k] = (styles[k] ?? 0) + 1;
          }
          console.info(`[HomeScreen loadNextBatch] popped ${newPosts.length} posts, styles:`, styles);
        }
        // Image pre-generation now happens in refillQueue BEFORE enqueue
        // (2026-04-21 architectural fix). By the time a post pops here, its
        // image is already in the IndexedDB cache — InfoFlow's useState
        // initializer hits the cache and renders instantly. No pop-time
        // image generation means no loading-state lag on swipe.
        conceptFeedService.appendToCache(newPosts);
        // Phase 43 gap-closure 43-15 — id-based dedup at the render boundary.
        // Defense-in-depth against any future code path that bypasses both
        // postQueueService.removeByIds() (the structural fix) AND
        // infiniteScrollService.seenPostIds dedup at the service-level
        // boundary. If a duplicate id somehow reaches here, it must NOT
        // produce a duplicate React key in MasonryFeed. See
        // .planning/debug/duplicate-post-keys-after-force-new-day.md UAT Test 12.
        setDailyPosts((prev) => {
          const seen = new Set(prev.map(p => p.id));
          const fresh = newPosts.filter(p => !seen.has(p.id));
          if (fresh.length === newPosts.length) {
            return [...prev, ...newPosts];
          }
          if (import.meta.env.DEV && fresh.length < newPosts.length) {
            console.warn(
              `[HomeScreen handleLoad] dropped ${newPosts.length - fresh.length} duplicate post(s) at concat boundary — should not happen with 43-15 fixes in place`,
            );
          }
          return [...prev, ...fresh];
        });
      } else {
        // Phase 42 D-11: Toast removed; vine-bloom celebration card (plan 42-04) handles the
        // "no more posts" state via allExplored prop passed to MasonryFeed.
      }
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps -- questionsRef + isLoadingMoreRef are refs

  // Stable ref so the touch effect can always call the latest handleLoad
  const handleLoadRef = useRef(handleLoad);
  handleLoadRef.current = handleLoad;

  // Initialize infiniteScrollService on mount; reset on unmount; purge old history
  useEffect(() => {
    infiniteScrollService.initialize();
    postHistoryService.purgeExpired();
    return () => { infiniteScrollService.reset(); };
  }, []);

  // Retry generation after error
  const retryGeneration = useCallback(() => {
    setIsGenerating(true);
    setGenerationError(false);
    void conceptFeedService.getDailyPosts(questionsRef.current).then((posts) => {
      setDailyPosts(posts);
      setIsGenerating(false);
      if (posts.length === 0 && questionsRef.current.length > 0) {
        setGenerationError(true);
      }
    }).catch((err) => {
      console.warn('[HomeScreen] feed retry failed:', err);
      setIsGenerating(false);
      setGenerationError(true);
    });
  }, []);

  // Pull-to-load gesture: track overscroll at the bottom via touch events.
  // Non-passive touchmove so we can preventDefault() to own the gesture
  // and prevent the browser's native rubber-band while pulling.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let touchStartY = 0;
    let tracking = false;
    let currentPull = 0;

    const onTouchStart = (e: TouchEvent) => {
      // Only arm the gesture when already at the absolute bottom
      const dist = el.scrollHeight - (el.scrollTop + el.clientHeight);
      if (dist > 4) return; // not at bottom (4px tolerance for subpixel)
      if (isLoadingMoreRef.current) return;
      touchStartY = e.touches[0].clientY;
      tracking = true;
      currentPull = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return;
      // Claim the gesture immediately — must be before any early-return so the
      // browser never gets a chance to rubber-band the page on the first event.
      e.preventDefault();
      const dy = touchStartY - e.touches[0].clientY; // positive = pull up
      if (dy < -10) {
        // Clear intentional downward swipe — cancel the pull gesture
        tracking = false;
        if (currentPull > 0) {
          currentPull = 0;
          setPullDistance(0);
        }
        return;
      }
      if (dy <= 0) return; // Tiny jitter at gesture start — stay armed, wait for real movement
      currentPull = dy;
      setPullDistance(dy);
    };

    const onTouchEnd = () => {
      if (!tracking) return;
      const pd = currentPull;
      tracking = false;
      currentPull = 0;
      setPullDistance(0); // triggers CSS snap-back transition in PullUpHint
      if (pd >= PULL_THRESHOLD) {
        void handleLoadRef.current();
      }
    };

    // ── Mouse drag (PC testing) ─────────────────────────────────────────────
    let mouseStartY = 0;
    let mouseTracking = false;
    let currentMousePull = 0;

    const onMouseDown = (e: MouseEvent) => {
      const dist = el.scrollHeight - (el.scrollTop + el.clientHeight);
      // Desktop wheel scrolling is discrete — user may stop at dist 30–80px when
      // the PullUpHint is visible. Use a generous threshold so the gesture still arms.
      if (dist > 120) return;
      if (isLoadingMoreRef.current) return;
      mouseStartY = e.clientY;
      mouseTracking = true;
      currentMousePull = 0;
      e.preventDefault(); // prevent text selection during drag
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!mouseTracking) return;
      const dy = mouseStartY - e.clientY;
      if (dy < -10) {
        mouseTracking = false;
        currentMousePull = 0;
        setPullDistance(0);
        return;
      }
      if (dy <= 0) return;
      currentMousePull = dy;
      setPullDistance(dy);
    };

    const onMouseUp = () => {
      if (!mouseTracking) return;
      const pd = currentMousePull;
      mouseTracking = false;
      currentMousePull = 0;
      setPullDistance(0);
      if (pd >= PULL_THRESHOLD) {
        void handleLoadRef.current();
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    el.addEventListener('mousedown', onMouseDown);
    // mousemove/mouseup on window so releasing outside the element still works
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Build the Home curiosity feed from daily posts + connection cards (D-44: no fixed interleaving).
  const infoFlowItems = useMemo<InfoFlowItem[]>(() => {
    const items: InfoFlowItem[] = dailyPosts.map(post => ({ kind: 'concept' as const, post }));

    // Collect unique connection card items
    const connectionCards = conceptFeedService.getConnectionCards();
    const byId = new Map<string, Question>(questions.map((q) => [q.id, q]));
    const addedConns = new Set<string>();
    const connItems: InfoFlowItem[] = [];

    for (const card of connectionCards) {
      const key = card.sourceId < card.targetId
        ? `${card.sourceId}:${card.targetId}`
        : `${card.targetId}:${card.sourceId}`;
      if (addedConns.has(key)) continue;
      const qA = byId.get(card.sourceId);
      const qB = byId.get(card.targetId);
      if (!qA || !qB) continue;
      addedConns.add(key);
      connItems.push({
        kind: 'connection',
        questionA: qA,
        questionB: qB,
        conceptNounA: card.conceptNounA,
        conceptNounB: card.conceptNounB,
        bridgeInsight: card.bridgeInsight,
        cosineSimilarity: card.score,
        connectionPostId: card.connectionPostId,
      });
    }

    // Distribute connection cards evenly among concept posts
    if (connItems.length > 0 && items.length > 0) {
      const interval = Math.max(2, Math.floor(items.length / (connItems.length + 1)));
      for (let ci = connItems.length - 1; ci >= 0; ci--) {
        const insertAt = Math.min((ci + 1) * interval, items.length);
        items.splice(insertAt, 0, connItems[ci]);
      }
    } else {
      items.push(...connItems);
    }

    return items;
  }, [dailyPosts, questions]);

  const handleOpenConnection = (idA: string, idB: string) => {
    const cards = conceptFeedService.getConnectionCards();
    const card = cards.find((c) =>
      (c.sourceId === idA && c.targetId === idB) || (c.sourceId === idB && c.targetId === idA),
    );
    const qA = questions.find((q) => q.id === idA);
    const qB = questions.find((q) => q.id === idB);
    if (!qA || !qB) return;

    // Always navigate to PostDetailScreen. If the essay was previously generated its
    // cached post ID is used; otherwise we navigate to the canonical conn-* ID and let
    // PostDetailScreen stream the essay using the connectionMeta passed via state.
    const postId = card?.connectionPostId ?? `conn-${idA}-${idB}`;
    navigate(`/posts/${postId}`, {
      state: {
        connectionMeta: {
          questionA: qA,
          questionB: qB,
          conceptNounA: card?.conceptNounA ?? qA.title ?? qA.content,
          conceptNounB: card?.conceptNounB ?? qB.title ?? qB.content,
        },
      },
    });
  };

  const [suggestedMoveCount, setSuggestedMoveCount] = useState(0);

  // --- Concept exploration progress (Phase 31, D-12: SM-2 due concepts) ---
  const questionsById = useMemo(() => new Map(questions.map(q => [q.id, q])), [questions]);
  const quotaAnchorIds = useMemo(() => getConceptQuota([], questionsById), [questions, questionsById]);
  const conceptQuota = quotaAnchorIds.size;

  const [exploredAnchors, setExploredAnchors] = useState<string[]>(() => dailyReadService.getExploredAnchors());
  const exploredCount = useMemo(() => exploredAnchors.filter(id => quotaAnchorIds.has(id)).length, [exploredAnchors, quotaAnchorIds]);
  const isComplete = conceptQuota > 0 && exploredCount >= conceptQuota;

  // Phase 42 MASONRY-02: Compute allExplored locally (RESEARCH.md Pitfall 2 — NOT a service property).
  // VineBloomCard renders only when allExplored && layout.nodes.length > 0; the layout.nodes>0 gate
  // lives inside VineBloomCard via useTrellisData (per plan 42-04 design).
  const allExplored = useMemo(() => {
    const anchors = questions.filter((q) => q.isAnchorNode);
    return anchors.length > 0 && anchors.every((a) => exploredAnchors.includes(a.id));
  }, [questions, exploredAnchors]);

  // Build concepts list for VineProgress checklist
  const conceptList = useMemo(() => {
    const exploredSet = new Set(exploredAnchors);
    const seen = new Set<string>();
    return Array.from(quotaAnchorIds)
      .map(anchorId => {
        const q = questionsById.get(anchorId);
        let name = q?.title?.trim() || q?.content?.slice(0, 50)?.trim() || '';
        if (!name) {
          const child = questions.find(cq => cq.parentId === anchorId);
          name = child?.title?.trim() || child?.content?.slice(0, 50)?.trim() || '';
        }
        if (!name) name = anchorId.replace(/^anchor-/, '').slice(0, 20);
        if (seen.has(name)) return null;
        seen.add(name);
        return { id: anchorId, name, explored: exploredSet.has(anchorId) };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }, [quotaAnchorIds, exploredAnchors, questionsById, questions]);

  // Scroll to the first post matching a concept (D-04)
  const handleConceptTap = useCallback((conceptId: string) => {
    const postElement = document.querySelector(`[data-concept-id="${conceptId}"]`);
    if (postElement) {
      postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const [showConfetti, setShowConfetti] = useState(false);
  const creditAwardedRef = useRef(dailyReadService.isCreditAwarded());

  // Re-sync daily-read state from service when navigating back to /home.
  // HomeScreen is always-mounted in SwipeTabContainer (see CLAUDE.md
  // "Header positioning"), so navigate('/home') does NOT remount this
  // component — useState/useRef initializers run once on app boot and never
  // again. Without this resync, dailyReadService.reset() (called from
  // SettingsDataScreen's Force-New-Day handler) clears persistence but the
  // React state retains yesterday's exploredAnchors and creditAwardedRef
  // keeps yesterday's "true". Result: vine chip on /home still shows
  // yesterday's count, celebration gate at line ~516 is permanently closed.
  // Phase 36-14 — closes round-4 sub-issue (a).
  useEffect(() => {
    if (location.pathname === '/home') {
      setExploredAnchors(dailyReadService.getExploredAnchors());
      creditAwardedRef.current = dailyReadService.isCreditAwarded();
    }
  }, [location.pathname]);

  // Subscribe to CONCEPT_EXPLORED events from PostDetailScreen
  useEffect(() => {
    const unsub = eventBus.subscribe('CONCEPT_EXPLORED', () => {
      setExploredAnchors(dailyReadService.getExploredAnchors());
    });
    return unsub;
  }, []);

  // Phase 43-06 Effect A — LP-05 fast path: when engagementService.dismissAnchor
  // fires from ANYWHERE (LongPressMenu on /home, future surfaces), remove ALL
  // same-anchor tiles from dailyPosts immediately so the user sees the
  // AnimatePresence fade-out (200ms, from 43-03) without waiting for a
  // navigation event. Do NOT refetch conceptFeedService.getDailyPosts() —
  // operator decision LP-05 (CONTEXT.md). Stable listener; empty deps.
  useEffect(() => {
    const unsub = eventBus.subscribe('ANCHOR_DISMISSED', (event) => {
      const { anchorId } = event.payload;
      setDailyPosts(prev => prev.filter(p => p.sourceQuestionIds?.[0] !== anchorId));
      setEngagementVersion(v => v + 1);
    });
    return unsub;
  }, []);

  // Phase 43-06 Effect B — canonical [location.pathname] resync (Phase 36-14
  // sibling-effects pattern). When the user navigates back to /home after
  // dismissing an anchor from another surface (PostDetail, SavedScreen, future
  // dev surfaces), re-read engagementService and filter dailyPosts in place by
  // the current dismissed-anchor set. ALSO bumps engagementVersion so
  // MasonryFeed corner icons refresh after navigation. Satisfies CLAUDE.md
  // "Always-mounted screens must explicitly re-read service state on
  // navigation". In-place filter only; never refetches getDailyPosts.
  useEffect(() => {
    if (location.pathname !== '/home') return;
    const dismissed = engagementService.getDismissedAnchorIds();
    if (dismissed.length > 0) {
      setDailyPosts(prev => prev.filter(p => !dismissed.includes(p.sourceQuestionIds?.[0] ?? '')));
    }
    setEngagementVersion(v => v + 1);
  }, [location.pathname]);

  // Phase 43-06 Effect C — LP-03 corner-icon bump: when engagement state mutates
  // anywhere (LongPressMenu save/like, SavedScreen un-save/un-like, future dev
  // surfaces), bump engagementVersion so MasonryFeed's per-tile useMemo
  // dep arrays re-run isSaved/isLiked queries. Stable listener; empty deps.
  useEffect(() => {
    const unsub = eventBus.subscribe('ENGAGEMENT_CHANGED', () => {
      setEngagementVersion(v => v + 1);
    });
    return unsub;
  }, []);

  // Track when the inline card scrolls behind the Header
  const [cardHidden, setCardHidden] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || conceptQuota === 0) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        if (container.scrollTop === 0) {
          setCardHidden(false);
        } else {
          const card = container.querySelector('[data-concept-progress-card]');
          if (card) {
            const rect = card.getBoundingClientRect();
            setCardHidden(rect.bottom <= 0);
          }
        }
        ticking = false;
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [conceptQuota]);

  // Celebration: gold bar + confetti + toast + credit on completion
  useEffect(() => {
    if (isComplete && conceptQuota > 0 && !creditAwardedRef.current) {
      creditAwardedRef.current = true;
      dailyReadService.markCreditAwarded();
      trellisCreditsService.add(1);
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3500);
      toast(t('home.feed.creditToast'), 'success');
      return () => clearTimeout(timer);
    }
  }, [isComplete, conceptQuota, t]);

  const showCompactBar = cardHidden && conceptQuota > 0;

  return (
    <>
      <Confetti active={showConfetti} />
      {/* Compact progress bar — slides in as header when inline card scrolls away */}
      <div
        aria-hidden={!showCompactBar}
        style={{
          position: 'fixed',
          top: 'var(--safe-area-top)',
          left: 0,
          right: 0,
          zIndex: 190,
          backgroundColor: isComplete ? 'color-mix(in srgb, #E8A838 8%, var(--surface))' : 'var(--surface)',
          boxShadow: showCompactBar ? 'var(--shadow-1)' : 'none',
          opacity: showCompactBar ? 1 : 0,
          transform: showCompactBar ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'opacity 300ms ease, transform 300ms ease, box-shadow 300ms ease',
          pointerEvents: showCompactBar ? 'auto' : 'none',
          visibility: showCompactBar ? 'visible' : 'hidden',
          transitionProperty: 'opacity, transform, box-shadow, visibility',
          transitionDelay: showCompactBar ? '0ms' : '0ms, 0ms, 0ms, 300ms',
        }}
      >
        <VineProgress
          mode="compact"
          concepts={conceptList}
          onConceptTap={handleConceptTap}
        />
      </div>
      <div
        ref={containerRef}
        data-home-scroll
        style={{
          overflowY: 'auto',
          height: 'calc(100dvh - var(--safe-area-top))',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          touchAction: 'pan-y',
        }}
      >
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '16px',
        paddingTop: '16px', paddingLeft: '16px', paddingRight: '16px',
        paddingBottom: 'var(--bottom-nav-safe)',
        maxWidth: '448px', margin: '0 auto',
        transform: `translateY(-${Math.min(pullDistance * 0.4, 60)}px)`,
        transition: pullDistance === 0 ? 'transform 0.3s ease' : 'none',
      }}>

        {/* Inline greeting row — scrolls away naturally. Bookmark
            relocated here from a fixed-position viewport-anchored button
            per 43-11 gap closure (UAT Test 5). The icon now participates
            in normal scroll flow and disappears when scrolled past, so it
            no longer overlaps the compact VineProgress bar slide-in. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
            {getGreeting()}
          </h1>
          <button
            type="button"
            aria-label={t('saved.title')}
            onClick={() => navigate('/saved')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              marginRight: '-8px',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted-foreground)',
            }}
          >
            <Bookmark size={22} />
          </button>
        </div>

        {/* Bento Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

            {/* Flashcard Card */}
          <button
            onClick={() => navigate('/review')}
            className="active-squish"
            style={{ textAlign: 'left', background: 'none', padding: 0 }}
          >
            <Card
              style={{
                backgroundColor: 'var(--bento-review-bg)',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                height: '100%',
              }}
              onPointerEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
              onPointerLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <BookOpen size={28} color="var(--bento-card-text)" style={{ marginBottom: '12px' }} />
              <h4 style={{ marginBottom: '8px', color: 'var(--bento-card-text)' }}>{t('home.bento.flashcardTitle')}</h4>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <p style={{ fontSize: '1.875rem', fontWeight: 600, color: 'var(--bento-card-text)' }}>{reviewCount}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--bento-card-text-muted)' }}>{t('home.bento.flashcardDue')}</p>
              </div>
            </Card>
          </button>

          {/* Planner Card */}
          <button
            onClick={() => navigate('/planner')}
            className="active-squish"
            style={{ textAlign: 'left', background: 'none', padding: 0 }}
          >
            <Card
              style={{
                backgroundColor: 'var(--bento-tasks-bg)',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                height: '100%',
              }}
              onPointerEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
              onPointerLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <CheckSquare size={28} color="var(--bento-card-text)" style={{ marginBottom: '12px' }} />
              <h4 style={{ marginBottom: '8px', color: 'var(--bento-card-text)' }}>{t('home.bento.plannerTitle')}</h4>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <p style={{ fontSize: '1.875rem', fontWeight: 600, color: 'var(--bento-card-text)' }}>{suggestedMoveCount}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--bento-card-text-muted)' }}>{suggestedMoveCount === 1 ? t('home.bento.suggestionCountOne') : t('home.bento.suggestionCountOther')}</p>
              </div>
            </Card>
          </button>

          {/* Podcast Card — full width */}
          <button
            onClick={() => navigate('/podcast')}
            className="active-squish"
            style={{ gridColumn: '1 / -1', textAlign: 'left', background: 'none', padding: 0 }}
          >
            <Card
              style={{
                backgroundColor: 'var(--bento-podcast-bg)',
                cursor: 'pointer',
                transition: 'transform 0.2s',
              }}
              onPointerEnter={(e) => (e.currentTarget.style.transform = 'scale(1.01)')}
              onPointerLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <Headphones size={28} color="var(--bento-card-text)" style={{ marginBottom: '8px' }} />
                  <h4 style={{ color: 'var(--bento-card-text)', marginBottom: '4px' }}>{t('home.bento.podcastTitle')}</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--bento-card-text-muted)' }}>
                    {todayPodcast
                      ? todayPodcast.status === 'ready'
                        ? t('home.bento.podcastReady', { minutes: Math.round((todayPodcast.duration ?? 0) / 60) })
                        : todayPodcast.status === 'generating'
                          ? t('home.bento.podcastGenerating', { progress: todayPodcast.progress ?? 0 })
                          : t('home.bento.podcastFailed')
                      : t('home.bento.podcastNotGenerated')}
                  </p>
                </div>
                <Badge color={todayPodcast?.status === 'ready' ? 'green' : 'gray'}>
                  {todayPodcast?.status ?? t('home.bento.podcastStatusPending')}
                </Badge>
              </div>
            </Card>
          </button>

        </div>

        {/* Concept Progress Card — OUTSIDE grid so position:sticky works */}
        {conceptQuota > 0 && (
          <div data-concept-progress-card>
            <VineProgress
              mode="inline"
              concepts={conceptList}
              onConceptTap={handleConceptTap}
            />
          </div>
        )}

        {/* Empty state when feed has posts but no concept posts (D-17) */}
        {conceptQuota === 0 && dailyPosts.length > 0 && questions.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100px',
            textAlign: 'center',
            padding: '16px',
            background: 'var(--card)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-1)',
          }}>
            <Sparkles size={32} color="var(--muted-foreground)" style={{ opacity: 0.5, marginBottom: '12px' }} />
            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '4px' }}>
              {t('home.feed.emptyTitle')}
            </p>
            <p style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--muted-foreground)', lineHeight: 1.5, maxWidth: '280px' }}>
              {t('home.feed.emptyBody')}
            </p>
          </div>
        )}

        {/* Botanical loading state — queue empty, generation in progress */}
        {dailyPosts.length === 0 && isGenerating && (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '200px', gap: '16px',
          }}>
            <svg width="64" height="64" viewBox="0 0 64 64" style={{
              stroke: 'var(--primary-40)', strokeWidth: 2, fill: 'none',
              animation: 'vineLoadingPulse 1.5s ease-in-out infinite',
            }}>
              <rect x="20" y="44" width="24" height="16" rx="2" />
              <line x1="32" y1="44" x2="32" y2="24" />
              <ellipse cx="24" cy="22" rx="8" ry="6" />
              <ellipse cx="40" cy="22" rx="8" ry="6" />
            </svg>
            <span style={{
              fontSize: '14px', fontWeight: 400,
              color: 'var(--muted-foreground)', textAlign: 'center',
            }}>
              {t('home.feed.loadingTitle')}
            </span>
            <a
              href="mailto:huanfuli4408@gmail.com?subject=Trellis%20Feedback"
              style={{
                fontSize: '12px', fontWeight: 400,
                color: 'var(--primary-40)', textDecoration: 'underline',
                marginTop: '16px',
              }}
            >
              {t('home.feed.feedbackPrompt')}
            </a>
          </div>
        )}

        {/* Generation error state */}
        {dailyPosts.length === 0 && generationError && !isGenerating && (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '200px', gap: '4px',
          }}>
            <AlertCircle size={32} style={{ color: 'var(--muted-foreground)', marginBottom: '8px' }} />
            <span style={{ fontSize: '14px', color: 'var(--muted-foreground)' }}>
              {t('home.feed.generationErrorTitle')}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
              {t('home.feed.generationErrorBody')}
            </span>
            <button
              onClick={retryGeneration}
              style={{
                fontSize: '14px', fontWeight: 600,
                color: 'var(--primary-40)',
                background: 'none', border: 'none', cursor: 'pointer',
                marginTop: '12px',
              }}
            >
              {t('home.feed.generationErrorRetry')}
            </button>
            <a
              href="mailto:huanfuli4408@gmail.com?subject=Trellis%20Feedback"
              style={{
                fontSize: '12px', color: 'var(--primary-40)',
                textDecoration: 'underline', marginTop: '16px',
              }}
            >
              {t('home.feed.feedbackPrompt')}
            </a>
          </div>
        )}

        {/* Phase 42 MASONRY-01: Pinterest-style 2-column masonry feed (replaces InlineInfoFlow). */}
        <MasonryFeed
          items={infoFlowItems}
          onOpenConnection={handleOpenConnection}
          showConnectionScores={settingsSnapshot.showConnectionScores}
          onOpenPost={(postId, post) => {
            navigate(`/posts/${postId}`, { state: { post } });
          }}
          allExplored={allExplored}
          onLongPress={handleLongPress}
          engagementVersion={engagementVersion}
        />

        {/* Pull-up affordance — always reserves 80px, shows hint when at bottom */}
        <PullUpHint isLoading={isLoadingMore} pullDistance={pullDistance} />

      </div>
      </div>

      {/* Scroll-to-top FAB (D-40) */}
      <ScrollToTopFAB scrollRef={containerRef} />

      {/* Phase 43-06 LP-01..LP-04 + 43-09 (gap closure): bottom-sheet contextual
          menu hosted at the HomeScreen level (NOT per-tile). MasonryFeed's
          onLongPress callback hydrates { menuPostId, menuAnchorId } and flips
          menuOpen on. The inner BottomSheet wraps its overlay in
          createPortal(overlay, document.body) (Phase 32.1 portal pattern + 43-09
          UAT Test 2 fix), escaping SwipeTabContainer's per-slot translateZ(0)
          containing block. Inner sheet bottom is offset by
          calc(80px + var(--safe-area-bottom)) so it clears the fixed
          BottomNavigation (~80px row + safe-area). JSX placement here remains
          lifecycle-scoped (mounts/unmounts with HomeScreen). */}
      <LongPressMenu
        open={menuOpen}
        onClose={closeMenu}
        postId={menuPostId}
        anchorId={menuAnchorId}
      />

      {/* Botanical loading pulse animation */}
      <style>{`
        @keyframes vineLoadingPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  );
}

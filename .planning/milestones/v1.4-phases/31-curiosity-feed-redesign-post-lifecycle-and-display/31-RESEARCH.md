# Phase 31: Curiosity Feed Redesign — Post Lifecycle, Softer Progress UX, and Display Strategy - Research

**Researched:** 2026-04-17
**Domain:** React 19 + TypeScript feed architecture, SVG animation, FIFO queue with localStorage persistence, post lifecycle management
**Confidence:** HIGH (all findings from direct source inspection of the codebase — no external API research required)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Progress Visualization (Vine)**
- D-01: Replace `ConceptProgressCard` and `CompactProgressBar` with a horizontal vine growing left-to-right. A small potted plant is anchored on the left end. As concepts are explored, the vine extends and sprouts leaves and flowers.
- D-02: The same vine element is used for both the inline card position (between bento grid and feed) and the compact sticky header. The compact header is a substitute that appears when the inline card scrolls away.
- D-03: Tap the vine to expand a concept checklist showing uncovered concept names. A small down arrow icon indicates expandability. Tap again or tap outside to collapse.
- D-04: Concept names in the expanded checklist are tappable — tapping navigates the user to the first post for that concept in the feed.
- D-05: Vine completion state: when all concepts are explored, all flowers bloom and fruit appears. This is the vine's own celebration visual, distinct from the gold bar in phase 30.
- D-06: Vine growth updates on next view of the Home screen, not in real-time.
- D-07: When no concepts are due today, the vine is hidden entirely (not rendered).

**Concept Transparency**
- D-08: No changes to post cards in the feed. No badges, no styling differences between concept posts and bonus content.
- D-09: The compact header is the single source of truth for concept progress.

**Post Queue System**
- D-10: 8-post FIFO buffer persisted in localStorage. Posts are popped from the front when served, new posts pushed to the back. Serve 4 posts at a time on pull-up.
- D-11: Queue auto-refills when length drops below 8. Refill runs in background, not blocking the user.
- D-12: Queue is driven by a derived concept list — today's due concepts from SM-2 scheduling.
- D-13: Explored concepts are removed from the derived list so subsequent cycles don't generate duplicate concept posts.
- D-14: Priority ordering: weak concepts first. A concept is "important" if it has low SM-2 ease factor (< 1.5) OR dying/falling trellis leaf state. Important concepts get 2 posts per cycle, others get 1 post.
- D-15: Cycle number is persisted daily to track generation progress. Resets each new day.
- D-16: FIFO is strict — once posts are in the queue, order is fixed. Priority is applied at generation time, not at display time.

**Post Type Mix & Style Assignment**
- D-17: Post styles are assigned randomly per post within a batch, constrained to global ratios: 10% image, 25% text-art, 5% suggestion, 20% news, 15% YouTube landscape, 25% YouTube shorts.
- D-18: Style is decided before generation, not after. This is a fundamental change from current `assignPresentationStyles` post-hoc approach.
- D-19: Image-less style is no longer a planned style — exists only as fallback when Nano Banana unavailable.
- D-20: When a content source fails, fall back to text-art.

**Generation Pipeline**
- D-21: Generation order: (1) pre-check API keys, (2) fetch YouTube/Tavily in parallel for concepts assigned those styles, (3) reassign failures to text-art, (4) one batch LLM call for all remaining posts.
- D-22: No immediate post generation for mid-day questions.

**Suggestion Posts (New Post Type)**
- D-23: New post type: "You may also like:" card showing 3 tappable topic suggestions.
- D-24: Topics are fresh/unexplored topics related to existing mindmap nodes — graph neighbors, cross-concept connections, deeper dives.
- D-25: Tapping a topic navigates to Ask screen and sends the topic as a question.
- D-26: Only the topic buttons are interactive. Tapping the card itself is a no-op.
- D-27: Suggestion posts appear at low frequency (5%).

**Inline Video Playback**
- D-28: Landscape videos are playable inline in the feed, same as portrait shorts. Tapping play does NOT trigger essay/summary generation.
- D-29: Both landscape and portrait videos stop playback on swipe-away (screen navigation).

**Warm Start**
- D-30: On a new day, show the 8 unviewed posts left in yesterday's queue as the initial feed.
- D-31: Pull-up-for-more serves from today's fresh queue once generated.
- D-32: Edge case: if yesterday's queue is empty, show the last 4 posts from yesterday as a recap while generating.

**Post Lifecycle & Storage**
- D-33: 7-day rolling window by default. Posts older than 7 days are purged. Configurable to "keep all" in Settings.
- D-34: Post retention setting lives in Settings > Data & Privacy > Developer section.
- D-35: No visual difference for essay-less stubs vs full posts.
- D-36: No feed-level dismiss/hide. Delete only from PostDetailScreen.

**Post History**
- D-37: Simple history screen showing past posts grouped by day. Accessible from history icon near vine card, and Settings > Data.

**Generation Rate Limiting**
- D-38: Daily generation cap = configurable multiplier × number of today's due concepts. Default multiplier is 5.
- D-39: Bonus post cap after completion — max 8 bonus posts. Configurable in Settings > Data > Developer.

**Scroll-to-Top**
- D-40: Floating button at bottom-right, appears after pixel distance threshold, smooth-scrolls to top.

**Feedback**
- D-41: "Posts not interesting?" button in empty-queue state. Tapping opens device email client via `mailto:` with pre-filled to and subject.
- D-42: Same feedback entry point in Settings.

**Starter Posts**
- D-43: Replace all 3 existing starter posts with app-tutorial posts. Current learning-science content is removed entirely.

**Post Interleaving**
- D-44: Replace current fixed-interval interleaving with weighted round-robin. Style variety enforced at generation time.

**Existing Infrastructure Reuse**
- D-45: Reuse `infiniteScrollService` queue mechanics and `PullUpHint`. Adapt queue size from 6 to 8, batch from 6 to 4.
- D-46: Reuse `dailyReadService` for tracking explored concepts.
- D-47: Reuse event bus `CONCEPT_EXPLORED` pattern from phase 30.

### Claude's Discretion
- Vine SVG/CSS illustration implementation details (growth stages, leaf/flower assets, animation style)
- Exact pixel threshold for scroll-to-top button appearance (UI-SPEC locked at 400px)
- Exact SM-2 ease threshold for "important" concept classification (suggested < 1.5)
- Starter post content and tutorial messaging
- History screen layout and grouping UI
- Queue auto-refill debouncing to avoid rapid successive generation calls
- Botanical loading state illustration for empty-queue state

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 31 is a major overhaul of the EchoLearn curiosity feed. The three most architecturally significant changes are: (1) replacing the rigid `ConceptProgressCard`/`CompactProgressBar` pair with a unified `VineProgress` SVG component with two modes, (2) completely redesigning the post queue from a simple FIFO drain to a concept-driven priority-weighted batch system with localStorage persistence, and (3) adding a new `suggestion` post type that triggers Ask screen navigation. Supporting work includes inline landscape video playback (matching existing short-video pattern), post lifecycle purging (7-day default), a post history screen at `/history`, scroll-to-top FAB, and three new Settings Developer rows.

The codebase is React 19 + TypeScript + Vite with strict inline styles using CSS variables. No component library (no shadcn). All tests use Node.js built-in `node --test` with direct `.ts` imports via esbuild loader. The key insight for planning is that `concept-feed.service.ts` needs the most surgery — the `assignPresentationStyles`, `interleaveNewsPosts`, and `STARTER_POSTS` constants all get replaced — while `infiniteScrollService` needs a structural evolution (localStorage persistence, 8-post buffer, 4-post serve, concept-driven generation). The vine replaces two existing components but reuses the same Phase 30 scroll-tracking mechanism (intersection observer + `data-concept-progress-card` attribute pattern).

**Primary recommendation:** Decompose this into waves by blast radius. Wave A = data layer (new queue service with localStorage persistence, DailyPost type extensions for `suggestion` sourceType, AppSettings extensions for 3 new developer fields). Wave B = vine component + HomeScreen wiring. Wave C = concept-feed service refactor (style pre-assignment, suggestion generation, warm-start). Wave D = display additions (landscape inline video, scroll-to-top FAB, history screen, settings rows, feedback mailto, starter posts).

---

## Standard Stack

### Core (all existing — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19.x | Component rendering, hooks (useState, useRef, useEffect, useMemo, useCallback) | Project baseline |
| react-router-dom | v7 | `/history` route, navigation to `/ask` for suggestion taps | Project baseline |
| lucide-react | latest | ChevronDown, Clock, ArrowUp, Sparkles, AlertCircle icons | Project baseline |
| i18next / react-i18next | latest | All new UI strings via `useTranslation()` + `t()` | Project baseline |

### No new packages needed

All requirements are achievable with existing dependencies. The vine illustration is SVG-in-JSX. The `mailto:` link for feedback is a plain anchor. The history screen follows the same overlay pattern as `/review`, `/podcast`. localStorage is already used throughout.

**Installation:** No new npm installs required for Phase 31.

---

## Architecture Patterns

### Existing Patterns to Follow

**Service pattern:** All services return `ServiceResult<T>` (except simple localStorage wrappers like `dailyReadService` and `trellisCreditsService`). New `postQueueService` and `postHistoryService` should be plain localStorage wrappers (no `ServiceResult` wrapper needed — they only do reads/writes against localStorage).

**Inline styles with CSS variables:** No Tailwind classes. All new components use `style={{ ... }}` with `var(--primary-40)`, `var(--surface)`, `var(--card)`, `var(--shadow-1)`, `var(--radius)`, `--space-lg`, etc.

**Event bus:** `eventBus.emit()` + `eventBus.subscribe()`. For vine updates, reuse `CONCEPT_EXPLORED` event already in the `AppEvent` union (Phase 30 infrastructure). No new event types expected.

**i18n EN-first workflow:** Every new user-visible string must be added to all 4 locale bundles in the same PR. See CLAUDE.md for the Sonnet subagent workflow. New keys go in `home.feed.*`, `home.history.*`, `settings.fields.*`, `settings.descriptions.*`.

**Settings pattern:** `settingsService.getSync()` for reads, `settingsService.set(section, newValue)` for writes. New developer settings (postRetention, generationCap, bonusCap) need to be added to `AppSettings` type in `types/index.ts` and to the settings service default values.

**Background generation guard:** The existing pattern uses module-level boolean flags like `_videoBgRunning` and `_textArtBgRunning` to prevent concurrent background generation. The new queue refill logic should use the same pattern (`_queueRefillRunning` guard).

**Test pattern:** Use inline mirrors for TSX-resident helpers (same as Phase 28 `BottomNavigation.slide.test.mjs`). Direct `.ts` imports work for pure TS modules (same as `trellis-perf-mask.test.mjs`). Use `localStorage` polyfill (same as `daily-read.service.test.mjs`).

### Recommended New File Structure

```
src/
├── components/
│   ├── VineProgress.tsx          — Replaces ConceptProgressCard.tsx
│   ├── SuggestionCard.tsx        — New suggestion post type card
│   └── ScrollToTopFAB.tsx        — New FAB component
├── screens/
│   └── PostHistoryScreen.tsx     — New /history route
├── services/
│   ├── post-queue.service.ts     — New: 8-post FIFO buffer with localStorage persistence
│   └── post-history.service.ts  — New: 7-day rolling storage for viewed posts
```

Files with significant modifications:
- `src/services/concept-feed.service.ts` — Major refactor: pre-style assignment, suggestion post generation, warm-start, STARTER_POSTS replacement
- `src/services/infiniteScroll.service.ts` — Adapt queue size/batch, wire to post-queue.service
- `src/screens/HomeScreen.tsx` — Wire VineProgress, ScrollToTopFAB, history icon, botanical loading state, landscape video cleanup
- `src/components/InfoFlow.tsx` — Handle `suggestion` sourceType, inline landscape video playback, stop-on-swipe
- `src/screens/settings/SettingsDataScreen.tsx` — Add 3 new Developer rows
- `src/types/index.ts` — Extend `DailyPost.sourceType` union, extend `AppSettings`, extend `PresentationStyle`, new `SuggestionPost` sub-type
- `src/locales/en.json` (+ zh, es, ja) — New i18n keys

### Pattern 1: VineProgress Component (two-mode, single component)

**What:** A horizontal SVG vine illustration that grows proportionally as `explored / total` increases. Used in both inline card mode (between bento grid and feed) and compact header mode (sticky, slides in when inline card scrolls away). The component receives `explored`, `total`, `isComplete`, and a `mode` prop (`'inline' | 'compact'`).

**Key implementation details from UI-SPEC:**
- Inline mode: 48px height, 16px padding, `var(--card)` background, `var(--shadow-1)`
- Compact mode: 36px height, 12px vertical / 16px horizontal padding, `var(--surface)` background
- Vine stem: 3px stroke, `var(--primary-40)`, grows rightward proportional to `explored/total`
- Leaves: 8x12px SVG shapes at even intervals, 60% opacity
- Flowers: 10x10px circles at concept milestones — `var(--primary-40)` when explored, `var(--muted)` when not
- Completion state: gold (#E8A838) vine color, all flowers "bloom" (scale pulse 1.0→1.3, 600ms ease-in-out), fruit icons appear
- Tap to expand: `ChevronDown` icon rotates 180deg, checklist slides down with `max-height` transition
- Click-away to collapse: `document.addEventListener('click', ...)` cleanup on unmount
- `role="progressbar"` with `aria-valuenow`, `aria-valuemax`, `aria-label` (from i18n)

**The scroll-tracking mechanism** for switching between modes is already implemented in HomeScreen for Phase 30 and reuses the same `data-concept-progress-card` attribute + `IntersectionObserver`-style `getBoundingClientRect` check on scroll. The vine replaces the existing `ConceptProgressCard` but the scroll detection can stay nearly identical.

**Pattern 2: Post Queue Service (new `post-queue.service.ts`)**

**What:** A dedicated service managing the 8-post FIFO buffer with localStorage persistence. Decoupled from `infiniteScrollService` (which manages deduplication and serve batches) and from `concept-feed.service.ts` (which generates posts).

**Interface:**
```typescript
// Source: derived from D-10/D-11/D-15 + existing infiniteScrollService pattern
export const postQueueService = {
  getQueue(): DailyPost[]          // read the persisted buffer
  enqueue(posts: DailyPost[]): void  // push to back
  dequeue(count: number): DailyPost[] // pop from front
  size(): number
  needsRefill(): boolean           // size() < 8
  getCycleNumber(): number         // persisted daily cycle counter
  incrementCycle(): void
  resetForNewDay(): void           // called on date change detection
  saveQueue(): void               // persist to localStorage
  loadQueue(): void               // load from localStorage, auto-reset on date mismatch
}
```

**localStorage keys:**
- `echolearn_post_queue` — serialized `{ date: string, posts: DailyPost[], cycleNumber: number }`
- Date mismatch on load → auto-reset (same pattern as `dailyReadService`)

**Pattern 3: Pre-style Assignment (replacing `assignPresentationStyles`)**

**What:** Style is decided BEFORE generation. The new pipeline is:
1. Load today's due concepts (from SM-2 scheduler)
2. Score each concept for importance (ease factor < 1.5 OR trellis dying/falling state)
3. Important concepts get 2 posts in this cycle; others get 1
4. Build a list of (concept, assignedStyle) tuples using weighted random selection from the ratio table (D-17)
5. Pre-check API keys for YouTube and Tavily
6. For concepts assigned `video`/`short`/`news` styles: fetch YouTube/Tavily in parallel
7. Reassign any fetch failures to `text-art`
8. One batch LLM call for all `image`, `text-art`, `suggestion`, and fallback posts
9. Push results to `postQueueService`

**Ratio table (D-17):**
```typescript
const STYLE_WEIGHTS = {
  image: 0.10,
  'text-art': 0.25,
  suggestion: 0.05,
  news: 0.20,
  video: 0.15,
  short: 0.25,
};
```

**Weighted random selection** can use Fisher-Yates + cumulative probability (same `shuffleArray` utility already in the codebase).

**Pattern 4: Suggestion Post Type**

**What:** A new `sourceType: 'suggestion'` on `DailyPost`. The post carries a `suggestionMeta` field with an array of 3 topic strings. No `bodyMarkdown` needed (suggestion posts have no detail page).

**Type extension:**
```typescript
// Extend DailyPost in types/index.ts
export interface SuggestionMeta {
  topics: string[]; // exactly 3 topic strings
}

// DailyPost gets:
suggestionMeta?: SuggestionMeta;

// PresentationStyle gets 'suggestion' added:
export type PresentationStyle = 'image' | 'text-art' | 'image-less' | 'video' | 'short' | 'news' | 'suggestion';

// sourceType union (PostSnapshot) gets 'suggestion' added:
sourceType: 'recent' | 'related' | 'resurfaced' | 'starter' | 'mixed' | 'connection' | 'video' | 'short' | 'text-art' | 'news' | 'suggestion';
```

**Rendering in InfoFlow.tsx:** A separate early-return branch for `post.sourceType === 'suggestion'` that renders `SuggestionCard`. Tapping a topic button calls `navigate('/ask')` with the topic pre-filled (using location state to auto-send the message, same as existing navigation patterns in the codebase).

**Pattern 5: Inline Landscape Video (extending existing short-video pattern)**

**What:** The current `isShortPost` (portrait, 9/16 aspect ratio) pattern in `InfoFlow.tsx` (lines 319-400) already embeds a YouTube iframe inline on tap. Landscape video just changes the aspect ratio to `16/9` and uses `isVideoPost` (which currently only shows a thumbnail + navigates to PostDetailScreen).

**Change:** `isVideoPost` gets inline playback instead of navigation on tap. The existing `shortPlaying` state pattern is reused.

**Stop on swipe-away (D-29):** The existing `SwipeTabContainer` maintains an active index. When the index changes away from Home (index 0), any active video iframes in the Home subtree need to be cleared. Implementation: `setShortPlaying(false)` / `setVideoPlaying(false)` via a ref + effect that monitors location or active tab index. The same cleanup applies to both portrait shorts and landscape videos.

**Pattern 6: Post History Service + Screen**

**What:** `post-history.service.ts` maintains a rolling 7-day (or "keep all") log of viewed posts in localStorage at `echolearn_post_history`.

```typescript
export const postHistoryService = {
  addPost(post: DailyPost): void       // called on PostDetailScreen enter
  getPosts(): DailyPost[]             // returns all stored posts sorted by date desc
  getPostsByDay(): Map<string, DailyPost[]> // grouped for history screen rendering
  purgeExpired(): void                // called on load — removes posts > 7 days old
}
```

The history screen (`/history`) follows the same pattern as the existing `/review` sub-screen: uses the `Header` component with `backTo="/home"`, renders a vertical list, no custom header needed.

**Route wiring:** Add `/history` to `App.tsx` routes. Use `<Route path="/history" element={<PostHistoryScreen />} />` inside the existing sub-screen outlet pattern.

### Anti-Patterns to Avoid

- **Post-hoc style assignment:** Do not assign presentation styles after LLM generation. Styles must be pre-assigned before any API calls (D-18). The existing `assignPresentationStyles` function must be fully replaced, not wrapped.
- **Interleaving at render time:** Do not use `interleaveNewsPosts()` or fixed-interval injection at render time. Post variety is enforced at generation time via style weights (D-44).
- **Connection card injection in FIFO feed:** The existing code in `HomeScreen.tsx` injects `connection` cards after every 2nd concept post. This post-hoc injection pattern is architecturally at odds with the new FIFO queue. The planner needs to decide whether connection cards stay as a separate overlay layer or are integrated into the queue.
- **Runtime LLM for UI copy:** Per CLAUDE.md, `chatCompletion`/`chatStream` MUST NOT be used to translate UI strings. Suggestion post topic generation (LLM call) is fine — it's content generation, not UI copy.
- **Modifying ref.current during render:** Per project ESLint config (`react-hooks/refs`), never set `ref.current` during render. Use `useEffect` for state→ref sync.
- **Separate `echolearn_daily_posts` cache invalidation:** The existing `STORAGE_KEY = 'echolearn_daily_posts'` is a date+fingerprint invalidated cache. The new `echolearn_post_queue` is a rolling FIFO, different semantics. Do not overwrite the old cache key — rename or use a new key to avoid migration issues.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Weighted random style selection | Custom probability engine | Fisher-Yates + cumulative probability with existing `shuffleArray` | Already in codebase; simple 6-bucket table |
| Vine SVG animation | Framer Motion or CSS library | Native CSS transitions + SVG stroke-dashoffset or clip-path animation | No new dependencies; deterministic progress (explored/total ratio) maps cleanly to SVG geometry |
| Click-away to collapse | Custom event delegation system | `document.addEventListener('click', handler)` in useEffect, cleanup on unmount | Standard React pattern; already used in multiple dropdowns in the codebase |
| Post deduplication across sessions | Custom hash map | Extend existing `infiniteScrollService.seenPostIds` Set | Already handles dedup; just adapt to new queue service |
| `mailto:` link for feedback | In-app email form | `window.location.href = 'mailto:...'` or `<a href="mailto:...">` | Zero UI; device email client handles it natively |
| Scroll position tracking for FAB | Intersection Observer API | `onScroll` event on the container div + `requestAnimationFrame` throttle | Same pattern already used in HomeScreen for compact bar (lines 376-398) |
| Day-grouping for history | Date library | `new Date(post.date).toLocaleDateString()` with comparison to today/yesterday | Existing `today()` utility in `lib/date.ts` already provides date strings |

**Key insight:** The codebase has established patterns for everything Phase 31 needs. The vine is the only genuinely new visual pattern; everything else is an extension or adaptation of existing services and component patterns.

---

## Common Pitfalls

### Pitfall 1: Queue Persistence Breaks on Day Boundary
**What goes wrong:** Queue loaded from localStorage has stale date. Posts from yesterday displayed as today's content.
**Why it happens:** `echolearn_post_queue` stores a `date` field, but if the check is only done at service initialization and HomeScreen stays mounted, the date may never re-check after midnight.
**How to avoid:** In `postQueueService.loadQueue()`, always check `parsed.date !== today()`. If mismatch: save yesterday's queue separately (for D-30 warm-start), then reset the queue. HomeScreen's existing `useEffect` for feed refresh (8-second delay + `PLANNER_UPDATED` subscription) provides a natural re-initialization point on app resume.
**Warning signs:** Posts from previous day appear in feed when exploring app at midnight or after next-day reload.

### Pitfall 2: Vine Scroll Detection Breaks After Queue Refill
**What goes wrong:** `containerRef.current.querySelector('[data-concept-progress-card]')` returns null after VineProgress re-renders (e.g., after vine grows on concept exploration).
**Why it happens:** The `data-concept-progress-card` attribute from Phase 30 is on the old `ConceptProgressCard` component. VineProgress must carry the same `data-vine-progress-card` (or the same attribute) for the scroll detection to work.
**How to avoid:** VineProgress inline card mode must render with `data-concept-progress-card` attribute (keep existing attribute name for scroll detection continuity, or update HomeScreen's `querySelector` to the new attribute name consistently).
**Warning signs:** Compact header never appears even when scrolled past vine card.

### Pitfall 3: Pre-style Assignment Races with Background Refill
**What goes wrong:** Two refill calls run concurrently — one finishes and pushes 8 posts, then the second finishes and pushes 8 more, creating 16 posts in queue.
**Why it happens:** `needsRefill()` returns true while the first refill is still in-flight; a second trigger (e.g., component unmount/remount) fires another refill.
**How to avoid:** Use a module-level guard flag `let _refillRunning = false` in `postQueueService` (same pattern as `_videoBgRunning` in concept-feed.service.ts). Set to true before async work, false in finally block.
**Warning signs:** Queue grows beyond 8 posts; duplicate post IDs in queue.

### Pitfall 4: `suggestion` sourceType Not Excluded from Concept Quota
**What goes wrong:** Suggestion posts count toward the daily concept quota, inflating the vine's total count.
**Why it happens:** `getConceptQuota()` in `daily-read.service.ts` uses `EXCLUDED_SOURCE_TYPES = new Set(['starter', 'connection', 'video', 'short', 'news'])`. If `suggestion` is not added, it may inadvertently be counted.
**How to avoid:** Add `'suggestion'` to `EXCLUDED_SOURCE_TYPES` in `daily-read.service.ts`. Also verify the existing test in `concept-quota.test.mjs` gets a new case for `suggestion`.
**Warning signs:** Vine shows total > actual concept count; quota off-by-one.

### Pitfall 5: Landscape Video iframe Not Cleaned Up on Swipe-Away
**What goes wrong:** YouTube iframe continues playing audio after user swipes to another tab.
**Why it happens:** `SwipeTabContainer` keeps all screens always mounted. When active index changes from 0 (Home) to 1+ (other tab), InfoFlow cards remain in DOM with active iframes.
**Why it's tricky:** Unlike the short-video case (the playing state is in `ConceptCard`'s local `useState`), landscape video state lives at the same level. The cleanup signal needs to travel from SwipeTabContainer → HomeScreen → InfoFlow → ConceptCard.
**How to avoid:** Two options: (a) expose a `homeActive: boolean` prop drilled from HomeScreen → InlineInfoFlow → ConceptCard that, when false, resets `videoPlaying` to false via useEffect; (b) use the event bus with a new `HOME_SCREEN_HIDDEN` event. Option (a) is simpler since HomeScreen already knows `location.pathname === '/home'`.
**Warning signs:** Audio keeps playing after navigating to Ask or Settings tab.

### Pitfall 6: `mailto:` Blocked in Capacitor WebView
**What goes wrong:** `window.location.href = 'mailto:...'` silently fails on Android/iOS Capacitor.
**Why it happens:** Capacitor WebView may not route `mailto:` links to the native email client without explicit plugin configuration.
**How to avoid:** Use `<a href="mailto:feedback@echolearn.app?subject=EchoLearn%20Feed%20Feedback">` rendered as a real anchor element rather than programmatic navigation. Capacitor's App plugin handles external URLs including `mailto:` when triggered by user gesture from a real anchor.
**Warning signs:** Tapping feedback button on device does nothing (no email client opens).

### Pitfall 7: `AppSettings` Type Extension Requires Settings Service Default Update
**What goes wrong:** New Developer settings fields (`postRetention`, `generationCap`, `bonusCap`) exist in the type but `settingsService.getSync()` returns `undefined` for them because defaults were not updated.
**Why it happens:** `settingsService` has a `DEFAULT_SETTINGS` constant. TypeScript type extension is not enough — the runtime default must be added too.
**How to avoid:** Whenever `AppSettings` is extended, also update the `DEFAULT_SETTINGS` object in `settings.service.ts` (or the mock equivalent). Test with `settingsService.getSync().preferences.postRetention` before coding the Settings UI.
**Warning signs:** `undefined is not a string` errors in `SettingsDataScreen`.

---

## Code Examples

Verified patterns from existing codebase:

### Guard flag for background generation
```typescript
// Source: app/src/services/concept-feed.service.ts (existing pattern)
let _queueRefillRunning = false;

export async function triggerQueueRefill(): Promise<void> {
  if (_queueRefillRunning) return;
  _queueRefillRunning = true;
  try {
    // ... generation logic
  } finally {
    _queueRefillRunning = false;
  }
}
```

### Daily reset pattern (same as dailyReadService)
```typescript
// Source: app/src/services/daily-read.service.ts (verified pattern)
function loadState(): PostQueueState {
  const raw = localStorage.getItem(QUEUE_KEY);
  if (!raw) return freshState();
  const parsed = JSON.parse(raw);
  if (parsed.date !== today()) return freshState(); // auto-reset on day boundary
  return parsed;
}
```

### localStorage polyfill for tests
```typescript
// Source: app/tests/services/daily-read.service.test.mjs (verified pattern)
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};
const { postQueueService } = await import('../../src/services/post-queue.service.ts');
```

### Event bus subscribe + cleanup
```typescript
// Source: app/src/screens/HomeScreen.tsx (verified pattern)
useEffect(() => {
  const unsub = eventBus.subscribe('CONCEPT_EXPLORED', () => {
    setExploredAnchors(dailyReadService.getExploredAnchors());
  });
  return unsub;
}, []);
```

### Scroll detection for compact header visibility
```typescript
// Source: app/src/screens/HomeScreen.tsx lines 376-398 (verified pattern)
useEffect(() => {
  const container = containerRef.current;
  if (!container || conceptQuota === 0) return;
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const card = container.querySelector('[data-concept-progress-card]');
      if (card) {
        const rect = card.getBoundingClientRect();
        setCardHidden(rect.bottom <= 0);
      }
      ticking = false;
    });
  };
  container.addEventListener('scroll', onScroll, { passive: true });
  return () => container.removeEventListener('scroll', onScroll);
}, [conceptQuota]);
```

### Inline video iframe (portrait short — adapt to landscape)
```typescript
// Source: app/src/components/InfoFlow.tsx lines 339-346 (verified pattern)
<iframe
  src={`https://www.youtube.com/embed/${post.videoMeta.videoId}?playsinline=1&autoplay=1&rel=0`}
  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowFullScreen
  title={normalizedTitle}
/>
```
For landscape, change `aspectRatio: '9/16'` to `aspectRatio: '16/9'`.

### History grouped-by-day structure
```typescript
// Pattern: derived from lib/date.ts today() + standard Date comparison
function groupByDay(posts: DailyPost[]): Map<string, DailyPost[]> {
  const map = new Map<string, DailyPost[]>();
  for (const post of posts) {
    const key = post.date; // 'YYYY-MM-DD'
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(post);
  }
  return map;
}
// Display labels: compare key to today() and today()-1 for "Today"/"Yesterday"
```

### AppSettings extension pattern
```typescript
// Source: app/src/types/index.ts — add to AppPreferences or a new developer section
export interface DeveloperSettings {
  postRetention: '7d' | 'all';       // default: '7d'
  generationCapMultiplier: number;   // default: 5
  bonusPostCap: number;              // default: 8
}

// AppSettings gets:
developer: DeveloperSettings;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Post-hoc style assignment (`assignPresentationStyles`) | Pre-style assignment before generation | Phase 31 | LLM batch can be right-sized; no wasted generation |
| Fixed-interval interleaving (`interleaveNewsPosts` every 3rd) | Weighted round-robin at generation time | Phase 31 | Eliminates post-processing pass; variety is structural |
| Simple FIFO drain (no persistence) | localStorage-persisted 8-post buffer with concept-driven priority | Phase 31 | Warm start possible; cold starts faster |
| ConceptProgressCard + CompactProgressBar (two components) | VineProgress (single component with mode prop) | Phase 31 | Single source of truth; vine metaphor matches garden aesthetic |
| Learning-science starter posts | App-tutorial starter posts | Phase 31 | Onboarding-aligned first experience |
| Landscape videos: tap navigates to PostDetailScreen | Landscape videos: tap plays inline (same as shorts) | Phase 31 | Consistent inline playback behavior |

**Deprecated by Phase 31:**
- `ConceptProgressCard` and `CompactProgressBar` in `ConceptProgressCard.tsx` — replaced by `VineProgress.tsx`
- `assignPresentationStyles()` in `concept-feed.service.ts` — replaced by pre-assignment in new pipeline
- `interleaveNewsPosts()` in `concept-feed.service.ts` — replaced by generation-time weighted mix
- `STARTER_POSTS` array in `concept-feed.service.ts` — replaced by tutorial-focused posts
- `MAX_POSTS = 4` constant in `concept-feed.service.ts` — replaced by queue buffer size (8) and serve batch (4) in `post-queue.service.ts`

---

## Open Questions

1. **Connection cards in the new FIFO architecture**
   - What we know: HomeScreen currently injects `connection` kind items into the `infoFlowItems` array after every 2nd concept post (lines 269-320 in HomeScreen.tsx). This is a post-hoc injection at render time, not in the queue.
   - What's unclear: D-44 says "replace fixed-interval interleaving with weighted round-robin at generation time" — but connection cards are generated separately (via `conceptFeedService.getConnectionCards()`), not via the main post queue pipeline. Are connection cards preserved as-is, or are they folded into the FIFO queue as another style?
   - Recommendation: Treat connection cards as a separate overlay layer (keep existing inject-at-render logic). They are graph-derived semantic content, not quota-bearing concept posts. The planner should explicitly preserve this pattern unless the user has indicated otherwise.

2. **`postRetention` purging timing**
   - What we know: D-33 specifies 7-day rolling window by default, purging posts older than 7 days.
   - What's unclear: When exactly does purge run? On app start? On Home screen mount? On settings change?
   - Recommendation: Run purge in `postHistoryService.getPosts()` on every read (same as `dailyReadService`'s date-reset on load). This is lazy purge — simple, no background task needed.

3. **`postRetention = 'keep all'` and localStorage quota**
   - What we know: LocalStorage has a 5-10MB quota. Posts with `bodyMarkdown` can be 1-3KB each. After 100+ days with "keep all", quota may be exceeded.
   - What's unclear: Is there a localStorage quota guard needed?
   - Recommendation: Add a silent catch on `localStorage.setItem` in `post-history.service.ts` (same as existing `saveCache()` pattern in concept-feed.service.ts). The planner can note this as a "v1.5 concern" — for now the 7-day default is safe.

4. **Navigate to Ask with pre-filled topic (suggestion post tap)**
   - What we know: The existing AskScreen accepts navigation state. Phase 28 wired `navigate('/ask/${q.id}')` for recent questions. The Ask screen's input is managed by local state.
   - What's unclear: Is there an existing mechanism to pre-fill the input and auto-send on navigation?
   - Recommendation: Use `navigate('/ask', { state: { prefillTopic: topic } })`. AskScreen reads `location.state?.prefillTopic` in a `useEffect` and calls the submit handler. This is a clean pattern, consistent with existing post-detail navigation states used throughout the codebase.

---

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies identified — Phase 31 uses only existing API integrations already configured by users: YouTube Data API, Tavily, Nano Banana, LLM provider).

---

## Validation Architecture

nyquist_validation is enabled (per `.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node --test` with esbuild tsx loader |
| Config file | `app/package.json` — `"test"` script: `node --test tests/**/*.test.mjs` |
| Quick run command | `cd /Users/Code/EchoLearn/app && node --test tests/services/post-queue.service.test.mjs` |
| Full suite command | `cd /Users/Code/EchoLearn/app && npm test` |

### Phase Requirements → Test Map

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| `postQueueService.dequeue(4)` serves 4 posts from front, remaining stays in queue | unit | `node --test tests/services/post-queue.service.test.mjs` | Wave 0 |
| Queue auto-resets on date boundary (warm-start: preserves yesterday's queue separately) | unit | `node --test tests/services/post-queue.service.test.mjs` | Wave 0 |
| `needsRefill()` returns true when queue size < 8 | unit | `node --test tests/services/post-queue.service.test.mjs` | Wave 0 |
| `postHistoryService.addPost()` persists post; `getPosts()` returns sorted by date desc | unit | `node --test tests/services/post-history.service.test.mjs` | Wave 0 |
| `postHistoryService.purgeExpired()` removes posts older than 7 days when retention='7d' | unit | `node --test tests/services/post-history.service.test.mjs` | Wave 0 |
| `suggestion` sourceType excluded from `getConceptQuota()` | unit | `node --test tests/concept-quota.test.mjs` | Extend existing |
| Style weight distribution: weighted random selection produces expected ratios over N samples | unit | `node --test tests/services/concept-feed-style-weights.test.mjs` | Wave 0 |
| Vine progress card renders with `data-concept-progress-card` attribute for scroll detection | source grep | check acceptance criteria | Wave 0 |
| Bundle parity across 4 locale files for new keys | integration | `node --test tests/locales/bundle-parity.test.mjs` | Extend existing (new keys) |

### Sampling Rate
- **Per task commit:** `cd /Users/Code/EchoLearn/app && node --test tests/services/post-queue.service.test.mjs tests/services/post-history.service.test.mjs`
- **Per wave merge:** `cd /Users/Code/EchoLearn/app && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/services/post-queue.service.test.mjs` — covers FIFO drain, date-reset, needsRefill
- [ ] `tests/services/post-history.service.test.mjs` — covers addPost, purgeExpired, getPostsByDay
- [ ] `tests/services/concept-feed-style-weights.test.mjs` — covers weighted random style selection correctness
- [ ] Extend `tests/concept-quota.test.mjs` — add case for `suggestion` sourceType exclusion

---

## Sources

### Primary (HIGH confidence)
- Direct inspection of `app/src/services/concept-feed.service.ts` (lines 1-250) — existing pipeline, STARTER_POSTS, cache pattern
- Direct inspection of `app/src/services/infiniteScroll.service.ts` — queue mechanics, pending queue, background refill guard
- Direct inspection of `app/src/services/daily-read.service.ts` — daily reset pattern, getConceptQuota, EXCLUDED_SOURCE_TYPES
- Direct inspection of `app/src/screens/HomeScreen.tsx` (lines 1-450) — vine scroll detection, event bus wiring, infoFlowItems memo, pull gesture
- Direct inspection of `app/src/components/InfoFlow.tsx` (lines 1-400) — ConceptCard, inline short video playback, news card, text-art
- Direct inspection of `app/src/components/ConceptProgressCard.tsx` — current component to be replaced
- Direct inspection of `app/src/types/index.ts` — DailyPost, PresentationStyle, sourceType union, AppEvent, AppSettings
- Direct inspection of `app/src/lib/event-bus.ts` — AppEvent union type (CONCEPT_EXPLORED confirmed present)
- Direct inspection of `app/src/screens/settings/SettingsDataScreen.tsx` — Developer section pattern
- Direct inspection of `.planning/phases/31-curiosity-feed-redesign-post-lifecycle-and-display/31-UI-SPEC.md` — VineProgress spec, SuggestionCard spec, ScrollToTopFAB spec, PostHistoryScreen spec, copywriting contract
- Direct inspection of `app/.planning/config.json` — nyquist_validation: true confirmed
- Direct inspection of `app/tests/services/daily-read.service.test.mjs` — test pattern for localStorage-based services
- Direct inspection of `app/tests/concept-quota.test.mjs` — test pattern for getConceptQuota

### Secondary (MEDIUM confidence)
- CLAUDE.md project instructions — style conventions, i18n workflow, test framework, settings pattern
- Phase 31 CONTEXT.md (31-CONTEXT.md) — all 47 locked decisions

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns verified in existing codebase
- Architecture: HIGH — patterns derived from direct source inspection; follows established project conventions
- Pitfalls: HIGH — all pitfalls are observable from existing code patterns and known edge cases in the implementation
- Test strategy: HIGH — test framework and patterns verified from existing test files

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (stable codebase; patterns will remain valid for 30 days)

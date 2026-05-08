# Phase 30: Redesign Curiosity Feed as Scroll Progress Bar — Research

**Researched:** 2026-04-17
**Domain:** React 19 IntersectionObserver, CSS sticky, event bus, localStorage service pattern, PostDetailScreen reading detection
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Progress tracks unique concepts explored, not posts viewed. Concepts identified by `anchorId` on posts. Two posts with the same anchorId = one concept.
- **D-02:** Quota target = number of unique concept anchors in today's feed. If 4 posts cover 3 distinct concepts, quota is 3.
- **D-03:** Reading one post per concept is enough — user does NOT need to read every post for the same concept.
- **D-04:** Concept marked "explored" when user opens a post in PostDetailScreen AND meets ANY of: (1) Scroll 70% of essay content, (2) Spend 30 seconds on the post, (3) Ask a follow-up question in the post thread.
- **D-05:** PostDetailScreen emits `CONCEPT_EXPLORED` with `anchorId` on event bus. HomeScreen subscribes and updates progress. Same pattern as `REVIEW_COMPLETED`.
- **D-06:** Each trigger fires once per concept per day (idempotent via `dailyReadService`). Re-opening already-explored concept does not re-trigger.
- **D-07:** CURIOSITY FEED card replaced in-place with progress card that lives inline between bento grid and feed posts.
- **D-08:** Progress card uses `position: sticky; top: 0`. As user scrolls, card sticks at top.
- **D-09:** IntersectionObserver triggers CSS class animating card from full-size to compact bar over ~200ms ease.
- **D-10:** Full card: icon, "Today's Concepts" title, "N of M explored" label, progress bar. Compact bar: icon, "N/M", progress bar — one thin row.
- **D-11:** The "Good Morning" greeting stays as-is — it scrolls away naturally. No code change to greeting.
- **D-12:** Connection cards, news posts, video posts, other non-anchored items excluded from quota.
- **D-13:** No visual "bonus" badge on non-concept items.
- **D-14:** Completing all concepts awards +1 trellis credit via `trellisCreditsService.add(1)`. Once per day.
- **D-15:** Celebration: progress bar turns gold (#E8A838), confetti burst (reuse harvest pattern), label changes to "All caught up!".
- **D-16:** After completion, feed stays fully browsable. Progress bar stays gold at 100%.
- **D-17:** When no concept posts exist today, progress card is hidden. Feed area shows encouraging empty state.
- **D-18:** 0/0 progress never shown. Card only renders when at least 1 concept post exists.
- **D-19:** Explored concept IDs and quota state persisted in localStorage with daily reset.
- **D-20:** Bento card with concept topics deferred to UI-SPEC design review.
- **D-21:** All new strings go through full i18n — en/zh/es/ja bundles in same PR.
- **D-22:** New i18n keys under `home.feed.*` namespace.

### Claude's Discretion

- Exact CSS transition properties for card-to-bar shrink animation
- IntersectionObserver threshold values and sentinel element placement
- Timer implementation for 30s dwell detection
- Whether to debounce concept exploration events
- Empty state icon and illustration choice
- Progress card border-radius, shadow, and background color in both states

### Deferred Ideas (OUT OF SCOPE)

- Bento card with concept topic names — layout from v1 caused empty space issues. Deferred to UI-SPEC design review during `/gsd:ui-phase`. Drop entirely for Phase 30.

</user_constraints>

---

## Summary

Phase 30 v2 transforms the existing "CURIOSITY FEED" island header in `InlineInfoFlow` into a `ConceptProgressCard` component that: (1) lives inline above the feed, (2) sticks below the fixed Header as the user scrolls, (3) collapses to a compact bar via CSS class toggle driven by IntersectionObserver, and (4) tracks active reading via three detectors in PostDetailScreen.

The critical data-model gap to resolve: `DailyPost` has no dedicated `anchorId` field. Anchors must be derived by resolving `sourceQuestionIds → question.parentId`. This derivation logic needs to be encapsulated in `dailyReadService` and/or a utility function in `concept-feed.service`. All three exploration triggers in PostDetailScreen (scroll 70%, 30s dwell, follow-up question) must emit `CONCEPT_EXPLORED` on the event bus — exactly one event per concept per day, enforced idempotently by `dailyReadService`.

The sticky + IntersectionObserver mechanism is straightforward React + native browser APIs. No external libraries required. The existing `Confetti`, `ProgressBar`, `trellisCreditsService`, and `eventBus` are all reusable without modification. The CURIOSITY FEED island markup currently lives in `InlineInfoFlow` (the gradient header div at line ~887) and must move to HomeScreen as the new `ConceptProgressCard` component placed above `<InlineInfoFlow>`.

**Primary recommendation:** Build `ConceptProgressCard` as a standalone component in `src/components/ConceptProgressCard.tsx`. Build `dailyReadService` in `src/services/daily-read.service.ts` mirroring `trellis-credits.service.ts`. Add three reading detectors to `PostDetailScreen` and one event subscriber in `HomeScreen`.

---

## Project Constraints (from CLAUDE.md)

- Inline styles with CSS variables, NOT Tailwind classes for UI
- Services return `ServiceResult<T>` (except simple localStorage wrappers — `dailyReadService` follows the simple wrapper pattern of `trellis-credits.service.ts`)
- All new user-visible strings: EN-first workflow, all 4 locale bundles (en/zh/es/ja) in same PR
- New keys under `home.feed.*` namespace
- Event bus (`src/lib/event-bus.ts`) for cross-screen notifications
- `node --test` with esbuild tsx loader for tests — use inline-mirror pattern for TSX-resident helpers; pure `.ts` modules can be imported directly
- No runtime LLM translation — locale bundles are dev-time authored

---

## Standard Stack

### Core (no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.x | Component rendering, useState/useEffect/useRef | Already in project |
| IntersectionObserver | Browser native | Sentinel visibility detection for compact/expanded toggle | Native API, no bundle cost |
| CSS `position: sticky` | Browser native | Card sticks below Header on scroll | Native, superior to `position: fixed` for this use case |
| localStorage | Browser native | `dailyReadService` persistence | Project pattern: same as `trellis-credits.service.ts` |

### Reusable Project Components (no new installs)

| Asset | Location | Reuse Pattern |
|-------|----------|---------------|
| `ProgressBar` | `src/components/ui/ProgressBar.tsx` | Pass `value`, `color`, `height` — already accepts gold override |
| `Confetti` | `src/components/Confetti.tsx` | `<Confetti active={showConfetti} />` — fires for 3.5s via `window.setTimeout` |
| `trellisCreditsService` | `src/services/trellis-credits.service.ts` | Call `.add(1)` on quota completion |
| `eventBus` | `src/lib/event-bus.ts` | `.emit()` in PostDetailScreen, `.subscribe()` in HomeScreen |
| `toast` | `src/lib/toast.ts` | `toast(t('home.feed.creditToast'), 'success')` on completion |

**Installation:** None required — zero new npm packages.

---

## Architecture Patterns

### New Files Required

```
app/src/
├── components/
│   └── ConceptProgressCard.tsx     — inline + sticky progress card (new)
├── services/
│   └── daily-read.service.ts       — localStorage daily exploration tracker (new)
```

### Modified Files

```
app/src/
├── types/index.ts                  — Add CONCEPT_EXPLORED to AppEvent union
├── screens/HomeScreen.tsx          — Subscribe to CONCEPT_EXPLORED, render ConceptProgressCard
├── screens/PostDetailScreen.tsx    — Add scroll/timer/follow-up detectors
├── components/InfoFlow.tsx         — Remove gradient CURIOSITY FEED island header
├── locales/en.json                 — Add home.feed.* keys
├── locales/zh.json                 — Add home.feed.* translations
├── locales/es.json                 — Add home.feed.* translations
├── locales/ja.json                 — Add home.feed.* translations
```

### Pattern 1: `dailyReadService` (localStorage daily-reset tracker)

Mirrors `trellis-credits.service.ts` exactly. Simple object, no `ServiceResult<T>` wrapper.

```typescript
// Source: trellis-credits.service.ts (project pattern)
const STORAGE_KEY = 'echolearn_daily_read';

interface DailyReadState {
  date: string;           // 'YYYY-MM-DD'
  exploredAnchors: string[];
}

function loadState(): DailyReadState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as Partial<DailyReadState>;
    if (parsed.date !== today()) return freshState(); // daily reset
    return { date: parsed.date, exploredAnchors: Array.isArray(parsed.exploredAnchors) ? parsed.exploredAnchors : [] };
  } catch {
    return freshState();
  }
}

export const dailyReadService = {
  isExplored(anchorId: string): boolean {
    return loadState().exploredAnchors.includes(anchorId);
  },
  markExplored(anchorId: string): void {
    const state = loadState();
    if (!state.exploredAnchors.includes(anchorId)) {
      state.exploredAnchors.push(anchorId);
      saveState(state);
    }
  },
  getExploredAnchors(): string[] {
    return loadState().exploredAnchors;
  },
  reset(): void {
    saveState(freshState());
  },
};
```

### Pattern 2: CONCEPT_EXPLORED AppEvent

Add to `AppEvent` union in `src/types/index.ts`:

```typescript
| { type: 'CONCEPT_EXPLORED'; payload: { anchorId: string } }
```

Follows exact pattern of `REVIEW_COMPLETED` and `HARVEST_COMPLETED`.

### Pattern 3: Anchor ID derivation from DailyPost

`DailyPost` has no `anchorId` field. The anchor for a post is derived from the questions it references:

```typescript
// Source: concept-feed.service.ts line 434-441 — parentId resolution pattern
function getAnchorIdForPost(post: DailyPost, questions: Question[]): string | null {
  const byId = new Map(questions.map(q => [q.id, q]));
  for (const qId of post.sourceQuestionIds) {
    const q = byId.get(qId);
    if (q?.parentId) return q.parentId; // First question's anchor wins
  }
  // Fallback for non-question-backed posts: use post.id as surrogate
  // but starter/connection/video/news/short posts are excluded from quota (D-12)
  return null;
}
```

**Critical:** Starter posts (`sourceType: 'starter'`), connection posts (`sourceType: 'connection'`), video, short, and news posts have no meaningful anchor and should be excluded from the quota entirely. Only posts with `sourceQuestionIds` pointing to questions with `parentId` contribute to the quota count.

**For `dailyReadService.markExplored`, the anchorId to pass is `question.parentId`** — the anchor Question entity's ID. Posts that have `sourceQuestionIds` whose questions lack `parentId` (ungrouped Q&As) can use the post ID as a surrogate, but this is an edge case.

### Pattern 4: ConceptProgressCard — sticky + IntersectionObserver

The card must NOT use `position: fixed`. Per UI-SPEC correction to D-08/D-11: the Header is `position: fixed` at `z-index: 190`. The progress card uses `position: sticky; top: calc(var(--safe-area-top) + 56px)` — sticking just below the header, not at the absolute viewport top.

Sentinel element + IntersectionObserver approach (from UI-SPEC):

```typescript
// Sentinel placed immediately above the progress card
// IntersectionObserver watches the sentinel
const sentinelRef = useRef<HTMLDivElement>(null);
const [isCompact, setIsCompact] = useState(false);

useEffect(() => {
  const sentinel = sentinelRef.current;
  if (!sentinel) return;
  const observer = new IntersectionObserver(
    ([entry]) => {
      setIsCompact(!entry.isIntersecting);
    },
    { threshold: 0, rootMargin: `0px 0px 0px 0px` }
  );
  observer.observe(sentinel);
  return () => observer.disconnect();
}, []);
```

The `isCompact` state controls CSS classes. Animated properties on the card div use `transition: all 200ms ease`.

**Threshold = 0** (fires when sentinel enters/leaves viewport, not when fully visible). The sentinel is 1px tall, placed directly before the card in the DOM, outside the sticky element.

**z-index hierarchy:** Header = 190, ConceptProgressCard = 100. Progress card sticks BELOW the header (via `top: calc(...)`) — no conflict.

### Pattern 5: PostDetailScreen — three reading detectors

Three independent detectors, all idempotent via `dailyReadService.isExplored()`:

**Detector A — Scroll 70%:**
```typescript
// Place a sentinel div at 70% depth of the essay bodyMarkdown content
// IntersectionObserver fires once when sentinel scrolls into view
const scrollSentinelRef = useRef<HTMLDivElement>(null);
const hasEmittedRef = useRef(false);

useEffect(() => {
  const sentinel = scrollSentinelRef.current;
  if (!sentinel || !post?.anchorId) return;
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !hasEmittedRef.current) {
      hasEmittedRef.current = true;
      emitExplored(resolvedAnchorId);
    }
  }, { threshold: 0.1 });
  observer.observe(sentinel);
  return () => observer.disconnect();
}, [post?.id]);
```

Sentinel placement: after the first 70% of the essay markdown, before the Q&A section. A `<div ref={scrollSentinelRef} style={{ height: '1px' }} />` placed between the essay body and the whyCare/takeaway section works well — that section is roughly 70-80% through the content.

**Detector B — 30s dwell timer:**
```typescript
// Starts when PostDetailScreen mounts with a concept post
const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  if (!post || !resolvedAnchorId) return;
  if (dailyReadService.isExplored(resolvedAnchorId)) return; // skip if already done

  dwellTimerRef.current = setTimeout(() => {
    emitExplored(resolvedAnchorId);
  }, 30_000);

  return () => {
    if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
  };
}, [post?.id]); // resets if navigating to different post
```

**Detector C — Follow-up question:**
Within `handleAsk()`, after the user submits a question and BEFORE streaming (line ~341-370), add:
```typescript
// In handleAsk(), after session update, before streaming:
if (resolvedAnchorId) emitExplored(resolvedAnchorId);
```

**`emitExplored` helper (idempotent):**
```typescript
const emitExplored = (anchorId: string) => {
  if (dailyReadService.isExplored(anchorId)) return; // idempotent guard (D-06)
  dailyReadService.markExplored(anchorId);
  eventBus.emit({ type: 'CONCEPT_EXPLORED', payload: { anchorId } });
};
```

### Pattern 6: HomeScreen — concept quota computation

```typescript
// Derived from dailyPosts, computed once (memoized)
const conceptQuota = useMemo(() => {
  const anchorIds = new Set<string>();
  for (const post of dailyPosts) {
    // Only concept-backed posts count (D-12)
    if (['starter', 'connection', 'video', 'short', 'news'].includes(post.sourceType)) continue;
    const anchorId = getAnchorIdForPost(post, questions);
    if (anchorId) anchorIds.add(anchorId);
  }
  return anchorIds.size;
}, [dailyPosts, questions]);

const [exploredCount, setExploredCount] = useState(() =>
  dailyReadService.getExploredAnchors().filter(id => /* in today's quota */ ...).length
);

useEffect(() => {
  const unsub = eventBus.subscribe('CONCEPT_EXPLORED', () => {
    // Recount from service (source of truth)
    const explored = dailyReadService.getExploredAnchors();
    const count = explored.filter(id => quotaAnchorIds.has(id)).length;
    setExploredCount(count);
    if (count >= conceptQuota && conceptQuota > 0 && !creditAwardedRef.current) {
      creditAwardedRef.current = true;
      trellisCreditsService.add(1);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3500);
      toast(t('home.feed.creditToast'), 'success');
    }
  });
  return unsub;
}, [conceptQuota, quotaAnchorIds, t]);
```

### Pattern 7: CURIOSITY FEED island removal from InfoFlow

The gradient orange/red island header in `InlineInfoFlow` (lines 887-913) must be removed. `InlineInfoFlow` renders the feed items only — no header. The `ConceptProgressCard` renders above it in HomeScreen's bento grid area.

The `conceptCount` / `connectionCount` display currently in the island is superseded by the new progress card.

### Anti-Patterns to Avoid

- **`position: fixed` on progress card:** Will stack on top of header instead of below it. Use `position: sticky; top: calc(var(--safe-area-top) + 56px)`.
- **Tracking scroll position manually with scroll event listeners for sticky detection:** IntersectionObserver on a sentinel is simpler, more performant, and requires no cleanup of rAF loops.
- **Emitting CONCEPT_EXPLORED inside the IntersectionObserver callback without an idempotent guard:** The IO fires when threshold is crossed — user could scroll back and forth. Guard with `hasEmittedRef.current` + `dailyReadService.isExplored()`.
- **Computing quota from `items.length` (total feed items):** Quota is unique anchor IDs, not post count. Must deduplicate.
- **Timer not clearing on unmount:** The 30s dwell timer must be cleared in the `useEffect` cleanup. Failing to do so fires the event after navigation.
- **Awarding credit on every app restart:** Use a `creditAwardedRef` (or a `home.feed.creditAwarded.YYYY-MM-DD` localStorage key) to ensure credit awarded once per day.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confetti animation | Custom CSS keyframe system | `<Confetti active={...} />` | Already exists at `src/components/Confetti.tsx`, 55 particles, z-index 9000 |
| Progress bar fill | Custom `<div>` with manual width | `<ProgressBar value={...} color={...} />` | Exists at `src/components/ui/ProgressBar.tsx`, already has smooth CSS transition |
| Credit counter | New credits system | `trellisCreditsService.add(1)` | Existing service, localStorage-backed, add() is safe to call with 1 |
| Cross-screen notification | Custom callback props | `eventBus.emit` / `eventBus.subscribe` | Established project pattern; PostDetailScreen → HomeScreen is exactly the same as other cross-screen events |
| Scroll percentage detection | Manual scroll event listener | IntersectionObserver on a sentinel div at 70% depth | IO is more performant (no event loop), one-shot firing is simpler |

---

## Runtime State Inventory

No rename/refactor involved. Step 2.5: SKIPPED — not a rename/migration phase.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is entirely code/config changes. No external tools, CLIs, or services required beyond the existing app runtime.

---

## Common Pitfalls

### Pitfall 1: anchorId derivation for non-question-backed posts

**What goes wrong:** `conceptFeedService` generates posts from starter content and other non-Q&A sources. These have `sourceQuestionIds: []`. Calling `getAnchorIdForPost()` returns `null`. If not guarded, these posts inflate the quota count or cause null-anchor tracking bugs.

**Why it happens:** The LLM post generation prompt includes "starter" posts as seeds. Starter posts exist even before the user has asked any questions.

**How to avoid:** Explicit `sourceType` guard — skip `['starter', 'connection', 'video', 'short', 'news']` when computing quota. Only `['recent', 'related', 'resurfaced', 'mixed']` source types can contribute to the concept quota. Even among these, only posts whose `sourceQuestionIds` resolve to questions with a `parentId` have a meaningful anchor.

**Warning signs:** `conceptQuota` is non-zero but the progress card shows 0/N when user is viewing posts. Check: are sourceQuestionIds present and do those questions have parentId set?

### Pitfall 2: Sticky `top` value mismatched with Header height

**What goes wrong:** The progress card sticks at the wrong position — either overlapping the Header (too low `top` value) or leaving a gap between Header and card.

**Why it happens:** Header uses `HEADER_HEIGHT` constant imported from `src/components/ui/Header.tsx`. If the progress card uses a hardcoded `top: '56px'` and HEADER_HEIGHT changes, the gap breaks.

**How to avoid:** Use `top: \`${HEADER_HEIGHT}px\`` by importing `HEADER_HEIGHT` from the Header module — do NOT hardcode `56px`. UI-SPEC specifies `top: calc(var(--safe-area-top) + 56px)` but the project already handles safe-area-top at the container level; test on device/simulator.

**Warning signs:** On iOS notch devices, card overlaps the header's bottom edge.

### Pitfall 3: IntersectionObserver fires during SSR / before DOM mount

**What goes wrong:** `sentinelRef.current` is null, observer throws.

**Why it happens:** Vite React 19 app is client-rendered but `useEffect` with empty array is still the correct guard — the observer is only created after mount.

**How to avoid:** Always check `if (!sentinel) return;` at the start of the observer setup effect.

### Pitfall 4: Dwell timer fires after navigating away

**What goes wrong:** User opens a post, starts the 30s timer, navigates back to HomeScreen after 10 seconds, then the timer fires 20s later and emits CONCEPT_EXPLORED for the next post they might be viewing.

**Why it happens:** `setTimeout` is a global; if the `useEffect` cleanup doesn't clear it, it fires after the component unmounts.

**How to avoid:** Always `return () => clearTimeout(dwellTimerRef.current)` in the `useEffect` cleanup. The `post?.id` dependency in the effect also ensures the timer resets when navigating to a different post.

### Pitfall 5: Completion credit awarded multiple times

**What goes wrong:** User explores last concept, credit awarded. User closes and reopens app (same day). HomeScreen remounts, `exploredCount >= conceptQuota` is already true, credit awarded again.

**Why it happens:** The "has credit been awarded today" state lives only in a React ref, which is reset on unmount.

**How to avoid:** Persist the credit-awarded flag in localStorage with daily reset. E.g., `dailyReadService` can expose `isCreditAwarded()` / `markCreditAwarded()` — mirrors the `exploredAnchors` array pattern with a boolean flag.

### Pitfall 6: ConceptProgressCard `isCompact` flickers on initial render

**What goes wrong:** Card renders in expanded state for one frame, then immediately flips to compact if the page was scrolled when the component mounts.

**Why it happens:** IntersectionObserver callback fires asynchronously after mount. The initial state is `isCompact: false` (expanded).

**How to avoid:** On mount, synchronously check sentinel position: `const rect = sentinelRef.current?.getBoundingClientRect(); if (rect && rect.top < 0) setIsCompact(true)`. Or initialize `isCompact` based on scroll position in the `useState` initializer.

### Pitfall 7: `home.feed` i18n keys missing from non-EN bundles

**What goes wrong:** Bundle parity test fails. App falls back to EN keys for all non-EN locales.

**Why it happens:** Forgetting to run the Sonnet subagent translation step for zh/es/ja after adding EN keys.

**How to avoid:** Confirm all 4 bundles are updated in the same commit. Run `node --test tests/locales/bundle-parity.test.mjs` before committing.

---

## Code Examples

### ConceptProgressCard component skeleton

```typescript
// Source: UI-SPEC + project inline-style convention
import { useEffect, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ProgressBar } from './ui/ProgressBar';
import { HEADER_HEIGHT } from './ui/Header';

interface ConceptProgressCardProps {
  explored: number;
  total: number;
  isComplete: boolean;
  showConfetti?: boolean; // controlled by HomeScreen
}

export function ConceptProgressCard({ explored, total, isComplete }: ConceptProgressCardProps) {
  const { t } = useTranslation();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsCompact(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  if (total === 0) return null; // D-17, D-18

  const progressColor = isComplete ? '#E8A838' : 'var(--primary-40)';
  const bgStyle = isComplete
    ? { background: 'color-mix(in srgb, #E8A838 8%, var(--card))' }
    : { background: 'var(--card)' };

  return (
    <>
      {/* Sentinel: 1px div placed above sticky card */}
      <div ref={sentinelRef} style={{ height: '1px' }} />
      <div
        style={{
          position: 'sticky',
          top: `${HEADER_HEIGHT}px`,
          zIndex: 100,
          borderRadius: isCompact ? 0 : 'var(--radius)',
          boxShadow: isCompact ? 'var(--shadow-2)' : 'var(--shadow-1)',
          padding: isCompact ? '8px 16px' : '16px',
          marginBottom: '12px',
          transition: 'all 200ms ease',
          ...bgStyle,
        }}
      >
        {isCompact ? (
          /* Compact bar */
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={16} color={progressColor} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)' }}>
              {t('home.feed.progressCompact', { explored, total })}
            </span>
            <div style={{ flex: 1 }}>
              <ProgressBar value={Math.round((explored / total) * 100)} color={progressColor} height={6} />
            </div>
          </div>
        ) : (
          /* Expanded card */
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={20} color={progressColor} />
              <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)' }}>
                {t('home.feed.title')}
              </span>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginTop: '4px' }}>
              {isComplete ? t('home.feed.complete') : t('home.feed.progress', { explored, total })}
            </p>
            <div style={{ marginTop: '8px' }}>
              <ProgressBar value={Math.round((explored / total) * 100)} color={progressColor} height={8} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
```

### Scroll 70% sentinel placement in PostDetailScreen

```typescript
// Place this div BETWEEN the essay body section and the whyCare/takeaway section
// in the PostDetailScreen render. The essay renders via <Markdown content={body} />
// followed by whyCare and takeaway. The sentinel at this seam ≈ 70% depth.

{/* Scroll depth sentinel — fires CONCEPT_EXPLORED after 70% scroll */}
<div ref={scrollSentinelRef} style={{ height: '1px' }} />
```

### dailyReadService credit guard

```typescript
// Additional method on dailyReadService to prevent double-awarding (Pitfall 5):
isCreditAwarded(): boolean {
  return loadState().creditAwarded === true;
},
markCreditAwarded(): void {
  const state = loadState();
  (state as DailyReadStateWithCredit).creditAwarded = true;
  saveState(state);
},
```

---

## Copywriting — New i18n Keys

New keys under `home.feed.*` (per D-22, UI-SPEC Copywriting Contract):

| Key | EN Value | Interpolation |
|-----|----------|---------------|
| `home.feed.title` | Today's Concepts | — |
| `home.feed.progress` | `{{explored}} of {{total}} explored` | `explored`, `total` |
| `home.feed.progressCompact` | `{{explored}}/{{total}}` | `explored`, `total` |
| `home.feed.complete` | All caught up! | — |
| `home.feed.creditToast` | +1 credit earned! | — |
| `home.feed.emptyTitle` | Nothing new today | — |
| `home.feed.emptyBody` | Check back later for fresh concepts to explore. | — |

These 7 keys must be added to all 4 locale bundles. Run Sonnet subagent for zh/es/ja per `app/scripts/translate-locales.md`.

---

## State of the Art

| Old (v1) Approach | Current (v2) Approach | Impact |
|-------------------|-----------------------|--------|
| Fixed sticky header replacing greeting | Inline sticky card, greeting scrolls naturally | Header stays accessible, no layout thrash |
| Track "posts scrolled past" passively | Track "concepts actively explored" via three engagement signals | Genuine reading signal, not passive scroll |
| Progress card in InfoFlow component | Progress card in HomeScreen, above InlineInfoFlow | Proper separation of concerns; InfoFlow stays pure feed renderer |
| CURIOSITY FEED island = gradient orange header | Remove orange header from InfoFlow | Cleaner feed; progress card IS the new header |

**Deprecated in this phase:**
- The gradient orange/red CURIOSITY FEED island header in `InlineInfoFlow` (lines 887-913): remove entirely, replaced by `ConceptProgressCard`.

---

## Open Questions

1. **`anchorId` for posts where `sourceQuestionIds` questions lack `parentId`**
   - What we know: Questions are assigned `parentId` only after classification runs. Early questions (pre-knowledge-graph) may lack `parentId`.
   - What's unclear: Should ungrouped Q&A-backed posts get a surrogate anchor ID and count toward the quota?
   - Recommendation: Use the `sourceQuestionIds[0]` as a surrogate anchor ID when no `parentId` exists. This ensures every concept-type post contributes to the quota. Document this as a known simplification.

2. **Sentinel `top` vs `rootMargin` for compact toggle**
   - What we know: The sentinel must leave the viewport to trigger compact. The Header is fixed at `HEADER_HEIGHT` px. If `rootMargin: \`-${HEADER_HEIGHT}px 0px 0px 0px\`` is applied to the IO, the sentinel is considered "not intersecting" once it scrolls behind the header — which is the correct trigger.
   - Recommendation: Use `rootMargin: \`-${HEADER_HEIGHT}px 0px 0px 0px\`` on the IntersectionObserver to account for the fixed header's overlay.

3. **Re-triggering progress count on HomeScreen re-mount**
   - What we know: HomeScreen is always-mounted in SwipeTabContainer. Re-mounting on route change is infrequent.
   - What's unclear: `exploredCount` state initializes from `dailyReadService` on mount. Between mounts, CONCEPT_EXPLORED events could have fired and been received. Since the screen stays mounted (always-mounted architecture), this is not a real issue.
   - Recommendation: Non-issue for always-mounted HomeScreen. Add `useState` initializer that reads from `dailyReadService` for correctness.

---

## Validation Architecture

`nyquist_validation` is enabled (config.json).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node --test` with esbuild tsx loader |
| Config file | none — run directly |
| Quick run command | `cd app && node --test tests/daily-read.test.mjs` |
| Full suite command | `cd app && npm test` |

### Phase Requirements → Test Map

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| `dailyReadService.markExplored` idempotent (D-06) | unit | `node --test tests/daily-read.test.mjs` | ❌ Wave 0 |
| `dailyReadService` resets on new day | unit | `node --test tests/daily-read.test.mjs` | ❌ Wave 0 |
| `dailyReadService.isCreditAwarded` persists same day | unit | `node --test tests/daily-read.test.mjs` | ❌ Wave 0 |
| Quota counts unique anchorIds, not post count | unit | `node --test tests/concept-quota.test.mjs` | ❌ Wave 0 |
| Quota excludes non-concept sourceTypes (D-12) | unit | `node --test tests/concept-quota.test.mjs` | ❌ Wave 0 |
| Bundle parity: all 4 locales have `home.feed.*` keys | unit | `node --test tests/locales/bundle-parity.test.mjs` | ✅ exists (extended) |
| `CONCEPT_EXPLORED` in AppEvent union | source grep | acceptance_criteria grep | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd app && node --test tests/daily-read.test.mjs && node --test tests/locales/bundle-parity.test.mjs`
- **Per wave merge:** `cd app && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `app/tests/daily-read.test.mjs` — covers dailyReadService unit contract (markExplored idempotency, daily reset, isCreditAwarded)
- [ ] `app/tests/concept-quota.test.mjs` — covers anchor deduplication logic, sourceType exclusion filter

---

## Sources

### Primary (HIGH confidence)

- Direct code reading: `app/src/components/InfoFlow.tsx` lines 886-913 — existing CURIOSITY FEED island structure
- Direct code reading: `app/src/screens/PostDetailScreen.tsx` — component structure, existing event bus usage, `handleAsk` location
- Direct code reading: `app/src/screens/HomeScreen.tsx` — bento grid layout, InlineInfoFlow integration, event subscriptions
- Direct code reading: `app/src/services/trellis-credits.service.ts` — localStorage service pattern to replicate
- Direct code reading: `app/src/services/concept-feed.service.ts` — anchorId derivation via `question.parentId`
- Direct code reading: `app/src/types/index.ts` (line 650-680) — AppEvent union type
- Direct code reading: `app/src/components/Confetti.tsx` — existing component API
- Direct code reading: `app/src/components/ui/ProgressBar.tsx` — existing component API
- Direct code reading: `app/src/lib/event-bus.ts` — EventBus subscribe/emit API
- Phase docs: `30-CONTEXT.md`, `30-UI-SPEC.md` — locked decisions and UI contract

### Secondary (MEDIUM confidence)

- MDN IntersectionObserver API: `threshold: 0` fires when any pixel crosses; `rootMargin` adjusts effective viewport boundary — standard browser API, HIGH confidence

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all reused from existing project code, no new dependencies
- Architecture patterns: HIGH — directly derived from reading source files
- Pitfalls: HIGH — identified from direct code inspection (anchorId gap, timer cleanup, credit double-award)
- i18n keys: HIGH — exact keys from UI-SPEC Copywriting Contract

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (stable — no external dependencies)

# Phase 30: Redesign Curiosity Feed as Scroll Progress Bar with Daily Reading Quota Credits — Research

**Researched:** 2026-04-16
**Domain:** React UI redesign — sticky progress bar, IntersectionObserver read detection, localStorage daily state, celebration animation reuse
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Progress bar tracks **posts viewed** (discrete count, e.g. "2 of 4 today"). Not scroll position, not concepts, not time.
- **D-02:** Progress bar is a **sticky header** fixed at the top of HomeScreen. Replaces the "Good Evening" greeting banner entirely. All HomeScreen content (bento grid, posts) scrolls underneath it.
- **D-03:** Bar is **always visible** from the moment posts exist — no fade-in-on-scroll behavior.
- **D-04:** Daily quota target = **number of posts the feed generated today** (`MAX_POSTS` = 4 currently). Quota is always achievable.
- **D-05:** Completing daily quota awards **+1 trellis credit** via `trellisCreditsService`. Awarded once per day; re-reading does not re-award.
- **D-06:** After quota completion, feed **stays fully browsable**. Bar stays at 100% with "All caught up!" label. No gate, no collapse.
- **D-07:** A post counts as **read when user scrolls past its bottom edge** (bottom edge exits top of viewport). No dwell timer, no tap required.
- **D-08:** Read post IDs persisted in **localStorage with daily reset**. Key: `echolearn_daily_read_posts`, value: `{ date, readIds[], quotaCompleted }`. Progress survives app restart within the same day.
- **D-09:** Progress bar is a **continuous smooth bar** (not segmented). Reuses `ProgressBar` component from `src/components/ui/ProgressBar.tsx`.
- **D-10:** Completion celebration: bar color shifts from primary to gold/green, brief **confetti burst** (reuse harvest confetti pattern), **"+1 🍒" flies to trellis counter**. Label changes to "All caught up!".
- **D-11:** Current static CURIOSITY FEED island card is **removed entirely**. Its function splits between the progress bar (numeric progress) and new bento card (topic info).
- **D-12:** A new **bento card** in the HomeScreen bento grid shows **concept topics covered** in today's feed (e.g. "Quantum Computing, Neural Networks, +2 more"). Tapping could scroll to the feed section.
- **D-13:** When no posts exist, progress bar header is **hidden** (not rendered). Feed area shows encouraging empty state.
- **D-14:** 0/0 bar is **never shown**. Progress bar only renders when `dailyPosts.length > 0`.
- **D-15:** All new user-facing strings go through **full i18n** — added to `en.json` and translated to zh/es/ja via Phase 27 Sonnet subagent workflow. All 4 locale bundles ship in same PR.
- **D-16:** New i18n keys under `home.feed.*` namespace: `progress`, `complete`, `empty`, `bentoTitle`, `bentoMore`, `credits`.

### Claude's Discretion
- Exact confetti particle count, animation duration, and easing curves
- Progress bar height, padding, and exact sticky positioning
- Bento card layout, icon choice, and truncation behavior for topic names
- IntersectionObserver vs manual scroll listener for read detection
- Whether the empty state message includes an icon/illustration

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 30 replaces the HomeScreen's static CURIOSITY FEED island and `getGreeting()` banner with two new surfaces: (1) a sticky progress bar header that tracks how many of today's feed posts have been read, and (2) a new bento card showing the concept topics in today's feed. On daily quota completion, a one-time trellis credit (+1) is awarded with the existing `trellisCreditsService.add()`, and the celebration animation pattern from `TrellisStatusPanel` (cherry particles fly to counter + `<Confetti>` burst) is reused directly.

The codebase already provides every building block needed: `ProgressBar` component (continuous bar, `0-100` value, color prop, transition), `Confetti` component (55-particle full-screen burst), `trellisCreditsService` (localStorage, `add(count)` returns new total), and an established IntersectionObserver pattern inside `InfoFlow.tsx` (the `ImmersiveInfoFlow` export already uses IO with `threshold: 0.6` and `[data-flow-card]` attribute selectors). The new daily read-state service mirrors the shape of `trellis-blossom-dates.service.ts` and `trellis-credits.service.ts`: a thin localStorage wrapper with a date-keyed object.

**Primary recommendation:** Implement a `dailyReadService` (new TS file) that owns the `echolearn_daily_read_posts` key, expose `markRead(postId)`, `getState()`, and `reset()`. Wire `IntersectionObserver` inside `InlineInfoFlow` (or via a new `useDailyReadTracking` hook in HomeScreen) using `threshold: 1.0` with `rootMargin: '0px 0px 0px 0px'` to detect when a card's bottom edge exits the viewport. Progress bar lives in HomeScreen, above the scrollable content container but below the `<Header>`, using `position: sticky` with `top: HEADER_HEIGHT`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | already installed | UI state, hooks, `useRef` | Project standard |
| `IntersectionObserver` API | browser native | Detect post bottom-edge scroll-past | Already used in `ImmersiveInfoFlow` for active-card tracking |
| localStorage | browser native | Persist daily read state across restarts | Project-wide pattern (`trellis-credits.service.ts`, `trellis-blossom-dates.service.ts`) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `<ProgressBar>` | local component | Render continuous bar | Direct reuse, accepts `value`, `color`, `label` props |
| `<Confetti>` | local component | Full-screen confetti burst | Identical reuse from TrellisStatusPanel harvest path |
| `trellisCreditsService` | local service | Award +1 reading credit on quota complete | Direct reuse: `add(1)` returns new total |
| `eventBus` | local lib | Emit `DAILY_QUOTA_COMPLETED` event | Inform other screens (e.g., PlannerScreen credit counter) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| IntersectionObserver | `onScroll` listener + `getBoundingClientRect()` | IO is more performant (no scroll event firing), already established in codebase. CONTEXT.md marks IO vs scroll as Claude's discretion — IO is strongly preferred. |
| Reuse `<ProgressBar>` | Custom bar | No reason to hand-roll; existing component already has the right props and `transition: width 0.4s ease`. |
| Single `home.feed.*` namespace | Extending existing `home.*` keys inline | Namespace matches D-16 exactly. |

**Installation:** No new packages needed. All dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure

New files needed:
```
app/src/services/
└── daily-read.service.ts        — localStorage wrapper for { date, readIds[], quotaCompleted }

app/tests/services/
└── daily-read.service.test.mjs  — Wave 0 unit tests for service logic

app/tests/components/
└── HomeScreen.feedProgress.test.mjs  — Wave 0 tests for pure helpers
```

Modified files:
```
app/src/screens/HomeScreen.tsx           — Replace greeting banner with sticky progress bar; add bento card; wire IO callback
app/src/components/InfoFlow.tsx          — Add onPostRead callback prop to InlineInfoFlow; add IO tracking per concept card
app/src/locales/en.json                  — Add home.feed.* keys
app/src/locales/zh.json / es.json / ja.json  — Translated equivalents
app/src/types/index.ts                   — Add DAILY_QUOTA_COMPLETED to AppEvent union
```

### Pattern 1: `dailyReadService` — Date-keyed localStorage wrapper

**What:** A thin service that manages `{ date: string, readIds: string[], quotaCompleted: boolean }` under `echolearn_daily_read_posts`. Resets automatically when the stored `date` differs from `today()`.

**When to use:** Called from HomeScreen's IO callback on every post-read event. Mirrors `trellis-credits.service.ts` in structure.

```typescript
// Source: modelled after app/src/services/trellis-credits.service.ts

const STORAGE_KEY = 'echolearn_daily_read_posts';

interface DailyReadState {
  date: string;
  readIds: string[];
  quotaCompleted: boolean;
}

function readState(): DailyReadState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: today(), readIds: [], quotaCompleted: false };
    const parsed = JSON.parse(raw) as DailyReadState;
    if (parsed.date !== today()) return { date: today(), readIds: [], quotaCompleted: false };
    return parsed;
  } catch {
    return { date: today(), readIds: [], quotaCompleted: false };
  }
}

function writeState(state: DailyReadState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
}

export const dailyReadService = {
  getState(): DailyReadState { return readState(); },

  /** Mark a post as read. Returns updated state. Idempotent. */
  markRead(postId: string): DailyReadState {
    const state = readState();
    if (state.readIds.includes(postId)) return state;
    const next = { ...state, readIds: [...state.readIds, postId] };
    writeState(next);
    return next;
  },

  /** Mark quota as completed. Idempotent. */
  markQuotaCompleted(): DailyReadState {
    const state = readState();
    if (state.quotaCompleted) return state;
    const next = { ...state, quotaCompleted: true };
    writeState(next);
    return next;
  },

  reset(): void {
    writeState({ date: today(), readIds: [], quotaCompleted: false });
  },
};
```

### Pattern 2: IntersectionObserver for "scrolled-past" detection in InlineInfoFlow

**What:** IO observer with `threshold: 0` and `rootMargin: '-100% 0px 0px 0px'` detects when a card's bottom edge exits the viewport top — effectively "scrolled past". Each `[data-flow-card]` div gets observed; on crossing, `onPostRead(postId)` callback fires.

**When to use:** Add an optional `onPostRead?: (postId: string) => void` prop to `InlineInfoFlow`. HomeScreen passes a callback that calls `dailyReadService.markRead()` and updates local state.

```typescript
// Source: modelled after ImmersiveInfoFlow in app/src/components/InfoFlow.tsx (lines 678-692)
// The rootMargin trick: '-100% 0px 0px 0px' means "fire when element top is above the
// viewport bottom and element bottom is above the viewport top" = fully scrolled past.

useEffect(() => {
  if (!onPostRead) return;
  const nodes = containerRef.current?.querySelectorAll<HTMLElement>('[data-flow-card-concept]');
  if (!nodes?.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          // Card has exited — check if it exited from the top (scrolled past)
          if (entry.boundingClientRect.top < 0) {
            const postId = (entry.target as HTMLElement).dataset.postId;
            if (postId) onPostRead(postId);
          }
        }
      }
    },
    { threshold: 0 },
  );

  nodes.forEach((node) => observer.observe(node));
  return () => observer.disconnect();
}, [items, onPostRead]);
```

**Alternative (simpler):** Use `threshold: 0` without rootMargin, and fire on `entry.isIntersecting === false && entry.boundingClientRect.top < 0`. This is the approach the codebase already implicitly supports. Either is valid — Claude's discretion per CONTEXT.md.

### Pattern 3: Sticky progress bar header in HomeScreen

**What:** The `<Header title={getGreeting()} />` call is removed. In its place, when `dailyPosts.length > 0`, a sticky div renders above the scrollable container.

**When to use:** Replaces the existing `<Header>` call entirely for HomeScreen's greeting title. The `Header` component itself is not changed — just not used for the greeting role.

```tsx
// Source: HomeScreen.tsx pattern — sticky positioning within scrollable layout
// Note: position:'sticky', top:'0' sticks within the scroll container, not the viewport.
// For viewport-sticky (above the scroll container), use position:'fixed' + top:HEADER_HEIGHT.
// D-02 says "fixed at the top" — use position:'fixed', top: HEADER_HEIGHT.

{dailyPosts.length > 0 && (
  <div style={{
    position: 'fixed',
    top: `${HEADER_HEIGHT}px`,
    left: 0,
    right: 0,
    zIndex: 40,
    backgroundColor: 'var(--surface)',
    padding: '8px 16px',
    borderBottom: '1px solid var(--border)',
  }}>
    <ProgressBar
      value={(readCount / totalCount) * 100}
      color={quotaCompleted ? 'var(--color-gold, #E8A838)' : 'var(--primary-40)'}
      label={quotaCompleted ? t('home.feed.complete') : t('home.feed.progress', { read: readCount, total: totalCount })}
    />
  </div>
)}
```

The scrollable content `paddingTop` must be adjusted to absorb both `HEADER_HEIGHT` and the progress bar height when visible.

### Pattern 4: Bento card — concept topics from today's feed

**What:** A new half-width bento card (or full-width, Claude's discretion) in the bento grid. Shows up to 2 topic names from `dailyPosts[*].keywords[0]` with `+N more` overflow. Taps scroll the container to the feed section (using `containerRef.current?.scrollTo` or a `feedSectionRef`).

```tsx
// Source: HomeScreen.tsx bento grid pattern (lines 370-453)
// keywords[0] or post.title are both valid sources for topic name display
const topicNames = dailyPosts
  .map(p => p.keywords[0] ?? p.title ?? '')
  .filter(Boolean)
  .filter((v, i, a) => a.indexOf(v) === i); // deduplicate

const displayTopics = topicNames.slice(0, 2);
const overflow = topicNames.length - displayTopics.length;
const label = overflow > 0
  ? `${displayTopics.join(', ')}, ${t('home.feed.bentoMore', { count: overflow })}`
  : displayTopics.join(', ');
```

### Pattern 5: Celebration — reuse TrellisStatusPanel fly-to-counter + Confetti

**What:** On first quota completion (`!wasCompleted && nowCompleted`), fire: (1) `<Confetti active={true}>` for 3.5s, (2) fly-particle from progress bar region to the trellis counter in PlannerScreen (different screen — but the counter is not visible). Since the trellis counter lives in PlannerScreen header (not in HomeScreen), the fly-to-counter animation should target a logical point (e.g., a toast or the progress bar itself). Emitting a `DAILY_QUOTA_COMPLETED` event lets PlannerScreen react if visible.

**Simplification:** The fly-particle in TrellisStatusPanel targets `counterRef` which is a ref to PlannerScreen's credit counter span. From HomeScreen, we cannot target that ref directly. Options:
1. Emit event `DAILY_QUOTA_COMPLETED` — PlannerScreen can flash/animate its counter.
2. Skip the fly-particle, use only confetti + color shift + toast "+1 🍒".
3. Keep fly-particle local — fly to a cherry icon near the progress bar itself.

**Recommendation:** Use confetti + bar color shift + `toast(t('home.feed.credits', { count: 1 }), 'success')`. Skip cross-screen fly-particle. Emit `DAILY_QUOTA_COMPLETED` event for PlannerScreen to react. This avoids the complexity of cross-screen ref sharing.

```tsx
// On quota completion (one-time guard via dailyReadService.quotaCompleted):
trellisCreditsService.add(1);
dailyReadService.markQuotaCompleted();
eventBus.emit({ type: 'DAILY_QUOTA_COMPLETED', payload: { creditsAwarded: 1 } });
setShowConfetti(true);
window.setTimeout(() => setShowConfetti(false), 3500);
toast(t('home.feed.credits', { count: 1 }), 'success');
```

### Anti-Patterns to Avoid

- **Showing 0/0 bar:** D-14 forbids this. Guard with `dailyPosts.length > 0`.
- **Awarding credits on every re-read:** Guard with `state.quotaCompleted` before calling `trellisCreditsService.add()`.
- **Using `scroll` event listener for read detection:** IO is preferred (performant, already established in codebase).
- **Patching `InlineInfoFlow` inline logic into HomeScreen:** Keep IO callback in InfoFlow as an optional prop; HomeScreen owns the state update.
- **Forgetting paddingTop adjustment:** With the progress bar fixed above content, `paddingTop` must increase by the bar's rendered height (approximately 52px) when posts exist.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Smooth animated progress bar | Custom width-animated div | `<ProgressBar>` from `src/components/ui/ProgressBar.tsx` | Already has `transition: width 0.4s ease`, color prop, label prop |
| Confetti burst | New particle system | `<Confetti active={bool}>` from `src/components/Confetti.tsx` | 55-particle full-screen burst, already used in harvest flow |
| Credits storage | New credits mechanism | `trellisCreditsService.add(1)` | Exact same service used for harvest credits; same localStorage key |
| Daily read state reset | Manual date comparison | `dailyReadService` pattern: compare `stored.date !== today()` | Mirrors the exact pattern of `trellis-blossom-dates.service.ts` |
| Scroll-past detection | `getBoundingClientRect()` in scroll handler | `IntersectionObserver` with `threshold: 0` | Already established in `ImmersiveInfoFlow`; avoids scroll event overhead |

---

## Common Pitfalls

### Pitfall 1: `position: fixed` progress bar clips under SwipeTabContainer

**What goes wrong:** HomeScreen is always-mounted inside the horizontal swipe strip. A `position: fixed` element placed inside it may paint correctly on `/home` but remain visible on other screens if HomeScreen's DOM is not unmounted.

**Why it happens:** SwipeTabContainer keeps all 5 screens mounted. Fixed elements inside an off-screen mounted component remain in the viewport.

**How to avoid:** Condition rendering on `location.pathname === '/home'` — which HomeScreen already uses (see line 99). Or use `visibility: hidden` / `display: none` when not active. Check the existing `Header` component usage — it is already conditionally controlled by screen visibility in other screens.

**Warning signs:** During development, progress bar visible on PlannerScreen.

### Pitfall 2: IO fires for off-screen cards on mount

**What goes wrong:** When `InlineInfoFlow` mounts with existing posts, the IO may immediately fire for all cards that are above the viewport fold — marking them as "read" before the user actually scrolled past them.

**Why it happens:** IO fires for all observed entries on initial observation. Cards above the fold report `isIntersecting: false` AND `boundingClientRect.top < 0`.

**How to avoid:** Track mount state with a `mountedRef` — only fire `onPostRead` after a 200ms grace period, or only observe cards once the component has been mounted for one tick. Alternative: only process IO callbacks when the card was previously intersecting (entered viewport) before exiting.

**Warning signs:** All posts immediately show as "read" on HomeScreen load.

### Pitfall 3: Daily reset not triggering on same-day app restart

**What goes wrong:** `dailyReadService` reads correct date, no reset. But `quotaCompleted` from yesterday persists if dates match (by accident) or if device clock is wrong.

**Why it happens:** Correct by design for same-day restarts. BUT if `today()` returns a different format than what was stored, the comparison fails.

**How to avoid:** Use `today()` from `src/lib/date.ts` (returns `YYYY-MM-DD`) consistently in both write and read paths. Never use `new Date().toISOString()` or `Date()` directly.

### Pitfall 4: `ProgressBar` `label` prop renders above the bar, not beside it

**What goes wrong:** The existing `ProgressBar` renders `label` as a `<p>` ABOVE the bar track (see `src/components/ui/ProgressBar.tsx` lines 13-15). For the sticky header, this may take too much vertical space or look wrong.

**Why it happens:** `ProgressBar` renders `{label && <p>...}` then the bar div. The label is not inline with the bar.

**How to avoid:** Wrap the `ProgressBar` in a container with the label as a sibling in a flex row, OR pass `label` as intended and adjust bar height. Alternatively, render a custom `<div>` next to `<ProgressBar>` for the label. The component accepts a `style` prop on its wrapper so layout can be overridden.

### Pitfall 5: `AppEvent` union must be extended for `DAILY_QUOTA_COMPLETED`

**What goes wrong:** `eventBus.emit({ type: 'DAILY_QUOTA_COMPLETED', ... })` produces a TypeScript error because the event type is not in the `AppEvent` union in `src/types/index.ts`.

**How to avoid:** Add to the union before emitting. The pattern is established — every event type must be declared in `AppEvent` at `src/types/index.ts` line 649+.

---

## Code Examples

### Existing `ProgressBar` component signature
```typescript
// Source: app/src/components/ui/ProgressBar.tsx
interface ProgressBarProps {
  value: number; // 0-100
  color?: string;
  height?: number;
  label?: string;
  style?: React.CSSProperties;
}
// Default color: 'var(--primary-40)', height: 8px, transition: width 0.4s ease
```

### Existing `Confetti` component API
```typescript
// Source: app/src/components/Confetti.tsx
export function Confetti({ active }: { active: boolean })
// 55 particles, 1.8-3.3s duration, zIndex: 9000, position: fixed inset 0
// To use: <Confetti active={showConfetti} /> — renders nothing when active=false
```

### Existing `trellisCreditsService` API
```typescript
// Source: app/src/services/trellis-credits.service.ts
trellisCreditsService.getTotal(): number  // reads localStorage 'trellis_fruit_credits'
trellisCreditsService.add(count: number): number  // increments, returns new total
```

### Existing `today()` utility
```typescript
// Source: app/src/lib/date.ts
export function today(): string  // returns 'YYYY-MM-DD' in local time
```

### Existing ImmersiveInfoFlow IO pattern (reference)
```typescript
// Source: app/src/components/InfoFlow.tsx lines 678-692
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const idx = cards.indexOf(entry.target);
        if (idx !== -1) setActiveIndex(idx);
      }
    }
  },
  { root: container, threshold: 0.6 },
);
cards.forEach((card) => observer.observe(card));
```

### HomeScreen feed re-sync pattern (reference)
```typescript
// Source: app/src/screens/HomeScreen.tsx lines 98-102
useEffect(() => {
  if (location.pathname === '/home') {
    setDailyPosts(conceptFeedService.getCachedDailyPosts());
  }
}, [location.pathname]);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getGreeting()` banner in `<Header title={getGreeting()}>` | Sticky progress bar above scrollable content | Phase 30 | Greeting is removed; header title may need replacement or header hidden for HomeScreen |
| Static CURIOSITY FEED island in `InlineInfoFlow` header div | Removed; function split to progress bar + bento card | Phase 30 | `InlineInfoFlow`'s existing header div (lines 887-913) is also to be removed |
| No post-read tracking | `dailyReadService` with localStorage daily state | Phase 30 | New service, new localStorage key |

**Important:** The `InlineInfoFlow` component renders its own "CURIOSITY FEED" header island (lines 887-913 of `InfoFlow.tsx`) — a gradient orange card with post count and concept/connection stats. Per D-11, this is also removed. The planner must include a task to strip this header div from `InlineInfoFlow`.

---

## Open Questions

1. **Header replacement in HomeScreen**
   - What we know: The existing `<Header title={getGreeting()} />` renders the fixed app header (with the nav-shadow, safe-area, etc.). Removing it leaves HomeScreen without any header.
   - What's unclear: Should HomeScreen show no `<Header>` at all (unusual vs other screens), or should it show a minimal header (e.g., with app name or blank)? The progress bar is fixed at `top: HEADER_HEIGHT` — so the standard `<Header>` should still render to provide the visual container.
   - Recommendation: Keep `<Header title={t('home.title')} />` (already in `en.json` as `"home.title": "Home"`) but remove the greeting. The progress bar renders directly below it as a sub-header strip.

2. **`InlineInfoFlow` header island removal scope**
   - What we know: The gradient orange "CURIOSITY FEED" header div is inside `InlineInfoFlow`'s render function. Per D-11 it is removed.
   - What's unclear: The `infoFlow.curiosityFeed`, `infoFlow.postsWaiting`, `infoFlow.askToStart`, `infoFlow.conceptsCount`, `infoFlow.linksCount` i18n keys become unused. Should they be deleted from all 4 locale bundles?
   - Recommendation: Remove them from all 4 bundles in the same PR (bundle-parity test will catch any divergence). Confirm no other screen uses these keys before deleting.

3. **Bento card grid position**
   - What we know: Current bento grid has 3 cards (Flashcard, Planner — half-width; Podcast — full-width). The new "Today's Feed" bento card adds a 4th.
   - What's unclear: Should it be half-width (2-column grid partner to one of the existing halves) or full-width? D-12 says "bento card in the HomeScreen bento grid" — layout is Claude's discretion.
   - Recommendation: Half-width, placed as the 4th cell (after Flashcard and Planner, before Podcast goes full-width). This maintains the visual rhythm. Tap scrolls to the feed section.

---

## Environment Availability

Step 2.6: SKIPPED — phase is purely UI/code changes with no new external dependencies. All required runtime capabilities (IntersectionObserver, localStorage) are standard browser APIs already used in the codebase.

---

## Validation Architecture

> `nyquist_validation` is `true` in `.planning/config.json` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node --test` with esbuild tsx loader |
| Config file | none — loader provided inline per test file |
| Quick run command | `node --test tests/services/daily-read.service.test.mjs` |
| Full suite command | `npm test` (runs `node --test tests/**/*.test.mjs`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 / D-07 | `markRead(postId)` is idempotent; read count increments | unit | `node --test tests/services/daily-read.service.test.mjs` | ❌ Wave 0 |
| D-04 / D-05 | Quota completion awards +1 credit exactly once | unit | `node --test tests/services/daily-read.service.test.mjs` | ❌ Wave 0 |
| D-08 | Daily reset fires when stored date differs from `today()` | unit | `node --test tests/services/daily-read.service.test.mjs` | ❌ Wave 0 |
| D-14 | Progress bar never renders at 0/0 — guard logic | unit (inline mirror) | `node --test tests/components/HomeScreen.feedProgress.test.mjs` | ❌ Wave 0 |
| D-15 / D-16 | `home.feed.*` keys present in all 4 locale bundles with no divergence | bundle parity | `node --test tests/locales/bundle-parity.test.mjs` | ✅ existing |

### Sampling Rate
- **Per task commit:** `node --test tests/services/daily-read.service.test.mjs tests/components/HomeScreen.feedProgress.test.mjs tests/locales/bundle-parity.test.mjs`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/services/daily-read.service.test.mjs` — covers D-01/D-07/D-05/D-08 service contract
- [ ] `tests/components/HomeScreen.feedProgress.test.mjs` — covers D-14 progress value calculation helper (pure function, inline-mirror pattern)

*(Existing `bundle-parity.test.mjs` covers locale key parity — no Wave 0 gap there.)*

---

## Project Constraints (from CLAUDE.md)

- **Inline styles with CSS variables** — no Tailwind classes for UI. Use `var(--primary-40)`, `var(--surface)`, `var(--surface-variant)`, `var(--shadow-1)`, `var(--radius-xl)`, etc.
- **`ServiceResult<T>`** pattern for all service return values (applies to any new service methods that could fail).
- **localStorage via service abstractions** — do not access localStorage directly in components; use `dailyReadService` wrapper.
- **Event bus** for cross-screen notifications — use `eventBus.emit()` for `DAILY_QUOTA_COMPLETED`.
- **i18n EN-first workflow** — add to `en.json` first, then translate zh/es/ja via Sonnet subagent, all 4 bundles in same PR.
- **No runtime LLM translation** — `home.feed.*` strings are hardcoded bundles, not translated at runtime.
- **`node --test` + inline-mirror pattern** for `.tsx`-resident helpers. For pure `.ts` modules, direct import works.
- **Working directory for app:** `app/` — all paths relative to that.

---

## Sources

### Primary (HIGH confidence)
- `app/src/screens/HomeScreen.tsx` — full HomeScreen layout, existing bento grid structure, feed state management
- `app/src/components/ui/ProgressBar.tsx` — component API (value, color, height, label, style props)
- `app/src/components/Confetti.tsx` — confetti component (active prop, 55 particles, zIndex 9000)
- `app/src/components/trellis/TrellisStatusPanel.tsx` — fly-particle + confetti pattern (lines 47-79, 178-220)
- `app/src/services/trellis-credits.service.ts` — localStorage pattern to mirror for dailyReadService
- `app/src/components/InfoFlow.tsx` — `InlineInfoFlow` structure (lines 858-940), `ImmersiveInfoFlow` IO pattern (lines 668-692)
- `app/src/types/index.ts` — `AppEvent` union (lines 649-678), `DailyPost` type (line 523)
- `app/src/lib/event-bus.ts` — EventBus API
- `app/src/lib/date.ts` — `today()` returns `YYYY-MM-DD`
- `app/src/locales/en.json` — existing `home.*` and `infoFlow.*` keys

### Secondary (MEDIUM confidence)
- MDN IntersectionObserver docs — `threshold: 0`, `rootMargin`, `isIntersecting`, `boundingClientRect` behavior for scroll-past detection (well-established browser API, HIGH confidence in practice)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components already exist in codebase, verified by direct file inspection
- Architecture: HIGH — all patterns are direct analogues of existing code in the same codebase
- Pitfalls: HIGH — identified from direct reading of the affected code paths
- i18n: HIGH — Phase 27 workflow fully documented in CLAUDE.md

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable codebase, no moving external targets)

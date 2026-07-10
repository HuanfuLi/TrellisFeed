# Phase 26: Trellis Harvest Panel, Dying/Dead Node Actions, Suggested Moves Refactor — Research

**Researched:** 2026-04-14
**Domain:** React UI (trellis status panel, animations, bottom sheet), service integration (flashcard/podcast/post), state management (credits persistence, pruning, dedup)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Harvest Mechanic & Credits**
- D-01: Harvesting ripe fruits earns visible currency ("fruits" or credits) stored persistently. Spending mechanic deferred.
- D-02: Users may harvest multiple fruits in a single batch event ("Harvest all").
- D-03: Harvest celebration: fruits fly from trellis into the counter (collection arc), then confetti burst. Unified animation — NOT per-fruit-type.
- D-04: Fruit/credit counter at upper-right corner of Planner header bar.
- D-05: Fruit column glows/shines softly when count > 0. No aggressive notification.
- D-06: After harvesting, fruit nodes reset to green leaf. Blossom date cleared. Lifecycle restarts.

**Status Panel Layout & Interaction**
- D-07: 3-column landscape panel between trellis hero and suggested moves. Lucide icon + count per column. No emoji.
- D-08: Three columns: Ripe Fruits | Dying (yellow + falling) | Dead (fallen).
- D-09: Tapping column opens bottom sheet with affected nodes + action buttons. Reuse/extend suggested moves bottom sheet pattern.
- D-10: Icons from lucide-react. Exact icons are Claude's discretion.

**Dying Node Actions (Heal)**
- D-11: Tap dying node → TWO parallel actions: (1) start flashcard review for that anchor's Q&As, AND (2) add topic to today's podcast queue.
- D-12: Healing succeeds when user completes review. Leaf returns to green via existing REVIEW_COMPLETED event pipeline.

**Dead Node Actions (Re-plant)**
- D-13: Tap dead node → generate post for reading, then direct to existing flashcards. Do NOT generate new flashcards.
- D-14: Re-planting resets node's review schedule so it re-enters SM-2 from beginning.

**Pruning**
- D-15: Dying and dead nodes show a "prune" action (scissors icon) alongside heal/re-plant.
- D-16: Two-step soft delete: archive first (hidden from trellis), hard-delete available from Pruned section later.
- D-17: Prune animation: scissors cutting motion on vine stem, leaf/blossom falls away.
- D-18: Pruned section accessible from somewhere on PlannerScreen (placement is Claude's discretion).

**Suggested Moves Refactor**
- D-19: Trellis health is primary source for suggested moves. AutoGen is supplement for healthy-garden states.
- D-20: Priority ordering: (1) Dead nodes — re-plant actions, (2) Dying nodes — heal actions, (3) AutoGen moves — deduped.
- D-21: Ripe fruits do NOT appear in suggested moves — handled exclusively in status panel.
- D-22: Remove `suggestedChunks` / check-in-derived chunks system entirely. Only autoGen moves remain as non-trellis source.
- D-23: AutoGen dedup filter: skip moves whose target anchor overlaps with dying/dead nodes.

### Claude's Discretion
- Exact lucide icon choices for the 3 panel columns
- Pruned section placement on PlannerScreen
- Bottom sheet internal layout (card style, spacing, button sizes)
- Confetti particle count and animation duration
- How the scissors prune animation is implemented (CSS, Framer Motion, or Lottie)

### Deferred Ideas (OUT OF SCOPE)
- Credit/fruit spending mechanic (cosmetic unlocks, seasonal themes, trellis materials, ambient creatures)
- Streak bonuses for consecutive harvests
- Social sharing of garden state
- Pruned section as full "garden history" with replant-from-archive capability
- Settings page for trellis preferences
- GraphScreen/mindmap integration with trellis actions
- Seasonal trellis themes
</user_constraints>

---

## Summary

Phase 26 builds on the trellis hero from Phase 25 and adds a fully interactive garden management layer. The primary work is (1) a status panel deriving counts from `useTrellisData`, (2) a new credits persistence layer, (3) action logic wiring existing services (review, podcast, concept-feed) to trellis node states, (4) a pruning soft-delete using the existing `flagged` field on `Question`, and (5) a refactored `PlannerScreen` that replaces `suggestedChunks` with trellis-health-driven moves.

All the service infrastructure exists and can be called directly. The key design challenges are: (a) the fruit counter needs new localStorage persistence and a `HARVEST_COMPLETED` event for `useTrellisData` to recompute, (b) the bottom sheet is a new component (no existing bottom-sheet component in the codebase), (c) the harvest fly-to-counter animation requires careful layering against the fixed header, and (d) the SM-2 schedule reset for re-plant needs to update all flashcards by `nodeId`, not just the anchor question.

**Primary recommendation:** Build in six focused waves: credits service + header counter, status panel (counts only), bottom sheet component, action wiring (heal/re-plant/prune), harvest animation, and suggested moves refactor + cleanup.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.x | Component tree, state | Project-wide |
| lucide-react | (existing) | Icons for panel columns | Already used throughout |
| CSS keyframes (inline `<style>`) | — | Confetti, scissors, fly-to animation | Project pattern (no animation lib imported) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Framer Motion | (existing in project — check package.json) | Optional: scissors prune animation | Only if simpler CSS keyframe approach is insufficient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS keyframes for scissors | Framer Motion `animate` | Framer Motion adds expressiveness but is heavier; CSS suffices for a 2-step rotate+fall |
| Inline `<style>` for animations | Tailwind animation classes | Project convention is inline styles — Tailwind avoided |

**Installation:** No new packages needed. All dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure (new files)

```
src/
├── services/
│   └── trellis-credits.service.ts   — fruit credit CRUD (localStorage)
├── components/
│   ├── trellis/
│   │   ├── TrellisStatusPanel.tsx   — 3-column row (counts + glow)
│   │   └── TrellisBottomSheet.tsx   — slide-up node list + actions
│   └── ui/
│       └── BottomSheet.tsx          — reusable bottom sheet container
```

### Pattern 1: Credits Service (localStorage, single key)

**What:** New service wrapping a single localStorage key `trellis_fruit_credits` that stores an integer total.
**When to use:** Called only from harvest action — increment by count of harvested fruits. Also read by header counter.

```typescript
// src/services/trellis-credits.service.ts
const CREDITS_KEY = 'trellis_fruit_credits';

export const trellisCreditsService = {
  getTotal(): number {
    try { return parseInt(localStorage.getItem(CREDITS_KEY) ?? '0', 10) || 0; }
    catch { return 0; }
  },
  add(count: number): number {
    const next = this.getTotal() + count;
    localStorage.setItem(CREDITS_KEY, String(next));
    return next;
  },
};
```

### Pattern 2: Harvest Action

**What:** Harvesting clears blossom dates for each fruit node AND calls `clearBlossomDate(anchorId)`. `useTrellisData` recomputes on the `HARVEST_COMPLETED` event and re-renders nodes as green.
**Key insight:** `buildTrellisState` reads `getBlossomDates()` synchronously. After clearing blossom dates, calling `useTrellisData.refresh()` will recompute node states from scratch — fruit nodes become `green` because `blossomSinceDate` is now undefined.

```typescript
// In harvest handler (PlannerScreen or TrellisStatusPanel)
function handleHarvest(fruitNodes: TrellisAnchorNode[]) {
  fruitNodes.forEach(n => clearBlossomDate(n.anchor.id));
  const earned = trellisCreditsService.add(fruitNodes.length);
  setCredits(earned);
  eventBus.emit({ type: 'HARVEST_COMPLETED', payload: { count: fruitNodes.length } });
  // trigger layout animation, then confetti
}
```

New `AppEvent` entry needed: `{ type: 'HARVEST_COMPLETED'; payload: { count: number } }`.
`useTrellisData` must subscribe to `HARVEST_COMPLETED` and call `recompute()`.

### Pattern 3: Pruning (Soft Delete via `flagged` field)

**What:** Pruning sets `flagged: true` on the anchor question. `loadStore` in question.service.ts already filters out flagged questions (`questions.filter((q) => !q.flagged)`) so they disappear from all normal queries including `buildTrellisState`. A separate "Pruned section" reads with `includeFlagged: true` to show archived nodes.
**Critical:** `questionService.patchQuestion(anchorId, { flagged: true })` is the only write needed. No new storage layer required.

After pruning, emit `ANCHOR_DELETED` (already subscribed by `useTrellisData`):
```typescript
questionService.patchQuestion(anchorId, { flagged: true });
eventBus.emit({ type: 'ANCHOR_DELETED', payload: { anchorId } });
```

**Pruned section:** Reads `questionService.loadStore({ includeFlagged: true }).filter(q => q.flagged)` — but `loadStore` is private. Options: (a) expose a `getPruned()` method on `questionService`, or (b) use `getAll()` which already filters and add `getPrunedQuestions()` that reads raw localStorage. Option (a) is cleaner.

### Pattern 4: Re-plant (Reset SM-2 Schedule)

**What:** Dead node re-plant resets the review schedule for ALL flashcards linked to that anchor, not just the anchor question itself. The `flashcardService.getAll()` already stores `nodeId` on each card — filter by `nodeId === anchor.id` and reset each card's schedule to `{ nextReviewDate: today(), reviewCount: 0, easeFactor: 2.5 }`.

```typescript
// Reset all flashcards for this anchor
const allCards = flashcardService.getAll();
const anchorCards = allCards.filter(c => c.nodeId === anchorId);
anchorCards.forEach(c => {
  flashcardService.updateReviewSchedule(c.id, {
    nextReviewDate: today(),
    reviewCount: 0,
    easeFactor: 2.5,
  });
});
// Also reset on the anchor question itself
questionService.patchQuestion(anchorId, {
  reviewSchedule: { nextReviewDate: today(), reviewCount: 0, easeFactor: 2.5 },
  lastReviewedAt: undefined,
});
// Then generate post (concept-feed.service) and navigate to review
```

After reset, `computeLeafState` will re-evaluate to `bud` (reviewCount=0, no lastReviewedAt). This is correct — re-planting starts the lifecycle fresh.

### Pattern 5: Heal (Parallel Review + Podcast Queue)

**What:** Heal triggers two operations simultaneously:
1. Navigate to `/review` with anchor filter (existing pattern via `location.state`)
2. Call `podcastService.addConceptToPodcast(today(), anchorId)` to add to today's podcast queue

```typescript
// Heal action
podcastService.addConceptToPodcast(today(), dyingNode.anchor.id);
navigate('/review', {
  state: { anchorFilter: { anchorId: dyingNode.anchor.id, anchorName: displayName } }
});
```

`podcastService.addConceptToPodcast` already handles the case where no podcast exists today (returns `false`) — treat as non-fatal.

`ReviewScreen` already supports `anchorFilteredItems` via location.state (Phase 15-03). Verify that `anchorId` is the correct key name in the state object used by ReviewScreen.

### Pattern 6: Bottom Sheet Component

**What:** No existing BottomSheet component. Need to build one. Pattern: fixed overlay with pointer-events, animated slide-up panel using CSS transform (no Framer Motion needed — simple `translate Y 100% → 0`).

```typescript
// BottomSheet.tsx
export function BottomSheet({ open, onClose, children }: BottomSheetProps) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        backgroundColor: open ? 'rgba(0,0,0,0.45)' : 'transparent',
        pointerEvents: open ? 'auto' : 'none',
        transition: 'background-color 0.25s',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: 'var(--surface)',
          borderRadius: '20px 20px 0 0',
          padding: '20px 16px 40px',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          maxHeight: '75vh',
          overflowY: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  );
}
```

### Pattern 7: Suggested Moves Refactor

**What:** `PlannerScreen` currently renders two sources: `autoMoves` (from `usePlannerAutoGen`) and `suggestedChunks` (from `usePlanner`). Post-refactor: only `autoMoves` remain as non-trellis source; trellis health drives a new "trellis moves" section.

The refactor involves:
1. Remove `usePlanner` import and all `suggestedChunks` usage from `PlannerScreen`.
2. Remove `ChunkCard` component.
3. Remove `handleRegenerateChunk`, `handleSkipAll`'s `suggestedChunks.forEach(...)` part.
4. Build `useTrellisActionMoves` hook that derives `TrellisMove[]` from `useTrellisData().layout.nodes`.
5. Filter autoGen moves: skip moves where `conceptId` matches any dying/dead anchor id.
6. Render trellis moves first (dead → dying order), then filtered autoGen.

**TrellisMove interface:**
```typescript
interface TrellisMove {
  anchorId: string;
  anchorName: string;
  state: 'fallen' | 'falling' | 'yellow'; // dead | dying
  action: 'replant' | 'heal';
}
```

### Anti-Patterns to Avoid

- **Creating new flashcards on re-plant:** D-13 explicitly forbids generating new flashcards. Use existing cards filtered by `nodeId`.
- **Per-fruit confetti bursts:** D-03 requires a single unified confetti burst for batch harvest. Do not call confetti once per fruit.
- **Setting `ref.current` during render for animation:** Per ESLint config, use `useEffect` to sync animation state.
- **Calling `questionService.getAll()` inside bottom sheet render:** Derive all data from `useTrellisData().layout.nodes` at the panel level, pass down as props.
- **Using Tailwind classes:** Project uses inline styles + CSS variables exclusively.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Credit persistence | Custom store | `trellis-credits.service.ts` wrapping localStorage | Single key, integer — simplest possible |
| Pruning storage | New archive table/key | `question.flagged = true` + `questionService.patchQuestion` | `loadStore` already filters flagged; just need `getPrunedQuestions()` |
| SM-2 reset | Custom schedule calculation | `flashcardService.updateReviewSchedule(id, defaultSchedule())` | Service already handles this |
| Blossom date clear | Manual localStorage manipulation | `clearBlossomDate(anchorId)` from trellis-blossom-dates.service.ts | Already handles the key |
| Trellis recompute after harvest | Manual state mutation | `eventBus.emit(HARVEST_COMPLETED)` → `useTrellisData` recompute | Existing subscription pattern |
| Podcast queue add | Direct podcast store manipulation | `podcastService.addConceptToPodcast(today(), anchorId)` | Already implemented with event emission |
| Post generation for re-plant | New LLM call | `conceptFeedService.generateMorePosts([anchorQuestion])` | Existing post gen pipeline |
| Node count derivation | Separate state | Filter `useTrellisData().layout.nodes` by leafState | Already computed in hook |
| Slide-up animation | Framer Motion | CSS `transform: translateY` + `transition` | No new deps, matches project pattern |
| Event subscription for credits | React Context | `eventBus.subscribe('HARVEST_COMPLETED', ...)` in `useEffect` | Consistent with all other event subs |

---

## Common Pitfalls

### Pitfall 1: Harvest Does Not Trigger Trellis Recompute
**What goes wrong:** After harvesting, fruit nodes remain fruit-colored because `useTrellisData` doesn't know to recompute.
**Why it happens:** `useTrellisData` only subscribes to `REVIEW_COMPLETED`, `CLASSIFICATION_COMPLETED`, and `ANCHOR_DELETED`. Harvest clears blossom dates but emits no recognized event.
**How to avoid:** Add `HARVEST_COMPLETED` to `AppEvent` union in `types/index.ts`. Add subscription in `useTrellisData` useEffect. Emit it from the harvest action.
**Warning signs:** Fruit icon still shows after "Harvest all" without page reload.

### Pitfall 2: Re-plant Resets Anchor Question But Not Its Flashcards
**What goes wrong:** Node still appears yellow/dead because `computeLeafState` uses `fcMap` (flashcard reviewSchedule) as authoritative source, not `anchor.reviewSchedule`.
**Why it happens:** Phase 25 decision: "Leaf state reads FlashCard review data as authoritative source — Question.reviewSchedule is never updated by the review flow."
**How to avoid:** Must reset ALL flashcards with `nodeId === anchor.id` via `flashcardService.updateReviewSchedule`. Also reset the anchor's `reviewSchedule` and `lastReviewedAt` via `questionService.patchQuestion` for belt-and-suspenders.
**Warning signs:** Node still shows 'fallen' state after re-plant action.

### Pitfall 3: `suggestedChunks` Still Referenced After Removal
**What goes wrong:** TypeScript compile errors or runtime crashes because `usePlanner` and `ChunkCard` are still referenced.
**Why it happens:** D-22 requires removing suggestedChunks entirely but the hook is used in 3 places in PlannerScreen.
**How to avoid:** Full removal checklist — `usePlanner` import, `suggestedChunks` destructure, `ChunkCard` component, `handleRegenerateChunk` function, `totalSuggestions` calculation (now only autoMoves.length + trellisActionMoves.length), `handleSkipAll` suggestedChunks.forEach call.
**Warning signs:** TypeScript `noUnusedLocals` error on `isLoading` (leftover from usePlanner).

### Pitfall 4: Pruned Nodes Reappear After App Reload
**What goes wrong:** Pruned nodes come back because `questionService.getAll()` is called somewhere that reads with `includeFlagged: true`, or because SQLite hydration overwrites the flagged=true state.
**Why it happens:** `hydrateFromSQLite` in question.service.ts uses `existingIds` to skip existing records, but if the SQLite version predates the prune, the old unflagged record could overwrite.
**How to avoid:** When pruning, also call `persistToSQLite` (or ensure `patchQuestion` does). The existing `patchQuestion` flow should already handle this since it saves to localStorage and SQLite.
**Warning signs:** Pruned nodes reappear in trellis after app reload.

### Pitfall 5: Bottom Sheet Z-Index Conflicts
**What goes wrong:** Bottom sheet appears behind the fixed `<Header>` (z-index 190) or TrellisHero SVG.
**Why it happens:** Header has `zIndex: 190`. Bottom sheet backdrop needs `zIndex: 500+`.
**How to avoid:** Set bottom sheet container `zIndex: 500`, panel `zIndex: 501`. Confetti uses `zIndex: 9000` — that's fine, confetti should be on top of everything.
**Warning signs:** Partially obscured bottom sheet on first open.

### Pitfall 6: Fly-to-Counter Animation Coordinates
**What goes wrong:** Fruit particles fly to wrong position because header counter position is calculated incorrectly (fixed header, but getBoundingClientRect needs to account for safe-area-top).
**Why it happens:** `var(--safe-area-top)` offsets the header position on iOS. `getBoundingClientRect` returns values relative to viewport, which should be correct — but the counter element must be rendered and mounted before harvest is triggered.
**How to avoid:** Use a `counterRef` on the fruit counter element. Read its `getBoundingClientRect()` at harvest time (not during render). Animate particle positions from trellis viewBox coordinates to counter coordinates.
**Warning signs:** Particles fly off-screen or land in wrong location.

### Pitfall 7: AutoGen Dedup Filter Runs Before Trellis Layout Is Ready
**What goes wrong:** On first mount, `useTrellisData` hasn't recomputed yet (async question load), so no dying/dead nodes are found, and autoGen moves for those nodes slip through.
**Why it happens:** `useTrellisData` starts with `{ nodes: [], vines: [] }` and recomputes on first effect.
**How to avoid:** Derive the dedup filter inside the render function from `layout.nodes` directly — it will be re-derived on every render. When layout nodes update, the component re-renders and the filtered list is correct.
**Warning signs:** Duplicate entries in Suggested Moves (same anchor in both trellis moves and autoGen moves).

---

## Code Examples

### Deriving Status Counts from Layout

```typescript
// Source: trellis-state.service.ts — LeafState type
import type { TrellisAnchorNode } from '../services/trellis-state.service';

function getStatusCounts(nodes: TrellisAnchorNode[]) {
  const fruit   = nodes.filter(n => n.leafState === 'fruit');
  const dying   = nodes.filter(n => n.leafState === 'yellow' || n.leafState === 'falling');
  const dead    = nodes.filter(n => n.leafState === 'fallen');
  return { fruit, dying, dead };
}
```

### AutoGen Dedup Filter

```typescript
// Filter autoGen moves to exclude nodes already in dying/dead trellis actions
const dyingDeadIds = new Set(
  layout.nodes
    .filter(n => n.leafState === 'fallen' || n.leafState === 'falling' || n.leafState === 'yellow')
    .map(n => n.anchor.id)
);

const filteredAutoMoves = autoMoves.filter(
  move => !dyingDeadIds.has(move.conceptId)
);
```

### Fruit Counter in Header (PlannerScreen)

```typescript
// Pass right prop to <Header> — already has right?: ReactNode slot
<Header
  title="Planner"
  right={
    <div style={{
      display: 'flex', alignItems: 'center', gap: '4px',
      padding: '4px 10px', borderRadius: '20px',
      backgroundColor: credits > 0 ? 'rgba(255,200,0,0.15)' : 'var(--surface-variant)',
      border: '1px solid var(--border)',
      fontSize: '0.82rem', fontWeight: 600,
    }}>
      <Cherry size={14} />
      <span ref={counterRef}>{credits}</span>
    </div>
  }
/>
```

The `Header` component already has a `right?: ReactNode` prop — no changes to Header needed.

### Confetti Reuse Pattern

```typescript
// Confetti component accepts { active: boolean }.
// For harvest: set active=true after animation completes, reset after 3s.
const [showConfetti, setShowConfetti] = useState(false);

function triggerHarvestCelebration() {
  // 1. Start fly-to-counter animation
  // 2. After 1.2s, trigger confetti burst
  setTimeout(() => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3500);
  }, 1200);
}

// In JSX:
<Confetti active={showConfetti} />
```

The existing `Confetti` component generates 55 particles and self-resets when `active` goes false. No changes needed unless colors should match fruit theme — in that case, add optional `colors` prop.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `suggestedChunks` from check-in signals | Trellis-health-driven moves (D-19..23) | Phase 26 | Removes `usePlanner`, `ChunkCard`, `plannerService.submitCheckIn` UI surface |
| Suggested Moves = autoGen only | Suggested Moves = trellis dead/dying + autoGen | Phase 26 | Triage-first ordering; unhealthy garden always surfaces |

**Deprecated/outdated:**
- `usePlanner` hook: still exists, but no longer used in PlannerScreen after D-22.
- `ChunkCard` component in PlannerScreen: removed per D-22.
- `totalSuggestions = autoMoves.length + suggestedChunks.length`: replaced with `autoMoves.length + trellisActionMoves.length`.
- `handleSkipAll`'s `suggestedChunks.forEach(chunk => deleteChunk(chunk.id))`: removed.

---

## Open Questions

1. **Does ReviewScreen accept `anchorId` in location.state for heal filtering?**
   - What we know: ReviewScreen supports `anchorFilteredItems` via `clusterReview` and `moveFilteredItems` (Phase 15-03). The state key for anchor-specific filtering may differ.
   - What's unclear: Exact state shape ReviewScreen expects for "filter by anchor" (not cluster, not move).
   - Recommendation: Read ReviewScreen.tsx before planning Wave 3 (heal action) to confirm state key and add if missing.

2. **How does `conceptFeedService.generateMorePosts` accept a single anchor question?**
   - What we know: `generateMorePosts(questions: Question[])` takes an array. Passing `[anchorQuestion]` should work.
   - What's unclear: Whether it generates a new post or deduplicates against cached posts.
   - Recommendation: For re-plant, force-generate a fresh post (not from cache) so the node gets new content. May need a `forceNew: true` flag or use a different entry point.

3. **Does `questionService` expose a `getPrunedQuestions()` or will a new method be needed?**
   - What we know: `loadStore` is private. `getAll()` filters out flagged. There is no `getPrunedQuestions()` currently.
   - What's unclear: Whether to add it to `questionService` or read localStorage directly.
   - Recommendation: Add `getPrunedQuestions(): Question[]` to `questionService` that calls `loadStore({ includeFlagged: true }).filter(q => q.flagged)`.

4. **Should `HARVEST_COMPLETED` or `ANCHOR_DELETED` be emitted after prune to trigger recompute?**
   - What we know: `useTrellisData` subscribes to `ANCHOR_DELETED`. The anchor isn't deleted — it's archived (flagged=true).
   - What's unclear: Whether re-using `ANCHOR_DELETED` for prune is semantically correct or misleading.
   - Recommendation: Emit `ANCHOR_DELETED` for prune (the effect is the same from trellis's POV — node disappears). This avoids adding another event type.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified — all code/config changes to existing in-project services and components)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in test runner with esbuild tsx loader (Phase 25-02 pattern) |
| Config file | none — loader registered via `--import` flag |
| Quick run command | `node --test --experimental-vm-modules --import tsx/esm app/tests/trellis-credits.test.ts` |
| Full suite command | `node --test --experimental-vm-modules --import tsx/esm app/tests/**/*.test.ts` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HARVEST-01 | `trellisCreditsService.add(3)` returns 3, persists to localStorage | unit | `node --test ... app/tests/trellis-credits.test.ts` | No — Wave 0 |
| HARVEST-02 | `clearBlossomDate` for each fruit node removes entry from storage | unit | `node --test ... app/tests/trellis-blossom-dates.test.ts` | No — Wave 0 |
| PRUNE-01 | `questionService.patchQuestion(id, { flagged: true })` hides from `getAll()` | unit | `node --test ... app/tests/question-prune.test.ts` | No — Wave 0 |
| REPLANT-01 | After schedule reset, `computeLeafState` returns `bud` | unit | `node --test ... app/tests/trellis-state.test.ts` | No — Wave 0 |
| DEDUP-01 | AutoGen dedup filter removes moves for dying/dead anchor IDs | unit | `node --test ... app/tests/trellis-dedup.test.ts` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test ... app/tests/trellis-credits.test.ts` (whichever test covers the change)
- **Per wave merge:** All trellis-related tests
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `app/tests/trellis-credits.test.ts` — covers HARVEST-01
- [ ] `app/tests/trellis-state-replant.test.ts` — covers REPLANT-01 (computeLeafState returns bud after schedule reset)
- [ ] `app/tests/trellis-dedup.test.ts` — covers DEDUP-01 (autoGen filter)

*(UI animation tests are manual-only — no automated command)*

---

## Sources

### Primary (HIGH confidence)
- Direct code read of `trellis-state.service.ts` — LeafState, computeLeafState, buildTrellisState, blossom date logic
- Direct code read of `useTrellisData.ts` — event subscriptions, recompute pattern
- Direct code read of `trellis-blossom-dates.service.ts` — clearBlossomDate API
- Direct code read of `flashcard.service.ts` — getAll(), updateReviewSchedule(), nodeId field
- Direct code read of `podcast.service.ts` — addConceptToPodcast() API
- Direct code read of `question.service.ts` — flagged field, loadStore({includeFlagged}), patchQuestion
- Direct code read of `Header.tsx` — right?: ReactNode slot confirmed present
- Direct code read of `Confetti.tsx` — active prop, 55 particles, self-clears on active=false
- Direct code read of `PlannerScreen.tsx` — current structure, suggestedChunks usage, autoMoves rendering
- Direct code read of `usePlanner.ts` — suggestedChunks source (plannerService.getSuggestedChunks)
- Direct code read of `plannerAutoGen.service.ts` — getMoves(), conceptId field
- Direct code read of `types/index.ts` — AppEvent union, Question.flagged, PlannedMove.conceptId
- Direct code read of `review.service.ts` — submitReview, REVIEW_COMPLETED event with anchorId

### Secondary (MEDIUM confidence)
- Phase 25 STATE.md decisions re: leaf state reading FlashCard data as authoritative source
- Phase 25 CONTEXT.md D-07..D-09 (trellis leaf states: fallen=dead, falling+yellow=dying, fruit=harvestable)

### Tertiary (LOW confidence)
- None

---

## Project Constraints (from CLAUDE.md)

No CLAUDE.md found at `/Users/Code/EchoLearn/CLAUDE.md`. Constraints sourced from MEMORY.md:

- **Inline styles with CSS variables** — no Tailwind classes for layout/color
- **Key CSS vars:** `--primary-40`, `--surface`, `--surface-variant`, `--muted-foreground`, `--radius-xl`, `--shadow-1/2/3`, `--border`
- **Node colors:** `--node-mint`, `--node-salmon`, `--node-lilac`, `--node-peach`, `--node-sky`
- **ESLint:** `react-hooks/refs` — do NOT set `ref.current` during render, use `useEffect`
- **All services return `ServiceResult<T>`** pattern
- **EventBus pattern** for cross-component reactivity (not React Context for events)
- **localStorage** primary persistence (no new SQLite tables needed for this phase)
- **`ServiceResult<T>`** for all service method returns

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing libraries, no new deps
- Architecture: HIGH — all integration points verified by direct code read
- Pitfalls: HIGH — derived from actual code paths (flagged filter, fcMap authoritative source, event subscription list)
- Animation patterns: MEDIUM — CSS keyframe approach is standard but exact coordinates for fly-to-counter are runtime-dependent

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable codebase, no external API dependencies)

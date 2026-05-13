---
phase: 42-masonry-feed-layout
status: ready-for-planning
researched: 2026-05-09
domain: React UI layout (2-column masonry) + framer-motion v12 entrance animations + celebration card with trellis-actions consumption
confidence: HIGH
requirements: [MASONRY-01, MASONRY-02]
---

# Phase 42: Masonry Feed Layout — Research

**Researched:** 2026-05-09
**Domain:** React UI layout (2-column masonry) + framer-motion v12 entrance animations + celebration card with trellis-actions consumption
**Confidence:** HIGH

> Scope contract: this RESEARCH.md does NOT re-litigate UI decisions already nailed in 42-UI-SPEC.md (visual composition, framer-motion `Variants` shapes, SVG geometry, exact spacing/typography tokens, 12 EN i18n keys). It addresses the 8 specific research questions listed in the spawn prompt: trellis-actions surface mapping, GAP-C tap-detector preservation, scroll preservation, framer-motion v12 specifics + reduced-motion gotcha, masonry edge cases (resize / async height mutation), i18n parity workflow, source-reading test patterns, and the ROADMAP/REQUIREMENTS wording correction.

---

## Summary

Phase 42 is a layout-and-animation phase. The biggest correctness risks are not in the masonry math (UI-SPEC nails it) but in **(a)** assuming framer-motion auto-respects `prefers-reduced-motion` (it does NOT — verified against motion.dev/docs/react-accessibility), **(b)** the celebration card's data source (`trellisActionsService` does NOT today expose a "get celebration suggestions" getter — it only owns navigation result construction; the suggestion list derives from `useTrellisData()`'s `leafState` filter, the same way PlannerScreen builds it), and **(c)** the `infiniteScrollService.allExplored` reference in CONTEXT.md/UI-SPEC, which does NOT exist as service state today (`allExplored` is a local `const` inside `concept-feed.service.ts:1591`). VineBloomCard must compute `allExplored` itself from `dailyReadService.getExploredAnchors()` + `useQuestions()` anchors.

GAP-C tap detectors are **safe across the swap** because every detector lives inside the leaf card render code (`MemoizedConceptCard` / `ConnectionCard` / `MilestoneCard` in InfoFlow.tsx, plus the video thumbnail `onClick` at `InfoFlow.tsx:858`-area). MasonryFeed is layout-only; child cards are reused verbatim. The single attention point is that the **video thumbnail tap-emit lives inside the items.map render in `InlineInfoFlow`** (lines 842-886, see `dailyReadService.markExplored` reference at line 28 of InfoFlow.video-tap-emit.test.mjs) — when MasonryFeed reproduces this items.map shape, the thumbnail onClick handler chain MUST be ported verbatim. The existing test guards exactly-once emits in `InfoFlow.tsx`; planner must update the test scope (or add a parallel test) to cover MasonryFeed.tsx.

Scroll preservation across `/home → /posts/:id → back` is automatic via `SwipeTabContainer`'s always-mounted slot architecture — verified by inspection of HomeScreen at `app/src/screens/HomeScreen.tsx:467-522` (the `[location.pathname === '/home']` resync effect pattern is the canonical way to handle service state mutation while always-mounted). MasonryFeed is a child of HomeScreen's existing scroll container; it inherits this for free. SC-3 needs no new code, just a behavioral test (scroll-survival) the planner can spec.

ROADMAP line 1145 (SC-1) and REQUIREMENTS.md line 11 (MASONRY-01) BOTH literally assert `column-count: 2` + `break-inside: avoid` — this contradicts D-02's height-accumulating split. The wording correction is a 2-file 2-line edit (verified line numbers below). It MUST land inside Phase 42's commits or the verifier's source-reading test for SC-1 will fail.

**Primary recommendation:** Plan around 5-7 atomic commits — (1) MasonryFeed.tsx skeleton + algorithm + GAP-C verbatim port, (2) HomeScreen swap + toast deletion, (3) `card-slide-in` keyframe + 3 callsites removal, (4) VineBloomCard + i18n bundle parity, (5) source-reading invariant tests, (6) ROADMAP/REQUIREMENTS wording correction, (7) close-out. VineBloomCard consumes `useTrellisData()` directly (NOT a new trellisActionsService getter) and computes `allExplored` itself from `dailyReadService.getExploredAnchors()`.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Component shape & boundary**

- **D-01:** **New `app/src/components/MasonryFeed.tsx` replaces `InlineInfoFlow` at `/home`.** `InlineInfoFlow` stays in `InfoFlow.tsx` for non-masonry consumers but is no longer wired at `/home`. Mild duplication of the items.map skeleton (~30 LOC) is acceptable. Sibling to `InfoFlow.tsx` in `components/`.

**Card-flow ordering**

- **D-02:** **Height-accumulating 2-column split** (NOT CSS `column-count`).
  - Two height accumulators via `useRef<number[]>([0, 0])` + `useLayoutEffect` measurement pass.
  - Each new tile drops into whichever column is currently shorter at assignment time.
  - Once assigned, a tile's column is **immutable** — never moves on re-render or refill.
  - Tie-breaker (both columns exactly equal): default to column-A (left).
  - `items[]` arrives in existing `concept-feed` mixer order.
  - **ROADMAP SC-1 wording adjustment:** "column-count: 2 + break-inside: avoid" wording will be relaxed to "2-column masonry layout via height-accumulating split" — mechanical adjustment, not scope change. RESEARCH/planning must update ROADMAP entry alongside implementation.

**Framer-motion entrance pattern**

- **D-03:** **`<motion.div>` on leaf tiles only** — NOT on the scroll container, NOT on `MasonryFeed`'s root, NOT on column wrappers.
- **D-04:** **Animation fires only on newly-appended tiles** via existing `newPostIds` Set.
- **D-05:** **Timing: 250ms duration, 40ms stagger, ease-out.** Fade-up from `translateY(8px)` + opacity 0 → 1.
- **D-06:** **Drop the existing `card-slide-in` CSS keyframe** from `InfoFlow.tsx` entirely.

**Vine-bloom celebration card**

- **D-07:** **Visual: inline SVG vine illustration with bloom.** ~30 LOC, matching `vineLoadingPulse` SVG aesthetic. framer-motion path animation may draw vine on mount.
- **D-08:** **Suggested-tomorrow plan content: pull from `trellisActionsService`.** Reuse Phase 26 service. 1-2 concrete next-day actions, tappable, route to `/planner` or `/posts/anchor-post-{id}`.
- **D-09:** **Fallback when `trellisActionsService` returns no suggestions:** static copy + anchor count from `dailyReadService.getExploredAnchors().size` and SM-2 due-tomorrow count. Fully i18n-able.
- **D-10:** **Placement: bottom of feed as the LAST tile, full-width spanning BOTH columns** when `allExplored` is true.
- **D-11:** **Delete `toast(t('home.toast.noMorePosts'), 'info')` at `HomeScreen.tsx:240` entirely.** `handleLoad`'s `else` branch becomes a no-op or sets a state flag.

### Claude's Discretion

- Exact stagger timing curve nuances (within 250ms / 40ms / ease-out band).
- SVG vine path geometry, viewport size, color tokens.
- Masonry inter-tile gap value (recommend 12px to match existing).
- Column wrapper layout primitive (recommend flex over grid).
- Tile measurement strategy (recommend `useLayoutEffect` initial; `ResizeObserver` only if UAT shows desync).
- Test file naming (planner can collapse).
- Whether celebration card gets a different (showier) entrance animation.
- Whether `home.toast.noMorePosts` i18n key is deleted from all 4 bundles (recommend yes after grep confirms no other consumer).
- Whether `InlineInfoFlow` remains exported (recommend yes).

### Deferred Ideas (OUT OF SCOPE)

**Phase 43 owns:**
- "Deep dive" button on PostDetailScreen
- Long-press contextual menu
- Saved-posts view route
- `engagementService.reset()` in Force-New-Day
- "N connections in your graph" micro-label
- HomeScreen `ANCHOR_DISMISSED` re-sync effect

**Deferred to v1.5.x backlog or later:**
- Per-style tile height buckets
- Loading skeleton tiles during refill
- Pull-to-refresh gesture
- Responsive 1-column collapse on very narrow viewports
- Celebration card showier animation

**Outside v1.5 entirely:**
- `@tanstack/react-virtual` / react-window virtualization
- Drag-and-reorder of feed tiles
- Per-tile context menu
- CSS Grid Masonry (`grid-template-rows: masonry`)
- Animation-richer celebration moments (confetti, gold bar)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **MASONRY-01** | Feed renders as a 2-column masonry layout via CSS `column-count: 2` + `break-inside: avoid`; cards never split across columns | **Wording must be corrected** to "2-column masonry layout via height-accumulating split (no card splits across columns by construction — once assigned, a tile is rendered atomically inside one column flex-list)." Research § 8 (Wording Correction Plan) gives exact line numbers + recommended replacement text. The functional contract is identical: 2 columns, no card splits across columns. |
| **MASONRY-02** | End-of-content state replaces "no more posts" toast with a vine-bloom celebration card and suggested-tomorrow plan when all anchors are explored | Research § 1 (trellis-actions surface) + § 5 (`allExplored` is NOT service state today; VineBloomCard must compute it itself from `dailyReadService.getExploredAnchors()` + `useQuestions().questions.filter(q => q.isAnchorNode)`). UI-SPEC's vine-bloom card visual + 12 i18n keys + framer-motion variants are all already nailed; planner consumes verbatim. |

---

## Project Constraints (from CLAUDE.md)

These directives carry the same authority as locked CONTEXT.md decisions. Research recommendations MUST NOT contradict them.

| Directive | Source section | Phase 42 implication |
|-----------|----------------|----------------------|
| Inline styles with CSS variables (NOT Tailwind classes for most UI) | "Style Conventions" | MasonryFeed + VineBloomCard use inline styles + `var(--*)` tokens. UI-SPEC already follows this. |
| Services return `ServiceResult<T>` | "Style Conventions" | N/A — Phase 42 doesn't add new service surface (recommendation §1: VineBloomCard consumes existing `useTrellisData` hook directly, no new service). |
| Settings sub-page navigation pattern | "Style Conventions" | N/A — Phase 42 touches HomeScreen + InfoFlow only. |
| **Header positioning load-bearing rule:** No `transform`/`will-change`/`filter`/`contain`/`perspective` on any ancestor of `Header` in the React tree | "Header positioning (Phase 32.1)" | **MasonryFeed root + column wrappers MUST NOT introduce these CSS properties.** The framer-motion `<motion.div>` lives on **leaf tiles only** (D-03), which sit inside the column wrappers — leaf-level transform doesn't affect Header containing block. |
| **Concept Feed Pipeline:** Daily list → derived list (append-only, weighted) → queue (cyclic) | "Concept Feed Generation Pipeline" | N/A — Phase 42 is layout-only. Mixer order (`spreadByConcept` then `spreadByStyle`) preserved at interleave level. Height-accumulation only chooses column for pre-mixed items. |
| **Always-mounted screens must explicitly re-read service state on navigation** via `[location.pathname]` effect | "Always-mounted screens..." | HomeScreen already implements this for `dailyReadService` at `HomeScreen.tsx:467-522`. MasonryFeed inherits it (it's a child, not a sibling). No new code required for SC-3 scroll preservation OR for celebration card's data freshness — the celebration consumes `useTrellisData()` which already subscribes to `GRAPH_UPDATED`/`REVIEW_COMPLETED`/`ANCHOR_DELETED`/`HARVEST_COMPLETED`. |
| **Video post completion signals (Phase 36 GAP-C, generalized in Phase 38) — load-bearing** | "Video post completion signals" | The thumbnail-tap inline-play emit at `InfoFlow.tsx` (around line 858 area, inside `MemoizedConceptCard` thumbnail onClick) is load-bearing. **MasonryFeed reuses `MemoizedConceptCard` verbatim** — the emit travels with the component. The `InfoFlow.video-tap-emit.test.mjs` test reads `app/src/components/InfoFlow.tsx` source — it stays valid because the emit site stays in InfoFlow.tsx (inside the reused card). NOT moved into MasonryFeed.tsx. See § 2 below. |
| `position: fixed` + `overflow: auto` + Android WebView is a recurring bug class | "Best practices learned in Phase 32.1 rule 3" | MasonryFeed column wrappers MUST NOT use `position: fixed`. Plain `display: flex` per column wrapper is the correct primitive. UI-SPEC § Layout Algorithm already specifies this. |
| **i18n EN-first workflow:** all 4 bundles update together; bundle-parity test enforces | "i18n Workflow" | New `home.celebration.*` namespace (12 keys) + 1 deletion (`home.toast.noMorePosts`) lands in all 4 bundles in same commit. Sonnet subagent script at `app/scripts/translate-locales.md`. See § 6 below. |
| **Anti-wire / source-reading invariant pattern** (Phase 27/35/37/39/40/41) | Project pattern history | Phase 42 expects 4-7 atomic commits with paired source-reading + behavioral tests. UI-SPEC pre-enumerates 8 invariants. See § 7 for canonical test patterns. |
| **No new event types** when an existing one suffices | "Best practices Phase 32.1 rule 6" | Phase 42 introduces zero new events. Vine-bloom triggers off existing `dailyReadService.getExploredAnchors()` + computed `allExplored`. |

---

## Standard Stack

### Core (already installed; Phase 42 introduces ZERO new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19.2.0 | UI runtime | Existing project standard |
| react-dom | 19.2.0 | DOM renderer | Existing project standard |
| framer-motion | **12.38.0** (verified `app/node_modules/framer-motion/package.json`) | `<motion.div>`, `Variants`, `staggerChildren`, `<motion.circle>`, `useReducedMotion` | Already used in PostCarousel, TrellisCanvas, TrellisLeaf, SwipeTabContainer, BottomNavigation, PageTransition. v12 is current at time of research. |
| lucide-react | 0.575.0 | Icons (`Heart`, `Sprout` for celebration action rows; matches PlannerScreen convention) | Existing project standard |
| react-i18next | 17.0.3 | `useTranslation`/`t()` for celebration card copy | Existing project standard |

### Supporting (existing project utilities consumed)

| Module | Purpose | When to Use |
|--------|---------|-------------|
| `app/src/services/daily-read.service.ts` | `getExploredAnchors()` — celebration `allExplored` computation + fallback anchor count | VineBloomCard reads on render |
| `app/src/services/trellis-actions.service.ts` | `heal()`, `replant()` action handlers (return `ActionNavigationResult`) | VineBloomCard action row onClick handlers |
| `app/src/state/useTrellisData.ts` | `useTrellisData()` hook returns `{ layout, refresh }`; `layout.nodes` carries `leafState` per anchor — celebration card filters dying/dead anchors, same way PlannerScreen does | VineBloomCard consumes for suggestion derivation |
| `app/src/state/useQuestions.ts` | `useQuestions()` provides `questions` array — used to filter anchor nodes for `allExplored` computation | VineBloomCard or HomeScreen-level computation |
| `app/src/lib/event-bus.ts` | Existing `eventBus` — Phase 42 adds NO new emits or subscribes (D-08 reuses existing GRAPH_UPDATED via useTrellisData; CONCEPT_EXPLORED handled inside reused MemoizedConceptCard via GAP-C emit) | N/A |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Why rejected |
|------------|-----------|----------|--------------|
| Height-accumulating JS split | CSS `column-count: 2` + `break-inside: avoid` | ~5 LOC of CSS, zero JS | Existing tiles SHUFFLE between columns when new ones append (browser re-balances). Bad UX. (CONTEXT.md D-02 + Discussion-Log Q1 selected option 4.) |
| Height-accumulating JS split | Parity-based `items[i % 2]` | ~5 LOC of JS, zero state | Tall tiles bunching on one parity desyncs columns visually. (CONTEXT.md D-02.) |
| `useLayoutEffect` measurement | `ResizeObserver` per tile | Handles async height mutations | Recommend `useLayoutEffect` first; add `ResizeObserver` only if UAT shows visible desync (CONTEXT.md Claude's Discretion). See § 5. |
| New `trellisActionsService.getCelebrationSuggestions()` getter | VineBloomCard consumes `useTrellisData()` directly | Less service-surface change | Recommended (UI-SPEC Open Items): VineBloomCard consumes `useTrellisData()` directly. See § 1 below. |
| `whileInView` per-tile entrance trigger | `newPostIds` Set | Re-fires on scroll-back-up | `newPostIds` is the single source of truth (consistency); `whileInView` would re-animate already-seen tiles (CONTEXT.md Claude's Discretion + Discussion-Log Q1). |

**Installation:** None — Phase 42 introduces zero new dependencies.

**Version verification (run before planning):**
```bash
cat /Users/Code/EchoLearn/app/node_modules/framer-motion/package.json | grep '"version"'
# → "version": "12.38.0"  (confirmed 2026-05-09)
```

---

## Architecture Patterns

### Recommended Project Structure (additive — no folder changes)

```
app/src/components/
├── InfoFlow.tsx          # UNCHANGED public exports: MemoizedConceptCard, ConnectionCard, MilestoneCard, InlineInfoFlow (de-wired but still exported per D-01).
│                         # CHANGED: 3 card-slide-in callsites at lines 197, 329, 858 removed.
├── MasonryFeed.tsx       # NEW — owns 2-column items.map + height-accumulator + framer-motion entrance + VineBloomCard render gate.
│                         # VineBloomCard co-located inside (per UI-SPEC Open Items recommendation).
└── ...
app/src/screens/
└── HomeScreen.tsx        # CHANGED: import swap (InlineInfoFlow → MasonryFeed); JSX swap at line 825-832; toast deletion at line 240.
```

### Pattern 1: Height-Accumulating 2-Column Masonry (D-02)

**What:** Pure JS, useRef + useLayoutEffect, append-only column assignment Map. Verbatim from UI-SPEC § Layout Algorithm.

**When to use:** Whenever 2-column masonry needs visual balance + tile stability + zero JS dependencies. De facto Pinterest/Rednote/Bilibili pattern.

**Example shape (planner consumes verbatim from UI-SPEC):**

```typescript
// Source: 42-UI-SPEC.md § Layout Algorithm: Height-Accumulating Split (D-02)
const columnHeightsRef = useRef<[number, number]>([0, 0]);
const tileColumnAssignmentsRef = useRef<Map<string, 0 | 1>>(new Map());
const tileRefsMap = useRef<Map<string, HTMLDivElement | null>>(new Map());

useLayoutEffect(() => {
  for (const item of items) {
    const itemId = getId(item);
    if (tileColumnAssignmentsRef.current.has(itemId)) continue; // immutability
    const heights = columnHeightsRef.current;
    const col = heights[0] <= heights[1] ? 0 : 1; // tie → col 0
    tileColumnAssignmentsRef.current.set(itemId, col);
  }
  // Measure heights AFTER assignments rendered
  for (const [id, el] of tileRefsMap.current) {
    if (!el) continue;
    const col = tileColumnAssignmentsRef.current.get(id);
    if (col === undefined) continue;
    columnHeightsRef.current[col] += el.clientHeight + 12;
  }
}, [items]);

// Render: filter by column assignment
return (
  <div style={{ display: 'flex', gap: '8px' }}>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {items.filter(i => tileColumnAssignmentsRef.current.get(getId(i)) === 0).map(renderTile)}
    </div>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {items.filter(i => tileColumnAssignmentsRef.current.get(getId(i)) === 1).map(renderTile)}
    </div>
  </div>
);
```

**Critical invariants (from UI-SPEC):**

- No `transform`, `will-change`, `filter`, `contain`, `perspective` on column wrappers or MasonryFeed root.
- No `position: fixed` on column wrappers.
- Tie-breaker: column 0 (left) gets the tile when both heights exactly equal.
- Assignment Map is **append-only** — never deleted, never mutated. Tile column never moves.

### Pattern 2: framer-motion Entrance on Leaf Tiles Only (D-03/D-04/D-05)

**What:** Each leaf tile in items.map renders as `<motion.div>` ONLY when `newPostIds.has(itemId)`. Tiles NOT in `newPostIds` render as plain `<div>` (no motion wrapper, no animation).

**When to use:** Refill-driven entrance animation only — initial mount of cached posts is silent.

**Example:**

```typescript
// Source: 42-UI-SPEC.md § Animation Contract (verbatim) +
// app/src/components/InfoFlow.tsx:800-820 (existing newPostIds Set pattern)
import { motion, type Variants } from 'framer-motion';

const tileEnterVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};
const tileEnterTransition = {
  duration: 0.25,                         // D-05: 250ms
  ease: [0.25, 0.1, 0.25, 1] as const,    // ease-out cubic-bezier (Material standard)
};

// Inside items.map:
return shouldAnimate ? (
  <motion.div
    key={itemId}
    ref={(el) => tileRefsMap.current.set(itemId, el)}
    data-feed-id={itemId}
    data-concept-id={item.kind === 'concept' ? (item.post.sourceQuestionIds?.[0] ?? '') : undefined}
    variants={tileEnterVariants}
    initial="hidden"
    animate="visible"
    transition={{ ...tileEnterTransition, delay: stagger40msIndex * 0.04 }}
    style={tileStyle}
  >
    {/* leaf card — MemoizedConceptCard / ConnectionCard / MilestoneCard */}
  </motion.div>
) : (
  <div
    key={itemId}
    ref={(el) => tileRefsMap.current.set(itemId, el)}
    data-feed-id={itemId}
    data-concept-id={...}
    style={tileStyle}
  >
    {/* leaf card */}
  </div>
);
```

### Pattern 3: VineBloomCard consumes useTrellisData() directly (Recommended over service surface change)

**What:** VineBloomCard uses `useTrellisData()` to derive heal/replant suggestions inline, mirroring `PlannerScreen.tsx:46-47`. No new service getter.

**When to use:** When the "data shape" already exists in a hook a sibling consumer uses, prefer hook-level reuse over service surface expansion.

**Example:**

```typescript
// Source: app/src/screens/PlannerScreen.tsx:46-47 (existing pattern)
import { useTrellisData } from '../state/useTrellisData';
import { trellisActionsService } from '../services/trellis-actions.service';

function VineBloomCard() {
  const { layout } = useTrellisData();
  const deadNodes = layout.nodes.filter((n) => n.leafState === 'dead');
  const dyingNodes = layout.nodes.filter((n) => n.leafState === 'dying' || n.leafState === 'falling');

  // Take up to 2 (1 dead + 1 dying preferred; fall back to 2 of either)
  const suggestions: Array<{ kind: 'heal' | 'replant'; node: typeof deadNodes[number] }> = [];
  if (deadNodes[0]) suggestions.push({ kind: 'replant', node: deadNodes[0] });
  if (dyingNodes[0]) suggestions.push({ kind: 'heal', node: dyingNodes[0] });
  if (suggestions.length < 2 && deadNodes[1]) suggestions.push({ kind: 'replant', node: deadNodes[1] });
  if (suggestions.length < 2 && dyingNodes[1]) suggestions.push({ kind: 'heal', node: dyingNodes[1] });

  // ... render rows + fallback prose if suggestions.length === 0 ...
}
```

### Anti-Patterns to Avoid

- **`<motion.div>` on column wrappers or MasonryFeed root** — violates D-03 (header containing-block rule); SC-4 source-reading test enforces this.
- **`column-count: 2` CSS** — violates D-02 (column shuffle on append). Negative grep test enforces.
- **`position: fixed` on column wrappers** — Android WebView regression class (CLAUDE.md Phase 32.1 lesson 3).
- **New event type for "all explored"** — violates one-signal-per-event (CLAUDE.md best practices rule 6). Reuse computed-locally `allExplored`.
- **New `trellisActionsService.getCelebrationSuggestions()` method** — service today owns navigation-result construction only; adding a "what to suggest" reader couples it to PlannerScreen's filter logic. Hook-level consumption avoids the coupling.
- **Adding the GAP-C tap-emit a SECOND time inside MasonryFeed.tsx** — InfoFlow.video-tap-emit.test.mjs asserts EXACTLY ONE `dailyReadService.markExplored` reference in InfoFlow.tsx. The reused `MemoizedConceptCard` carries the emit. MasonryFeed must NOT add a sibling emit at the wrapper level. See § 2.
- **Body scroll** — never rely on body scroll (CLAUDE.md root-overflow-clip rule). HomeScreen's existing scroll container owns this.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 2-column masonry | JS masonry library (`masonic`, `@virtuoso.dev/masonry`) | Inline ~30 LOC height-accumulator (UI-SPEC algorithm) | REQUIREMENTS Out-of-Scope line 60 explicitly forbids these for v1.5 (dependency discipline). |
| 2-column masonry | CSS `column-count: 2` + `break-inside: avoid` | Inline JS height-accumulator | Existing tiles shuffle between columns on append → bad UX (D-02 rationale). |
| 2-column masonry | CSS Grid Masonry (`grid-template-rows: masonry`) | Inline JS height-accumulator | REQUIREMENTS Out-of-Scope line 60: "Capacitor 8 Android WebView lags Chrome stable; not production-ready in 2026." |
| Suggestion derivation for celebration card | New `trellisActionsService.getCelebrationSuggestions()` | `useTrellisData()` + same `leafState` filter PlannerScreen uses | Service today owns navigation result construction only; adding a "what to suggest" reader duplicates PlannerScreen's filter logic. Hook-level consumption avoids surface drift. |
| `prefers-reduced-motion` handling for framer-motion | Custom CSS `@media (prefers-reduced-motion: reduce)` keyframe (the deleted `card-slide-in` was such an attempt; D-06 drops it) | Wrap MasonryFeed/VineBloomCard in `<MotionConfig reducedMotion="user">` OR `useReducedMotion()` hook in each motion site | **HIGH-IMPACT FINDING:** framer-motion does NOT auto-respect `prefers-reduced-motion`. UI-SPEC's claim is incorrect. See § 4. |
| Vine SVG illustration | External SVG asset file | Inline ~30 LOC `<svg>` matching `vineLoadingPulse` aesthetic at `HomeScreen.tsx:759-767` | UI-SPEC § Vine SVG Specification gives full inline JSX. No new asset file (D-07). |
| Stagger animation for 4 entering tiles | Custom JS `setTimeout` per tile | framer-motion `staggerChildren: 0.04` on a parent variant container | Standard framer pattern; UI-SPEC § Animation Contract gives `containerStaggerVariants` verbatim. |
| Tile measurement | `ResizeObserver` per tile out of the gate | `useLayoutEffect` post-render measurement on `[items]` | Simpler; UI-SPEC explicitly recommends this; "ship the simpler thing first." See § 5. |

**Key insight:** The masonry surface looks deceptively simple. The two real risks are (a) the `prefers-reduced-motion` gotcha and (b) the false assumption that `infiniteScrollService.allExplored` is service state — neither is. Both surface from CONTEXT.md / UI-SPEC text but are wrong. Plans must address both.

---

## Common Pitfalls

### Pitfall 1: framer-motion v12 does NOT auto-respect `prefers-reduced-motion`

**What goes wrong:** UI-SPEC § Animation Contract (line 328) and § Visual Composition (line 265) state "framer-motion native: stagger + entrance become instant (0ms) ... All `<motion.*>` elements use framer-motion's default `useReducedMotion` honoring — animations become instant when the OS setting is on. **No additional code required.**" This is **incorrect**. Verified against motion.dev/docs/react-accessibility (2026-05-09): "Motion for React does NOT automatically respect `prefers-reduced-motion` by default. Explicit configuration is required." Also verified by `grep -rn "useReducedMotion\|MotionConfig\|prefers-reduced-motion" app/src` → **zero existing handlers anywhere in the project** (TrellisCanvas, TrellisLeaf, PostCarousel, BottomNavigation, SwipeTabContainer all use `motion` without reduced-motion gating).

**Why it happens:** framer-motion v12 treats `prefers-reduced-motion` as opt-in, not opt-out. Without `<MotionConfig reducedMotion="user">` wrapping the app (or `useReducedMotion()` hooks per motion site), animations run at full duration regardless of the OS accessibility setting. D-06's "drop `card-slide-in` CSS keyframe entirely" is fine on its own merits (one animation system, not two) but does NOT inherit reduced-motion behavior automatically.

**How to avoid:** Pick one of:

1. **(Recommended)** Wrap MasonryFeed (or HomeScreen) in `<MotionConfig reducedMotion="user">`. Single line change; covers all `<motion.*>` descendants:
   ```tsx
   import { MotionConfig } from 'framer-motion';
   // wrap the JSX subtree containing MasonryFeed
   <MotionConfig reducedMotion="user">
     <MasonryFeed ... />
   </MotionConfig>
   ```
   `reducedMotion="user"` (per motion.dev) "automatically disables transform and layout animations" while preserving opacity/color animations — a sensible default for the celebration entrance + tile fade-up.

2. **Per-site `useReducedMotion()` hook** in MasonryFeed and VineBloomCard, gating each `transition.duration` to 0 when prefers-reduced-motion is on. More LOC but more precise.

3. **Pragmatic punt:** since the project ships with zero reduced-motion handlers anywhere today (no existing user-visible regression), planner may **explicitly defer** to a v1.5.x or v1.6 accessibility phase, with a `// TODO(a11y):` comment in MasonryFeed and a note in PROJECT-level memory. Honest but suboptimal — this is the only place where the existing UX adds new motion in v1.5.

   Recommend option 1 — `<MotionConfig reducedMotion="user">` is the smallest fix that respects the OS preference correctly.

**Warning signs:** UAT with macOS / iOS / Android "Reduce Motion" enabled — tile fade-up + SVG bloom path-draw still animate visibly. To verify: System Preferences → Accessibility → Display → Reduce Motion → ON; reload `/home` and trigger a refill. With option 1, all `<motion.*>` transforms collapse to instant.

### Pitfall 2: `infiniteScrollService.allExplored` does NOT exist as service state

**What goes wrong:** CONTEXT.md (Code Context line 173) and UI-SPEC (line 262) describe "`infiniteScrollService.allExplored` boolean trigger." There is no such property. Verified: `grep -n "allExplored" app/src/services/infiniteScroll.service.ts` → 0 matches. The `allExplored` symbol exists ONLY as a **local `const` inside `concept-feed.service.ts:1591`** computed inline as `anchors.length > 0 && anchors.every(a => exploredAnchors.includes(a.id))`. It is NOT exported, NOT cached on a service singleton, NOT readable from a React hook.

**Why it happens:** CONTEXT.md / UI-SPEC abstracted this as if `infiniteScrollService` exposes it; it does not.

**How to avoid:** VineBloomCard (or HomeScreen) computes `allExplored` itself using the same expression, sourced from `dailyReadService` + `useQuestions()`:

```typescript
import { useQuestions } from '../state/useQuestions';
import { dailyReadService } from '../services/daily-read.service';

function VineBloomCard() {
  const { questions } = useQuestions();
  const exploredAnchors = dailyReadService.getExploredAnchors();
  const anchors = questions.filter(q => q.isAnchorNode);
  const allExplored = anchors.length > 0 && anchors.every(a => exploredAnchors.includes(a.id));
  if (!allExplored) return null; // celebration only renders when condition met
  // ... render celebration content ...
}
```

**Re-render trigger:** HomeScreen already subscribes to `CONCEPT_EXPLORED` via the existing effect at `HomeScreen.tsx:514, 522` that calls `setExploredAnchors(...)`. When that state updates, HomeScreen re-renders, MasonryFeed re-renders, VineBloomCard re-evaluates `allExplored`. The chain works without new wiring.

**Warning signs:** TypeScript error `Property 'allExplored' does not exist on type '{ initialize, loadNextBatch, ... }'` if the planner takes UI-SPEC literally.

### Pitfall 3: Forgetting that MASONRY-01 + ROADMAP SC-1 wording will fail verifier

**What goes wrong:** ROADMAP SC-1 line 1145 says "DOM-tree test asserting `column-count: 2` + `break-inside: avoid` are present in the rendered styles." Verifier's source-reading invariant test will literally grep for `column-count` in MasonryFeed.tsx and **fail** since D-02 forbids it (negative grep is the correct test per UI-SPEC § Source-Reading Invariant Tests #2).

**Why it happens:** SC-1 was written before D-02 surfaced the column-shuffle problem during /gsd:discuss-phase. The wording is now stale.

**How to avoid:** Plan MUST include a Task that updates ROADMAP line 1145 (SC-1) AND REQUIREMENTS.md line 11 (MASONRY-01) **before** or in the same commit as the source-reading test that asserts the negative. See § 8 below for exact line numbers + recommended replacement text.

**Warning signs:** `verify-work` agent reports SC-1 fails because `MasonryFeed.tsx` does not contain `column-count`.

### Pitfall 4: Adding a SECOND GAP-C emit at the MasonryFeed wrapper level

**What goes wrong:** Tempting to make MasonryFeed "responsible" for emitting `CONCEPT_EXPLORED` since it owns the items.map. But the canonical emit lives inside `MemoizedConceptCard`'s thumbnail onClick (the reused leaf card). Adding a parallel emit in MasonryFeed.tsx breaks the existing test `app/tests/components/InfoFlow.video-tap-emit.test.mjs` which asserts:
- `dailyReadService.markExplored` appears EXACTLY ONCE in InfoFlow.tsx (it does — inside the video thumbnail onClick).
- `type: 'CONCEPT_EXPLORED'` appears EXACTLY ONCE in InfoFlow.tsx.

**Why it happens:** Refactor instinct — wanting to centralize emit logic at the new MasonryFeed level.

**How to avoid:** Treat MasonryFeed as PURELY layout. All click handlers, video state, GAP-C emits stay inside the reused leaf card components. MasonryFeed contains zero `dailyReadService.*` calls and zero `eventBus.emit` calls.

**Warning signs:** `npm test app/tests/components/InfoFlow.video-tap-emit.test.mjs` fails with "expected 1 occurrence, found 2."

### Pitfall 5: useLayoutEffect column re-measure when a tile's height mutates after mount

**What goes wrong:** A video card's poster image lazy-loads → cardClientHeight grows by 40px after initial measurement → column heights silently desync → next-batch tile assignment goes to the now-taller column even though the visual reality is the other column became taller. Cumulative drift over 20+ tiles.

**Why it happens:** `useLayoutEffect` measures heights synchronously after render but BEFORE async resources (images, iframe poster) load. The first measurement is the only one taken. Refill cycles re-run useLayoutEffect on `[items]` change, but they only ADD new tiles to the height accumulator — they don't re-measure existing tiles.

**How to avoid:** UI-SPEC explicitly recommends "ship the simpler thing first; add ResizeObserver only if UAT shows visible desync from async image loads." For v1, accept potential 1-2 tile-of-drift after long sessions; UAT will tell us if it's visible. If UAT flags it, add `ResizeObserver` in a follow-up:

```typescript
// Optional follow-up if UAT shows desync
useLayoutEffect(() => {
  const observers = new Map<string, ResizeObserver>();
  for (const [id, el] of tileRefsMap.current) {
    if (!el) continue;
    const ro = new ResizeObserver((entries) => {
      const newHeight = entries[0].contentRect.height;
      const col = tileColumnAssignmentsRef.current.get(id);
      // Recompute column-X height by summing all tiles assigned to it
      // (more correct than incremental delta because positions never change)
      if (col === undefined) return;
      let total = 0;
      for (const [otherId, otherCol] of tileColumnAssignmentsRef.current) {
        if (otherCol !== col) continue;
        const otherEl = tileRefsMap.current.get(otherId);
        if (otherEl) total += otherEl.clientHeight + 12;
      }
      columnHeightsRef.current[col] = total;
    });
    ro.observe(el);
    observers.set(id, ro);
  }
  return () => { for (const ro of observers.values()) ro.disconnect(); };
}, [items]);
```

**Warning signs:** Operator UAT — column heights visibly diverge on long scrolls (e.g., right column ends 200px higher than left after 30+ tiles).

### Pitfall 6: Viewport resize (e.g., orientation change, keyboard open/close) does NOT rebalance columns

**What goes wrong:** Column assignments are immutable (D-02). On orientation change or zoom, tiles stay in their original columns even if visual balance is now poor. Trellis is mobile-first; orientation change is rare but possible. The keyboard open/close case is partially handled by `SwipeTabContainer.resize-guard.test.mjs` (CLAUDE.md "SwipeTabContainer resize + keyboard") which gates resync on width change, not height — same logic applies here.

**Why it happens:** Tile column assignment is recorded once (D-02 immutability invariant). Resize doesn't re-assign.

**How to avoid:** Accept the trade-off. CONTEXT.md explicitly defers responsive breakpoints ("Trellis is mobile-first; no current device profile would trigger this. Defer until signal."). For Phase 42, "tiles never move" is the contract; column rebalance on resize is out-of-scope. Phase 45's perf profiling pass may surface it if real.

**Warning signs:** N/A — accepted limitation.

### Pitfall 7: `card-slide-in` keyframe deletion misses one of the 3 callsites

**What goes wrong:** The keyframe lives at `app/src/index.css:504-507` and is referenced at:
- `app/src/components/InfoFlow.tsx:197` — inside `MemoizedConceptCard` `isActive` branch
- `app/src/components/InfoFlow.tsx:329` — inside `ConnectionCard` `isActive` branch
- `app/src/components/InfoFlow.tsx:858` — inside `InlineInfoFlow`'s items.map

Verified by `grep -n "card-slide-in" app/src/components/InfoFlow.tsx app/src/index.css`. If any one of the 3 callsites survives, framer-motion + CSS will both attempt to animate the same tile mount → dueling animations.

**Why it happens:** Three callsites in two files; easy to miss the one inside `MemoizedConceptCard`/`ConnectionCard` since UI-SPEC focuses on the items.map level.

**How to avoid:** Plan task explicitly enumerates all 3 lines. Source-reading test (UI-SPEC § Source-Reading Invariant Tests #7): negative grep `card-slide-in` across **all** `app/src/`.

**Warning signs:** Visual — first refill batch animates with a "double bounce" (CSS slide + framer fade-up), or the 3rd callsite log line still references it.

---

## Code Examples

### Example 1: Verified MasonryFeed skeleton (combines UI-SPEC algorithm + Pitfall 1 reduced-motion fix)

```typescript
// Source: 42-UI-SPEC.md § Layout Algorithm + § Animation Contract +
// Research § Pitfall 1 (MotionConfig reducedMotion="user")

import { useLayoutEffect, useRef, useState } from 'react';
import { MotionConfig, motion, type Variants } from 'framer-motion';
import { MemoizedConceptCard, ConnectionCard, MilestoneCard, type InfoFlowItem } from './InfoFlow';
import { VineBloomCard } from './VineBloomCard'; // co-located in same file or split per planner discretion

const tileEnterVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

interface MasonryFeedProps {
  items: InfoFlowItem[];
  onOpenConnection: (idA: string, idB: string) => void;
  showConnectionScores?: boolean;
  onOpenPost: (postId: string, post: import('../types').DailyPost) => void;
  allExplored: boolean; // computed by parent (HomeScreen) from dailyReadService + anchors
}

function getId(item: InfoFlowItem): string {
  return item.kind === 'concept' ? item.post.id
    : item.kind === 'connection' ? `conn-${item.questionA.id}-${item.questionB.id}`
    : item.kind === 'milestone' ? item.item.id
    : '';
}

export function MasonryFeed({ items, onOpenConnection, showConnectionScores, onOpenPost, allExplored }: MasonryFeedProps) {
  const columnHeightsRef = useRef<[number, number]>([0, 0]);
  const tileColumnAssignmentsRef = useRef<Map<string, 0 | 1>>(new Map());
  const tileRefsMap = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // Same newPostIds Set pattern as InfoFlow.tsx:800-820
  const seenPostIdsRef = useRef(new Set<string>());
  const [newPostIds] = useState<Set<string>>(() => {
    const seen = seenPostIdsRef.current;
    const incoming = new Set<string>();
    for (const item of items) {
      const id = getId(item);
      if (id && !seen.has(id)) incoming.add(id);
      if (id) seen.add(id);
    }
    return incoming;
  });

  useLayoutEffect(() => {
    // Append-only assignment for new items
    for (const item of items) {
      const itemId = getId(item);
      if (!itemId) continue;
      if (tileColumnAssignmentsRef.current.has(itemId)) continue;
      const heights = columnHeightsRef.current;
      const col: 0 | 1 = heights[0] <= heights[1] ? 0 : 1;
      tileColumnAssignmentsRef.current.set(itemId, col);
    }
    // Measure heights of newly-assigned tiles
    for (const [id, el] of tileRefsMap.current) {
      if (!el) continue;
      const col = tileColumnAssignmentsRef.current.get(id);
      if (col === undefined) continue;
      // (Heuristic: only add height once per tile; could track a measuredSet for correctness)
      // For v1, the simple incremental add matches UI-SPEC's stated algorithm.
    }
    // Sum-from-DOM is more robust:
    columnHeightsRef.current = [0, 0];
    for (const [id, el] of tileRefsMap.current) {
      if (!el) continue;
      const col = tileColumnAssignmentsRef.current.get(id);
      if (col === undefined) continue;
      columnHeightsRef.current[col] += el.clientHeight + 12;
    }
  }, [items]);

  const renderTile = (item: InfoFlowItem) => {
    const itemId = getId(item);
    const shouldAnimate = newPostIds.has(itemId);
    const tileBody = item.kind === 'concept' ? (
      <MemoizedConceptCard
        post={item.post}
        feedIndex={items.indexOf(item)}
        isActive={shouldAnimate}
        onOpen={onOpenPost}
        videoPlaying={null /* video state lives in MasonryFeed too — see § 2 */}
        setVideoPlaying={() => {}}
      />
    ) : item.kind === 'connection' ? (
      <ConnectionCard
        questionA={item.questionA}
        questionB={item.questionB}
        conceptNounA={item.conceptNounA}
        conceptNounB={item.conceptNounB}
        bridgeInsight={item.bridgeInsight}
        cosineSimilarity={item.cosineSimilarity}
        showScore={showConnectionScores}
        onOpenConnection={onOpenConnection}
      />
    ) : (
      <MilestoneCard item={item.item} isActive={shouldAnimate} />
    );

    const commonProps = {
      key: itemId,
      ref: (el: HTMLDivElement | null) => { tileRefsMap.current.set(itemId, el); },
      'data-feed-id': itemId,
      'data-concept-id': item.kind === 'concept' ? (item.post.sourceQuestionIds?.[0] ?? '') : undefined,
      style: { position: 'relative' as const },
    };

    return shouldAnimate ? (
      <motion.div
        {...commonProps}
        variants={tileEnterVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const, delay: 0 /* stagger handled by parent variant if used */ }}
      >
        {tileBody}
      </motion.div>
    ) : (
      <div {...commonProps}>{tileBody}</div>
    );
  };

  // Pitfall 1 fix: wrap motion descendants in MotionConfig to honor prefers-reduced-motion
  return (
    <MotionConfig reducedMotion="user">
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.filter(i => tileColumnAssignmentsRef.current.get(getId(i)) === 0).map(renderTile)}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.filter(i => tileColumnAssignmentsRef.current.get(getId(i)) === 1).map(renderTile)}
        </div>
      </div>
      {allExplored && <div style={{ marginTop: '24px' }}><VineBloomCard /></div>}
    </MotionConfig>
  );
}
```

> **Note for planner:** the example above sketches a single shape; the production code may want to split video-state ownership (`videoPlaying`/`setVideoPlaying`) the way `InlineInfoFlow.tsx:742-797` does (visibility + intra-app navigation handlers). Easiest path: lift `videoPlaying`/`setVideoPlaying` and the 3 useEffects (visibility / pathname / IntersectionObserver) verbatim from `InlineInfoFlow.tsx:740-797` into MasonryFeed.

### Example 2: VineBloomCard with hook-based suggestion derivation

```typescript
// Source: PlannerScreen.tsx:46-87 (existing dead/dying filter + handler pattern) +
// 42-UI-SPEC.md § VineBloomCard internal layout

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, type Variants } from 'framer-motion';
import { Heart, Sprout } from 'lucide-react';
import { useTrellisData } from '../state/useTrellisData';
import { useQuestions } from '../state/useQuestions';
import { dailyReadService } from '../services/daily-read.service';
import { trellisActionsService } from '../services/trellis-actions.service';

const celebrationVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};
const bloomPathVariants: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: { pathLength: 1, opacity: 1 },
};

export function VineBloomCard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { layout } = useTrellisData();
  const { questions } = useQuestions();

  // Derive suggestions same way PlannerScreen does (PlannerScreen.tsx:46-47)
  const deadNodes = layout.nodes.filter((n) => n.leafState === 'dead');
  const dyingNodes = layout.nodes.filter((n) => n.leafState === 'dying' || n.leafState === 'falling');

  const suggestions: Array<{ kind: 'heal' | 'replant'; node: typeof deadNodes[number] }> = [];
  if (deadNodes[0]) suggestions.push({ kind: 'replant', node: deadNodes[0] });
  if (dyingNodes[0]) suggestions.push({ kind: 'heal', node: dyingNodes[0] });
  if (suggestions.length < 2 && deadNodes[1]) suggestions.push({ kind: 'replant', node: deadNodes[1] });
  if (suggestions.length < 2 && dyingNodes[1]) suggestions.push({ kind: 'heal', node: dyingNodes[1] });

  // Anchor count for fallback prose
  const exploredCount = dailyReadService.getExploredAnchors().length;
  const dueTomorrowCount = questions.filter(q => q.isAnchorNode && q.reviewSchedule?.nextReviewDate).length;
  // (Real "due tomorrow" filter would compare nextReviewDate to addDays(today(), 1); refinement at planner discretion.)

  const handleHeal = (node: typeof dyingNodes[number]) => {
    const name = node.anchor.title ?? node.anchor.content ?? 'anchor';
    const result = trellisActionsService.heal(node.anchor.id, name, node.qaChildren.map(q => q.id));
    navigate(result.navigateTo, { state: result.state });
  };
  const handleReplant = (node: typeof deadNodes[number]) => {
    const result = trellisActionsService.replant(node.anchor.id, node.anchor, node.qaChildren.map(q => q.id));
    navigate(result.navigateTo, { state: result.state });
  };

  return (
    <motion.div
      variants={celebrationVariants}
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] as const }}
      style={{
        background: 'var(--card)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-2)',
        padding: '24px 20px',
      }}
    >
      {/* Vine SVG (UI-SPEC § Vine SVG Specification, verbatim) */}
      <svg width="88" height="88" viewBox="0 0 88 88" fill="none" style={{ display: 'block', margin: '0 auto 16px' }}>
        <line x1="44" y1="76" x2="44" y2="32" stroke="var(--primary-40)" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="32" cy="56" rx="10" ry="6" stroke="var(--primary-40)" strokeWidth="2" fill="none" transform="rotate(-25 32 56)" />
        <ellipse cx="56" cy="56" rx="10" ry="6" stroke="var(--primary-40)" strokeWidth="2" fill="none" transform="rotate(25 56 56)" />
        <ellipse cx="34" cy="42" rx="8" ry="5" stroke="var(--primary-40)" strokeWidth="2" fill="none" transform="rotate(-30 34 42)" />
        <ellipse cx="54" cy="42" rx="8" ry="5" stroke="var(--primary-40)" strokeWidth="2" fill="none" transform="rotate(30 54 42)" />
        <motion.circle
          cx="44" cy="22" r="10"
          fill="var(--node-peach)" stroke="var(--primary-40)" strokeWidth="2"
          variants={bloomPathVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] as const, delay: 0.15 }}
        />
        <circle cx="44" cy="22" r="3" fill="var(--primary-40)" />
      </svg>

      <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary-40)', textAlign: 'center', marginBottom: 8, lineHeight: 1.3 }}>
        {t('home.celebration.vineBloomTitle')}
      </p>

      {suggestions.length > 0 ? (
        <>
          <p style={{ fontSize: '0.95rem', color: 'var(--foreground)', marginBottom: 12 }}>
            {t('home.celebration.suggestionsHeader')}
          </p>
          {suggestions.map((s, idx) => {
            const isLast = idx === suggestions.length - 1;
            const Icon = s.kind === 'heal' ? Heart : Sprout;
            const iconColor = s.kind === 'heal' ? '#66BB6A' : '#4CAF50';
            const labelKey = s.kind === 'heal' ? 'home.celebration.healAction' : 'home.celebration.replantAction';
            const badgeKey = s.kind === 'heal' ? 'home.celebration.healBadge' : 'home.celebration.replantBadge';
            const anchorName = s.node.anchor.title ?? s.node.anchor.content ?? 'anchor';
            return (
              <button
                key={s.node.anchor.id}
                className="active-squish"
                onClick={() => s.kind === 'heal' ? handleHeal(s.node) : handleReplant(s.node)}
                aria-label={t('home.celebration.actionRowAria', { action: t(labelKey, { anchor: anchorName }), anchor: anchorName })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  minHeight: 44, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: isLast ? 'none' : '1px solid var(--border)',
                }}
              >
                <Icon size={16} color={iconColor} />
                <span style={{ fontSize: '0.9rem', flex: 1, textAlign: 'left', color: 'var(--foreground)' }}>
                  {t(labelKey, { anchor: anchorName })}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                  {t(badgeKey)}
                </span>
              </button>
            );
          })}
        </>
      ) : (
        <>
          <p style={{ fontSize: '0.95rem', color: 'var(--foreground)', textAlign: 'center', marginBottom: 4 }}>
            {t('home.celebration.fallbackHealthy')}
          </p>
          <p style={{ fontSize: '0.95rem', color: 'var(--muted-foreground)', textAlign: 'center', maxWidth: 280, margin: '0 auto' }}>
            {dueTomorrowCount > 0
              ? t('home.celebration.fallbackReviewCount', { count: dueTomorrowCount })
              : t('home.celebration.fallbackReviewCountZero')}
          </p>
        </>
      )}

      <button
        onClick={() => navigate('/planner')}
        className="active-squish"
        style={{
          display: 'block', margin: '16px auto 0',
          minHeight: 44, padding: '12px 0',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary-40)',
          textDecoration: 'underline',
        }}
      >
        {t('home.celebration.openPlanner')}
      </button>
    </motion.div>
  );
}
```

### Example 3: Source-reading invariant test for "no `column-count` in MasonryFeed.tsx"

```typescript
// Source: pattern from app/tests/components/InfoFlow.video-tap-emit.test.mjs +
// app/tests/services/engagement-anti-wire.test.mjs

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MASONRY_PATH = resolve(__dirname, '../../src/components/MasonryFeed.tsx');
const source = readFileSync(MASONRY_PATH, 'utf-8');

describe('MasonryFeed layout invariants (Phase 42)', () => {
  it('contains the height-accumulator state (counterweight — proves the test reaches the file)', () => {
    assert.ok(source.includes('columnHeightsRef'), 'MasonryFeed.tsx must declare a columnHeightsRef state — D-02 height-accumulating split.');
  });

  it('does NOT use CSS column-count or break-inside (D-02 height-accumulating split chosen over CSS default)', () => {
    assert.ok(!/column-count/i.test(source), 'MasonryFeed.tsx must NOT contain `column-count` CSS — D-02 selected height-accumulating JS split over CSS column-count to prevent column shuffling on append.');
    assert.ok(!/columnCount/.test(source), 'MasonryFeed.tsx must NOT contain `columnCount` JSX style — same reason.');
    assert.ok(!/break-inside/i.test(source), 'MasonryFeed.tsx must NOT contain `break-inside` CSS — D-02 selected height-accumulating JS split.');
    assert.ok(!/breakInside/.test(source), 'MasonryFeed.tsx must NOT contain `breakInside` JSX style — same reason.');
  });

  it('does NOT use transform/will-change/filter/contain/perspective on root or column wrappers (CLAUDE.md Header positioning rule)', () => {
    // Pragmatic check: these props must not appear in the file at all.
    // Leaf-tile motion.div uses translateY via framer-motion's `y` prop, not raw `transform: ...`.
    assert.ok(!/will-change/i.test(source), 'MasonryFeed.tsx must NOT use will-change — Header positioning rule.');
    assert.ok(!/willChange/.test(source), 'MasonryFeed.tsx must NOT use willChange — Header positioning rule.');
    assert.ok(!/perspective:/.test(source), 'MasonryFeed.tsx must NOT use perspective — Header positioning rule.');
    // transform: and filter: are weaker negatives because framer-motion's `y` ultimately becomes transform —
    // the load-bearing rule is about ANCESTOR transforms, not leaf-tile transforms. Source-reading test scope
    // limited to what's structurally enforceable.
  });

  it('contains a motion.div leaf-tile wrapper (D-03 — at least one motion.div exists in the items.map)', () => {
    assert.ok(/motion\.div/.test(source), 'MasonryFeed.tsx must contain at least one <motion.div> wrapper — D-03 leaf-tile entrance animation.');
  });
});
```

Pattern derives from `tests/components/InfoFlow.video-tap-emit.test.mjs` and `tests/services/engagement-anti-wire.test.mjs` — read both for the canonical structure (counterweight assertion + targeted negative grep + descriptive failure messages).

---

## Source-Reading Invariant Tests (planner consumes verbatim)

UI-SPEC § Source-Reading Invariant Tests pre-enumerates 8 invariants. Mapped to canonical test patterns:

| # | Invariant | Pattern source | Test scope |
|---|-----------|----------------|------------|
| 1 | `<motion.div>` only on leaf tiles in MasonryFeed.tsx | InfoFlow.video-tap-emit.test.mjs (positive count) + engagement-anti-wire.test.mjs (negative grep across files) | (a) MasonryFeed.tsx contains `motion.div` ≥1 times; (b) `motion.div` does NOT appear in HomeScreen.tsx |
| 2 | NO `column-count` CSS in MasonryFeed.tsx | engagement-anti-wire.test.mjs negative-grep idiom | Negative grep on `column-count`, `columnCount`, `break-inside`, `breakInside` |
| 3 | NO `transform` / `will-change` / `filter` / `contain` / `perspective` on root or column wrappers | Pattern from `tests/components/SwipeTabContainer.resize-guard.test.mjs` (defense-in-depth source assertions) | Negative grep on `will-change`, `willChange`, `perspective:` (with caveats — see Example 3 above) |
| 4 | `toast(...noMorePosts...)` call gone from HomeScreen.tsx | InfoFlow.video-tap-emit.test.mjs exact-count idiom | Negative grep on `home.toast.noMorePosts` AND `noMorePosts` in HomeScreen.tsx |
| 5 | VineBloomCard renders when `allExplored && layout.nodes.length > 0` | Behavioral test pattern — render with mocked `dailyReadService` + `useTrellisData` | Behavioral test (DOM render assertion) |
| 6 | Tile column assignment is immutable across re-renders | Behavioral test — render with N items, re-render with N+4, assert first N tiles' assignments unchanged | Behavioral test |
| 7 | `card-slide-in` keyframe + 3 callsites removed | engagement-anti-wire.test.mjs negative grep across all `app/src/` | Walk all `.ts/.tsx/.css` under `app/src/`; assert zero occurrences of `card-slide-in` |
| 8 | i18n bundle parity preserved | Existing `tests/locales/bundle-parity.test.mjs` already enforces | No new test; rely on existing bundle-parity test |

**Recommended Phase 42 test files (planner can collapse):**

- `app/tests/components/MasonryFeed.layout.test.mjs` — invariants 1, 2, 3, 6 (source-reading + behavioral immutability)
- `app/tests/components/MasonryFeed.celebration.test.mjs` — invariant 5 (behavioral celebration render)
- `app/tests/screens/HomeScreen.no-more-posts-toast.test.mjs` — invariant 4 (negative grep)
- `app/tests/lib/no-card-slide-in.test.mjs` — invariant 7 (cross-tree negative grep)

Behavioral tests (5, 6) require DOM rendering. Project precedent: `app/tests/components/TrellisCanvas.focus.test.mjs`, `app/tests/components/TrellisLeaf.shake.test.mjs` — use the `_trellis-tsx-loader.mjs` + `_trellis-tsx-hooks.mjs` pattern (see `app/tests/components/_trellis-tsx-loader.mjs`).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `card-slide-in` CSS keyframe for tile entrance | framer-motion `<motion.div>` + `Variants` with `prefers-reduced-motion` opt-in via `<MotionConfig>` | Phase 42 (D-06 + Pitfall 1 fix) | One animation system; correct accessibility behavior |
| CSS `column-count: 2` for masonry | JS height-accumulating split | Phase 42 (D-02; CONTEXT.md Discussion-Log Q1) | Tile stability across refill cycles |
| Bare `toast('no more posts')` | Vine-bloom celebration card with suggested-tomorrow plan | Phase 42 (D-11 + MASONRY-02) | Surfaces actionable next steps; brand-tonal moment |
| `infiniteScrollService.allExplored` (not exposed today) | VineBloomCard computes `allExplored` itself from `dailyReadService.getExploredAnchors()` + `useQuestions().questions.filter(q => q.isAnchorNode)` | Phase 42 (Pitfall 2 fix) | Avoids invented service surface |

**Deprecated/outdated:**
- **`card-slide-in` keyframe** at `app/src/index.css:504-507`: replaced by framer-motion entrance variants (D-06).
- **`InlineInfoFlow` at `/home`**: still exported from `InfoFlow.tsx` (no harm; future surfaces may reuse), but no longer wired at `/home` (D-01).
- **ROADMAP SC-1 + REQUIREMENTS.md MASONRY-01 wording** (`column-count: 2` + `break-inside: avoid`): replaced with "2-column masonry layout via height-accumulating split" (see § 8 Wording Correction Plan).

---

## Open Questions

1. **Should `<MotionConfig reducedMotion="user">` wrap MasonryFeed only, or HomeScreen, or the App root?**
   - What we know: framer-motion does NOT auto-respect `prefers-reduced-motion`; opt-in required (Pitfall 1). Existing project has zero reduced-motion handling anywhere; existing motion sites (TrellisCanvas, TrellisLeaf, PostCarousel, BottomNavigation, SwipeTabContainer, PageTransition) would inherit if wrapped at App root.
   - What's unclear: scope of impact. Wrapping at App root affects existing animations (e.g., BottomNavigation tab-slide could collapse to instant — operator-confirmed at commit `808c6e85` that snappy tab switches are intentional). Wrapping at MasonryFeed only is safe and surgical.
   - Recommendation: **Wrap MasonryFeed (and VineBloomCard if extracted) only.** Surgical scope; Phase 42 introduces new motion in only one place; doesn't disturb existing animations. Phase 45 may revisit project-wide reduced-motion as part of accessibility audit.

2. **Should the `home.toast.noMorePosts` i18n key be deleted from all 4 bundles?**
   - What we know: Verified via grep — sole consumer is `app/src/screens/HomeScreen.tsx:240` (the call being deleted in D-11). Zero other consumers.
   - Recommendation: **Yes — delete from all 4 bundles in the same commit as the toast call deletion.** UI-SPEC § DEPRECATED i18n keys recommends this; bundle-parity test stays green when removed symmetrically across all 4 bundles.

3. **Should VineBloomCard be co-located inside MasonryFeed.tsx or extracted to its own file?**
   - What we know: UI-SPEC Open Items recommends co-location for v1 (~80 LOC inline; matches MilestoneCard co-located inside InfoFlow.tsx). Splitting is justifiable if file exceeds ~300 LOC or if reused.
   - Recommendation: **Co-locate inside MasonryFeed.tsx.** Avoids premature abstraction; matches project pattern.

4. **Does the celebration card need a re-fire-on-`refresh()` trigger?**
   - What we know: `useTrellisData()` already subscribes to `REVIEW_COMPLETED` / `GRAPH_UPDATED` / `ANCHOR_DELETED` / `HARVEST_COMPLETED` — when any fires, `layout` re-derives, VineBloomCard re-renders, `allExplored` re-evaluated. `dailyReadService.getExploredAnchors()` doesn't have its own subscription, but HomeScreen's existing `[location.pathname === '/home']` resync effect at `HomeScreen.tsx:514-522` already handles cross-day reset.
   - Recommendation: **No new trigger needed.** Existing chain works.

5. **Does the framer-motion `staggerChildren` parent-variant pattern conflict with the column-split render shape?**
   - What we know: `containerStaggerVariants` requires the container that owns the variant to have ALL animating children as direct descendants. With the 2-column split, leaf tiles are children of column wrappers, NOT of MasonryFeed root. `staggerChildren` on MasonryFeed root would NOT cascade into the column-wrapper grandchildren without `delayChildren` or matching variant on the wrappers.
   - What's unclear: Is per-tile manual `delay` (using `transition.delay = index * 0.04`) good enough, or do we need `staggerChildren` to fire automatically?
   - Recommendation: **Per-tile `transition.delay = stagger40msIndex * 0.04`** computed from items length. Simpler than dual-level variant cascade. UI-SPEC's `containerStaggerVariants` constant is a reference that the planner can omit if per-tile delay suffices. (UI-SPEC § Animation Contract acknowledges both approaches.)

---

## Environment Availability

Phase 42 is pure code/config changes (no new external dependencies). All required runtime tools verified:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (test runner) | `node --test` source-reading invariants | ✓ | v25 (per project) | — |
| TypeScript | `tsc -b --noEmit` gate | ✓ | 5.9.3 | — |
| framer-motion | `<motion.div>`, `<motion.circle>`, `Variants`, `MotionConfig` | ✓ | **12.38.0** (verified `app/node_modules/framer-motion/package.json`) | — |
| lucide-react | `Heart`, `Sprout` icons | ✓ | 0.575.0 | — |
| react / react-dom | UI runtime | ✓ | 19.2.0 | — |
| react-i18next | `useTranslation` / `t()` | ✓ | 17.0.3 | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node --test` (per CLAUDE.md "Test framework") |
| Config file | None — `package.json` test script: `find tests -name '*.test.mjs' \| node --test` |
| Quick run command | `cd app && node --test tests/components/MasonryFeed.layout.test.mjs` |
| Full suite command | `cd app && npm test` (runs `test:main` then `test:actions`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MASONRY-01 | 2-column masonry renders; no card splits across columns | source-reading + behavioral | `node --test tests/components/MasonryFeed.layout.test.mjs` | ❌ Wave 0 — file is part of Phase 42 |
| MASONRY-01 | NO `column-count` / `break-inside` CSS in MasonryFeed.tsx (height-accumulating split chosen) | source-reading | (same file) | ❌ Wave 0 |
| MASONRY-01 | Tile column assignment immutable across re-renders | behavioral | (same file) | ❌ Wave 0 |
| MASONRY-01 | NO `transform`/`will-change`/`filter`/`contain`/`perspective` on root or column wrappers | source-reading | (same file) | ❌ Wave 0 |
| MASONRY-01 | `<motion.div>` only on leaf tiles, NOT on root/wrappers/HomeScreen | source-reading | (same file) | ❌ Wave 0 |
| MASONRY-01 | `card-slide-in` keyframe + 3 callsites removed | source-reading (negative grep across `app/src/`) | `node --test tests/lib/no-card-slide-in.test.mjs` | ❌ Wave 0 |
| MASONRY-01 | Existing GAP-C single-emit invariant preserved (test must still pass) | source-reading | `node --test tests/components/InfoFlow.video-tap-emit.test.mjs` | ✅ exists |
| MASONRY-02 | VineBloomCard renders when `allExplored && layout.nodes.length > 0` | behavioral | `node --test tests/components/MasonryFeed.celebration.test.mjs` | ❌ Wave 0 |
| MASONRY-02 | `toast(...noMorePosts...)` call gone from HomeScreen.tsx | source-reading | `node --test tests/screens/HomeScreen.no-more-posts-toast.test.mjs` | ❌ Wave 0 |
| MASONRY-02 | i18n bundle parity preserved (12 added + 1 deleted across all 4 bundles) | source-reading | `node --test tests/locales/bundle-parity.test.mjs` | ✅ exists |
| MASONRY-02 | Vine-bloom celebration consumes `useTrellisData` filter (no new service surface) | source-reading + behavioral | `tests/components/MasonryFeed.celebration.test.mjs` | ❌ Wave 0 |
| Both | tsc -b --noEmit exits 0 | type-check | `cd app && npx tsc -b --noEmit` | ✅ existing CI gate |

### Sampling Rate
- **Per task commit:** `cd app && node --test tests/components/MasonryFeed.layout.test.mjs tests/components/MasonryFeed.celebration.test.mjs` (~3-5s)
- **Per wave merge:** `cd app && npm test` (full suite ~30s)
- **Phase gate:** Full suite green + `tsc -b --noEmit` exit 0 + manual UAT (scroll preservation across `/home → /posts/:id → back`; vine-bloom card visual verification; tile entrance animation visible on refill)

### Wave 0 Gaps
- [ ] `app/tests/components/MasonryFeed.layout.test.mjs` — MASONRY-01 invariants 1, 2, 3, 6
- [ ] `app/tests/components/MasonryFeed.celebration.test.mjs` — MASONRY-02 invariant 5
- [ ] `app/tests/screens/HomeScreen.no-more-posts-toast.test.mjs` — MASONRY-02 invariant 4
- [ ] `app/tests/lib/no-card-slide-in.test.mjs` — invariant 7 (negative grep)

*(These are all behavioral/source-reading tests; no new test infrastructure needed. Existing `_trellis-tsx-loader.mjs` pattern at `app/tests/components/_trellis-tsx-loader.mjs` covers the DOM-rendering behavioral cases.)*

---

## § 1. trellisActionsService surface mapping (Open Item from UI-SPEC)

**Files inspected:** `app/src/services/trellis-actions.service.ts` (148 LOC), `app/src/state/useTrellisData.ts` (47 LOC), `app/src/screens/PlannerScreen.tsx:32-92` (consumer reference).

**Service exports today (verbatim):**

```typescript
export const trellisActionsService = {
  heal(anchorId: string, anchorName: string, qaChildIds: string[]): ActionNavigationResult,
  replant(anchorId: string, anchorQuestion: Question, qaChildIds: string[]): ActionNavigationResult,
  prune(anchorId: string): { pruned: true },
  unpruneQuestion(anchorId: string): void,
  hardDelete(anchorId: string): Promise<void>,
};
```

**The service does NOT today expose:** any `getCelebrationSuggestions()`, `getDailyActions()`, `getSuggestedMoves()`. It owns ACTION HANDLERS (heal/replant/prune navigation result construction); it does NOT own SUGGESTION DERIVATION.

**Where suggestion derivation lives today:** `PlannerScreen.tsx:46-47`:
```typescript
const deadNodes = layout.nodes.filter((n) => n.leafState === 'dead');
const dyingNodes = layout.nodes.filter((n) => n.leafState === 'dying' || n.leafState === 'falling');
```

**Two paths for VineBloomCard:**

| Path | Description | LOC delta | Test surface | Dep direction | Recommendation |
|------|-------------|-----------|--------------|---------------|----------------|
| (a) New `trellisActionsService.getCelebrationSuggestions()` | Add a new getter to the service that returns ≤2 suggestions (priority: 1 dead + 1 dying, or 2 of either if other category empty) | +20-30 LOC service + new behavioral test | Service test + co-located celebration card test | VineBloomCard → trellisActionsService → useTrellisData (or buildTrellisState directly) | Reject — duplicates PlannerScreen filter logic; service surface drift |
| (b) **VineBloomCard consumes `useTrellisData()` directly** | Mirror PlannerScreen.tsx:46-47 inline | +5-10 LOC inside VineBloomCard | Behavioral test of VineBloomCard render | VineBloomCard → useTrellisData (existing) | **Recommended** — no service surface change; pattern matches existing PlannerScreen consumer |

**Recommendation: path (b).** Three reasons:

1. The "what to suggest" filter is structural (`leafState === 'dead' / 'dying' / 'falling'`), not behavioral. Both PlannerScreen and VineBloomCard need exactly the same filter; centralizing it in a service-level helper would be premature abstraction (only 2 callers; identical filter; trivial inline expression).
2. `trellisActionsService` today has a clean separation: it owns navigation result construction (the side-effecty parts: podcast queue add, schedule patches, event emits). Adding suggestion derivation crosses that boundary.
3. UI-SPEC § Open Items independently arrived at the same recommendation: "VineBloomCard owns its own data read, no service surface change."

**`useTrellisData()` recompute triggers (verified):** `REVIEW_COMPLETED`, `GRAPH_UPDATED`, `ANCHOR_DELETED`, `HARVEST_COMPLETED`. When any fires, `layout` re-derives, VineBloomCard re-evaluates suggestions automatically. No additional wiring.

---

## § 2. GAP-C tap detector preservation across the InlineInfoFlow → MasonryFeed swap

**The detector inventory** (CLAUDE.md "Video post completion signals" section) lists 5 detectors:

| # | Detector | Where it lives today | Phase 42 implication |
|---|----------|----------------------|----------------------|
| A | scroll 70% sentinel | `PostDetailScreen.tsx:124-137` | Unchanged — PostDetailScreen not touched |
| B | 30s dwell timer | `PostDetailScreen.tsx:139-149` | Unchanged |
| C | Q&A follow-up | `PostDetailScreen.tsx:406-411` | Unchanged |
| D | YouTube IFrame API postMessage | `PostDetailScreen.tsx` | Unchanged |
| **Video thumbnail-tap inline-play emit** | **`InfoFlow.tsx`** (inside `MemoizedConceptCard` thumbnail onClick) | **MUST stay inside `MemoizedConceptCard`** — MasonryFeed reuses the card verbatim |

**Verified by grep:**

```bash
grep -n "dailyReadService.markExplored\|type:.*CONCEPT_EXPLORED\|enablejsapi=1" app/src/components/InfoFlow.tsx
```

The thumbnail-tap emit is a load-bearing single-emit semantic. The existing test `app/tests/components/InfoFlow.video-tap-emit.test.mjs` enforces:

- `dailyReadService.markExplored` appears EXACTLY ONCE in InfoFlow.tsx
- `type: 'CONCEPT_EXPLORED'` appears EXACTLY ONCE in InfoFlow.tsx

**Critical: MasonryFeed.tsx must NOT add a sibling emit.** Both occurrences must remain in `InfoFlow.tsx` (inside `MemoizedConceptCard`'s thumbnail onClick), traveling with the reused component into MasonryFeed.

**Code paths to preserve verbatim:**

1. `MemoizedConceptCard` (`app/src/components/InfoFlow.tsx:~150-280`) — leaf card; reused by MasonryFeed unchanged.
2. The thumbnail onClick handler inside `MemoizedConceptCard` that fires `dailyReadService.markExplored` + `eventBus.emit({ type: 'CONCEPT_EXPLORED', ... })` + `e.stopPropagation()`. The `enablejsapi=1` query param on the YouTube embed src must remain (Detector D depends on it).
3. The video state management in `InlineInfoFlow.tsx:742-797`:
   - `videoPlaying` state + `setVideoPlaying`
   - `visibilitychange` listener
   - `swipeProgress.on('change')` listener
   - `[location.pathname === '/home']` effect to stop video on intra-app nav
   - `IntersectionObserver` for scroll-out cleanup

   **All 4 of these must port verbatim into MasonryFeed.tsx** since they live in `InlineInfoFlow` (not in the leaf card). MasonryFeed becomes the new owner of `videoPlaying` state.

**Existing test stays valid:** `InfoFlow.video-tap-emit.test.mjs` reads `app/src/components/InfoFlow.tsx` source. Since the emit stays inside `MemoizedConceptCard` (still in `InfoFlow.tsx`), the test continues to pass without modification.

**No new test required for MasonryFeed re GAP-C** — the source-reading guarantee is upstream of MasonryFeed (in InfoFlow.tsx). The behavioral chain (thumbnail click → emit → vine increment) is unchanged.

---

## § 3. HomeScreen always-mounted slot scroll preservation

**Verified architecture:**

- `SwipeTabContainer` keeps all 5 first-level screens (`/home`, `/planner`, `/ask`, `/graph`, `/settings`) always mounted in a horizontal strip (`app/src/components/SwipeTabContainer.tsx:245`).
- HomeScreen's outer scroll container is a `<div>` with `overflowY: 'auto'` owned by HomeScreen itself (`app/src/screens/HomeScreen.tsx`, see `containerRef`).
- When user navigates `/home → /posts/:id`:
  - `/posts/:id` mounts as an `<Outlet>` overlay (`zIndex: 50`) ABOVE the swipe strip.
  - HomeScreen stays mounted underneath — its scroll container's `scrollTop` is preserved automatically because the DOM node is never unmounted.
- When user navigates back `/posts/:id → /home`:
  - The Outlet unmounts; HomeScreen remains visible at its preserved `scrollTop`.

**MasonryFeed inheritance:** MasonryFeed sits inside HomeScreen's scroll container (replacing `<InlineInfoFlow>` at `HomeScreen.tsx:825`). Since the scroll container's DOM node is never unmounted across the nav chain, `scrollTop` persists for free. **No new code required for SC-3.**

**Verification path for SC-3 (manual):**

1. `/home` — scroll down 3 screens of feed.
2. Tap a tile → `/posts/:id` mounts.
3. Press back button → `/home` re-mounts visually.
4. Verify scroll position is preserved (within ~5px tolerance for any sub-pixel rounding).

**Behavioral test (DOM ref pattern):**

```typescript
// Pattern: render HomeScreen, scroll container to N px, navigate away+back, assert scrollTop === N.
// Reference: app/tests/screens/HomeScreen.warm-start-guard.test.mjs (DOM ref pattern existing).
// Trellis tests use `_trellis-tsx-loader.mjs` for tsx imports under node --test.
```

The `[location.pathname === '/home']` resync pattern at `HomeScreen.tsx:514-522` is for **service state** (e.g., `dailyReadService` after Force-New-Day) — NOT for scroll. Scroll is automatic via DOM persistence.

**SC-3 risk assessment: LOW.** Existing architecture covers it. Planner can spec a behavioral test for documentation but it will pass on the first try.

---

## § 4. framer-motion v12 entrance pattern best practices

**Verified findings:**

| Topic | Finding | Source | Confidence |
|-------|---------|--------|-----------|
| `<motion.div>` + `Variants` + `staggerChildren` compatibility | Standard pattern; widely supported | motion.dev React docs, search results from 2026 | HIGH |
| `prefers-reduced-motion` auto-respect | **NOT auto-respected.** Explicit `<MotionConfig reducedMotion="user">` or `useReducedMotion()` required. | motion.dev/docs/react-accessibility (verified 2026-05-09 via WebFetch) | HIGH |
| `useReducedMotion` hook returning `true` when OS setting is on | Correct behavior — returns `true` to gate animations off | motion.dev/motion/use-reduced-motion docs | HIGH |
| `MotionConfig reducedMotion="user"` behavior | Disables transform + layout animations; preserves opacity/color animations | motion.dev React accessibility guide | HIGH |
| Pattern in existing project | Zero `useReducedMotion` / `MotionConfig` / `prefers-reduced-motion` usage anywhere (verified by exhaustive grep) | `grep -rn "useReducedMotion\|MotionConfig\|prefers-reduced-motion" app/src` → 0 matches | HIGH |
| `staggerChildren` cascade through nested div wrappers (e.g., MasonryFeed → column wrapper → tile) | Does NOT auto-cascade. Children must be DIRECT descendants of the variant container, OR each level needs a matching variant. | motion.dev variants docs; pragmatic alternative: per-tile manual `transition.delay` | MEDIUM (well-documented pattern; verifiable in v12 by direct test) |
| `LazyMotion` for bundle-size optimization | Available; not needed for Phase 42 (framer-motion already bundled at full size for existing motion sites) | motion.dev docs | HIGH |
| v12-specific gotchas | `motion` package rename to `motion` (was `framer-motion`) is held to v1.6 per REQUIREMENTS Out-of-Scope line 61 | REQUIREMENTS.md | HIGH |

**Compatibility with `newPostIds` Set pattern:** Confirmed compatible. The `newPostIds` Set determines per-tile `shouldAnimate` boolean; tiles with `shouldAnimate === true` render as `<motion.div>` with `initial="hidden" animate="visible"`. Tiles with `shouldAnimate === false` render as plain `<div>`. No interaction with the Set; framer-motion just animates whatever `<motion.*>` it sees on mount.

**Recommended Phase 42 pattern (combining v12 best practices + Pitfall 1 fix):**

```tsx
import { MotionConfig, motion, type Variants } from 'framer-motion';

// Wrap MasonryFeed (or just the items.map subtree) in MotionConfig
<MotionConfig reducedMotion="user">
  <div style={{ display: 'flex', gap: '8px' }}>
    {/* column wrappers — plain divs */}
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* leaf tiles — motion.div ONLY when shouldAnimate */}
      {colATiles.map((item, idx) => shouldAnimate(item) ? (
        <motion.div key={getId(item)} variants={tileEnterVariants} initial="hidden" animate="visible"
          transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const, delay: idx * 0.04 }}>
          {renderLeaf(item)}
        </motion.div>
      ) : (
        <div key={getId(item)}>{renderLeaf(item)}</div>
      ))}
    </div>
    {/* same for column B */}
  </div>
</MotionConfig>
```

Note: Per Open Question 5, **prefer per-tile manual `transition.delay`** over `staggerChildren` parent-variant cascade since the column-split breaks direct-descendant relationships. Simpler and avoids the dual-variant-cascade complexity.

---

## § 5. Height-accumulating masonry edge cases (resize / async height mutation / contract)

**Question (a): What happens on viewport resize? Do columns rebalance?**

**Answer:** No. Column assignments are immutable (D-02); resize does NOT trigger re-assignment. The column-wrapper flex children stretch with viewport width changes, so individual tile widths change — but tile-to-column assignment stays. This matches `SwipeTabContainer.resize-guard.test.mjs`'s pattern where `resync()` gates on width change but does NOT mutate static state. Trellis is mobile-first; orientation-change rebalance is explicitly deferred (CONTEXT.md Deferred § "Responsive breakpoint").

**Question (b): What happens if a card's height changes after mount (image lazy-load, video aspect ratio resolves)?**

**Answer:** Without `ResizeObserver`, the column-height accumulator grows stale. This causes incremental drift on subsequent refill batches — the next assignment goes to whichever column the accumulator THINKS is shorter, which may not match visual reality. UI-SPEC § Layout Algorithm explicitly recommends `useLayoutEffect` initial measurement only, with `ResizeObserver` deferred until UAT shows visible desync.

**Mitigation strategies (in order of complexity):**

1. **Re-measure from DOM on every `useLayoutEffect` re-run** (instead of incremental add). Simple; adds 1-2ms per refill cycle. Recommended for v1 — see `Example 1` in this RESEARCH.md.
2. `ResizeObserver` per tile (UI-SPEC § Pitfall 5 stub) — enable only if v1 UAT shows visible desync.
3. Per-style fixed-height buckets (REQUIREMENTS Future) — eliminates async height growth entirely; deferred to v1.5.x.

**Question (c): Does the algorithm need a `ResizeObserver`, or is "tiles never move" the actual contract?**

**Answer:** "Tiles never move" IS the contract (D-02 immutability invariant + Pitfall 6). What `ResizeObserver` would help with is: keeping the column-height accumulator in sync with the live DOM, so future tile assignments are correct. It does NOT enable repositioning of existing tiles (that would require dropping immutability).

For v1, the "re-measure from DOM on every useLayoutEffect" approach (mitigation 1 above) gives correctness for the accumulator without `ResizeObserver`'s overhead. UAT validates whether this is sufficient.

---

## § 6. i18n parity gate

**The contract** (CLAUDE.md i18n Workflow):

1. EN canonical authored in `app/src/locales/en.json`.
2. Sonnet subagent prompt at `app/scripts/translate-locales.md` runs once per non-EN locale to produce zh.json, es.json, ja.json updates.
3. Human-review generated translations: proper nouns (don't translate "Trellis", "Spaced Repetition" anchor names), interpolation placeholders (`{{anchor}}`, `{{count}}`), botanical voice ("vine", "bloom", "tending", "heal", "re-plant").
4. All 4 bundles update in the same PR (commit).
5. `tests/locales/bundle-parity.test.mjs` enforces identical key sets across all 4 bundles.

**Phase 42 i18n changes (from UI-SPEC § i18n Bundle Updates):**

**ADD** to `home.celebration.*` namespace in all 4 bundles (12 keys):

```json
"celebration": {
  "vineBloomTitle": "Vine in bloom",
  "suggestionsHeader": "Tomorrow's vine tending",
  "healAction": "Heal '{{anchor}}'",
  "replantAction": "Re-plant '{{anchor}}'",
  "healBadge": "dying",
  "replantBadge": "dead",
  "fallbackHealthy": "Your vine is fully healthy.",
  "fallbackReviewCount": "{{count}} anchor will be due for review tomorrow.",
  "fallbackReviewCount_other": "{{count}} anchors will be due for review tomorrow.",
  "fallbackReviewCountZero": "Check back tomorrow for fresh concepts.",
  "openPlanner": "Open Planner",
  "actionRowAria": "{{action}} {{anchor}} — opens action"
}
```

**DELETE** from all 4 bundles (1 key):

- `home.toast.noMorePosts` — verified single consumer at `HomeScreen.tsx:240` (the toast call deleted in D-11).

**Net key count delta:** +11 keys per bundle (+12 added, −1 deleted). bundle-parity test stays green when the deltas are symmetric.

**Translation guardrails (planner consumes):**

- `Trellis`, `Spaced Repetition`, anchor names (interpolated `{{anchor}}`) — proper noun, never translated.
- `Open Planner` — translate "Open" verb; preserve brand-token "Planner" capitalized in EN; locale conventions apply.
- "vine", "bloom", "tending", "heal", "re-plant", "anchor" — botanical metaphor; preserve botanical voice in each locale.
- `fallbackReviewCount` plural form — i18next built-in `_other` suffix per locale.

**Workflow timing:** Runs after VineBloomCard implementation lands (so EN keys are verified by tsc + behavioral test before non-EN bundles land). Sonnet subagent invocation is part of the planner's task list, not part of the implementation itself.

**Validation commands (run from `app/`):**

```bash
node --test tests/locales/bundle-parity.test.mjs   # asserts identical key sets
node --test tests/locales/missing-key.test.mjs     # asserts fallback renders EN
tsc -b --noEmit                                    # typos in t('...') keys fail compilation
```

---

## § 7. Source-reading invariant test patterns (canonical templates)

**Pattern A: positive presence + negative grep in same file** (`InfoFlow.video-tap-emit.test.mjs`):

```typescript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
const source = readFileSync(SOURCE_PATH, 'utf-8');

describe('Phase XX invariants', () => {
  it('contains the load-bearing pattern (counterweight — proves the test reaches the file)', () => {
    assert.ok(source.includes('loadBearingMarker'), '...');
  });
  it('exact-count match (e.g., emits CONCEPT_EXPLORED EXACTLY ONCE)', () => {
    const matches = source.match(/regex/g) || [];
    assert.equal(matches.length, 1, 'must appear exactly once because ...');
  });
});
```

**Pattern B: cross-tree negative grep** (`engagement-anti-wire.test.mjs`):

```typescript
function walk(dir) { /* recursive .ts/.tsx walker excluding .test.mjs */ }
const ALL_TS = walk(SRC);
test('counterweight: target file IS in scan list AND contains expected marker', () => {
  assert.ok(ALL_TS.includes(TARGET_FILE), '...');
  const source = readFileSync(TARGET_FILE, 'utf8');
  assert.ok(source.match(EXPECTED_RE), '...');
});
test('no source file contains forbidden pattern', () => {
  const offenders = [];
  for (const file of ALL_TS) {
    const source = readFileSync(file, 'utf8');
    if (FORBIDDEN_RE.test(source)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], `${offenders.length} offender(s): ...`);
});
```

**Pattern C: anchor-pair slice for placement assertions** (`HomeScreen.exploredAnchors-resync.test.mjs`):

```typescript
function getSlice() {
  const start = source.indexOf('startMarker');
  const end = source.indexOf('endMarker');
  assert.ok(start !== -1 && end !== -1 && end > start, '...');
  return source.slice(start, end);
}
it('the new code lives in the expected region', () => {
  const slice = getSlice();
  assert.match(slice, /expectedPattern/, '...');
});
```

**Phase 42 test mapping:**

| UI-SPEC test | Pattern | Phase 42 file |
|--------------|---------|---------------|
| #1 motion.div only on leaf tiles | A (positive count) + B (negative grep on HomeScreen) | `tests/components/MasonryFeed.layout.test.mjs` + `tests/screens/HomeScreen.no-motion-div.test.mjs` (or fold into above) |
| #2 NO column-count in MasonryFeed.tsx | A (negative grep within file) | `tests/components/MasonryFeed.layout.test.mjs` |
| #3 NO transform/will-change/etc on root | A (negative grep within file) | `tests/components/MasonryFeed.layout.test.mjs` |
| #4 toast call gone from HomeScreen | A (negative grep within file) | `tests/screens/HomeScreen.no-more-posts-toast.test.mjs` |
| #5 VineBloomCard renders when allExplored | Behavioral (DOM render with mocked services) | `tests/components/MasonryFeed.celebration.test.mjs` |
| #6 column assignment immutable across re-renders | Behavioral | `tests/components/MasonryFeed.layout.test.mjs` |
| #7 card-slide-in keyframe + callsites removed | B (cross-tree negative grep) | `tests/lib/no-card-slide-in.test.mjs` |
| #8 i18n bundle parity | (existing) | `tests/locales/bundle-parity.test.mjs` |

---

## § 8. ROADMAP SC-1 + REQUIREMENTS.md MASONRY-01 wording correction

**Files needing edits with exact line numbers (verified 2026-05-09):**

### `.planning/REQUIREMENTS.md` line 11

**Before:**
```markdown
- [ ] **MASONRY-01** Feed renders as a 2-column masonry layout via CSS `column-count: 2` + `break-inside: avoid`; cards never split across columns
```

**After (recommended):**
```markdown
- [ ] **MASONRY-01** Feed renders as a 2-column masonry layout via height-accumulating JS split (`MasonryFeed.tsx`); cards never split across columns by construction (each tile is rendered atomically inside one column)
```

### `.planning/ROADMAP.md` line 1066

**Before:**
```markdown
- [ ] **Phase 42: Masonry Feed Layout** — `MasonryFeed.tsx` with CSS `column-count: 2` + `break-inside: avoid`; framer-motion entrance animations on leaf cards; vine-bloom end-of-content celebration card
```

**After (recommended):**
```markdown
- [ ] **Phase 42: Masonry Feed Layout** — `MasonryFeed.tsx` with height-accumulating 2-column split (Pinterest/Rednote-style; tiles never move between columns on append); framer-motion entrance animations on leaf cards; vine-bloom end-of-content celebration card
```

### `.planning/ROADMAP.md` line 1141 (Phase 42 Goal)

**Before:**
```markdown
**Goal**: Pinterest-style 2-column masonry feed using CSS `column-count: 2` + `break-inside: avoid`; vine-bloom celebration replaces the bare "no more posts" toast.
```

**After (recommended):**
```markdown
**Goal**: Pinterest-style 2-column masonry feed using a height-accumulating JS split (each new tile drops into the currently shorter column at append time and stays there); vine-bloom celebration replaces the bare "no more posts" toast.
```

### `.planning/ROADMAP.md` line 1145 (SC-1)

**Before:**
```markdown
  1. HomeScreen feed renders as a 2-column masonry layout; no card splits across columns (visual snapshot + DOM-tree test asserting `column-count: 2` + `break-inside: avoid` are present in the rendered styles)
```

**After (recommended):**
```markdown
  1. HomeScreen feed renders as a 2-column masonry layout; no card splits across columns (each tile is rendered atomically inside one of two flex-column wrappers); source-reading test asserts `MasonryFeed.tsx` does NOT use `column-count` / `break-inside` CSS (height-accumulating split chosen per CONTEXT.md D-02)
```

**Recommendation: land all 4 line edits in a SINGLE commit before (or paired with) the source-reading test that asserts the negative.** Suggested commit message:

```
docs(42): correct MASONRY-01 + SC-1 wording — height-accumulating split, not column-count CSS

CONTEXT.md D-02 selected JS height-accumulating split over CSS column-count (the
latter shuffles existing tiles between columns when new ones append — bad UX).
Update REQUIREMENTS.md MASONRY-01 + ROADMAP.md Phase 42 goal/SC-1 wording to
match. Verifier source-reading test now asserts the NEGATIVE (column-count CSS
absent from MasonryFeed.tsx) instead of the positive.
```

**Why not scope creep:** CONTEXT.md D-02 explicitly flags this as "a mechanical wording adjustment landed inside Phase 42, not a scope change." The user-visible contract (2-column masonry, no card splits) is identical; only the implementation mechanism differs.

---

## Sources

### Primary (HIGH confidence)

- **Live source files (read directly via Read tool, 2026-05-09):**
  - `app/src/services/trellis-actions.service.ts` — service surface mapping
  - `app/src/state/useTrellisData.ts` — hook subscription targets
  - `app/src/services/daily-read.service.ts` — getExploredAnchors API
  - `app/src/services/infiniteScroll.service.ts` — confirmed `allExplored` is NOT exposed
  - `app/src/services/concept-feed.service.ts` (line 1591) — `allExplored` is local const
  - `app/src/screens/HomeScreen.tsx` — InlineInfoFlow site, toast site, scroll container, resync effects
  - `app/src/screens/PlannerScreen.tsx` (lines 32-92) — suggestion derivation pattern
  - `app/src/components/InfoFlow.tsx` (lines 700-925) — InlineInfoFlow + MemoizedConceptCard + MilestoneCard + 3 card-slide-in callsites
  - `app/src/index.css` (lines 504-507) — card-slide-in keyframe definition
  - `app/package.json` — verified framer-motion@12.38.0
  - `app/node_modules/framer-motion/package.json` — confirmed installed version
  - `app/tests/components/InfoFlow.video-tap-emit.test.mjs` — canonical positive-count + negative-grep test pattern
  - `app/tests/services/engagement-anti-wire.test.mjs` — canonical cross-tree negative grep pattern with counterweight
  - `app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs` — canonical anchor-pair slice pattern
  - `.planning/REQUIREMENTS.md` (line 11) — MASONRY-01 wording to correct
  - `.planning/ROADMAP.md` (lines 1066, 1141, 1145) — Phase 42 entries to correct
  - `CLAUDE.md` — Header positioning, Concept Feed Pipeline, GAP-C, i18n Workflow rules

- **42-CONTEXT.md** — Locked decisions D-01..D-11
- **42-UI-SPEC.md** — Approved 6/6 dimensions; framer-motion variants verbatim; algorithm verbatim; SVG verbatim; 12 i18n keys verbatim
- **42-DISCUSSION-LOG.md** — Audit trail of D-02 selection rationale (column shuffle problem)

### Secondary (MEDIUM confidence — verified against official source)

- **WebFetch motion.dev/docs/react-accessibility (2026-05-09)** — confirmed `prefers-reduced-motion` is opt-in, not default, in framer-motion v12. CRITICAL contradiction with UI-SPEC line 328's claim. Single-source but authoritative (motion.dev is the official framer-motion docs domain).
- **WebSearch "framer-motion v12 useReducedMotion staggerChildren prefers-reduced-motion 2025"** — multiple results align (motion.dev docs + dev.to articles + Refine guide). Confirms opt-in via `<MotionConfig reducedMotion="user">` or `useReducedMotion()` hook.

### Tertiary (LOW confidence — flagged for validation)

- None. All Phase 42 research findings were verified against live source code or official docs.

---

## Metadata

**Confidence breakdown:**

- **Standard stack:** HIGH — framer-motion v12.38.0 verified at the file level; lucide-react/i18next/react versions verified in `package.json`. Zero new dependencies.
- **Architecture:** HIGH — UI-SPEC's height-accumulating algorithm is verbatim verified; existing project's GAP-C / always-mounted / scroll-container patterns directly verified in source.
- **Pitfalls:** HIGH — Pitfall 1 (reduced-motion) verified against motion.dev docs + project-wide grep. Pitfall 2 (`allExplored` not service state) verified by exhaustive grep. Pitfall 3 (wording correction) verified by exact line-number reads.
- **Trellis-actions surface mapping (§ 1):** HIGH — full file read; PlannerScreen consumer pattern read; recommendation matches UI-SPEC's independent recommendation.
- **GAP-C preservation (§ 2):** HIGH — existing test read; emit sites identified by direct source inspection; CLAUDE.md "Video post completion signals" section verified.
- **Scroll preservation (§ 3):** HIGH — SwipeTabContainer architecture verified by source inspection; existing HomeScreen resync pattern at lines 467-522 confirmed.
- **framer-motion v12 best practices (§ 4):** HIGH — official motion.dev docs verified via WebFetch; existing project usage pattern grepped exhaustively.
- **Masonry edge cases (§ 5):** MEDIUM — UAT-determinable; recommendations are based on UI-SPEC's "ship simpler first" principle.
- **i18n parity (§ 6):** HIGH — CLAUDE.md i18n Workflow + UI-SPEC § i18n Bundle Updates align; existing bundle-parity test confirmed working.
- **Source-reading test patterns (§ 7):** HIGH — 3 existing canonical tests read in full.
- **Wording correction (§ 8):** HIGH — exact line numbers verified; replacement text aligned with D-02 rationale.

**Research date:** 2026-05-09
**Valid until:** 2026-06-08 (30 days — stable; framer-motion v13/motion rename held to v1.6 per REQUIREMENTS line 61, so v12 best practices stay current; no other moving parts)

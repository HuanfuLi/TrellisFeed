---
phase: 42-masonry-feed-layout
status: ready-for-planning
gathered: 2026-05-09
requirements: [MASONRY-01, MASONRY-02]
---

# Phase 42: Masonry Feed Layout — Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the single-column flex feed at `InfoFlow.tsx:841` (`InlineInfoFlow`) with a Pinterest/Rednote-style 2-column masonry layout via a new `app/src/components/MasonryFeed.tsx` component. Add framer-motion entrance animations to leaf tiles. Replace the bare `HomeScreen.tsx:240` "no more posts" toast with a vine-bloom celebration card carrying suggested-tomorrow plan content sourced from `trellisActionsService` (with a static-copy fallback when no suggestions exist).

**Files in scope (3):**

1. `app/src/components/MasonryFeed.tsx` — **NEW.** 2-column masonry implementation using a height-accumulating split (NOT CSS `column-count`). Owns the `items.map` loop equivalent to today's `InlineInfoFlow`. Renders `<motion.div>` per tile (framer-motion entrance only on newly-appended items via the existing `newPostIds` Set pattern). Renders the vine-bloom celebration card as the LAST tile (full-width, spans both columns) when `allExplored` is true.
2. `app/src/screens/HomeScreen.tsx` — Swap `<InlineInfoFlow>` for `<MasonryFeed>`. Delete the `toast(t('home.toast.noMorePosts'), 'info')` call at line 240; the celebration card replaces it.
3. `app/src/components/InfoFlow.tsx` — `InlineInfoFlow` stays in this file for any future non-masonry surface (PostDetailScreen reuse, etc.) but is no longer wired at `/home`. The card child components (`MemoizedConceptCard`, `ConnectionCard`, `MilestoneCard`) are unchanged and consumed by both `MasonryFeed` and `InlineInfoFlow`. Remove the `card-slide-in` CSS keyframe (no longer used; framer-motion replaces it).

**Out of scope for Phase 42 (Phase 43 owns):**

- "Deep dive" button on PostDetailScreen
- Long-press contextual menu (Like / Save / Not interested)
- Saved-posts view route
- `engagementService.reset()` in Force-New-Day
- "N connections in your graph" micro-label
- HomeScreen `ANCHOR_DISMISSED` re-sync effect

**Out of scope for Phase 42 (deferred):**

- Per-style tile height buckets (REQUIREMENTS "Future")
- Loading skeleton tiles during refill (REQUIREMENTS "Future")
- Pull-to-refresh gesture (REQUIREMENTS "Future")
- Responsive 1-column collapse on very narrow viewports (Trellis is mobile-first; no responsive breakpoint added)

</domain>

<decisions>
## Implementation Decisions

### Component shape & boundary

- **D-01:** **New `app/src/components/MasonryFeed.tsx` replaces `InlineInfoFlow` at `/home`.** `InlineInfoFlow` stays in `InfoFlow.tsx` for non-masonry consumers but is no longer wired at `/home`. Mild duplication of the items.map skeleton (~30 LOC) is acceptable and matches the ROADMAP's verbatim file naming. Sibling to `InfoFlow.tsx` in `components/` (matches existing flat organization — `InfoFlow.tsx`, `ChatInput.tsx`, `Markdown.tsx` all live flat).

### Card-flow ordering

- **D-02:** **Height-accumulating 2-column split** (NOT CSS `column-count`).
  - `MasonryFeed` maintains two height accumulators (e.g., via `useRef<number[]>([0, 0])` plus a `ResizeObserver` per tile, or a `useLayoutEffect` measurement pass after each render).
  - Each new tile drops into whichever column is currently shorter at assignment time. Once assigned, a tile's column is **immutable** — it never moves between columns on re-render or refill.
  - Tie-breaker (both columns exactly equal): default to column-A (left).
  - `items[]` arrives in the existing `concept-feed` mixer order — `spreadByConcept` then `spreadByStyle` invariants are preserved at the interleave level. Height-accumulation only chooses which column a pre-mixed item lands in.
  - **ROADMAP SC-1 wording adjustment:** "column-count: 2 + break-inside: avoid" wording will be relaxed during this phase to "2-column masonry layout via height-accumulating split" — same user-visible result, accurate to the actual mechanism. **This is a mechanical wording adjustment landed inside Phase 42, not a scope change.** RESEARCH/planning must update the ROADMAP entry alongside the implementation to keep verifier assertions aligned.
  - **Why height-accumulating over parity-based or CSS-default:** (a) CSS `column-count: 2` re-balances column heights when new tiles append → existing tiles can shuffle between columns mid-scroll (bad UX). (b) Parity-based split (`items[i % 2]`) is stable but can desync columns when tall tiles bunch on one parity. (c) Height-accumulating is the de facto Pinterest/Rednote/Bilibili pattern: visual balance + tile stability + ~10 LOC of JS.

### Framer-motion entrance pattern

- **D-03:** **`<motion.div>` on leaf tiles only** — NOT on the scroll container (`HomeScreen` flex), NOT on `MasonryFeed`'s root, NOT on the column wrappers. SC-4 source-reading test asserts this at the codebase level.
- **D-04:** **Animation fires only on newly-appended tiles** via the existing `newPostIds` Set (already tracked at `InfoFlow.tsx:843`). Initial mount of cached posts is silent (cold-start feels instant; no waiting for stagger to finish before scrolling). When `swipe-for-more` refill drops 4 new tiles, those 4 stagger in. Initial-mount-stagger and `whileInView` rejected: former feels repetitive on every `/home` navigation (HomeScreen is always-mounted; effects re-fire); latter distracts on long sessions.
- **D-05:** **Timing: 250ms duration, 40ms stagger, ease-out.** Fade-up from `translateY(8px)` + opacity 0 → 1. Matches Material Design "standard easing" + Phase 28 UI-polish pacing. 4 newly-appended tiles complete in ~370ms total; doesn't block scroll.
- **D-06:** **Drop the existing `card-slide-in` CSS keyframe** from `InfoFlow.tsx` entirely. framer-motion handles `prefers-reduced-motion` natively (animations become instant when the OS setting is on). One animation system, not two.

### Vine-bloom celebration card

- **D-07:** **Visual: inline SVG vine illustration with bloom.** Hand-authored ~30 LOC SVG matching the existing `vineLoadingPulse` SVG aesthetic at `HomeScreen.tsx:759-767` (botanical brand language; vine = knowledge graph metaphor). framer-motion path animation may draw the vine on mount for an extra moment of delight (Claude's discretion at planning time). No new asset file; everything inline.
- **D-08:** **Suggested-tomorrow plan content: pull from `trellisActionsService`.** Reuse the existing Phase 26 service that produces heal / replant / prune suggestions for the Planner. Card surfaces 1-2 concrete next-day actions ("Review 'Spaced Repetition' (dying)", "Re-plant 'Transformer Attention' (dead)"). Each action item is tappable and routes to `/planner` (or directly to the relevant `/posts/anchor-post-{id}` for replant per Phase 26's existing handler).
- **D-09:** **Fallback when `trellisActionsService` returns no suggestions** (best case — user's mindmap is fully healthy): card shows static encouraging copy + anchor count derived from `dailyReadService.getExploredAnchors().size` and the SM-2 due-tomorrow count. Example copy: "Your vine is fully healthy. N anchors will be due for review tomorrow." Fully i18n-able into all 4 locales.
- **D-10:** **Placement: bottom of feed as the LAST tile, full-width spanning BOTH columns** when `allExplored` is true. Implementation: render the celebration card AFTER the items.map loop with a wrapper that escapes the 2-column split (e.g., a separate `<div>` after the two column `<div>`s, or a tile that gets a `gridColumn: '1 / -1'` if the column wrappers use grid internally). The celebration tile is NOT subject to height-accumulation — it always spans both columns. User naturally arrives at it when they reach the end of the feed.
- **D-11:** **Delete `toast(t('home.toast.noMorePosts'), 'info')` at `HomeScreen.tsx:240` entirely.** The celebration card is the new signal for "no more posts to serve today." `handleLoad`'s `else` branch (when `getMorePosts()` returns no posts) becomes a no-op or sets a state flag that triggers the `allExplored` celebration render. The `home.toast.noMorePosts` i18n key may be deleted from all 4 bundles (Claude's discretion at planning time — verify no other consumer first).

### Carried-Forward Decisions (Locked by Prior Phases / ROADMAP / REQUIREMENTS — NOT Re-Discussed)

- **CSS-only masonry primitive forbidden** (REQUIREMENTS Out-of-Scope line 60): no CSS Grid Masonry (`grid-template-rows: masonry` — Capacitor 8 Android WebView lag). No JS masonry libraries (`masonic`, `@virtuoso.dev/masonry` — REQUIREMENTS dependency-discipline). Pure inline JS height-accumulating split is what Phase 42 ships.
- **File name `MasonryFeed.tsx`** — ROADMAP line 1066 names this verbatim; preserved.
- **framer-motion already installed at v12.38.0** — no new dependency. v13 / motion package rename held to v1.6 (REQUIREMENTS Out-of-Scope line 61).
- **Phase 38 removed `'short'` post type** — actual style mix is image / text-art / video / news / suggestion / milestone / connection. ROADMAP SC-2 enumeration (which still says "image / text-art / video / short / news") is stale on `short`; phase planner should treat the live PresentationStyle union as canonical.
- **HomeScreen scroll-preservation is automatic** via SwipeTabContainer always-mounted slot. SC-3 verified by inspection; no new code required for the `/home → /posts/:id → back` scroll-survival case.
- **No `transform` / `will-change` / `filter` / `contain` / `perspective`** on any ancestor of `Header` (CLAUDE.md "Header positioning" load-bearing). MasonryFeed and its column wrappers MUST NOT introduce these properties.
- **Phase 36 GAP-C tap detectors** (thumbnail tap-emit, click bubble, postMessage listener, navigate to PostDetailScreen) MUST keep firing on every tile post-layout-switch. MasonryFeed is layout-only; the card components retain their existing onClick/onOpen handlers verbatim.
- **Atomic per-file commits + source-reading invariant test pattern** (Phase 37 D-03 / Phase 39 anti-wire pattern). Phase 42 expects ~4-7 atomic commits with source-reading + behavioral tests for: (a) MasonryFeed renders 2 columns, (b) tiles never move between columns on refill, (c) framer-motion `<motion.div>` lives on leaf tiles only, (d) celebration card renders when `allExplored`, (e) `noMorePosts` toast call is gone.
- **No new event types** — vine-bloom triggers off existing `dailyReadService.getExploredAnchors()` + `infiniteScrollService.allExplored` state. CLAUDE.md "one signal per semantic event" rule preserved.
- **i18n parity gate** — all 4 locale bundles (en/zh/es/ja) must update together for any new strings (vine-bloom card copy, fallback copy, action button labels). `bundle-parity.test.mjs` is the standing gate.

### Claude's Discretion

- **Exact stagger timing curve nuances** — within the 250ms / 40ms / ease-out band, planner picks the precise framer-motion easing function (`[0.25, 0.1, 0.25, 1]` vs the named `'easeOut'` etc.).
- **SVG vine path geometry** — the actual stroke commands, viewport size, color tokens. Should reference existing CSS vars (`--primary-40` vine, `--node-peach` bloom).
- **Masonry inter-tile gap value** — recommend 12px to match the existing `gap: 12px` on the current single-column flex (`InfoFlow.tsx:841`). Operator can tune.
- **Column wrapper layout primitive** — `display: flex; flexDirection: column` per column vs CSS Grid with 2 explicit columns. Recommend flex (simpler; column-span trick for celebration tile uses absolute positioning or a separate sibling `<div>` after both column wrappers).
- **Tile measurement strategy** — `useLayoutEffect` post-render measurement vs `ResizeObserver` per-tile. Recommend `useLayoutEffect` on initial mount + on `items` length change; `ResizeObserver` only if tile heights mutate post-mount (e.g., async image load) and visibly desync the columns. Phase 41-style "ship the simpler thing first; add complexity if UAT shows the simpler one regresses."
- **Whether to use framer-motion's `whileInView` vs the existing `newPostIds` Set** for the trigger — recommend `newPostIds` (consistency with existing UX; one source of truth for "what's new"). `whileInView` would re-fire on scroll-back-up.
- **Test file naming** — `tests/components/MasonryFeed.layout.test.mjs` (column split + stability) + `tests/components/MasonryFeed.celebration.test.mjs` (allExplored render path) + `tests/screens/HomeScreen.no-more-posts-toast.test.mjs` (negative grep — toast call gone). Planner can collapse if preferred.
- **Whether the celebration card itself gets a different (showier) entrance animation** than regular tiles — recommend a subtle path-draw on the SVG bloom + standard framer fade-up on the card container. Operator UAT will guide.
- **Whether `home.toast.noMorePosts` i18n key is deleted from all 4 bundles** — recommend yes after grep confirms no other consumer; subtract 1 key from each bundle, parity test stays green.
- **Whether `InlineInfoFlow` should remain exported from `InfoFlow.tsx` for future reuse** — recommend yes (no harm; future PostDetailScreen surfacing or Trellis screen could reuse). Phase 42 simply de-wires it from `/home`; doesn't delete.

### Folded Todos

- **`2026-05-07-double-column-feed-to-further-mimic-rednote-bilibili-info-flow.md`** — DIRECTLY this phase. The todo describes exactly the surface Phase 42 builds (2-column masonry mimicking Rednote/Bilibili); its "Solution" section's recommendation #2 (manual 2-column masonry tracking column heights) maps verbatim to D-02's height-accumulating split. The todo's listed `files`: `app/src/components/InfoFlow.tsx` + `app/src/screens/HomeScreen.tsx` align with this phase's `files in scope`. Folded into Phase 42 scope; the todo file should be moved from `pending/` to `closed/` at phase close.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 42 specs

- `.planning/ROADMAP.md` lines 1066, 1140-1151 — Phase 42 entry: goal, depends-on, requirements (MASONRY-01, MASONRY-02), 5 success criteria, plans-TBD. **Note:** SC-1 wording references `column-count: 2` + `break-inside: avoid` literally — this will be adjusted during Phase 42 to "2-column masonry layout via height-accumulating split" per D-02; SC-2 enumeration is stale on `'short'` (Phase 38 removed it).
- `.planning/REQUIREMENTS.md` lines 11, 12, 70, 71 — MASONRY-01 + MASONRY-02 acceptance language + traceability rows.
- `.planning/REQUIREMENTS.md` line 60 — Out-of-Scope CSS Grid Masonry rationale (Capacitor 8 Android WebView lag).
- `.planning/REQUIREMENTS.md` lines 51-52 — Future deferrals (per-style tile height buckets, loading skeleton tiles).

### Folded todo (in scope)

- `.planning/todos/pending/2026-05-07-double-column-feed-to-further-mimic-rednote-bilibili-info-flow.md` — operator todo describing exact phase surface; rationale for height-accumulating split; constraint cross-checks (lazy-skip walker, header positioning, GAP-C detectors). Move to `.planning/todos/closed/` at phase close.

### Live source-of-truth files for change

- `app/src/components/InfoFlow.tsx:740-925` — `InlineInfoFlow` component (current single-column flex feed at `:841`). Reference for `MasonryFeed`'s items.map shape, `newPostIds` Set tracking, per-tile `data-feed-id` / `data-concept-id` attributes (preserve in MasonryFeed). `card-slide-in` CSS keyframe to remove.
- `app/src/components/InfoFlow.tsx:700-738` — `MilestoneCard` definition. Closest existing precedent for celebration-style tile UX.
- `app/src/screens/HomeScreen.tsx:240` — `toast(t('home.toast.noMorePosts'), 'info')` call site to delete (D-11).
- `app/src/screens/HomeScreen.tsx:730-749` — existing empty-state UI (different from `allExplored` — this is "no questions / generation error"; preserve unchanged).
- `app/src/screens/HomeScreen.tsx:759-767` — `vineLoadingPulse` SVG (botanical brand reference for D-07's celebration vine).
- `app/src/screens/HomeScreen.tsx:824-832` — `<InlineInfoFlow>` JSX site to swap for `<MasonryFeed>`.
- `app/src/services/concept-feed.service.ts` — `spreadByConcept` + `spreadByStyle` mixer (preserved at the interleave level; height-accumulation only picks columns).
- `app/src/services/dailyRead.service.ts` — `getExploredAnchors()` reader (consumed by celebration `allExplored` detection).
- `app/src/services/infiniteScroll.service.ts` — `allExplored` state (consumed by celebration trigger).

### Trellis actions service (consumed by celebration card)

- `app/src/services/trellis-actions.service.ts` — Phase 26 service. Need to check exact API surface during planning (`getSuggestedMoves`? `getDailyActions`?) and the return shape (heal / replant / prune objects). RESEARCH should map this surface explicitly so the celebration card's content prop is well-typed.
- `.planning/phases/26-trellis-harvest-panel/` — Phase 26 archive. Action handlers reference + Suggested Moves UX precedent.

### Load-bearing CLAUDE.md sections

- `CLAUDE.md` "Header positioning (Phase 32.1 — load-bearing)" — **MasonryFeed and its column wrappers MUST NOT add `transform` / `will-change` / `filter` / `contain` / `perspective`.** Header in-tree depends on the slot's `translateZ(0)` being the only containing-block creator on its ancestor chain.
- `CLAUDE.md` "Concept Feed Generation Pipeline (load-bearing)" — Phase 42 does NOT touch the pipeline; mixer order (spreadByConcept then spreadByStyle) is preserved at the interleave level.
- `CLAUDE.md` "Always-mounted screens must explicitly re-read service state on navigation" — HomeScreen's existing `[location.pathname]` effects are preserved; MasonryFeed inherits scroll-preservation automatically (SC-3).
- `CLAUDE.md` "Video post completion signals (Phase 36 GAP-C, generalized in Phase 38 — load-bearing)" — thumbnail tap-emit + Detector D postMessage MUST keep firing on every tile post-switch. MasonryFeed is layout-only; card child components retain their handlers verbatim.
- `CLAUDE.md` "Best practices learned in Phase 32.1" rule 3 — `position: fixed` + `overflow: auto` + Android WebView is a recurring bug class. MasonryFeed's height-accumulation must NOT depend on `position: fixed` on column wrappers.
- `CLAUDE.md` "i18n Workflow" — all 4 locale bundles update together for any new strings; `bundle-parity.test.mjs` enforces.
- `CLAUDE.md` "Best practices learned in Phase 32.1" rule 2 — tests must guard the LIVE code path. Phase 42 source-reading tests should target `MasonryFeed.tsx`, NOT the dead `InlineInfoFlow` (which remains in `InfoFlow.tsx` post-Phase-42 but is no longer wired at `/home`).

### Pattern precedents

- `app/src/components/InfoFlow.tsx:740` `InlineInfoFlow` — items.map shape MasonryFeed mirrors (with column-split logic added).
- `app/src/components/InfoFlow.tsx:700` `MilestoneCard` — closest existing celebration-style tile UX; reference for vine-bloom card visual structure.
- `app/src/screens/HomeScreen.tsx:759-767` — `vineLoadingPulse` SVG aesthetic; reference for D-07's vine illustration tone.
- Phase 39/40 anti-wire test pattern (`engagement-anti-wire.test.mjs`, `source-diversity-anti-wire.test.mjs`) — pattern for Phase 42's source-reading invariants ("`<motion.div>` only on leaf tiles", "no `column-count` CSS in MasonryFeed", "no toast call in HomeScreen.handleLoad").
- Phase 41 atomic per-task commit cadence + paired source+test commits (5-7 atomic commits per plan).

### External resources (no specs to read for v1.5)

- framer-motion `<motion.div>` + stagger docs (`https://motion.dev/docs/react-quick-start`) — informational reference for D-04/D-05 implementation idioms.
- Pinterest engineering blog on masonry layout (informational reference for height-accumulating split rationale).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`MemoizedConceptCard`, `ConnectionCard`, `MilestoneCard`** (`InfoFlow.tsx:700+`) — leaf card components consumed by MasonryFeed verbatim. No changes needed; MasonryFeed simply rearranges them in 2 columns.
- **`newPostIds` Set tracking** (`InfoFlow.tsx:843`) — already differentiates "newly appended" from "already on screen." MasonryFeed inherits this pattern for D-04's framer-motion trigger.
- **`vineLoadingPulse` SVG** (`HomeScreen.tsx:759-767`) — botanical brand reference; D-07's celebration vine matches this aesthetic.
- **`dailyReadService.getExploredAnchors()`** — count-only reader for D-09's anchor-count fallback.
- **`infiniteScrollService.allExplored`** — boolean trigger for D-10's celebration card render.
- **`trellisActionsService` (Phase 26)** — heal / replant / prune suggestions for D-08's celebration card content.
- **`framer-motion` v12.38.0** — already installed; `<motion.div>` + `Variants` + `staggerChildren` standard idioms apply.
- **`useTranslation` + `t(...)`** — i18n surface; new strings land in en.json + zh/es/ja parity (D-09 fallback copy + celebration card action labels).

### Established Patterns

- **Inline styles with CSS variables** (NOT Tailwind) — MasonryFeed follows the existing convention (see HomeScreen, InfoFlow style props).
- **Always-mounted screen state-resync** (CLAUDE.md) — HomeScreen handles this; MasonryFeed inherits no new responsibility (it's a child of HomeScreen).
- **Singleton service consumption** — `trellisActionsService.<getter>()` at celebration card render time; pattern matches `engagementService.getDismissedAnchorIds()` consumption in `concept-feed.service.ts:1234`.
- **Atomic per-file commits** (Phase 37 D-03; Phase 39/40/41 cadence) — Phase 42 expects 4-7 atomic commits.
- **Source-reading invariant tests** (Phase 27/35/37/39/40/41) — Phase 42 adds source-reading assertions for: (a) `<motion.div>` only on leaf tiles in MasonryFeed.tsx, (b) NO `column-count` in MasonryFeed.tsx (negative grep — sentinel for the height-accumulating choice), (c) `toast(...noMorePosts...)` call gone from HomeScreen.tsx, (d) MasonryFeed renders the celebration card when `allExplored`.

### Integration Points

- **`HomeScreen.tsx:824-832`** — `<InlineInfoFlow>` JSX site. Phase 42 swaps the component import at the top of HomeScreen and the JSX usage here.
- **`HomeScreen.tsx:240`** — `toast(t('home.toast.noMorePosts'), 'info')` call to delete. Surrounding `else` branch becomes a no-op or sets a state flag.
- **`InfoFlow.tsx` `card-slide-in` CSS keyframe** — delete (D-06). Verify no other component references it before deletion.
- **`app/src/locales/{en,zh,es,ja}.json`** — add new keys (suggested: `home.celebration.vineBloomTitle`, `home.celebration.suggestionsHeader`, `home.celebration.fallbackHealthy`, `home.celebration.fallbackReviewCount`, `home.celebration.openPlanner`); subtract deprecated `home.toast.noMorePosts` after grep confirms no other consumer. Bundle-parity test stays green.
- **`InfoFlow.tsx`** — keep `InlineInfoFlow` exported (D-01); unused at /home but available for future surfaces.

</code_context>

<specifics>
## Specific Ideas

- **Operator's Rednote/Bilibili reference is the visual benchmark.** Height-accumulating split (D-02) is the de facto pattern these feeds use. The Pinterest mobile app does the same. Operator confirmed Option 3 over Option 1 (CSS column-count) and Option 2 (parity-based) once the column-shuffle and column-desync risks were spelled out.
- **ROADMAP SC-1 wording must be relaxed during Phase 42.** The literal "column-count: 2 + break-inside: avoid present in the rendered styles" assertion conflicts with D-02's height-accumulating split. The wording adjustment is purely mechanical and lands as part of Phase 42's commits — this is NOT scope creep, it's correcting a planning-time imprecision discovered during discuss-phase. Verifier assertions and the SC-1 source-reading test must align with the new wording.
- **Phase 38's `'short'` removal was missed in the ROADMAP SC-2 enumeration.** SC-2 still says "image / text-art / video / short / news produce visually distinct tile heights"; the canonical PresentationStyle union now omits `'short'`. Planner should treat the live union as canonical and not regress.
- **`trellisActionsService` API surface needs to be mapped at planning time** — the celebration card's content prop depends on the exact return shape (action type, anchor reference, copy template). RESEARCH should enumerate the available getters and pick the one that returns the heal/replant/prune list closest to "tomorrow's recommended moves." If no such getter exists, planning may need a small extension (read-only wrapper).
- **The celebration card spans BOTH columns** (D-10) — this is a layout exception inside MasonryFeed. Implementation choices: (a) render the celebration card AFTER both column wrappers as a sibling, (b) use grid with `gridColumn: '1 / -1'` if column wrappers use grid internally. Either works; recommend (a) for simplicity since the column wrappers are the height-accumulator buckets and shouldn't have grid semantics anyway.
- **framer-motion `<motion.div>` only on leaf tiles** (D-03) is a structural invariant that MUST be source-reading-tested. SC-4's verbatim wording in ROADMAP is a load-bearing assertion: "framer-motion entrance animations apply to leaf `<motion.div>` cards only, not to the scroll container or InfoFlow root."
- **Operator chose all 4 gray areas to discuss** — pattern: prefer concrete user-facing decisions over delegating to Claude's discretion when the design is novel (this is a brand-new feed layout, not a tweak to existing surfaces).

</specifics>

<deferred>
## Deferred Ideas

### Out of Phase 42 scope (Phase 43 owns)

- "Deep dive" button on PostDetailScreen — Phase 43 SC-3.
- Long-press contextual menu (Like / Save / Not interested) — Phase 43 SC-1.
- Saved-posts view route — Phase 43 SC-2.
- `engagementService.reset()` in Force-New-Day — Phase 43 SC-6.
- "N connections in your graph" micro-label — Phase 43 SC-4.
- HomeScreen `ANCHOR_DISMISSED` re-sync effect — Phase 43 SC-5.

### Out of Phase 42 scope (deferred to v1.5 backlog or later)

- **Per-style tile height buckets** — REQUIREMENTS Future. Visual rhythm refinement (e.g., text-art always ~140px, video always ~320px). Not needed for Phase 42's correctness; can land in v1.5.x polish or a future content-curation phase.
- **Loading skeleton tiles during refill** — REQUIREMENTS Future. Layout-shift prevention nicety; not in scope.
- **Pull-to-refresh gesture** — REQUIREMENTS Future. Low priority.
- **Responsive breakpoint** for very narrow viewports (1-column collapse below e.g. 360px) — Trellis is mobile-first; no current device profile in fleet would trigger this. Defer until signal.
- **Celebration card showier animation** (path-draw on SVG bloom + spring-y entrance) — Claude's discretion at planning time; if it lands as part of D-07's SVG implementation, fine; if deferred, operator UAT will guide.

### Outside v1.5 entirely

- **`@tanstack/react-virtual` or react-window** for very long feed virtualization — current InfoFlow doesn't virtualize; Phase 42 doesn't add virtualization. Defer until perf signal.
- **Drag-and-reorder of feed tiles** — speculative; not in any roadmap.
- **Per-tile context menu** (long-press for tile-level actions distinct from Phase 43's long-press for engagement) — Phase 43 owns the long-press surface.
- **CSS Grid Masonry (`grid-template-rows: masonry`)** — REQUIREMENTS explicitly out-of-scope for v1.5 (Capacitor 8 Android WebView). Revisit when Capacitor supports it cleanly.
- **Animation-richer celebration moments** (confetti, gold bar, particle effects) — `HomeScreen.tsx:556` already references a "gold bar + confetti" celebration on completion (separate flow); Phase 42 keeps the existing celebration code path unchanged and only replaces the "no more posts" toast with the vine-bloom card.

### Reviewed Todos (not folded)

- `2026-05-07-fix-cosine-similarity-threshold-cache-miss.md` — unrelated subsystem (embedding pre-check, Phase 33 follow-up); not Phase 42 scope.
- `2026-05-09-inspect-auto-gen-podcast-working-or-not-and-debug.md` — already addressed (architectural limitation captured in `~/.claude/projects/-Users-Code-EchoLearn/memory/project_serverless_no_background_tasks.md`); not Phase 42 scope.

</deferred>

---

*Phase: 42-masonry-feed-layout*
*Context gathered: 2026-05-09*

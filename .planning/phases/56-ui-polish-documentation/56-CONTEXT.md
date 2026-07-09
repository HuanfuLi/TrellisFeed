# Phase 56: UI Polish & Documentation - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Sweep all screens against a UI-polish checklist and fix identified spacing/alignment/visual-hierarchy issues; fix janky/broken animations within the Android WebView budget (no new motion); audit navigation end-to-end with emphasis on Android back-button behavior; archive or update stale docs in `Documents/` and `.planning/`; and verify CLAUDE.md load-bearing sections against current code.

This is a sweep/audit + reconciliation phase. It does NOT add new product capabilities, redesign screens, or introduce new animation/motion language. Polish fixes must not regress the load-bearing invariants documented in CLAUDE.md (Header portal-vs-in-tree, root-overflow clip on both axes, SwipeTabContainer resize/keyboard guards).

Requirements: POLISH-01, POLISH-02, POLISH-03, DOCS-01, DOCS-02.

</domain>

<decisions>
## Implementation Decisions

### Polish Discovery & Triage (POLISH-01)
- **D-01:** Discovery is **hybrid** — an agent visual audit (gsd-ui-auditor 6-pillar style) produces the candidate findings list; the operator triages (approve / cut / add) before any fix lands. Agents fix only approved items.
- **D-02:** Audit covers **all screens at equal depth** — no high-traffic prioritization. Includes the 5 swipe-tab roots (Home, Ask, Planner, Graph, Settings) plus every sub-screen: PostDetail, AnchorDetail, ClusterDetail, QuestionDetail, CollectionDrillIn, Review, Podcast, Saved, Onboarding, and all `settings/` sub-pages.
- **D-03:** **Fresh audit** from current code — do NOT use the Apr-16 `Documents/UI_AUDIT_REPORT.md` as a baseline (it predates i18n, masonry feed, SQLite migration, Trellis rework). Archive that old report to `Documents/Legacy/`.

### Animation (POLISH-02)
- **D-04:** **Fix-janky-only.** Repair stutter/flicker/dropped-frame issues in EXISTING animations; add NO new motion or micro-interactions. Conservative stance reflects the 2026-04-15 tab-transport revert (animation removed because it was "flickery").
- **D-05:** When an existing animation cannot be made smooth within the WebView budget, the auditor proposes **remove-vs-simplify case-by-case** and the operator decides per animation during triage (not a blanket rule).

### Navigation (POLISH-03)
- **D-06:** **Full route-map audit** — map every route and entry point (swipe tabs, sub-screen Outlets, back buttons, deep links, event-bus-driven navigations) and walk each path for wrong / dead-end / broken back behavior.
- **D-07:** Top concern is **Android hardware/gesture back-button behavior across all screens** (no single known-broken path named). The audit must give back-button consistency special attention, especially sub-screen Outlets and settings sub-pages.

### Documentation (DOCS-01, DOCS-02)
- **D-08:** Stale docs in `Documents/` and `.planning/` are **moved to `Legacy/`, never deleted** — continue the `Documents/Legacy/` convention the operator already started. Preserves history.
- **D-09:** For CLAUDE.md drift (DOCS-02): agent produces a **drift report (doc claim vs actual code) and the operator approves each correction before it's written**. CLAUDE.md is high-stakes/load-bearing — confirm-first, no silent auto-correction.

### Claude's Discretion
- The specific contents of the polish checklist / 6-pillar rubric (researcher + auditor define it).
- The exact WebView performance-budget measurement method.
- Whether a given CLAUDE.md drift indicates code regression vs stale doc — but the *resolution direction* is operator-approved per D-09.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Load-bearing UI invariants (must not regress during polish/nav fixes)
- `CLAUDE.md` § "Header positioning (Phase 32.1)" — portal-vs-in-tree split; do not add transform/will-change/filter/contain to Header ancestors.
- `CLAUDE.md` § "Root overflow clip — both axes (Phase 33 UAT-4)" — `html, body { overflow: hidden }` on both axes; three-layer defense.
- `CLAUDE.md` § "SwipeTabContainer resize + keyboard (Phase 33 UAT-4)" — `resync()` width-change gate; `onFocusOut` re-snap + scrollLeft reset.
- `CLAUDE.md` § "ChatInput flex shrink (Phase 33 UAT-4)" — `minWidth: 0` on the input.

### Phase scope source
- `.planning/ROADMAP.md` § "Phase 56: UI Polish & Documentation" — goal + 5 success criteria.
- `.planning/REQUIREMENTS.md` — POLISH-01/02/03, DOCS-01/02.

### Codebase maps (for the route-map and screen sweep)
- `.planning/codebase/STRUCTURE.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONVENTIONS.md` — screen/route inventory and style conventions.

### Doc archival target
- `Documents/UI_AUDIT_REPORT.md` (Apr 16) — to be archived to `Documents/Legacy/` (D-03).
- `Documents/Legacy/` — existing archive destination convention (D-08).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `gsd-ui-auditor` agent / `/gsd:ui-review` skill — 6-pillar visual audit that produces a scored report; fits the D-01 hybrid discovery model.
- Inline-style + CSS-variable design system (`--primary-40`, `--surface`, `--radius-xl`, `--shadow-1/2/3`, node colors) — the polish standard to align against.
- `SwipeTabContainer.tsx` — owns the 5-wide strip, swipe vs instant-tab-transport, and keyboard/resize behavior; central to both animation (D-04/05) and navigation (D-06/07) work.

### Established Patterns
- Always-mounted swipe-tab screens must re-read service state on navigation (HomeScreen canonical pattern) — relevant if nav fixes touch route remounting.
- Sub-screens render in a fullscreen `<Outlet>` overlay (zIndex 50); Header auto-portals when outside `SwipeTabContext` — back-button audit must respect this.
- `BottomNavigation` tap = instant transport (no animation) — the established "snappy beats janky" precedent behind D-04/D-05.

### Integration Points
- Navigation: `react-router-dom` v7 routes (`/home`, `/planner`, `/ask`, `/graph`, `/settings` + sub-routes `/ask/:id`, `/posts/:id`, `/anchor/:id`, `/cluster/:id`, `/questions/:id`, `/settings/{ai,content,features,data}`) and event-bus-driven navigations.
- Docs: `Documents/`, `Documents/Legacy/`, `.planning/`, root `CLAUDE.md`.

</code_context>

<specifics>
## Specific Ideas

- "Snappy instant beats a janky animation" — the operator's established design instinct (tab-transport revert, 2026-04-15); applies when judging animation fixes.
- Feed-tile simplicity preference (fewer per-tile signals, clearer hierarchy) — if the audit touches feed tiles, bias toward simplification, not added chips/metadata.
- No pushy engagement mechanics — polish must not introduce streaks/goals/nudges; cosmetic only.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Adding new animation/motion language was explicitly declined per D-04; redesigns and new capabilities are out of scope.)

</deferred>

---

*Phase: 56-UI Polish & Documentation*
*Context gathered: 2026-05-21*

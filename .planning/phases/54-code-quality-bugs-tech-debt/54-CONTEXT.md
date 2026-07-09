# Phase 54: Code Quality, Bugs & Tech Debt - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

A non-user-facing cleanup/hardening pass after v1.6. This phase delivers a measurably cleaner codebase: an inventory of accumulated v1.4–v1.6 tech debt with the top tier resolved, a whole-codebase bug audit with confirmed bugs fixed, the two carried-over Force-New-Day debug sessions root-caused and fixed, the auto-gen podcast confirmed working, and known-deferred test failures resolved so the full suite + `tsc` are green.

**Out of scope (pushed to other phases):**
- Numeric threshold / cosine tuning and filter/recommendation/feed-randomizer/"like" mechanism tuning → **Phase 55** (TUNE-01/02).
- UI polish, animations, navigation audit, doc archiving, CLAUDE.md drift correction → **Phase 56**.
- Anything in the rewards shop (57–59).

</domain>

<decisions>
## Implementation Decisions

### Tech-Debt Prioritization (TECHDEBT-13)
- **D-01:** Use a **severity × reach matrix**. Inventory all accumulated v1.4–v1.6 tech debt into a prioritized list, score each item on severity × reach, and resolve the top tier **regardless of theme** (not limited to "blocks rewards" or "user-impacting only"). This is the most thorough option and the operator chose it deliberately.
- **D-02:** Items below the top tier are kept in the inventory and **formally re-accepted with a documented rationale** rather than fixed now. The inventory itself is a deliverable.
- **D-03:** CONCERNS.md candidate debt to score includes: hybrid SQLite/localStorage strategy (data-drift risk), heavy service mocking (masks real issues), CapacitorHttp streaming fragility on Android, theme-transition coordination (OS ↔ React ↔ CSS vars), SQLite encoding/serialization, web localStorage quota. Storage-key drift (`echolearn_*` vs `trellis_*` in older debug writeups) is worth scoring too.

### Bug Audit Breadth (QUALITY-01)
- **D-04:** **Whole-codebase sweep** for logic errors, edge cases, and race conditions — services + screens + hooks, not just the load-bearing surfaces. Operator explicitly chose breadth over a focused load-bearing-only audit.
- **D-05:** Confirmed bugs are fixed and covered by tests where practical (per success criterion 5). The severity × reach matrix from D-01 is the natural lens for triaging which audit findings are fixed this phase vs. logged.

### Carried-Over Debug Sessions (QUALITY-02)
- **D-06:** Both sessions in `.planning/debug/` are already root-caused; implement the fixes per their writeups, then move both files to `.planning/debug/resolved/`.
  - `vine-chip-not-clearing-after-force-new-day` (status: diagnosed): HomeScreen `exploredAnchors` is once-on-mount state on an always-mounted screen and only updates on `CONCEPT_EXPLORED`; `dailyReadService.reset()` emits no event. **Fix:** add `setExploredAnchors(dailyReadService.getExploredAnchors())` (and re-read `isCreditAwarded()` for the celebration ref) to HomeScreen's existing `[location.pathname] === '/home'` resync effect — the canonical always-mounted-resync pattern already documented in CLAUDE.md. Secondary: `creditAwardedRef` staleness should be re-read in the same effect.
  - `feed-not-auto-populating-after-force-new-day` (status: investigating, strong hypothesis): `handleForceNewDay` only rolls back `*_post_queue.date`, never clears the daily-posts cache, so `loadCache()`'s date-rejection never fires and `getDailyPosts()` returns today's served posts before reaching the rehydrated yesterday-queue. **Fix:** make `handleForceNewDay` mutate the daily-posts cache symmetrically (clear or roll back its date), per the documented "dev affordance must mutate EVERY date-stamped storage key + call every reset()" rule. Confirm current storage-key names (`trellis_*` post-rename) before patching.

### Auto-Gen Podcast (QUALITY-03)
- **D-07:** **Device-verified by the operator on 2026-05-20 — auto-gen podcast is working.** QUALITY-03's device-verification requirement is satisfied. **No** diagnostics affordance, structured pipeline logging, or fix work is needed. A light source sanity-check is acceptable but must not gate the phase; flag anything obviously broken if found.

### Deferred Test Failures (TECHDEBT-14)
- **D-08:** **Fix stale tests to assert the current correct contract** (the code is presumed right, the test drifted) — e.g. the `buildFallbackPosts` test contract. Re-accept a deferred failure with a documented rationale comment **only** where the gap is intentional. Goal: full suite + `tsc` green.

### Claude's Discretion
- Exact severity × reach scoring rubric (scale, weights) and the inventory document's format/location.
- How deep the whole-codebase sweep goes per file before diminishing returns — bounded by the matrix.
- Whether a fixed bug warrants a new regression test (default: yes where practical).

### Folded Todos
- **`2026-05-09-inspect-auto-gen-podcast-working-or-not-and-debug`** (`resolves_phase: 54`): originally asked to verify the auto-gen podcast pipeline end-to-end on device. **Disposition: CLOSED** — operator has device-verified it working (D-07). The todo should be moved to `.planning/todos/` done/archive rather than investigated. It maps to QUALITY-03.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 54" — goal, success criteria, requirement list
- `.planning/REQUIREMENTS.md` — QUALITY-01/02/03, TECHDEBT-13/14 wording

### Carried-over debug sessions (root-cause writeups — read before fixing)
- `.planning/debug/vine-chip-not-clearing-after-force-new-day.md` — full diagnosis + suggested fix direction
- `.planning/debug/feed-not-auto-populating-after-force-new-day.md` — hypothesis + four-file evidence trail
- `.planning/debug/resolved/force-new-day-wipes-saved-liked.md`, `.planning/debug/resolved/duplicate-post-keys-after-force-new-day.md` — prior resolved Force-New-Day bugs for pattern context

### Tech-debt inventory sources
- `.planning/codebase/CONCERNS.md` — documented technical debt, fragile areas, known limitations
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/TESTING.md` — context for the bug-audit sweep

### Load-bearing invariants (do not regress while cleaning)
- `CLAUDE.md` — esp. "Always-mounted screens must explicitly re-read service state on navigation" (the vine-chip fix pattern), "dev affordance must mutate every date-stamped storage key", Concept Feed pipeline, Header positioning, root overflow clip, brand-rename storage-key note (`trellis_*` keys; SQLite name `'echolearn'` preserved)

### Carried-over todo (folded)
- `.planning/todos/pending/2026-05-09-inspect-auto-gen-podcast-working-or-not-and-debug.md` — close per D-07

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- HomeScreen's `[location.pathname]` resync effect (`app/src/screens/HomeScreen.tsx`) — extend it for the `exploredAnchors` + `creditAwardedRef` re-read (vine-chip fix). Pattern is already canonical in CLAUDE.md.
- `dailyReadService` (`app/src/services/daily-read.service.ts`) — stateless, localStorage-backed; `reset()` writes synchronously but emits no event.
- `.planning/debug/resolved/` — destination for the two fixed sessions; mirrors prior workflow.

### Established Patterns
- Always-mounted swipe-tab screens never remount on `navigate()`; any state read once-on-mount must be re-synced via a `[location.pathname]` effect or an event subscription.
- Dev affordances that simulate wall-clock events (Force-New-Day) must call every service `reset()` AND mutate every date-stamped storage key the natural event would touch — both debug sessions are violations of this rule.
- Tests must guard the LIVE code path; a test on a dead path should be deleted, not maintained (informs D-08 edge cases even though the chosen default is fix-to-match).

### Integration Points
- `handleForceNewDay` in `app/src/screens/settings/SettingsDataScreen.tsx` — the dev handler to patch for the feed-not-populating fix.
- `concept-feed.service.ts` `loadCache()` / `getDailyPosts()` and the daily-posts cache key — symmetric date-rejection is the crux of the feed fix.

</code_context>

<specifics>
## Specific Ideas

- Operator wants the thorough end of every scoping choice here (severity×reach matrix, whole-codebase sweep, fix-to-match tests) — this is a deliberate "do it properly" cleanup phase, not a quick triage.
- Confirm current `trellis_*` storage-key names before patching the Force-New-Day handler; older debug writeups reference legacy `echolearn_*` keys from before the 2026-05-07 rename.

</specifics>

<deferred>
## Deferred Ideas

- Numeric threshold tuning (cosine similarity, filter bands) and mechanism tuning → **Phase 55**.
- UI polish / animation / navigation audit and stale-doc archiving / CLAUDE.md drift → **Phase 56**.

### Reviewed Todos (not folded)
- **`2026-05-07-fix-cosine-similarity-threshold-cache-miss`** (`resolves_phase: 55`): parameterize the hardcoded `ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD` and add an embedding cache. **Not folded** — tagged for Phase 55 (Algorithm & Mechanism Tuning), where threshold work lives. Keep out of Phase 54.

</deferred>

---

*Phase: 54-code-quality-bugs-tech-debt*
*Context gathered: 2026-05-20*

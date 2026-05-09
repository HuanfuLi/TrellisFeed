---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: gap closure)
status: executing
last_updated: "2026-05-09T00:28:37.158Z"
last_activity: 2026-05-09
progress:
  total_phases: 21
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: v1.5 ROADMAP CREATED — 2026-05-08

## Current Position

Phase: 37 (i18n-leaf-module-refactor) — EXECUTING
Plan: 2 of 3
Status: In Progress (Plan 37-01 complete; Plan 37-02 next)
Last activity: 2026-05-09 — Plan 37-01 complete (shim + main.tsx wire shipped, smoke 4/4 green, baseline 12 failures preserved)

## Progress

**Phases:** 0 / 9 complete (37-45)
**Plans:** 0 / 0 (plans not yet created)

```
[░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0%
```

### Wave Order

- **Wave 0** (carry-over cleanup): Phase 37 (i18n leaf-module) + Phase 38 (v1.4 carry-overs) — parallel-safe, both unblock Wave 1
- **Wave 1** (foundation services): Phase 39 (engagement) + Phase 40 (source diversity) — parallel-safe, requires Wave 0
- **Wave 2** (service integration): Phase 41 (pipeline + essay depth) — requires Wave 1
- **Wave 3** (UI layer): Phase 42 (masonry) → Phase 43 (engagement UI) — sequential, requires Wave 2
- **Wave 4** (hygiene sweep): Phase 44 (deps) + Phase 45 (code quality) — parallel-safe, lands LAST

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-08 — milestone v1.5 started)

**Core value:** Enable learners to transform fragmented information into structured knowledge through AI-driven Q&A, visual mapping, and adaptive spaced repetition — all while maintaining complete local-first privacy.

**Current focus:** Phase 37 — i18n-leaf-module-refactor

## Requirement Coverage

22 / 22 requirements mapped to phases ✓ (no orphans)

| Category | Count | Phases |
|----------|-------|--------|
| MASONRY | 2 | Phase 42 |
| ENGAGE | 4 | Phase 39 (×3), Phase 43 (×1) |
| CONTENT | 4 | Phase 40 (×1), Phase 41 (×3) |
| TECHDEBT | 12 | Phase 37 (×1), Phase 38 (×5), Phase 44 (×1), Phase 45 (×5) |

## Carry-overs from v1.4 (in scope for v1.5)

All carry-overs are scheduled into Wave 0:

- **i18n leaf-module refactor** (TECHDEBT-01) → Phase 37
- **VALIDATION drift cleanup 34/35** (TECHDEBT-02) → Phase 38
- **ROADMAP plan-list polish 36-14/36-15** (TECHDEBT-03) → Phase 38
- **33-HUMAN-UAT-1/2 device retest** (TECHDEBT-04) → Phase 38
- **CLAUDE.md `echolearn_*` doc-drift** (TECHDEBT-05) → Phase 38
- **YouTube landscape-listed-as-short bug** (TECHDEBT-06) → Phase 38

## Resolved blockers

All v1.4 blockers resolved at close. No open blockers.

## Last decisions (Plan 37-01 close, 2026-05-09)

- **Cast `i18n.t.bind(i18n) as any` at the bind site in main.tsx** — bridges i18next's literal-key-union type from i18n.d.ts module augmentation to the leaf shim's intentionally-generic TFn signature. Single-line cast preserves the plan's regex invariant; eslint-disable + 4-line explanatory comment annotates the bridge. Alternative (widening TFn or wrapper closure) rejected: would couple shim to bundle internals or add a function-call hop in production for zero functional gain.
- **Atomic-pair commit for shim source + smoke test** — per Plan 37-01 plan_notes Pitfall 7 mitigation. Shipping the test alone would fail; shipping the source alone leaves the hold-out unverifiable. Two atomic commits at plan close: `4e72565a` (shim+test) + `04056289` (main.tsx wire). Bisection-friendly per D-03.

## Last decisions (Roadmap creation, 2026-05-08)

- **9 phases across 4 waves** following synthesizer's recommended dependency graph; merged Wave 0 carry-over cleanup into a single Phase 38 (TECHDEBT-02 through TECHDEBT-06) for cohesion since they're all v1.4 documentation/QA cleanup
- **Masonry strategy locked to CSS `column-count: 2`** per research reconciliation (zero new dependencies; rejects `@virtuoso.dev/masonry` and `masonic` on architectural + maintenance grounds)
- **ENGAGE-04 (graph-derived social proof) placed in Phase 43**, not Phase 42, because the micro-label sits on the tile that masonry first renders
- **Wave 4 (deps + code quality) intentionally lands LAST** to avoid React/Capacitor minor bumps mid-feature triggering StrictMode timing surprises (Pitfall 12)
- **TECHDEBT-04 device retest folded into Phase 38** as a checklist task rather than its own phase (synthesizer permission)
- **CONTENT-04 (citation rendering polish)** placed in Phase 41 (pipeline wiring) so it lands with `depth: 'deep'` essay path; pulled from FEATURES.md P3 into v1.5 release scope per research's "may need to be pulled in" note

## Session Continuity

**Next action:** Execute Plan 37-02 (Tier 1+2 service migrations — 5 atomic commits, closes 10 carried test failures).

**Files written this session (Plan 37-01 close):**

- `app/src/lib/i18n-leaf.ts` (NEW — leaf shim)
- `app/tests/lib/i18n-leaf.test.mjs` (NEW — 4-assertion smoke test)
- `app/src/main.tsx` (MODIFIED — default-import + bindI18nLeaf wire)
- `.planning/phases/37-i18n-leaf-module-refactor/37-01-SUMMARY.md` (NEW — Plan 37-01 close-out)
- `.planning/STATE.md` (this file)
- `.planning/ROADMAP.md` (plan progress row updated)
- `.planning/REQUIREMENTS.md` (TECHDEBT-01 stays open — Plan 37-02/03 close it)

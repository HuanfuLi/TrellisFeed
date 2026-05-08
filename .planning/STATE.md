---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Curiosity Feed Redesign + UI Polish
status: v1.4 milestone complete (shipped 2026-05-08)
stopped_at: v1.4 archived; ready for /gsd:new-milestone (v1.5)
last_updated: "2026-05-08T07:35:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: v1.4 SHIPPED — 2026-05-08

10 phases (28, 29, 30, 31, 32-absorbed, 32.1, 33, 34, 35, 36) closed. 63 plan SUMMARYs across 22 days (2026-04-16 → 2026-05-08). 570/560 pass / 10 fail / tsc + vite clean. Audit status `tech_debt` — 16 of 26 v1.3-carried failures closed; 10 architectural carry-overs (i18n leaf-module refactor) explicitly accepted to v1.5.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-08 after v1.4 milestone close)

**Core value:** Enable learners to transform fragmented information into structured knowledge through AI-driven Q&A, visual mapping, and adaptive spaced repetition — all while maintaining complete local-first privacy.
**Current focus:** Planning next milestone (v1.5)

## Carry-overs to v1.5

- **i18n leaf-module refactor** — extract i18n usage from services into `lib/i18n-leaf.ts` so trellis-state.test.mjs / trellis-layout.test.mjs / concept-feed.test.mjs can run under `node --test`. Closes 10 carried test failures. Estimated 1–2h.
- **VALIDATION drift cleanup** — flip 34-VALIDATION.md to validated; normalize 35-VALIDATION.md from `approved` → `validated`
- **ROADMAP plan-list polish** — append 36-14 + 36-15 bullets to Phase 36 plan list
- **33-HUMAN-UAT-1/2** — touch-target feel + React.memo behavioral correctness on physical device (intentional carry per 34-CONTEXT.md `<deferred>`)
- **CLAUDE.md `echolearn_*` localStorage references** — bulk rename or annotate brand-history note (doc-only)

## Resolved blockers

All v1.4 blockers resolved at close. No open blockers.

## Last decisions (Phase 36 round-4 close-out, 2026-05-07)

- Vine progress chip resync via dual `[location.pathname]` effect on HomeScreen (Plan 36-14)
- Force-New-Day handler symmetric two-cache mutation (Plan 36-15) — `trellis_post_queue.date` AND `trellis_daily_posts.date` both rolled back; embedded "DO NOT FLIP THIS BACK" marker in Test 6
- Round-4 16/16 must-haves verified; UAT round 5 device pass 2026-05-08 (commit `c6a36a4d`)
- Rebrand EchoLearn → Trellis landed on main as commit `9e5d1f38`
- Audit session 2026-05-08: SEAM-11 closed via npm test script split (test:main + test:actions); trellis-tooltip-copy.test.mjs deleted as obsolete (TrellisTooltip.tsx removed in Phase 25)

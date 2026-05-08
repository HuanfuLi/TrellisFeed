---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: Curiosity Feed v2 + Tech-Debt Hardening
status: Defining requirements
stopped_at: Milestone v1.5 started; defining requirements
last_updated: "2026-05-08T08:00:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: v1.5 STARTED — 2026-05-08

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-05-08 — Milestone v1.5 started (Curiosity Feed v2 + Tech-Debt Hardening)

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-08 — milestone v1.5 started)

**Core value:** Enable learners to transform fragmented information into structured knowledge through AI-driven Q&A, visual mapping, and adaptive spaced repetition — all while maintaining complete local-first privacy.
**Current focus:** v1.5 — Curiosity Feed v2 (Pinterest masonry, richer essays, source diversity, engagement signals) + tech-debt hardening (carry-overs + broader hygiene)

## Carry-overs from v1.4 (in scope for v1.5)

- **i18n leaf-module refactor** — extract i18n usage from services into `lib/i18n-leaf.ts` so trellis-state.test.mjs / trellis-layout.test.mjs / concept-feed.test.mjs can run under `node --test`. Closes 10 carried test failures. Estimated 1–2h.
- **VALIDATION drift cleanup** — flip 34-VALIDATION.md to validated; normalize 35-VALIDATION.md from `approved` → `validated`
- **ROADMAP plan-list polish** — append 36-14 + 36-15 bullets to Phase 36 plan list (in archived `.planning/milestones/v1.4-ROADMAP.md`)
- **33-HUMAN-UAT-1/2** — touch-target feel + React.memo behavioral correctness on physical device (intentional carry per 34-CONTEXT.md `<deferred>`)
- **CLAUDE.md `echolearn_*` localStorage references** — bulk rename or annotate brand-history note (doc-only)
- **YouTube landscape-as-short bug** — `.planning/notes/2026-05-08-fix-youtube-landscape-video.md`

## Resolved blockers

All v1.4 blockers resolved at close. No open blockers.

## Last decisions (Phase 36 round-4 close-out, 2026-05-07)

- Vine progress chip resync via dual `[location.pathname]` effect on HomeScreen (Plan 36-14)
- Force-New-Day handler symmetric two-cache mutation (Plan 36-15) — `trellis_post_queue.date` AND `trellis_daily_posts.date` both rolled back; embedded "DO NOT FLIP THIS BACK" marker in Test 6
- Round-4 16/16 must-haves verified; UAT round 5 device pass 2026-05-08 (commit `c6a36a4d`)
- Rebrand EchoLearn → Trellis landed on main as commit `9e5d1f38`
- Audit session 2026-05-08: SEAM-11 closed via npm test script split (test:main + test:actions); trellis-tooltip-copy.test.mjs deleted as obsolete (TrellisTooltip.tsx removed in Phase 25)

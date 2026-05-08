---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: Curiosity Feed v2 + Tech-Debt Hardening
status: Roadmap created
stopped_at: Roadmap drafted (37-45); awaiting plan-phase 37 to begin
last_updated: "2026-05-08T09:30:00.000Z"
progress:
  total_phases: 9
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: v1.5 ROADMAP CREATED — 2026-05-08

## Current Position

Phase: Not started — Phase 37 (i18n Leaf-Module Refactor) is next
Plan: —
Status: Roadmap created; ready for `/gsd:plan-phase 37`
Last activity: 2026-05-08 — v1.5 roadmap drafted (9 phases / 4 waves / 22 reqs mapped)

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

**Current focus:** v1.5 — Curiosity Feed v2 (Pinterest masonry, richer essays, source diversity, engagement signals) + tech-debt hardening (carry-overs + broader hygiene)

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

## Last decisions (Roadmap creation, 2026-05-08)

- **9 phases across 4 waves** following synthesizer's recommended dependency graph; merged Wave 0 carry-over cleanup into a single Phase 38 (TECHDEBT-02 through TECHDEBT-06) for cohesion since they're all v1.4 documentation/QA cleanup
- **Masonry strategy locked to CSS `column-count: 2`** per research reconciliation (zero new dependencies; rejects `@virtuoso.dev/masonry` and `masonic` on architectural + maintenance grounds)
- **ENGAGE-04 (graph-derived social proof) placed in Phase 43**, not Phase 42, because the micro-label sits on the tile that masonry first renders
- **Wave 4 (deps + code quality) intentionally lands LAST** to avoid React/Capacitor minor bumps mid-feature triggering StrictMode timing surprises (Pitfall 12)
- **TECHDEBT-04 device retest folded into Phase 38** as a checklist task rather than its own phase (synthesizer permission)
- **CONTENT-04 (citation rendering polish)** placed in Phase 41 (pipeline wiring) so it lands with `depth: 'deep'` essay path; pulled from FEATURES.md P3 into v1.5 release scope per research's "may need to be pulled in" note

## Session Continuity

**Next action:** `/gsd:plan-phase 37` to create plan(s) for the i18n Leaf-Module Refactor.

**Files written this session:**
- `.planning/ROADMAP.md` (appended v1.5 section, lines 1018-1199)
- `.planning/STATE.md` (this file)
- `.planning/REQUIREMENTS.md` (Traceability section filled)

# Phase 28: Discussion Log

**Date:** 2026-04-16
**Workflow:** `/gsd:discuss-phase 28`

## Context Loaded

- `.planning/PROJECT.md` (EchoLearn vision, milestone v1.1)
- `.planning/REQUIREMENTS.md` (no new REQ-IDs added — polish phase)
- `.planning/STATE.md` (status: Executing Phase 27, 22 phases total)
- Prior CONTEXT.md files: phases 20, 21, 22, 23, 25, 26, 27
- `todo match-phase 28` → 0 matches

## Codebase Scouted

- `app/src/App.tsx` (322 lines, RootLayout + sub-screen Outlet structure)
- `app/src/components/SwipeTabContainer.tsx` (route sync, stripX motion value, screenWidthRef)
- `app/src/components/BottomNavigation.tsx` (5-tab layout, SwipeTabContext consumer)
- `app/src/components/ui/Header.tsx` (opaque surface, HEADER_HEIGHT=56)
- `app/src/components/trellis/TrellisLeaf.tsx` (Framer Motion, botanical categories)
- `app/src/screens/GraphScreen.tsx` (title="Mind Map" at line 518)
- `app/src/screens/AskScreen.tsx` (hardcoded bullet at line 623)
- `app/src/locales/{en,zh,es,ja}.json` (48 lines each — Phase 27 stubs in place)

## Prior-Phase Decisions Reused

- **Phase 22 D-11 / D-12:** 5 top-level screens always-mounted in SwipeTabContainer — D-06 (nav hide) does NOT remove this; slide-down animation only affects nav chrome.
- **Phase 25 D-38 / D-42:** Leaf animation patterns (color transition, bud→leaf grow) — D-10 shake follows the same Framer Motion variant convention.
- **Phase 25 D-55:** SVG leaf count > 50 performance guard — D-13 extends this to shake/pulse animations.
- **Phase 26 D-07 / D-08 / D-09:** 3-column status panel + bottom sheet → informs D-04 section-header visual baseline.
- **Phase 27 D-05 / D-08 / D-21:** Bundle structure + Sonnet-subagent translation workflow + fallbackLng → D-14 rename uses this pipeline. Phase 28 depends on Phase 27 for i18n scaffold.

## Gray Areas Identified

1. Scope / wave selection (A only? A+B+C? full A+B+C+D?)
2. Bottom-nav hide mechanism + sub-screen Header separator treatment
3. Trellis leaf interaction details (shake, pulse, haptic, perf)
4. "Mind Map" → "Knowledge Graph" i18n coordination + AskScreen polish scope

User selected **all four** for discussion.

## Decisions Reached

### Q1 — Scope

**User chose:** Full audit (A+B+C+D) — everything in the audit report.

**Implication:** ~5–7 day execution estimate. Planner may split into 2 plans (A+B, then C+D).

### Q2 — Bottom-nav hide + Header separator

**User chose:** Slide-down hide + shadow-on-scroll (Recommended).

- Nav animates `translateY` from `0` to `88px + safe-area-bottom` over ~200ms spring when entering sub-screens.
- Header keeps its opaque `--surface` background (already in place) and gains a conditional `box-shadow: var(--shadow-1)` that appears only when the sub-screen scrolls > 4px from the top.
- Feels native (iOS-style behavior).

### Q3 — Trellis leaf interaction

**User chose:** Shake on tap + pulse when selected Move matches + haptic (Recommended).

- Tap any leaf → ~300ms rotate shake (`0° → +4° → -4° → +2° → 0°`) + `hapticImpactLight()`.
- Suggested Move row tap → corresponding leaf pulses (scale 1→1.15→1 over ~600ms) + soft glow (`drop-shadow`) for ~2s until user acts / navigates.
- Perf guard: only animate leaves visible in viewport when `leaves.length > 30`.
- No tooltip, no navigation, no new mental-model surface.

### Q4 — i18n + AskScreen

**User chose:** All 4 bundles + full AskScreen polish (Recommended).

- `graph.title` key added to `en.json` + Sonnet-subagent translates `zh.json` / `es.json` / `ja.json`.
- Suggested translations: 知识图谱 / Grafo de conocimiento / ナレッジグラフ.
- AskScreen polish: remove hardcoded bullet, clamp to 2 lines, tappable rows → `/ask/:id`, refined empty state copy.

## Withdrawn Findings (Not in Scope)

From user feedback on the original audit report:
- Trellis Dev Mode default state (was manually toggled on during audit)
- Suggested Moves "debug labels" (Dev Mode artifact)
- Harvest chip not decrementing after 8 fruits (Dev Mode artifact)

These are NOT bugs. They surfaced because Dev Mode was enabled during the audit session.

## Next Steps

1. `/gsd:plan-phase 28` — planner breaks down into tasks.
2. Phase 27 must complete before Phase 28 execution (dependency on i18n scaffold).
3. At minimum, `graph.title` key should exist in all 4 bundles by the time D-14 executes.

## Files Produced

- `.planning/phases/28-ui-ux-polish-from-audit-findings/28-CONTEXT.md`
- `.planning/phases/28-ui-ux-polish-from-audit-findings/28-DISCUSSION-LOG.md` (this file)

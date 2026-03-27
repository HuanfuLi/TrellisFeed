---
phase: 10-planner-auto-suggestions-engine
verified: 2026-03-27T20:30:00Z
status: gaps_found
score: 8/10 must-haves verified
re_verification: false
gaps:
  - truth: "Suggestions auto-refresh at user's configured podcast generation time"
    status: partial
    reason: "useDailyRefresh hook is defined but never imported or called anywhere in the app. The 24h refresh works via usePlannerAutoGen (on mount), but the dedicated PODCAST_GENERATION_COMPLETED event listener in useDailyRefresh is dead code — it is orphaned."
    artifacts:
      - path: "app/src/state/useDailyRefresh.ts"
        issue: "Exported but never imported or used in any screen or provider"
    missing:
      - "Import and call useDailyRefresh() in PlannerScreen.tsx or a root-level provider so the PODCAST_GENERATION_COMPLETED → refresh wiring is active"
  - truth: "Suggestions persist across app restart (localStorage + SQLite)"
    status: partial
    reason: "Suggestions persist in localStorage correctly (echolearn_planned_moves). No SQLite/Prisma layer exists in this project (no prisma/ directory) — the PLAN listed prisma/schema.prisma as an artifact but this file does not exist and was never created. The system degrades gracefully to localStorage-only, but the persistence claim in the must-have overstates what was delivered."
    artifacts:
      - path: "prisma/schema.prisma"
        issue: "MISSING — no Prisma directory exists in this project"
    missing:
      - "Either acknowledge that localStorage-only persistence satisfies this requirement (the app is local-first with no SQLite), or document this as a scope reduction"
human_verification:
  - test: "Verify 'Suggested Moves' section appears in Planner UI with 5+ questions"
    expected: "Collapsible 'Suggested Moves' header with count badge appears above empty planner, showing MoveCard items with type icons, reason text, relevance score bar, Add/Skip buttons"
    why_human: "Requires interacting with the running app; auto-gen depends on localStorage state at startup"
  - test: "Verify podcast completion triggers suggestion refresh"
    expected: "After a podcast finishes generating, suggestions are refreshed (new moves or refreshed timestamp)"
    why_human: "useDailyRefresh is currently orphaned — this needs the gap above closed first, then confirmed via PODCAST_GENERATION_COMPLETED event firing in the app"
---

# Phase 10: Planner Auto-Suggestions Engine Verification Report

**Phase Goal:** Implement auto-generation of Planner suggestions when Knowledge Graph is populated and Planner is empty, with daily refresh.
**Verified:** 2026-03-27T20:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | User with 5+ questions sees 'Suggested Moves' section in Planner when empty | VERIFIED | `plannerAutoGenService.shouldAutoGenerate()` checks `questions.length >= 5 && activeOrSuggested.length === 0`; PlannerScreen renders `{autoMoves.length > 0 && <... "Suggested Moves" ...>}` |
| 2  | Suggestions auto-refresh at user's configured podcast generation time | PARTIAL | `useDailyRefresh.ts` subscribes to `PODCAST_GENERATION_COMPLETED` but is never imported anywhere; dead code |
| 3  | New users (< 5 reviews) see equalized suggestions for diversity | VERIFIED | `trajectoryAnalyzerService` returns neutral signals (reviewPerformance=50, conceptCoverage=0) on cold start; all concepts score equally, giving diversity |
| 4  | Weak concepts (review score < 60%) rank higher in suggestions | VERIFIED | `scoreMove()` applies 0.4 weight to `(100 - reviewPerformance)` + 15pt boost for `weakAreas`; `rankConcepts()` sorts descending |
| 5  | Suggestions link to relevant posts via existing conceptual graph | VERIFIED | `buildLinkedResource()` in `moveGenerator.service.ts` maps move types to `{type: 'post'|'question'|'review', id}` stored on each `PlannedMove.linkedResource` |
| 6  | Each suggested move shows relevance score badge | VERIFIED | `MoveCard.tsx` renders `ScoreBar` component showing `move.relevanceScore` as a visual bar + numeric badge |
| 7  | User can add suggested move to planned activities with one tap | VERIFIED | `MoveCard` "Add" button calls `onAccept(move.id)` → `plannerAutoGenService.acceptMove()` → `plannerService.createChunk()` + toast "Added to Planner!" |
| 8  | Suggestions persist across app restart (localStorage + SQLite) | PARTIAL | localStorage persistence confirmed (`echolearn_planned_moves` key); no Prisma/SQLite layer exists in this codebase; `prisma/schema.prisma` artifact MISSING |
| 9  | No duplicate suggestions appear in a single refresh cycle | VERIFIED | `isRecentDuplicate()` filters concepts with moves created within last 24h; `candidates.filter(c => !isRecentDuplicate(c.id, existing))` before scoring |
| 10 | 24h cooldown prevents suggestion thrashing | VERIFIED | `isDailyRefreshNeeded()` checks `Date.now() - getLastRefreshTime() > 24h`; `setLastRefreshTime(Date.now())` called after each successful generation |

**Score:** 8/10 truths verified (2 partial)

---

### Required Artifacts

| Artifact | Min Lines | Actual Lines | Status | Details |
|----------|-----------|--------------|--------|---------|
| `app/src/services/trajectoryAnalyzer.service.ts` | 100 | 161 | VERIFIED | Exports `trajectoryAnalyzerService`; implements `aggregateSignals()`, `recordFeedView()`, `invalidateCache()` with 6h cache |
| `app/src/services/suggestionScorer.service.ts` | 80 | 89 | VERIFIED | Exports `scoreMove()`, `rankConcepts()`; implements 0.4/0.3/0.2/0.1 weighted formula with weak area boost |
| `app/src/services/moveGenerator.service.ts` | 70 | 130 | VERIFIED | Exports `generateMoves()`; maps ranked concepts to typed `PlannedMove` with linkedResource, reason text, time estimates |
| `app/src/services/plannerAutoGen.service.ts` | 120 | 187 | VERIFIED | Exports `plannerAutoGenService`; full pipeline: shouldAutoGenerate, generateAndStoreSuggestions, acceptMove, dismissMove |
| `app/src/state/usePlannerAutoGen.ts` | — | 103 | VERIFIED | Imports `plannerAutoGenService`; calls `shouldAutoGenerate() && generateAndStoreSuggestions()` on mount; event subscription; accept/dismiss/refresh |
| `app/src/state/useDailyRefresh.ts` | — | 70 | ORPHANED | Implemented correctly with PODCAST_GENERATION_COMPLETED subscription, but never imported or called anywhere in the app |
| `app/src/screens/PlannerScreen.tsx` | — | exists | VERIFIED | Imports `usePlannerAutoGen`, `MoveCard`; renders collapsible "Suggested Moves" section; Skip All + Refresh buttons |
| `app/src/components/MoveCard.tsx` | 60 | 171 | VERIFIED | Exports `MoveCard`; type icon/label, score bar, reason text, Add/Skip buttons |
| `app/src/types/index.ts` | — | modified | VERIFIED | Added `TrajectorySignal`, `PlannedMove`, `PlannedMoveType` interfaces |
| `app/src/components/SuggestedMovesSection.tsx` | — | MISSING | SUPERSEDED | PLAN listed this but implementation correctly chose `MoveCard.tsx` instead — functionality is fully present in `MoveCard` + inline PlannerScreen section |
| `prisma/schema.prisma` | — | MISSING | MISSING | No Prisma directory exists in this project; this artifact was incorrectly listed in the PLAN; project is localStorage-only |

**Note on SuggestedMovesSection.tsx:** The PLAN specified this artifact but the implementation correctly substituted `MoveCard.tsx`. The functionality is equivalent — moves are rendered in-line in `PlannerScreen` using `MoveCard`. This is an acceptable deviation.

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `usePlannerAutoGen.ts` | `plannerAutoGen.service.ts` | `shouldAutoGenerate() && generateAndStoreSuggestions()` | WIRED | Lines 40-47: checks both trigger conditions then calls generation |
| `plannerAutoGen.service.ts` | `trajectoryAnalyzer.service.ts` | `trajectoryAnalyzerService.aggregateSignals()` | WIRED | Line 111: `const signals = trajectoryAnalyzerService.aggregateSignals(forceRefresh)` |
| `plannerAutoGen.service.ts` | `suggestionScorer.service.ts` | `rankConcepts(candidates, signals, 8)` | WIRED | Line 118: direct call to imported `rankConcepts` |
| `plannerAutoGen.service.ts` | `moveGenerator.service.ts` | `generateMoves(rankedConcepts, signals)` | WIRED | Line 119: direct call to imported `generateMoves` |
| `PlannerScreen.tsx` | `MoveCard.tsx` | Render MoveCard for each auto-move | WIRED | Lines 537-543: `autoMoves.map(move => <MoveCard ... />)` |
| `MoveCard.tsx` | `ChunkCard.tsx` | Reuse existing chunk card UI | NOT_USED | `MoveCard` uses its own inline `Card` component; does not reuse `ChunkCard` — PLAN spec, but functionally equivalent |
| `SettingsScreen.tsx` | `plannerAutoGen.service.ts` | Refresh Now button calls generateAndStoreSuggestions | WIRED | Line 914: `await plannerAutoGenService.generateAndStoreSuggestions(true)` |
| `SettingsScreen.tsx` | `CapacitorPreferences` | Store consolidated podcast generation time | NOT_WIRED | `plannerRefreshEnabled` and `plannerRefreshTime` are React local state only — reset to `true`/`'08:00'` on every app restart; no localStorage or Capacitor write found |
| `eventBus` | `plannerAutoGen.service.ts` | PODCAST_COMPLETED → refresh | ORPHANED | `useDailyRefresh.ts` has this subscription but is never mounted |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `PlannerScreen.tsx` | `autoMoves` | `usePlannerAutoGen` → `plannerAutoGenService.getMoves()` → `localStorage.getItem('echolearn_planned_moves')` | Yes — reads from localStorage, populated by generation pipeline | FLOWING |
| `MoveCard.tsx` | `move.relevanceScore`, `move.reason`, `move.moveType` | `plannerAutoGenService.generateAndStoreSuggestions()` → `rankConcepts()` → `scoreMove()` | Yes — deterministic weighted formula from live review/question data | FLOWING |
| `trajectoryAnalyzer.service.ts` | `signals.feedEngagement` | `loadFeedViews()` from `recordFeedView()` calls | STATIC — `recordFeedView()` is exported but never called from HomeScreen/ConceptCard; engagement always 0 | HOLLOW_PROP |

**Note on feed engagement:** The SUMMARY acknowledges this as a known stub. `feedEngagement` in `TrajectorySignal` is always 0 since `recordFeedView()` is never wired to the UI. The 0.2 weight on engagement is therefore inert. This degrades gracefully (does not break suggestions) but reduces scoring accuracy.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Scorer tests pass (17 tests) | `node --test tests/services/suggestionScorer.test.mjs` | 17 pass, 0 fail | PASS |
| Trajectory analyzer tests pass (8 tests) | `node --test tests/services/trajectoryAnalyzer.test.mjs` | 8 pass, 0 fail | PASS |
| plannerAutoGen trigger tests pass (8 tests) | `node --test tests/services/plannerAutoGen.test.mjs` | 8 pass, 0 fail | PASS |
| `useDailyRefresh` consumed by any screen | `grep -rn "useDailyRefresh" app/src/ --include="*.tsx"` | 0 matches | FAIL |
| `plannerRefreshEnabled` persisted | `grep -n "localStorage.*plannerRefresh" app/src/screens/SettingsScreen.tsx` | 0 matches | FAIL |

---

### Requirements Coverage

| Requirement | PLAN Claims | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PLANNER-01 | Yes | 5+ KG nodes AND empty Planner → auto-generates "Suggested Moves" | SATISFIED | `shouldAutoGenerate()` enforces both conditions; PlannerScreen renders section conditionally |
| PLANNER-02 | Yes | Auto-generated suggestions appear on Planner screen without user intervention | SATISFIED | `usePlannerAutoGen` calls generation on mount; moves render automatically |
| PLANNER-03 | Yes | Suggestions regenerate daily (after podcast time) automatically | PARTIAL | 24h interval check is wired in `usePlannerAutoGen` on mount; `useDailyRefresh` PODCAST event subscription is dead code (never mounted) — daily refresh via time not functional |
| PLANNER-04 | Not in PLAN | User can retry/regenerate suggestions with "Retry" button | NOT_VERIFIED | PLANNER-04 not claimed by Phase 10 plan (not in `requirements:` list). Phase 10 includes a "Refresh Now" button and inline refresh icon, which covers the intent but PLANNER-04 remains unclaimed by any phase. ORPHANED requirement. |
| PLANNER-05 | Yes | Trajectory-aware suggestions: review performance, question frequency, engagement | SATISFIED | Weighted formula implemented: 0.4×struggle + 0.3×overdue + 0.2×engagement + 0.1×coverage; test suite validates formula |
| PLANNER-06 | Yes | Suggestions link to Posts, Questions, or Review sessions | SATISFIED | `PlannedMove.linkedResource` field populated by `buildLinkedResource()` with type+id for all 4 move types |

**Orphaned Requirement:** PLANNER-04 ("User can retry/regenerate suggestions with 'Retry' button") is not claimed by any plan in Phase 10. Phase 10 does deliver a Refresh Now button in Settings and a refresh icon in PlannerScreen, which partially covers the intent. This requirement remains unclaimed in the traceability matrix.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/src/state/useDailyRefresh.ts` | 25 | Exported hook never imported anywhere in app | Warning | PODCAST_GENERATION_COMPLETED → daily refresh event chain is dead; auto-refresh after podcast does not fire |
| `app/src/screens/SettingsScreen.tsx` | 134-135 | `plannerRefreshEnabled` and `plannerRefreshTime` are local state (no persistence) | Warning | Settings reset to defaults (`true` / `08:00`) on every app restart; user preferences not preserved |
| `app/src/services/trajectoryAnalyzer.service.ts` | ~44 | `recordFeedView()` exported but never called from any screen | Info | Feed engagement score is always 0; 20% weight in scoring formula is inert; degrades gracefully |

---

### Human Verification Required

#### 1. Suggested Moves Appear in Planner

**Test:** Open the app with 5+ questions in the knowledge graph and no active/suggested planner chunks. Navigate to the Planner screen.
**Expected:** A "Suggested Moves" collapsible section appears with MoveCard items showing type icon, concept title, reason text, a relevance score bar, and Add/Skip buttons. Empty planner shows CTA: "No planned moves yet. We've suggested some ideas above."
**Why human:** Requires app startup with specific localStorage state; visual rendering cannot be verified via grep.

#### 2. One-tap Add to Planner

**Test:** In the Suggested Moves section, tap "Add" on a MoveCard.
**Expected:** Toast "Added to Planner!" appears. The move disappears from Suggested Moves. A new chunk appears in the active planner section.
**Why human:** Requires interactive app testing with live state transitions.

#### 3. Podcast completion → suggestion refresh (BLOCKED until gap closed)

**Test:** After closing gap 1 (mount `useDailyRefresh`), generate a podcast. After generation completes, check if suggestions are refreshed.
**Expected:** `PODCAST_GENERATION_COMPLETED` event triggers `useDailyRefresh` → `plannerAutoGenService.generateAndStoreSuggestions()` → new moves appear.
**Why human:** Requires gap fix first; then live event verification; cannot be statically verified.

---

### Gaps Summary

Two gaps block full goal achievement:

**Gap 1 — useDailyRefresh orphaned (blocks PLANNER-03 daily-after-podcast path)**
`useDailyRefresh.ts` implements the PODCAST_GENERATION_COMPLETED → refresh event chain but is never imported or mounted anywhere in the app. The hook exists as dead code. The 24h on-mount check in `usePlannerAutoGen` covers the "daily refresh on first open" path, but the podcast-triggered refresh path is non-functional. Fix: import and call `useDailyRefresh()` in `PlannerScreen.tsx` or a root-level layout.

**Gap 2 — Planner settings not persisted (minor UX regression)**
`plannerRefreshEnabled` and `plannerRefreshTime` in SettingsScreen use React local state initialized to hardcoded defaults. User changes reset on every app restart. The SUMMARY decision note describes this as "cosmetic pref stored in localStorage separately" but no localStorage write was implemented. Fix: persist these two values to localStorage on change (e.g., `echolearn_planner_refresh_enabled` / `echolearn_planner_refresh_time`).

**Non-blocking notes:**
- `SuggestedMovesSection.tsx` replaced by `MoveCard.tsx` — acceptable substitution, functionally equivalent.
- `prisma/schema.prisma` artifact listed in PLAN does not exist — this project has no Prisma layer; localStorage-only persistence is correct for this codebase.
- Feed engagement signal (`recordFeedView`) not wired to HomeScreen — acknowledged known stub; system degrades gracefully.
- PLANNER-04 is not claimed by this phase; it is an orphaned requirement that remains unimplemented.

---

_Verified: 2026-03-27T20:30:00Z_
_Verifier: Claude (gsd-verifier)_

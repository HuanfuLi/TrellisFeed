# Phase 54: Code Quality, Bugs & Tech Debt - Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 11 new/modified files (6 new test files, 3 source edits, 1 source deletion, 1 planning artifact)
**Analogs found:** 10 / 11 (1 has no code analog — the tech-debt inventory document)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `tests/screens/HomeScreen.empty-questions-no-error.test.mjs` | test (source-reading) | request-response | `tests/screens/HomeScreen.exploredAnchors-resync.test.mjs` | exact |
| `tests/services/concept-feed-bonus-cap.test.mjs` | test (inline-algorithm) | batch | `tests/services/bonus-post-cap.test.mjs` | exact |
| `tests/screens/SettingsDataScreen.force-new-day.test.mjs` | test (source-reading) | request-response | existing — already passing; verify only | exact |
| `tests/screens/HomeScreen.exploredAnchors-resync.test.mjs` | test (source-reading) | request-response | existing — already passing; verify only | exact |
| `app/src/services/scheduler.service.ts` | service | event-driven | itself (edit: `console.log` → `console.warn`) | n/a — self-edit |
| `app/src/screens/PodcastScreen.tsx` | screen | request-response | itself (edit: remove stale `eslint-disable`) | n/a — self-edit |
| `app/src/state/usePlanner.ts` | hook | CRUD | `tests/services/trajectoryAnalyzer.test.mjs` (deletion, not analog) | deletion candidate |
| `app/src/screens/ConnectionPostScreen.tsx` | screen (unrouted) | request-response | `app/src/screens/PostDetailScreen.tsx` | role-match (for verification) |
| `app/src/services/trajectoryAnalyzer.service.ts` | service | event-driven | itself (edit: `recordFeedView` decision: delete or wire) | n/a — self-edit |
| `.planning/phases/54-code-quality-bugs-tech-debt/54-TECH-DEBT-INVENTORY.md` | planning artifact | n/a | `.planning/milestones/v1.5-phases/45-code-quality-sweep/45-DEAD-CODE-SWEEP.md` | format analog only |
| `.planning/debug/resolved/` (2 file moves) | planning artifact | n/a | `.planning/debug/resolved/force-new-day-wipes-saved-liked.md` | exact workflow |

---

## Pattern Assignments

### `tests/screens/HomeScreen.empty-questions-no-error.test.mjs` (test, source-reading)

**Analog:** `app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs`

**Purpose:** Regression guard that `generationError` is NOT set when `questions.length === 0` (first-time user — no posts yet, but this is not an LLM error).

**Imports pattern** (`HomeScreen.exploredAnchors-resync.test.mjs` lines 22-30):
```javascript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME_PATH = resolve(__dirname, '../../src/screens/HomeScreen.tsx');
const source = readFileSync(HOME_PATH, 'utf-8');
```

**Core source-reading pattern** (`HomeScreen.exploredAnchors-resync.test.mjs` lines 36-46):
```javascript
// Slice the source to a specific region between two anchor strings
function getVineResyncSlice() {
  const startMarker = 'creditAwardedRef = useRef(';
  const endMarker = "eventBus.subscribe('CONCEPT_EXPLORED'";
  const startIdx = source.indexOf(startMarker);
  const endIdx = source.indexOf(endMarker);
  assert.ok(
    startIdx !== -1 && endIdx !== -1 && endIdx > startIdx,
    `Could not locate anchor pair. startIdx=${startIdx}, endIdx=${endIdx}.`,
  );
  return source.slice(startIdx, endIdx);
}
```

**Assertion pattern** (`HomeScreen.exploredAnchors-resync.test.mjs` lines 48-56):
```javascript
describe('HomeScreen vine state resync on /home navigation (Phase 36-14)', () => {
  it('declares an effect ... that resyncs setExploredAnchors when location.pathname === "/home"', () => {
    const slice = getVineResyncSlice();
    assert.match(
      slice,
      /useEffect\(\(\)\s*=>\s*\{[\s\S]*?location\.pathname\s*===\s*['"]\/home['"][\s\S]*?setExploredAnchors\(dailyReadService\.getExploredAnchors\(\)\)[\s\S]*?\},\s*\[location\.pathname\]\)/,
      'descriptive failure message here',
    );
  });
});
```

**For the new test:** Locate the `generationError` gate in HomeScreen source:
- The gate lives at `HomeScreen.tsx:223`: `if (posts.length === 0 && questions.length > 0 && !warmStartHadPostsRef.current) { setGenerationError(true); }`
- Assert that `questions.length > 0` is a required condition (i.e., the guard text is present in source). Use `assert.match(source, /questions\.length\s*>\s*0/)`.
- Use the region-slice technique: slice from `setGenerationError(false)` (line 202) to the `setGenerationError(true)` call. Assert the `questions.length > 0` guard exists between them.

---

### `tests/services/concept-feed-bonus-cap.test.mjs` (test, inline-algorithm)

**Analog:** `app/tests/services/bonus-post-cap.test.mjs`

**Purpose:** Cover QUALITY-01 edge case — `generateMorePosts` with `allExplored=true` and `bonusCap=0` returns `[]` cleanly without crashing.

**Imports + localStorage mock pattern** (`bonus-post-cap.test.mjs` lines 1-34):
```javascript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Polyfill localStorage for the settings.service.ts import below
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const { FEED_DEFAULTS } = await import('../../src/services/settings.service.ts');
```

**Inline-algorithm pattern** (`bonus-post-cap.test.mjs` lines 36-50):
```javascript
// Mirror the D-39 gate from generateMorePosts as a pure helper — avoids
// pulling in DOM/Capacitor deps that concept-feed.service.ts transitively requires.
function shouldReturnEmptyDueToBonusCap({ anchors, exploredAnchorIds, totalServed, totalGenerated, bonusCap }) {
  const exploredSet = new Set(exploredAnchorIds);
  const allExplored = anchors.length > 0 && anchors.every(a => exploredSet.has(a.id));
  if (!allExplored) return false;
  return totalServed >= totalGenerated + bonusCap;
}
```

**Test case pattern for the `bonusCap=0` edge** (`bonus-post-cap.test.mjs` lines 115-125):
```javascript
it('(7) bonusCap of 0 — CAPPED immediately once all explored if totalServed >= totalGenerated', () => {
  const capped = shouldReturnEmptyDueToBonusCap({
    anchors: [{ id: 'a-1' }],
    exploredAnchorIds: ['a-1'],
    totalServed: 5,
    totalGenerated: 5,
    bonusCap: 0,
  });
  assert.equal(capped, true, 'bonusCap=0 means no bonus allowed beyond what was generated');
});
```

The new test file should also add: `anchors.length === 0` edge (allExplored is false → NOT capped), and an `anchors.length > 0` but none explored edge. The live code path is `concept-feed.service.ts:1698-1710`.

---

### `app/src/services/scheduler.service.ts` (service, self-edit)

**Analog:** `app/src/services/scheduler.service.ts` (self-edit — convert `console.log` to `console.warn`)

**ESLint rule** (`app/eslint.config.js:41`):
```javascript
// Warn on console usage — allow warn/error for legitimate runtime diagnostics
'no-console': ['warn', { allow: ['warn', 'error'] }],
```
`console.info` is NOT in the allowlist — it still triggers a warning. The correct replacement is `console.warn` (scheduler lifecycle events are legitimate runtime diagnostics, not debug noise).

**All 8 call sites** to replace (`scheduler.service.ts:76,84,113,137,172,178,190` plus `scheduler.native.ts:106,111`):
```typescript
// BEFORE:
console.log(`[Scheduler:podcast] now=${fmt(now)} ...`);
console.log('[Scheduler] Triggering podcast generation at', ...);
console.log('[Scheduler] Triggering planner refresh');
console.log('[Scheduler] Review reminder triggered');
console.log('[Scheduler] App resumed — running checks');
console.log('[Scheduler] Started (60s poll + resume check)');
console.log('[Scheduler] Stopped');

// AFTER: replace console.log → console.warn (allowed by ESLint rule)
console.warn(`[Scheduler:podcast] now=${fmt(now)} ...`);
// etc.
```

---

### `app/src/screens/PodcastScreen.tsx` (screen, self-edit)

**Edit:** Remove stale `// eslint-disable-next-line @typescript-eslint/no-unused-vars` at line 102.

**Context** (`PodcastScreen.tsx:98-107`):
```typescript
    if (state && (state.conceptFilterQaIds || state.conceptTitle)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars   ← DELETE THIS LINE
      const { conceptFilterQaIds: _qa, conceptTitle: _ct, ...rest } = state;
      navigate(location.pathname, { replace: true, state: Object.keys(rest).length > 0 ? rest : null });
    }
```
The `@typescript-eslint/no-unused-vars` suppression is stale because `_qa` and `_ct` use the underscore prefix convention that the ESLint config already exempts. Verify after removal that `npm run lint` reports 0 errors on this file.

---

### `app/src/state/usePlanner.ts` (hook, deletion)

**Status:** `@deprecated` since Phase 26 D-22. Zero live call sites confirmed:
```bash
grep -rn "usePlanner\b" app/src/ app/tests/  # returns 1 result: declaration only
```

**Safe deletion checklist before removing:**
1. Confirm grep of `app/src/` + `app/tests/` shows only the declaration (`state/usePlanner.ts:19`) — no imports elsewhere.
2. Confirm no test imports it: `grep -rn "from.*usePlanner" app/tests/` → 0 results.
3. Confirm `tsc -b --noEmit` passes after deletion.

**File header** (`usePlanner.ts:1-6`) — read for documentation before deleting:
```typescript
/**
 * @deprecated Phase 26 D-22: suggestedChunks were removed from PlannerScreen in
 * favor of trellis-health-driven suggested moves (see PlannerScreen.tsx + Plan 26-04).
 * This hook has no remaining consumers and is retained only to avoid breaking
 * any external imports. Safe to delete once no references surface.
 */
```

---

### `app/src/screens/ConnectionPostScreen.tsx` (screen, deletion candidate)

**Status:** File exports `ConnectionPostScreen` function but it is not wired into `App.tsx` routes. Confirmed via:
```bash
grep -rn "ConnectionPostScreen" app/src/  # returns 1 result: the declaration itself
grep "ConnectionPostScreen" app/src/App.tsx  # 0 results
```

**Safe deletion checklist:**
1. Confirm `grep -rn "ConnectionPostScreen" app/src/ app/tests/` → 1 result (declaration only).
2. Confirm `App.tsx` has no route for it.
3. Run `tsc -b --noEmit` after deletion.

**Analog for verification only** — `app/src/screens/PostDetailScreen.tsx` is the live analog for post-detail navigation screens. Do not copy patterns from ConnectionPostScreen; instead, verify it has no unique types or utilities that are live before deleting.

---

### `app/src/services/trajectoryAnalyzer.service.ts` (service, dead-code decision)

**Status:** `recordFeedView` (line 63) and `recordStructuralSignalPatch` (line 1285 of `canonical-knowledge.service.ts`) have no live call sites in `app/src/`. Confirmed:
```bash
grep -rn "recordFeedView" app/src/  # returns 1: declaration at trajectoryAnalyzer.service.ts:63
```

**Decision required by planner (open question from RESEARCH.md):** Is this abandoned dead code or a planned Phase 55+ analytics feature? The recommendation is: if the operator confirms abandoned, delete the function and its storage keys (`SIGNAL_CACHE_KEY`, `FEED_VIEWS_KEY`). If planned for Phase 55, re-accept with a rationale comment.

**Test analog for trajectoryAnalyzer:** `app/tests/services/trajectoryAnalyzer.test.mjs` — uses the inline-algorithm (pure helper) pattern, not a direct service import. If `recordFeedView` is deleted, no test update needed (no test currently covers it).

---

### `.planning/phases/54-code-quality-bugs-tech-debt/54-TECH-DEBT-INVENTORY.md` (planning artifact)

**No code analog.** Format analog: `.planning/milestones/v1.5-phases/45-code-quality-sweep/45-DEAD-CODE-SWEEP.md`

**Format to use** (from RESEARCH.md `§Architecture Patterns → Tech Debt Inventory Format`):
```markdown
| # | Item | File(s) | Severity (1-5) | Reach (1-5) | Score | Decision |
|---|------|---------|----------------|-------------|-------|----------|
| T1 | ... | ... | 4 | 4 | 16 | FIX |
| T2 | ... | ... | 2 | 3 | 6 | RE-ACCEPT: rationale |
```

**Scoring rubric (Claude's discretion per D-01):**
- Severity: 1 = cosmetic, 2 = dev experience, 3 = data correctness risk, 4 = user-facing bug risk, 5 = data loss/security
- Reach: 1 = one file, 2 = one subsystem, 3 = multiple screens, 4 = all users all flows, 5 = persistent/irreversible
- Score = S × R. Fix tier: ≥12. Re-accept tier: 6–11. Note-only tier: ≤5.

**Raw items to score** (from RESEARCH.md `§Tech Debt Inventory`): hybrid SQLite/localStorage (S=3, R=4=12 → FIX boundary), heavy service mocking (S=2, R=3=6 → RE-ACCEPT), CapacitorHttp streaming fragility (S=3, R=3=9 → RE-ACCEPT), theme-transition (S=2, R=2=4), SQLite serialization (S=2, R=2=4), localStorage quota (S=3, R=3=9 → RE-ACCEPT), storage-key drift in docs (S=1, R=2=2), scheduler `console.log` (S=1, R=2=2 → FIX for ESLint clean), stale eslint-disable (S=1, R=1=1 → FIX trivially), `usePlanner` dead hook (S=1, R=1=1 → FIX trivially), `ConnectionPostScreen` unrouted (S=1, R=1=1 → FIX trivially), `recordFeedView` no call site (S=2, R=2=4 → pending operator decision).

---

### `.planning/debug/resolved/` (file moves — 2 writeups)

**Analog workflow:** `.planning/debug/resolved/force-new-day-wipes-saved-liked.md` — a prior resolved session that was moved from `debug/` to `debug/resolved/` with its `fix:` and `verification:` fields updated before moving.

**Two files to move:**
1. `.planning/debug/vine-chip-not-clearing-after-force-new-day.md` → `.planning/debug/resolved/vine-chip-not-clearing-after-force-new-day.md`
2. `.planning/debug/feed-not-auto-populating-after-force-new-day.md` → `.planning/debug/resolved/feed-not-auto-populating-after-force-new-day.md`

**Before moving:** Update each file's `fix:` field (currently `(not applied — find_root_cause_only mode)`) with the actual fix locations:
- Bug A fix: `HomeScreen.tsx:667-672` (`[location.pathname]` effect calling `setExploredAnchors` + `creditAwardedRef.current`); guarded by `HomeScreen.exploredAnchors-resync.test.mjs`
- Bug B fix: `SettingsDataScreen.tsx:118-127` (`localStorage.setItem('trellis_daily_posts', ...)` mutation); guarded by `SettingsDataScreen.force-new-day.test.mjs`

---

## Shared Patterns

### Source-Reading Test Pattern
**Source:** `app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs` lines 22-46
**Apply to:** All new test files in `tests/screens/` and `tests/services/` for Phase 54
```javascript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE_PATH = resolve(__dirname, '../../src/path/to/File.tsx');
const source = readFileSync(FILE_PATH, 'utf-8');

// Slice between two anchor strings to prevent cross-effect false positives
function getRegionSlice() {
  const startMarker = 'startAnchorString';
  const endMarker = 'endAnchorString';
  const startIdx = source.indexOf(startMarker);
  const endIdx = source.indexOf(endMarker);
  assert.ok(startIdx !== -1 && endIdx !== -1 && endIdx > startIdx,
    'Could not locate anchor pair. Update markers if structure changed.');
  return source.slice(startIdx, endIdx);
}
```

### Inline-Algorithm (Pure Helper) Test Pattern
**Source:** `app/tests/services/bonus-post-cap.test.mjs` lines 36-50 and `app/tests/services/trajectoryAnalyzer.test.mjs` lines 13-67
**Apply to:** `tests/services/concept-feed-bonus-cap.test.mjs` and any test that exercises concept-feed or canonical-knowledge logic (those services have transitive i18n deps that block direct import under `node --test`)

Mirror the service's core algorithm as a pure JS function in the test file, then test the pure function. Import only deps that don't have `locales/en.json` in their transitive chain. Use the localStorage polyfill if importing `settings.service.ts`.

### localStorage Polyfill Pattern
**Source:** `app/tests/services/bonus-post-cap.test.mjs` lines 26-33
**Apply to:** Any service test that imports a `.ts` file with `localStorage` calls at module load
```javascript
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};
```

### ESLint-Clean Console Pattern
**Source:** `app/eslint.config.js:41`
**Apply to:** `scheduler.service.ts`, `scheduler.native.ts`

The rule is `'no-console': ['warn', { allow: ['warn', 'error'] }]`. Only `console.warn` and `console.error` suppress the lint warning. Replace all `console.log` in scheduler files with `console.warn` (lifecycle/diagnostic events are legitimate) or silence entirely if the operator prefers clean production logs.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.planning/phases/54-code-quality-bugs-tech-debt/54-TECH-DEBT-INVENTORY.md` | planning artifact | n/a | No code analog; format follows `45-DEAD-CODE-SWEEP.md` table conventions; content is the severity × reach scoring matrix prescribed by D-01/D-02 |

---

## Call-Site Counts for Dead-Code Targets

These counts were verified against live `app/src/` at time of mapping (2026-05-20):

| Symbol | Declaration File | Live call sites in `app/src/` | Live call sites in `app/tests/` | Phase 54 action |
|---|---|---|---|---|
| `usePlanner` | `state/usePlanner.ts:19` | 0 | 0 | Delete file |
| `ConnectionPostScreen` | `screens/ConnectionPostScreen.tsx:27` | 0 (not in App.tsx routes) | 0 | Delete file |
| `recordFeedView` | `services/trajectoryAnalyzer.service.ts:63` | 0 | 0 | Pending operator decision: delete or wire |
| `recordStructuralSignalPatch` | `canonical-knowledge.service.ts:1285` | 0 | 0 | Re-accept with rationale or delete |
| `getMoveDestination` | `lib/moveNavigator.ts:195` | 0 | 0 | Re-accept (likely Phase 55 planner candidate) |

---

## Metadata

**Analog search scope:** `app/src/`, `app/tests/`, `.planning/milestones/v1.5-phases/45-code-quality-sweep/`
**Files scanned:** 14 source/test files read directly; ~30 grepped for call-site counts
**Pattern extraction date:** 2026-05-20

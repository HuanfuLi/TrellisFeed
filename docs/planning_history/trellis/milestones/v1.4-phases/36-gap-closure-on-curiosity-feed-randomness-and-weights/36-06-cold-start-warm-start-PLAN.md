---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 06
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/screens/HomeScreen.tsx
  - app/tests/screens/HomeScreen.warm-start-guard.test.mjs
  - .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT-RETEST.md
autonomous: true
requirements: [GAP-A]
gap_closure: true
must_haves:
  truths:
    - "On a cold start of a new day, the feed shows yesterday's leftover posts immediately (warm-start state from getYesterdayQueue is preserved)."
    - "The 'error generating post, please check your settings' UI does NOT fire when getDailyPosts returns [] but a warm-start fallback is already on screen."
    - "When BOTH the warm-start fallback AND today's getDailyPosts are empty AND questions exist, the genuine error UI still fires (preserves the original 6cda914e intent for misconfigured API keys)."
  artifacts:
    - path: app/src/screens/HomeScreen.tsx
      provides: "Warm-start guard on the cold-start useEffect — useRef-snapshot pattern (StrictMode-safe, no nested setState)"
      contains: "warmStartHadPostsRef"
    - path: app/tests/screens/HomeScreen.warm-start-guard.test.mjs
      provides: "Source-reading regression test asserting both guards are present in HomeScreen.tsx"
      contains: "warm-start"
  key_links:
    - from: "app/src/screens/HomeScreen.tsx (useEffect at lines 95-112)"
      to: "app/src/screens/HomeScreen.tsx (useState initializer at lines 38-47)"
      via: "shared dailyPosts state — useEffect must NOT wipe initializer's seed; useRef snapshot captures warm-start presence pre-fetch"
      pattern: "warmStartHadPostsRef"
---

<objective>
Close GAP-A (BLOCKER): cold-start empty feed on a new day. The HomeScreen useState initializer at lines 38-47 correctly seeds `dailyPosts` from `postQueueService.getYesterdayQueue()` — but the useEffect at lines 95-112 immediately overwrites that warm-start state with `setDailyPosts([])` (because `getDailyPosts()` returns [] BY DESIGN on a new-day cold start while refillQueue runs in background) AND fires `setGenerationError(true)` because `posts.length === 0 && questions.length > 0`.

Pre-existing drift introduced by commit 6cda914e (2026-04-18) — the error gate landed without a guard for the normal cold-start case. NOT a Phase 36 regression but surfaced under Phase 36 UAT.

Fix: capture the warm-start presence into a `useRef` BEFORE the async getDailyPosts call, then in the .then handler check the ref directly and call both setters at top level (NO nested updater functions). React's contract requires updater functions to be pure, and the app uses React.StrictMode (main.tsx:14) which double-invokes updaters in dev — the ref-snapshot pattern keeps both setters pure and Strict-Mode-compatible:
1. `setDailyPosts(posts)` only when `posts.length > 0` — never overwrite warm-start with []
2. `setGenerationError(true)` only when `posts.length === 0 && !warmStartHadPostsRef.current` — no warm-start fallback on screen

Purpose: Restore the design intent that yesterday's posts bridge the gap while today's refillQueue fills the today's queue in the background. Eliminates the misleading "Check your API keys in Settings" toast that fires on every new-day cold start for users with valid configs. Pure-updater compliance (Strict Mode + React 19 contract).

Output: Two-step fix in HomeScreen.tsx (ref + branched setters) + one regression test that source-reads HomeScreen.tsx and asserts the guards are present.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT.md
@.planning/debug/cold-start-empty-feed.md
@CLAUDE.md
@app/src/screens/HomeScreen.tsx
@app/src/services/post-queue.service.ts
@app/src/services/concept-feed.service.ts

<interfaces>
HomeScreen.tsx state setters used in this plan:
```typescript
const [dailyPosts, setDailyPosts] = useState<DailyPost[]>(() => { /* warm-start initializer at lines 38-47 */ });
const [generationError, setGenerationError] = useState(false);
```

Ref-snapshot pattern (chosen for Strict Mode + pure-updater compliance):
```typescript
const warmStartHadPostsRef = useRef(dailyPosts.length > 0);
// ...later, inside .then handler...
if (posts.length > 0) setDailyPosts(posts);
setIsGenerating(false);
if (posts.length === 0 && questions.length > 0 && !warmStartHadPostsRef.current) {
  setGenerationError(true);
}
```

`postQueueService.getYesterdayQueue()` is imported via `postQueueService` (already wired at line 13). Returns `DailyPost[]` from yesterday's localStorage snapshot, bypasses today's `_state` reset. Confirmed live, not dead code.

`conceptFeedService.getDailyPosts(questions)` returns:
- [] on a new-day cold start (today's queue empty, refillQueue fires in background)
- [] when API config is genuinely broken (LLM returns nothing)
- DailyPost[] when today's queue is populated

The current code cannot distinguish those three cases at the call site. The fix uses the ref-captured warm-start presence as the disambiguator: if warm-start posts WERE seeded at mount, treat empty as "queue not ready yet"; if no warm-start was seeded, treat as genuine error.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add warm-start guard to HomeScreen.tsx cold-start useEffect (useRef snapshot pattern)</name>
  <files>app/src/screens/HomeScreen.tsx</files>
  <read_first>
    - app/src/screens/HomeScreen.tsx (entire file — focus on lines 38-47 useState initializer and lines 95-112 useEffect; check existing useRef imports)
    - .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT.md (Gap 1 root_cause + missing fields)
    - .planning/debug/cold-start-empty-feed.md (full diagnosis with file:line evidence)
    - CLAUDE.md (Concept Feed Generation Pipeline section — DO NOT DRIFT rules; warm-start is a load-bearing concept here)
  </read_first>
  <action>
    STEP 1 — Verify `useRef` is already imported from React (HomeScreen.tsx top imports). If `useRef` is NOT in the existing `import { ... } from 'react';` line, ADD it. If it is already imported, no change needed.

    STEP 2 — Add a `useRef` immediately AFTER the `dailyPosts` useState declaration (around line 47, just after the warm-start initializer closes). Insert (verbatim):

```typescript
    // Phase 36 GAP-A: Capture warm-start presence at mount BEFORE the async
    // getDailyPosts call. Used as the disambiguator inside the .then handler
    // to decide whether an empty getDailyPosts return is a normal cold-start
    // (warm-start was seeded → queue not ready yet, no error UI) or a genuine
    // error (no warm-start AND empty fetch → "Check your API keys" UI).
    //
    // Ref-snapshot pattern (NOT functional updater) chosen for two reasons:
    // 1. Strict Mode compatibility: React.StrictMode (main.tsx:14) double-invokes
    //    state updater functions in dev. Calling setGenerationError(true) inside
    //    a setDailyPosts(prev => ...) updater violates the React purity contract
    //    (updater functions must be side-effect-free).
    // 2. The warm-start presence is a fact-at-mount, not a continuously-derived
    //    value — useRef is the canonical place for "snapshot at construction
    //    time, read in async callbacks" data.
    // See .planning/debug/cold-start-empty-feed.md.
    const warmStartHadPostsRef = useRef(dailyPosts.length > 0);
```

    STEP 3 — Replace the .then handler at HomeScreen.tsx lines 98-105 (currently):

```typescript
    void conceptFeedService.getDailyPosts(questions).then((posts) => {
      if (!cancelled) {
        setDailyPosts(posts);
        setIsGenerating(false);
        if (posts.length === 0 && questions.length > 0) {
          setGenerationError(true);
        }
      }
    }).catch((err) => {
```

WITH (verbatim — copy exactly):

```typescript
    void conceptFeedService.getDailyPosts(questions).then((posts) => {
      if (!cancelled) {
        // Warm-start guard (Phase 36 GAP-A): getDailyPosts returns [] on a new-day
        // cold start by design (today's queue empty; refillQueue runs in background).
        // The useState initializer at lines 38-47 may have already seeded dailyPosts
        // with yesterday's leftover queue via postQueueService.getYesterdayQueue().
        // Only overwrite when getDailyPosts returns actual posts — top-level setter,
        // pure (Strict Mode safe).
        if (posts.length > 0) {
          setDailyPosts(posts);
        }
        setIsGenerating(false);
        // Error-gate suppression (Phase 36 GAP-A): only flag generationError when
        // BOTH today's getDailyPosts returned [] AND no warm-start fallback was
        // seeded at mount (warmStartHadPostsRef captured pre-fetch). If warm-start
        // was present, the user can see content and the empty `posts` is a normal
        // cold-start condition, not an error. Original 6cda914e error-gate intent
        // (genuinely broken API keys) is preserved by the !warmStartHadPostsRef.current
        // condition — no warm-start AND no fetch result = real error.
        // Top-level conditional setter (no nested setState — Strict Mode safe).
        if (posts.length === 0 && questions.length > 0 && !warmStartHadPostsRef.current) {
          setGenerationError(true);
        }
      }
    }).catch((err) => {
```

NOTE on the ref vs functional-updater choice: the original revision draft used `setDailyPosts((prev) => { if (prev.length === 0) setGenerationError(true); return prev; })` to read the latest dailyPosts state inside the .then handler. That pattern violates React's purity contract for updater functions (StrictMode double-invokes them in dev) and is technically observable as setGenerationError firing twice. The useRef snapshot captures the warm-start presence ONCE at mount and is read directly inside the .then closure — pure setters, no nested state reads, and StrictMode-safe. This is the canonical React pattern for "snapshot at mount, read in async callback."

Also note: the existing `.catch` block at lines 106-112 is correct and unchanged — that path fires only on genuine promise rejection (network error, etc.), not on the empty-array return. Leave it alone.

Per CLAUDE.md "Phase 32.1 lessons" rule 8 — document load-bearing fixes in three places: (a) the inline comment block in the useRef declaration AND the .then handler (above), (b) this PLAN file, (c) `.planning/debug/cold-start-empty-feed.md` already documents the root cause. No CLAUDE.md edit needed for this gap (the warm-start contract is documented in code comments at the modified site; Phase 36-05 already updated the Concept Feed Pipeline section).
  </action>
  <verify>
    <automated>cd app && grep -c "warmStartHadPostsRef" src/screens/HomeScreen.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "warmStartHadPostsRef" app/src/screens/HomeScreen.tsx` returns ≥3 (declaration + two reads / comment refs)
    - `grep -c "useRef(dailyPosts.length > 0)" app/src/screens/HomeScreen.tsx` returns 1
    - `grep -c "Warm-start guard (Phase 36 GAP-A)" app/src/screens/HomeScreen.tsx` returns ≥1
    - `grep -c "Error-gate suppression (Phase 36 GAP-A)" app/src/screens/HomeScreen.tsx` returns ≥1
    - `grep -c "!warmStartHadPostsRef.current" app/src/screens/HomeScreen.tsx` returns ≥1
    - The unconditional `setDailyPosts(posts);` line at the original line 100 is REMOVED OR is now wrapped in an `if (posts.length > 0)` block — verify via `grep -B1 "setDailyPosts(posts);" app/src/screens/HomeScreen.tsx | grep -c "if (posts.length > 0)"` returns ≥1
    - `cd app && npx tsc -b --noEmit` exits 0
  </acceptance_criteria>
  <done>
    HomeScreen.tsx contains the useRef snapshot + conditional posts setter + conditional error gate gated by `!warmStartHadPostsRef.current`. The unconditional `setDailyPosts(posts)` and unconditional `setGenerationError(true)` are gone. No nested setState. tsc clean.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add source-reading regression test for warm-start guard</name>
  <files>app/tests/screens/HomeScreen.warm-start-guard.test.mjs</files>
  <read_first>
    - app/src/screens/HomeScreen.tsx (the patched useEffect — verify the strings are stable)
    - app/tests/components/ChatInput.flex-shrink.test.mjs (existing source-reading test pattern — copy its `fs.readFileSync` + assertion style)
    - .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT.md (Gap 1 missing field)
  </read_first>
  <behavior>
    - Test 1: Reads HomeScreen.tsx source, asserts `warmStartHadPostsRef` ref declaration is present (snapshot pattern invariant — preserves warm-start without nested setState)
    - Test 2: Reads HomeScreen.tsx source, asserts `!warmStartHadPostsRef.current` is referenced inside the error-gate condition (suppression invariant)
    - Test 3: Reads HomeScreen.tsx source, asserts there is NO unconditional `setDailyPosts(posts);` line at top level — must be wrapped in `if (posts.length > 0)`. Pattern: lines matching `/^\s*setDailyPosts\(posts\);\s*$/m` MUST be preceded (within the previous 2 lines) by `if (posts.length > 0)` or be inside such a block. The simpler invariant we test: an `if (posts.length > 0)` substring exists in the file.
  </behavior>
  <action>
    Create the test file with this content (verbatim — uses `node:test` per CLAUDE.md test framework rule):

```javascript
// Phase 36 GAP-A regression guard: ensures HomeScreen.tsx preserves warm-start posts
// on a new-day cold start instead of unconditionally overwriting them with [].
// See .planning/debug/cold-start-empty-feed.md for the full diagnosis.
//
// Source-reading test (no React render harness needed) — same pattern as
// app/tests/components/ChatInput.flex-shrink.test.mjs (CLAUDE.md ChatInput rule).
//
// Pattern note: the fix uses a useRef-snapshot pattern (NOT a functional updater)
// for Strict Mode purity. React.StrictMode double-invokes state updater functions
// in dev, so calling setGenerationError(true) inside a setDailyPosts((prev) => ...)
// updater would fire the side-effect twice. useRef captures warm-start presence
// once at mount; the .then handler reads it directly — pure top-level setters.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME_SCREEN_PATH = resolve(__dirname, '../../src/screens/HomeScreen.tsx');
const source = readFileSync(HOME_SCREEN_PATH, 'utf-8');

describe('HomeScreen warm-start guard (Phase 36 GAP-A)', () => {
  it('declares warmStartHadPostsRef snapshot to capture warm-start presence at mount', () => {
    assert.ok(
      source.includes('warmStartHadPostsRef'),
      'HomeScreen.tsx must declare a `warmStartHadPostsRef` useRef so the .then handler can read warm-start presence without violating React updater purity. See .planning/debug/cold-start-empty-feed.md.',
    );
    assert.ok(
      source.includes('useRef(dailyPosts.length > 0)'),
      'warmStartHadPostsRef must be initialized from `dailyPosts.length > 0` to snapshot warm-start presence at mount, BEFORE the async getDailyPosts call resolves.',
    );
  });

  it('only fires generationError when ref says no warm-start was seeded', () => {
    assert.ok(
      source.includes('!warmStartHadPostsRef.current'),
      'HomeScreen.tsx must gate setGenerationError(true) on `!warmStartHadPostsRef.current` — otherwise the misleading "Check your API keys" toast fires every new-day cold start when warm-start posts are showing. The original 6cda914e error-gate intent (genuinely broken API keys) is preserved by the no-warm-start case.',
    );
  });

  it('does NOT contain an unconditional setDailyPosts(posts) at top level (must be guarded by if posts.length > 0)', () => {
    // The fixed code wraps the posts setter in `if (posts.length > 0) { setDailyPosts(posts); }`.
    // Assert that the file contains the guarding conditional. (We do NOT assert absence of the
    // bare line because the conditional form `if (posts.length > 0) { setDailyPosts(posts); }`
    // contains `setDailyPosts(posts);` on its own indented line — that's correct.)
    assert.ok(
      source.includes('if (posts.length > 0)'),
      'HomeScreen.tsx must guard the posts setter with `if (posts.length > 0)` — the GAP-A bug was the unconditional `setDailyPosts(posts);` overwriting warm-start. The guard MUST be present.',
    );
  });

  it('uses pure top-level setters (no nested setState inside another updater)', () => {
    // Negative assertion: the .then handler should NOT contain a setState callback
    // that calls another setState. We check for the specific anti-pattern where
    // setGenerationError or any setter appears inside a `setDailyPosts((prev) => ...)`
    // updater function body.
    const nestedPattern = /setDailyPosts\(\s*\(\s*prev[\s\S]{0,200}?setGenerationError/;
    assert.ok(
      !nestedPattern.test(source),
      'HomeScreen.tsx must NOT call setGenerationError inside a setDailyPosts((prev) => ...) updater. React updater functions must be pure (Strict Mode double-invokes them in dev). Use the warmStartHadPostsRef pattern for top-level setters instead.',
    );
  });
});
```

Place at `app/tests/screens/HomeScreen.warm-start-guard.test.mjs`. The `tests/screens/` directory may not exist yet — create it.
  </action>
  <verify>
    <automated>cd app && node --test tests/screens/HomeScreen.warm-start-guard.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `cd app && node --test tests/screens/HomeScreen.warm-start-guard.test.mjs` reports `tests 4 / pass 4 / fail 0`
    - `cd app && npm test 2>&1 | tail -5` shows no NEW failures vs. the Phase 36 baseline (422 pass / 26 fail per STATE.md). New baseline target: ≥426 pass / ≤26 fail.
    - `cd app && npx tsc -b --noEmit` exits 0
  </acceptance_criteria>
  <done>
    Test file exists at `app/tests/screens/HomeScreen.warm-start-guard.test.mjs` with 4 GREEN tests. The full npm test suite reports +4 pass and 0 new fail vs. Phase 36 baseline.
  </done>
</task>

<task type="auto">
  <name>Task 3: Manual UAT recipe for cold-start verification</name>
  <files>.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT-RETEST.md</files>
  <read_first>
    - .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT.md (Gap 1 reproduction steps)
    - .planning/debug/cold-start-empty-feed.md (root_cause section)
  </read_first>
  <action>
    Append a "Test 1 (Cold-start retest after GAP-A fix)" section to `36-UAT-RETEST.md` (create the file if it does not exist; if it exists, append). Content (verbatim):

```markdown
___
status: pending
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
parent: 36-UAT.md
started: 2026-05-06
___

## Retest Tests

### Test 1 (GAP-A retest — cold-start warm-start preserved)

**Setup**: Have the app open with a populated post queue from a prior session (yesterday's posts
in localStorage key `echolearn_post_queue` with `date` field set to yesterday's date — to simulate
this in dev tools, manually edit the date field to one day in the past).

**Reproduction steps**:
1. Close the app fully (kill the tab/process).
2. Edit the `echolearn_post_queue` localStorage entry to set `date` to yesterday's date.
3. Re-open the app on the home screen (`/home`).
4. Observe the feed within the first 2 seconds of load.

**Expected after GAP-A fix**:
- Yesterday's leftover posts (up to 8) appear immediately on screen — the warm-start populates from
  `postQueueService.getYesterdayQueue()` via the useState initializer at HomeScreen.tsx:38-47.
- The feed does NOT flicker to empty + back, even when `getDailyPosts()` resolves with [] from the
  cold-start path 200ms later.
- The "Couldn't generate posts / Check your API keys in Settings" error UI does NOT appear.
- After ~8 seconds, the delayed `refreshFeed()` (HomeScreen.tsx:127-129) replaces the warm-start
  posts with today's freshly-generated batch from the now-populated queue.

**Failure mode (GAP-A active, pre-fix)**:
- Feed briefly shows yesterday's posts, then flickers to empty + AlertCircle + "Check your API keys"
  message ~200ms after mount.
- Stays empty until the user manually navigates away and back, OR the 8-second delayed refresh
  fires.

**Pass criteria**: Steps 1-4 produce only the expected behavior; no flicker; no error UI.
```

Reuse `36-UAT-RETEST.md` for retest results from 36-07 and 36-08 — append additional test sections under the same file.
  </action>
  <verify>
    <automated>test -f .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT-RETEST.md && grep -c "GAP-A retest" .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT-RETEST.md</automated>
  </verify>
  <acceptance_criteria>
    - `36-UAT-RETEST.md` exists at the phase dir
    - Contains a section heading `### Test 1 (GAP-A retest — cold-start warm-start preserved)`
    - Contains "Expected after GAP-A fix" and "Failure mode (GAP-A active, pre-fix)" subsections
    - Contains the localStorage editing reproduction recipe
  </acceptance_criteria>
  <done>
    Retest recipe is on disk, ready for the operator to walk through after merge.
  </done>
</task>

</tasks>

<verification>
Phase-level checks for this plan:

```bash
# 1. Source-reading regression test passes
cd app && node --test tests/screens/HomeScreen.warm-start-guard.test.mjs
# Expect: tests 4 / pass 4 / fail 0

# 2. useRef snapshot present at the patched site
grep -c "warmStartHadPostsRef" app/src/screens/HomeScreen.tsx
# Expect: ≥3

# 3. Conditional error gate present
grep -c "!warmStartHadPostsRef.current" app/src/screens/HomeScreen.tsx
# Expect: ≥1

# 4. Conditional posts setter present
grep -c "if (posts.length > 0)" app/src/screens/HomeScreen.tsx
# Expect: ≥1

# 5. tsc clean
cd app && npx tsc -b --noEmit
# Expect: exit 0

# 6. Full npm test no new failures
cd app && npm test
# Expect: pass count ≥ 426, fail count ≤ 26 (Phase 36 baseline + this plan's +4 tests)
```
</verification>

<success_criteria>
- [ ] HomeScreen.tsx declares `warmStartHadPostsRef = useRef(dailyPosts.length > 0)` at mount
- [ ] `setDailyPosts(posts)` only fires when `posts.length > 0` (top-level conditional)
- [ ] `setGenerationError(true)` gated behind `posts.length === 0 && questions.length > 0 && !warmStartHadPostsRef.current` (top-level conditional, no nested setState)
- [ ] Source-reading regression test passes (4/4)
- [ ] No new failures in `npm test` (Phase 36 baseline preserved at 26 pre-existing fails)
- [ ] `tsc -b --noEmit` exit 0
- [ ] 36-UAT-RETEST.md retest recipe drafted for operator walk-through
</success_criteria>

<output>
After completion, create `.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-06-SUMMARY.md`
</output>

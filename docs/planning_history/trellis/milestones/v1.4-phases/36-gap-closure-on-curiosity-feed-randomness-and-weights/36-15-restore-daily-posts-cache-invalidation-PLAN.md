---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 15
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/screens/settings/SettingsDataScreen.tsx
  - app/tests/screens/SettingsDataScreen.force-new-day.test.mjs
autonomous: true
requirements: [GAP-D-round4-b-storage]
gap_closure: true
must_haves:
  truths:
    - "After Force New Day, echolearn_daily_posts.date is mutated to yesterday alongside echolearn_post_queue.date — so loadCache()'s parsed.date !== today() rejection fires symmetrically with the queue's date-mismatch rehydration."
    - "Plan 36-13's negative regression Test 6 is INVERTED: the new test asserts the daily-posts mutation IS present, with a code-comment explaining the wall-clock-asymmetry rationale and a 'do not flip back' marker."
    - "Plan 36-11 + Plan 36-12 contracts preserved: loadCache() date-rejection (Plan 36-11 Task 1) and load() rehydration (Plan 36-11 Task 2) and refill mutex (Plan 36-12) are unchanged — this plan only restores the CALLER-SIDE input that triggers loadCache()'s rejection on the dev-button path."
    - "Plan 36-13 Task 1's other improvements preserved: dailyReadService.reset() is still called by handleForceNewDay (closes round-3 sub-issue (a)); the toast text is updated to reflect the restored two-cache mutation."
    - "This plan does NOT touch HomeScreen.tsx — the runtime consequence (feed auto-populating from yesterday's queue) is closed by Plan 36-14's warm-start re-fallback effect on /home navigation. This plan owns only the storage-mutation half of sub-issue (b); Plan 36-14 owns the runtime half. Together they close (b) end-to-end."
  artifacts:
    - path: app/src/screens/settings/SettingsDataScreen.tsx
      provides: "handleForceNewDay handler restored to mutate both queue and daily-posts cache dates, with rationale comment"
    - path: app/tests/screens/SettingsDataScreen.force-new-day.test.mjs
      provides: "Test 6 inverted: now asserts the daily-posts mutation IS present with rationale and a 'do not flip back' marker"
  key_links:
    - via: "localStorage write"
      from: app/src/screens/settings/SettingsDataScreen.tsx
      pattern: "localStorage\\.setItem\\(['\"]echolearn_daily_posts['\"]"
---

# Plan 36-15 — Restore daily-posts cache invalidation in handleForceNewDay (storage half of sub-issue b)

## Objective

Close the STORAGE half of round-4 sub-issue (b) — handleForceNewDay no longer mutates `echolearn_daily_posts.date`, so on the dev-button path `loadCache()` returns truthy and `getDailyPosts()` hits its cache-hit branch (concept-feed.service.ts ~1530) returning yesterday's served posts. Plan 36-13 removed the dual-cache mutation as a "redundant dual-cache hack"; round-4 UAT proved the reversion broke sub-issue (b). Reinstate the mutation and invert Plan 36-13's negative Test 6.

The runtime consequence (feed auto-populating from yesterday's UNSERVED queue when the cache is empty) is owned by Plan 36-14's warm-start re-fallback effect on /home navigation — this plan does NOT touch HomeScreen.tsx. The two plans are complementary: this plan creates the trigger condition (`loadCache()` returns null), Plan 36-14 reacts to the trigger (falls back to `getYesterdayQueue()` when `getCachedDailyPosts()` returns `[]`).

## Background

See `.planning/debug/feed-not-auto-populating-after-force-new-day.md` for the full root-cause walkthrough.

Plan 36-13's reversion was based on the assumption that "Plan 36-11's loadCache date-rejection handles staleness symmetrically." That's true for **natural midnight rollover** (where `today()` advances at the wall clock — a stale cache's `parsed.date` is now yesterday relative to the new today, so the `parsed.date !== today()` check fires and the cache is rejected). But it is **not true** for the dev button: the wall clock has not advanced, `today()` returns the SAME value before and after the button press, and the daily-posts cache's `parsed.date` (still equal to real today) passes the rejection check.

This is the same wall-clock-asymmetry pattern that Plan 36-13 correctly identified for the `dailyReadService.reset()` issue: a service that gates self-reset on `today()` comparisons cannot fire when the dev button doesn't (and shouldn't) advance the wall clock — so the dev handler must explicitly mutate the relevant storage to mimic what `today()` advancing would have caused. The same logic applies here.

The framing of the Plan 36-13 reversion as "dual-cache hack" was misleading. There is one conceptual signal — "today's cached state is stale; treat it as yesterday's" — but it has TWO physical localStorage keys (`echolearn_post_queue` and `echolearn_daily_posts`). Both keys are date-stamped; both keys' rejection logic is identical (`parsed.date !== today()`). The dev button must mutate both. Calling this "redundant" was incorrect — the queue mutation triggers `load()`'s rehydration path (Plan 36-11 Task 2) and the daily-posts mutation triggers `loadCache()`'s rejection path (Plan 36-11 Task 1). They're symmetric in their function, not redundant.

This plan is parallel-safe with Plan 36-14 (different files entirely; Plan 36-14 touches HomeScreen.tsx + 2 new test files + CLAUDE.md, this plan touches SettingsDataScreen.tsx + the existing force-new-day test file). No file overlap.

## Tasks

### Task 1 — Restore the daily-posts cache mutation in handleForceNewDay

**File:** `app/src/screens/settings/SettingsDataScreen.tsx`

**Action:**

The current handler body (lines 77-110, after Plan 36-13 landed) does:

```typescript
const handleForceNewDay = () => {
  try {
    const raw = localStorage.getItem('echolearn_post_queue');
    if (!raw) {
      toast('No post queue to roll back. Generate some posts first.', 'info');
      return;
    }
    const parsed = JSON.parse(raw);
    // (long comment block omitted)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    parsed.date = yesterday;
    localStorage.setItem('echolearn_post_queue', JSON.stringify(parsed));
    postQueueService.loadQueue();
    // (more comments omitted)
    dailyReadService.reset();
    toast('Queue date rolled back; vine progress reset. Navigating to /home.', 'success');
    navigate('/home');
  } catch (err) {
    // ...
  }
};
```

Replace the handler body with the following version. The two key changes from the current form: (1) ADD a parallel mutation of `echolearn_daily_posts.date` after the queue mutation; (2) UPDATE the toast text and the inline comments to reflect the restored two-cache contract. Keep `dailyReadService.reset()` (Plan 36-13's correct addition).

```typescript
const handleForceNewDay = () => {
  try {
    const raw = localStorage.getItem('echolearn_post_queue');
    if (!raw) {
      toast('No post queue to roll back. Generate some posts first.', 'info');
      return;
    }
    const parsed = JSON.parse(raw);
    // Set date to yesterday so the next loadQueue() detects the mismatch
    // and (a) snapshots the current payload to STORAGE_KEY_YESTERDAY
    // (Plan 36-09); (b) rehydrates _state.posts from parsed.posts
    // (Plan 36-11) so yesterday's UNSERVED queue auto-populates today's
    // feed. See round-3 sub-issue (b cause #1) and Plan 36-11.
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    parsed.date = yesterday;
    localStorage.setItem('echolearn_post_queue', JSON.stringify(parsed));
    postQueueService.loadQueue();
    // Phase 36-15 (round-4 sub-issue b storage): also mutate the served-
    // posts cache key. Plan 36-11's loadCache() rejection fires only when
    // `parsed.date !== today()` — but the dev button cannot advance the
    // wall clock. So `today()` returns real-today before AND after this
    // handler runs; if we leave echolearn_daily_posts.date untouched, it
    // still equals today(), loadCache() returns truthy, getDailyPosts()
    // hits its cache-hit branch (concept-feed.service.ts ~1530), and
    // dequeue()-of-rehydrated-state never runs. The rehydrated _state.posts
    // from Plan 36-11 sits unreachable. Mirror the same date mutation here
    // so loadCache()'s rejection fires symmetrically — same logic as the
    // queue mutation above, applied to the second date-stamped cache key.
    // This is the wall-clock-asymmetry pattern: services that gate self-
    // reset on today() comparisons cannot fire when the dev button doesn't
    // (and shouldn't) advance the clock — the handler must mimic each
    // mutation that natural midnight rollover would have triggered.
    // Plan 36-13 reverted this mutation calling it a "redundant dual-
    // cache hack"; round-4 UAT proved the reversion broke sub-issue (b).
    // Plan 36-14 owns the runtime consequence (HomeScreen falls back to
    // postQueueService.getYesterdayQueue() when getCachedDailyPosts()
    // returns []) — without that re-fallback effect, this storage
    // mutation alone produces an empty feed. The two plans are
    // complementary, not duplicative.
    // See .planning/debug/feed-not-auto-populating-after-force-new-day.md.
    const dailyRaw = localStorage.getItem('echolearn_daily_posts');
    if (dailyRaw) {
      try {
        const dailyParsed = JSON.parse(dailyRaw);
        dailyParsed.date = yesterday;
        localStorage.setItem('echolearn_daily_posts', JSON.stringify(dailyParsed));
      } catch {
        // Malformed cache — leave it; loadCache() will reject on parse failure anyway.
      }
    }
    // Reset vine progress (echolearn_daily_read). On a real midnight,
    // dailyReadService.loadState() self-resets via the parsed.date !==
    // today() check, but the dev button cannot advance today() — so the
    // service still sees parsed.date === today() (real today) and never
    // resets. Manually mimic the midnight reset here. See round-3
    // sub-issue (a) and daily-read.service.ts:36.
    dailyReadService.reset();
    toast('Queue + daily-posts cache rolled back; vine progress reset. Navigating to /home.', 'success');
    navigate('/home');
  } catch (err) {
    console.warn('[SettingsDataScreen] force-new-day failed:', err);
    toast('Force new day failed. Check console.', 'error');
  }
};
```

Key changes from the post-Plan-36-13 form:
- **ADDED:** parallel mutation of `echolearn_daily_posts.date` after the queue mutation, wrapped in a try/catch to handle malformed JSON gracefully (the surrounding try/catch already handles other failure modes).
- **UPDATED:** the explanatory comment block on the queue mutation now refers ONLY to round-3 sub-issue (b cause #1) (the rehydration-trigger purpose); a NEW comment block explains the daily-posts mutation purpose (round-4 sub-issue b — wall-clock asymmetry) and explicitly cross-references Plan 36-14's runtime consequence.
- **UPDATED:** toast text from "Queue date rolled back; vine progress reset. Navigating to /home." to "Queue + daily-posts cache rolled back; vine progress reset. Navigating to /home." Reflects the two-cache mutation accurately.

**Don't touch:**
- The `import.meta.env.DEV` gate on the SettingRow (still needed)
- The hardcoded English strings + inline i18n exemption comment (still applies)
- The `dailyReadService.reset()` call (Plan 36-13's correct addition — preserved)
- `postQueueService.loadQueue()` (Plan 36-11 trigger — preserved)
- `navigate('/home')` (preserved)
- Any other Settings handler (handleClearAllData, handleResetToday, etc.)
- HomeScreen.tsx (Plan 36-14's territory — file overlap is forbidden in this plan)

**Verification (compile):**

```bash
cd /Users/Code/EchoLearn/app && npx tsc -b --noEmit
```

Exit 0 expected.

**Commit:**

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "fix(36-15): force-new-day re-mutates echolearn_daily_posts.date for loadCache symmetry (closes round-4 sub-issue b storage half)" --files app/src/screens/settings/SettingsDataScreen.tsx
```

===

### Task 2 — Invert Test 6 in the force-new-day test

**File:** `app/tests/screens/SettingsDataScreen.force-new-day.test.mjs`

**Action:**

The current Test 6 (added by Plan 36-13) is a NEGATIVE assertion:

```javascript
it('handler does NOT mutate echolearn_daily_posts (Plan 36-11 makes that mutation redundant)', () => {
  // ... assert.doesNotMatch on /echolearn_daily_posts/ ...
});
```

This test is now WRONG — round-4 UAT proved the assumption ("Plan 36-11 makes that mutation redundant") was false for the dev-button path. Replace it with the inverted POSITIVE assertion + a rationale comment that explains why this test was inverted (so a future agent doesn't try to flip it back).

**Step 2a — DELETE Test 6** (the current `'handler does NOT mutate echolearn_daily_posts ...'` block, currently the last test in the describe block, lines ~71-91 of the file).

**Step 2b — ADD a new Test 6** asserting the daily-posts mutation IS present, with a rationale block embedded in the test code:

```javascript
  it('handler mutates echolearn_daily_posts.date so loadCache rejection fires symmetrically with queue rehydration', () => {
    // Phase 36-15 inverts the negative regression assertion that Plan 36-13
    // added (and that round-4 UAT proved wrong). Plan 36-11's loadCache
    // date-rejection only fires on REAL midnight (where today() advances).
    // The dev button cannot advance the wall clock, so today() returns the
    // SAME value before and after this handler runs. If echolearn_daily_posts
    // is left untouched, its stored .date still equals today(), loadCache()
    // returns truthy, getDailyPosts() hits its cache-hit branch and returns
    // yesterday's served posts — the rehydrated _state.posts from
    // post-queue.service.ts (Plan 36-11) is never reached.
    //
    // Mirror the wall-clock-asymmetry pattern that the dailyReadService.reset()
    // call already establishes: services that gate self-reset on today()
    // comparisons cannot fire when the dev button doesn't (and shouldn't)
    // advance the clock — so the handler must explicitly mutate every
    // date-stamped cache key that natural midnight rollover would have
    // tripped. echolearn_post_queue and echolearn_daily_posts are SYMMETRIC,
    // not redundant.
    //
    // The runtime consequence (feed auto-populating from yesterday's queue
    // when getCachedDailyPosts returns []) is owned by Plan 36-14's
    // warm-start re-fallback effect in HomeScreen.tsx — see
    // tests/screens/HomeScreen.warm-start-refallback.test.mjs.
    //
    // DO NOT FLIP THIS BACK to assert.doesNotMatch. The "redundant dual-cache
    // hack" framing in Plan 36-13 was incorrect; round-4 UAT regressed
    // sub-issue (b) because of it. See .planning/debug/feed-not-auto-
    // populating-after-force-new-day.md and 36-15-SUMMARY.md.
    const start = source.indexOf('const handleForceNewDay');
    const next = source.indexOf('const refreshTokenUsage');
    assert.ok(
      start !== -1 && next !== -1 && next > start,
      'Could not locate handleForceNewDay anchor pair (handleForceNewDay → refreshTokenUsage)',
    );
    const handlerBody = source.slice(start, next);
    assert.match(
      handlerBody,
      /localStorage\.setItem\(['"]echolearn_daily_posts['"]/,
      'handleForceNewDay must call localStorage.setItem(\'echolearn_daily_posts\', ...) to mutate the served-posts cache date to yesterday. Without this, loadCache()\'s parsed.date !== today() rejection (Plan 36-11) does not fire under the dev button (today() does not advance), and getDailyPosts() returns yesterday\'s served posts instead of dequeueing the rehydrated _state.posts. See round-4 sub-issue (b).',
    );
  });
```

**Step 2c — Test 5 ("handler resets daily-read state ...")** stays as-is. Total test count: 6 final tests (same total count as before this plan; the negative assertion swaps to a positive assertion in the same slot).

**Verification:**

```bash
cd /Users/Code/EchoLearn/app && node --test tests/screens/SettingsDataScreen.force-new-day.test.mjs
```

Expected: 6 GREEN. (Tests 1-5 from prior plans preserved; new inverted Test 6 passes against the Task-1 source change.)

**Commit:**

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "test(36-15): invert Test 6 to assert daily-posts mutation IS present (round-4 sub-issue b)" --files app/tests/screens/SettingsDataScreen.force-new-day.test.mjs
```

===

## Verification (post-execution)

Plan-specific test:

```bash
cd /Users/Code/EchoLearn/app && node --test tests/screens/SettingsDataScreen.force-new-day.test.mjs
```

Expected: 6 GREEN.

Full Phase 36 quick suite (must remain GREEN — sub-issues (a), (c), (d), (e) regressions check). The post-wave-1 suite includes Plan 36-14's two new test files:

```bash
cd /Users/Code/EchoLearn/app && node --test tests/services/derived-list.test.mjs tests/services/style-assignment-stratified.test.mjs tests/services/spread-by-concept.test.mjs tests/services/refill-queue-integration.test.mjs tests/services/style-assignment.test.mjs tests/services/post-queue.test.mjs tests/services/post-queue-yesterday-snapshot.test.mjs tests/services/post-queue-rehydrate.test.mjs tests/services/concept-feed-cache-date.test.mjs tests/screens/HomeScreen.warm-start-guard.test.mjs tests/screens/PostDetailScreen.video-detector.test.mjs tests/components/InfoFlow.short-tap-emit.test.mjs tests/screens/SettingsDataScreen.force-new-day.test.mjs tests/screens/HomeScreen.exploredAnchors-resync.test.mjs tests/screens/HomeScreen.warm-start-refallback.test.mjs
```

Expected: 15 files, all GREEN. Plans 36-11/12/13's contracts are not invalidated — Plan 36-11's `loadCache()` rejection still fires correctly on REAL midnight; Plan 36-12's mutex is unrelated; Plan 36-13's `dailyReadService.reset()` call is preserved.

(Note: this verification block lists 15 test files which assumes Plan 36-14 has also completed in parallel-wave-1. If Plan 36-15 finishes BEFORE Plan 36-14, the last two files won't exist yet — that's expected and acceptable; the gating check is the post-wave verification, not per-plan execution order. If executing Plan 36-15 in isolation for any reason, drop the last two entries and expect 13 GREEN.)

TypeScript clean:

```bash
cd /Users/Code/EchoLearn/app && npx tsc -b --noEmit
```

Exit 0.

Phase preservation greps (must all match — these guard the Plan 36-11/12/13 contracts from regression):

```bash
grep -q "STORAGE_KEY_YESTERDAY" /Users/Code/EchoLearn/app/src/services/post-queue.service.ts
grep -q "USER_ACK_BEFORE_GRAPH_CONTEXT" /Users/Code/EchoLearn/app/src/state/useQuestions.ts
grep -q "MAX_QUEUE_SIZE" /Users/Code/EchoLearn/CLAUDE.md
grep -q "dailyReadService\.reset()" /Users/Code/EchoLearn/app/src/screens/settings/SettingsDataScreen.tsx
grep -q "parsed\.date !== today()" /Users/Code/EchoLearn/app/src/services/concept-feed.service.ts
```

All five must succeed.

## Success Criteria

- [ ] `app/src/screens/settings/SettingsDataScreen.tsx`:`handleForceNewDay` body contains `localStorage.setItem('echolearn_daily_posts', ...)` after the queue mutation.
- [ ] The handler still calls `postQueueService.loadQueue()`, `dailyReadService.reset()`, and `navigate('/home')` (Plan 36-11 + 36-13 preserved).
- [ ] Toast text reads "Queue + daily-posts cache rolled back; vine progress reset. Navigating to /home."
- [ ] `app/tests/screens/SettingsDataScreen.force-new-day.test.mjs` Test 6 asserts the daily-posts mutation IS present (positive assertion via `assert.match`).
- [ ] All 6 tests in the force-new-day file are GREEN.
- [ ] No other tests regress: full Phase 36 quick suite stays GREEN.
- [ ] `npx tsc -b --noEmit` exits 0.
- [ ] All five phase-preservation greps pass.
- [ ] HomeScreen.tsx is NOT modified by this plan (file ownership: Plan 36-14 owns it).

## Output

After completion, create `.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-15-SUMMARY.md` documenting:
- The chosen design (option a — restore the daily-posts mutation in handleForceNewDay; invert Test 6)
- Why option (a) was chosen over option (b) (structurally simpler; matches the dailyReadService.reset() pattern Plan 36-13 already established for sub-issue a; option b would couple two storage layers in a non-obvious way)
- The framing correction: "redundant dual-cache hack" was wrong — the queue and daily-posts caches are symmetric (both date-stamped, both rejection-on-mismatch), not redundant. The dev button must mutate both because today() cannot advance.
- Why this plan was scoped to STORAGE only (Option A consolidation): the runtime consequence (HomeScreen falling back to yesterday's queue when the cache returns []) is owned by Plan 36-14's warm-start re-fallback effect to keep wave-1 file ownership clean (Plan 36-14 owns HomeScreen.tsx; Plan 36-15 owns SettingsDataScreen.tsx; zero file overlap).
- Test count delta (+0; Test 6 inverted in place — total stays at 6)
- Self-check that this plan's changes do NOT regress sub-issues (a), (c), (d), (e):
  - (a) closed by Plan 36-13's `dailyReadService.reset()` call AND Plan 36-14's HomeScreen vine resync; this plan preserves both.
  - (c) closed by Plan 36-11 Task 2's `spreadByConcept` + `spreadByStyle` re-interleave on rehydrate; this plan does not touch the rehydrate path.
  - (d) closed by Plan 36-11 Task 1's `loadCache()` rejection on REAL midnight; this plan does not weaken that — it adds parity for the dev-button path.
  - (e) closed by Plan 36-12's promise mutex in `_refillMutex`; this plan does not touch refill.
- Forward-looking note: Plan 36-13's `key-decisions` (line 33 of 36-13-SUMMARY.md) claimed the dual-cache hack was redundant. That entry should be flagged as superseded by Plan 36-15. Add a paragraph to the Plan 36-13 SUMMARY (or a new note in this plan's SUMMARY) clarifying the correction.

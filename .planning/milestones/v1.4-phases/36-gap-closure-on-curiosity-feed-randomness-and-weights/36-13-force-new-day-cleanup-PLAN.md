---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 13
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/screens/settings/SettingsDataScreen.tsx
  - app/tests/screens/SettingsDataScreen.force-new-day.test.mjs
autonomous: true
requirements: [GAP-D-round3-a, GAP-D-round3-cleanup]
gap_closure: true
must_haves:
  truths:
    - "handleForceNewDay no longer mutates echolearn_daily_posts.date — Plan 36-11 Task 1 (loadCache date-rejection) makes that mutation redundant. Reverts the dual-cache hack from commit 6a90224a."
    - "handleForceNewDay calls dailyReadService.reset() so the vine progress chip clears on Force New Day (closes round-3 sub-issue a — vine progress not cleared)."
    - "handleForceNewDay still mutates echolearn_post_queue.date to yesterday and calls postQueueService.loadQueue() — those two are still needed (loadQueue triggers Plan 36-11 Task 2's rehydration path)."
    - "Toast text updated to reflect cleaner contract: 'Queue date rolled back; vine progress reset. Navigating to /home.'"
    - "Source-reading test 5 (echolearn_daily_posts mutation assertion) is REMOVED. New Test 5 (or 6) asserts dailyReadService.reset() is called inside handleForceNewDay. Total test count remains 5 — same as after 6a90224a's addition."
  artifacts:
    - path: app/src/screens/settings/SettingsDataScreen.tsx
      provides: "Cleaned-up handleForceNewDay handler"
    - path: app/tests/screens/SettingsDataScreen.force-new-day.test.mjs
      provides: "Updated test 5 — asserts dailyReadService.reset() call (was: asserts daily-posts cache mutation)"
  key_links:
    - via: "import"
      from: app/src/screens/settings/SettingsDataScreen.tsx
      pattern: "dailyReadService"
---

# Plan 36-13 — Force-New-Day Button Cleanup

## Objective

Close round-3 sub-issue (a) — vine progress not cleared after Force New Day — by calling `dailyReadService.reset()` from the handler. Revert the dual-cache hack added in commit `6a90224a` (now redundant given Plan 36-11 Task 1's symmetric loadCache date-rejection).

## Background

The Force New Day button currently does:
1. Mutates `localStorage.echolearn_post_queue.date` → yesterday (correct, still needed)
2. Mutates `localStorage.echolearn_daily_posts.date` → yesterday (commit `6a90224a` — REDUNDANT after Plan 36-11; loadCache will reject stale date)
3. `postQueueService.loadQueue()` (correct, still needed — triggers Plan 36-11's rehydration path)
4. `navigate('/home')` (correct, still needed)

Missing: it never resets `dailyReadService` state. On a real midnight, `dailyReadService.loadState()` self-resets via the `parsed.date !== today()` check (daily-read.service.ts:36) — but that depends on `today()` advancing, which Force New Day cannot do (we're not advancing the wall clock). So the dev button must explicitly call `dailyReadService.reset()` to mimic the natural midnight reset.

This plan is parallel-safe with Plans 36-11 and 36-12 (different files entirely).

## Tasks

### Task 1 — Update the handler

**File:** `app/src/screens/settings/SettingsDataScreen.tsx`

**Action:**

1. ~~Add an import at the top of the file~~ — `dailyReadService` is already imported at SettingsDataScreen.tsx:15 (used by the existing "Reset today" button at line 270). No new import needed.

2. Replace the existing `handleForceNewDay` body (currently at lines 77-105):
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
       // feed. The daily-posts cache (echolearn_daily_posts) is NOT touched —
       // Plan 36-11's loadCache date-rejection handles staleness symmetrically.
       const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
       parsed.date = yesterday;
       localStorage.setItem('echolearn_post_queue', JSON.stringify(parsed));
       postQueueService.loadQueue();
       // Reset vine progress (echolearn_daily_read). On a real midnight,
       // dailyReadService.loadState() self-resets via the parsed.date !==
       // today() check, but the dev button cannot advance today() — so the
       // service still sees parsed.date === today() (real today) and never
       // resets. Manually mimic the midnight reset here. See round-3
       // sub-issue (a) and daily-read.service.ts:36.
       dailyReadService.reset();
       toast('Queue date rolled back; vine progress reset. Navigating to /home.', 'success');
       navigate('/home');
     } catch (err) {
       console.warn('[SettingsDataScreen] force-new-day failed:', err);
       toast('Force new day failed. Check console.', 'error');
     }
   };
   ```

   Key changes from the previous version:
   - **REMOVED:** the `localStorage.getItem('echolearn_daily_posts')` block + mutation (lines 90-95 of current handler — the dual-cache hack from commit `6a90224a`).
   - **ADDED:** `dailyReadService.reset()` call.
   - **UPDATED:** toast text to reflect the cleaner contract.

**Don't touch:**
- The `import.meta.env.DEV` gate on the SettingRow (still needed)
- The hardcoded English strings + the inline i18n exemption comment (still applies)
- Any other Settings handler

**Commit:**
```bash
git add app/src/screens/settings/SettingsDataScreen.tsx
git commit --no-verify -m "fix(36-13): force-new-day calls dailyReadService.reset() + drops dual-cache hack (closes round-3 sub-issue a)"
```

===

### Task 2 — Update the regression test

**File:** `app/tests/screens/SettingsDataScreen.force-new-day.test.mjs`

**Action:**

**Step 2a — DELETE the existing Test 5** (added in commit `6a90224a`). Locate and remove the entire `it('handler also rolls back the daily-posts cache date so getDailyPosts cache-misses', ...)` block (currently lines 62-71 of the test file). The mutation it asserted is being reverted in Task 1.

**Step 2b — ADD the new Test 5** asserting `dailyReadService.reset()` is called:

```javascript
  it('handler resets daily-read state so vine progress chip clears on Force New Day', () => {
    // On a real midnight, dailyReadService.loadState() self-resets via the
    // parsed.date !== today() check. The dev button cannot advance today(),
    // so it must explicitly call dailyReadService.reset() to mimic the
    // natural midnight reset — otherwise the vine progress chip on /home
    // shows yesterday's exploration count after the rollover. See round-3
    // sub-issue (a).
    assert.match(
      source,
      /handleForceNewDay[\s\S]*?dailyReadService\.reset\(\)[\s\S]*?\}/,
      'handleForceNewDay must call `dailyReadService.reset()` after mutating localStorage so the vine progress chip clears. Without this the chip shows yesterday\'s exploration count after the rollover.',
    );
  });
```

**Step 2c — ADD a defensive negative-assertion Test 6** so the dual-cache hack cannot be silently re-introduced:

```javascript
  it('handler does NOT mutate echolearn_daily_posts (Plan 36-11 makes that mutation redundant)', () => {
    // Commit 6a90224a added a defensive mutation of echolearn_daily_posts.date
    // to yesterday, intended to prevent the served-posts cache from rendering
    // across the rollover. Plan 36-11 Task 1's loadCache date-rejection makes
    // that mutation redundant: stale caches return null without needing
    // explicit invalidation. Plan 36-13 reverts the dual-cache hack.
    // This negative assertion ensures we don't accidentally re-introduce it.
    //
    // Extract by anchor pair (start of handler → start of next handler) — more
    // robust than matching on closing-brace indent which silently regresses on
    // formatter changes.
    const start = source.indexOf('const handleForceNewDay');
    const next = source.indexOf('const refreshTokenUsage');
    assert.ok(start !== -1 && next !== -1 && next > start, 'Could not locate handleForceNewDay anchor pair');
    const handlerBody = source.slice(start, next);
    assert.doesNotMatch(
      handlerBody,
      /echolearn_daily_posts/,
      'handleForceNewDay must NOT mutate echolearn_daily_posts directly. loadCache date-rejection (Plan 36-11) handles staleness symmetrically. See commit 6a90224a → reverted in Plan 36-13.',
    );
  });
```

Total test count: 4 prior (test 5 deleted) + new Test 5 (vine reset) + new Test 6 (negative) = **5 final tests**.

**Verification:**
```bash
cd app && node --test tests/screens/SettingsDataScreen.force-new-day.test.mjs
```
5 GREEN expected (4 prior preserved + new Test 5 vine-reset + new Test 6 negative; 1 deleted: the old daily-posts mutation assertion).

**Commit:**
```bash
git add app/tests/screens/SettingsDataScreen.force-new-day.test.mjs
git commit --no-verify -m "test(36-13): assert dailyReadService.reset call + reject re-introduction of dual-cache hack"
```

===

## Verification (post-execution)

Force-new-day test:
```bash
cd app && node --test tests/screens/SettingsDataScreen.force-new-day.test.mjs
```
5 GREEN (4 prior + new Test 5 + new Test 6; old Test 5 deleted).

TypeScript clean:
```bash
cd app && npx tsc -b --noEmit
```
Exit 0.

Sanity (the cleanup must not break anything else):
```bash
cd app && npm test 2>&1 | tail -20
```

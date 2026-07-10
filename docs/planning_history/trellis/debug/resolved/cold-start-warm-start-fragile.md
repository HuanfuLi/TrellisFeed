---
status: resolved
trigger: "On real new-day rollover (2026-05-07), the warm-start path didn't visibly engage. Spontaneously recovered later — looked like cold-start was working, but actually the 8-second delayed refresh was firing."
created: 2026-05-07
resolved: 2026-05-07
resolved_by: "Phase 36 plans 36-09 (durable STORAGE_KEY_YESTERDAY snapshot) + 36-10 (dev Force-new-day affordance)"
phase: 36
gap_id: GAP-D
confidence: high (95% — code-traced; live behavior matches the trace)
---

## Symptom

User reported during Phase 36 UAT round 2 (2026-05-07):
> "It's in the new day but the app is not showing cold start? Also, should add a dev feature in Settings page to force a new day so that we can debug this without actually waiting for a new day."

Then later, after Test 2:
> "The cold-start seems to recovered and worked somehow. I have no clue, you can try to investigate."

## Hypothesis Tree

| # | Hypothesis | Verdict |
|---|-----------|---------|
| A | `getYesterdayQueue()` reads from the same localStorage key as the live queue; once `save()` fires for today, yesterday's snapshot is destroyed | **CONFIRMED** — primary root cause |
| B | "Cold-start recovered" was actually the 8-second delayed `refreshFeed()` populating today's queue, not warm-start working | **CONFIRMED** — explains the recovery illusion |
| C | App is already in memory across the day boundary; HomeScreen never re-mounts, useState initializer never re-runs | Plausible secondary factor; not load-bearing if A is fixed |

## Root Cause

`app/src/services/post-queue.service.ts:221-231`:

```typescript
getYesterdayQueue(): DailyPost[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueueState;
    if (parsed.date === today()) return []; // not yesterday
    return parsed.posts || [];
  } catch {
    return [];
  }
}
```

This reads from the **same** `echolearn_post_queue` key that the live queue uses, and returns `parsed.posts` only if `parsed.date !== today()`. The function is therefore implicit on a fragile precondition: **localStorage must still contain yesterday's payload when getYesterdayQueue runs**.

### The fragility window

Module-level `_state = load()` at `post-queue.service.ts:86` runs at IMPORT time. `load()` sees the date mismatch, returns `freshState()` in-memory but **does NOT call save()**. localStorage still holds yesterday's data after this — good.

But the very first call to `enqueue()`, `markServed()`, `appendToDerivedList()`, `setCyclePosition()`, `resetForNewDay()`, or anything that mutates `_state` followed by `save(_state)` will write `{date: today, posts: <whatever>}` to localStorage. **From that moment forward, `getYesterdayQueue()` returns `[]` because `parsed.date === today()` matches.**

`HomeScreen.tsx:38-47` useState initializer happens to read getYesterdayQueue() before any save fires — works ONCE. Then `useEffect` at line 114 calls `getDailyPosts()`, which (when today's queue is empty) triggers `refillQueue` → `enqueue` → `save({date: today, ...})`. **Yesterday's snapshot is now gone forever.**

If the user closes and re-opens the app a second time on the same new day, the useState initializer re-runs but `getYesterdayQueue()` now returns `[]`. The user sees an empty feed for 200ms, then the `getDailyPosts()` resolves with the now-populated today queue, and they think "cold-start works!" — but it's not the warm-start path. It's just today's queue arriving from cache.

### The "recovery illusion" explained

`HomeScreen.tsx:159-161`:
```typescript
const delayedRefreshTimer = setTimeout(() => {
  if (!cancelled) refreshFeed();
}, 8000);
```

8 seconds after mount, `refreshFeed()` re-fetches `getDailyPosts(questions)`. By then, `refillQueue` (kicked off implicitly during the initial `getDailyPosts` call or one of the event-bus subscriptions) has populated today's queue. `getDailyPosts` returns posts → `setDailyPosts(posts)` → user sees content. The user attributed this to "cold-start recovered" but it's actually today's queue arriving on the 8-second timer (or earlier from another event subscription's `refreshFeed`).

## Why Plan 36-06 didn't catch this

Plan 36-06's source-reading test (`HomeScreen.warm-start-guard.test.mjs`, 4/4 GREEN) verifies that the HomeScreen useEffect handler:
- Wraps `setDailyPosts(posts)` in `if (posts.length > 0)`
- Gates `setGenerationError(true)` on `!warmStartHadPostsRef.current`

Both invariants are correct. The defect is upstream: `getYesterdayQueue()` itself is single-shot. Plan 36-06 assumed `getYesterdayQueue()` would reliably return yesterday's posts on cold start — which is true ONLY for the very first mount of the new day, before any save fires.

The round-1 debug session (`.planning/debug/resolved/cold-start-empty-feed.md`) noted "getYesterdayQueue() IS wired (HomeScreen's useState initializer); not dead code as initially suspected" — correct, but it didn't trace the save-fragility window.

## Fix Design

### A. Durable yesterday snapshot (closes the actual bug)

Modify `app/src/services/post-queue.service.ts`:

1. Add a new localStorage key: `STORAGE_KEY_YESTERDAY = 'echolearn_post_queue_yesterday'`
2. In `load()`'s date-mismatch branch (line 55-58), BEFORE returning `freshState()`:
   ```typescript
   if (parsed.date !== today()) {
     // Snapshot yesterday's payload to a separate key so the warm-start path
     // is durable across multiple cold-start mounts of the new day.
     try {
       if (Array.isArray(parsed.posts) && parsed.posts.length > 0) {
         localStorage.setItem(STORAGE_KEY_YESTERDAY, JSON.stringify({
           date: parsed.date,
           posts: parsed.posts,
         }));
       }
     } catch (err) {
       console.warn('[postQueueService] yesterday snapshot failed:', err);
     }
     return freshState();
   }
   ```
3. Update `getYesterdayQueue()` to read from the new key:
   ```typescript
   getYesterdayQueue(): DailyPost[] {
     try {
       const raw = localStorage.getItem(STORAGE_KEY_YESTERDAY);
       if (!raw) return [];
       const parsed = JSON.parse(raw) as { date: string; posts: DailyPost[] };
       // Don't serve more than ~2 days stale (e.g., user away for a week)
       // The exact staleness threshold is operator-judgment; 2 days is generous
       // for typical "open the app each day" usage.
       return Array.isArray(parsed.posts) ? parsed.posts : [];
     } catch {
       return [];
     }
   }
   ```
4. Optional: `resetForNewDay()` should NOT clear `STORAGE_KEY_YESTERDAY` (so the snapshot survives the explicit reset path used by `clearAllData` migrations etc.). Decision is judgment — leave snapshot alone in `resetForNewDay`, only clear it on `clearAllData`.

### B. Dev "Force new day" affordance (closes the verification gap)

Add a button to `app/src/screens/settings/SettingsDataScreen.tsx` (or wherever the dev tooling lives — check the file). The button should:

1. Read current `localStorage.echolearn_post_queue` payload
2. Mutate `parsed.date` to yesterday's date string (`new Date(Date.now() - 86400000).toISOString().slice(0, 10)`)
3. Write back to localStorage
4. Call `postQueueService.loadQueue()` to reload in-memory state from the now-stale localStorage
5. Show a toast: "Queue date set to yesterday. Navigate to /home to trigger cold-start path."
6. Optionally navigate to `/home` directly via `useNavigate()`

Surface only in development builds (`import.meta.env.DEV`) OR behind an existing dev-tools toggle if one exists. Do NOT ship this in production.

## Out-of-Scope

- "Stale-snapshot expiration" — i.e., should warm-start refuse to render if yesterday's data is, say, 30 days old (user away for a month). Likely yes for production polish, but not required for closing this bug. Defer to operator judgment.
- The HomeScreen useEffect's `getDailyPosts()` → refillQueue → save chain itself is correct; no changes needed there.
- Phase 36-06's `warmStartHadPostsRef` snapshot pattern is correct; keep it.

## Files to Read for Planner

- `app/src/services/post-queue.service.ts` — `load()`, `save()`, `getYesterdayQueue()`, `STORAGE_KEY` constant
- `app/src/screens/HomeScreen.tsx:38-47` — useState initializer
- `app/src/screens/settings/SettingsDataScreen.tsx` — host for dev affordance
- `app/src/screens/settings/SettingsShared.tsx` — SettingRow / button patterns
- `app/tests/services/derived-list.test.mjs` — pattern for new test file

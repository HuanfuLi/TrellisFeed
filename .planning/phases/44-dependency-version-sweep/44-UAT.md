# Phase 44 Manual Smoke / UAT

## Setup

Commands run from `app/`.

Start the local app with:

```bash
npm run dev -- --host 127.0.0.1
```

Build precheck:

- `npm run build`
- build precheck exit code: 0

## Current Test

[testing complete]

## Manual Smoke Rows

| id | surface | steps | expected | status | evidence | tester |
|----|---------|-------|----------|--------|----------|--------|
| locale-switch | Settings locale runtime | Switch English to Chinese to Spanish to Japanese in Settings. | Visible UI strings change and no runtime error appears. | pass | User reported locale switching across English, Chinese, Spanish, and Japanese updated visible strings with no runtime error. | user |
| ask-streaming | Ask streaming runtime | Start an Ask request. | Streaming text appears and the request completes or aborts without a stuck loading state. | pass | User reported Ask streaming displayed text and completed or aborted without a stuck loading state. | user |
| queue-refill | Home feed refill runtime | Trigger Home feed refill or swipe-for-more. | Feed content appears and no duplicate React key warning appears. | pass | User reported feed refill passed; console showed `generatePostBatch` LLM under-generation counts but no duplicate React key warning was reported. | user |
| saved-route-navigation | Saved route runtime | Open `/saved`, switch Saved and Liked tabs, then return to `/home`. | Route navigation works. | pass | User reported `/saved` route navigation, Saved/Liked tab switching, and return to `/home` worked. | user |
| android-sync-sanity | Capacitor native sync sanity | Confirm Plan 44-02 recorded `npx cap sync` exit code 0; if native files changed, confirm changed paths are under `app/android/`. | Sync evidence is present and Android native diff is either absent or under `app/android/`. | pass | User confirmed Plan 44-02 sync evidence is acceptable for Android sync sanity. | user |

## Tests

### 1. Locale Switch
expected: In Settings, switch English to Chinese to Spanish to Japanese. Visible UI strings should update for each locale and no runtime error should appear.
result: pass

### 2. Ask Streaming
expected: Start an Ask request. Streaming text should appear and the request should complete or abort without a stuck loading state.
result: pass

### 3. Queue Refill
expected: Trigger Home feed refill or swipe-for-more. Feed content should appear and no duplicate React key warning should appear.
result: pass

### 4. Saved Route Navigation
expected: Open `/saved`, switch Saved and Liked tabs, then return to `/home`. Route navigation should work.
result: pass

### 5. Android Sync Sanity
expected: Plan 44-02 should record `npx cap sync` exit code 0, and any native file changes should be absent for Android or under `app/android/`.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]

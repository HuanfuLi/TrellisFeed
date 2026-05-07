---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 10
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/screens/settings/SettingsDataScreen.tsx
  - app/tests/screens/SettingsDataScreen.force-new-day.test.mjs
autonomous: true
requirements: [GAP-D]
gap_closure: true
must_haves:
  truths:
    - "SettingsDataScreen.tsx Developer section gains a 'Force new day (dev)' button gated behind import.meta.env.DEV — production users do NOT see it"
    - "Tapping the button: (a) reads current localStorage.echolearn_post_queue, (b) mutates parsed.date to yesterday's ISO date, (c) writes back, (d) calls postQueueService.loadQueue() to reload in-memory state, (e) shows a toast, (f) navigates to /home so the cold-start path runs"
    - "Strings are hardcoded English (NOT i18n bundled) because the button is dev-only and DOES NOT ship in production builds — see CLAUDE.md i18n workflow exemption rationale in the inline comment"
    - "Source-reading test asserts the import.meta.env.DEV gate is present AND the navigate('/home') call is wired AND the postQueueService.loadQueue call is wired"
  artifacts:
    - path: app/src/screens/settings/SettingsDataScreen.tsx
      provides: "Dev-only 'Force new day' button under the existing Developer section"
    - path: app/tests/screens/SettingsDataScreen.force-new-day.test.mjs
      provides: "Source-reading regression test for the DEV gate + handler wiring"
  key_links:
    - via: "import"
      from: app/src/screens/settings/SettingsDataScreen.tsx
      pattern: "postQueueService.loadQueue"
---

# Plan 36-10 — Dev "Force New Day" Affordance (GAP-D Fix B)

## Objective

Close GAP-D Fix B: provide a deterministic way to verify the cold-start warm-start path in development without waiting for midnight. Add a "Force new day (dev)" button to the Settings Developer section, gated behind `import.meta.env.DEV` so it does not ship in production.

## Background

See `.planning/debug/cold-start-warm-start-fragile.md`. Without this affordance, every GAP-A retest requires waiting for an actual day-boundary OR manually editing localStorage in DevTools — neither is a workable dev loop.

This plan is parallel-safe with Plan 36-09 (different files entirely). Either order of execution works; both should land in Wave 1.

## Tasks

### Task 1 — Add the button + handler

**File:** `app/src/screens/settings/SettingsDataScreen.tsx`

**Action:**

1. Add the handler near the other handlers (after `handleClearAllData`, around line 60-80 in the file). Use the existing toast/confirm patterns:
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
       // and snapshots the current payload to STORAGE_KEY_YESTERDAY (Plan 36-09).
       const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
       parsed.date = yesterday;
       localStorage.setItem('echolearn_post_queue', JSON.stringify(parsed));
       postQueueService.loadQueue();
       toast('Queue date set to yesterday. Navigating to /home for cold-start.', 'success');
       navigate('/home');
     } catch (err) {
       console.warn('[SettingsDataScreen] force-new-day failed:', err);
       toast('Force new day failed. Check console.', 'error');
     }
   };
   ```

2. In the Developer section (after the trellisDevMode SettingRow, around line 145, BEFORE the postRetention SettingRow), add the button BEHIND a `import.meta.env.DEV` gate:
   ```tsx
   {import.meta.env.DEV && (
     <SettingRow
       label="Force new day (dev)"
       description="Sets the post queue date to yesterday and reloads, so the next /home mount runs the cold-start warm-start path. Dev builds only — never visible in production. See .planning/debug/cold-start-warm-start-fragile.md for context."
     >
       <Button variant="secondary" size="sm" onClick={handleForceNewDay}>
         Roll back date
       </Button>
     </SettingRow>
   )}
   ```

3. The strings here are hardcoded English. Add an inline comment above the JSX block explaining why:
   ```tsx
   {/* Strings hardcoded English: this button is gated by import.meta.env.DEV
       and never reaches production users, so the i18n workflow's "all 4 bundles
       per UI string" rule does NOT apply. See CLAUDE.md i18n workflow exemption
       reasoning. */}
   ```

**Don't touch:**
- Existing handlers, the trellisDevMode pattern, or the postRetention/generationCap inputs
- Any locale bundle (en/zh/es/ja JSON files)

**Commit:**
```bash
git add app/src/screens/settings/SettingsDataScreen.tsx
git commit --no-verify -m "feat(36-10): dev-only 'Force new day' button in Settings Developer section (GAP-D Fix B)"
```

===

### Task 2 — Source-reading regression test

**File:** `app/tests/screens/SettingsDataScreen.force-new-day.test.mjs` (NEW)

**Action:**

Create a Node `node --test` source-reading test modeled on the existing `tests/screens/HomeScreen.warm-start-guard.test.mjs` pattern (read that file for the exact structure: import `node:fs`, read the source file, run `assert.match` regexes against it).

Required test cases (4 total):

1. **DEV gate present:** Source contains `import.meta.env.DEV && (` (or equivalent `import.meta.env.DEV &&` near a JSX block).
2. **Handler exists:** Source contains `const handleForceNewDay`.
3. **Handler calls loadQueue:** Source contains `postQueueService.loadQueue()` inside the handler region (the simple way: `assert.match(source, /handleForceNewDay[\s\S]*?postQueueService\.loadQueue\(\)[\s\S]*?\}/)`).
4. **Handler navigates to /home:** Source contains `navigate('/home')` inside the handler region.

**Verification:**
```bash
cd app && node --test tests/screens/SettingsDataScreen.force-new-day.test.mjs
```
Must be GREEN (4/4 pass).

**Commit:**
```bash
git add app/tests/screens/SettingsDataScreen.force-new-day.test.mjs
git commit --no-verify -m "test(36-10): source-reading regression for force-new-day DEV gate + handler wiring"
```

===

## Verification (post-execution)

Run the full Phase 36 quick suite + the new test:
```bash
cd app && node --test tests/services/derived-list.test.mjs tests/services/style-assignment-stratified.test.mjs tests/services/spread-by-concept.test.mjs tests/services/refill-queue-integration.test.mjs tests/services/style-assignment.test.mjs tests/services/post-queue.test.mjs tests/screens/HomeScreen.warm-start-guard.test.mjs tests/screens/PostDetailScreen.video-detector.test.mjs tests/components/InfoFlow.short-tap-emit.test.mjs tests/screens/SettingsDataScreen.force-new-day.test.mjs
```
Expected: 70 prior + 4 new = 74 GREEN. (If 36-09 also lands in this wave, expect 75 + 4 = 79 GREEN combined.)

TypeScript clean:
```bash
cd app && npx tsc -b --noEmit
```
Exit 0.

Phase 33/35/36 preservation greps (sanity check that this plan didn't accidentally touch CLAUDE.md or other load-bearing files):
```bash
grep -q "dueAnchors" app/src/services/concept-feed.service.ts
grep -q "USER_ACK_BEFORE_GRAPH_CONTEXT" app/src/state/useQuestions.ts
grep -q "MAX_QUEUE_SIZE" CLAUDE.md
```

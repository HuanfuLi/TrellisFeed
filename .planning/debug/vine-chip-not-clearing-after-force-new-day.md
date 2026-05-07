---
status: diagnosed
trigger: "Phase 36 round-4 UAT regression: vine progress chip not clearing after Force New Day, despite Plan 36-13 (committed 2026-05-07) shipping dailyReadService.reset() in handleForceNewDay"
created: 2026-05-07
updated: 2026-05-07
goal: find_root_cause_only
---

## Current Focus

hypothesis: HomeScreen's `exploredAnchors` React state is stale because (a) HomeScreen is always-mounted in SwipeTabContainer (no re-mount on navigate) and (b) the only setter wired to update it from `dailyReadService` runs on `CONCEPT_EXPLORED` subscription, which `dailyReadService.reset()` never emits.
test: Read HomeScreen state-source wiring + verify SwipeTabContainer always-mounts HomeScreen + verify event bus has no DAILY_READ_RESET event.
expecting: All three confirmed → root cause is observable-state-not-invalidated, NOT a bug in `reset()` itself.
next_action: Write up findings.

## Symptoms

expected: After tapping Force New Day → "Roll back date", the vine progress chip on /home shows 0/N (matches natural midnight reset behavior).
actual: Chip continues to show yesterday's exploredCount (e.g. N/N if vine was finished, or partial count if mid-day). UAT round-4 reports "A and B failed, blocking later tests."
errors: None.
reproduction:
  1. Populated post queue + some explored anchors (vine chip showing exploredCount > 0)
  2. Settings → Data → Developer → "Force new day (dev)" → "Roll back date"
  3. App routes to /home via react-router `navigate('/home')`
  4. EXPECTED: chip shows 0/N. ACTUAL: chip shows yesterday's count.
started: Discovered round-4 UAT 2026-05-07 after Phase 36-13 landed.

## Eliminated

- hypothesis: `dailyReadService.reset()` only writes to memory, not localStorage.
  evidence: Read `app/src/services/daily-read.service.ts:86-88`. `reset()` calls `saveState(freshState())` which writes to `localStorage.setItem(STORAGE_KEY, ...)` synchronously. Persistence is correctly invalidated.
  timestamp: 2026-05-07

- hypothesis: There's an in-memory cache inside `dailyReadService` that `reset()` doesn't invalidate.
  evidence: `dailyReadService` is fully stateless. Every getter (`isExplored`, `getExploredAnchors`, `isCreditAwarded`) calls `loadState()`, which reads localStorage on every call. There is NO module-level cache. So `reset()` does fully clear the service's observable state.
  timestamp: 2026-05-07

- hypothesis: Wrong storage key — chip might read from a different key than `reset()` writes to.
  evidence: Both reads and writes use `STORAGE_KEY = 'echolearn_daily_read'` (line 17). No alternate key.
  timestamp: 2026-05-07

- hypothesis: `navigate('/home')` re-mounts HomeScreen, so the `useState(() => dailyReadService.getExploredAnchors())` initializer would re-fire and pick up the fresh empty list.
  evidence: `app/src/App.tsx:141-189` mounts HomeScreen as one of 5 always-mounted screens inside `SwipeTabContainer`. SwipeTabContainer renders all 5 slots side-by-side; route changes only translate the strip horizontally, they DO NOT unmount/remount the screens. HomeScreen mounts ONCE at app boot. The `useState` initializer runs once.
  timestamp: 2026-05-07

## Evidence

- timestamp: 2026-05-07
  checked: `app/src/services/daily-read.service.ts:53-89`
  found: Service is stateless — every method calls `loadState()` which reads localStorage on every invocation. `reset()` writes `freshState()` to localStorage synchronously. No module-level cache.
  implication: Service's observable state IS correctly cleared by `reset()`. The bug is downstream — in how subscribers see the change.

- timestamp: 2026-05-07
  checked: `app/src/screens/settings/SettingsDataScreen.tsx:77-110` (handleForceNewDay)
  found: Handler calls `dailyReadService.reset()` (line 103, confirmed Plan 36-13 shipped) then `navigate('/home')` (line 105). Crucially: navigation is via react-router `useNavigate()`, NOT `window.location.assign()` / `window.location.reload()`. Compare line 68 (handleClearAllData uses `window.location.assign('/home')`) and line 274 ("Reset today" button uses `window.location.reload()`) — both bypass the issue by triggering full page reloads. Force New Day is the only handler that combines a service reset with react-router navigation.
  implication: Handler does invalidate persistence, but does not trigger a full reload. Subscribers must re-read the service or be notified via an event. Neither happens.

- timestamp: 2026-05-07
  checked: `app/src/App.tsx:141-189` and `app/src/components/SwipeTabContainer.tsx:1-100`
  found: HomeScreen is rendered as `screens[0]` inside SwipeTabContainer, which lays all 5 screens out in a horizontal strip and translates the strip to show one at a time. There is no conditional unmount; all 5 screens are always mounted from app boot until app close. CLAUDE.md "Header positioning" section describes this architecture and confirms top-level swipe screens are "always-mounted but only ONE is visible at a time."
  implication: HomeScreen's `useState(() => dailyReadService.getExploredAnchors())` initializer at line 442 fires ONCE at app boot. It will NEVER re-execute on `navigate('/home')`. Any state-sync after mount must come from an effect or event subscription.

- timestamp: 2026-05-07
  checked: `app/src/screens/HomeScreen.tsx:442, 478-483`
  found: `exploredAnchors` is a React useState. The ONLY setter call after mount lives in:
    ```
    useEffect(() => {
      const unsub = eventBus.subscribe('CONCEPT_EXPLORED', () => {
        setExploredAnchors(dailyReadService.getExploredAnchors());
      });
      return unsub;
    }, []);
    ```
  This re-reads only on `CONCEPT_EXPLORED` events, which fire when an anchor is ADDED to the explored set (PostDetailScreen.tsx detectors A/B/C/D + InfoFlow short-tap emit). They are NEVER fired by `dailyReadService.reset()`.
  implication: After Force New Day, persistence is empty but `exploredAnchors` React state still holds yesterday's array. `exploredCount` (line 443) is derived from `exploredAnchors.filter(...)`, so it stays at yesterday's value. The chip renders yesterday's count.

- timestamp: 2026-05-07
  checked: `app/src/lib/event-bus.ts` and `app/src/types/index.ts:662-696` (AppEvent union)
  found: There is no `DAILY_READ_RESET`, `VINE_RESET`, `DAY_ROLLED_OVER`, or any vine/daily-read-related event in the AppEvent union. The full list: QUESTION_ASKED, QUESTION_DELETED, CATEGORY_CREATED, REVIEW_SUBMITTED, REVIEW_DUE_COUNT_CHANGED, PLANNER_UPDATED, PODCAST_*, LLM_CONFIG_CHANGED, TTS_CONFIG_CHANGED, LOCALE_CHANGED, ZEROTIER_STATUS_CHANGED, NETWORK_STATUS_CHANGED, POST_DELETED, SESSION_*, FLASHCARDS_CREATED, AUTO_GEN_UPDATED, REORG_*, REVIEW_COMPLETED, ANCHOR_DELETED, HARVEST_COMPLETED, CONCEPT_EXPLORED, GRAPH_UPDATED.
  implication: No event currently exists for `dailyReadService.reset()` to emit. Adding one is one possible fix direction (cleanest if multiple subscribers ever read this state).

- timestamp: 2026-05-07
  checked: `app/src/screens/HomeScreen.tsx:172-176`
  found: There IS a route-pathname effect that re-syncs `dailyPosts` from cache on `location.pathname === '/home'`:
    ```
    useEffect(() => {
      if (location.pathname === '/home') {
        setDailyPosts(conceptFeedService.getCachedDailyPosts());
      }
    }, [location.pathname]);
    ```
  But there is NO equivalent re-sync for `exploredAnchors`. Adding `setExploredAnchors(dailyReadService.getExploredAnchors())` to this same effect would also resolve the bug (it'd re-read on every route change to /home).
  implication: This file already has the pattern needed; the `exploredAnchors` state was overlooked when Plan 36-13 was authored.

- timestamp: 2026-05-07
  checked: `app/src/screens/HomeScreen.tsx:475` and `:515-525`
  found: Secondary mount-frozen state: `creditAwardedRef = useRef(dailyReadService.isCreditAwarded())` is read once at mount. The celebration `useEffect` at line 515 gates on `!creditAwardedRef.current`. After `dailyReadService.reset()` clears the persisted `creditAwarded: false`, the in-React ref still holds yesterday's `true`, blocking re-celebration on the simulated new day.
  implication: This is a secondary effect — the chip count bug is the primary user-visible regression. But any fix should also re-read `isCreditAwarded()` so the celebration triggers correctly when the user crosses the threshold on the simulated new day.

- timestamp: 2026-05-07
  checked: `app/src/screens/settings/SettingsDataScreen.tsx:268-279` ("Reset today" button)
  found: A pre-existing handler does the same operation (`dailyReadService.reset()` + `postQueueService.resetForNewDay()`) but follows it with `setTimeout(() => window.location.reload(), 600)`. Full reload remounts everything, so `useState(() => dailyReadService.getExploredAnchors())` re-initializes fresh.
  implication: The "Reset today" button works because of the full reload. Force New Day uses react-router `navigate()` for instant feedback (no reload flash), which is the better UX but exposes the always-mounted state-staleness gap. A simple `window.location.reload()` would fix it but undoes the snappier UX intent.

## Resolution

root_cause: HomeScreen's `exploredAnchors` React state at `HomeScreen.tsx:442` is initialized once-on-mount via `useState(() => dailyReadService.getExploredAnchors())` and only updated thereafter via a `CONCEPT_EXPLORED` event-bus subscription at `HomeScreen.tsx:478-483`. Because HomeScreen is one of 5 always-mounted slots inside `SwipeTabContainer` (App.tsx:141-189; CLAUDE.md "Header positioning" architecture note), it does NOT remount on the react-router `navigate('/home')` call inside `handleForceNewDay` (SettingsDataScreen.tsx:105). And because `dailyReadService.reset()` (daily-read.service.ts:86-88) writes to localStorage but emits no event, neither the useState initializer nor the CONCEPT_EXPLORED subscription fires. Result: persistence is cleared (Plan 36-13 shipped that correctly) but the React state retains yesterday's array, and the derived `exploredCount` (HomeScreen.tsx:443) keeps showing yesterday's value until a real page reload (or until a new CONCEPT_EXPLORED event happens to push a fresh read). The Plan 36-13 source-reading test passes because it only checks `dailyReadService.reset()` exists in source — it cannot observe runtime React-state staleness.

fix: (not applied — find_root_cause_only mode)
verification: (not applied — find_root_cause_only mode)
files_changed: []

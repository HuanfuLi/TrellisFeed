# Phase 54: Tech-Debt Inventory (TECHDEBT-13, D-01/D-02)

**Authored:** 2026-05-20
**Deliverable:** Scored severity × reach matrix of accumulated v1.4–v1.6 tech debt, with a documented disposition per item.
**Source material:** `54-RESEARCH.md §Tech Debt Inventory`, `.planning/codebase/CONCERNS.md`, `45-DEAD-CODE-SWEEP.md`.
**Call-site counts:** Verified against live `app/src/` + `app/tests/` on 2026-05-20 (see §Verification Log).

> This document is the inventory itself — a planning artifact, not code. Resolution of the
> top tier happens in **Plan 54-04** (which depends on this inventory existing). Items below
> the top tier are formally re-accepted with a documented rationale per D-02, not silently carried.

---

## Scoring Rubric (D-01 — Claude's discretion)

| Axis | 1 | 2 | 3 | 4 | 5 |
|------|---|---|---|---|---|
| **Severity** (impact if it causes a bug) | cosmetic | dev experience | data-correctness risk | user-facing bug risk | data loss / security |
| **Reach** (how much is affected) | one file | one subsystem | multiple screens | all users, all flows | persistent / irreversible |

**Score = Severity × Reach.** Tiers:

- **FIX** — Score ≥ 12 (resolved in Plan 54-04). Trivial-cost FIX items (lint/dead-code, S×R small) are *also* flagged FIX where the cost-to-fix is near-zero and the cleanup is unambiguous, even when the raw score lands in a lower band — these are noted explicitly in the rationale.
- **RE-ACCEPT** — Score 6–11 (kept in inventory, formally re-accepted with rationale).
- **NOTE-ONLY** — Score ≤ 5 (acknowledged; no action; rationale documented).
- **DECISION-PENDING** — disposition depends on operator input; Plan 54-04 carries a `checkpoint:decision` to resolve. NOT pre-decided here.

---

## Scored Inventory

### Group A — CONCERNS.md / D-03 candidates (architecture & storage)

| #  | Item | File(s) | Sev | Reach | Score | Decision (with rationale) |
|----|------|---------|-----|-------|-------|---------------------------|
| A1 | Hybrid SQLite/localStorage dual-backend — data-drift risk if one store updates but not the other; no sync layer | `db.service.ts`, all `*.service.ts` using localStorage | 3 | 4 | **12** | **RE-ACCEPT.** Lands on the FIX boundary by raw score, but the "fix" is an architectural rewrite (introduce a sync/abstraction layer) far beyond a cleanup phase and explicitly deferred from the v1.4–v1.6 design. No observed drift bug in production; the two backends own disjoint data domains (SQLite = knowledge graph blobs; localStorage = prefs/queue/daily state) so the drift surface is narrow. Re-accepted as a known local-first architecture constraint; revisit if a client/server split ships. |
| A2 | Heavy service mocking — mocks can mask real-world performance/data issues; tests green but device fails | `src/services/mock/*` | 2 | 3 | **6** | **RE-ACCEPT.** Mocks are scoped to dev/test seams (`question.mock`, `review.mock`, etc.); real services are the live path. Device verification (operator UAT) is the backstop for mock-masked issues. Cost to remove > value at this maturity. Re-accepted as deliberate test ergonomics. |
| A3 | CapacitorHttp streaming fragility on Android — LLM streaming must fall back to native `fetch` | `providers/llm/index.ts:183` | 3 | 3 | **9** | **RE-ACCEPT.** The fallback is already implemented and acknowledged in an inline comment; this is documented-and-handled fragility, not an open bug. Score < 12. Re-accepted; no streaming regressions reported in v1.6. |
| A4 | Theme-transition coordination (OS ↔ React ↔ CSS vars) — `matchMedia` doesn't fire on Capacitor resume | `App.tsx:357` (`appStateChange` re-applies theme) | 2 | 2 | **4** | **NOTE-ONLY.** Already mitigated by the `appStateChange` re-apply handler. Cosmetic-tier severity (a missed theme flip self-corrects on next resume). No action. |
| A5 | SQLite encoding/serialization — non-text data stored as JSON-in-TEXT blobs | `db.service.ts` | 2 | 2 | **4** | **NOTE-ONLY.** Standard SQLite pattern for this app; JSON-as-TEXT is intentional and round-trips correctly. No corruption observed. No action. |
| A6 | localStorage quota — `trellis_post_history` grows until `purgeExpired()` runs; quota errors silently swallowed | `postHistoryService`, called from `HomeScreen` mount | 3 | 3 | **9** | **RE-ACCEPT.** 7-day rolling purge bounds growth; HomeScreen is the guaranteed entry route so purge runs every session. Silent-catch on quota is the established pattern (`Don't Hand-Roll` table). Score < 12. Re-accepted; a hard quota event is exceptional on mobile. |
| A7 | Storage-key naming drift in debug docs (`echolearn_*` vs live `trellis_*`) | `.planning/debug/*` writeups | 1 | 2 | **2** | **NOTE-ONLY.** Live code uses `trellis_*`; `legacy-migration.service.ts` handles the runtime rename idempotently. Only the debug *writeups* mislead. Doc drift, not code debt → out of Phase 54 code scope; doc archiving/correction is Phase 56. No action here. |

### Group B — Phase 45 deferred dead-code symbols

> Counts verified by grep on 2026-05-20. "1" = declaration only, no live call site.

| #   | Symbol | File | Call sites | Sev | Reach | Score | Decision (with rationale) |
|-----|--------|------|-----------|-----|-------|-------|---------------------------|
| B1  | `usePlanner` | `state/usePlanner.ts:19` | 1 (decl only) | 1 | 1 | **1** | **RESOLVED (Plan 54-04).** Deleted — `@deprecated` Phase 26 D-22, zero live call sites; word-boundary re-grep reconfirmed 0 refs (LIVE `usePlannerAutoGen` untouched). `tsc -b --noEmit` green after deletion. |
| B2  | `ConnectionPostScreen` | `screens/ConnectionPostScreen.tsx:27` | 1 (decl only); 0 in `App.tsx` routes | 1 | 1 | **1** | **RESOLVED (Plan 54-04).** Deleted — 0 references, not routed in `App.tsx`, exports no unique type/util consumed elsewhere (only the component). `tsc` green after. |
| B3  | `recordFeedView` | `trajectoryAnalyzer.service.ts:63` | 1 (decl only) | 2 | 2 | **4** | **RESOLVED (Plan 54-04, operator decision `a-delete-warn`).** Deleted the dead `recordFeedView` export. `FEED_VIEWS_KEY`, `SIGNAL_CACHE_KEY`, and `loadFeedViews()` were RETAINED — re-grep confirmed `loadFeedViews()` is still consumed by the LIVE `aggregateSignals` (feedViews count), so the keys have other readers and were not removed. Live `trajectoryAnalyzer.service.ts` (imported by `plannerAutoGen.service.ts`) untouched. |
| B4  | `replaceBlossomDates` | `trellis-blossom-dates.service.ts:42` | 1 (decl only) | 1 | 1 | **1** | **RE-ACCEPT.** Low-risk test/reset seam. Plausibly used by dev affordances; not worth deleting given near-zero carrying cost and a real chance it's an intentional reset hook. |
| B5  | `recordStructuralSignalPatch` | `canonical-knowledge.service.ts:1285` | 1 (decl only) | 2 | 2 | **4** | **RE-ACCEPT.** Lives in a load-bearing service (`canonical-knowledge`). Deleting from this file risks collateral; the symbol is a structural-signal seam that may be wired in a tuning phase. Re-accepted with rationale rather than risk a load-bearing-file edit during cleanup (Pitfall 2). |
| B6  | `hasReorgBackup` | `canonical-knowledge.service.ts:1558` | 1 (decl only) | 3 | 2 | **6** | **RE-ACCEPT.** Safety-related rollback seam for graph reorganization. Higher severity (data-correctness on rollback). Keeping a rollback affordance available outweighs deleting unused-but-safety-adjacent code. Re-accepted; wire to a call site in a future reorg-UX phase if needed. |
| B7  | `revertReorganization` | `canonical-knowledge.service.ts:1562` | 1 (decl only) | 3 | 2 | **6** | **RE-ACCEPT.** Same rationale as B6 — paired rollback primitive. Re-accepted as a safety seam. |
| B8  | `getMoveDestination` | `lib/moveNavigator.ts:195` | 1 (decl only) | 1 | 1 | **1** | **RE-ACCEPT.** Likely dead since the planner-state refactor, but `moveNavigator` is a candidate for Phase 55 planner work. Carrying cost is negligible; re-accepted pending Phase 55 rather than deleted now. |
| B9  | `useTodayQuestions` | `state/useQuestions.ts:416` | 1 (decl only) | 1 | 1 | **1** | **RE-ACCEPT.** Plausible public-API seam within the live `useQuestions` module. Deleting risks touching a load-bearing file; near-zero carrying cost. Re-accepted. |
| B10 | `nanoBananaProvider` | `providers/nanoBanana.provider.ts:181` | 1 (decl only) | 2 | 2 | **4** | **RE-ACCEPT.** Image-provider singleton, integration-adjacent (Nano Banana image gen). May be activated by a settings toggle path. Re-accepted as a provider seam. |
| B11 | `cancelNativeNotifications` | `scheduler.native.ts:122` | 1 (decl only) | 2 | 2 | **4** | **RE-ACCEPT.** Platform-bridge teardown primitive; sensible to retain for a future notification-cancel flow. Re-accepted; wire to a teardown path if/when needed. |
| B12 | `InlineInfoFlow` | `components/InfoFlow.tsx` | 21 refs (preserved export; no HomeScreen wiring) | 1 | 1 | **1** | **RE-ACCEPT.** Explicit compatibility export per Phase 42 decision (masonry feed replaced inline single-column). Intentionally preserved; NOT dead in the deletion sense. Re-accepted as a documented compat export. |
| —   | `hapticImpactMedium` | `lib/haptics.ts:24` | 4 refs (2 live call sites in `GraphScreen.tsx`) | — | — | — | **NOT DEBT — LIVE.** Listed for completeness; has live call sites. Excluded from scoring. |

### Group C — New debt introduced in v1.6 phases

| #  | Item | File(s) | Sev | Reach | Score | Decision (with rationale) |
|----|------|---------|-----|-------|-------|---------------------------|
| C1 | `console.log` violating `no-console` rule (7 instances) | `scheduler.service.ts:76,84,113,137,172,178,190` | 1 | 2 | **2** | **RESOLVED (Plan 54-04, operator decision `a-delete-warn`).** All 7 `console.log` → `console.warn` (allowlisted; `console.info` is NOT). Preserves the device-debug diagnostics while clearing the lint warnings. |
| C2 | `console.log` violating `no-console` rule (2 instances) | `scheduler.native.ts:106,111` | 1 | 2 | **2** | **RESOLVED (Plan 54-04, operator decision `a-delete-warn`).** Both `console.log` → `console.warn` alongside C1. |
| C3 | Stale `eslint-disable` (`@typescript-eslint/no-unused-vars`) | `PodcastScreen.tsx:102` | 1 | 1 | **1** | **RESOLVED (Plan 54-04).** Deleted the stale disable line; the `_qa`/`_ct` underscore-prefix already satisfies the `varsIgnorePattern: '^_'` exemption. `npm run lint` reports 0 errors on the file (the unrelated `react-hooks/exhaustive-deps` disable at the next `useEffect` was left intact). |
| C4 | Large background image (4.55 MB) bloats the Capacitor bundle | `assets/planner-trellis/trellis-bg-default.png` | 2 | 3 | **6** | **RE-ACCEPT.** Real bundle bloat (P2 per Phase 45 perf audit), but image re-compression/resizing is asset-pipeline work, not code cleanup, and risks visual regression on the planner background. Re-accepted; fold into a Phase 56 polish/asset pass. |
| C5 | 1.29 MB `index.js` chunk — no code-splitting; dynamic-import warnings | build output (`vite`) | 2 | 3 | **6** | **RE-ACCEPT.** Code-splitting is a build-architecture change (P2; less critical for Capacitor where assets are local-bundled, not network-fetched). Out of scope for a cleanup phase. Re-accepted; revisit if web-delivery latency becomes a target. |
| C6 | Missing call sites for `recordFeedView` — trajectory analytics pipeline incomplete/abandoned | `trajectoryAnalyzer.service.ts:63` | 2 | 2 | **4** | **RESOLVED (Plan 54-04, operator decision `a-delete-warn`).** Same item as B3 — the dead `recordFeedView` export was deleted; the trajectory-analytics seam can be re-added in Phase 55 (TUNE-02) if wired then. |

### Group D — Architecture / design debt (lower priority)

| #  | Item | Nature / Risk | Sev | Reach | Score | Decision (with rationale) |
|----|------|---------------|-----|-------|-------|---------------------------|
| D1 | `postHistoryService.purgeExpired()` called only at HomeScreen mount | If user never visits HomeScreen, history grows unbounded | 2 | 2 | **4** | **NOTE-ONLY.** HomeScreen (`/home`) is the guaranteed app entry route — every session hits it. The "never visits" precondition is effectively unreachable. No action. |
| D2 | `dailyReadService` fully stateless (localStorage read on every call) | O(N) reads/session for explored anchors | 1 | 2 | **2** | **NOTE-ONLY.** Correct freshness-first design (CLAUDE.md no-refresh constraint depends on it); typical N < 20/day. Re-reading is a feature, not a bug. No action. |
| D3 | `_state` in `post-queue.service.ts` is a module-level mutable singleton | Async callers could race on `_state.posts.splice()` | 2 | 2 | **4** | **NOTE-ONLY.** JS is single-threaded; the event loop prevents true interleaving, and the refill mutex serializes the one async-reentrant path (`refillQueue`). No real race surface. No action. |
| D4 | `generateMorePosts` awaits `refillQueue` then immediately dequeues — empty-swipe edge | If refill yields 0 posts (all explored / cap hit / anchors=0), user sees an empty swipe | 3 | 2 | **6** | **RE-ACCEPT.** Guarded by `allExplored` cap logic; the empty-swipe surfaces a legitimate "no more posts" state, which is the intended UX. QUALITY-01 adds a regression test (`concept-feed-bonus-cap`) covering the `bonusCap=0` / `anchors=0` edges. Re-accepted as designed behavior with test coverage. |
| D5 | API keys stored in plaintext localStorage (`trellis_settings`) | No Capacitor SecureStorage — key exposure if WebView storage is accessible | 3 | 3 | **9** | **RE-ACCEPT.** Explicitly accepted scope for a local-first, user-provides-own-keys OSS app (CONCERNS.md security section). Score < 12. Moving to SecureStorage is a security-hardening feature, not cleanup. Re-accepted as documented design scope; revisit if a key-brokered commercial mode ships. |

---

## Tier Summary

| Tier | Count | Items |
|------|-------|-------|
| **RESOLVED** (fixed in Plan 54-04) | 5 | B1 `usePlanner` deleted, B2 `ConnectionPostScreen` deleted, C3 stale `eslint-disable` removed, B3/C6 `recordFeedView` deleted, C1/C2 scheduler `console.log` → `console.warn` |
| **RE-ACCEPT** (6–11, or low-risk seam to retain) | 13 | A1, A2, A3, A6, B4, B5, B6, B7, B8, B9, B10, B11, B12, C4, C5, D4, D5 |
| **NOTE-ONLY** (≤5, acknowledged, no action) | 7 | A4, A5, A7, D1, D2, D3 |

### Operator decision (Plan 54-04 `checkpoint:decision`)

**Selected: `a-delete-warn`** (recorded 2026-05-20).

- **(A) `recordFeedView` / trajectory analytics:** DELETE the dead export. Storage keys
  (`FEED_VIEWS_KEY`, `SIGNAL_CACHE_KEY`) and the `loadFeedViews()` helper were RETAINED
  after re-grep confirmed `loadFeedViews()` is still read by the LIVE `aggregateSignals`.
  Re-add the analytics seam in Phase 55 (TUNE-02) if/when wired.
- **(B) Scheduler logging:** convert all 9 `console.log` calls to `console.warn`
  (`console.info` is NOT lint-allowed), preserving the device-debug diagnostics.

> A1 scores exactly 12 (FIX boundary) but is re-accepted with rationale — its remediation is an
> architectural rewrite, not a Phase 54 cleanup. This is the one deliberate boundary override and
> is documented at the A1 row. No other item crosses the FIX threshold on raw score.

---

## Top Tier (FIX) Worklist — RESOLVED in Plan 54-04

All items below were resolved in Plan 54-04 (commits in the 54-04 wave):

1. **B1 — `usePlanner` (`state/usePlanner.ts`) — DELETED.** Re-grep reconfirmed 0 call sites; `tsc -b --noEmit` green after. LIVE `usePlannerAutoGen` untouched.
2. **B2 — `ConnectionPostScreen` (`screens/ConnectionPostScreen.tsx`) — DELETED.** Not routed in `App.tsx`; no unique exported type/util consumed elsewhere; `tsc` green after.
3. **C3 — Stale `eslint-disable` line at `PodcastScreen.tsx:102` — REMOVED.** `npm run lint` reports 0 errors on the file.

### Operator-decision items — RESOLVED via `a-delete-warn`

- **D1 (B3/C6) — `recordFeedView` / trajectory-analytics fate:** DELETED the dead export. `FEED_VIEWS_KEY` / `SIGNAL_CACHE_KEY` / `loadFeedViews()` RETAINED (the helper is still read by the LIVE `aggregateSignals`). Re-add the seam in Phase 55 (TUNE-02) if needed.
- **D2 (C1/C2) — scheduler-log conversion target:** all 9 `console.log` sites (`scheduler.service.ts` ×7 + `scheduler.native.ts` ×2) converted to `console.warn` (`console.info` is NOT allowlisted), preserving diagnostics.

---

## Verification Log (call-site grep, 2026-05-20, live `app/src/` + `app/tests/`)

| Symbol / target | Result | FIX-delete confirmed? |
|---|---|---|
| `usePlanner` | 1 hit (declaration only) | ✓ RESOLVED — deleted (Plan 54-04) |
| `ConnectionPostScreen` | 1 hit (declaration); 0 in `App.tsx` | ✓ RESOLVED — deleted (Plan 54-04) |
| `recordFeedView` | 1 hit (declaration only) | ✓ RESOLVED — deleted (Plan 54-04, `a-delete-warn`); keys/`loadFeedViews` retained (live reader) |
| `scheduler.service.ts` `console.log` | 7 instances | ✓ RESOLVED — → `console.warn` (Plan 54-04, `a-delete-warn`) |
| `scheduler.native.ts` `console.log` | 2 instances | ✓ RESOLVED — → `console.warn` (Plan 54-04, `a-delete-warn`) |
| `PodcastScreen.tsx:102` stale `eslint-disable` | present | ✓ RESOLVED — removed (Plan 54-04) |
| `recordStructuralSignalPatch` | 1 hit (declaration only) | re-accept (load-bearing file) |
| `getMoveDestination` | 1 hit (declaration only) | re-accept (Phase 55 candidate) |
| `useTodayQuestions` | 1 hit (declaration only) | re-accept (API seam) |
| `replaceBlossomDates` | 1 hit (declaration only) | re-accept (reset seam) |
| `hasReorgBackup` / `revertReorganization` | 1 hit each (declaration only) | re-accept (safety seam) |
| `nanoBananaProvider` | 1 hit (declaration only) | re-accept (provider seam) |
| `cancelNativeNotifications` | 1 hit (declaration only) | re-accept (teardown primitive) |
| `InlineInfoFlow` | 21 hits (preserved compat export) | re-accept (Phase 42 compat export) |
| `hapticImpactMedium` | 4 hits (2 live call sites) | NOT DEBT — live |
| `trellis-bg-default.png` size | 4,554,991 bytes (4.55 MB) | re-accept (asset pass, Phase 56) |

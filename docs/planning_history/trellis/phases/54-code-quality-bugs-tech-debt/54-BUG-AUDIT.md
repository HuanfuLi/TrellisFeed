# 54-02 Whole-Codebase Bug Audit (QUALITY-01, D-04)

Breadth sweep over services + screens + hooks, anchored on the 5 RESEARCH.md risk
clusters plus a broader sweep. Each finding carries an explicit disposition:

- **FIX** — confirmed bug, fixed in this plan (Task 2).
- **LOG** — real observation deferred to a later phase (out of this plan's boundary).
- **NOT-A-BUG** — checked, behaves correctly as designed; reasoning recorded.

Phase boundary respected: no cosine-threshold tuning (Phase 55), no UI/nav/spacing
changes (Phase 56). Security invariants preserved: `normalizeAnchorName()` not bypassed,
question-filter dual-vector not collapsed.

Each FIX cites the regression test that observes its corrected runtime behavior.

---

## Cluster 1 — concept-feed pipeline edge cases (HIGHEST RISK)

Files: `concept-feed.service.ts`, `post-queue.service.ts`.

| Edge | Live code | Behavior checked | Disposition |
|------|-----------|------------------|-------------|
| anchors = 0 (first-time user) | `concept-feed.service.ts:1705` | `allExplored = anchors.length > 0 && anchors.every(...)` — with zero anchors the `> 0` clause short-circuits to `false`, so the bonus cap NEVER fires for a brand-new user. Generation is bounded elsewhere by `buildConceptBatch` returning `[]` when all anchors are explored. | NOT-A-BUG — pinned by regression test `concept-feed-bonus-cap.test.mjs` (cases 1, 8). |
| bonusCap = 0 / allExplored | `concept-feed.service.ts:1706-1709` | When all anchors explored and `totalServed >= totalGenerated + 0`, the gate returns `[]` (no crash, no negative count). `>=` means boundary equality caps. | NOT-A-BUG — pinned by `concept-feed-bonus-cap.test.mjs` (cases 4, 7). |
| dequeue partial (queue shorter than count) | `concept-feed.service.ts:1713-1719` | `dequeue(count)` returns whatever's available; the `posts.length === 0 && needsRefill()` branch awaits a refill then re-dequeues. Partial (1..count-1) returns are served as-is — by design (CLAUDE.md "Queue serves variable count"). | NOT-A-BUG. |
| walker len = 0 (empty derived list) | `post-queue.service.ts:411` | `walkDerivedList` early-returns `[]` when `len === 0`; even without the early-return, `maxSteps = Math.max(count*2, 0)` bounds the loop and the `result.length < count` condition over an empty list terminates immediately. No infinite loop, no thrown error. | NOT-A-BUG — pinned by `walker-empty-derived-list.test.mjs`. |
| walker maxSteps regression (Phase 36 GAP-B) | `post-queue.service.ts:422` | `maxSteps = Math.max(count*2, len)`. With `count=16, len=4` → `Math.max(32,4)=32` (NOT `len*2=8`), preserving the GAP-B fix that keeps text-art at 56% not 50%. | NOT-A-BUG — pinned by `walker-empty-derived-list.test.mjs` (maxSteps guard case). |

RESEARCH.md predicted these edges are currently correct; the audit confirms that. The
new tests are **pinning guards**, not fix-drivers.

---

## Cluster 2 — always-mounted screen resync completeness (MEDIUM RISK)

Files: `HomeScreen.tsx`, `PlannerScreen.tsx`.

CLAUDE.md invariant: always-mounted SwipeTabContainer slots run `useState(() => svc.get())`
initializers ONCE at app boot, never on `navigate('/home')`. Any screen reading mutable
service state must re-read it in a `[location.pathname]` effect.

| Surface | Live code | Behavior checked | Disposition |
|---------|-----------|------------------|-------------|
| HomeScreen `generationError` gate | `HomeScreen.tsx:223` | `if (posts.length === 0 && questions.length > 0 && !warmStartHadPostsRef.current)`. The `questions.length > 0` clause suppresses a false error for a first-time user whose feed is legitimately empty (no anchors yet). | NOT-A-BUG — pinned by `HomeScreen.empty-questions-no-error.test.mjs`. |
| HomeScreen `exploredAnchors` + `creditAwardedRef` resync | `HomeScreen.tsx:697-712` | Canonical `[location.pathname]==='/home'` effect re-reads `dailyReadService.getExploredAnchors()` and `isCreditAwarded()`. Present and correct (Phase 36-14 / 43-06). | NOT-A-BUG — guarded by `HomeScreen.exploredAnchors-resync.test.mjs`. |
| HomeScreen `suggestedMoveCount` staleness | `HomeScreen.tsx:189, 276-306` | `suggestedMoveCount` is recomputed inside a `[location.pathname]` effect (line 276 early-returns when not `/home`, line 189 re-reads move counts). Re-read on every `/home` navigation. | NOT-A-BUG. |
| **HomeScreen reading a credit BALANCE** | `HomeScreen.tsx:759` | HomeScreen only *adds* a credit (`trellisCreditsService.add(1)`) on vine completion; it never *displays* the running balance. So there is no stale-display surface on HomeScreen itself. | NOT-A-BUG (for HomeScreen). |
| **PlannerScreen credit balance (OQ#3)** | `PlannerScreen.tsx:38` | `const [credits, setCredits] = useState(() => trellisCreditsService.getTotal())` — a boot-once initializer. `credits` is updated ONLY via `onCreditsChange={setCredits}` from the harvest button (line 126). PlannerScreen is an always-mounted swipe slot with **NO `[location.pathname]` resync effect** and **no event subscription** for credit changes. When the user finishes the daily vine on HomeScreen (`trellisCreditsService.add(1)`) while Planner is off-screen, then swipes to Planner, the displayed balance is **stale** until the next harvest mutates it. This is the exact CLAUDE.md "always-mounted screen must re-read on navigation" bug class. | **FIX** — see Task 2. Fixed by adding the canonical `[location.pathname]==='/planner'` resync effect to PlannerScreen. Observed by `PlannerScreen.credits-resync.test.mjs`. |

### OQ#3 disposition (RESEARCH.md open question #3) — RESOLVED: FIX

Evidence above. The harvest-credit display on PlannerScreen CAN show a stale balance after
navigating away and back while it changed off-screen (HomeScreen daily-read award is the
concrete off-screen mutator). Per the plan's Task 2 directive, the fix extends the screen's
navigation-resync surface using the canonical `[location.pathname]` pattern. PlannerScreen
had **zero** prior pathname-resync effect, so this adds the single canonical effect (NOT a
duplicate — there was none) and introduces **no new event** (the `add()` call site stays the
sole credit mutator; one signal per semantic event preserved).

---

## Cluster 3 — vine / leaf state edges (MEDIUM RISK)

File: `daily-read.service.ts`.

| Edge | Live code | Behavior checked | Disposition |
|------|-----------|------------------|-------------|
| `getConceptQuota` with empty questions | `daily-read.service.ts:118-127` | Iterates `questionsById` entries; with an empty map it returns an empty `Set` (no crash, no undefined access). Quota of 0 → HomeScreen's `conceptQuota > 0` celebration gate stays closed (correct: nothing to complete). | NOT-A-BUG. |
| `creditAwardedRef` freshness | `HomeScreen.tsx:706-712` | Reset from `dailyReadService.isCreditAwarded()` inside the `/home` resync effect, so a Force-New-Day reset re-opens the celebration gate. | NOT-A-BUG (guarded by exploredAnchors-resync test). |
| `isCreditAwarded` daily flag | `daily-read.service.ts:74` | Reads from date-stamped state; resets on date mismatch via `loadState()`. | NOT-A-BUG. |

---

## Cluster 4 — question-filter dual-vector (MEDIUM RISK — LOAD-BEARING)

File: `question-filter.service.ts`.

| Edge | Live code | Behavior checked | Disposition |
|------|-----------|------------------|-------------|
| Dual-vector correctness | `question-filter.service.ts:170-195` | Malicious scored against `rawVec` (raw content); off-topic/on-topic against `contextVec` (D-11 contextualized). When `priorAnswer` empty, `contextVec` aliases `rawVec` (no extra `embedText`). Not collapsed. | NOT-A-BUG (load-bearing) — guarded by `filter-classifier.unit.test.mjs` Test 18a/18d. Plan forbids collapsing. |
| Pre-aborted AbortSignal | `question-filter.service.ts:170-191` | `signal?.aborted` is checked BEFORE the first `await embedText` (line 170) and after each subsequent await — a pre-aborted signal throws `AbortError` without issuing an embedding call. | NOT-A-BUG. |
| All-null / empty corpus default | `question-filter.service.ts` (Layer 2 fallback) | When the corpus is empty or the embedding provider is unavailable, the classifier falls back to Layer 1's outcome or `{label: 'on-topic'}` (fail-open for benign content; bracketing is the defense-in-depth layer). | NOT-A-BUG — documented fail-open at module header lines 37-38. |

**Security note:** No change to threshold bands (Phase 55) and no collapse of the
dual-vector. T-54-02-DV mitigation honored.

---

## Cluster 5 — classification pre-check (LOWER RISK)

File: `canonical-knowledge.service.ts`.

| Edge | Behavior checked | Disposition |
|------|------------------|-------------|
| Pre-check on empty store | The O(N) cosine pre-check iterates existing anchors; with an empty store the loop body never runs and the pipeline descends the tree normally (no crash, no false reuse). | NOT-A-BUG. |
| Opportunistic backfill on empty store | Backfill is bounded by `ANCHOR_BACKFILL_PER_CLASSIFICATION` and a no-op when there are no anchors lacking `embeddingVector`. | NOT-A-BUG. |
| `normalizeAnchorName` on both sides | Both `result.anchorName` and stored `q.title` are normalized before lookup (CLAUDE.md guard). Not bypassed. | NOT-A-BUG (load-bearing). |

---

## Cluster 6 — scheduler + podcast auto-gen (LOWER RISK — confirmed working)

File: `scheduler.service.ts` (+ `scheduler.native.ts`).

| Edge | Live code | Behavior checked | Disposition |
|------|-----------|------------------|-------------|
| `trellis_scheduler_podcast_done` daily reset | `scheduler.service.ts:31-40` | The flag is compared against `today()` (`getItem(key) === today()`); a new day's value differs so the flag auto-clears. It is a daily flag, not permanent. | NOT-A-BUG. |
| `generatePodcast` error containment | `scheduler.service.ts:95-96` | `await podcastService.generatePodcast(...)` wrapped in try/catch (also at 117, 152); a generation failure logs and does not crash the 60s poll loop. | NOT-A-BUG. |

QUALITY-03 (podcast auto-gen debug) is a separate plan; this audit only confirms the
scheduler edges are sound, it does not re-investigate QUALITY-03.

---

## Broader sweep (services + screens + hooks beyond the 5 clusters)

| Area | Observation | Disposition |
|------|-------------|-------------|
| `console.log` lint warnings | `scheduler.service.ts` (8) + `scheduler.native.ts` (2) use `console.log`, violating `no-console: ['warn', { allow: ['warn','error'] }]` (eslint.config.js:41). Diagnostic, not crash-causing. RESEARCH.md OQ#2 recommends `console.info`/`console.warn`. | LOG — code-quality lint cleanup; out of QUALITY-01's bug-fix scope (this plan ships audit + regression guards + the credit-resync fix). Track for a focused lint sweep. |
| `cancelNativeNotifications` (scheduler.native.ts:122) | Declaration with a single reference; platform-bridge teardown stub. | LOG — re-accept or wire to teardown in a later cleanup pass. |
| Cosine threshold constants | Multiple empirical thresholds (0.82 anchor pre-check, 0.82 malicious). | LOG — Phase 55 (TUNE-01) owns threshold tuning; explicitly NOT touched here (Pitfall 5). |
| UI spacing / animation / nav | Various polish opportunities. | LOG — Phase 56 (POLISH) boundary; not touched. |

---

## Summary

- **5 clusters + broader sweep** audited.
- **1 confirmed bug → FIX:** PlannerScreen stale credit balance on navigation (Cluster 2 / OQ#3).
- **All other cluster edges → NOT-A-BUG:** RESEARCH.md's prediction that the concept-feed
  edges are correct is confirmed; they are now pinned by behavior-observing regression tests.
- **Deferred → LOG:** scheduler `console.log` lint, dead `cancelNativeNotifications`,
  cosine thresholds (Phase 55), UI/nav (Phase 56).
- No cosine-threshold or UI/nav change appears in this plan's diff.

### FIX → regression test traceability (QUALITY-01)

| Fix | Test observing corrected behavior |
|-----|-----------------------------------|
| PlannerScreen credit resync on `/planner` navigation | `app/tests/screens/PlannerScreen.credits-resync.test.mjs` |

### Pinning guards (no fix needed, RESEARCH-confirmed correct)

| Edge | Pinning test |
|------|--------------|
| bonusCap=0 / anchors=0 cap gate | `app/tests/services/concept-feed-bonus-cap.test.mjs` |
| walker len=0 + maxSteps GAP-B | `app/tests/services/walker-empty-derived-list.test.mjs` |
| generationError requires `questions.length > 0` | `app/tests/screens/HomeScreen.empty-questions-no-error.test.mjs` |

---
phase: 55-algorithm-mechanism-tuning
verified: 2026-05-21T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "On-device large-mindmap localStorage quota relief"
    expected: "No quota error after exercises with a large mindmap (many Q&A pairs) in the browser or device WebView using the new WASMSQLiteBackend path"
    why_human: "OPFS-backed WASM SQLite quota relief must be observed in a real browser/WebView; node --test runs use the LocalStorageBackend fallback (OpfsDb is not a constructor in Node). The automated Float32 BLOB codec and hydration invariants are verified; only the live-device quota measurement requires human observation."
  - test: "Per-threshold debug knob tuning flow in npm run dev"
    expected: "Turning on Debug mode in Settings > AI exposes the three labeled sliders (Off-topic 0.60-0.95, Malicious 0.78-0.85, Anchor-dedup 0.78-0.85); tuning the malicious slider below 0.78 is impossible (clamped by min attribute); the instrumented cosine would-flip-distance logs appear in DevTools console during question evaluation"
    why_human: "UI clamping (min/max attributes on range inputs) and DevTools console output require a browser; cannot be verified programmatically from Node"
---

# Phase 55: Algorithm & Mechanism Tuning Verification Report

**Phase Goal:** The app's numeric thresholds and signal-driven mechanisms behave as intended and are tuned with documented, test-backed rationale rather than guesswork; the heavy store layer escapes the localStorage quota by migrating to a SQLite-primary backend.
**Verified:** 2026-05-21
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Classification-dedup and filter cosine-similarity thresholds are reviewed, set to documented values, and the cosine-similarity threshold cache-miss todo is resolved | VERIFIED | `ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD = 0.82` confirmed in source; embed cache (`_embedCache` Map in `providers/embedding/index.ts`) makes the single-ask embed deterministic; `embed-cache.test.mjs` 4/4 green; `classification-dedup.test.mjs` 10/10 green including new band assertion |
| 2  | The filter mechanism is exercised against expected behavior (off-topic, on-topic, malicious) without re-opening the buried-payload evasion surface | VERIFIED | `filter-golden-fixtures.test.mjs` 4/4 green (incl. buried-payload case at the golden level); `filter-classifier.unit.test.mjs` Test 18d green; `getActiveThresholds` clamps malicious to `Math.min(0.85, Math.max(0.78, ...))` in the service read path (load-bearing D-06 guard confirmed in source) |
| 3  | Recommendation, feed-randomizer, and like-signal mechanisms are tested against expected behavior and tuned, each constant with a rationale comment | VERIFIED | `like-boost.test.mjs` 9/9 green; `isBoosted = isImportant \|\| isLiked` wired in `buildConceptBatch`; `STYLE_WEIGHTS` sum=1.0 verified by test; rationale comments confirmed in `trajectoryAnalyzer.service.ts`; `style-assignment-stratified.test.mjs` 9/9 green |
| 4  | Curiosity-feed buffer queue reliably refills: swipe-for-more serves the intended 8-post batch whenever derived list has unread capacity; under-refill root-caused, fixed, and regression-tested | VERIFIED | `refill-reliability.test.mjs` 7/7 green (3 reproduction + 4 corrected-path); shortfall guard `posts.length < count && needsRefill()` confirmed in `concept-feed.service.ts`; `derived-list.test.mjs` 16/16, `refill-queue-integration.test.mjs` 7/7, `refill-mutex.test.mjs` 9/9 all green; no CLAUDE.md numerics changed (MAX_QUEUE_SIZE=32, REFILL_THRESHOLD=24, maxSteps=Math.max(count*2,len)) |
| 5  | Heavy/growing stores migrate to SQLite-primary with sync read API preserved, Float32 BLOB vectors, clean cutover, delete-guard and always-mounted resync intact | VERIFIED | `storage-migration.test.mjs` 4/4 green (BLOB round-trip ≤1e-6, delete-guard present, GRAPH_UPDATED emitted, WASMSQLiteBackend class present); `loadStore`/`saveStore` in `question.service.ts` are non-async (D-12 LOCKED INVARIANT); all 13 legacy heavy-store keys enumerated in `clearAllTables`; `App.tsx` calls 10 hydrate functions void-fired |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/providers/embedding/index.ts` | Session embed cache + clearEmbedCache + getCachedEmbedding | VERIFIED | `_embedCache = new Map<string, number[]>()`, `_djb2CacheKey`, `clearEmbedCache`, `getCachedEmbedding` all present; `cosine` and FILTER-03 exemption comment preserved |
| `app/src/services/question-filter.service.ts` | `getActiveThresholds` with D-06 malicious clamp | VERIFIED | `getActiveThresholds` at line 116 returns hardcoded constants when `debugEnabled !== true`; clamp `Math.min(0.85, Math.max(0.78, ...))` at line 123 |
| `app/src/types/index.ts` | EmbeddingDebugConfig with `maliciousThreshold?` | VERIFIED | Type extended additively with `debugEnabled?`, `offTopicThreshold?`, `maliciousThreshold?`, `anchorDedupThreshold?`; legacy fields retained |
| `app/src/services/db.service.ts` | WASMSQLiteBackend + extended schema + 13-key cutover | VERIFIED | `class WASMSQLiteBackend implements DBBackend` at line 211; all 13 heavy-store keys in `legacyKeys` array; `questions.embedding BLOB` in SHARED_DDL |
| `app/src/services/question.service.ts` | SQLite-primary + Float32 BLOB + sync reads | VERIFIED | `vectorToBase64`/`base64ToVector` present; `deleteFromSQLite` is async; `loadStore`/`saveStore` remain synchronous; delete-guard `if (existing.length > 0) return` at line 123 |
| `app/src/App.tsx` | hydrateAllFromSQLite boot orchestration | VERIFIED | `hydrateAllFromSQLite()` defined at line 343, void-fires all 10 migrated service hydrates |
| `app/src/services/concept-feed.service.ts` | like-boost `isBoosted` + shortfall-refill fix `needsRefill` | VERIFIED | `isBoosted = isImportant \|\| isLiked` at line 923; `refillBranchFired = posts.length < count && needsRefill()` at line 1863 |
| `app/tests/providers/embed-cache.test.mjs` | TUNE-01 embed-cache tests | VERIFIED | 4/4 pass |
| `app/tests/services/filter-golden-fixtures.test.mjs` | D-03 golden corpus with buried-payload case | VERIFIED | 4/4 pass; buried-payload (benign preamble + verbatim jailbreak) correctly classifies malicious |
| `app/tests/services/storage-migration.test.mjs` | BLOB codec + delete-guard + GRAPH_UPDATED + WASMSQLiteBackend | VERIFIED | 4/4 pass |
| `app/tests/services/like-boost.test.mjs` | like-boost + pipeline invariants | VERIFIED | 9/9 pass |
| `app/tests/services/refill-reliability.test.mjs` | under-refill reproduction + corrected batch | VERIFIED | 7/7 pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `question-filter.service.ts` | `providers/embedding/index.ts` | `embedText` rawVec hits cache | VERIFIED | `embedText` imported and called in `layer2Embedding` for `rawVec`; runs before retrieval and pre-check so those become cache hits |
| `canonical-knowledge.service.ts` | `settings.embeddingDebug.anchorDedupThreshold` | `preCheckAnchorMatch` reads live knob when debugEnabled | VERIFIED | Line 730: reads `embDebug.anchorDedupThreshold`, clamps to `[0.78, 0.85]`; pre-check still runs before `buildStepPrompt('branch')` |
| `SettingsAIScreen.tsx` | `providers/embedding/index.ts` | `clearEmbedCache` on model change | VERIFIED | `clearEmbedCache` imported at line 10; called at line 59 inside `saveEmbedding` only when `prev.provider !== current.provider \|\| prev.model !== current.model` |
| `SettingsAIScreen.tsx` | `settings.embeddingDebug.maliciousThreshold` | slider min=0.78 max=0.85 | VERIFIED | Range input for malicious at line 376-377: `min={0.78} max={0.85}`; three knobs render only when `debugEnabled` is true |
| `concept-feed.service.ts` | `postQueueService.needsRefill` | shortfall refill in generateMorePosts | VERIFIED | `refillBranchFired = posts.length < count && postQueueService.needsRefill()` at line 1863 |
| `db.service.ts` | `@sqlite.org/sqlite-wasm` | WASMSQLiteBackend dynamic import | VERIFIED | Dynamic `import('@sqlite.org/sqlite-wasm')` in `WASMSQLiteBackend.init()`; `vite.config.ts` excludes the package from optimizeDeps |
| `App.tsx` | each migrated service `hydrateFromSQLite` | boot useEffect orchestration | VERIFIED | 10 hydrate calls in `hydrateAllFromSQLite()`; all void-fired (non-blocking first render) |

### Data-Flow Trace (Level 4)

Storage pipeline is service-layer data (not rendered dynamic UI components), so data-flow trace applies to the SQLite read path:

| Service | Data Variable | Source | Produces Real Data | Status |
|---------|--------------|--------|-------------------|--------|
| `question.service.ts` | `questions[]` in-memory mirror | `hydrateFromSQLite` SELECTs from `questions` table, reassembles `embeddingVector` from BLOB | Yes — DB query + mirror population | FLOWING |
| `question-filter.service.ts` | `rawVec` | `embedText(content, embConfig)` → cache hit/miss → embedding provider | Yes — cache-miss delegates to provider; cache-hit returns stored vector | FLOWING |
| `concept-feed.service.ts` | `likedConceptIds` | `engagementService.getLikedPostIds()` + `postHistoryService.getPosts()` | Yes — resolved from in-memory mirrors | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| embed-cache: same text/model = 1 fetch call | `node --test tests/providers/embed-cache.test.mjs` | 4 pass, 0 fail | PASS |
| buried-payload malicious classification | `node --test tests/services/filter-golden-fixtures.test.mjs` | 4 pass, 0 fail | PASS |
| BLOB round-trip ≤ 1e-6 | `node --test tests/services/storage-migration.test.mjs` | 4 pass, 0 fail | PASS |
| like-boost multiplicity + pipeline negative | `node --test tests/services/like-boost.test.mjs` | 9 pass, 0 fail | PASS |
| shortfall-guard corrected 8-post batch | `node --test tests/services/refill-reliability.test.mjs` | 7 pass, 0 fail | PASS |
| filter Test 18d (dual-vector buried-payload) | `node --test tests/services/filter-classifier.unit.test.mjs` | 25 pass, 0 fail | PASS |
| Full test suite | `cd app && npm test` | 1516 pass + 149 pass = 1665 total, 0 fail, 0 skipped | PASS |
| TypeScript typecheck | `./node_modules/.bin/tsc -b --noEmit` | clean, exit 0 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TUNE-01 | 55-01, 55-02, 55-03, 55-05 | Numeric algorithm thresholds reviewed, tuned with documented rationale; cosine-threshold cache-miss todo resolved | SATISFIED | Embed cache in `providers/embedding/index.ts`; per-threshold knobs in `EmbeddingDebugConfig`; `getActiveThresholds` with D-06 clamp; Float32 BLOB in `questions.embedding`; all test evidence above |
| TUNE-02 | 55-03, 55-04 | Filter, recommendation, feed randomizer, and like signal mechanisms tested and tuned | SATISFIED | `filter-golden-fixtures.test.mjs` green; `like-boost.test.mjs` green; `STYLE_WEIGHTS` + `trajectoryAnalyzer` verified-and-kept with rationale comments; `style-assignment-stratified.test.mjs` green |
| TUNE-03 | 55-06 | Curiosity-feed buffer queue reliably refills; under-refill root-caused, fixed, regression-tested | SATISFIED | Root cause (a) confirmed: empty-only guard in `generateMorePosts` replaced by shortfall guard; `refill-reliability.test.mjs` 7/7; CLAUDE.md numerics preserved |

All three phase requirements (TUNE-01, TUNE-02, TUNE-03) are satisfied. No orphaned requirements — REQUIREMENTS.md maps only these three to Phase 55 and all are covered.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | No TBD/FIXME/XXX/TODO/PLACEHOLDER patterns found in any phase-modified file | — | — |

No stub patterns, no empty handlers, no hardcoded empty returns discovered in any modified file. The WASM `OpfsDb is not a constructor` warning in Node test output is the expected non-browser fallback (gracefully handled by the try/catch in `getDB()`), not a defect.

### CLAUDE.md Load-Bearing Invariant Checks

| Invariant | Check | Status |
|-----------|-------|--------|
| Dual-vector rawVec/contextVec not unified (CLAUDE.md §"Question filter") | `rawVec` = `embedText(content, ...)` no prefix; `contextVec` = priorAnswer-prefixed; malicious scored on `rawVec` (line 244); Test 18d green | PRESERVED |
| Malicious threshold clamped 0.78-0.85 in BOTH UI and service read path | UI: `min={0.78} max={0.85}` in SettingsAIScreen; service: `Math.min(0.85, Math.max(0.78, ...))` in `getActiveThresholds` | PRESERVED |
| D-12 LOCKED: sync read API unchanged (getSync/loadStore/saveStore) | `loadStore` and `saveStore` in question.service.ts are synchronous functions; no async creep | PRESERVED |
| 3-list concept-feed pipeline intact (no 4th list, append-only, cyclic walker) | `like-boost.test.mjs` negative assertion green; `refill-reliability.test.mjs` confirms walker + mutex path only; `MAX_QUEUE_SIZE=32`, `REFILL_THRESHOLD=24`, `maxSteps=Math.max(count*2,len)` unchanged | PRESERVED |
| FILTER-03 / D-13 exemption comment in embedding/index.ts (lines 1-11) | Lines 3-11 of `index.ts` contain verbatim FILTER-03 comment | PRESERVED |
| enablejsapi=1 in YouTubeEmbed.tsx | `grep -c "enablejsapi=1" src/components/YouTubeEmbed.tsx` = 2 | PRESERVED |

### Human Verification Required

#### 1. On-Device Large-Mindmap Quota Relief

**Test:** Exercise a large mindmap (50+ Q&A pairs) in `npm run dev` in Chrome or on-device via Capacitor WebView after the Phase 55 migration. Clear app data to trigger the D-11 clean cutover, then add a substantial set of questions and check that no `QuotaExceededError` appears in the console or a native error dialog.

**Expected:** No localStorage quota error. The `WASMSQLiteBackend` (opfs-sahpool) absorbs the growing `trellis_questions` (previously the quota driver due to the ~18 KB JSON double-store of embedding vectors). The Float32 BLOB column reduces embedding storage by ~3x.

**Why human:** Under `node --test`, `OpfsDb` is not a constructor (no browser secure context), so `getDB()` falls back to `LocalStorageBackend`. The OPFS runtime relief can only be measured in a real browser or WebView. The automated Float32 BLOB codec, delete-guard, and GRAPH_UPDATED invariants are verified by `storage-migration.test.mjs`; only the live-quota measurement is outstanding.

**Validation.md reference:** This is the "Browser SQLite backend escapes localStorage quota on-device" Manual-Only row in `55-VALIDATION.md` — explicitly documented as legitimately human-only.

#### 2. Per-Threshold Debug Knob UI in npm run dev

**Test:** In `npm run dev`, navigate to Settings > AI. Confirm the "Debug mode" MaterialSwitch is present. Toggle it on and confirm three labeled range sliders appear: Off-topic (min 0.60 / max 0.95), Malicious (min 0.78 / max 0.85), Anchor-dedup (min 0.78 / max 0.85). Attempt to drag the Malicious slider below 0.78 — it should refuse (clamped by the HTML min attribute). Ask a question and confirm the would-flip-distance instrumentation log lines appear in DevTools when debug is on.

**Expected:** Three labeled knobs visible only in debug mode; Malicious and Anchor-dedup ranges clamped to 0.78-0.85 in the UI; D-02 instrumentation visible in console.

**Why human:** HTML range input min/max clamping and DevTools console output require a browser. `grep`-verified min/max values are present in SettingsAIScreen.tsx; only the live rendering and input constraint need visual/interactive confirmation.

**Validation.md reference:** This is the "Threshold tuning via dev slider + console.log instrumentation" Manual-Only row in `55-VALIDATION.md`.

---

## Gaps Summary

No blocking gaps identified. All five ROADMAP success criteria are satisfied by codebase evidence:

1. **TUNE-01 (thresholds + cache):** Embed cache live in `providers/embedding/index.ts`; three per-threshold knobs replace the dead 0.65 slider; D-06 clamp in both service and UI; anchor-dedup wired to `preCheckAnchorMatch`.

2. **TUNE-01/TUNE-02 (filter correctness):** Golden-fixture corpus frozen with four cases including the buried-payload regression; `filter-classifier.unit.test.mjs` Test 18d green; dual-vector scoring untouched.

3. **TUNE-02 (like signal + weights):** `engagementService.liked[]` now drives `buildConceptBatch` multiplicity (OR-not-additive, no 4th list); `STYLE_WEIGHTS` and `trajectoryAnalyzer` constants verified-and-kept with rationale comments.

4. **TUNE-03 (refill reliability):** Dequeue-before-refill shortfall root-caused and fixed; `refill-reliability.test.mjs` reproduces the 4-post under-refill pre-fix and asserts the corrected 8-post batch post-fix; all CLAUDE.md pipeline numerics preserved.

5. **SQLite migration (D-09..D-13):** `WASMSQLiteBackend` active browser backend behind `DBBackend` seam with `LocalStorageBackend` fallback; all 13 heavy-store keys cleared on cutover; sync read API preserved; Float32 BLOB codec verified.

Two items in `55-VALIDATION.md` are explicitly documented as Manual-Only and legitimately require human observation: on-device quota relief and the threshold-knob UI. These are the `human_verification` items above.

---

_Verified: 2026-05-21_
_Verifier: Claude (gsd-verifier)_

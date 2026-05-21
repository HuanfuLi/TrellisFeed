---
phase: 55
slug: algorithm-mechanism-tuning
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-21
updated: 2026-05-21
---

# Phase 55 - Security

Per-phase security contract: threat register, accepted risks, and audit trail for Phase 55 algorithm/mechanism tuning.

---

## Audit Scope

Inputs audited:

- `.planning/phases/55-algorithm-mechanism-tuning/55-01-PLAN.md` through `55-06-PLAN.md`
- `.planning/phases/55-algorithm-mechanism-tuning/55-01-SUMMARY.md` through `55-07-SUMMARY.md`
- Current implementation files under `app/src/`
- Current focused security-relevant tests under `app/tests/`

Summary threat flags:

- No `## Threat Flags` sections were present in the Phase 55 summary files.
- `55-07-SUMMARY.md` documents a post-plan storage security/quality correction: heavy stores now use IndexedDB-only persistence plus in-memory mirrors, and the old localStorage dual-write gap is closed. This audit treats 55-07 as current implementation evidence for the older 55-05 storage threats.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry -> build | Dependencies enter the application bundle. | Package code and transitive dependencies |
| user question -> filter classifier | Untrusted learner text is embedded and classified for off-topic/malicious routing. | User-authored question content and optional prior answer context |
| settings debug panel -> threshold reads | Debug-only settings can tune security-relevant thresholds. | Off-topic, malicious, and anchor-dedup thresholds |
| settings embedding config -> embed cache | Provider/model changes affect cache validity. | Embedding provider, model, and cached vectors |
| browser -> durable app storage | Heavy learning/feed/session state persists locally. Current backend is IndexedDB, with LocalStorageBackend only as fallback. | Questions, embeddings, feed queue/cache, sessions, history, flashcards, collections, engagement, podcast metadata |
| async storage hydrate -> in-memory mirrors | Durable rows hydrate synchronous service mirrors at boot. | Local app state loaded into memory |
| like signal -> feed multiplicity | User engagement affects concept surfacing. | Liked post ids mapped to anchor ids |
| internal refill state -> feed generation | Queue size and derived-list state decide refill behavior. | Internal queue/list counters only |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-55-SC (55-01) | Tampering | `@sqlite.org/sqlite-wasm` dependency | mitigate | Direct dependency is `@sqlite.org/sqlite-wasm`; `npm ls` shows no direct `wa-sqlite`. `sql.js` is transitive via existing `@capacitor-community/sqlite`/`jeep-sqlite`, not the Phase 55 selected package. | closed |
| T-55-01 (55-01) | Information Disclosure | OPFS-backed SQLite file | accept, superseded | Original OPFS local-file risk is superseded: current `db.service.ts` uses IndexedDB as the unified browser/WebView backend and LocalStorageBackend only as fallback. Residual local-first browser storage risk is accepted for this pre-server, single-user app. | closed |
| T-55-02a | Tampering | embed cache key | mitigate | `providers/embedding/index.ts` keys the session cache on `provider:model:text`; `SettingsAIScreen.tsx` calls `clearEmbedCache()` when provider or model changes. | closed |
| T-55-02b | Spoofing | filter malicious path via cache | mitigate | Filter raw malicious scoring embeds bare `content`; prior-answer context is isolated to `contextVec`. Retrieval/pre-check use the same bare content cache path. | closed |
| T-55-02c | Information Disclosure | session embed cache Map | accept | Cache is module-memory only, session-lived, and has no persistent string cache. | closed |
| T-55-01 (55-03) | Tampering | malicious cosine threshold | mitigate | Malicious threshold is clamped to `[0.78, 0.85]` in `question-filter.service.ts:getActiveThresholds` and in the UI slider. Golden fixtures include a buried-payload malicious regression. | closed |
| T-55-03a | Elevation of Privilege | per-threshold debug knobs in release | mitigate | Services read live threshold knobs only when `embeddingDebug.debugEnabled === true`; UI renders knobs only behind the debug switch; production uses hardcoded constants. | closed |
| T-55-03b | Tampering | anchor-dedup threshold | mitigate | `preCheckAnchorMatch` clamps debug `anchorDedupThreshold` to `[0.78, 0.85]`; tests assert the constant band and clamp. | closed |
| T-55-03c | Spoofing | dual-vector buried-payload defense | mitigate | `question-filter.service.ts` keeps malicious scoring on `rawVec` and off-topic/on-topic scoring on `contextVec`; focused tests keep Test 18d green. | closed |
| T-55-04a | Denial of Service | buildConceptBatch multiplicity | mitigate | Like boost is OR-based (`isImportant || isLiked`), so worst-case multiplicity remains `BASE_ENTRIES_PER_CONCEPT * 2`, not additive. | closed |
| T-55-04b | Tampering | 3-list concept-feed pipeline | mitigate | `buildConceptBatch` does not mutate the derived list; append-only list behavior remains covered by source-reading and derived-list tests. | closed |
| T-55-SC (55-05) | Tampering | storage dependency | mitigate | Official package remains the direct Phase 55 dependency. Current active backend is IndexedDB, reducing exposure to OPFS/WASM initialization risk. | closed |
| T-55-05a | Tampering | hydrate/delete resurrection | mitigate | Heavy services hydrate from IndexedDB behind mirror-has-data guards; question deletes await `deleteFromSQLite`; boot hydration completes before first render. | closed |
| T-55-05b | Denial of Service | storage backend init failure | mitigate, superseded | OPFS-specific crash path is obsolete. Current `getDB()` uses IndexedDB when available and falls back to LocalStorageBackend if IndexedDB init fails. | closed |
| T-55-05c | Information Disclosure | local durable storage | accept | Local-first, origin-scoped browser storage is accepted pre-server. Current implementation uses IndexedDB rather than OPFS SQLite. | closed |
| T-55-05d | Tampering | stale UI after async hydrate | mitigate | Hydrate functions emit resync events, and `App.tsx` awaits `hydrateAllFromSQLite()` before first render. | closed |
| T-55-05e | Tampering | stale legacy heavy-store localStorage keys | mitigate | `LEGACY_HEAVY_KEYS` enumerates retired heavy keys; `clearLegacyHeavyLocalStorageKeys()` runs after hydration and `clearAllTables()` also sweeps them. | closed |
| T-55-06a | Denial of Service | generateMorePosts shortfall refill | accept | Internal-only feed queue logic; the fix awaits at most one refill and `_refillMutex`, `allExplored`, `bonusCap`, and walker guards bound generation. | closed |
| T-55-06b | Tampering | feed refill pipeline drift | mitigate | Shortfall fix reuses existing walker/mutex/list pipeline; no fourth list or list collapse. Refill/derived-list tests cover invariants. | closed |
| T-55-06-SC | Tampering | package installs | n/a | Plan 55-06 added no packages. | closed |

*Status: open or closed. Disposition: mitigate, accept, transfer, superseded, or n/a.*

---

## Implementation Evidence

| Evidence Area | Current Evidence |
|---------------|------------------|
| Supply chain | `app/package.json` direct dependency contains `@sqlite.org/sqlite-wasm`; `npm ls @sqlite.org/sqlite-wasm sql.js wa-sqlite --depth=3` shows `@sqlite.org/sqlite-wasm` direct, no `wa-sqlite`, and `sql.js` only transitively under `@capacitor-community/sqlite` -> `jeep-sqlite`. |
| Embed cache | `app/src/providers/embedding/index.ts` has `_embedCache`, `_djb2CacheKey`, `provider:model:text`, `clearEmbedCache`, and `getCachedEmbedding`; `app/src/screens/settings/SettingsAIScreen.tsx` invalidates on provider/model changes. |
| Filter security band | `app/src/services/question-filter.service.ts` clamps malicious threshold via `Math.min(0.85, Math.max(0.78, ...))`; `app/src/screens/settings/SettingsAIScreen.tsx` clamps the UI range. |
| Anchor dedup band | `app/src/services/canonical-knowledge.service.ts` clamps `anchorDedupThreshold`; `app/tests/services/classification-dedup.test.mjs` asserts the threshold band and pre-check order. |
| Dual-vector defense | `app/src/services/question-filter.service.ts` embeds bare `content` into `rawVec`; only `contextVec` receives prior answer prefixing; tests keep buried-payload classification malicious. |
| Like boost | `app/src/services/concept-feed.service.ts` uses `isBoosted = isImportant || isLiked` and `BASE_ENTRIES_PER_CONCEPT * 2`; `app/tests/services/like-boost.test.mjs` asserts no additive boost or derived-list mutation. |
| Storage backend | `app/src/services/db.service.ts` uses `IndexedDBBackend` as active browser/WebView backend, with `LocalStorageBackend` fallback. |
| Storage cutover | `app/src/services/db.service.ts` defines `LEGACY_HEAVY_KEYS` and `clearLegacyHeavyLocalStorageKeys()`; `app/src/App.tsx` calls it after awaited hydration. |
| Heavy-store persistence | `app/tests/services/storage-migration.test.mjs` asserts heavy-store services do not write heavy keys back to localStorage. |
| Refill guard | `app/src/services/concept-feed.service.ts` uses a shortfall refill/top-up guard; `app/tests/services/refill-reliability.test.mjs`, `derived-list.test.mjs`, `refill-queue-integration.test.mjs`, and `refill-mutex.test.mjs` cover the bounded pipeline. |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-55-01 | T-55-01 (55-01), T-55-05c | Local-first browser storage is origin-scoped and single-user for the current product stage. Current implementation uses IndexedDB rather than OPFS SQLite; no server-side multi-user confidentiality boundary is introduced in this phase. | Phase 55 plan + security audit | 2026-05-21 |
| AR-55-02 | T-55-02c | Session embed cache is memory-only and clears on reload; no arbitrary-question string cache is persisted. | Phase 55 plan + security audit | 2026-05-21 |
| AR-55-03 | T-55-06a | Refill shortfall logic is internal app state with no external input or amplification path; bounded by existing mutex/cap/exhaustion guards. | Phase 55 plan + security audit | 2026-05-21 |

*Accepted risks do not resurface in future audit runs unless the trust boundary changes.*

---

## Verification Evidence

Ran on 2026-05-21 from `app/` and re-ran during the security audit:

```bash
./node_modules/.bin/tsc -b --noEmit
node --test tests/providers/embed-cache.test.mjs tests/services/filter-classifier.unit.test.mjs tests/services/filter-golden-fixtures.test.mjs tests/services/classification-dedup.test.mjs tests/services/like-boost.test.mjs tests/services/storage-migration.test.mjs tests/services/refill-reliability.test.mjs tests/services/derived-list.test.mjs tests/services/refill-queue-integration.test.mjs tests/services/refill-mutex.test.mjs
```

Result:

- TypeScript build: clean
- Focused tests: 96 pass, 0 fail

---

## Security Audit 2026-05-21

| Metric | Count |
|--------|-------|
| Threats found | 20 |
| Closed | 20 |
| Open | 0 |
| Unregistered summary threat flags | 0 |

Re-verified against the current checkout. The existing plan-time threat register is authored and complete, every threat has a closed disposition, and no `## Threat Flags` sections were present in the Phase 55 summaries.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-21 | 20 | 20 | 0 | Codex |
| 2026-05-21 | 20 | 20 | 0 | Codex rerun |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer / superseded / n/a)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-21

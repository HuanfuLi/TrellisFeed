---
phase: 2
slug: content-pool-feed-post-ui-on-frozen-data
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-11
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` with `assert/strict`; executable IndexedDB coverage through `fake-indexeddb` added in Wave 0 |
| **Config file** | `app/package.json` and `research-backend/package.json`; `tools/content_pipeline/package.json` is created in Wave 0 |
| **Quick run command** | `cd app && node --test tests/services/content-pool.import.test.mjs tests/services/frozen-feed.service.test.mjs tests/services/post-qa.service.test.mjs` |
| **Full suite command** | `npm --prefix app test && npm --prefix app run lint && npm --prefix app run build && npm --prefix research-backend test && npm --prefix tools/content_pipeline test && python evals/phase-2/test_phoenix_local.py && npm --prefix evals/phase-2 ci --ignore-scripts && npm --prefix evals/phase-2 exec -- promptfoo eval -c promptfooconfig.yaml --no-cache` |
| **Estimated runtime** | quick loop under 30 seconds; full gate under 10 minutes excluding device UAT and live operator curation |

---

## Sampling Rate

- **After every task commit:** Run the narrowest affected `node --test` file(s), capped at 30 seconds.
- **After every plan wave:** Run the complete automated suite for every package changed in that wave.
- **After Plan 02-03 Task 3 and again at the Phase 2 release gate:** Run `python evals/phase-2/test_phoenix_local.py`; it is a stdlib/mocked test and must perform no install, server launch, or network access.
- **Before `/gsd-verify-work`:** App tests, lint, build, research-backend tests, and content-pipeline tests must be green.
- **Max feedback latency:** 30 seconds per task-level sample.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-T1/T2/T3 | 02-01 | 0 | CONT-01 | malformed bundle / drift | Cross-platform harness plus exact schemas and aggregate references fail closed | contract | `npm --prefix tools/content_pipeline test -- test/schema.test.mjs && node --test app/tests/services/content-pool.schema.test.mjs` | planned W0 | ⬜ pending execution |
| 02-02-T1/T2/T3 | 02-02 | 1 | CONT-02 | SSRF / XSS / supply chain | Safe collection, exact parser pins, inert extraction, deterministic dedupe/quality | unit + integration | `npm --prefix tools/content_pipeline test -- test/collector.test.mjs test/dedupe.test.mjs test/quality.test.mjs` | scaffold in 02-01 | ⬜ pending execution |
| 02-03-T1/T2/T3 | 02-03 | 2 | CONT-02 | prompt injection / AI approval / dependency or exporter drift | Validated preprocessing, advisory-only Codex, exact Python pins with fail-closed CLI exit/stdout diagnostics, opt-in loopback-only Phoenix/no hosted exporter, pinned offline eval | unit + Python contract + eval | `npm --prefix tools/content_pipeline test -- test/ai-preprocess.test.mjs test/codex-gate.test.mjs && python evals/phase-2/test_phoenix_local.py && npm --prefix evals/phase-2 ci --ignore-scripts && npm --prefix evals/phase-2 exec -- promptfoo eval -c promptfooconfig.yaml --no-cache` | scaffold/eval/Python test files planned | ⬜ pending execution |
| 02-04-T1/T2/T3 | 02-04 | 3 | CONT-02, CONT-03 | CSRF / tamper / gate bypass | Local review remains two-gate; immutable freeze verifies exact artifact | integration + human gate | `npm --prefix tools/content_pipeline test -- test/review.test.mjs test/freeze.test.mjs` | freeze scaffold in 02-01 | ⬜ pending execution |
| 02-05-T1/T2/T3 | 02-05 | 1 | CONT-03 | partial import / remote acquisition | Fixture-injected staged importer exposes only ready versions; production adapter stays fail closed | persistence | `node --test app/tests/services/content-pool.import.test.mjs` | scaffold in 02-01 | ⬜ pending execution |
| 02-06-T1/T2 | 02-06 | 2 | FEED-01, FEED-02 | condition leakage / mutation | Deterministic condition-blind selectors and immutable-ID engagement/history | service | `node --test app/tests/services/frozen-feed.service.test.mjs app/tests/services/suggested-questions.test.mjs app/tests/services/engagement.service.test.mjs app/tests/screens/SavedScreen.test.mjs` | scaffolds in 02-01 | ⬜ pending execution |
| 02-07-T1/T2/T3 | 02-07 | 3 | FEED-01, FEED-02 | XSS / remote fetch / malformed targets | Frozen UI renders inert originals and schema-backed suggestions in both conditions | component + screen | `node --test app/tests/components/FeedCard.test.mjs app/tests/components/OriginalContent.test.mjs app/tests/screens/HomeScreen.frozen-feed.test.mjs app/tests/screens/PostDetailScreen.frozen-content.test.mjs app/tests/screens/PostDetailScreen.suggested-questions.test.mjs` | scaffolds in 02-01 | ⬜ pending execution |
| 02-08-T1/T2/T3 | 02-08 | 2 | ASK-01 | malicious input / cross-post / replay | Raw gate precedes model/write; same-post condition parity; canonical idempotent upload | service + backend | `node --test app/tests/services/post-qa.service.test.mjs app/tests/services/post-qa.condition-parity.test.mjs && npm --prefix research-backend test` | app/backend scaffolds in 02-01 | ⬜ pending execution |
| 02-09-T1/T2/T3 | 02-09 | 4 | CONT-01, CONT-02, CONT-03, FEED-01, FEED-02, ASK-01 | packaging omission / retired-shell residue / dependency drift | Generated projection is hash-complete in web/native assets; Phoenix local-safety contract and full gates pass before native UAT | release + Python contract + UAT | `python evals/phase-2/test_phoenix_local.py && node --test app/tests/phase2/frozen-cutover.test.mjs && npm --prefix app run build && npm --prefix app exec -- cap sync` | Phoenix test planned in 02-03; cutover test/UAT scaffold in 02-01 | ⬜ pending execution |

*`nyquist_compliant: true` means the plan now assigns every task to executable evidence and creates missing scaffolds before implementation. `wave_0_complete: false` remains accurate until 02-01 is executed and those files/commands exist and have been sampled.*

---

## Wave 0 Requirements

- [ ] Repair the cross-platform `app/package.json` test command and rebaseline the six pre-existing failures without weakening their assertions.
- [ ] Add `fake-indexeddb` and executable IndexedDB fixtures through the `dbQuery`/repository seam.
- [ ] Add `tools/content_pipeline/package.json` plus executable contract scaffolds for `test/{schema,collector,dedupe,quality,ai-preprocess,codex-gate,review,freeze}.test.mjs` before downstream implementation.
- [ ] Add `app/tests/services/{content-pool.schema,content-pool.import,frozen-feed,suggested-questions,post-qa,post-qa.condition-parity}.test.mjs`.
- [ ] Add FeedCard/OriginalContent, Home/PostDetail, and final cutover test scaffolds for frozen content, suggestions, navigation, reviewed-digest/player fallbacks, and packaging inventory.
- [ ] Add research-backend migration, DTO validation, idempotent upload, and export-field coverage for canonical Q&A records.
- [ ] Add a native UAT checklist covering packaged import, offline cold start/restart, selected YouTube playback/error paths, and both study conditions.
- [ ] Plan 02-03 adds `evals/phase-2/test_phoenix_local.py`; its fake version/import/environment seams invoke the real CLI/main and assert exact exit codes, complete stdout, and empty stderr for `arize-phoenix==17.26.0` and `opentelemetry-sdk==1.43.0`, missing/mismatched failure diagnostics, explicit opt-in, loopback-only binding, disabled telemetry, no hosted/OTLP exporter, and zero network egress.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Operator approves/rejects the pilot pool and records the two-gate audit | CONT-02, CONT-03 | Human approval is the gate of record and needs real candidate content | Run the local review UI on the 100–150 candidate set; confirm every frozen record has a Codex verdict and explicit operator decision; verify approximately 50 approved posts are exported. |
| Packaged pool works fully offline across reinstall/restart | CONT-03, FEED-01 | Capacitor asset packaging, quota, and WebView behavior are platform-specific | Install clean builds on Android and iOS, disable network, launch/import/browse article posts, restart, and confirm the same pinned pool/version remains available. |
| YouTube embed, error 153/origin behavior, and reviewed-digest fallback | FEED-01 | Requires real Android/iOS WebViews and network/offline transitions | Open selected videos online and offline on both platforms; verify playback/progress when available and frozen digest/summary + source link on failure. |
| Post-scoped Q&A parity in both conditions | ASK-01 | Final UX/model behavior and persistence across native restart need participant-runtime observation | Ask identical initial/follow-up questions in control and experimental modes; compare prompt/model/answer quality, restart, and confirm canonical thread recovery. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or an explicit Wave 0 dependency.
- [x] Sampling continuity: no 3 consecutive tasks lack automated verification.
- [x] Wave 0 plans all missing references; `wave_0_complete` stays false until execution.
- [x] No watch-mode flags.
- [x] Planned task-level samples target feedback under 30 seconds.
- [x] All six phase requirement IDs map to automated evidence plus justified manual evidence.
- [x] `nyquist_compliant: true` is set because final plans assign every task ID/wave/command; execution completion remains false until Wave 0 runs.

**Approval:** planning-complete; execution evidence pending

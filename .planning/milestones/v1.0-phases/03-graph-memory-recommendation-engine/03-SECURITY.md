---
phase: 03
slug: graph-memory-recommendation-engine
status: verified
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: 2026-07-18
verified: 2026-07-18
---

# Phase 03 — Security

> Per-phase security contract for the graph-memory and recommendation-engine implementation. This ASVS L1 audit verifies the 25 threats registered in the eight Phase 3 plans; it is not a fresh, unbounded penetration test.

---

## Trust Boundaries

| Boundary | Description | Data crossing |
|----------|-------------|---------------|
| Preprocessed content → frozen artifacts → participant storage | Untrusted preprocessing output becomes immutable graph/ranking input and crosses into IndexedDB. | Public curated metadata, graph edges, ranking features, hashes. |
| Interaction log → personal graph-memory | Canonical participant events become derived personal ranking state. | Allowlisted event IDs, concept IDs, bounded weights, timestamps. |
| Participant question → extraction LLM → canonical records | Untrusted user text and model JSON cross into durable Q/A and graph contributions. | Question text, frozen concept/claim IDs, extraction status. |
| Study condition → ranker/recommendation batch | The control path must remain unable to consume personal question history. | Immutable condition, frozen features, experimental-only personal snapshot. |
| Question traces → reason LLM → participant UI | Untrusted participant text and model prose become persisted reason text. | Bracketed traces, candidate IDs, validated plain-text reasons. |
| UI exposure → research log/backend | Feed and reason-view observations become exported study data. | Allowlisted post/recommendation IDs; no content payload. |
| IndexedDB v6 → v7 | A destructive schema upgrade removes retired stores while participant data must survive. | Local frozen, research, Q/A, graph-memory, recommendation, and engagement rows. |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation / evidence | Status |
|-----------|----------|-----------|----------|-------------|-----------------------|--------|
| T-03-01 | Tampering | Frozen graph/ranking artifacts | high | mitigate | `freeze/build.ts` binds immutable files into SHA-256 hashes; `freeze/verify.ts` and `freeze-graph-artifacts.test.mjs` reject checksum, endpoint-kind, dangling, and cross-topic tampering. | closed |
| T-03-02 | Spoofing | Label-to-ID resolution | medium | mitigate | `graph/build.ts` resolves only reviewed topic labels/aliases and emits unresolved warnings instead of minting relation IDs; compiler tests cover deterministic resolution. | closed |
| T-03-03 | Information disclosure | Frozen artifacts | low | accept | Artifacts are built before participant use and contain curated public-content metadata only; no participant data crosses this boundary. | closed |
| T-03-04 | Tampering | Graph artifact import | high | mitigate | `content-pool-bundle.ts` and `content-pool.repository.ts` enforce hashes, version, unique IDs, endpoint kinds, topic ownership, and `POOL_INVALID` before the ready marker; import tests exercise a hash-valid dangling edge. | closed |
| T-03-05 | Denial of service | IndexedDB upgrade | medium | mitigate | `db.service.ts` creates missing stores idempotently in both backends; `storage-namespace.test.mjs` executes fallback parity and v6→v7 survivor retention. | closed |
| T-03-06 | Information disclosure | User-data tables | medium | mitigate | Phase 3 stores start empty, are included in Clear All Data, and are written only through the allowlisted graph/extraction/recommendation services and research wire contract. | closed |
| T-03-07 | Tampering | Contribution retry/crash | high | mitigate | `graph-memory.service.ts` uses stable event/concept/rule keys, `INSERT OR REPLACE`, serialized mutation, and full-ledger folds; durability tests prove retry and replay convergence through `dbQuery`. | closed |
| T-03-08 | Information disclosure | Control path personal-state access | high | mitigate | The control input type contains no personal fields; `recommendation.service.test.mjs` uses a throwing personal-loader spy and byte-equal results across different histories. | closed |
| T-03-09 | Repudiation | Derived-state divergence | medium | mitigate | `replayFromLog` and `repairOnBoot` reconstruct contributions and snapshots from canonical `research_records`; replay tests prove byte-identical state. | closed |
| T-03-10 | Information disclosure | Control ranker | high | mitigate | `ControlRankerInputKeysAreExact` closes the input shape; source guards and the service-level throwing-spy test prove the control branch never dereferences personal stores. | closed |
| T-03-11 | Tampering | Cross-model cosine | medium | mitigate | Vector scoring requires matching embedding fingerprints, renormalizes remaining subweights when unavailable, and is bounded by ranking component/property tests. | closed |
| T-03-12 | Elevation of privilege | Caller-supplied condition/weights | medium | mitigate | The service obtains the immutable condition through `studyContextService.getRequired()` and injects validated recommendation config; callers do not choose the branch or weights. | closed |
| T-03-13 | Tampering | Question prompt injection | high | mitigate | `question-extraction.service.ts` applies user-content bracketing, explicit untrusted-data instructions, JSON mode, strict parsing, and a frozen-ID allowlist before persistence; adversarial tests cover the boundary. | closed |
| T-03-14 | Tampering | Unknown/cross-topic extraction IDs | high | mitigate | Extraction candidate resolution validates IDs against same-topic repository sets and rejects unknown or ambiguous results before canonical update or graph application. | closed |
| T-03-15 | Tampering | Extraction retry double-apply | medium | mitigate | Durable job status transitions plus stable graph contribution keys make restart/retry idempotent; extraction and graph-memory tests cover resume and duplicate processing. | closed |
| T-03-16 | Information disclosure | Extraction fields on wire | medium | mitigate | `research-wire-contract.ts` and backend validation use exact field allowlists; tests reject arbitrary/prohibited fields and cover only the four Phase 3 extraction fields. | closed |
| T-03-17 | Information disclosure | Condition branch | high | mitigate | `recommendation.service.ts` branches on immutable study condition before personal loading; §12.3 control-isolation tests throw on any personal-store access. | closed |
| T-03-18 | Tampering | Reason prompt injection | high | mitigate | Participant traces are bracketed; reason generation uses JSON mode, requested-candidate ID validation, bounded retries, and deterministic per-item fallback on invalid output/config/provider failure. | closed |
| T-03-19 | Information disclosure | Reason text | medium | mitigate | `isValidReasonText` rejects control characters and internal score/weight leakage; prompts prohibit creepy inference and deterministic templates are score-free; invalid-reason tests cover fallback. | closed |
| T-03-20 | Tampering | Served-batch integrity | high | mitigate | Repository writes a `building` ledger first and exposes only fully persisted `ready` batches with exact recommendation IDs/reasons; service tests assert recovery and durable rows through `dbQuery`. | closed |
| T-03-21 | Tampering (XSS) | Reason rendering | high | mitigate | `FeedCard.tsx` renders `reasonText` as a React text node only; hostile-markup tests verify escaped output and prohibit HTML/Markdown renderers. | closed |
| T-03-22 | Information disclosure | Impression events | low | accept | `feed_impression` is deliberately limited to allowlisted `postId` and `recommendationId`; no position, content, arbitrary payload, or prohibited §14.2 category is recorded. | closed |
| T-03-23 | Repudiation | Impression duplication/omission | medium | mitigate | Home keeps a per-session recommendation-ID set before async logging; executable screen tests prove once-per-exposure events carry both IDs. | closed |
| T-03-24 | Denial of service / data loss | IndexedDB store retirement | high | mitigate | `RETIRED_TABLE_NAMES` names only `posts`, `post_queue`, and `sessions`; v6→v7 migration tests seed every survivor and prove all survivor rows remain queryable. | closed |
| T-03-25 | Tampering | False-green recommendation tests | medium | mitigate | Retired source-string pinning was replaced with executable recommendation, frozen-content, backend-parity, and migration contracts; Phase verification reran 588 app, 82 pipeline, and 30 backend tests. | closed |

*Status vocabulary: `closed` means the planned mitigation was found or the plan-time accepted risk was documented. Only open threats at or above the configured `high` threshold count toward `threats_open`.*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-03 | Frozen graph artifacts contain only curated public-source metadata and no participant-derived data; further confidentiality controls would not reduce participant risk. | Phase 3 plan-time risk decision | 2026-07-18 |
| AR-03-02 | T-03-22 | Minimal impression identifiers are necessary study telemetry and remain inside the approved event allowlist; content, position, and arbitrary payloads are excluded. | Phase 3 plan-time risk decision | 2026-07-18 |

---

## Non-blocking Security Observations Outside the Plan Register

The authored threat register is complete for this ASVS L1 workflow, so secure-phase verifies registered controls rather than discovering new threats. The existing `03-REVIEW.md` nevertheless records lower-severity hardening observations that are not represented as open registered threats:

- Backend ingest ownership uses a check-then-batch pattern with a low-likelihood TOCTOU window under deliberately colliding record IDs.
- Ranking currently relies on the upstream frozen-feed dismissal filter rather than independently populating the ranker's defense-in-depth dismissal set.
- `video_progress.durationMs` is validated as non-negative elapsed milliseconds but the generic field name remains semantically overloaded across event types.

These observations are below the configured `high` blocking threshold and do not change `threats_open`; they should remain visible for later hardening instead of being described as resolved.

---

## Security Audit 2026-07-18

| Metric | Count |
|--------|-------|
| Threats found in plan-time register | 25 |
| Closed by verified mitigation | 23 |
| Closed by documented acceptance | 2 |
| Open at or above `high` threshold | 0 |

ASVS L1 short-circuit applied: the register was authored at plan time and preliminary implementation/test inspection found no open registered threat. Per the secure-phase workflow, no deeper L2/L3 auditor was required.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-18 | 25 | 25 | 0 | Codex secure-phase (ASVS L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-18

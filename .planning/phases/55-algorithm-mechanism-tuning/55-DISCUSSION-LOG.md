# Phase 55: Algorithm & Mechanism Tuning - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 55-algorithm-mechanism-tuning
**Areas discussed:** Evidence bar, Threshold source, Embedding cache → Storage migration, Signal mechanisms

---

## Evidence Bar / Tuning Methodology

| Option | Description | Selected |
|--------|-------------|----------|
| Golden-set fixtures | Labeled corpora, assert classifications at chosen thresholds | |
| Documented band + tests | Pick value, rationale comment, assert in a sane band | |
| Fixtures for filter, docs elsewhere | Golden fixtures for the security-sensitive filter, documented-band for the rest | |
| **Other (free text)** | **"Can we make telemetry first to actually test and tune the values?"** → resolved to browser-based instrumentation | ✓ |

**User's choice:** Free text — telemetry first; then refined to "test and tune in the web browser with console.log capture, since the algorithm is platform-agnostic."
**Notes:** Device telemetry rejected (local-first, no backend, privacy stance). Landed on dev-gated `console.log` instrumentation in the browser → tune → freeze interesting cases as golden fixtures (the durable bar). Tuning targets are pure platform-agnostic TS, so browser fidelity == device.

---

## Threshold Source-of-Truth

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded constants | Documented constants w/ rationale; remove dead settings slider | |
| Settings-driven | Wire constants to read from settings.embeddingDebug (live-tunable) | |
| Hybrid: const default + dev override | Const default; settings override behind a dev gate | (effectively) |
| **Other (free text)** | **"Slider is debug-only, hide on release. Settings-driven to test at runtime, then hardcode + hide slider when finalized."** | ✓ |

**User's choice:** Free text — settings-driven during tuning, then bake into hardcoded constant and hide the debug slider in release.
**Notes:** Surfaced the live 0.82-hardcoded vs 0.65-settings discrepancy. Captured: per-threshold debug knobs (off-topic/malicious/anchor-dedup), malicious clamped to the 0.78–0.85 band even in debug.

---

## Embedding Cache → Storage Migration

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory only | Session Map cache | |
| localStorage-persistent | Survives reload; quota + stale-vector risk | |
| In-memory + pipeline hand-off | Cache + reuse ask-path vector in classify | ✓ (cache) |

**User's choice:** In-memory + pipeline hand-off for the query embed — after a clarifying exchange ("aren't embeddings already in the DB?") established the corpus vectors already persist and only the in-flight query embed is wasteful.
**Notes:** User then raised a scaling concern (big mindmap, long timespan, large AIGC images) and **chose to fold a whole-store migration to SQLite-primary into this phase** rather than defer it (v1.7 = sweep deferred ideas). Sub-decisions:
- **Migration fork:** "Whole store to SQLite-primary" (over vectors-only). Driver: localStorage quota hit repeatedly in dev; text stores (questions+vectors, post caches, sessions) are the offenders (images/audio already in IndexedDB); web SQLite double-stores in localStorage.
- **Web backend:** "Browser gets large-capacity store too" (over device-only-SQLite or IndexedDB-everywhere). Driver: operator's quota pain is in the browser, so web must escape localStorage too (WASM SQLite / IndexedDB-backed).
- **Data migration:** "Clean cutover (pre-release)" (over preserve-existing-data). No migration code; fresh init + clear old keys.

---

## Signal Mechanisms

| Option | Description | Selected |
|--------|-------------|----------|
| Boost that concept | Like raises the concept's multiplicity in the derived list | ✓ |
| Boost similar concepts | Like spreads to embedding-neighbors | |
| Just save, no feed effect | Like = bookmark only, inert in feed | |

**User's choice:** Boost that concept (via the existing derived-list multiplicity lever; tunable magnitude/decay; must not starve due-for-review concepts).

| Option | Description | Selected |
|--------|-------------|----------|
| Verify-and-keep, re-tune only if data shows | Trust current operator-tuned values; instrument + test; change only on observed drift | ✓ |
| Active re-balance pass | Deliberately revisit style-mix + recommendation weights | |

**User's choice:** Verify-and-keep for feed `STYLE_WEIGHTS` + recommendation weights.

---

## Claude's Discretion

- Dev-flag gating mechanism for instrumentation.
- Which lightweight KV prefs stay in localStorage vs migrate.
- Browser backend mechanism (WASM SQLite/sql.js vs IndexedDB shim) — deferred to research.
- Boot-hydration gate to avoid empty-state flash.
- Golden-fixture corpus contents/size; cache key hashing scheme.

## Deferred Ideas

None new — the storage migration that surfaced was folded into this phase per the v1.7 fold-not-defer stance. Pre-existing deferrals (Phase 56 polish/docs, Rewards 57–59, REWARDS-F1/F2/F3) remain locked in REQUIREMENTS.md, not re-opened.

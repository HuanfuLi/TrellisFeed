# Phase 55: Algorithm & Mechanism Tuning - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the app's numeric thresholds and signal-driven mechanisms behave as intended, tuned with documented, test-backed rationale instead of guesswork (TUNE-01, TUNE-02). **Scope expanded during discussion:** the operator folded a whole-store **storage-layer migration to SQLite-primary** into this phase (see D-09..D-13), because the localStorage quota is already a live blocker in dev and v1.7 is a "sweep deferred ideas, don't accumulate new ones" milestone.

**In scope:**
- Review + tune the three cosine thresholds (off-topic, malicious, anchor-dedup) with documented rationale; resolve the folded cosine-threshold/cache-miss todo.
- Exercise the filter (off-topic / on-topic / malicious) against expected behavior without re-opening the buried-payload evasion surface.
- Test + tune the recommendation, feed-randomizer, and "like"-signal mechanisms; every tuned constant gets a rationale comment.
- In-memory embedding query cache + pipeline hand-off (dedup the in-flight query embed).
- Whole-store migration off localStorage to a SQLite-primary backend (device) with a large-capacity browser equivalent.

**Out of scope (still genuinely deferred — locked in REQUIREMENTS.md):**
- UI polish / animations / navigation audit / doc archiving / CLAUDE.md drift → **Phase 56**.
- Rewards shop (Phases 57–59).
- REWARDS-F1/F2/F3 v2 deferrals.

</domain>

<decisions>
## Implementation Decisions

### Evidence Bar / Tuning Methodology (TUNE-01, TUNE-02)
- **D-01:** Tune in the **web browser dev environment**, not on device. The tuning targets (cosine math, threshold comparisons, `STYLE_WEIGHTS` distribution, like-signal aggregation) are pure platform-agnostic TS — they run byte-identically in `npm run dev` and Android WebView. Device-only concerns (CapacitorHttp streaming, TTS, audio) are not what's being tuned.
- **D-02:** Instrument the decision points with **dev-gated `console.log`** output: cosine score, chosen label, active threshold, "would-flip distance" (how close the score was to the nearest threshold), realized feed style mix vs target, and like/unlike events. Gated behind a dev flag (or stripped) so it does not ship log noise.
- **D-03:** The **durable evidence bar is golden-set fixtures**: capture interesting real cases from the browser instrumentation and **freeze them as labeled fixtures** (`node --test`) so the tuned values stay regression-tested. Tuning = pick the value that behaves correctly on the captured cases; the fixtures are the permanent guard.

### Threshold Source-of-Truth (TUNE-01)
- **D-04:** **Settings-driven at runtime during tuning → finalize to hardcoded constant + hide the debug control in release.** The `settings.embeddingDebug` slider was always a debug-only affordance; it must be hidden from released/production users. During this phase the operator drives values live via settings to test; once a value is locked, bake it into the hardcoded constant (the documented-constant pattern) and hide the slider.
- **D-05:** Resolve the live discrepancy: `ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD = 0.82` is hardcoded and silently ignores `settings.embeddingDebug.similarityThreshold = 0.65`. The debug panel must expose a **labeled knob per threshold** (off-topic `0.75`, malicious `0.82`, anchor-dedup `0.82`) — the single 0.65 slider does not map to any of them.
- **D-06:** The **malicious threshold stays clamped to the 0.78–0.85 band even in debug**, so the operator cannot accidentally validate a detuned value that re-opens the dual-vector buried-payload evasion surface (load-bearing — see Question filter section of CLAUDE.md).

### Embedding Query Cache + Pipeline Hand-off (TUNE-01, folded todo)
- **D-07:** Add an **in-memory cache** (Map keyed on `hash(text + model id)`, session-lived) for `embedText`, **plus pipeline hand-off**: embed the bare `content` of the current question **once** and reuse the vector across the filter (`question-filter.service.ts`), retrieval (`question.service.ts`), and the classify pre-check (`canonical-knowledge.service.ts`). This kills the known 2–3× duplicate embed of the current query within a single ask.
- **D-08:** **Do not** add a persistent embedding cache for arbitrary strings — the corpus anchor/QA `embeddingVector`s already persist on records and are reused for cosine; the waste was only the transient in-flight query embed.

### Storage-Layer Migration to SQLite-primary (folded into this phase)
- **D-09:** **Migrate the whole store to SQLite-primary** (not vectors-only). The operator has hit the localStorage quota repeatedly in dev. The big binaries (AIGC images, podcast audio) are already in **IndexedDB** — the localStorage offenders are the **text stores**: `trellis_questions` (embedding vectors ~18 KB each as JSON), the post caches (`trellis_daily_posts`, `trellis_post_history`, `trellis_news_posts`, `trellis_video_cache`, Tavily snippets), and `trellis_sessions`. On web, the `db.service` SQLite write-through *also* falls back to localStorage, double-storing questions in dev — the direct cause of the operator's quota hits.
- **D-10:** **The browser/dev environment must escape localStorage too** — not just device. Native SQLite is device-only; the browser needs a large-capacity backend (e.g. WASM SQLite / sql.js persisted to IndexedDB, or an IndexedDB-backed db layer). Exact mechanism is research/planning territory. "Device-only SQLite, web stays localStorage" was explicitly rejected because the operator's pain is in the browser.
- **D-11:** **Clean cutover — no migration code.** The app is pre-release with no real users whose data must survive. On upgrade, initialize the new SQLite store fresh and clear the old localStorage keys. No one-time/idempotent/versioned migration, no legacy-shape handling. Dev data is disposable.
- **D-12 (LOCKED INVARIANT):** **The synchronous service-read API MUST be preserved.** Keep an in-memory mirror hydrated on boot + async write-through to SQLite. Always-mounted screens and every `getSync()` caller read synchronously today; making reads async would ripple through the entire UI and is out of bounds. This is the inverse of today's "localStorage primary + SQLite cold backup" — SQLite becomes the durable store, the in-memory mirror stays the runtime read path. Preserve the existing delete-guard semantics (no resurrecting deleted rows on hydrate).
- **D-13:** Store embedding vectors as **`Float32` BLOB** in SQLite (~6 KB binary vs ~18 KB JSON, ~3× smaller) rather than JSON arrays.

### Signal Mechanisms (TUNE-02)
- **D-14:** A **"like" boosts the concept's multiplicity in the derived list** — the same lever the existing importance/overdue doubling uses (`BASE_ENTRIES_PER_CONCEPT` 4→8). It must **not invent a new list** (the 3-list concept-feed pipeline is load-bearing — see CLAUDE.md). Boost magnitude + decay are tunable via the browser instrumentation; test that liked concepts surface more **without starving due-for-review concepts**.
- **D-15:** Feed `STYLE_WEIGHTS` and recommendation (`trajectoryAnalyzer`) weights are **verify-and-keep**: they are already operator-tuned with rationale comments. Add behavior tests + instrument the realized mix, and only change a constant if the instrumentation reveals real drift. Every value keeps/gets a rationale comment.

### Claude's Discretion
- Exact severity of the dev-flag gating for instrumentation (env check vs settings flag).
- Which lightweight KV prefs stay in localStorage vs migrate (e.g. `trellis_settings`, `trellis_fruit_credits`, `trellis_dev_mode`, scheduler flags — tiny, boot-critical for no-FOUC theme; default: keep tiny prefs in localStorage, migrate heavy/growing stores).
- Browser backend mechanism (WASM SQLite/sql.js vs IndexedDB shim) — defer to research.
- Boot-hydration gate to avoid an empty-state flash on async hydrate.
- Golden-fixture corpus contents and size.
- Cache key hashing scheme.

### Folded Todos
- **`2026-05-07-fix-cosine-similarity-threshold-cache-miss`** (`.planning/todos/pending/2026-05-07-fix-cosine-similarity-threshold-cache-miss.md`, `resolves_phase: 55`): parameterize the hardcoded `ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD` and add an embedding cache. Maps to **D-04/D-05** (threshold source-of-truth) + **D-07/D-08** (in-memory cache + hand-off). Note its part-2 "localStorage-backed cache" suggestion is superseded by D-08 (no persistent string cache) and the D-09 storage migration.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 55" — goal, success criteria (note: a storage-migration success-criterion should be added when planning, per the folded scope)
- `.planning/REQUIREMENTS.md` — TUNE-01, TUNE-02 wording

### Thresholds & filter (TUNE-01)
- `app/src/services/question-filter.service.ts` — `OFF_TOPIC_SIMILARITY_THRESHOLD = 0.75`, `MALICIOUS_SIMILARITY_THRESHOLD = 0.82`, dual-vector scoring (`layer2Embedding`)
- `app/src/services/canonical-knowledge.service.ts` — `ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD = 0.82`, `preCheckAnchorMatch`, opportunistic backfill, `embeddingVector` reuse
- `app/src/services/settings.service.ts` + `app/src/types/index.ts` — `embeddingDebug.similarityThreshold = 0.65` (the dead/debug slider to repurpose then hide)
- `CLAUDE.md` §"Question filter — dual-vector scoring" — the buried-payload evasion surface that D-06 must not re-open
- `CLAUDE.md` §"Classification dedup — embedding pre-check" — the 0.78–0.85 empirical band

### Embedding cache + storage migration
- `app/src/providers/embedding/index.ts` — `embedText`, `cosine`; where the in-memory cache lands (D-07)
- `app/src/services/question.service.ts` — localStorage-primary (`trellis_questions`) + SQLite write-through/cold-backup + delete-guard semantics (D-12); `embedText` call sites
- `app/src/services/db.service.ts` — `DBBackend` abstraction, `echolearn` SQLite connection, the localStorage web-fallback (D-10's target)
- `app/src/services/imageGeneration.service.ts` — existing IndexedDB binary store + 30-day TTL + LRU cap (pattern precedent for D-10)
- `app/src/services/podcast.service.ts` — existing IndexedDB audio store (`trellis_audio`)
- `.planning/codebase/CONCERNS.md` — hybrid SQLite/localStorage data-drift + localStorage quota risk

### Signal mechanisms (TUNE-02)
- `app/src/services/engagement.service.ts` — `likePost`/`liked[]` ("recommendation signal — NOT displayed"); `ENGAGEMENT_CHANGED` events
- `app/src/services/post-queue.service.ts` — derived-list multiplicity (`BASE_ENTRIES_PER_CONCEPT`, importance doubling) — the lever D-14 hooks into
- `app/src/services/style-assignment.ts` — `STYLE_WEIGHTS` + stratified largest-remainder/Fisher-Yates
- `app/src/services/trajectoryAnalyzer.service.ts` — `aggregateSignals` recommendation weights (`trellis_trajectory_signals` cache)
- `CLAUDE.md` §"Concept Feed Generation Pipeline" — the load-bearing 3-list pipeline D-14 must not drift

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- IndexedDB binary-store pattern in `imageGeneration.service.ts` / `podcast.service.ts` — precedent for the browser large-capacity backend (D-10).
- `DBBackend` abstraction in `db.service.ts` — the seam where the browser backend swap happens.
- Derived-list importance/multiplicity doubling in `post-queue.service.ts` — the existing lever for the like-boost (D-14), no new mechanism needed.
- Opportunistic anchor-vector backfill in `canonical-knowledge.service.ts` — already lazily re-embeds missing vectors; relevant if a model change invalidates BLOBs.

### Established Patterns
- localStorage-primary + SQLite cold-backup with explicit delete-guards (don't resurrect deleted rows on hydrate) — D-12 inverts the primary but must preserve the guard.
- `settingsService.getSync()` synchronous reads everywhere — the reason D-12 keeps an in-memory mirror.
- Always-mounted screens re-read service state via `[location.pathname]` effects — async hydration must not regress this (boot-hydration gate).
- Documented-constant-with-rationale-comment is the existing tuning style (CLAUDE.md threshold sections) — D-04's finalize target.

### Integration Points
- `embedText` (filter + retrieval + classify pre-check) — the three call sites the hand-off (D-07) unifies.
- `db.service.ts` web fallback — replace localStorage with the large-capacity browser backend (D-10).
- `engagementService.likePost` → derived-list multiplicity in `post-queue.service.ts` (D-14).

</code_context>

<specifics>
## Specific Ideas

- Operator hits the localStorage quota **in dev/debugging, not just hypothetically** — the migration is solving a live blocker, so the browser environment is a first-class target (D-10), not an afterthought.
- Tuning happens by the operator **driving values live via the debug slider in the browser** and watching `console.log` instrumentation — then locking the value and hiding the control (D-02/D-04).
- v1.7 is a **"sweep deferred ideas, don't accumulate new ones"** milestone — which is why the migration was folded rather than deferred (see auto-memory `project_v17_fold_not_defer`).

</specifics>

<deferred>
## Deferred Ideas

None — per the v1.7 fold-not-defer stance, the storage migration that surfaced mid-discussion was folded into this phase rather than deferred. Genuinely-deferred items (Phase 56 polish/docs, Rewards 57–59, REWARDS-F1/F2/F3) remain locked in REQUIREMENTS.md and were not re-opened here.

</deferred>

---

*Phase: 55-algorithm-mechanism-tuning*
*Context gathered: 2026-05-21*

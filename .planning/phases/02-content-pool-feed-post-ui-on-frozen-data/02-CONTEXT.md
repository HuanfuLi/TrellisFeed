# Phase 2: Content pool + feed/post UI on frozen data - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the temporary AI-generated feed shell entirely with a real, frozen, curated content pool: RSD §9 domain schemas field-for-field, an offline `tools/content_pipeline/` that turns raw URL candidates into human-approved posts, an immutable versioned export at `data/content_pool_v1/` for one pilot topic (~50 approved posts), and feed home + post detail rendering that pool with the AI wrapper (hook, summary, concept tags), embedded originals, pre-generated suggested questions, and post-scoped Ask working identically in both conditions with UserQuestion + AIAnswer persisted. Participant runtime never searches for or selects remote content; the sole live-content exception is user-triggered Gemini understanding of the already-frozen post's fixed public YouTube URL. No ranking/personalization — that is Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Pilot topic & sources
- **D-01:** The pilot pool topic is **AI agents & future work** (RSD §6.3 candidate #1 — the design doc's running example for suggested questions, prompts, and orchestration strategies).
- **D-02:** Source mix is **text-heavy + some video**: roughly 70% articles/blog/Substack/newsletter/news-explainer content, 30% YouTube — enough video to exercise embeds and `video_progress` logging without doubling the extraction surface.
- **D-03:** Content skews **mostly evergreen** (explainers, concept pieces, viewpoint essays that stay valid for months; few dated news items) so the frozen pool survives the pilot→main-study gap without recollection.
- **D-04:** Collect **~100–150 raw candidates** (2–3× the ~50 approval target) — enough slack for dedupe/quality rejection while keeping review effort bounded.

### Original content display
- **D-05:** Originals are **embedded in-app**: YouTube via embedded player; articles rendered in-app from extracted text stored in the frozen pool. The original source link is always displayed (and `source_click` logged). No click-out-only posts.
- **D-06:** The frozen pool stores **full extracted article text** (not excerpts) — offline-safe reading and best Ask grounding; source attribution always displayed. Acceptable exposure for a small non-public research instrument.
- **D-07:** **Frozen approved content is canonical.** Articles always render from full extracted text in the pool (immune to source deletion; offline-safe). Videos store only the fixed public YouTube URL/video ID and an approved derived wrapper/digest; no transcript, audio, or video copy is stored. Playback uses the official YouTube embed. When unavailable/offline, show the frozen summary and source link. No mid-study pool edits.
- **D-08:** The pool **ships bundled inside the app build** (pool JSON + thumbnails), imported into IndexedDB on first launch. Fully offline from install; `contentPoolVersion` is pinned to the installed build — consistent with the Phase 1 in-person install protocol.

### Curation & review workflow
- **D-09:** Raw collection is a **curated URL list + fetcher script**: the operator assembles the URL list (AI-assisted search happens outside the pipeline). Articles are fetched and extracted; videos retain validated public YouTube URL/ID and metadata, then are read through Gemini's official YouTube URL video-understanding input. The pipeline never downloads transcripts, audio, or video. No scraping-API collectors in Phase 2.
- **D-10:** AI preprocessing (hook, summaries, concepts, claims, stance, difficulty, suggested questions per RSD §8.6) uses pinned `gemini-3.1-flash-lite` for official YouTube URL understanding and the configured structured provider for articles. (`gemini-2.5-flash-lite` returned the provider's new-user retirement response on 2026-07-12.) The approved structured wrapper/digest becomes permanent frozen-pool content. Preparation is resumable at concurrency 1 so free-tier work may be spread across days.
- **D-11:** Review is **two-gate**: (1) **Codex (AI) reviews factual reliability and wrapper/digest faithfulness** as an advisory gate; (2) **the operator is the second and final gate**, confirming each post is good to read. Video rights review covers URL/embed/display and derived summaries, not transcript reproduction. Article full-text rights still require an acceptable recorded basis. Human approval remains the gate of record per RSD §8.7 — nothing enters the frozen pool without operator sign-off.
- **D-12:** The human-review gate is a **tiny local-only review web page** (never deployed) that renders each candidate — hook, summary, tags, claims, suggested questions, article text or video URL/ID and derived digest, Codex gate-1 verdict — with approve/reject/edit controls writing review JSON.

### Claude's Discretion
- Feed ordering before Phase 3 rankers exist (e.g., curated order, seeded shuffle, spread rules) — must be non-personal and identical logic for both conditions.
- How the old AI-post generation pipeline (concept-feed/post-queue/style-assignment shell) is retired vs kept dormant for Phase 3 reuse — respect the CLAUDE.md three-list invariants while it lives; don't break Phase 3's ranker insertion point.
- Ask panel grounding mechanics (how much post text enters the prompt), suggested-question presentation, saved/not-interested control wiring, thumbnail/typography details.
- Pipeline internals: dedupe mechanics, quality-scoring thresholds, exact Codex gate-1 invocation, freeze/export tooling, fetcher libraries.
- Fallbacks and error states not covered by D-07.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research contract and scope
- `docs/research_system_design.md` §6.3–§6.4, §7.1–§7.7, §8 (all), §9 (all), §17.1, §17.3 — topic/pool sizing, feed/post/Ask UX, pipeline stages, domain schemas (field-for-field), preprocessing and contextual-answer prompt templates.
- `docs/SCOPE.md` — locked scope contract; no live fetch, no AI-generated primary posts, no pruned features.
- `CLAUDE.md` — load-bearing invariants: concept-feed three-list pipeline (transitional subsystem this phase replaces), feed cold-start rules, PostDetail exploration detectors (extend, don't fork), header positioning, IndexedDB persistence seam, event bus, i18n 4-locale parity.
- `docs/prune_report.md` — what was pruned and must not return.

### Phase and requirement tracking
- `.planning/PROJECT.md` — locked decisions (DEC-both-conditions-ask, DEC-control-no-question-history, DEC-pruned-features-frozen, framing rules).
- `.planning/REQUIREMENTS.md` — Phase 2 requirements CONT-01, CONT-02, CONT-03, FEED-01, FEED-02, ASK-01.
- `.planning/ROADMAP.md` — Phase 2 success criteria; five-coarse-phase lock.
- `.planning/phases/01-rebrand-research-shell-hardening/01-CONTEXT.md` — Phase 1 decisions this phase builds on (D-06 content stays English in all UI languages; account/condition plumbing; interaction logging; upload queue; reduced participant surface).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/src/services/session.service.ts` + question-filter + `canonical-knowledge.service.ts` — existing post-scoped threaded Q&A stack; ASK-01 extends this (gentle-redirect already lives in the question filter per CLAUDE.md §7.6 note).
- `app/src/services/db.service.ts` — the dbQuery/dbExecute persistence seam; frozen-pool import and new schema stores go through it (tests assert through the seam, not in-memory mirrors).
- `app/src/screens/HomeScreen.tsx` / `PostDetailScreen.tsx` — feed and post-detail shells to be re-pointed at the frozen pool; PostDetail's CONCEPT_EXPLORED detectors are the seed of study interaction logging (extend, don't fork).
- `app/src/lib/event-bus.ts` — reactive re-read pattern; any pool/feed mutation must emit for always-mounted screens.
- Phase 1 deliverables (in flight): study-context/condition service, interaction-log service, upload queue — Phase 2 UI events wire into them.

### Established Patterns
- The concept-feed three-list pipeline (daily concepts → derived list → cyclic queue) is explicitly transitional; Phase 2 replaces it with the frozen pool. Its invariants (append-only derived list, refill mutex, FEED_REFILL_COMPLETED contract) apply until removal.
- Inline styles with CSS variables (not Tailwind classes) for UI; `ServiceResult<T>` for services; 4-locale parity for every visible string (content itself stays English per Phase 1 D-06).
- Capacitor users cannot refresh — all state changes must be event-bus driven.

### Integration Points
- Frozen-pool import at first launch (bundled JSON → IndexedDB via the dbQuery seam), keyed by `contentPoolVersion`.
- Feed home reads from the pool store instead of the post-queue walker; post detail renders Post schema fields (hook, summary, concepts, original text/embed, suggested questions).
- Ask panel persists UserQuestion + AIAnswer per RSD §9.6–§9.7 and emits the Phase 1 interaction-log events (question_submit, ai_answer_view).
- `tools/content_pipeline/` is a new top-level offline tool tree (collectors/, preprocessors/, dedupe/, quality_filter/, human_review/, exporters/, schemas/) — never imported by the participant app.

</code_context>

<specifics>
## Specific Ideas

- The pilot topic doubles as one of the final three study topics; the pipeline and pool format must scale to 200–400 posts/topic without rework.
- Codex-as-first-review-gate mirrors the operator's standing delegation policy (Codex for bulk verification work, human judgment as the final gate).
- The feed should feel like a real content feed, not a quiz system (RSD §7.2) — feed cards carry hook/source icon/source name/summary/concept tags/read-time.

</specifics>

<deferred>
## Deferred Ideas

- Second and third study topics + their pools — Phase 2 scales the pipeline but only freezes the pilot topic; remaining topics land before the main study (Phase 4 window).
- Personalized suggested questions for the experimental condition (RSD §7.5) — Phase 3, alongside the rankers.
- Recommendation reasons / exploration-path chips — Phase 3 (§7.7).
- Notification cadence and study-task pages — Phase 4.

</deferred>

---

*Phase: 2-Content pool + feed/post UI on frozen data*
*Context gathered: 2026-07-11*

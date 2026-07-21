# Phase 2: Content pool + feed/post UI on frozen data - Context

**Gathered:** 2026-07-13
**Status:** Ready for re-planning

<domain>
## Phase Boundary

Replace the temporary AI-generated feed shell entirely with a real, frozen, curated content pool: RSD §9 domain schemas field-for-field, an offline `tools/content_pipeline/` that turns raw URL candidates into human-approved posts, an immutable versioned export at `data/content_pool_v1/` for one pilot topic (~50 approved posts), and feed home + post detail rendering that pool with the AI wrapper (hook, summary, concept tags), embedded originals, pre-generated suggested questions, and post-scoped Ask working identically in both conditions with UserQuestion + AIAnswer persisted. Participant runtime never searches for or selects remote content; the sole live-content exception is user-triggered Gemini understanding of the already-frozen post's fixed public YouTube URL. No ranking/personalization — that is Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Pilot topic & sources
- **D-01:** The pilot pool topic is **AI agents & future work** (RSD §6.3 candidate #1 — the design doc's running example for suggested questions, prompts, and orchestration strategies).
- **D-02:** The candidate pool source mix is locked to **49% social posts/discussions, 14% complete articles, 7% complete papers/reports, and 30% public YouTube videos**. Report actual counts honestly; never pad a category with weak material merely to hit a percentage. Within the 49% social share, the exact X/Reddit split is at the curator's discretion, subject to viewpoint and author diversity.
- **D-03:** Content skews **mostly evergreen** (explainers, concept pieces, viewpoint essays that stay valid for months; few dated news items) so the frozen pool survives the pilot→main-study gap without recollection.
- **D-04:** Collect **~100–150 raw candidates** (2–3× the ~50 approval target) — enough slack for dedupe/quality rejection while keeping review effort bounded.

### Original content display
- **D-05:** Originals are **readable in-app**: YouTube via embedded player; text sources rendered from their reviewed frozen content unit. The original source link is always displayed (and `source_click` logged). No click-out-only posts.
- **D-06:** The frozen pool stores the **complete reviewed text unit** for text sources (not a homepage, abstract, teaser, or excerpt) — offline-safe reading and best Ask grounding; source attribution always displayed. For articles this means the complete main article body; for papers/reports, the complete paper/report extracted from full HTML or the full PDF.
- **D-07:** **Frozen approved content is canonical.** Articles always render from full extracted text in the pool (immune to source deletion; offline-safe). Videos store only the fixed public YouTube URL/video ID and an approved derived wrapper/digest; no transcript, audio, or video copy is stored. Playback uses the official YouTube embed. When unavailable/offline, show the frozen summary and source link. No mid-study pool edits.
- **D-08:** The pool **ships bundled inside the app build** (pool JSON + thumbnails), imported into IndexedDB on first launch. Fully offline from install; `contentPoolVersion` is pinned to the installed build — consistent with the Phase 1 in-person install protocol.

### Curation & review workflow
- **D-09:** Raw collection is a **curated, directly verified URL list + fetcher script**. Antigravity using Gemini 3.1 Pro High performs the web-research and candidate-document generation outside the participant app; Codex does not perform bulk collection. Text content is fetched and extracted; videos retain a validated public YouTube watch URL/ID and metadata, then are read through Gemini's official YouTube URL video-understanding input. The pipeline never downloads transcripts, audio, or video.
- **D-10:** AI preprocessing (hook, summaries, concepts, claims, stance, difficulty, suggested questions per RSD §8.6) uses pinned `gemini-3.1-flash-lite` for official YouTube URL understanding and the configured structured provider for articles. (`gemini-2.5-flash-lite` returned the provider's new-user retirement response on 2026-07-12.) The approved structured wrapper/digest becomes permanent frozen-pool content. Preparation is resumable at concurrency 1 so free-tier work may be spread across days.
- **D-11:** Review has a **source-integrity gate followed by two content gates**. Source integrity rejects unusable shells before paid preprocessing. Then (1) **Codex reviews factual reliability and wrapper/digest faithfulness** as an advisory gate; (2) **the operator is the second and final content gate**, confirming each post is good to read. Human approval remains the gate of record per RSD §8.7 — nothing enters the frozen pool without operator sign-off.
- **D-12:** The human-review gate is a **tiny local-only review web page** (never deployed) that renders each candidate — hook, summary, tags, claims, suggested questions, article text or video URL/ID and derived digest, Codex gate-1 verdict — with approve/reject/edit controls writing review JSON.

### Direct-content acceptance contract
- **D-13:** Accept only direct, readable content units: direct X status/thread URLs; direct Reddit post URLs; canonical public article URLs with the complete main body; direct full-paper/full-report HTML or PDF; and direct public YouTube watch URLs. Every candidate must be opened and verified before it enters preprocessing.
- **D-14:** Hard-reject organization/project homepages, navigation/index/search/category/tag pages, arXiv/DOI/repository abstract or metadata pages, download/landing pages standing in for the content, paywall/login/teaser pages, button/link-list/boilerplate pages, promotional stubs, duplicates, and long-form text with fewer than roughly 150 meaningful words.
- **D-15:** A frozen **X thread** contains the author's complete continuous thread. A frozen **Reddit discussion** contains the complete original post plus **3–8 representative high-quality replies**; a Reddit post without useful discussion may remain the complete OP alone. Replies are selected for substantive explanation, disagreement, evidence, or lived experience—not popularity alone.
- **D-16:** The previously processed/reviewed 50-item batch is rejected in full and is not an approval source for `data/content_pool_v1/`. It may remain only as temporary diagnostic evidence. Phase 02-04 and 02-09 must be replanned around the replacement pool before Phase 2 can be called complete.

### Claude's Discretion
- Feed ordering before Phase 3 rankers exist (e.g., curated order, seeded shuffle, spread rules) — must be non-personal and identical logic for both conditions.
- How the old AI-post generation pipeline (concept-feed/post-queue/style-assignment shell) is retired vs kept dormant for Phase 3 reuse — respect the CLAUDE.md three-list invariants while it lives; don't break Phase 3's ranker insertion point.
- Ask panel grounding mechanics (how much post text enters the prompt), suggested-question presentation, saved/not-interested control wiring, thumbnail/typography details.
- Pipeline internals: dedupe mechanics, quality-scoring thresholds, exact Codex gate-1 invocation, freeze/export tooling, fetcher libraries.
- Fallbacks and error states not covered by D-07.
- Exact X-versus-Reddit split inside the 49% social share, provided the final candidate report shows the distribution and preserves viewpoint/source diversity.

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
- `.planning/phases/02-content-pool-feed-post-ui-on-frozen-data/02-UI-SPEC.md` — approved feed/post visual and interaction contract.
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
- Text posts should feel like readable social posts or complete publications, never frozen website chrome. A source is useful only when the participant can consume the actual argument, explanation, experience, or discussion inside the app.

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
*Context gathered: 2026-07-13*

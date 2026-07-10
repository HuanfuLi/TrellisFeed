# Context Intel

Running notes from DOC-class sources (docs/prune_report.md, precedence 3) and narrative/background sections of the canonical SPEC. Appended verbatim-in-spirit with source attribution. Not decisions, requirements, or constraints — background for downstream planning.

---

## Topic: Project positioning
- source: docs/research_system_design.md §0, §2, §4
- QuestionTrace is a research prototype (forked from the Trellis product) for studying post-centered graph-memory learning feeds. Users ask AI questions under curated real posts; those questions become structured learner traces. In the experimental condition, traces drive future feed orchestration (continuation, deepening, contrast, bridging, memory echo). Evaluated via a multi-day field study against a matched multimedia feed without graph-memory orchestration.
- Three intended paper contributions: (1) post-level questions as learner-modeling signals; (2) graph-memory feed orchestration mechanism; (3) field evaluation with oral-explanation outcomes.

## Topic: Naming
- source: docs/research_system_design.md §5
- "TrellisFeed" is downgraded due to collision risk with MindTrellis (a nearby HCI/AI knowledge-graph system). "QuestionTrace" is the chosen name (alternatives considered: EchoFeed, CurioTrace, MemoryEcho, CurioGraph Feed).

## Topic: Study shape
- source: docs/research_system_design.md §6.1–6.4
- 5–7 day mobile field study; 24–36 participants (min viable 20). Three semi-open topics; each participant picks one. Content pool: 400–800 raw candidates → human-reviewed to 200–400 approved per topic; 600–1200 total across 3 topics. Candidate topics listed (AI agents & future work, social-media algorithms & attention, sleep/memory/learning, climate adaptation, personal finance & behavioral decisions, nutrition myths) — final three still open.

## Topic: Build sequencing guidance
- source: docs/research_system_design.md §19, §23
- Suggested build order: README/scope cleanup → schemas → frozen-pool importer → feed UI with static posts → post detail → suggested questions → Ask about this post → logging → user-question storage → graph-memory update → control ranker → experimental ranker → recommendation reasons → onboarding/condition assignment → data export. Key sequencing rule: implement logging BEFORE personalization; implement graph-memory ranker only after logs and static feed work. Build one pilot topic (~50 posts) before scaling.
- Note: this order is finer-grained than the locked five-phase ROADMAP but is consistent with it; treat ROADMAP phase boundaries as authoritative and this list as intra-phase guidance.

## Topic: Repository structure
- source: docs/research_system_design.md §15.4
- Planned layout includes tools/content_pipeline/ (offline collection + preprocessing) and data/content_pool_v1/ (frozen pool export). App consumes the frozen pool; it does not collect content at runtime.

## Topic: Prune baseline — what Phase 0 already removed
- source: docs/prune_report.md
- Phase 0/1 prune reduced the Trellis prototype to the QuestionTrace research shell. Final gates from app/: `tsc -b --noEmit` pass, `npm test` pass, `npm run lint` 0 errors (existing warnings only), `npm run build` pass (Vite chunk-size warnings).
- Routes removed: /ask, /ask/:id, /anchor/:id, /cluster/:id, /collections/:id, /graph, /planner, /review, /podcast. Routes kept: /home, /posts/:id, /saved, /settings (+ /ai /content /features /data), /onboarding. SwipeTabContainer/BottomNavigation now expose two slots: Home and Settings.
- Feature surfaces removed: Podcast, Flashcards/SRS review, Graph/Mindmap UI, Planner/Trellis gamification, Global free-form chat, Live web/news/YouTube, Collections, Token analytics, Scheduler (+ their DB tables, deps, and tests).

## Topic: Prune baseline — what survived and why (judgment calls)
- source: docs/prune_report.md §Data Layer Changes, §Judgment Calls
- Kept data services: db, question, canonical-knowledge, question-filter, filter-corpus, post-history, post-queue, daily-read, settings, event bus, i18n bundles, imageGeneration.*, engagement, session.
- session.service + `sessions` DB table KEPT because PostDetail post-context Q&A still persists post-specific threaded sessions.
- `reviewSchedule` fields KEPT on Question for persistence-shape compatibility, but the feed no longer consumes SM-2 due state (all unexplored anchors are eligible).
- `GRAPH_UPDATED` event + anchor/cluster model fields KEPT because question classification and canonical anchoring still use them (no visible graph UI).
- daily-read.service KEPT because the concept feed uses explored-anchor lazy-skipping and PostDetail emits exploration signals.
- Feed style weights redistributed to image 0.15 / text-art 0.75 / suggestion 0.10 (stratified largest-remainder sampler retained); video/news styles removed.
- SavedScreen simplified to Saved + History tabs (plain save/like via engagement.service; fuse.js/collections removed).
- Settings kept: LLM provider keys, fast-generation model, embedding provider keys/debug thresholds, image-generation keys/cache, theme, locale, privacy/data management, post retention/generation caps. Locale copy (en/zh/es/ja) updated for active screens; unused namespaces left in place to preserve bundle parity.
- Onboarding kept: welcome, language selection, consent, LLM setup.

## Topic: Known leftover dead context (not yet cleaned)
- source: docs/prune_report.md §Leftover Dead Context
- Inert-but-present: test-helper comments under app/tests/services/_actions-* and _trellis-*; legacy explanatory comments referencing old AskScreen/graph history; unused locale namespaces for deleted UI; CSS variables for old news-card styling. Left because inert and not imported by live code. ROADMAP Phase 1 calls for a "remaining dead-code sweep."
- Root-level docs (README.md, ROADMAP.md, CLAUDE.md, PROJECT_DESCRIPTION.md, Documents/) were NOT edited by the prune pass.

## Topic: Open questions (require decisions before/within implementation)
- source: docs/research_system_design.md §20; ROADMAP.md §Open questions
- Final three study topics; participant language/country; whether all content must be English; source click-out vs in-app embed; handling unavailable/deleted source content; notifications per day; whether the experimental condition personalizes suggested questions; whether to include the small exploration-path UI; human-review staffing for the content pool; IRB/ethics requirements for logging and audio recording.

## Topic: Success criteria (research-instrument framing)
- source: docs/research_system_design.md §21; docs/SCOPE.md §Success criteria
- Judged as a research instrument, NOT as a polished consumer app. Success = participants use it naturally for several days; content interesting enough for voluntary return; both conditions fair and comparable; experimental produces interpretable recommendation reasons; logs complete and analyzable; oral assessment reliably scorable; the paper can argue post-level questions are useful learner traces for future feed orchestration.

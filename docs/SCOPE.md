# QuestionTrace — Project Scope

Short scope contract for contributors and code agents. The authority is [`research_system_design.md`](research_system_design.md); this file is the quick check before adding or resurrecting anything.

## In scope

- Mobile-first curated real-content feed (fixed, frozen content pool — no live search in the participant app).
- Post detail page with AI wrapper: hook, summary, concept tags, suggested questions.
- "Ask about this post" — contextual, post-scoped AI Q&A, available to **both** study conditions.
- Question traces: storing user questions linked to posts/concepts/claims.
- Graph-memory learner model (personal layer over a global content graph) — experimental condition only.
- Feed orchestration strategies: Continue, Deepen, Contrast, Bridge, Echo, with visible recommendation reasons.
- Control ranker (strong, non-personal) for the control condition.
- Study infrastructure: onboarding, topic selection, condition assignment, interaction logging (§14), data export, pre/post oral-test support.
- Content curation pipeline (`tools/content_pipeline/`) and frozen pool (`data/content_pool_v1/`).

Current Phase 2 boundary: the immutable `pilot-v1-20260717` pool (77 approved
posts) is compiled into the app by `app/scripts/package-content-pool.mjs` and read
through `frozenFeedService`. Participant code never imports the pipeline or
fetches article/thumbnail content. The only bounded remote-content exceptions are
the selected YouTube embed and condition-neutral Gemini understanding of that
same frozen YouTube URL during an on-topic Ask; both fall back to frozen material.

## Out of scope (do not build, do not resurrect)

- Global free-form AI chat.
- AI-generated posts as primary content.
- Flashcards / spaced repetition / quizzes.
- Visible or editable knowledge graph / mind-map UI (a small "exploration path" chip list is the maximum allowed — design doc §7.7).
- Gamification: credits, harvest, streaks, daily goals, leaderboards.
- Podcast generation.
- Social features, comments, community.
- Live web search, live news fetch, live YouTube search inside the participant app.
- Token analytics dashboards.
- Product polish beyond what the study needs.

## Framing rules (design doc §22)

Say "post-centered graph-memory feed orchestration", not "AI learning feed". Say "contextual post-level Q&A as learner trace collection", not "AI tutor". Say "graph-memory orchestration from curiosity question traces", not "knowledge graph recommendation". Say "latent learner memory graph", not "mind map".

## Success criteria (design doc §21)

Judged as a research instrument: natural multi-day use, fair comparable conditions, interpretable recommendation reasons, complete analyzable logs, reliably scorable oral assessments — not by whether it becomes a polished consumer app.

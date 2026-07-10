# Project Description: QuestionTrace

**QuestionTrace** is a mobile research prototype for studying how learners' **post-level curiosity questions** in a curated multimedia feed can be transformed into **personal graph-memory traces** that orchestrate future learning content and support richer explanation over time.

This is the research fork of the Trellis product prototype, converted per the canonical design document at [`docs/research_system_design.md`](docs/research_system_design.md). It is a field-study instrument, not a product.

## Core mechanism

1. Users browse a **fixed curated pool of real multimedia posts** (videos, essays, explainers, opinion posts) on one of three semi-open study topics. AI does not fabricate post content; it only wraps real content with a hook, short summary, concept tags, and suggested questions.
2. Under each post, users **ask AI contextual questions** or tap pre-generated suggested questions. The chat is explicitly scoped to the post and topic.
3. Those questions are stored as **structured learning traces** linked to posts, concepts, and claims — not treated as transient chat history.
4. In the **experimental condition**, a personal graph-memory layer (viewed posts, asked questions, activated concepts, unresolved questions, interest/uncertainty/familiarity weights) orchestrates future feed items via five strategies: **Continue, Deepen, Contrast, Bridge, Echo** — each with a user-facing recommendation rationale.
5. The **control condition** gets the identical app, content pool, and Q&A affordances, but a strong non-personal feed ranking (quality, topic relevance, diversity, recency, randomization). The single isolated variable is graph-memory orchestration.

## Evaluation

A 5–7 day mobile field study (24–36 participants) measuring:

- **Re-engagement** — sessions, return days, posts opened, questions asked, voluntary revisits.
- **Question traces** — question depth, type distribution, concept linkage, unresolved/repeated curiosity.
- **Oral explanation quality** — pre/post oral tests scored blind on concept coverage, relationship understanding, stance comparison, counterargument awareness, and transfer, normalized against a general verbal baseline.

## Architecture

- **Frontend:** React 19 + TypeScript 5.9, React Router 7, Vite 7, Tailwind CSS 4 (inline styles + CSS variables convention).
- **Native bridge:** Capacitor 8 (iOS/Android/Web).
- **Persistence:** local-first IndexedDB (SQLite-compatible seam) with in-memory mirrors.
- **AI providers:** modular connectors for OpenAI, Claude, Gemini, and local endpoints (LM Studio/Ollama); users supply their own keys. LLMs are used for content preprocessing, contextual post Q&A, question→concept extraction, and recommendation rationales — never for fabricating primary content.
- **Content pipeline (planned):** `tools/content_pipeline/` — collection, AI preprocessing, dedupe, quality filtering, human review, frozen pool export to `data/content_pool_v1/`.

## Status (July 2026)

Phase 0–1 of the research roadmap: rename, scope, and prune of product-era features (podcast, flashcards/SRS, mindmap UI, gamification, global chat, live search) is in progress. See [`ROADMAP.md`](ROADMAP.md) and `docs/prune_report.md`.

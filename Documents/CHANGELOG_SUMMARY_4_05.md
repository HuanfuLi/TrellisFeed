# EchoLearn Project Changelog Summary (Up to April 05, 2026)

## Executive Summary
This document serves as an aggregated summary of all project changelogs from March 21 to April 05, 2026. Over this period, EchoLearn evolved significantly across its core functionalities:
- **Feed & Content Orchestration:** Evolved from a simple review surface into a rich, exploratory `InfoFlow` including dynamic generated essays, YouTube short-video integration, newspaper-style Tavily-sourced news, and aesthetic Text-Art generation.
- **Intelligent Knowledge & QA:** Shifted from basic text-matching to advanced, dynamic semantic systems using pre-computed embeddings, context-aware AI threading, and robust cluster-aware knowledge graphing infrastructure.
- **Planner & Learning Workspace:** Completely overhauled task tracking into an intelligent `Planner` mapping spaced-repetition signals, weakness trajectories, and curiosity hints into automatically scoped actionable "learning chunks".
- **Infrastructure:** Integrated deep local persistence mapping via SQLite mappings, robust `fallback` catches, strict deduplication logic, and rigorous token tracking. UI elements were vastly improved globally to deliver a native, fluid, and robust mobile-first experience.

---

## Detailed Per-Changelog Feature List

### Changelog: April 05, 2026 (Phases 18 & 19)
- **Web Search Integration (Phase 19):** Interfaced with Tavily API for background daily news synthesis and live globe-toggled chat queries with inline citations and a collapsible "Sources" accordion.
- **Feed Redesign & Short Media (Phase 18):** De-cluttered `InfoFlow` cards using a formalized `PresentationStyle` system engine to map mathematical feed ratios across text-art, standard images, text-only, and portrait short-video (YouTube Shorts) nodes.
- **Math Visualization & Polish:** Integrated LaTeX & KaTeX renderers using `rehype-sanitize` for safe HTML parsing. Rightward-only visual hierarchy implemented for improved screen utility on Graph pages.

### Changelog: April 02, 2026 (Phases 15, 16, & 17)
- **YouTube Video Integration (Phase 17):** Implemented non-blocking interleaving of YouTube video context natively within the feed, equipped with a 16:9 `YouTubeEmbed` component optimized for WebViews, plus strict `10-15s` network timeouts.
- **Token Optimization & History (Phase 16):** Wired true multi-turn threading inside Ask interactions mapped accurately against local `TokenUsageReporter` metrics viewable in Developer Settings.
- **Cluster GraphQL (Phase 15):** Enabled dynamic Context Clusters in the Graph, isolated flashcard review per cluster, and stringently enforced mindmap node deduplication algorithms to prevent entity loops.

### Changelog: March 28, 2026 (Phases 12 & 13)
- **Portal Navigation & Deep Routing (Phase 12):** Standardized cross-screen breadcrumbs providing precise "Suggested move" anchors scaling up robust `DeepLink` handlers seamlessly caching stack layers on Returns.
- **Planner Intelligence (Phase 13):** Migrated to a streamlined `PlannerChunk` logic executing +30 priority boosts targeting statistically weak (<2.0 ease) areas and overdue flashcards.
- **LLM Base Flexibility:** Integrated local `LM Studio` alongside Ollama and OpenAI for diverse LLM query bases. 

### Changelog: March 25, 2026 (Phase 06)
- **Question Quality Layers (Phase 06):** Injected an ultra-low-latency (<1ms) heuristic `PATTERN_LIBRARY` routing out conversational small-talk and meta-questions from poisoning the canonical graph. Added user override "off-topic badges".

### Changelog: March 23, 2026 (Semantic System & Persistence)
- **Cosine Relevance Reranking:** Pipelined question workflows utilizing background embedded vector comparisons acting before LLM interactions, significantly improving targeted context loading over old Jaccard keywords.
- **SQLite Engine Persistence:** Overhauled the planner data definitions natively using full SQLite migrations mapping standard thread formats into guaranteed offline records.

### Changelog: March 22, 2026 (Mobile Polish & Planner Concepts)
- **UI & UX Touch:** Shipped strict `framer-motion` navigations paired seamlessly with Capacitor Haptics and native `:active` squish variables locking down a purely mobile-optimized view.
- **Planner Reframing:** Scrapped static calendars favoring check-in states translating ambiguous user fuzziness directly into proactive application features.

### Changelog: March 21, 2026 (Feed Discovery Architecture)
- **Feed vs Review Split:** Fundamentally reimagined the Home Screen out of rigid Spaced-Repetition grids into a low-friction hook-driven concept feed enabling casual contextual browsing.
- **Conversational Essays:** Added daily bundle abstractions extracting connected node topics and bridging them actively behind "Post Details" pages.
- **Reliable Render Safeties:** Protected layout engines guarding broken component builds reacting immediately onto localized storage constraints seamlessly preserving feed state.

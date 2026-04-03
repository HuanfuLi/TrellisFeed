# Changelog: March 28, 2026

## Portal Navigation & Rich Moves (`phase-12`)

### Refined Routing & Navigation
- **Fixed Routing Logic:** Corrected a routing gap where `deepdive` moves were incorrectly pointing to the `AskScreen`. They now correctly route to `PostDetailScreen` (`/posts/:id`).
- **Navigation Context (MoveNavigationState):** Implemented a standardized navigation state that passes complete move metadata (concept ID, resource ID, type) via `location.state`.
- **History Preservation:** Standardized `navigate(-1)` across all move-target screens (Review, Post, Question) to ensure users return to the `PlannerScreen` with the history stack intact.
- **Deep Linking Support:** Ensured all target screens handle direct URL access gracefully by providing fallback labels (e.g., "Back to Home") when no navigation state is present.

### UI & Breadcrumbs
- **Smart Breadcrumbs:** Added conditional "Suggested move: [title]" breadcrumbs to `ReviewScreen`, `PostDetailScreen`, and `QuestionDetailScreen` to provide context when arriving from the Planner.
- **Back Navigation Labels:** Updated back buttons to dynamically change labels (e.g., "Back" vs "Back to Home") based on whether the user arrived from a suggested move.

## Planner Redesign & Intelligence (`phase-13`)

### Simplified Data Model
- **PlannerChunk Consolidation:** Deprecated the `PlannerThread` model in favor of a unified `PlannerChunk` architecture. Daily check-ins now generate actionable chunks directly, eliminating redundant conversational threads.
- **Signal-Aware Mapping:** Re-engineered `planner.service.ts` to map user signals to specific learning actions:
    - **Confusion -> Review:** Triggers clarification-focused review sessions for unresolved areas.
    - **Connections -> Compare:** Automatically links to relevant connection posts in the feed.
    - **Revisit Intent -> Review:** Prioritizes spaced repetition for requested topics.
    - **Curiosity -> Discover:** Triggers LLM-driven essay title generation for exploration.

### Intelligent Prioritization
- **Weak Area Detection:** Implemented a +30 priority boost for weak areas, identified via `trajectoryAnalyzer.service.ts` based on low ease factors (< 2.0) or overdue status.
- **Suggestion Scoring:** Updated the suggestion engine to favor genuinely weak or overdue concepts, ensuring the most critical learning tasks appear at the top of the Planner.

### Planner UX Redesign
- **Top Suggestions Toggle:** Added a default limit of 5 suggestions with "Show all [N] suggestions" and "Show less" toggle buttons to reduce cognitive load and keep the interface focused.
- **Priority Badges:** Introduced visual priority badges (🔴 WEAK AREA, 🟠 OVERDUE, 🟡 ACTIVE, ⚪ EXPLORE) on `MoveCard` based on relevance scores.
- **Section Rename:** Updated the main progress section to "Your Learning Progress" for better alignment with user goals.

### Expanded Provider Support
- **LM Studio Integration:** Added native support for **LM Studio** as a local embedding provider in `SettingsScreen`, including dedicated base URL and model configuration.
- **Local Provider Defaults:** Updated default URLs and placeholder models for both Ollama and LM Studio to improve the out-of-the-box local-first experience.

### Content & Learning Enhancements
- **Discover Essay Streaming:** Enhanced `PostDetailScreen` to support streaming exploratory essays for curiosity-driven topics, allowing users to read as content is generated.
- **Smart Post Linking:** Added a `findClosestPost` utility to `concept-feed.service.ts` to intelligently link planner suggestions to existing feed content based on concept overlap.
- **Flashcard Quality:** Updated flashcard generation to prefer `nodeSummary` for card backs, ensuring more concise and focused review content.

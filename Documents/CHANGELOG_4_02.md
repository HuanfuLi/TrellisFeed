# Changelog: April 02, 2026

## Token Optimization & Session History (`phase-16`)

### Context-Aware Q&A Threading
- **Session History Support:** Updated `ask()` and `askStreaming()` utilities to accept `sessionHistory`.
- **AskScreen Updates:** Wired the `AskScreen` to pass prior conversational messages to the LLM, enabling true multi-turn context without relying on global Q&A hacks.

### Token Usage Infrastructure
- **Token Tracking Engine:** Introduced `TokenUsageReporter` interface and implemented `LocalTokenUsageReporter` for granular cost tracking.
- **Provider-Level Extraction:** Wired native token usage extraction directly into `chatCompletion` and `chatStream` primitives.
- **Call-Site Tagging:** Annotated all 15 active LLM call sites across services with explicit `serviceName` tags to categorize token usage accurately.
- **Developer Metrics:** Added a comprehensive "Token Usage" section inside `SettingsScreen` (under Developer settings) for real-time tracking of AI consumption.

## Cluster-Aware Knowledge Graph (`phase-15`)

### Data Model & Cluster Capabilities
- **Question Extensions:** Extended the Core `Question` type to support `isClusterNode` and `clusterNodeId` fields.
- **Dynamic Cluster Creation:** Updated the `classifyAndAnchor` logic to dynamically create high-level contextual groupings (Clusters) leveraging aggregate updates, projection guards, and reflection tree extensions.

### Cluster Detail & Review Integration
- **Cluster Detailed View:** Introduced `ClusterDetailScreen` equipped with specific metadata display and registered it under the `/cluster/:id` route.
- **Targeted Review:** Added a `clusterReview` filter to the `ReviewScreen` that allows users to review flashcards explicitly isolated to a specific cluster.
- **Breadcrumb Navigation:** Implemented tappable breadcrumbs within `AnchorDetailScreen` to traverse rapidly back to its parent cluster.

### Mindmap & Visual Reorganization
- **Cluster Rendering:** Deployed a cluster-aware mindmap renderer along with an interactive bottom info panel.
- **Node Deduplication:** Fixed the `review-map` renderer to stringently deduplicate nodes by `nodeId`, ensuring that each conceptual entity only paints once.
- **Polished Visuals:** Redesigned the overall mindmap visualization, focusing on look, feel, and organizational flow.

## Bug Fixes & UX Enhancements

### Feeds & Articles (Posts)
- **Image-First Loading:** Post cards in the feed are now completely hidden until their associated image generation resolves, eliminating sudden layout flickers.
- **Seamless Essay Loading:** Replaced raw streaming text with a loading spinner during essay generation to eliminate choppy visuals and heading reflow.
- **Retry Mechanism:** Integrated a "Retry" button on post details if image generation fails.
- **Scroll Preservation:** Re-entering the `HomeScreen` from a post detail or other views now intelligently restores the viewport scroll position.
- **Style Cleanup:** Stripped duplicate headings generated inside the essay view (since title pills exist) and normalized viewing animations.

### Refinements
- **Flashcards UX:** Enlarged the textual area of flashcards, centered internal content by default, and enabled scrolling for highly dense materials.
- **Mobile Fidelity:** Fixed an Android STT (Speech-to-Text) bridging bug and fixed safe-area padding flickering issues in native builds.
- **Notifications:** Integrated structured scheduled tasks and app notifications for mobile usage.
- **Planner Logic:** Resolved state extraction signal bugs within the updated Planner service flow. 

# Changelog: April 02, 2026

## YouTube Video Integration (`phase-17`)

### Feed & Video Player
- **Video Feed Interleaving:** Infused YouTube videos directly into the concept feed by intelligently interleaving video cards among standard AI posts. Uses non-blocking background generation to prevent layout flickers or UI blockages.
- **YouTube Embed Player:** Introduced `YouTubeEmbed` component—a responsive 16:9 player optimized for iOS WebViews with `playsinline` and strict referrer policies.
- **Video Context Details:** Updated `PostDetailScreen` natively swapping the default image carousel for the video embed when handling `sourceType === 'video'`. Features AI-summarized text summaries tailored specifically for video content.
- **Video Thumbnails:** `InfoFlow` cards natively render YouTube thumbnails with a play-button overlay and channel metadata for clear visual contrast against text posts.

### Service & Infrastructure 
- **YouTube Settings:** Introduced a dedicated YouTube Data API v3 configuration section within `SettingsScreen` for user API keys, ensuring settings deep-merge operates properly inside `settings.mock.ts` fallback.
- **Service Integration:** Built `youtube.service.ts` to coordinate external YouTube API fetches, including robust 10-15s timeouts and graceful failure (catch-all) allowing the main feed to continue functioning fully unblocked if the key isn't present or fetching times out.
- **Nyquist Validation:** Authored robust end-to-end module tests in `youtube.test.mjs`, certifying rigorous cache key handling (`VIDEO_CACHE_KEY`) safely passing CI strict assertions.

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

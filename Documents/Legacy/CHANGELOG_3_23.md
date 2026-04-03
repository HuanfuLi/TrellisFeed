# Changelog: March 23, 2026

## Core Architectural Improvements

### Unified Connection Essay & Q&A Flow
- **UI Refactoring**: Effectively deprecated `ConnectionPostScreen` by absorbing connection essay generation and viewing into the standard `PostDetailScreen`.
- **Contextual Q&A**: Comparison essays now support the full "Ask this post" follow-up capability, ensuring architectural consistency across all content types.
- **Streaming Generation**: Implemented a robust streaming UI for comparison essays with automatic caching and retry logic.

### Spaced Repetition & Mind Map Integration
- **Fuzzy Hierarchy Matching**: Added a keyword-based fuzzy matching algorithm to `flashcardService` that automatically links chat-extracted flashcards to relevant questions in the knowledge tree.
- **Review Map Coverage**: Fixed a gap where user-generated cards were missing from the Mind Map; these cards now correctly inherit hierarchy labels (Root/Branch/Cluster) for visualization.

## Semantic Similarity System (`semantic-connection-cards`)

### Advanced Embedding Integration
- **"Ask" Flow Relevance**: Integrated query embeddings into the core `questionService.ask` workflow. The system now re-ranks context candidates using cosine similarity *before* calling the LLM, providing more precise context.
- **Pre-Computed Vectors**: Implemented pre-computation of query embeddings to eliminate latency in semantic context retrieval for new questions.
- **Side-Effect Persistence**: Added fire-and-forget embedding generation during question ingestion to maintain a high-quality vector database without blocking the UI.

### Graph Logic & Feed Optimization
- **Robust Semantic Fallback**: Fixed a logic bug in `graphService` to ensure connection cards fall back to keyword Jaccard similarity if semantic pairs do not meet the defined threshold.
- **Feed Performance**: Optimized `HomeScreen` to prevent unnecessary feed re-generation during simple Planner task check-offs.
- **Cache Management**: Improved `conceptFeedService` to drop stale regular posts while preserving valuable `'connection'` essays from previous days.

## Infrastructure & Persistence

### SQLite Write-Through Source of Truth
- **Planner Persistence**: Completed the SQLite migration for the Planner system. Added `planner_chunks`, `planner_threads`, and `planner_checkins` tables to the DDL.
- **Data Integrity**: Ensured all planner modifications are persisted natively, protecting user data against `localStorage` clearing on mobile devices.

### Embedding Configuration UI
- **Provider Support**: Added support for OpenAI, Google, and Local (Ollama/LM Studio) embedding providers in Settings.
- **Developer Tools**: Added a similarity threshold slider and a "Show scores" toggle for real-time tuning of the semantic engine.

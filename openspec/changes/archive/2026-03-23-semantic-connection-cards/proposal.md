## Why

Connection cards in the Home info flow currently show two truncated concept labels with no bridge text, paired by noisy keyword overlap — the result is cards like "I build a consistent, daily" / "Spaced repetition. And why" that force users to imagine a connection that may not even exist. Introducing semantic similarity via text embeddings and LLM-generated bridge insights makes connection cards genuinely meaningful: each card shows a real semantic relationship, a compelling insight hook, and clear concept noun labels, and taps through to a generated comparison essay.

## What Changes

- Add an Embedding Model configuration block to Settings so developers can configure OpenAI, Google, or local (Ollama/LM Studio) embedding providers, along with an adjustable similarity threshold for debugging.
- Introduce an embedding provider layer (`src/providers/embedding/`) that calls the appropriate embeddings API and exposes a pure cosine similarity helper.
- Extend the `Question` domain model with an optional `embeddingVector` field; populate it at question-save time as a fire-and-forget side-effect when an embedding provider is configured.
- Replace the keyword-Jaccard candidate selection in the connection card pipeline with cosine similarity over stored vectors, falling back to Jaccard when embeddings are unavailable.
- Augment the daily feed generation prompt to produce `conceptNounA`, `conceptNounB`, and `bridgeInsight` for each qualifying semantic pair; only pairs with a non-null `bridgeInsight` surface as connection cards.
- Redesign the connection card UI: bridge insight as the prominent hook at the top, two concept noun blocks below, full card is tappable.
- On tap, navigate to PostDetailScreen and stream an LLM-generated comparison essay (similarities, differences, takeaway) stored as a `DailyPost` with `sourceType: 'connection'`; the post never appears in the main feed.

## Capabilities

### New Capabilities
- `embedding-model`: Configuration and provider layer for text embedding models, including similarity threshold tuning and cosine similarity computation.
- `semantic-connection-cards`: Redesigned connection cards driven by embedding-based semantic similarity, LLM-generated bridge insights and concept noun labels, and tap-through to a generated comparison essay post.

### Modified Capabilities
- `concept-feed`: Connection candidate selection is extended to use semantic embedding similarity when vectors are available, and the daily generation prompt is updated to produce bridge insights and concept nouns alongside existing post content.

## Impact

- **New files**: `src/providers/embedding/index.ts`, `src/screens/ConnectionPostScreen.tsx` (or reuse PostDetailScreen via route param), `openspec/specs/embedding-model/spec.md`, `openspec/specs/semantic-connection-cards/spec.md`
- **Modified files**: `src/types/index.ts` (EmbeddingConfig, EmbeddingDebugConfig, Question.embeddingVector), `src/services/mock/settings.mock.ts` (embedding defaults), `src/screens/SettingsScreen.tsx` (new config block), `src/services/question.service.ts` (embed on save), `src/services/graph.service.ts` (semantic candidates), `src/services/concept-feed.service.ts` (prompt + InfoFlowItem shape), `src/components/InfoFlow.tsx` (ConnectionCard redesign), `src/App.tsx` (route for connection post if needed)
- **Dependencies**: Text embedding API (OpenAI `text-embedding-3-small`, Google `text-embedding-004`, or Ollama `nomic-embed-text`); no new npm packages required
- **No breaking changes** to existing DailyPost storage, PostDetailScreen, or question persistence; embedding vectors are additive and optional

## 1. Types And Configuration

- [x] 1.1 Add `EmbeddingConfig` and `EmbeddingDebugConfig` types to `src/types/index.ts` and add `embeddingVector?: number[]` to the `Question` interface
- [x] 1.2 Extend `AppSettings` in `src/types/index.ts` to include `embedding: EmbeddingConfig` and `embeddingDebug: EmbeddingDebugConfig`
- [x] 1.3 Add defaults for `embedding` and `embeddingDebug` in `src/services/mock/settings.mock.ts` (provider: 'openai', isConfigured: false, threshold: 0.65, showScores: false)
- [x] 1.4 Add `'connection'` to the `DailyPost['sourceType']` union in `src/types/index.ts` and update `VALID_SOURCE_TYPES` in `concept-feed.service.ts`

## 2. Embedding Provider

- [x] 2.1 Create `src/providers/embedding/index.ts` with `embedText(text, config): Promise<number[]>` dispatching to OpenAI, Google, and local (Ollama/LM Studio) implementations
- [x] 2.2 Implement OpenAI embeddings: POST `/v1/embeddings`, support `dimensions` override for reduced-size vectors
- [x] 2.3 Implement Google embeddings: POST `/v1beta/models/{model}:embedContent` using the Gemini API key
- [x] 2.4 Implement local embeddings: POST `<baseUrl>/api/embeddings` (Ollama) with fallback to `<baseUrl>/v1/embeddings` (LM Studio-compatible)
- [x] 2.5 Add `cosine(a: number[], b: number[]): number` pure helper in the same file

## 3. Settings UI — Embedding Block

- [x] 3.1 Add an "Embedding Model" section to `src/screens/SettingsScreen.tsx` with provider selector (OpenAI / Google / Local), API key input, model ID input, and base URL input (local only)
- [x] 3.2 Add optional dimensions input field to the embedding config section
- [x] 3.3 Add a developer debug subsection with similarity threshold slider (0.40–0.95, step 0.05) and "Show similarity scores" toggle
- [x] 3.4 Wire all embedding settings fields to read/write `settings.embedding` and `settings.embeddingDebug` via `mockSettingsService`

## 4. Embedding At Question Save Time

- [x] 4.1 In `questionService.buildAndSave()`, after `saveStore()`, fire-and-forget `embedText(content + ' ' + answer, embeddingConfig)` when `embeddingConfig.isConfigured` is true
- [x] 4.2 On successful embedding response, call `questionService.patchQuestion(id, { embeddingVector: vector })` to persist the vector
- [x] 4.3 Silently catch and log embedding errors without surfacing them to the user

## 5. Semantic Candidate Selection

- [x] 5.1 Add `getSemanticCandidates(threshold: number): Array<{ source: Question; target: Question; score: number }>` to `graphService` using cosine similarity over `embeddingVector` fields
- [x] 5.2 Fall back to keyword Jaccard pairs (existing `related` from `buildDailyKnowledgeContext`) when vectors are absent, preserving existing behavior
- [x] 5.3 Cap the returned candidate list at 6 pairs, sorted by cosine score descending

## 6. Feed Generation — Bridge Insights And Concept Nouns

- [x] 6.1 Update `buildGenerationPrompt()` in `concept-feed.service.ts` to include a `connection_candidates` section listing up to 6 semantic pairs with their question titles and summaries
- [x] 6.2 Add instructions to the prompt requesting `conceptNounA`, `conceptNounB`, and `bridgeInsight | null` for each candidate pair
- [x] 6.3 Update `parseGeneratedPosts()` (or add a parallel parser) to extract connection card data from the LLM response and build `InfoFlowItem` connection entries with `conceptNounA`, `conceptNounB`, `bridgeInsight`, and `cosineSimilarity` fields
- [x] 6.4 Update the `InfoFlowItem` `'connection'` variant in `src/components/InfoFlow.tsx` type to include `conceptNounA`, `conceptNounB`, `bridgeInsight`, `cosineSimilarity`, and `connectionPostId?: string`
- [x] 6.5 Filter out any `InfoFlowItem` connections where `bridgeInsight` is null or empty before injecting into the feed

## 7. Feed Assembly — Exclude Connection Posts

- [x] 7.1 In `conceptFeedService.getDailyPosts()` and `generateMorePosts()`, filter out posts with `sourceType === 'connection'` from the returned array
- [x] 7.2 Confirm `getPostById()` still resolves connection posts from cache (no change needed, just verify)

## 8. Connection Card UI Redesign

- [x] 8.1 Rewrite `ConnectionCard` in `src/components/InfoFlow.tsx` to render `bridgeInsight` as the primary hook text at the top, followed by two concept noun blocks for `conceptNounA` and `conceptNounB`
- [x] 8.2 Make the full card tappable with an `onClick` that calls a new `onOpenConnection` prop, passing the card's pair IDs
- [x] 8.3 Remove the double-tap aha interaction and `onAha` prop from `ConnectionCard` and its call sites
- [x] 8.4 Add the cosine similarity score label (muted, small) that is visible only when `showScores` is true in embedding debug config
- [x] 8.5 Update `ImmersiveInfoFlow` and `InlineInfoFlow` to pass `onOpenConnection` through to `ConnectionCard`

## 9. Connection Essay Post

- [x] 9.1 Add `generateConnectionPost(questionA: Question, questionB: Question): AsyncGenerator<string>` to `concept-feed.service.ts` using `chatStream` with a comparison essay prompt
- [x] 9.2 Cache the completed essay as a `DailyPost` with `sourceType: 'connection'` and `id: 'conn-{idA}-{idB}'` in the existing daily posts cache
- [x] 9.3 Update `HomeScreen` to handle `onOpenConnection(idA, idB)`: look up the cached connection post; if found navigate to it, otherwise navigate to a loading route
- [x] 9.4 Update `PostDetailScreen` (or add a route variant) to detect `sourceType === 'connection'` and stream-generate the essay if not yet cached, showing a streaming loading state
- [x] 9.5 On essay generation failure, show an error state with a retry button; do not cache partial content

## 10. Validation And Cleanup

- [x] 10.1 Verify that questions with no embedding vectors still produce connection cards via the Jaccard fallback path
- [x] 10.2 Verify that connection posts are not visible in the main feed but are accessible via `getPostById`
- [x] 10.3 Remove the `onAha` / `reinforceEdge` wiring from `HomeScreen` that previously handled the double-tap (now unused for connection cards)
- [x] 10.4 Confirm the Settings embedding block saves and restores correctly across app restarts via localStorage

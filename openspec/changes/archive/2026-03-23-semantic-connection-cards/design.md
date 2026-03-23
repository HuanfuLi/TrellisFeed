## Context

The Home info flow currently injects connection cards by pairing questions that share any keyword via `findRelated()` — a word-frequency Jaccard match that produces noisy, often meaningless pairs. The card UI then renders truncated 4-7 word question titles with no bridge text, forcing users to imagine a connection that may not exist. There is no tap destination.

The fix is layered: (1) embedding-based semantic similarity replaces keyword Jaccard for candidate selection, (2) an LLM pass generates a bridge insight and noun labels for qualifying pairs, (3) the card UI is redesigned around the bridge insight as the hook, and (4) tapping the card streams a comparison essay into a `DailyPost`-shaped screen.

Current LLM provider surface (`src/providers/llm/index.ts`) supports OpenAI, Claude, Gemini, and local. A parallel embedding provider is added that mirrors the same provider-dispatch pattern but calls embeddings endpoints instead of chat completions.

## Goals / Non-Goals

**Goals:**
- Developer-configurable embedding model (OpenAI / Google / local) with adjustable similarity threshold in Settings
- Embeddings computed at question-save time and stored on the `Question` object; cosine similarity replaces Jaccard for connection candidate selection when vectors are available
- LLM-generated `conceptNounA`, `conceptNounB`, and `bridgeInsight` for each qualifying pair during daily feed generation; pairs without a bridge insight are excluded
- Redesigned connection card: bridge insight as hook, two noun-label blocks below, full card tappable
- On tap: stream a comparison essay from the LLM, save as `DailyPost` with `sourceType: 'connection'`, display in PostDetailScreen; never surfaces in main feed

**Non-Goals:**
- Server-side embeddings or pgvector — this change is client-side only; the architecture is designed to migrate cleanly later
- clusterLabel improvement — identified as a follow-on that can reuse `conceptNoun` infrastructure from this change
- Multi-provider embedding fallback (e.g., auto-switching from Claude→OpenAI for embeddings) — developer manually configures a separate embedding provider

## Decisions

### D1: Separate embedding provider config from LLM config

**Decision:** Add `EmbeddingConfig` as a distinct field in `AppSettings`, separate from `LLMConfig`.

**Rationale:** Users may run Claude for chat but need OpenAI for embeddings (Anthropic has no embedding model). Sharing a config object would force coupling. The Settings block makes this explicit and debuggable.

**Alternative considered:** Auto-detect embedding capability from the existing LLM provider and fall back gracefully. Rejected because silent fallback makes it hard to reason about which similarity signal is active.

### D2: Store embedding vector on the Question object

**Decision:** Add `embeddingVector?: number[]` to `Question` and persist it in localStorage alongside the question.

**Rationale:** Avoids a separate storage key, keeps the question as the single source of truth, and makes the vector immediately available during feed generation without a second lookup. Cosine similarity over ≤200 questions is microseconds in JS.

**Alternative considered:** Separate `echolearn_embeddings` localStorage key keyed by question ID. Rejected — sync complexity between two stores outweighs the marginal storage savings.

**Cost:** ~1KB per question at 256 dims. 200 questions ≈ 200KB. Negligible against the 5MB localStorage limit.

### D3: Embedding at question-save time, fire-and-forget

**Decision:** After `saveStore()` in `buildAndSave()`, call `embedText()` and patch the question with the returned vector — no `await`, no blocking of the ask response.

**Rationale:** Embedding call (200–400ms) should not delay the user seeing their answer. The vector is only needed at next feed generation.

**Risk:** If the user asks many questions rapidly the embedding calls can pile up — acceptable since they are independent and cheap.

### D4: Jaccard pre-filter before cosine comparison

**Decision:** When embeddings are available, still use Jaccard as a first-pass pre-filter (threshold: any overlap > 0) before computing cosine similarity. Pure cosine over all N² pairs runs at feed-generation time and pairs are typically < 200 questions.

**Rationale:** Even without this pre-filter the N² cosine pass is fast (<1ms for 200 questions at 256 dims). The pre-filter is kept as a safety valve for edge cases with very large question stores; it can be removed later without any behavior change.

**Revision for server migration:** Replace with pgvector ANN query — the candidate selection logic is isolated in `graphService.getSemanticCandidates()` so the call site in concept-feed doesn't change.

### D5: LLM bridge generation as part of feed generation, not per-card

**Decision:** Pass all semantic candidate pairs to the daily feed generation prompt in a single `connection_candidates` block. The LLM returns `conceptNounA`, `conceptNounB`, `bridgeInsight | null` for each. Only non-null pairs become cards.

**Rationale:** One prompt instead of N separate calls. The LLM sees all candidates at once and can apply consistent quality judgment. `null` is the quality filter — no separate scoring step needed.

**Alternative considered:** Per-pair LLM scoring in a separate call. Rejected — cost scales with O(N) pairs, and a single prompt with all candidates gives the LLM context to be consistent.

### D6: Connection essay stored as DailyPost with sourceType 'connection'

**Decision:** Reuse `DailyPost` type with a new `sourceType: 'connection'` value. Store in the existing daily posts cache. Stream from LLM into `PostDetailScreen` on first tap; subsequent taps hit the cache.

**Rationale:** PostDetailScreen rendering, navigation, and caching are already correct. Adding a new `sourceType` is additive and non-breaking. The essay never appears in the main feed because feed assembly filters by `sourceType !== 'connection'`.

**Alternative considered:** A new `ConnectionPost` type with its own screen. Rejected — unnecessary duplication of rendering and navigation infrastructure.

## Risks / Trade-offs

- **Embedding provider mismatch** (Claude users have no Anthropic embedding model) → Mitigation: Settings block is explicit; when no embedding provider is configured the system falls back to keyword Jaccard silently. A Settings badge or helper text communicates the fallback state.
- **localStorage vector bloat** on very large question stores → Mitigation: vectors default to 256 dims; the Settings block exposes `dimensions` for tuning. Future migration to server storage is clean.
- **LLM returns null for all pairs** (bad prompt or low-quality questions) → Mitigation: connection cards simply don't appear; this is correct behavior, not a regression. The existing keyword-based fallback remains for the non-embedding path.
- **Feed generation prompt grows larger** with candidate pairs → Mitigation: cap candidate pairs fed to LLM at 6; pre-filter with cosine threshold so only high-confidence pairs reach the prompt.

## Open Questions

- Should the similarity threshold slider in Settings affect only the connection card pipeline, or also the `getSimilarNodes` path used by the graph view? (Recommendation: connection cards only for now; graph uses its own threshold.)
- Should connection posts be visible in any screen other than the tap destination (e.g., a future "Connections" tab)? (Scoped out for now per the agreed decision — connection-only post, not in main feed.)

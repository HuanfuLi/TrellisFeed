## ADDED Requirements

### Requirement: Embedding provider configuration
The system SHALL provide a dedicated Settings block for configuring a text embedding model, separate from the LLM configuration. Supported providers are OpenAI, Google, and Local (Ollama / LM Studio). The configuration SHALL include: provider selector, API key (OpenAI and Google), model ID, base URL (local only), and optional output dimensions.

#### Scenario: Developer configures OpenAI embedding provider
- **WHEN** developer selects "OpenAI" as embedding provider and enters a valid API key and model ID (e.g. `text-embedding-3-small`)
- **THEN** `EmbeddingConfig.isConfigured` is set to true and subsequent question saves trigger an embedding call to `https://api.openai.com/v1/embeddings`

#### Scenario: Developer configures Google embedding provider
- **WHEN** developer selects "Google" as embedding provider and enters a valid API key and model ID (e.g. `text-embedding-004`)
- **THEN** embedding calls are routed to the Gemini embeddings endpoint using the provided key

#### Scenario: Developer configures local embedding provider
- **WHEN** developer selects "Local" as embedding provider and enters a base URL (e.g. `http://localhost:11434`) and model ID (e.g. `nomic-embed-text`)
- **THEN** embedding calls are routed to `<baseUrl>/api/embeddings` (Ollama) or `<baseUrl>/v1/embeddings` (LM Studio-compatible)

#### Scenario: Embedding provider not configured
- **WHEN** no embedding provider is configured or `isConfigured` is false
- **THEN** the connection candidate pipeline falls back to keyword Jaccard similarity and no embedding API calls are made

### Requirement: Similarity threshold configuration
The system SHALL expose an adjustable similarity threshold (range 0.40–0.95, default 0.65) in the Settings embedding block that controls the minimum cosine similarity required for a question pair to qualify as a connection card candidate.

#### Scenario: Developer adjusts threshold upward
- **WHEN** developer sets the threshold to 0.80
- **THEN** only question pairs with cosine similarity ≥ 0.80 are passed to the LLM bridge generation step, resulting in fewer but higher-confidence connection cards

#### Scenario: Developer adjusts threshold downward for debugging
- **WHEN** developer sets the threshold to 0.45
- **THEN** more candidate pairs reach the LLM bridge generation step, potentially surfacing connections that would otherwise be filtered out

### Requirement: Show similarity scores toggle
The system SHALL provide a boolean toggle in the embedding debug block labeled "Show similarity scores". When enabled, each rendered connection card SHALL display the cosine similarity score of its pair for developer inspection.

#### Scenario: Show scores enabled
- **WHEN** the "Show similarity scores" toggle is on
- **THEN** each connection card shows the numeric cosine similarity (e.g. "0.74") in a small muted label visible only in this debug mode

#### Scenario: Show scores disabled (default)
- **WHEN** the "Show similarity scores" toggle is off
- **THEN** no similarity score is displayed on connection cards in the UI

### Requirement: Embedding vector storage on Question
The system SHALL store the computed embedding vector as `embeddingVector: number[]` on the `Question` object and persist it in localStorage. The vector SHALL be computed at question-save time as a non-blocking side effect when an embedding provider is configured.

#### Scenario: Question saved with embedding provider configured
- **WHEN** a question is saved and `EmbeddingConfig.isConfigured` is true
- **THEN** `embedText(question.content + ' ' + question.answer)` is called asynchronously and the returned vector is patched onto the question without blocking the ask response

#### Scenario: Question saved without embedding provider
- **WHEN** a question is saved and no embedding provider is configured
- **THEN** `embeddingVector` is not set and the question is saved normally

#### Scenario: Embedding call fails
- **WHEN** the embedding API returns an error after a question is saved
- **THEN** the question is already persisted without a vector; no error is shown to the user; the failure is silently logged

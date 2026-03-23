## ADDED Requirements

### Requirement: Semantic candidate selection for connection cards
The system SHALL select connection card pairs using cosine similarity over stored embedding vectors when vectors are available, replacing keyword Jaccard overlap. Only pairs with cosine similarity at or above the configured threshold SHALL be passed to the LLM bridge generation step. When embedding vectors are unavailable the system SHALL fall back to keyword Jaccard with no change in behavior.

#### Scenario: Both questions have embedding vectors
- **WHEN** building connection candidates and both questions in a pair have `embeddingVector` populated
- **THEN** cosine similarity is computed and only pairs at or above `EmbeddingDebugConfig.similarityThreshold` are included as candidates

#### Scenario: One or both questions lack embedding vectors
- **WHEN** building connection candidates and at least one question in a pair has no `embeddingVector`
- **THEN** the system falls back to keyword Jaccard similarity for that pair

#### Scenario: No candidate pairs reach the threshold
- **WHEN** no question pairs meet the cosine similarity threshold
- **THEN** no connection cards are injected into the feed; this is correct behavior and no error or fallback card is shown

### Requirement: LLM-generated bridge insight and concept noun labels
The system SHALL pass qualifying semantic candidate pairs to the daily feed generation LLM prompt and request for each pair: `conceptNounA` (2–4 word noun phrase naming concept A), `conceptNounB` (2–4 word noun phrase naming concept B), and `bridgeInsight` (a single hook sentence ≤ 20 words articulating the connection, or `null` if no meaningful connection exists). Only pairs where the LLM returns a non-null `bridgeInsight` SHALL become connection cards.

#### Scenario: LLM returns a valid bridge insight
- **WHEN** the LLM returns a non-null `bridgeInsight` for a candidate pair along with `conceptNounA` and `conceptNounB`
- **THEN** an `InfoFlowItem` of kind `'connection'` is created with those three fields and injected into the feed

#### Scenario: LLM returns null for a candidate pair
- **WHEN** the LLM returns `null` for `bridgeInsight` for a candidate pair
- **THEN** that pair is excluded from the feed; no connection card is shown for it

#### Scenario: Concept noun labels are noun phrases, not questions
- **WHEN** the LLM generates `conceptNounA` for the question "What is spaced repetition?"
- **THEN** the label is a noun phrase such as "Spaced Repetition", not a question or sentence fragment

### Requirement: Redesigned connection card UI
The connection card SHALL display the `bridgeInsight` as the primary hook text at the top of the card, followed by two concept blocks containing `conceptNounA` and `conceptNounB` respectively. The full card SHALL be tappable and navigate to the connection essay post. The double-tap aha interaction SHALL be removed.

#### Scenario: Connection card renders with bridge insight
- **WHEN** a connection card with `bridgeInsight`, `conceptNounA`, and `conceptNounB` is rendered
- **THEN** the bridge insight appears as the first and largest text element, followed by two side-by-side or stacked concept noun blocks

#### Scenario: User taps connection card
- **WHEN** user taps anywhere on a rendered connection card
- **THEN** the app navigates to the connection essay post for that pair

#### Scenario: Similarity score shown in debug mode
- **WHEN** `EmbeddingDebugConfig.showScores` is true
- **THEN** the cosine similarity score for the pair is displayed in a small muted label on the card

### Requirement: Connection essay post generation and display
The system SHALL generate a comparison essay when a connection card is first tapped. The essay SHALL be streamed from the LLM into a PostDetailScreen-compatible view, covering similarities, differences, and a takeaway for the two concepts. The generated content SHALL be saved as a `DailyPost` with `sourceType: 'connection'` and cached so subsequent taps do not re-generate. Connection posts SHALL NOT appear in the main feed.

#### Scenario: First tap on connection card
- **WHEN** user taps a connection card for the first time
- **THEN** the app navigates to a post-detail view, shows a loading/streaming state, and streams a comparison essay from the LLM for the two concepts

#### Scenario: Subsequent tap on same connection card
- **WHEN** user taps a connection card for a pair that already has a cached connection post
- **THEN** the app navigates directly to the cached post with no LLM call

#### Scenario: Connection post excluded from main feed
- **WHEN** the main info flow feed is assembled
- **THEN** posts with `sourceType: 'connection'` are excluded from the feed item list

#### Scenario: LLM essay generation fails
- **WHEN** the LLM call for essay generation fails after navigating to the post view
- **THEN** an error state is shown with a retry option; the partially generated post is not cached

## MODIFIED Requirements

### Requirement: Connection candidate selection
The concept-feed service SHALL source connection candidates from `graphService.getSemanticCandidates()`, which returns pairs ranked by cosine similarity when embedding vectors are available, falling back to keyword Jaccard when they are not. The service SHALL pass at most 6 candidate pairs to the LLM prompt per feed generation cycle.

#### Scenario: Semantic candidates available
- **WHEN** embedding vectors exist for questions and `getSemanticCandidates()` returns pairs above the threshold
- **THEN** concept-feed passes up to 6 of those pairs to the generation prompt in a `connection_candidates` block

#### Scenario: No embedding vectors available
- **WHEN** no questions have `embeddingVector` populated
- **THEN** concept-feed falls back to the existing `related` pairs from `buildDailyKnowledgeContext()` as connection candidates

### Requirement: Feed assembly excludes connection posts
The concept-feed service's `getDailyPosts()` and `generateMorePosts()` SHALL exclude any cached posts with `sourceType: 'connection'` from the returned feed array, as those posts are only reachable via connection card tap.

#### Scenario: Connection post in cache during feed assembly
- **WHEN** the daily post cache contains a post with `sourceType: 'connection'`
- **THEN** `getDailyPosts()` does not include it in the returned array

#### Scenario: getPostById still resolves connection posts
- **WHEN** `getPostById(id)` is called with the ID of a connection post
- **THEN** the post is returned from cache normally, enabling PostDetailScreen to render it

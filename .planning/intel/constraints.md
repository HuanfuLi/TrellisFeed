# Constraints Intel

Technical constraints extracted from the canonical SPEC (docs/research_system_design.md, precedence 0). Types: schema | scoring/nfr | protocol | copy. Downstream implementations must conform to these verbatim.

---

## CON-schema-domain (schema)
- source: docs/research_system_design.md §9
- type: schema
- content: Canonical TS shapes. Implement field-for-field.

```ts
type Topic = { id; name; shortDescription; hooks: string[]; coreConceptIds: string[]; testRubricId; contentPoolVersion; };

type Post = {
  id; topicId; sourceUrl;
  sourcePlatform: "youtube"|"article"|"blog"|"newsletter"|"x"|"reddit"|"news"|"other";
  sourceName; author?; originalTitle; displayTitle; hook; shortSummary; longSummary?;
  language; durationSeconds?; readingTimeMinutes?; thumbnailUrl?;
  originalPublishedAt?; collectedAt; approvedAt?;
  qualityScore; interestingnessScore; educationalValueScore; difficulty; // all 0-1
  viewpoint?: "supportive"|"critical"|"neutral"|"mixed";
  conceptIds: string[]; claimIds: string[]; suggestedQuestionIds: string[];
  status: "raw"|"preprocessed"|"approved"|"rejected"|"frozen";
};

type Concept = { id; topicId; label; description; aliases: string[]; parentConceptIds?; prerequisiteConceptIds?; };

type Claim = { id; topicId; text; stance?: "pro"|"con"|"neutral"|"mixed"; conceptIds: string[]; };

type SuggestedQuestion = {
  id; postId; topicId; text;
  type: "clarification"|"evidence"|"counterpoint"|"connection"|"implication"|"example"|"reliability";
  targetConceptIds: string[]; targetClaimIds?; generic: boolean;
};

type UserQuestion = {
  id; userId; condition: "control"|"experimental"; topicId; postId; text;
  source: "typed"|"suggested_question"; suggestedQuestionId?; createdAt;
  extractedConceptIds: string[]; extractedClaimIds?; questionType?; unresolved?; aiAnswerId?;
};

type AIAnswer = { id; userQuestionId; postId; answerText; citedPostIds: string[]; citedSourceUrls?; conceptIds: string[]; claimIds?; createdAt; modelName; };

type UserInteractionEvent = {
  id; userId; condition: "control"|"experimental"; topicId; timestamp;
  eventType: "app_open"|"feed_impression"|"post_open"|"post_close"|"source_click"|"video_play"
    |"video_progress"|"question_suggestion_click"|"question_submit"|"ai_answer_view"|"save_post"
    |"not_interested"|"recommendation_reason_view"|"notification_received"|"notification_open"|"session_end";
  postId?; questionId?; recommendationId?; durationMs?; payload?: Record<string, unknown>;
};

type Recommendation = {
  id; userId; condition: "control"|"experimental"; topicId; postId; generatedAt;
  strategy: "topic_baseline"|"quality_baseline"|"diversity_baseline"|"continue"|"deepen"|"contrast"|"bridge"|"echo";
  score; reasonText; contributingQuestionIds?; contributingConceptIds?; contributingPostIds?; componentScores?;
};

type UserConceptState = {
  userId; conceptId; exposureCount; questionCount; savedPostCount; skippedPostCount;
  lastActivatedAt?; interestWeight; uncertaintyWeight; familiarityEstimate; // all 0-1
};
```

---

## CON-graph-edges (protocol)
- source: docs/research_system_design.md §10.4
- type: protocol
- content: Two-layer graph. Global edges: Post-explains->Concept, Post-mentions->Concept, Post-supports->Claim, Post-challenges->Claim, Claim-about->Concept, Claim-contrasts_with->Claim, Concept-related_to->Concept, Concept-prerequisite_of->Concept, SuggestedQuestion-targets->Concept, SuggestedQuestion-targets->Claim. Personal edges: User-viewed->Post, User-asked->UserQuestion, UserQuestion-under->Post, UserQuestion-asks_about->Concept, UserQuestion-asks_about->Claim, User-interested_in->Concept, User-confused_about->Concept, User-revisited->Post, User-saved->Post, User-skipped->Post, UserQuestion-echoed_by->Recommendation, Recommendation-served->Post.

---

## CON-experimental-scoring (scoring)
- source: docs/research_system_design.md §11.3–11.4
- type: scoring/nfr
- content: Experimental ranker score (weights are configurable defaults):

```text
Score(post,user) =
  0.25 * QuestionRelevance
+ 0.20 * ConceptInterestMatch
+ 0.15 * ContinuityWithRecentPosts
+ 0.15 * NoveltyOrContrast
+ 0.15 * ContentQuality
+ 0.10 * DifficultyFit
- 0.20 * RedundancyPenalty
```
Component inputs per §11.4: QuestionRelevance (question↔summary embeddings, target-concept overlap, claim support/challenge, unresolved status); ConceptInterestMatch (user concept weights, post concept tags, concept-graph proximity); ContinuityWithRecentPosts; NoveltyOrContrast (stance, contrast edges, underexplored neighbors); ContentQuality (static curation score); DifficultyFit (match difficulty to familiarity — low familiarity → lower/medium difficulty); RedundancyPenalty (embedding similarity to viewed, same source/claim/format repetition).

---

## CON-control-scoring (scoring)
- source: docs/research_system_design.md §11.7
- type: scoring/nfr
- content: Control ranker score:

```text
ControlScore(post) =
  0.40 * ContentQuality
+ 0.25 * TopicRelevance
+ 0.15 * GeneralInterestingness
+ 0.10 * DifficultyBalance
+ 0.10 * Diversity
- 0.20 * RecentlySeenPenalty
```
HARD CONSTRAINT (locked, DEC-control-no-question-history): control MUST NOT use prior user questions, question-derived concept weights, unresolved-question tracking, memory-echo logic, or graph-based continuation/counterpoint/bridge logic. Session-level "not interested"/already-seen filtering for basic UX is allowed.

---

## CON-concept-weight-update (protocol)
- source: docs/research_system_design.md §10.6
- type: protocol
- content: interestWeight deltas — +0.05 feed impression, +0.10 post open, +0.20 source click or video progress > threshold, +0.30 user question involving concept, +0.25 save, -0.15 not interested, -0.10 repeated skip. uncertaintyWeight rises on clarification/"what does this mean"/AI-classified-confusion/repeated-similar questions. familiarityEstimate rises on repeated views, deeper questions, successful oral/reflection explanation, echo click-through.

---

## CON-diversity-rerank (protocol)
- source: docs/research_system_design.md §11.6
- type: protocol
- content: After scoring rerank so that — no more than 2 posts from the same source per session; no more than 2 posts with the same primary concept in a row; include at least one contrast or bridge item after sufficient history; mix video/article/opinion/explainer formats.

---

## CON-orchestration-strategies (protocol)
- source: docs/research_system_design.md §11.5
- type: protocol
- content: Each experimental item is labeled with exactly one of: Continue (directly continues a prior question), Deepen (explains a repeatedly activated concept in more depth), Contrast (opposing stance/critical view), Bridge (connects two separately encountered concepts), Echo (revisits an older question via a new post; requires prior question older than a threshold).

---

## CON-logging-events (protocol)
- source: docs/research_system_design.md §14.1
- type: protocol
- content: Required logged events — app open, feed impression, post open, post close, time on post, source click, video progress (if available), suggested-question click, typed-question submit, AI-answer view, save, not interested, recommendation reason viewed, notification open, session end.

---

## CON-privacy-do-not-collect (nfr)
- source: docs/research_system_design.md §14.2
- type: nfr
- content: MUST NOT collect — phone screen recordings during field deployment, app usage outside the study app, precise geolocation, contacts, other app names, clipboard, raw keystroke timing (unless specifically approved), any private data not necessary for the study.

---

## CON-consent-language (protocol)
- source: docs/research_system_design.md §14.3
- type: protocol
- content: Consent must tell participants: the app logs in-app interactions; questions asked to AI are stored for research analysis; audio responses in pre/post tests are recorded and transcribed; data is anonymized; withdrawal is per study protocol.

---

## CON-algorithm-verification (nfr)
- source: docs/research_system_design.md §12.3
- type: nfr
- content: Required unit tests — QuestionRelevance increases for posts sharing target concepts; contrast candidates include opposing claims; redundancy penalty suppresses near-duplicates; echo requires prior questions older than threshold; control condition does not use user question history; experimental recommendation reasons include contributing trace IDs.

---

## CON-oral-assessment (protocol)
- source: docs/research_system_design.md §13.4, §13.5
- type: protocol
- content: Scoring dimensions (§13.4) — response duration, word count, core concept coverage, concept relationship count, stance comparison quality, use of examples, counterargument awareness, transfer ability, explanatory clarity, overall rubric score. Normalization (§13.5): improvement from domain pretest to post-test, normalized by general verbal baseline (Pretest A).

---

## CON-framing-copy (copy)
- source: docs/research_system_design.md §22; docs/SCOPE.md §Framing
- type: copy
- content: LOCKED (DEC-framing-rules). Forbidden→required substitutions in all user-facing copy, code comments, and docs: "AI learning feed"→"post-centered graph-memory feed orchestration"; "AI tutor"→"contextual post-level Q&A as learner trace collection"; "knowledge graph recommendation"→"graph-memory orchestration from curiosity question traces"; "mind map"→"latent learner memory graph".

---

## CON-no-live-fetch (nfr)
- source: docs/research_system_design.md §6.5, §8.1; docs/SCOPE.md
- type: nfr
- content: The participant app runs entirely on a fixed frozen content pool. No live web search, live news fetch, or live YouTube search inside the participant app. Content collection happens only in the offline pipeline (tools/content_pipeline/).

---

## CON-graph-visibility-cap (nfr)
- source: docs/research_system_design.md §7.7; docs/SCOPE.md
- type: nfr
- content: No full/editable knowledge-graph or mind-map UI in the first main study. Maximum allowed visibility = a small "Your current exploration path" chip list plus short recommendation rationales. Control condition gets only non-personal labels ("Related to X", "Popular explanation", "Different viewpoint").

# QuestionTrace Research System Design

**Working title:** QuestionTrace: Turning Post-Level Curiosity Questions into Graph-Memory Feed Orchestration  
**Former working title:** TrellisFeed  
**Document version:** v2.0  
**Purpose:** This document is intended to be placed directly inside the project repository and used by Codex / Claude Code / other code agents as the implementation guide for converting the existing Trellis product prototype into a focused research prototype.

---

## 0. Executive Summary

This project should no longer be framed as a general AI learning app, AI feed, AI tutor, AI flashcard tool, or mind-map product. The updated research direction is:

> **QuestionTrace is a mobile learning feed system where users browse real curated multimedia posts, ask AI questions under each post, and the system turns those post-level curiosity questions into a personal graph-memory layer that orchestrates future feed items.**

The core idea is not that users can ask AI questions. Many systems already do that. The core idea is:

> **A learner's contextual questions under real posts become longitudinal learning traces. These traces are converted into a personal graph-memory model, and that graph-memory model determines what the learner sees next: continuations, counterpoints, bridges, deeper dives, and memory echoes.**

The first research prototype should compare two conditions:

1. **Control condition: Standard Multimedia Topic Feed**
   - Same app.
   - Same curated content pool.
   - Same posts.
   - Same "Ask about this post" feature.
   - Same AI answers.
   - Same pre-generated suggested questions.
   - But no personal graph-memory feed orchestration.

2. **Experimental condition: Graph-Memory Orchestrated Feed**
   - Same as control.
   - Additionally converts user post-level questions into a personal graph-memory layer.
   - Uses graph-memory to sequence future feed posts through strategies such as Continue, Deepen, Contrast, Bridge, and Echo.

The main empirical goal is not to prove that knowledge graphs are universally better. The goal is to study whether graph-memory orchestration can improve:

- voluntary re-engagement over several days;
- depth and continuity of user questioning;
- richness of oral explanations after using the system;
- users' perception that the feed follows their curiosity and helps them build understanding.

---

## 1. Why the Direction Was Updated

A collision-first literature review found that the original "TrellisFeed: graph-grounded multimedia learning feed" framing has **medium novelty risk**. The risk does not come from one exact duplicate system, but from several research/product directions converging:

- AI learning feeds and microlearning systems;
- contextual Q&A systems such as "Ask about this";
- dynamic learner memory graphs;
- knowledge graph recommenders for education;
- AI flashcards and spaced repetition;
- AI mind maps and visual knowledge construction systems.

Therefore, the research should be narrowed away from broad claims like:

- "We built an AI learning feed."
- "We built an AI tutor."
- "We built a knowledge graph recommender."
- "We built a mind map."
- "We built a contextual Q&A interface."

The safer and stronger novelty is:

> **Post-level curiosity questions as learner-modeling signals for graph-memory feed orchestration.**

This means the contribution is the mechanism that turns local, contextual questions into future feed sequencing, not the existence of a feed, a tutor, or a graph.

---

## 2. Updated Research Positioning

### 2.1 One-sentence positioning

**QuestionTrace studies how users' post-level curiosity questions in a curated multimedia feed can be transformed into personal graph-memory traces that orchestrate future learning content and support richer explanation over time.**

### 2.2 Short abstract-style description

QuestionTrace is a mobile research prototype for curiosity-driven informal learning. Users browse a curated feed of real multimedia posts, including videos, essays, explainers, and opinion posts. Under each post, users can ask AI contextual questions or click pre-generated suggested questions. The system stores these questions as learning traces linked to posts, concepts, claims, and relationships. In the experimental condition, this graph-memory layer orchestrates later feed items by continuing unresolved questions, deepening concepts, surfacing counterpoints, bridging related ideas, and revisiting prior curiosity. A multi-day field study compares this graph-memory feed to a standard multimedia topic feed using the same content pool and interaction affordances.

### 2.3 What the project is not

The project should not be implemented or presented as:

- a general-purpose ChatGPT wrapper;
- an AI-generated content feed;
- a short-video learning app;
- a flashcard or SRS app;
- a quiz app;
- a mind-map editor;
- a general social learning platform;
- a black-box recommender system;
- a full product launch.

### 2.4 What the project is

The project is:

- a research prototype;
- a mobile-first field study system;
- a curated real-content feed;
- a post-centered contextual Q&A interface;
- a graph-memory learner model;
- a feed orchestration mechanism;
- a data collection platform for studying curiosity-driven learning.

---

## 3. Research Questions

### RQ1: Re-engagement

**Compared with a standard multimedia topic feed, does graph-memory orchestration increase voluntary re-engagement over several days?**

Potential measures:

- number of sessions;
- return days;
- average session length;
- number of posts opened;
- number of questions asked;
- number of suggested questions clicked;
- notification open rate;
- voluntary revisits to previously viewed posts;
- user-reported willingness to continue.

### RQ2: Question-driven learning traces

**How do learners' post-level questions function as traces for modeling curiosity, conceptual focus, unresolved understanding, and future learning needs?**

Potential measures:

- number of post-level questions;
- depth of questions;
- distribution of question types;
- number of concepts linked to questions;
- number of unresolved questions;
- number of repeated concepts across sessions;
- qualitative patterns in curiosity trajectories.

### RQ3: Oral explanation quality

**Does graph-memory orchestration help learners produce richer oral explanations after several days of exploration?**

Potential measures:

- oral response duration;
- word count;
- core concept coverage;
- concept relationship count;
- stance comparison quality;
- use of examples;
- counterargument awareness;
- transfer ability;
- explanatory clarity;
- overall rubric score;
- improvement from domain pretest to post-test, normalized by general verbal baseline.

---

## 4. Core Contribution Statements

The paper should aim for three contributions.

### Contribution 1: Post-level questions as learner-modeling signals

We introduce a post-centered interaction design where learners' contextual AI questions under curated multimedia posts are captured as structured learning traces, rather than being treated as transient chat history.

### Contribution 2: Graph-memory feed orchestration

We present a graph-memory orchestration mechanism that links posts, questions, concepts, claims, and user interaction histories to generate future feed sequences such as continuations, counterpoints, bridges, deeper dives, and memory echoes.

### Contribution 3: Field evaluation with oral explanation outcomes

We evaluate the system in a multi-day field deployment with a matched-content control condition, examining voluntary re-engagement and open-ended oral explanation quality as outcomes of curiosity-driven learning.

---

## 5. Naming Recommendation

The previous working name **TrellisFeed** should be avoided or downgraded because of naming collision risk with **MindTrellis**, a nearby HCI/AI knowledge graph system.

Recommended system names:

1. **QuestionTrace** — strongest and most direct.
2. **EchoFeed** — good if memory echo becomes the central metaphor.
3. **CurioTrace** — good if curiosity tracking is emphasized.
4. **MemoryEcho** — good for a more learning-oriented product feel.
5. **CurioGraph Feed** — descriptive but less elegant.

This document uses **QuestionTrace**.

---

## 6. Experimental Design Overview

### 6.1 Study type

A **5–7 day mobile field study**.

This is preferable to a one-shot lab study because the system is about feed return behavior, curiosity continuation, and memory over time.

### 6.2 Participants

Recommended sample size:

- Minimum viable: 20 participants.
- Better: 24–36 participants.
- Stronger: 40 participants if feasible.

Given practical constraints, plan for **24–36 participants**.

### 6.3 Topic selection

Use **three semi-open topics**, not a large open-ended topic pool.

Each participant chooses one topic based on their interest. This preserves curiosity while keeping content pools, test rubrics, and evaluation manageable.

Recommended topic requirements:

- broad enough for 200–400 high-quality posts;
- interesting to undergraduate/graduate participants;
- not too technical;
- has multiple viewpoints and controversies;
- supports explanatory, comparative, and transfer questions.

Potential topic candidates:

1. AI agents and future work.
2. Social media algorithms and attention.
3. Sleep, memory, and learning.
4. Climate adaptation and extreme weather costs.
5. Personal finance and behavioral decision-making.
6. Nutrition myths and health misinformation.

For the first implementation, choose **three**.

### 6.4 Content pool size

For each topic:

- collect 400–800 raw candidate items;
- use AI preprocessing and filtering;
- human-review down to 200–400 high-quality posts.

Total final experimental content pool:

- 600–1200 posts across 3 topics.

### 6.5 Conditions

#### Control: Standard Multimedia Topic Feed

Control participants get:

- same app;
- same topic options;
- same content pool;
- same post UI;
- same AI-generated hook/summary;
- same pre-generated suggested questions;
- same "Ask about this post";
- same contextual AI answer quality.

But the feed is ranked using non-personal or weak-personal topic/feed logic:

- topic relevance;
- content quality;
- recency within the study pool;
- diversity;
- difficulty balancing;
- randomization.

It does **not** use the user's prior questions as graph-memory signals for future feed orchestration.

#### Experimental: Graph-Memory Orchestrated Feed

Experimental participants get everything in the control condition.

In addition, the system:

- stores their post-level questions as graph-memory traces;
- links questions to concepts, claims, and posts;
- identifies unresolved or repeated curiosity signals;
- uses graph-memory to recommend future content;
- produces recommendation rationales based on prior questions or concepts.

### 6.6 Why both groups must have "Ask about this post"

This is a crucial design decision.

If only the experimental group can ask AI questions, any observed improvement may come from AI Q&A access rather than graph-memory orchestration.

Therefore:

> Both groups must have contextual post-level Q&A. The only isolated variable should be whether question history is used for future graph-memory orchestration.

---

## 7. User Experience Design

### 7.1 App-level flow

The app should contain the following screens:

1. Study onboarding.
2. Topic selection.
3. Feed home.
4. Post detail page.
5. Ask-about-this-post panel.
6. Optional lightweight interest trajectory panel.
7. Study task / oral test instruction page.
8. Data export / researcher dashboard.

### 7.2 Feed home

Each feed card should display:

- post title or AI-generated hook;
- source type icon: video, article, opinion, explainer, news, etc.;
- source name;
- short AI summary;
- key concept tags;
- estimated reading/watching time;
- optional difficulty indicator;
- optional viewpoint label, if relevant;
- open button.

Important: The feed should feel like a real content feed, not like a quiz system.

### 7.3 Post detail page

A post detail page should include:

1. AI-generated hook.
2. Original content embed or link.
3. AI summary.
4. Key concepts.
5. Suggested questions.
6. "Ask about this post" input.
7. Related posts area.
8. Save / Not interested / Seen enough controls.

### 7.4 Original content vs AI-processed content

Users should primarily consume **real original content**, not AI-generated posts.

The displayed post should be:

- original video, article, post, or excerpt;
- plus AI-generated wrapper for accessibility:
  - hook;
  - short summary;
  - concept tags;
  - suggested questions.

AI should not fabricate the main post content.

### 7.5 Suggested questions

Each post should have 3–5 pre-generated suggested questions.

These should be generated during content preprocessing, not at runtime unless personalization is needed.

Suggested question types:

1. Clarification.
2. Evidence.
3. Counterpoint.
4. Connection.
5. Implication.
6. Example.
7. Reliability/source critique.

Example for a post about AI agents:

- What makes this example different from a normal chatbot?
- What evidence supports the author's claim?
- What is a possible counterargument?
- How does this relate to tool use?
- What would this mean for entry-level workers?

Experimental condition may personalize one or two suggestions:

- You previously asked about reliability. What reliability risk appears in this post?
- You watched a pro-agent example yesterday. How does this post challenge that view?

Control condition should receive only generic post-based questions.

### 7.6 Ask about this post

The chat should be explicitly scoped to the post and topic.

Placeholder examples:

- "Ask a follow-up about this post..."
- "Ask what this means, whether it is true, or how it connects to another idea..."
- "Ask for a counterexample or real-world implication..."

If the user asks unrelated questions, the system should gently redirect:

> This research version focuses on the current post and topic. You can ask about the post's concepts, examples, evidence, or related viewpoints.

For an approved video post, preprocessing uses Gemini's official public-YouTube-URL video input to create the frozen wrapper/digest. During a participant's on-topic Ask, the shared condition-neutral Q&A path may send only that post's already-frozen canonical YouTube URL to Gemini for live video understanding. If live understanding fails, the same request falls back to the frozen approved digest. The participant cannot supply, search for, or substitute a URL, and no transcript, audio, or video copy is stored.

### 7.7 Knowledge graph visibility

Do **not** expose the full knowledge graph in the first main study.

Reason:

- It would create an unfair experimental difference.
- It would confound feed orchestration with graph visualization.
- It would move the project toward MindTrellis/ConceptScape territory.

Allowed lightweight visibility:

- A small "Your current exploration path" chip list.
- Example: "AI agents → tool use → reliability → job displacement".
- A short recommendation rationale:
  - "Recommended because you asked about reliability yesterday."
  - "This is a counterpoint to the optimistic post you saved."

Control condition can have non-personal labels:

- "Related to AI agents."
- "Popular explanation."
- "Different viewpoint."

Avoid full editable mind maps.

---

## 8. Content Curation Pipeline

### 8.1 Why a fixed content pool

The study should not rely on live web search, YouTube discovery, or mutable remote content selection during participant usage. The bounded exception is live Gemini understanding of the already-frozen post's fixed public YouTube URL when the participant asks about that video; it is identical in both conditions and falls back to the frozen digest.

Reasons:

- reproducibility;
- stable content quality;
- reduced engineering risk;
- consistent control/experimental comparison;
- easier human review;
- easier test rubric construction.

### 8.2 Content sources

For a North American/English-speaking participant pool, prioritize English-language sources.

Candidate sources:

- YouTube educational videos;
- Substack posts;
- Medium posts;
- personal blogs;
- newsletters;
- mainstream news explainers;
- think tank explainers;
- research lab blogs;
- company engineering/product blogs;
- high-quality X/Twitter posts or threads if legally and technically feasible;
- Reddit high-quality discussions only with caution.

Avoid or postpone:

- Bilibili, unless the participant pool is Chinese-speaking;
- short-form platforms with difficult extraction rights;
- low-quality AI-generated content;
- content without stable URLs;
- content that requires login;
- content likely to disappear during the study.

### 8.3 Translation

For the first main study, prefer English content and avoid making translation central.

If translation is needed:

- provide it to both groups equally;
- log translation usage;
- do not make translation a condition-specific feature;
- preserve the original source;
- treat translation as a potential covariate.

Translation can affect comprehension, tone, and engagement, so it should not be introduced unless necessary.

### 8.4 Pipeline stages

The content pipeline should be implemented as a separate module or scripts directory.

Recommended directory:

```text
tools/content_pipeline/
  collectors/
  preprocessors/
  dedupe/
  quality_filter/
  human_review/
  exporters/
  schemas/
  README.md
```

Pipeline:

```text
1. Seed topic definition
2. Source list creation
3. Raw content collection
4. Metadata extraction
5. Article text extraction or fixed YouTube URL/ID validation
6. AI preprocessing (including official Gemini YouTube URL understanding)
7. Deduplication
8. Quality scoring
9. Human review
10. Content pool freeze
11. App import
```

### 8.5 Raw collection

For each raw item, collect:

- URL;
- source platform;
- source name/author/channel;
- title;
- publication date;
- thumbnail if allowed;
- full article text, or for video the fixed public YouTube URL/video ID (no stored transcript/audio/video);
- excerpt;
- language;
- estimated duration/length;
- raw metadata JSON;
- collection timestamp;
- collector version.

### 8.6 AI preprocessing

AI should produce:

- cleaned title;
- hook;
- short summary;
- long summary;
- key concepts;
- claims;
- stance labels;
- difficulty level;
- quality estimate;
- interestingness estimate;
- suggested questions;
- potential counterpoints;
- related concepts;
- prerequisites;
- topic relevance;
- safety concerns;
- content warnings if necessary.

For video candidates, use pinned `gemini-3.1-flash-lite` with the official YouTube URL media part (`gemini-2.5-flash-lite` was unavailable to this new API project during the 2026-07-12 pilot run). Persist only the validated structured wrapper/digest, URL/ID, and model/prompt/schema provenance. Runs use bounded concurrency and resumable artifacts so preparation can be spread across daily free-tier quotas. Article preprocessing continues to use the extracted article text path.

### 8.7 Human review

Human reviewers should check:

- source quality;
- factual reliability;
- content relevance;
- whether the hook is accurate;
- whether summary is faithful;
- whether suggested questions are useful;
- whether the content is appropriate for study participants;
- whether content is duplicate or near-duplicate;
- whether content has problematic bias or misinformation.

Review result fields:

- approved / rejected / needs edit;
- reviewer notes;
- quality score;
- interestingness score;
- educational value score;
- final difficulty score;
- final topic tags.

### 8.8 Content pool freezing

After review, generate a frozen content pool:

```text
data/content_pool_v1/
  topics.json
  posts.json
  concepts.json
  claims.json
  post_concept_edges.json
  post_claim_edges.json
  suggested_questions.json
  source_files/
  review_logs/
  manifest.json
```

The manifest should include:

- content pool version;
- generation date;
- preprocessing model versions;
- number of raw candidates;
- number approved;
- number rejected;
- review procedure summary.

---

## 9. Data Schemas

### 9.1 Topic

```ts
type Topic = {
  id: string;
  name: string;
  shortDescription: string;
  hooks: string[];
  coreConceptIds: string[];
  testRubricId: string;
  contentPoolVersion: string;
};
```

### 9.2 Post

```ts
type Post = {
  id: string;
  topicId: string;
  sourceUrl: string;
  sourcePlatform: "youtube" | "article" | "blog" | "newsletter" | "x" | "reddit" | "news" | "other";
  sourceName: string;
  author?: string;
  originalTitle: string;
  displayTitle: string;
  hook: string;
  shortSummary: string;
  longSummary?: string;
  language: string;
  durationSeconds?: number;
  readingTimeMinutes?: number;
  thumbnailUrl?: string;
  originalPublishedAt?: string;
  collectedAt: string;
  approvedAt?: string;

  qualityScore: number;        // 0-1
  interestingnessScore: number;// 0-1
  educationalValueScore: number;// 0-1
  difficulty: number;          // 0-1
  viewpoint?: "supportive" | "critical" | "neutral" | "mixed";

  conceptIds: string[];
  claimIds: string[];
  suggestedQuestionIds: string[];

  status: "raw" | "preprocessed" | "approved" | "rejected" | "frozen";
};
```

### 9.3 Concept

```ts
type Concept = {
  id: string;
  topicId: string;
  label: string;
  description: string;
  aliases: string[];
  parentConceptIds?: string[];
  prerequisiteConceptIds?: string[];
};
```

### 9.4 Claim

```ts
type Claim = {
  id: string;
  topicId: string;
  text: string;
  stance?: "pro" | "con" | "neutral" | "mixed";
  conceptIds: string[];
};
```

### 9.5 SuggestedQuestion

```ts
type SuggestedQuestion = {
  id: string;
  postId: string;
  topicId: string;
  text: string;
  type: "clarification" | "evidence" | "counterpoint" | "connection" | "implication" | "example" | "reliability";
  targetConceptIds: string[];
  targetClaimIds?: string[];
  generic: boolean;
};
```

### 9.6 UserQuestion

```ts
type UserQuestion = {
  id: string;
  userId: string;
  condition: "control" | "experimental";
  topicId: string;
  postId: string;
  text: string;
  source: "typed" | "suggested_question";
  suggestedQuestionId?: string;
  createdAt: string;

  extractedConceptIds: string[];
  extractedClaimIds?: string[];
  questionType?: string;
  unresolved?: boolean;
  aiAnswerId?: string;
};
```

### 9.7 AIAnswer

```ts
type AIAnswer = {
  id: string;
  userQuestionId: string;
  postId: string;
  answerText: string;
  citedPostIds: string[];
  citedSourceUrls?: string[];
  conceptIds: string[];
  claimIds?: string[];
  createdAt: string;
  modelName: string;
};
```

### 9.8 UserInteractionEvent

```ts
type UserInteractionEvent = {
  id: string;
  userId: string;
  condition: "control" | "experimental";
  topicId: string;
  timestamp: string;
  eventType:
    | "app_open"
    | "feed_impression"
    | "post_open"
    | "post_close"
    | "source_click"
    | "video_play"
    | "video_progress"
    | "question_suggestion_click"
    | "question_submit"
    | "ai_answer_view"
    | "save_post"
    | "not_interested"
    | "recommendation_reason_view"
    | "notification_received"
    | "notification_open"
    | "session_end";

  postId?: string;
  questionId?: string;
  recommendationId?: string;
  durationMs?: number;
  payload?: Record<string, unknown>;
};
```

### 9.9 Recommendation

```ts
type Recommendation = {
  id: string;
  userId: string;
  condition: "control" | "experimental";
  topicId: string;
  postId: string;
  generatedAt: string;

  strategy:
    | "topic_baseline"
    | "quality_baseline"
    | "diversity_baseline"
    | "continue"
    | "deepen"
    | "contrast"
    | "bridge"
    | "echo";

  score: number;
  reasonText: string;
  contributingQuestionIds?: string[];
  contributingConceptIds?: string[];
  contributingPostIds?: string[];
  componentScores?: Record<string, number>;
};
```

---

## 10. Graph-Memory Design

### 10.1 Two-layer graph structure

The system should maintain two graph layers:

1. **Global content graph**
   - built from the curated content pool;
   - same for all users;
   - includes posts, concepts, claims, and source relationships.

2. **Personal user graph-memory**
   - built from user behavior;
   - differs per participant;
   - includes viewed posts, asked questions, activated concepts, unresolved questions, repeated interests, and interaction weights.

### 10.2 Global graph nodes

- Topic
- Post
- Concept
- Claim
- Source
- SuggestedQuestion

### 10.3 Personal graph nodes

- User
- UserQuestion
- ViewedPost
- ActivatedConcept
- ActivatedClaim
- MemoryEchoCandidate
- InterestTrajectorySegment

### 10.4 Edge types

Global edges:

```text
Post --explains--> Concept
Post --mentions--> Concept
Post --supports--> Claim
Post --challenges--> Claim
Claim --about--> Concept
Claim --contrasts_with--> Claim
Concept --related_to--> Concept
Concept --prerequisite_of--> Concept
SuggestedQuestion --targets--> Concept
SuggestedQuestion --targets--> Claim
```

Personal edges:

```text
User --viewed--> Post
User --asked--> UserQuestion
UserQuestion --under--> Post
UserQuestion --asks_about--> Concept
UserQuestion --asks_about--> Claim
User --interested_in--> Concept
User --confused_about--> Concept
User --revisited--> Post
User --saved--> Post
User --skipped--> Post
UserQuestion --echoed_by--> Recommendation
Recommendation --served--> Post
```

### 10.5 User concept state

For each user and concept:

```ts
type UserConceptState = {
  userId: string;
  conceptId: string;
  exposureCount: number;
  questionCount: number;
  savedPostCount: number;
  skippedPostCount: number;
  lastActivatedAt?: string;
  interestWeight: number;      // 0-1
  uncertaintyWeight: number;   // 0-1
  familiarityEstimate: number; // 0-1
};
```

### 10.6 Updating concept weights

Initial simple rule:

```text
interestWeight +=
  +0.05 for feed impression
  +0.10 for post open
  +0.20 for source click or video progress > threshold
  +0.30 for user question involving concept
  +0.25 for save
  -0.15 for not interested
  -0.10 for repeated skip
```

Uncertainty can increase when:

- user asks clarification questions;
- user asks "what does this mean";
- AI classifies question as confusion;
- user asks repeated similar questions.

Familiarity can increase when:

- user repeatedly views posts on the concept;
- asks deeper questions;
- successfully explains concept in oral test or optional in-app reflection;
- clicks memory echo and continues.

---

## 11. Feed Orchestration Algorithm

### 11.1 Recommendation goal

The experimental feed should not simply recommend "more of the same".

It should orchestrate epistemic progression:

- continue old questions;
- deepen relevant concepts;
- contrast viewpoints;
- bridge concepts;
- echo prior curiosity;
- avoid redundancy.

### 11.2 Candidate generation

For each user feed refresh:

1. Get topic pool.
2. Remove already dismissed posts.
3. Penalize recently viewed posts.
4. Generate candidates from:
   - high-quality posts;
   - posts linked to active concepts;
   - posts linked to user questions;
   - posts supporting or challenging active claims;
   - posts bridging two active concepts;
   - posts suitable for memory echoes.

### 11.3 Scoring components

For experimental condition:

```text
Score(post, user) =
  0.25 * QuestionRelevance(post, user)
+ 0.20 * ConceptInterestMatch(post, user)
+ 0.15 * ContinuityWithRecentPosts(post, user)
+ 0.15 * NoveltyOrContrast(post, user)
+ 0.15 * ContentQuality(post)
+ 0.10 * DifficultyFit(post, user)
- 0.20 * RedundancyPenalty(post, user)
```

These weights are initial defaults and should be configurable.

### 11.4 Component definitions

#### QuestionRelevance

Measures whether the post answers, extends, complicates, or provides evidence for prior user questions.

Inputs:

- embeddings between user questions and post summaries;
- overlap between question target concepts and post concepts;
- claim support/challenge relationships;
- unresolved question status.

#### ConceptInterestMatch

Measures whether the post relates to concepts with high user interest weight.

Inputs:

- user concept interest weights;
- post concept tags;
- concept graph proximity.

#### ContinuityWithRecentPosts

Measures whether the post naturally follows recently viewed posts.

Inputs:

- recent post concepts;
- related concepts;
- source/stance transitions;
- same question cluster.

#### NoveltyOrContrast

Measures whether the post introduces a new angle or counterpoint.

Inputs:

- claim stance;
- contrast edges;
- underexplored neighboring concepts;
- viewpoint diversity.

#### ContentQuality

Static score from curation.

Inputs:

- human quality rating;
- educational value;
- interestingness;
- reliability.

#### DifficultyFit

Matches post difficulty to user familiarity.

Approximate rule:

- if user familiarity is low, prefer lower-to-medium difficulty;
- if user has multiple exposures/questions, allow higher difficulty;
- avoid content too shallow after repeated exploration.

#### RedundancyPenalty

Penalizes near-duplicates.

Inputs:

- embedding similarity to viewed posts;
- same source repetition;
- same claim repetition;
- repeated post format.

### 11.5 Orchestration strategies

The recommendation system should label each selected item with one of the following strategies.

#### Continue

Recommend content that directly continues a user's prior question.

Example reason:

> You asked yesterday how AI agents differ from chatbots. This post shows a concrete workflow example.

#### Deepen

Recommend content that explains a repeatedly activated concept in more depth.

Example reason:

> You have explored tool use several times. This article explains why tool use alone does not make a system autonomous.

#### Contrast

Recommend content with an opposing stance or critical view.

Example reason:

> You saved an optimistic post about AI agents. This post presents reliability concerns.

#### Bridge

Recommend content connecting two concepts the user has encountered separately.

Example reason:

> This post connects job displacement with reliability, two topics you have explored separately.

#### Echo

Revisit an older question through a new post.

Example reason:

> Three days ago you asked whether agents will replace entry-level workers. This new example revisits that question from the employer-cost perspective.

### 11.6 Diversity reranking

After scoring, rerank to avoid monotony.

Constraints:

- no more than 2 posts from the same source in one session;
- no more than 2 posts with same primary concept in a row;
- include at least one contrast or bridge item after sufficient history;
- mix video/article/opinion/explainer formats.

### 11.7 Control feed algorithm

Control condition should be strong but non-personal in the graph-memory sense.

Recommended scoring:

```text
ControlScore(post) =
  0.40 * ContentQuality(post)
+ 0.25 * TopicRelevance(post)
+ 0.15 * GeneralInterestingness(post)
+ 0.10 * DifficultyBalance(post)
+ 0.10 * Diversity(post)
- 0.20 * RecentlySeenPenalty(post)
```

Control may use session-level "not interested" or already-seen filtering for basic UX, but it should not use:

- prior user questions;
- concept weights from questions;
- unresolved question tracking;
- memory echo logic;
- graph-based continuation/counterpoint/bridge logic.

---

## 12. Recommendation Validation

Before running the field study, conduct a recommendation sanity check.

### 12.1 Preprocessing validation

Sample 100 posts.

Human reviewers evaluate:

- summary accuracy;
- concept tag accuracy;
- claim extraction accuracy;
- stance label accuracy;
- difficulty accuracy;
- suggested question usefulness.

### 12.2 Recommendation validation

Create synthetic or pilot user histories.

For each case, show reviewers:

```text
User history:
- Viewed Post A
- Asked Question Q
- Saved Post C

System recommendation:
- Post B
- Strategy: Contrast
- Reason: This post challenges the claim in Post C and addresses Q.
```

Reviewers rate:

- relevance;
- reason correctness;
- personalization;
- educational value;
- whether strategy label fits.

Compare experimental recommendations against baseline recommendations.

### 12.3 Algorithm verification tests

Implement unit tests:

- QuestionRelevance increases for posts sharing target concepts.
- Contrast candidates include opposing claims.
- Redundancy penalty suppresses near-duplicates.
- Echo recommendations require prior questions older than threshold.
- Control condition does not use user question history.
- Experimental recommendation reasons include contributing trace IDs.

---

## 13. Oral Explanation Assessment

### 13.1 Why oral explanation

The project does not aim to train rote recall. It aims to support curiosity-driven conceptual understanding.

Open-ended oral explanation better captures:

- ability to explain;
- ability to compare views;
- ability to connect concepts;
- ability to transfer understanding;
- ability to use examples.

### 13.2 Pretest structure

Pretest includes two oral questions.

#### Pretest A: General verbal baseline

Same question for everyone. Measures natural elaboration style.

Example:

> Please describe a movie, video, book, game, or article you recently enjoyed. What was it about, and why did you find it interesting?

Measures:

- natural speaking duration;
- word count;
- structure;
- example use;
- baseline willingness to elaborate.

#### Pretest B: Domain baseline

Topic-specific question before app use.

Example for AI agents:

> What do you currently understand by "AI agent"? How is it different from a normal chatbot, and what impact do you think it might have?

Measures:

- prior knowledge;
- domain vocabulary;
- conceptual relations;
- baseline stance.

### 13.3 Post-test

After 5–7 days, ask a different but related transfer discussion question.

Example:

> Some people argue that AI agents will replace many entry-level white-collar workers because they can complete multi-step tasks. Others argue this will not happen soon because agents still struggle with reliability, accountability, and human oversight. What is the core disagreement between these views? Which side do you find more convincing, and why?

### 13.4 Scoring dimensions

Use both behavioral and content-quality measures.

Behavioral:

- speaking duration;
- word count;
- number of examples;
- number of distinct claims;
- number of concept mentions.

Content/rubric:

- concept coverage;
- relationship understanding;
- stance comparison;
- counterargument awareness;
- evidence/example use;
- transfer ability;
- explanatory clarity;
- overall understanding depth.

### 13.5 Normalization

Do not treat speaking duration alone as learning.

Use Pretest A as verbal baseline.

Potential normalized features:

```text
DomainElaborationRatio = DomainResponseWordCount / GeneralBaselineWordCount
PostImprovement = PostDomainRubricScore - PreDomainRubricScore
NormalizedPostWordCount = PostWordCount / GeneralBaselineWordCount
```

### 13.6 Scoring process

Recommended process:

1. Transcribe audio.
2. Remove participant condition labels.
3. Human raters score blind using rubric.
4. LLM scoring can assist but should not be the only source.
5. Report inter-rater reliability.
6. Use LLM-coded concept counts as supplementary analysis.

---

## 14. Logging and Privacy

### 14.1 Required logs

Log only in-app behavior relevant to the study.

Events:

- app open;
- feed impression;
- post open;
- post close;
- time on post;
- source click;
- video progress if available;
- suggested question click;
- typed question submit;
- AI answer view;
- save;
- not interested;
- recommendation reason viewed;
- notification open;
- session end.

### 14.2 Do not collect

Do not collect:

- phone screen recordings during field deployment;
- app usage outside the study app;
- precise geolocation;
- contacts;
- other app names;
- clipboard;
- raw keystroke timing unless specifically approved;
- private data not necessary for the study.

### 14.3 Consent language

Participants should be told:

- the app logs their interactions within the study app;
- questions they ask AI are stored for research analysis;
- audio responses in pre/post tests are recorded and transcribed;
- data will be anonymized;
- they can withdraw according to the study protocol.

---

## 15. Product-to-Research Conversion Plan

### 15.1 High-level principle

The current Trellis product should be converted into a focused research prototype.

The research version should prioritize:

- experimental control;
- logging;
- reproducibility;
- stable content pool;
- matched conditions;
- system clarity.

It should deprioritize:

- product breadth;
- gamification;
- general chat;
- full personalization;
- unsupported integrations;
- social features;
- complex UI polish.

### 15.2 Features to keep

Keep or implement:

- mobile-first feed;
- real content post cards;
- post detail page;
- contextual AI Q&A;
- suggested questions;
- user interaction logging;
- content pool import;
- graph-memory backend;
- recommendation engine;
- condition assignment;
- study onboarding;
- post-test data export.

### 15.3 Features to remove or freeze

Remove/freeze for first paper:

- global free-form AI chat;
- public comments;
- social feed/community;
- full mindmap editor;
- visible editable knowledge graph;
- AI-generated posts as main content;
- podcast;
- token analytics;
- harvest/gamification economy;
- full news/YouTube live search;
- real-time crawler inside the participant app;
- Bilibili integration for first English study;
- flashcard/SRS as a core system.

### 15.4 Recommended repository structure

```text
src/
  app/
    onboarding/
    feed/
    post/
    ask/
    study/
  research/
    conditions/
    logging/
    assessment/
    export/
  content/
    import/
    schemas/
  graphMemory/
    graphStore.ts
    graphTypes.ts
    updateGraphFromEvent.ts
    updateGraphFromQuestion.ts
    userConceptState.ts
  recommendation/
    controlRanker.ts
    experimentalRanker.ts
    scoringComponents.ts
    orchestrationStrategies.ts
    diversityReranker.ts
    recommendationReasons.ts
  ai/
    postQuestionAnswering.ts
    questionConceptExtraction.ts
    answerGeneration.ts
    safetyRedirect.ts
  components/
    FeedCard.tsx
    PostDetail.tsx
    SuggestedQuestionList.tsx
    AskAboutPostPanel.tsx
    RecommendationReason.tsx
tools/
  content_pipeline/
    collectors/
    preprocessors/
    dedupe/
    quality_filter/
    human_review/
    exporters/
data/
  content_pool_v1/
docs/
  research_system_design.md
  experimental_design_cn.docx
  experimental_design_en.docx
```

---

## 16. Implementation Roadmap

### Phase 0: Rename and scope

- Adopt QuestionTrace or another final name.
- Update README.
- Add this document to `/docs`.
- Write a short project scope file.
- Disable unrelated product routes.

Deliverable:

- clean research README.

### Phase 1: Build health

- Ensure app builds.
- Ensure lint/typecheck pass.
- Remove dead code.
- Establish condition config.
- Establish logging infrastructure.

Deliverable:

- stable research app shell.

### Phase 2: Content pool pipeline

- Define schemas.
- Build collector scripts.
- Build AI preprocessing scripts.
- Build review UI or CSV workflow.
- Export frozen pool.

Deliverable:

- content_pool_v1 for one pilot topic.

### Phase 3: Feed and post UI

- Implement feed card.
- Implement post detail.
- Implement original source embed/link.
- Implement suggested questions.
- Implement Ask about this post.

Deliverable:

- participants can browse and ask questions.

### Phase 4: Graph-memory layer

- Implement global graph import.
- Implement user graph-memory.
- Extract concepts from questions.
- Update user concept states.
- Store question traces.

Deliverable:

- each question updates user graph-memory.

### Phase 5: Recommendation engine

- Implement control ranker.
- Implement experimental ranker.
- Implement scoring components.
- Implement strategies: Continue, Deepen, Contrast, Bridge, Echo.
- Implement recommendation reasons.
- Add unit tests.

Deliverable:

- two conditions produce different but comparable feeds.

### Phase 6: Study infrastructure

- Participant onboarding.
- Topic selection.
- Condition assignment.
- Logging export.
- Researcher dashboard or data dump.
- Pre/post-test support.

Deliverable:

- app can run pilot study.

### Phase 7: Pilot

- Run 3–5 internal/pilot users.
- Validate content quality.
- Validate logs.
- Validate recommendation reasons.
- Validate oral assessment flow.
- Fix issues.

Deliverable:

- ready for IRB / formal study.

---

## 17. Prompt Templates

### 17.1 AI preprocessing prompt

```text
You are preprocessing a real content item for a research study on curiosity-driven learning.

Input:
- Topic:
- Source URL:
- Title:
- Transcript or article text:

Tasks:
1. Write a faithful 1-sentence hook that makes the content interesting without exaggeration.
2. Write a 2-3 sentence summary.
3. Extract 5-8 key concepts.
4. Extract 1-3 central claims.
5. Label the stance of each claim if applicable.
6. Estimate difficulty from 0 to 1.
7. Estimate educational value from 0 to 1.
8. Estimate interestingness from 0 to 1.
9. Generate 5 suggested questions under the post:
   - clarification
   - evidence
   - counterpoint
   - connection
   - implication
10. Identify possible related or contrasting concepts.
11. Flag any potential quality or reliability concerns.

Rules:
- Do not invent facts beyond the source.
- Keep the hook accurate.
- If the source is low quality or too vague, mark it for rejection.
- Output JSON only.
```

### 17.2 Question extraction prompt

```text
You are analyzing a learner's question under a specific post.

Input:
- Topic:
- Post title:
- Post summary:
- Known concepts:
- Known claims:
- User question:

Tasks:
1. Classify the question type.
2. Identify which concepts the question asks about.
3. Identify which claims the question asks about, if any.
4. Determine whether the question expresses confusion, curiosity, skepticism, or request for examples.
5. Mark whether this question should be considered unresolved after a simple answer.
6. Suggest graph edges to add.

Output JSON only.
```

### 17.3 Contextual answer prompt

```text
You are an AI assistant inside a research app. The user is asking about a specific post.

Rules:
- Answer only in the context of the current post, the selected study topic, and approved content pool.
- Do not become a general-purpose homework assistant.
- If the user asks something unrelated, gently redirect them to the post/topic.
- Be concise but useful.
- Use examples from the current post when possible.
- Mention uncertainty when the source does not support a claim.

Input:
- Topic:
- Current post:
- Post summary:
- User question:
- Relevant approved content snippets:
- User prior question traces, if experimental condition:

Answer:
```

### 17.4 Recommendation reason prompt

```text
Generate a short user-facing recommendation reason.

Input:
- Strategy: Continue / Deepen / Contrast / Bridge / Echo
- Current recommended post:
- Contributing prior question, if any:
- Contributing concept(s):
- Contributing prior post(s):

Rules:
- One sentence.
- Do not reveal internal scores.
- Make it feel helpful, not creepy.
- Do not overclaim.
```

---

## 18. Key Design Decisions and Rationale

### Decision 1: Use real curated content, not AI-generated posts

Reason:

- AI-generated posts were low-quality in the original product.
- Real content is more engaging.
- AI is better used for preprocessing, summarization, tagging, and linking.

### Decision 2: Use post-centered Q&A, not global chat

Reason:

- Keeps questions within the study topic.
- Prevents users from asking unrelated homework questions.
- Makes user questions easier to map into the content graph.
- Makes the app feel like content exploration, not a generic chatbot.

### Decision 3: Both groups get Ask about this post

Reason:

- Isolates the effect of graph-memory orchestration.
- Prevents confounding AI Q&A access with the experimental treatment.

### Decision 4: Do not show full knowledge graph

Reason:

- Avoids confounding with graph visualization effects.
- Avoids collision with MindTrellis/ConceptScape.
- Keeps focus on feed orchestration.

### Decision 5: Use three topics

Reason:

- Preserves user choice and curiosity.
- Keeps content pool and assessment manageable.
- Enables topic-stratified randomization.

### Decision 6: Use 200–400 curated posts per topic

Reason:

- Enough variety for personalized recommendations.
- Still feasible for AI preprocessing plus human review.
- Avoids live search instability.

### Decision 7: Use oral explanation assessment

Reason:

- Better aligned with conceptual understanding than quizzes.
- Reduces test-like pressure.
- Captures explanation richness, comparison, and transfer.

### Decision 8: Use pretest verbal baseline

Reason:

- Controls for natural differences in how much participants talk.
- Allows normalized analysis of oral explanation length and richness.

---

## 19. What Codex / Code Agents Should Build First

Priority order:

1. Research README and scope cleanup.
2. Data schemas.
3. Frozen content pool importer.
4. Feed UI with static posts.
5. Post detail page.
6. Suggested questions.
7. Ask about this post.
8. Logging.
9. User question storage.
10. Graph-memory update from questions.
11. Control ranker.
12. Experimental ranker.
13. Recommendation reason display.
14. Study onboarding and condition assignment.
15. Data export.

Do not build first:

- public comments;
- visible graph editor;
- social features;
- real-time crawler in app;
- gamification;
- podcast;
- flashcard system.

---

## 20. Open Questions

These require further decision before implementation.

1. Final system name.
2. Final three study topics.
3. Participant language and country.
4. Whether all content must be English.
5. Whether to allow source click-out or embed content inside app.
6. How to handle unavailable/deleted source content.
7. How many notifications per day.
8. Whether to personalize suggested questions in experimental condition.
9. Whether to include a small "exploration path" UI.
10. Human review staffing for content pool.
11. IRB/ethics requirements for logging and audio recording.

---

## 21. Success Criteria

The research prototype is successful if:

- participants can use it naturally for several days;
- the content is interesting enough that users voluntarily return;
- both conditions are fair and comparable;
- graph-memory condition produces interpretable recommendation reasons;
- logs are complete and analyzable;
- oral assessment data can be scored reliably;
- the paper can argue that post-level questions are useful learner traces for future feed orchestration.

The project should not be judged by whether it becomes a polished consumer app. It should be judged by whether it can support a clean, defensible HCI/learning study.

---

## 22. Final Recommended Framing

Use this framing in future documents and code comments:

> **QuestionTrace is a research prototype for studying post-centered graph-memory learning feeds. It uses a fixed curated pool of real multimedia posts. Users ask AI questions under posts; those questions become structured learner traces. In the experimental condition, these traces drive future feed orchestration through continuation, deepening, contrast, bridging, and memory echo strategies. The system is evaluated through a multi-day field study comparing it to a matched multimedia feed without graph-memory orchestration.**

Avoid:

> "AI learning feed"

Use:

> "post-centered graph-memory feed orchestration"

Avoid:

> "AI tutor"

Use:

> "contextual post-level Q&A as learner trace collection"

Avoid:

> "knowledge graph recommendation"

Use:

> "graph-memory orchestration from curiosity question traces"

Avoid:

> "mind map"

Use:

> "latent learner memory graph"

---

## 23. Immediate Next Steps

1. Rename the research branch or README framing from TrellisFeed to QuestionTrace or another chosen name.
2. Update previous research documents to reflect that both groups have Ask about this post.
3. Build the content schema and content pipeline first.
4. Choose the three study topics.
5. Build one pilot topic with 50 approved posts before scaling to 200–400.
6. Implement feed and post detail UI using frozen data.
7. Implement logging before personalization.
8. Implement graph-memory ranker only after logs and static feed work.
9. Run an internal pilot before recruiting participants.

---

**End of document.**

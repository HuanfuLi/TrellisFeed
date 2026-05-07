---
created: 2026-05-07T09:45:44.620Z
title: Fix cosine similarity threshold & cache miss
area: general
files:
  - app/src/services/canonical-knowledge.service.ts
  - app/src/providers/embedding/index.ts
  - app/src/services/question.service.ts
---

## Problem

The system currently suffers from two main issues regarding semantic similarity:
1. **Hardcoded Thresholds:** The `ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD` is hardcoded at `0.82` in `canonical-knowledge.service.ts`, ignoring user-configurable settings in `settings.embeddingDebug.similarityThreshold`. This makes the system inflexible for different model qualities.
2. **Redundant Embedding Calls (Cache Miss):** The `embedText` provider lacks a caching layer. During the Q&A flow, the same text is often embedded twice: once in `questionService.ask` for context retrieval and again during the asynchronous `classifyAndAnchorIncremental` if the vector doesn't persist or if the pre-check needs it. This increases latency and API costs.

## Solution

1. **Parameterize Thresholds:** Update `preCheckAnchorMatch` and `getSemanticCandidates` to read from `settingsService.getSync().embeddingDebug.similarityThreshold`.
2. **Implement Embedding Cache:** Add a simple memory-based (or `localStorage`-backed) cache to `app/src/providers/embedding/index.ts` to skip network calls for identical strings.
3. **Optimize Pipeline Hand-off:** Ensure that the `embeddingVector` generated during `ask` is consistently passed through to the classification service to avoid even a cache lookup where possible.

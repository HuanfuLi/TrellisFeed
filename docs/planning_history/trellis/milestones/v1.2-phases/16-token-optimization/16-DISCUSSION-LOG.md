# Phase 16: Token Optimization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 16-token-optimization
**Areas discussed:** Prompt trimming strategy, maxTokens tuning, Context budget management, Token usage monitoring

---

## Prompt Trimming Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Aggressively compress all prompts | Shorten all 13 system prompts significantly | |
| Compress but keep format/examples | Shorten instructions, keep JSON schemas and one example | |
| Review all prompts first | Display all prompts before deciding what to trim | ✓ |

**User's choice:** Asked to see all 13 prompts displayed first. After reviewing, decided all prompts are fine as-is — no trimming needed.
**Notes:** User reviewed all 13 system prompts and the image generation prompt. Only structural change is to Question Answering (session history).

---

## maxTokens Tuning

| Option | Description | Selected |
|--------|-------------|----------|
| Audit and tune per call site | Set specific maxTokens for each of 13 call sites | |
| Leave as-is for robustness | Keep 4096 default since providers charge actual tokens, not the cap | ✓ |

**User's choice:** Leave as-is
**Notes:** User asked whether maxTokens affects price. Confirmed it does not — it's a ceiling, not a charge. User decided to keep current values for robustness.

---

## Context Budget Management

| Option | Description | Selected |
|--------|-------------|----------|
| Reduce context amounts | Send fewer Q&As per call | |
| Use append-only session history | Send full session as message array for KV-cache benefits | ✓ |

**User's choice:** Append-only session history for Question Answering
**Notes:** User noticed ask flow only sends 1 user message per call despite being in a session. Proposed using full session history to leverage provider KV-cache (50-90% cheaper on cached input tokens). This also improves answer quality. Session data already exists via sessionService.

---

## Token Usage Monitoring

| Option | Description | Selected |
|--------|-------------|----------|
| Per-service breakdown | Track tokens per service (Ask, Posts, Planner, etc.) | ✓ |
| Single running total | Just one aggregate counter | |

**User's choice:** Per-service breakdown

| Option | Description | Selected |
|--------|-------------|----------|
| Parse API response usage data | Extract prompt_tokens/completion_tokens from provider responses | ✓ |
| Client-side estimation | Use chars/4 heuristic or lightweight tokenizer | |

**User's choice:** Parse usage data from API responses
**Notes:** User wants monitoring in Settings > Developer section. Must be designed as pluggable module — local storage now, remote server in future milestone. Plan ahead for plug-and-play swap.

---

## Claude's Discretion

- Token usage storage format and aggregation granularity
- Developer UI presentation (table vs chart)
- Provider-specific usage extraction implementation details

## Deferred Ideas

None — discussion stayed within phase scope

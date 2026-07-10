---
created: 2026-05-21T19:31:00.000Z
title: First LLM response after app start very slow (~1 min cold start)
area: performance
files:
  - app/src/state/useQuestions.ts
  - app/src/providers/llm/index.ts
  - app/src/services/db.service.ts
---

## Problem

Surfaced during device UAT (2026-05-21). The FIRST Q&A roundtrip after launching
the app can take up to ~1 minute; subsequent LLM responses are normal/fast. The
one-off nature points at cold-start initialization on the first request path,
not the LLM provider itself.

## Likely suspects (to confirm during triage)

- First-request initialization: IndexedDB backend hydration / in-memory mirror
  warm-up (Phase 55-07) being awaited on the first ask.
- Embedding model / provider client lazy init or first-call handshake
  (cold connection, token, or model warm-up).
- First-turn graph-context assembly (`formatCandidateContextPack`,
  candidate retrieval) running uncached on turn 1.
- Provider KV-cache miss on first turn is expected, but ~1 min is beyond that —
  measure where the time actually goes.

## Direction

Add timing instrumentation around the first-ask path (provider call vs. DB
hydration vs. embedding vs. context assembly) to localize the stall before
fixing. Do NOT ship a hypothesis-only fix (CLAUDE.md device-bug rule).

## Routing

Triage into a v1.7 perf phase. NOT part of Phase 55.1.

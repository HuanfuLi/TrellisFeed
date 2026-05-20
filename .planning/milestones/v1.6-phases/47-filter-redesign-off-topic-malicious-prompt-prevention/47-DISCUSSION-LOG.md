# Phase 47: Filter Redesign — Off-Topic + Malicious Prompt Prevention - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 47-filter-redesign-off-topic-malicious-prompt-prevention
**Areas discussed:** Pre-LLM gate UX, Override surface placement, Classifier constraints, Eval set seeds

---

## Pre-LLM gate UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline message in thread | Blocked prompt appears in thread with styled rejection from Trellis; no LLM was called | |
| Toast + scrub | Toast notification fires; prompt not added to thread | |
| Inline + override affordance | Same as inline, plus explicit "Send anyway" override button | ✓ (initial) |

**User's first choice:** Inline + override affordance.

**Course-correction follow-up question:** "When the user taps 'Send anyway' on a blocked prompt, what happens next?" (Bypass classifier / Bypass + mark off-topic / Bypass + prompt user to confirm scope.)

**User's response (rejected the question's premise):** "Kinda weird. If user can override malicious attempt, what is the point of detecting it? We should focus on making prompts safe instead of catching it and let user override."

**Resolved direction:** Block-malicious surface keeps the inline-message style but **drops the override button**. Bracketing (FILTER-03) is the actual safety mechanism for legitimate-looking-scary questions; the malicious classifier is intentionally narrow (D-03) and override-free.

### Follow-up — what should the narrow malicious classifier still catch?

| Option | Description | Selected |
|--------|-------------|----------|
| DoS / token-waste spam | Long, repetitive, nonsense payloads — bracketing doesn't help | ✓ |
| Known jailbreak templates | Embedding match to curated DAN / role-swap / instruction-override corpus | ✓ |
| Disallowed-content requests | CSAM / weapons / malware authoring | ✓ |
| None — bracketing is enough | Trust bracketing fully; remove malicious classifier | |

**User's choice:** All three (DoS, jailbreak templates, disallowed content). Drives D-03 in CONTEXT.md.

---

## Override surface placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in chat thread | Per-message indicator + tap-toggle | |
| Dedicated review surface | Separate "Flagged exchanges" screen | |
| Both — inline + review surface | Indicator inline, action on dedicated screen | |
| Long-press menu in chat | Hidden under long-press, no default indicator | |

**User's response (no option selected):** "This should has been implemented. Check code."

**Resolved direction:** Override UI is already fully implemented (inline ⚠️ "Off-topic" badge → tap → "Save anyway" buttons → `patchQuestion({flagged: false})`). All 12+ downstream consumers gate on `flagged`. **Don't redesign.** One real gap surfaced: `patchQuestion` doesn't trigger `classifyAndAnchorIncremental` on override, so flagged → not-flagged questions become visible-but-unclassified. Phase 47 closes that gap (D-06 in CONTEXT.md).

---

## Classifier constraints

### First framing (rejected)

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse user's configured LLM | Classifier uses same provider/key as answer LLM | |
| Allow separate cheap/fast classifier | Researcher recommends a small dedicated model; new Settings field | |
| Local-only classifier (no network) | In-app embedding model (transformers.js); restricts to embedding strategies | |

**User's response:** "Why we need a pre-LLM classifier to fire another LLM call? Explain"

**Course correction:** I had assumed LLM-based was the default; the question presumed one of three strategies (LLM-only / embedding / hybrid) but framed as if LLM was given. Reframed: classifier doesn't have to use an LLM at all.

### Second framing (operator-driven decision)

**User's directional answer:** "Hybrid with regex as first layer and embedding as second. The original design of off-topic filter should also contained LLM as second layer, but it was never invoked in real use cases."

**Resolved:** Strategy is pre-locked here, not deferred to research. Hybrid — narrow regex (Layer 1) + embedding-similarity (Layer 2). No LLM in classifier path. Drives D-07/D-08/D-11 in CONTEXT.md.

### Corpus shape

| Option | Description | Selected |
|--------|-------------|----------|
| Repo-only static JSON, build-time embedded | Ship `filter-corpus.json` with embeddings precomputed | ✓ (initial) |
| Repo-only static JSON, lazy-embed at first ask | JSON in repo; embeddings computed at runtime with user's provider | |
| Repo seed + user-extendable list | Repo seed plus user-added exemplars via Settings | |

**User's choice:** Build-time embedded.

### Embedding model (course correction)

I flagged that build-time embeddings are model-specific and won't compare against the user's runtime embedding model.

| Option | Description | Selected |
|--------|-------------|----------|
| Local in-app model (transformers.js) | Bundled model, ~80MB, zero per-ask cost | |
| Hardcoded cloud embedding | Trellis-managed key for classifier only | |
| Reuse user's embedding config + recompute corpus on config change | Runtime embeddings, cache locally with `(provider, model)` key | ✓ |

**User's choice:** Reuse user's embedding config + recompute on config change. Drives D-09/D-10 in CONTEXT.md (corpus is repo-only static JSON of **text labels**; embeddings are runtime, not build-time).

### Failure mode

| Option | Description | Selected |
|--------|-------------|----------|
| Allow + flag (graceful degrade) | Treat as on-topic on classifier failure | |
| Block ask + show error | Don't answer if classifier is down | |
| Allow + flag with regex-only fallback | Layer 1 regex only on failure; flag based on regex match | ✓ |

**User's choice:** Layer 1 regex only on failure, allow ask through. Drives D-12 in CONTEXT.md.

---

## Eval set seeds

### First framing (clarification needed)

**User's response:** "What does this do? I need clarification"

I explained: eval set is a regression-test fixture — `(input, expected_label)` pairs that lock in classification behavior. CI fails if classifier output diverges; seed categories are which failure modes get locked.

### Second framing — which categories must seed v1.6 eval

| Option | Description | Selected |
|--------|-------------|----------|
| Classic injection patterns | DAN, "ignore previous", role-swap, instruction-override | ✓ |
| Foreign-language injection | Same patterns in zh/es/ja | ✓ |
| Encoded payloads | Base64, leetspeak, zero-width splits | ✓ |
| Ambiguous edge cases | Legitimate questions that look like meta/greetings | (rejected — see below) |

**User's response on the rejected option:** "The follow up legitimate question not-flagged has already been implemented by design and is currently working. Check code"

**Resolved:** `QuestionFilterContext { priorQuestion, priorAnswer }` is plumbed end-to-end through `useQuestions.askStreaming` → `question.service.ask` → `evaluateQuestion`. Existing follow-up handling must not regress; the new Layer 2 must consume this context (D-11). No separate eval seed needed because the plumbing already exists. Drives D-16/D-17 in CONTEXT.md.

---

## Claude's Discretion

The following items were left for the researcher rather than locked:

- Specific Layer 2 decision rule (top-K nearest neighbor vs. per-class centroid distance vs. per-label thresholds).
- Specific narrow Layer 1 regex pattern set (operator hint: greetings, single-token spam, bare backchannels).
- Bracketing delimiter convention (XML / fenced / unicode separator); constraint is byte-stability for KV-cache.
- Initial corpus size per label.
- Cache-key encoding for `(provider, model)` embeddings.
- Whether the pre-gate runs synchronously inside `askStreaming` or as a separate awaited step.
- Whether Layer 1 regex is fast-path (skip Layer 2 on confident match) or always-run-both with confidence merging — operator's "narrow first layer" hint suggests fast-path.

## Deferred Ideas

- User-extendable corpus (Settings affordance for "this is/isn't off-topic for me") — possible v1.7+ with guardrails against silent label degradation.
- Build-time embedded corpus — rejected for v1.6; revisit if Trellis ever bundles a fixed embedding model independent of the user's general config.
- Standalone "review flagged" bulk-cleanup screen — not needed; inline override covers per-message recovery.
- Encoded-payload normalization (base64 decode, leetspeak collapse, zero-width strip) — researcher decides whether to invest or accept documented-limit status (D-16).
- AI-suggested classifier corrections (LLM proposes corpus additions on borderline confidence) — out of scope; would reopen the no-LLM-in-classifier-path decision.

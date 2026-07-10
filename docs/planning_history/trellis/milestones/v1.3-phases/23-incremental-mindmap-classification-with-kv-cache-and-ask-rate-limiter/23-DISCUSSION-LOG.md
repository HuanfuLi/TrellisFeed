# Phase 23: Incremental Mindmap Classification with KV Cache and Ask Rate Limiter - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 23-incremental-mindmap-classification-with-kv-cache-and-ask-rate-limiter
**Areas discussed:** Pipeline conversation design, Fallback & error strategy, Rate limiter scope & UX, Migration & cleanup

---

## Pipeline Conversation Design

| Option | Description | Selected |
|--------|-------------|----------|
| ID-based selection | Present candidates with IDs, LLM responds with ID string | |
| Name-based selection | Present names only, requires fuzzy matching | |
| Index-based selection | Numbered list, LLM responds with index number | ✓ |

**User's choice:** Index-based selection
**Notes:** Most compact format, works well with the append-only conversation model.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Selection + name only | Each step returns index or NEW+name. Keeps responses tiny. | ✓ |
| Selection + full metadata | Also returns briefAnswer, keyword, placementReason. Richer but larger. | |

**User's choice:** Selection + name only
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| System: role only, User: question + candidates | Stable system prompt maximizes KV cache | ✓ |
| System: role + question, User: candidates only | Cleaner user messages but breaks KV cache | |

**User's choice:** System prompt is role-only, all variable content in user messages
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Append-only conversation | Each step appends to same message array. Full KV cache reuse. | ✓ |
| Independent calls with summary | Fresh call each time with prior decisions summarized. No KV cache. | |

**User's choice:** Append-only conversation
**Notes:** None

---

## Fallback & Error Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to single-call | Abandon pipeline, run old classifyAndAnchor | |
| Retry the failed step once | Retry before falling back | ✓ |
| Leave unanchored | No classification, user reorganizes manually | |

**User's choice:** Retry the failed step once
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to single-call classifyAndAnchor | Run existing single-call if retry fails | ✓ |
| Leave unanchored, log warning | Question stays without anchor | |

**User's choice:** Fall back to single-call as final fallback after retry
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Treat as step failure, trigger retry | Invalid response = failed step | ✓ |
| Try to fuzzy-match the response | Attempt name matching before failing | |

**User's choice:** Treat as step failure
**Notes:** None

---

## Rate Limiter Scope & UX

| Option | Description | Selected |
|--------|-------------|----------|
| Per-day counter | Daily limit, resets at midnight | |
| Rolling window (per hour) | More granular but complex | |
| Monthly quota | Total per month | ✓ |

**User's choice:** Monthly quota
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Toast + disabled send button | Toast message and disable send | |
| Toast only, still allow sending | Warning but no block | |
| Inline banner in Ask screen | Persistent banner with count and reset date | ✓ |

**User's choice:** Inline banner in Ask screen
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Under LLM config section | Group with LLM settings | |
| New 'Usage' section | Dedicated section for usage | |

**User's choice:** Combine with existing "Token Usage" section, rename to "Usage"
**Notes:** User specified merging with the existing Token Usage section rather than creating a brand new section.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Off by default (0 = unlimited) | No limit unless user sets one | ✓ |
| Default limit (e.g. 100/month) | Ship with reasonable default | |

**User's choice:** Off by default (0 = unlimited)
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Only show when near/at limit | Banner appears at 80%+ usage | ✓ |
| Always show when limit is set | Persistent counter | |
| Show in Settings only | No Ask screen banner | |

**User's choice:** Only show when near/at limit
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Hard block — disable send | Send button disabled at limit | ✓ |
| Soft warning — allow override | Warning but users can still send | |

**User's choice:** Hard block — disable send
**Notes:** None

---

## Migration & Cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| Keep as fallback | Old classifyAndAnchor stays for error recovery | ✓ |
| Remove entirely | Clean break, only new pipeline | |

**User's choice:** Keep as fallback
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Leave as-is | Existing unanchored nodes stay, users can Re-organize | ✓ |
| Auto-classify on first load | Run pipeline on all unanchored nodes at startup | |

**User's choice:** Leave as-is
**Notes:** No surprise LLM costs on upgrade.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Keep Re-organize separate | Full reorg keeps its own LLM call | ✓ |
| Unify under pipeline | Re-organize iterates nodes through pipeline | |

**User's choice:** Keep Re-organize separate
**Notes:** Different use cases — pipeline is for incremental, Re-organize is for bulk.

---

## Claude's Discretion

- Prompt template wording and JSON schema enforcement
- localStorage key naming for rate limit counter
- Exact "near limit" threshold (80% suggested)
- Code structure for new pipeline function alongside old classifyAndAnchor

## Deferred Ideas

None — discussion stayed within phase scope

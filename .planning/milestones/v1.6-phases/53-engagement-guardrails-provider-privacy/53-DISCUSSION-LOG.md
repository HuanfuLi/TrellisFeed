# Phase 53: Provider Privacy + Non-Pushy Guardrail - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 53-Provider Privacy + Non-Pushy Guardrail
**Areas discussed:** Phase premise (rescope), PRIVACY-01 enforcement style

---

## Phase premise / rescope

The operator challenged the phase itself: "reviews are designed not to be pushy and there
should not be any stop cue. The review progress is only designed for user to get reward, not
mandated by goal." Identified that a prior planning agent over-translated professor Q4
(engagement vs learning) into coercive product machinery (LEARN-01 mandated goal, LEARN-02 stop
cue, LEARN-03 forced reflection) — the same over-translation pattern as professor Q1
(graph-transparency feature the operator previously rejected).

| Option | Description | Selected |
|--------|-------------|----------|
| Rescope to privacy + guardrail | Keep PRIVACY-01 (goldens over existing private fields) + LEARN-04 as a no-streaks/likes/leaderboards/stop-cues guardrail test; drop LEARN-01/02/03 to Out of Scope; edit ROADMAP.md + REQUIREMENTS.md | ✓ |
| Drop Phase 53 entirely | Reward-based design already answers Q4; no new private fields; close v1.6 at Phase 52 | |
| Privacy only | Keep just PRIVACY-01; skip the LEARN-04 guardrail test | |
| Keep as-is | Build goals, stop cues, reflection prompts as originally specified | |

**User's choice:** Rescope to privacy + guardrail.
**Notes:** ROADMAP.md and REQUIREMENTS.md edited to move LEARN-01/02/03 to Out of Scope, narrow
PRIVACY-01 to existing fields, and rename the phase. Active v1.6 requirements 26 → 23. Durable
design principle saved to auto-memory (feedback_no_pushy_engagement_mechanics.md).

---

## PRIVACY-01 enforcement style

| Option | Description | Selected |
|--------|-------------|----------|
| Tests + structural assertion | Payload goldens for representative flows + structural test that no provider call-site reads the private services; no runtime scrubber | ✓ |
| Runtime sanitizer + tests | Add a scrubber at the chatCompletion/chatStream/synthesize chokepoint that strips private data before fetch, plus goldens | |
| Goldens only | Just payload goldens; skip the structural call-site assertion | |

**User's choice:** Tests + structural assertion.
**Notes:** Private fields live in separate localStorage and are not interpolated into prompts —
exclusion holds by construction. A free-text runtime scrubber would be fragile and add per-call
cost. Guarantee structurally instead.

---

## Claude's Discretion

- Exact test file names/locations and whether the structural call-site assertion is one test or split per provider entry point.

## Deferred Ideas

- Daily learning goal / stop cue / reflection prompts (was LEARN-01/02/03) — recorded as Out of Scope (not for re-litigation). Not parked as a future idea.

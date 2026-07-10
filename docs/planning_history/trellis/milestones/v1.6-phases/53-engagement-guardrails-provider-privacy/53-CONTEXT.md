# Phase 53: Provider Privacy + Non-Pushy Guardrail - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers TWO test-driven guarantees — **no new user-facing feature, no UI**:

1. **PRIVACY-01 — Provider payload boundary.** Prove (and lock with tests) that private user
   data is excluded from outbound LLM and TTS provider requests by default. The private fields
   that exist *today*: tags/collections, saved/liked/history (engagement signals), and graph
   correction logs. Goal/reflection fields are NOT in scope because they are not being built.

2. **LEARN-04 — Non-pushy guardrail.** A guardrail test that codifies Trellis's design stance:
   the codebase introduces NO public likes, leaderboards, streak pressure, stop-cue
   interstitials, mandated daily goals, or engagement-maximizing loops. This is the only
   surviving LEARN requirement.

**Rescoped 2026-05-20.** The phase was originally "Engagement Guardrails + Provider Privacy"
and included LEARN-01 (mandated daily goal), LEARN-02 (stop cue), and LEARN-03 (sparse
reflection prompts). The operator rejected that premise: Trellis reviews are **reward-based,
not mandate-based, and never pushy**, and the existing opt-in review/trellis loop is itself the
answer to the engagement-vs-learning question. Those three requirements were moved to Out of
Scope in REQUIREMENTS.md. Do NOT plan goals, stop cues, or reflection prompts.

</domain>

<decisions>
## Implementation Decisions

### Scope (rescope)
- **D-01:** Phase narrows to LEARN-04 (guardrail test) + PRIVACY-01 (payload goldens). LEARN-01/02/03 are dropped to Out of Scope — see REQUIREMENTS.md. No new UI; ROADMAP UI hint set to "no".
- **D-02:** Reward-based, non-pushy engagement design is a locked product principle. No counter-mechanics (stop cues, mandated goals) are added; the *absence* of coercive mechanics is the deliverable, enforced by a test.

### PRIVACY-01 — enforcement style
- **D-03:** Enforce by **tests + structural assertion**, NOT a runtime scrubber.
  - Golden tests assert known private-field content never appears in the outbound LLM/TTS payload for representative real flows (Ask chat, podcast generation, post-essay/news streaming, flashcard extraction, classification, TTS synthesize).
  - PLUS a structural test asserting no provider call-site reads the private services (engagement / collections / graph-edit-journal) when assembling provider payloads.
  - Rationale: the private fields live in separate localStorage and are not currently interpolated into prompts — exclusion is true *by construction*. A runtime string-scrubber over free text would be fragile and add per-call cost. Guarantee it structurally; don't scrub.
- **D-04:** Field inventory to protect: tags/collections (`trellis_collections_v1`), engagement signals saved/liked/dismissed/savedPodcasts (`trellis_engagement_v1`), graph correction logs (`trellis_graph_edit_log`). "history" = engagement save/liked/post-history.
- **D-07 (scope-defining, decided 2026-05-20 after research):** `reorganizeMindmap` (`canonical-knowledge.service.ts:1650-1654`) intentionally injects graph-edit-journal entries into the reorg LLM prompt ("Manual corrections to preserve") — a Phase 48 GRAPH-04 feature that stops the LLM undoing manual graph edits. PRIVACY-01 grants a **scoped exception**: the graph-edit-journal may be read ONLY by `reorganizeMindmap`. The structural assertion must allowlist exactly that one call-site and FAIL if any OTHER provider call-site reads the journal. Document the exception + reason in the test message. Do NOT change reorg behavior (rejected the "minimize what's sent" option — keep GRAPH-04 intact). Operator chose the scoped exception over dropping the journal from PRIVACY-01.

### LEARN-04 — guardrail test
- **D-05:** A test (source-pattern / structural guard, in the spirit of the existing source-pattern guards) asserts the codebase contains no streak counter, leaderboard, public-like display, stop-cue interstitial, or mandated-goal mechanic. Negative-invariant style — like `tests/components/InfoFlow.video-tap-emit.test.mjs` which asserts removed mechanics stay removed.
- **D-06:** The existing `liked` engagement signal stays a HIDDEN recommendation signal (not displayed) — that is allowed and is not a "public like". The guardrail must not false-positive on it.

### Claude's Discretion
- Exact test file locations/names, and whether the structural call-site assertion is one test or split per provider entry point. Researcher/planner decide based on existing `tests/providers/` conventions.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & scope (read first)
- `.planning/REQUIREMENTS.md` §LEARN, §PRIVACY, §"Out of Scope (v1.6)" — the rescoped LEARN-04 + PRIVACY-01 text and the explicit drop of LEARN-01/02/03. The Out-of-Scope row "Mandated daily learning goals, stop-cue interstitials, and forced reflection/retrieval prompts" is the authority on what NOT to build.
- `.planning/ROADMAP.md` §"Phase 53: Provider Privacy + Non-Pushy Guardrail" — goal + 2 success criteria + the rescope note.

### Provider payload chokepoints (PRIVACY-01 target surfaces)
- `app/src/providers/llm/index.ts` — `chatCompletion` / `chatStream` funnel; messages pass through `applyLocaleDirective` then provider-specific body builders (openAI / claude / gemini). All LLM payloads exit here.
- `app/src/providers/tts/index.ts` — `synthesize`; all TTS payloads exit here.
- `app/src/providers/llm/locale-directive.ts`, `app/src/providers/llm/user-content-bracketing.ts` — existing payload-shaping middleware (precedent for where a boundary check could sit if ever needed).

### Private data sources to keep OUT of payloads
- `app/src/services/engagement.service.ts` — `trellis_engagement_v1` (saved/liked/dismissed/savedPodcasts), ID-only.
- `app/src/services/collection.service.ts` — `trellis_collections_v1` (tags/bookmarks), ID-only.
- `app/src/services/graph-edit-journal.service.ts` — `trellis_graph_edit_log` (graph correction logs), append-only.

### Test precedent
- `tests/providers/` — existing provider tests (`llm-bracketing.test.mjs`, `llm-locale-injection.test.mjs`, `tts-bracketing-exempt.test.mjs`, `tts-locale.test.mjs`). New payload goldens belong alongside these.
- `tests/components/InfoFlow.video-tap-emit.test.mjs` — negative-invariant guard pattern to mirror for LEARN-04.

### Durable design memory
- `~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_no_pushy_engagement_mechanics.md` — the no-pushy stance.
- `~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_professor_qs_private_vs_product.md` — the over-translation pattern this rescope corrects.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/providers/` harness + `node --test` (tsx loader) — payload goldens reuse this setup; assert against the JSON body passed to `fetch`.
- Negative-invariant source-pattern guard tests (e.g. `InfoFlow.video-tap-emit.test.mjs`) — directly reusable shape for the LEARN-04 guardrail.

### Established Patterns
- All LLM traffic funnels through `chatCompletion`/`chatStream`; all TTS through `synthesize`. Single chokepoints make the structural assertion tractable.
- Private user data is stored ID-only in dedicated `trellis_*` localStorage keys, resolved at read time — it is structurally separate from prompt assembly today.
- `liked` is intentionally a hidden recommendation signal (NOT displayed). The guardrail must allow this.

### Integration Points
- Provider call-sites that build prompts: `state/useQuestions.ts` (Ask), `services/concept-feed.service.ts`, `services/post-essay.service.ts`, `services/podcast*.ts`, `services/flashcard.service.ts`, `services/canonical-knowledge.service.ts`, `AskScreen.tsx` session-title. These are the flows the goldens should cover.

</code_context>

<specifics>
## Specific Ideas

- Operator's exact framing: "reviews are designed not to be pushy and there should not be any stop cue. The review progress is only designed for user to get reward, not mandated by goal."
- PRIVACY-01 should be guaranteed by construction (structural test) rather than a runtime sanitizer — operator chose "Tests + structural assertion".

</specifics>

<deferred>
## Deferred Ideas

- **Daily learning goal / stop cue / reflection prompts (was LEARN-01/02/03)** — rejected as conflicting with the reward-based, non-pushy design. Recorded as Out of Scope in REQUIREMENTS.md, NOT parked for re-litigation. Do not re-introduce.

### Reviewed Todos (not folded)
- `2026-05-07-fix-cosine-similarity-threshold-cache-miss.md` — filter/embedding threshold tuning; unrelated to privacy/guardrail scope.
- `2026-05-09-inspect-auto-gen-podcast-working-or-not-and-debug.md` — podcast auto-gen debugging; unrelated to this phase.

</deferred>

---

*Phase: 53-Provider Privacy + Non-Pushy Guardrail*
*Context gathered: 2026-05-20*

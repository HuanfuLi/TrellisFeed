# Phase 53: Provider Privacy + Non-Pushy Guardrail - Research

**Researched:** 2026-05-20
**Domain:** Test-only phase — provider payload boundary (privacy goldens) + negative-invariant source guard (non-pushy stance). No new UI, no new feature.
**Confidence:** HIGH (all findings verified by reading the live source + existing test precedents in this repo)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Phase narrows to LEARN-04 (guardrail test) + PRIVACY-01 (payload goldens). LEARN-01/02/03 dropped to Out of Scope. No new UI; ROADMAP UI hint = "no".
- **D-02:** Reward-based, non-pushy engagement is a locked product principle. The *absence* of coercive mechanics is the deliverable, enforced by a test. No counter-mechanics (stop cues, mandated goals) are added.
- **D-03:** PRIVACY-01 enforced by **tests + structural assertion**, NOT a runtime scrubber.
  - Golden tests assert known private-field content never appears in the outbound LLM/TTS payload for representative real flows (Ask chat, podcast generation, post-essay/news streaming, flashcard extraction, classification, TTS synthesize).
  - PLUS a structural test asserting no provider call-site reads the private services (engagement / collections / graph-edit-journal) when assembling provider payloads.
  - Rationale: private fields live in separate localStorage and are not interpolated into prompts — exclusion is true *by construction*. A runtime string-scrubber would be fragile and add per-call cost.
- **D-04:** Field inventory to protect: tags/collections (`trellis_collections_v1`), engagement signals saved/liked/dismissed/savedPodcasts (`trellis_engagement_v1`), graph correction logs (`trellis_graph_edit_log`). "history" = post-history snapshot store (`trellis_post_history`) resolved by engagement save/liked at read time.
- **D-05:** LEARN-04 is a source-pattern / structural negative-invariant guard (mirroring `tests/components/InfoFlow.video-tap-emit.test.mjs`) asserting no streak counter, leaderboard, public-like display, stop-cue interstitial, or mandated-goal mechanic exists.
- **D-06:** The existing `liked` engagement signal stays a HIDDEN recommendation signal (allowed; not a "public like"). The guardrail MUST NOT false-positive on it. Likewise the reward/fruit-credit/confetti harvest mechanic in trellis is reward-based and INTENDED.

### Claude's Discretion
- Exact test file locations/names, and whether the structural call-site assertion is one test or split per provider entry point. Decide based on existing `tests/providers/` conventions.

### Deferred Ideas (OUT OF SCOPE)
- **Daily learning goal / stop cue / reflection prompts (was LEARN-01/02/03)** — rejected as conflicting with reward-based, non-pushy design. Recorded as Out of Scope in REQUIREMENTS.md, NOT parked. Do NOT re-introduce, do NOT research, do NOT propose.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRIVACY-01 | Provider-bound LLM and TTS payload tests confirm tags, saved/liked/history, and graph correction logs are excluded from outbound provider requests by default. | §"Outbound Payload Shapes" (exact JSON body per provider), §"Private-Service Reachability Audit" (who reads the private svcs), §"Test Seam" (fetch-stub golden pattern from `tts-locale.test.mjs`), §"Structural Assertion Pattern" |
| LEARN-04 | Trellis introduces no public likes, leaderboards, streak pressure, stop-cue interstitials, mandated daily goals, or engagement-maximizing loops. Guardrail test codifies the stance. | §"LEARN-04 Forbidden/Allowed Token Inventory" (verified absent today), §"Negative-Invariant Guard Pattern" (mirrors `InfoFlow.video-tap-emit.test.mjs`) |
</phase_requirements>

## Summary

This is a small, test-only phase. There is **no production code to write for the happy path** — both guarantees are already true by construction, and the deliverable is locking them with tests so future work cannot silently break them.

PRIVACY-01: All LLM traffic funnels through `chatCompletion`/`chatStream` in `app/src/providers/llm/index.ts`; all TTS through `synthesize` in `app/src/providers/tts/index.ts`. The three private services (`engagement.service.ts`, `collection.service.ts`, `graph-edit-journal.service.ts`) all store **ID-only** data in dedicated `trellis_*` localStorage keys and are resolved at read time on UI surfaces — they are structurally separate from prompt assembly. I audited every provider-calling service: none of the prompt-bearing flows (Ask, podcast, post-essay/news, flashcard, post-context-qa) read any private service.

**One real exception — a finding the plan MUST resolve before writing goldens:** `reorganizeMindmap()` in `canonical-knowledge.service.ts:1650-1654` **deliberately reads `graphEditJournal.list()` and interpolates phrased correction lines (containing user-renamed/merged/pruned node titles) directly into the reorg LLM system prompt.** This is intentional, load-bearing Phase 48 design (the journal's stated purpose is to feed the reorg LLM so manual intent survives a reorg). But PRIVACY-01 / D-04 explicitly name "graph correction logs (`trellis_graph_edit_log`)" as a field to keep OUT of payloads. These two facts are in direct tension. The structural assertion "no provider call-site reads graph-edit-journal" would FAIL on this code path today. **This needs an operator decision** (see Open Questions Q1) — it likely converts the structural assertion into a *scoped* assertion ("graph-edit-journal may only be read by `reorganizeMindmap`, which is an explicit, documented exception") rather than a blanket "never read."

LEARN-04: I grep-verified the codebase contains zero occurrences of `streak`, `leaderboard`, `stopCue`/`stop cue`, `dailyGoal`/`mandatedGoal`, or `publicLike`/`likeCount`. The guard will pass cleanly today. The `liked` signal (allowed, hidden) appears in 14 files and the guard must be written to assert specific forbidden *constructs*, never a bare `/liked/` substring.

**Primary recommendation:** Build two new test files under `tests/providers/` (privacy goldens + structural call-site assertion) and one negative-invariant guard under `tests/` (LEARN-04), reusing the `tts-locale.test.mjs` fetch-stub seam and the `InfoFlow.video-tap-emit.test.mjs` source-read seam verbatim. Before writing the structural assertion, get an operator ruling on the `reorganizeMindmap` graph-edit-journal injection.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Outbound LLM payload assembly | Client provider wrapper (`providers/llm/index.ts`) | — | Single chokepoint; all 4 providers' bodies built here after `applyLocaleDirective` + `applyUserContentBracketing` |
| Outbound TTS payload assembly | Client provider wrapper (`providers/tts/index.ts`) | — | Single chokepoint; `synthesize` is the only TTS exit |
| Private-data ownership (tags/saved/liked/journal) | Client leaf services (localStorage) | — | ID-only `trellis_*` keys; resolved at read time on UI, never in prompt assembly (one documented exception: reorg) |
| Privacy enforcement | Test tier (`node --test`) | — | D-03: enforced structurally + by golden, NOT a runtime scrubber |
| Non-pushy stance | Test tier (source-read guard) | — | D-05: negative-invariant guard over source files |

## Standard Stack

No new dependencies. This phase adds only `.test.mjs` files.

### Core (already present — reuse, do not add)
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `node --test` | Node built-in (repo runs on Node 25) | Test runner | CLAUDE.md mandates this; all existing tests use it |
| esbuild tsx loader | (already wired) | Imports `.ts` leaf modules in tests | Project pattern for loading `src/` from tests |
| `node:assert/strict` | built-in | Assertions | Used by every existing test |
| `node:fs` `readFileSync` | built-in | Source-read guards | Used by `InfoFlow.video-tap-emit.test.mjs` + `llm-bracketing.test.mjs` |

**Installation:** none.

## Package Legitimacy Audit

> Not applicable — this phase installs no external packages. All tooling (`node:test`, `node:assert`, `node:fs`) is Node built-in and already in use across the existing test suite. No registry verification needed.

## Architecture Patterns

### Data-flow diagram — what reaches `fetch()`

```
                     ┌─────────────────────────── PROVIDER-CALLING SERVICES ───────────────────────────┐
  user Ask turn  ───▶│ state/useQuestions.ts (system+history+graph-context+user)                       │
  feed refill    ───▶│ services/concept-feed.service.ts (concept batch prompts)                        │
  post open      ───▶│ services/post-essay.service.ts (essay / news essay)                             │
  flashcard      ───▶│ services/flashcard.service.ts (extraction)                                      │
  classify Q     ───▶│ services/canonical-knowledge.service.ts (by-layer descent + reorg) ◀── reads    │
  podcast gen    ───▶│ services/podcast.service.ts (script)                              graphEditJournal│
  post Q&A       ───▶│ services/post-context-qa.service.ts                                  (EXCEPTION) │
  session title  ───▶│ AskScreen.tsx:86                                                                 │
                     └────────────────────────────────────────┬────────────────────────────────────────┘
                                                               │ ChatMessage[]
                                                               ▼
                          providers/llm/index.ts  ── chatCompletion / chatStream ──┐
                            1. applyLocaleDirective(messages)   // D-12             │
                            2. applyUserContentBracketing(msgs) // D-13             │
                            3. switch(provider):                                    │
                               openAI:  body = {model, messages, max_tokens, ...}   │
                               claude:  body = {model, max_tokens, system, messages}│──▶ fetch() ──▶ network
                               gemini:  body = toGeminiPayload(messages,...)        │
                                                                                    │
                          providers/tts/index.ts ── synthesize(text, config) ──────┤
                            body = {model, input:text, voice, speed}                │
                                                                                    ▼
                          PRIVATE SERVICES (NOT in the path above except reorg):
                            engagement.service.ts   (trellis_engagement_v1)  — ID-only
                            collection.service.ts   (trellis_collections_v1) — ID-only
                            graph-edit-journal.svc   (trellis_graph_edit_log) — phrased into reorg prompt ⚠
```

### Exact outbound payload shapes (what a golden asserts against)

Verified by reading `providers/llm/index.ts` and `providers/tts/index.ts`. `[VERIFIED: codebase]`

**OpenAI / local / lmstudio** (`openAICompletion` :157, `openAIStream` :194)
```jsonc
{ "model": "...", "messages": [{role,content}...], "max_tokens": N, "stream": false|true,
  "response_format": {"type":"json_object"}  /* only when jsonMode && !isLocal */ }
```
URL `${base}/v1/chat/completions`. The ONLY content fields are `messages[].content` (and `model`). Native local path uses `CapacitorHttp.post` (`localPost` :133) — not `window.fetch` — so a golden must either stub `Capacitor.isNativePlatform()` to false (default in Node) or only assert the cloud path.

**Claude** (`claudeCompletion` :206, `claudeStream` :241)
```jsonc
{ "model":"...", "max_tokens":N, "system": <system msg content | undefined>,
  "messages": [{role,content}...], "stream": true /* stream only */ }
```
Note: system message is hoisted to top-level `system`; `jsonMode` pushes an `{ role:'assistant', content:'{' }` prefill. URL `https://api.anthropic.com/v1/messages`.

**Gemini** (`toGeminiPayload` :273)
```jsonc
{ "contents":[{role:'user'|'model', parts:[{text}]}...],
  "systemInstruction": {parts:[{text}]}  /* if a system msg exists */,
  "generationConfig": {maxOutputTokens:N, responseMimeType?:'application/json'} }
```
URL `${GEMINI_BASE}/models/${model}:generateContent` (or `:streamGenerateContent?alt=sse`).

**TTS** (`synthesize` :44)
```jsonc
{ "model": "tts-1" (or config), "input": <text>, "voice": <resolved>, "speed": <num> }
```
URL `${base}/v1/audio/speech`. The only content field is `input`. `resolveVoice` reads i18n locale, NOT any private service.

**Golden strategy implication:** A privacy golden seeds each private service with sentinel content (e.g. a collection named `"SECRET-TAG-SENTINEL"`, a liked post, a journal rename entry with title `"SECRET-NODE-SENTINEL"`), drives a representative flow, captures the `fetch` body, and asserts the JSON-stringified body does **not** contain any sentinel string. Because the body only ever contains `messages[].content` / `input`, the assertion reduces to "no private localStorage data leaked into the prompt."

### Test seam — capturing the fetch body without a network call

`tests/providers/tts-locale.test.mjs:27-54` is the canonical, copyable seam `[VERIFIED: codebase]`:

```js
let captured;
const fakeFetch = async (_url, init) => {
  captured = JSON.parse(init.body);          // capture the outbound body
  return { ok: true, status: 200,
           async blob(){ return { type:'audio/mpeg' }; },
           async text(){ return ''; } };
};
globalThis.window = globalThis.window ?? {};
globalThis.window.fetch = fakeFetch;
globalThis.fetch = fakeFetch;
globalThis.URL = globalThis.URL ?? {};
globalThis.URL.createObjectURL = () => 'blob://stub';
// IMPORT THE MODULE UNDER TEST *AFTER* SHIMS ARE INSTALLED:
const { synthesize } = await import('../../src/providers/tts/index.ts');
```

For LLM goldens the same pattern works because both `openAICompletion`/`geminiCompletion`/`claudeCompletion` call the global `fetch`. To assert a streaming body, the fake `Response` must provide a `.body.getReader()` that returns `{done:true}` immediately (the goldens care about the **request** body, not the response). A minimal stub:
```js
return { ok:true, status:200,
  body: { getReader: () => ({ read: async () => ({ done:true }) }) },
  async text(){ return ''; }, async json(){ return {choices:[{message:{content:''}}]}; } };
```

**Leaf-module caveat (CLAUDE.md, load-bearing):** `providers/llm/index.ts` and `providers/tts/index.ts` import only leaf deps (`@capacitor/core`, `token-usage.service`, `locale-directive`, `user-content-bracketing`, `i18n-leaf`). They are `node --test`-loadable today (proven by `tts-locale.test.mjs` and `llm-bracketing.test.mjs` importing them). **However** — the higher-level prompt-bearing services (`useQuestions.ts`, `podcast.service.ts`, `concept-feed.service.ts`, `canonical-knowledge.service.ts`) pull in heavy/i18next/JSON-import-attribute dependency chains and are NOT directly loadable in `node --test`. This is the central design constraint for the goldens (see Pitfall 1).

### Structural assertion pattern (no call-site reads private services)

The repo precedent for "assert the wiring inside a source file" is `llm-bracketing.test.mjs:214-294` `[VERIFIED: codebase]` — it `readFileSync`s `providers/llm/index.ts` and asserts call-order via `indexOf` offsets. For PRIVACY-01's structural test, the cleanest expression is a **source-read negative assertion over the provider chokepoint files** (`providers/llm/index.ts`, `providers/llm/locale-directive.ts`, `providers/llm/user-content-bracketing.ts`, `providers/tts/index.ts`):

```js
const PROVIDER_FILES = ['providers/llm/index.ts','providers/llm/locale-directive.ts',
  'providers/llm/user-content-bracketing.ts','providers/tts/index.ts'];
for (const rel of PROVIDER_FILES) {
  const src = readFileSync(resolve(here,'../../src',rel),'utf-8');
  assert.ok(!/engagement\.service|collection\.service|graph-edit-journal/.test(src),
    `${rel} must not import a private user-data service`);
}
```

Optionally extend to the prompt-bearing call-sites too (`useQuestions.ts`, `podcast.service.ts`, `post-essay.service.ts`, `flashcard.service.ts`, `post-context-qa.service.ts`) — these are plain `readFileSync` + regex, so heavy-import loadability is NOT a problem (you read bytes, you don't import). **`canonical-knowledge.service.ts` is the exception** that the plan must carve out (see Open Questions Q1).

### Anti-Patterns to Avoid
- **Runtime scrubber.** D-03 explicitly forbids it. Do not add a sanitize-the-prompt-string pass at the provider boundary.
- **Importing the heavy prompt-bearing service into a golden test.** It will fail `node --test` load. Drive the flow through the leaf provider chokepoint directly, or read source bytes.
- **Asserting a bare `/liked/` or `/like/` substring in the LEARN-04 guard.** It will false-positive on the allowed hidden engagement signal (14 files). Assert specific forbidden constructs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Capture outbound request body | Custom HTTP interceptor / nock | `globalThis.fetch` reassignment per `tts-locale.test.mjs:31-47` | Repo precedent, zero deps, leaf-safe |
| Assert source-level invariants | A new lint rule / AST tooling | `readFileSync` + regex per `InfoFlow.video-tap-emit.test.mjs` and `llm-bracketing.test.mjs` | Repo precedent; loads any file regardless of import weight |
| Privacy enforcement at runtime | A scrubber middleware | Structural test + goldens (D-03) | Operator-locked; scrubber is fragile + adds per-call cost |

**Key insight:** Every capability this phase needs already exists as a test pattern in `tests/providers/`. The work is composition + sentinel data, not new machinery.

## Private-Service Reachability Audit (the core PRIVACY-01 evidence)

`[VERIFIED: codebase grep]` — importers of each private service, excluding the service's own file:

| Service / key | Imported by (production) | Reaches a provider payload? |
|---|---|---|
| `engagementService` (`trellis_engagement_v1`) | SavedScreen, AnchorDetailScreen, HomeScreen, PodcastScreen, SettingsDataScreen, LongPressMenu, MasonryFeed, CollectionPickerSheet, **concept-feed.service.ts**, collection.service.ts, post-history.service.ts | **NO.** `concept-feed` reads only `getDismissedAnchorIds()` (:242, :1319) — IDs used to *filter* the feed walker, never interpolated into a prompt. UI surfaces resolve IDs at render time. |
| `collectionService` (`trellis_collections_v1`) | SavedScreen, CollectionDrillInScreen, AnchorDetailScreen, LongPressMenu, CollectionPickerSheet, engagement.service.ts | **NO.** No provider-calling service imports it. |
| `graphEditJournal` (`trellis_graph_edit_log`) | UndoButton, graph-command.service.ts, **canonical-knowledge.service.ts** | **YES — one path.** `reorganizeMindmap()` reads `graphEditJournal.list()` and injects `phraseJournalEntry(entry)` into the reorg system prompt (`canonical-knowledge.service.ts:1650-1654`). Phrased lines embed user-renamed/merged/pruned node titles. ⚠ |

Provider-calling services confirmed clean (no private-service import): `podcast.service.ts`, `post-essay.service.ts`, `flashcard.service.ts`, `post-context-qa.service.ts`, `state/useQuestions.ts`. `[VERIFIED: codebase grep]`

## LEARN-04 Forbidden / Allowed Token Inventory

`[VERIFIED: codebase grep on src/, 2026-05-20]` — current counts:

**Forbidden constructs (assert ABSENT — all return 0 today):**
| Pattern | Occurrences | Guard intent |
|---------|------------|--------------|
| `streak` | 0 | no streak counter / streak-pressure |
| `leaderboard` | 0 | no ranking / social proof |
| `stopCue` / `stop-cue` / `stop cue` | 0 | no interstitial telling user to stop |
| `dailyGoal` / `daily goal` / `mandatedGoal` | 0 | no mandated daily target |
| `publicLike` / `public like` / `likeCount` / `likesCount` | 0 | no PUBLIC like display / count |

**Allowed (must NOT trip the guard):**
| Construct | Occurrences | Why allowed (D-06) |
|-----------|------------|---------------------|
| `liked` / `likePost` / `isLiked` / `getLikedPosts` (engagement) | 14 files | Hidden recommendation signal, never displayed as a public count. NOT a "public like". |
| `trellisCreditsService` / `fruit_credits` / confetti harvest | (trellis reward loop) | Reward-based, intended (CONTEXT D-06; ROADMAP rescope note). The reward loop IS the answer to professor Q4. |
| `dailyReadService` / "explored" / vine progress | (concept feed) | Progress-for-reward, not a mandated goal or stop cue. |

**Guard construction rule:** Assert word-boundary forbidden tokens (`/\bstreak\b/i`, `/\bleaderboard\b/i`, etc.), not substrings of `liked`. Mirror `InfoFlow.video-tap-emit.test.mjs`'s style: each `it()` greps `src/` (or a curated file set) and asserts `matches.length === 0` with a descriptive message explaining the rescope rationale so a future dev who trips it understands *why* it's forbidden. Scope: a recursive `src/` scan (read all `.ts`/`.tsx`) is appropriate since these are codebase-wide bans, not file-local.

## Code Examples

### Privacy golden — TTS path (fully loadable today; safest first golden)
```js
// Source pattern: tests/providers/tts-locale.test.mjs (fetch-stub seam)
let captured;
globalThis.fetch = globalThis.window = undefined; // reset
const fakeFetch = async (_u, init) => { captured = JSON.parse(init.body);
  return { ok:true, status:200, async blob(){return {type:'audio/mpeg'};}, async text(){return '';} }; };
globalThis.window = { fetch: fakeFetch }; globalThis.fetch = fakeFetch;
globalThis.URL = { createObjectURL: () => 'blob://stub' };
// seed a private service with a sentinel BEFORE import
globalThis.localStorage = makeMemoryLocalStorage();
localStorage.setItem('trellis_collections_v1', JSON.stringify({collections:[{id:'c1',name:'SECRET-TAG-SENTINEL',postIds:[],createdAt:0,updatedAt:0}]}));
const { synthesize } = await import('../../src/providers/tts/index.ts');
await synthesize('Recap of spaced repetition.', baseTtsConfig);
assert.ok(!JSON.stringify(captured).includes('SECRET-TAG-SENTINEL'),
  'TTS payload must not contain collection/tag data');
```

### Structural assertion — provider chokepoints don't import private svcs
```js
// Source pattern: tests/providers/llm-bracketing.test.mjs:214 (readFileSync + regex)
import { readFileSync } from 'node:fs';
const src = readFileSync(resolve(here,'../../src/providers/llm/index.ts'),'utf-8');
assert.ok(!/engagement\.service|collection\.service|graph-edit-journal/.test(src),
  'providers/llm/index.ts must not import a private user-data service (PRIVACY-01)');
```

### LEARN-04 negative-invariant guard
```js
// Source pattern: tests/components/InfoFlow.video-tap-emit.test.mjs
const files = collectSourceFiles(resolve(here,'../../src')); // *.ts, *.tsx
for (const f of files) {
  const s = readFileSync(f,'utf-8');
  assert.equal((s.match(/\bstreak\b/gi) || []).length, 0,
    `${f}: no streak mechanic — Trellis is reward-based, not mandate-based (LEARN-04, rescoped 2026-05-20)`);
}
```

## State of the Art

Not applicable — no external library/framework decision. This phase is internal test composition over an established in-repo test stack.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The streaming-path goldens need only a minimal `Response.body.getReader()` stub returning `{done:true}`, because goldens assert the *request* body not the response. | Test Seam | LOW — if a flow validates response shape before sending, stub may need a richer body; adjust per-flow. |
| A2 | A recursive `src/` scan is acceptable scope/perf for the LEARN-04 guard under `node --test`. | LEARN-04 guard | LOW — ~hundreds of files; readFileSync is fast. If slow, restrict to `src/screens`+`src/components`+`src/services`. |

**No `[ASSUMED]`-tagged factual claims about library behavior** — every payload-shape and reachability claim is `[VERIFIED: codebase]` by direct read.

## Open Questions

1. **`reorganizeMindmap` injects graph-edit-journal content into the reorg LLM prompt — is this an accepted exception to PRIVACY-01, or a leak to fix?** (HIGH priority — scope-defining)
   - What we know: `canonical-knowledge.service.ts:1650-1654` reads `graphEditJournal.list()` and embeds phrased correction lines (with user-renamed/merged/pruned node titles, e.g. `User renamed "X" to "Y" — preserve this name.`) into the reorg system prompt. This is intentional, load-bearing Phase 48 design (D-01/D-20). PRIVACY-01 / D-04 name `trellis_graph_edit_log` as a field to keep OUT of payloads.
   - What's unclear: whether the operator considers the *node titles the user already authored* (which the LLM already sees anyway in the QA manifest and graph) "private data" in the same sense as tags/likes, OR whether reorg should be exempted because the journal content is functionally the user's own graph labels (not behavioral/preference signals).
   - Recommendation: **Surface to operator in discuss/plan.** Most likely outcome: the structural assertion becomes "graph-edit-journal may be read ONLY by `reorganizeMindmap` (a documented, intentional exception); no OTHER provider call-site may read it," and a comment + test message documents why. The blanket "never read" assertion would otherwise fail today. Do NOT silently fix the reorg path (it would break Phase 48 GRAPH-04 behavior).

2. **Should the privacy goldens drive real flows (Ask/podcast/etc.) end-to-end, or assert at the leaf provider boundary with synthetic messages?** Driving real flows is impossible for the heavy services (`node --test` load failure, Pitfall 1). Recommendation: a hybrid — (a) golden the TTS + LLM leaf chokepoints directly with sentinel-seeded private services (proves the boundary excludes them); (b) cover the heavy flows with the *structural* source-read assertion (proves those call-sites don't import the private services). This satisfies D-03's "goldens for representative flows + structural test" without requiring un-loadable imports.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node --test` | all new tests | ✓ | Node 25 (repo) | — |
| esbuild tsx loader | importing `.ts` leaf modules | ✓ | already wired | — |

No missing dependencies. No external services. This is a code/test-only phase.

## Validation Architecture

> nyquist_validation assumed enabled (no `.planning/config.json` override observed for this key).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `node --test` + esbuild tsx loader |
| Config file | none — runner invoked via npm scripts (`test:main` / `test:actions`) |
| Quick run command | `node --test tests/providers/<new-file>.test.mjs` (from `app/`) |
| Full suite command | `npm test` (runs `test:main` then `test:actions`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRIVACY-01 | TTS payload excludes tags/saved/liked/journal sentinels | golden (fetch-stub) | `node --test tests/providers/privacy-payload-tts.test.mjs` | ❌ Wave 0 |
| PRIVACY-01 | LLM payload excludes private sentinels (cloud openAI/claude/gemini) | golden (fetch-stub) | `node --test tests/providers/privacy-payload-llm.test.mjs` | ❌ Wave 0 |
| PRIVACY-01 | Provider chokepoints + prompt call-sites do not import private svcs (scoped exception: reorg) | structural source-read | `node --test tests/providers/privacy-callsite-structural.test.mjs` | ❌ Wave 0 |
| LEARN-04 | No streak/leaderboard/stop-cue/mandated-goal/public-like construct in `src/` | negative-invariant source-read | `node --test tests/learn-04-no-pushy-mechanics.test.mjs` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the single new test file touched (`node --test tests/<file>.test.mjs`).
- **Per wave merge:** `npm run test:main` (the new files live in the main set, not the actions set).
- **Phase gate:** `npm test` green before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `tests/providers/privacy-payload-tts.test.mjs` — TTS golden (covers PRIVACY-01)
- [ ] `tests/providers/privacy-payload-llm.test.mjs` — LLM golden, 3 cloud providers (covers PRIVACY-01)
- [ ] `tests/providers/privacy-callsite-structural.test.mjs` — structural assertion incl. the reorg exception (covers PRIVACY-01)
- [ ] `tests/learn-04-no-pushy-mechanics.test.mjs` — negative-invariant guard (covers LEARN-04)
- [ ] A tiny in-memory `localStorage` helper for the goldens (the private services call `localStorage.getItem/setItem`; `node --test` has no DOM). Reuse any existing test helper if present; otherwise a ~10-line `Map`-backed shim. Keep it leaf-safe.
- Framework install: none needed.

## Security Domain

> `security_enforcement` assumed enabled. This phase IS a privacy/security control (PRIVACY-01).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | local-first; no auth surface in scope |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no (this phase) | (FILTER-03 bracketing already covers injection at the boundary) |
| V6 Cryptography | no | — |
| **V8 Data Protection / Privacy** | **yes** | PRIVACY-01 is precisely a data-minimization control: private local data must not leave the device inside provider payloads. Enforced structurally + by golden (D-03). |

### Known Threat Patterns for this phase
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Private user data (tags/likes/history/correction log) silently included in an outbound LLM/TTS request | Information Disclosure | Structural assertion (no private-svc import at provider call-sites) + payload goldens with sentinel data. The reorg journal injection (Open Q1) is the one known disclosure surface needing an explicit operator ruling. |
| Future code adds a private-data read to a prompt and ships unnoticed | Information Disclosure | The structural source-read test fails CI if any chokepoint/call-site newly imports a private service. |
| Future code adds a coercive engagement mechanic | (engagement ethics, not STRIDE) | LEARN-04 negative-invariant guard fails CI. |

## Sources

### Primary (HIGH confidence — direct source read this session)
- `app/src/providers/llm/index.ts` — `chatCompletion`/`chatStream` funnel; per-provider body builders (openAI :157/:194, claude :206/:241, gemini `toGeminiPayload` :273).
- `app/src/providers/tts/index.ts` — `synthesize` :44 body shape; `resolveVoice` (no private read).
- `app/src/providers/llm/locale-directive.ts`, `app/src/providers/llm/user-content-bracketing.ts` — boundary middleware (locale-only / last-user-message-only; no private read).
- `app/src/services/engagement.service.ts`, `collection.service.ts`, `graph-edit-journal.service.ts` — ID-only storage; keys `trellis_engagement_v1`/`trellis_collections_v1`/`trellis_graph_edit_log`.
- `app/src/services/canonical-knowledge.service.ts:1599-1688` + `graph-edit-journal-phrasing.ts` — the reorg journal-injection path (Open Q1).
- `app/tests/providers/tts-locale.test.mjs` — fetch-stub capture seam.
- `app/tests/providers/llm-bracketing.test.mjs:214-294` — readFileSync + offset structural-assertion seam.
- `app/tests/components/InfoFlow.video-tap-emit.test.mjs` — negative-invariant source-read guard precedent.
- `.planning/REQUIREMENTS.md` (LEARN-04 :62, PRIVACY-01 :68, Out of Scope :91), `.planning/ROADMAP.md` (Phase 53 :192-205), `CLAUDE.md` (test framework + leaf-module discipline + Phase 35 byte-stability).
- `package.json` — `test:main` / `test:actions` split (new files belong in `test:main`).

### Secondary / Tertiary
- None — all findings verified in-repo; no web research required for a test-only, in-codebase phase.

## Metadata

**Confidence breakdown:**
- Payload shapes: HIGH — read every body builder directly.
- Private-service reachability: HIGH — exhaustive grep of importers + manual read of the two cross-references (concept-feed = ID filter, canonical-knowledge = journal injection).
- Test seams: HIGH — copied from working in-repo tests.
- LEARN-04 token inventory: HIGH — grep counts captured this session (all forbidden = 0).
- The reorg/PRIVACY-01 tension: HIGH that it exists; the *resolution* is an operator decision (Open Q1), not a research gap.

**Research date:** 2026-05-20
**Valid until:** ~2026-06-19 (30 days; stable internal surfaces. Re-verify if `providers/llm/index.ts` body builders or the reorg prompt change.)

# Phase 39: Engagement Service + Walker Extension — Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Foundation **leaf service** that owns local-first save / dismiss / like state for posts and concept anchors, plus the walker extension that lets the concept-feed pipeline lazily skip dismissed anchors at refill time. Exposes the API surface that **Phase 43 (Engagement UI)** will wire into long-press menus, tile action rows, and the future "Saved" view.

Phase 39 ships ONLY the service module + walker third-arg + new event type + tests. **No UI**. Phase 43 owns the UI wiring (long-press menus, action rows, "Saved" view, Force-New-Day handler update).

Locked by ROADMAP success criteria (not gray):
- Single localStorage key: `trellis_engagement_v1`
- API: `savePost`/`getSavedPosts`/`removeSavedPost`, `likePost`/`unlikePost`/`isLiked`, `dismissAnchor`/`getDismissedAnchorIds`
- Walker: `walkDerivedList(count, exploredIds, dismissedIds)` — third positional arg; lazy skip only (never splice)
- New event: `ANCHOR_DISMISSED` added to `AppEvent` union
- Cross-day: saves + likes persist; dismisses persist until explicit undo or Clear-All-Data
- Anti-wire invariant: no code path emits both `ANCHOR_DISMISSED` and `CONCEPT_EXPLORED` for the same call

</domain>

<decisions>
## Implementation Decisions

### Plan grouping (D-01)

- **D-01:** Single plan, `39-01-engagement-service-PLAN.md`. All Phase 39 work (engagement leaf service + walker third-arg extension + `ENGAGEMENT_CHANGED` event addition + the matching tests) commits inside this plan with atomic-per-file cadence (Phase 37 D-03 precedent).
  - **Why:** Phase 39's success criteria are tightly coupled — the walker change exists to consume the dismissed-set the service produces; the new event type is consumed only by code that also reads the service. Splitting into "service" + "walker" plans would force the walker plan to wait for the service plan or stub it, and offers no parallelism win since both edits sit inside `app/src/services/`.

### Podcast inspection (D-02 — operator-clarified mid-discussion)

- **D-02:** Auto-gen podcast inspection is **NOT folded** into Phase 39. Operator confirmed during discussion (2026-05-09) that the podcast auto-gen feature works as designed when the app is foregrounded — script generation, TTS synthesis, blob URL persistence, and playback all functional. The "issue" is that nothing fires when the app is backgrounded, which is an architectural limitation of the local-first / serverless design (no server to schedule work). Resolution: defer until the future client/server split unlocks server-side scheduled tasks. Captured in auto-memory `project_serverless_no_background_tasks.md`.
  - **Why:** Folding the inspection was offered initially because the pending todo's score-0.6 keyword match suggested overlap. The mid-discussion update reframed it from "is there a bug?" to "the bug is the architecture, not the code." Phase 39 stays focused on engagement service + walker.

### Storage shape inside `trellis_engagement_v1` (D-03)

- **D-03:** ID arrays only; full-post snapshots resolved through the existing `postHistoryService`.
  - Schema: `{ saved: string[], liked: string[], dismissed: string[] }` (postIds for saved/liked; anchorIds for dismissed).
  - `getSavedPosts(): DailyPost[]` and `getLikedPosts(): DailyPost[]` resolve via `postHistoryService.getPosts()` lookup at read time.
  - **Why:** `app/src/services/post-history.service.ts` already owns 7-day rolling DailyPost snapshots with dedup and configurable retention purge. Storing parallel snapshots inside the engagement service would duplicate storage AND risk drift if a post is updated post-save. ID-only keeps engagement minimal and reuses existing infrastructure (CLAUDE.md best practice — don't introduce abstractions beyond what the task requires).

### Saved-post longevity vs post-history retention (D-04)

- **D-04:** **Pin saved/liked posts so retention purge skips them.** engagementService exposes `getPinnedIds(): Set<string>` (union of `saved ∪ liked`); `postHistoryService.purgeExpired()` reads it and skips matching posts during the cutoff filter.
  - **Why:** Without pinning, a post saved >7 days ago (or whatever retention window the user has set) silently vanishes from the snapshot store. `getSavedPosts()` would return phantom IDs with no resolvable post. Pinning makes saved posts effectively immortal until the user explicitly unsaves — matches user mental model of "save = keep forever."
  - **Implementation note:** This is the only cross-module coupling Phase 39 introduces. `postHistoryService.purgeExpired()` gains a `getPinnedIds()` import + a `.has(p.id)` check inside the existing filter. Single-line semantic change.
  - **Edge case:** If a post is in `saved` but never made it into post-history (e.g., user saved a post then immediately wiped post-history via Clear-All-Data), `getSavedPosts()` returns fewer than `saved.length` entries — graceful degradation, no error.

### Event emissions (D-05)

- **D-05:** **Two events: `ANCHOR_DISMISSED` (locked) + new `ENGAGEMENT_CHANGED { kind, id }`.**
  - `ANCHOR_DISMISSED { payload: { anchorId: string } }` — fired ONLY by `dismissAnchor`. Walker (concept-feed.service.ts) is the consumer; subscribes specifically to this event so it doesn't have to discriminate by payload `kind`.
  - `ENGAGEMENT_CHANGED { payload: { kind: 'save' | 'unsave' | 'like' | 'unlike' | 'undismiss', id: string } }` — fired by `savePost` / `removeSavedPost` / `likePost` / `unlikePost` / `undismissAnchor`. UI re-render consumer (Phase 43 components).
  - **`dismissAnchor` fires ONLY `ANCHOR_DISMISSED`** (not also `ENGAGEMENT_CHANGED`). **`undismissAnchor` fires ONLY `ENGAGEMENT_CHANGED kind:'undismiss'`** (not also `ANCHOR_DISMISSED`).
  - UI components that need full dismiss-state coverage subscribe to BOTH events. Walker only needs `ANCHOR_DISMISSED`.
  - **Why:** Walker has a specific consumer interest (re-fetch dismissed-set, refill cycle); UI has a broader interest (re-render any tile whose engagement state changed). One event per semantic action keeps the bus uncluttered while also avoiding the per-action-event sprawl that CLAUDE.md best practice rule 6 warns against. The `kind` payload field on `ENGAGEMENT_CHANGED` mirrors the `GRAPH_UPDATED { kind }` pattern that CLAUDE.md establishes as the preferred path for "single signal, payload discriminates" in §"Event bus — unified GRAPH_UPDATED."

### Anti-wire enforcement for `ANCHOR_DISMISSED` + `CONCEPT_EXPLORED` (D-06)

- **D-06:** **Defense-in-depth: source-reading invariant test + behavioral test.**
  - **Source-reading test** (`tests/services/engagement-anti-wire.test.mjs` or similar — planner names): grep-based; asserts no source file under `app/src/` contains both `eventBus.emit({type:'ANCHOR_DISMISSED'` and `eventBus.emit({type:'CONCEPT_EXPLORED'` within the same function/closure body. Catches static violations cheaply.
  - **Behavioral test** (in `engagement.service.test.mjs`): call `dismissAnchor('test-id')` with a captured event-bus subscriber; assert the captured log contains exactly one `ANCHOR_DISMISSED` event and zero `CONCEPT_EXPLORED` events. Catches runtime double-emit (e.g., a future caller wiring both via separate handlers).
  - **Why:** Source-reading alone misses runtime composition (e.g., `dismissAnchor` calls a helper that calls `markExplored`); behavioral alone misses unreachable code paths (e.g., a typo'd file that isn't loaded by tests). Combination gives static + runtime coverage with two cheap tests. Matches the Phase 27 web-search-no-locale + Phase 35 useQuestions-system-prompt-stability source-reading-test precedent, plus standard behavioral-test pattern.

### Walker extension shape (D-07)

- **D-07:** Required positional third arg, NOT defaulted.
  - Signature: `walkDerivedList(count: number, exploredIds: Set<string>, dismissedIds: Set<string>): string[]`
  - Sole caller (`concept-feed.service.ts:1209`) updates in the same commit as the signature change. New callers must pass the dismissed set explicitly.
  - **Why:** Defaulting `dismissedIds` to `new Set()` would let new callers silently bypass dismiss-skip behavior. Required arg forces explicit consideration. The cost is one line at the single existing caller — trivial. Matches the spirit of the success criterion #3 wording (which lists three positional args without "optional").

### Reset behavior (D-08)

- **D-08:** `engagementService.reset()` exists for tests AND for Phase 43's Force-New-Day handler wiring.
  - Behavior: clears all three collections (saved/liked/dismissed) by writing `freshState()` to localStorage. Does NOT emit `ENGAGEMENT_CHANGED` (it's a wholesale wipe, not a per-id change; UI consumers should re-read on Force-New-Day rather than chase per-action events).
  - Phase 39 owns the `reset()` method definition + tests. Phase 43 owns the call site in SettingsDataScreen's Force-New-Day handler.
  - **Why:** Mirrors `dailyReadService.reset()` (line 86) precedent. Keeps the dev-affordance wiring concern (Phase 43) separate from the service contract concern (Phase 39). Allows tests in Phase 39 to use `reset()` between cases without requiring the UI handler to exist.

### Claude's Discretion

- File path: `app/src/services/engagement.service.ts` (matches naming pattern of `daily-read.service.ts`, `trellis-credits.service.ts`).
- Internal storage helper functions (`loadState`, `saveState`, `freshState`) — modeled on `daily-read.service.ts:25-51` but without the `date` field (engagement state has no date-keyed reset).
- Test file paths: `app/tests/services/engagement.service.test.mjs` + `app/tests/services/engagement-anti-wire.test.mjs` (planner can collapse into one file if preferred).
- Whether to expose `subscribeEngagement(handler)` convenience helper or require Phase 43 components to use `eventBus.subscribe('ENGAGEMENT_CHANGED', ...)` directly. Default: direct event-bus use, matching existing project convention.
- Whether `ENGAGEMENT_CHANGED` `kind` is a string literal union or an enum-like const object. Default: string literal union (matches `AppEvent` precedent).

### Folded Todos

(None.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §"Phase 39: Engagement Service + Walker Extension" — success criteria source-of-truth (5 must-be-true conditions)
- `.planning/REQUIREMENTS.md` ENGAGE-01 / ENGAGE-02 / ENGAGE-03 — acceptance language

### CLAUDE.md load-bearing sections
- `CLAUDE.md` §"Concept Feed Generation Pipeline" — describes derived-list lazy-skip semantics that the walker third arg participates in; do NOT regress the lazy-skip-vs-splice distinction
- `CLAUDE.md` §"Event bus — unified GRAPH_UPDATED" — establishes "single event, payload discriminates kind" precedent that `ENGAGEMENT_CHANGED { kind }` follows
- `CLAUDE.md` §"Best practices learned in Phase 32.1" rule 6 (one signal per semantic event) — informs why walker uses `ANCHOR_DISMISSED` exclusively rather than mixing all engagement signals into one bus

### Prior Phase Decisions (Load-Bearing)
- `.planning/phases/37-i18n-leaf-module-refactor/37-CONTEXT.md` D-01 / D-08 — leaf-module pattern (no JSON imports, identity defaults so `node --test` works); engagement.service.ts must follow this discipline
- `.planning/phases/37-i18n-leaf-module-refactor/37-CONTEXT.md` D-03 — atomic per-file commits, paired source+test
- `.planning/milestones/v1.4-phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/` — walker invariants from GAP-1/GAP-2/GAP-B closure; lazy skip only, never splice (cyclePosition corruption)
- `.planning/phases/38-v1-4-carry-over-cleanup/38-CONTEXT.md` "Established Patterns" — source-reading invariant tests pattern, atomic per-file commits

### Source-of-truth files for code change
- `app/src/services/post-queue.service.ts:333` (`appendToDerivedList`) and `:366` (`walkDerivedList` with full Phase 36 GAP-B comment block) — walker extension site
- `app/src/services/concept-feed.service.ts:1209` (`postQueueService.walkDerivedList(16, exploredIds)`) — sole walker caller; updates to `walkDerivedList(16, exploredIds, dismissedIds)` with `dismissedIds` populated from `engagementService.getDismissedAnchorIds()` upstream of this call
- `app/src/services/post-history.service.ts:23` (`savePosts`) and `:59` (`purgeExpired`) — `purgeExpired` extends with `getPinnedIds()` filter per D-04
- `app/src/types/index.ts:662-696` (AppEvent union) — add `ANCHOR_DISMISSED` and `ENGAGEMENT_CHANGED` event types

### Pattern precedents
- `app/src/services/daily-read.service.ts` — full pattern precedent for localStorage-backed leaf service (loadState/saveState/freshState, silent quota-drop, sync API, reset()); engagement.service.ts mirrors this minus the date-keyed reset
- `app/src/services/trellis-credits.service.ts` — minimal-leaf-service shape (single STORAGE_KEY const, narrow API, exports a const object literal)
- `app/src/lib/event-bus.ts` — pub/sub singleton; emit/subscribe usage examples in `daily-read.service.ts:60-66` and `concept-feed.service.ts` callers

### Test patterns
- `app/tests/services/daily-read.service.test.mjs` — direct test parity target for engagement.service.test.mjs
- `app/tests/services/trellis-credits.test.mjs` — minimal leaf-service test shape
- `app/tests/web-search-no-locale.test.mjs` (Phase 27) and `app/tests/state/useQuestions-system-prompt-stability.test.mjs` (Phase 35) — source-reading invariant test pattern reference for the anti-wire grep test

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`daily-read.service.ts`** — full pattern precedent for a localStorage-backed leaf service with `STORAGE_KEY`, `loadState`/`saveState`/`freshState`, silent quota-drop, sync API surface, and `reset()` method. engagement.service.ts copies the shape verbatim minus the `date` field and the date-mismatch reset branch (engagement persists cross-day per success criterion #5).
- **`trellis-credits.service.ts`** — even simpler leaf-service shape (no event emission, narrow API). Useful as the scaffold to build engagement.service.ts on, then layer event emission and the multi-collection state on top.
- **`postHistoryService.getPosts()`** (`app/src/services/post-history.service.ts:41`) — already returns `DailyPost[]` sorted by `generatedAt` desc. engagementService's `getSavedPosts()` and `getLikedPosts()` use this to resolve postIds to full posts; planner needs to choose preserve-saved-order vs preserve-history-order.
- **`postHistoryService.purgeExpired()`** (`:59`) — existing retention-purge function; D-04 extends this with a `getPinnedIds()` filter check.
- **`AppEvent` union pattern at `types/index.ts:662-696`** — straightforward to extend; existing `GRAPH_UPDATED { type only }` and `CONCEPT_EXPLORED { payload: { anchorId } }` shapes are the templates for `ANCHOR_DISMISSED` and `ENGAGEMENT_CHANGED { payload: { kind, id } }` respectively.

### Established Patterns

- **`STORAGE_KEY` const naming** — `trellis_*` prefix; engagement uses `trellis_engagement_v1` per ROADMAP success criterion. The `_v1` suffix is unusual (other keys are unsuffixed) but locked by the criterion; planner should not "normalize" it away.
- **Silent quota-drop on localStorage write** — `try { localStorage.setItem(...) } catch { /* silent */ }` matches `daily-read.service.ts:46-50`, `trellis-credits.service.ts:21-23`, `post-history.service.ts:24-28`. Same idiom in engagement.
- **Leaf-module discipline** — no JSON imports, no `react-i18next` hooks, no `lib/date.ts` (which transitively imports i18next per Phase 37 audit). If engagement needs `today()`, inline it the way `daily-read.service.ts:9-15` does. (Engagement probably doesn't need today() since it has no date-keyed reset — but worth flagging in case planner adds opportunistic timestamping.)
- **Atomic per-file commits + paired source+test** — Phase 37 D-03 norm; one commit per file (engagement.service.ts; engagement.service.test.mjs; engagement-anti-wire.test.mjs; types/index.ts AppEvent extension; post-queue.service.ts walker change; concept-feed.service.ts caller update; post-history.service.ts purge filter; types-test if needed). 6-8 commits expected.

### Integration Points

- **`concept-feed.service.ts:1209`** — sole walker caller. Update reads `engagementService.getDismissedAnchorIds()` (returns `string[]`); convert to `Set<string>` and pass as third arg. Single line change at the call site (plus the `import` line).
- **`post-history.service.ts:62-65` purge filter** — extend filter predicate from `p => p.generatedAt > cutoff` to `p => engagementService.getPinnedIds().has(p.id) || p.generatedAt > cutoff`. One-line semantic change. Caveat: introduces a `post-history → engagement` import; verify no cycle (engagement does NOT need to import post-history at construction time — only at `getSavedPosts()` call time, which is fine for ESM).
- **`AppEvent` extension at `types/index.ts:662-696`** — add two new union members. Keep alphabetical-ish grouping by domain (engagement events near CONCEPT_EXPLORED).
- **Phase 43 future wiring** — Force-New-Day handler in `app/src/screens/settings/SettingsDataScreen.tsx:95+` needs to add `engagementService.reset()` call alongside the existing `dailyReadService.reset()`. Phase 43 owns this wiring; Phase 39 only ensures the `reset()` method exists and is tested.
- **`event-bus.ts`** — already supports the new event types automatically once they're added to the AppEvent union (the bus uses generic dispatch; no per-type registration). Phase 39 doesn't touch event-bus.ts.

</code_context>

<specifics>
## Specific Ideas

- **Operator clarified mid-discussion that auto-gen podcast is NOT broken** — works when app foregrounded; backgrounded scheduling is an architectural limitation of serverless/local-first design. This reframed the podcast inspection from "fix a bug" to "wait for client/server split." Captured in auto-memory `project_serverless_no_background_tasks.md` so future planning conversations don't re-propose backgrounding fixes.
- **Operator selected "Recommended" on all four follow-up questions** — solid alignment with the conservative, infra-reusing approach. Pattern: pin saved IDs against retention purge, two events with payload-discriminated kind, defense-in-depth anti-wire enforcement, hard-cap fix-bound (which became moot when the podcast plan was dropped).
- **Walker change is small** — `count * 2` lazy-skip headroom math (Phase 36 GAP-B) doesn't need re-derivation; it already accounts for arbitrary skips. Adding `dismissedIds` to the skip predicate is a single AND clause: `if (!exploredIds.has(id) && !dismissedIds.has(id)) result.push(id);`. Verify with the same test family that already covers explored-id skip semantics.

</specifics>

<deferred>
## Deferred Ideas

- **Background podcast auto-gen** — feature works when app is open; backgrounded scheduling requires future client/server split. Operator-confirmed 2026-05-09. Captured in auto-memory.
- **Sort-by-recent for Saved / Liked views** — would need timestamps in the storage shape. Deferred until Phase 43+ surfaces a concrete UI need. Forward-compatible: schema can add a parallel `_ts` map without breaking ID-array reads.
- **Dismiss cooldown** ("don't re-show this anchor for 30 days then re-evaluate") — would need timestamps + cooldown windows. Not in current ROADMAP; current model is "dismiss persists until undo or Clear-All-Data."
- **Cross-device engagement sync** — local-first scope; would need backend. Same client/server split unlock as the podcast.
- **Engagement bulk operations** — "Save all posts for anchor X" / "Unsave all from this week." Not in any ROADMAP entry; deferred until UI need surfaces.
- **`subscribeEngagement(handler)` convenience helper** — instead of requiring direct `eventBus.subscribe('ENGAGEMENT_CHANGED', ...)`. Could collapse two-event subscription (ANCHOR_DISMISSED + ENGAGEMENT_CHANGED) into one helper. Defer to Phase 43 if the duplicate-subscribe boilerplate proves annoying in practice.

### Reviewed Todos (not folded)

- `.planning/todos/pending/2026-05-07-double-column-feed-to-further-mimic-rednote-bilibili-info-flow.md` — Phase 42 (MASONRY-01) territory; not folded.
- `.planning/todos/pending/2026-05-07-fix-cosine-similarity-threshold-cache-miss.md` — unrelated subsystem (`canonical-knowledge.service.ts` embedding pre-check); separate v1.5.x or future phase; not folded.
- `.planning/todos/pending/2026-05-09-inspect-auto-gen-podcast-working-or-not-and-debug.md` — **resolved during this discussion as not-a-bug** (operator confirmed the feature works as designed within local-first constraints; backgrounded scheduling is an architectural limitation, not a code bug). Can be moved to addressed.

</deferred>

---

*Phase: 39-engagement-service-walker-extension*
*Context gathered: 2026-05-09*

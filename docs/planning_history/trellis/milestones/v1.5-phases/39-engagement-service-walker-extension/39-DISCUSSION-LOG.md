# Phase 39: Engagement Service + Walker Extension — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 39-engagement-service-walker-extension
**Areas discussed:** Todo folding, Storage shape, Saved-post retrieval, Event emissions, Anti-wire enforcement, Podcast fix-bound, Saved-post longevity, Dismiss-event semantics

---

## Todo Folding

| Option | Description | Selected |
|--------|-------------|----------|
| None (Recommended) | All three matched todos belong to other phases (42, post-Wave-1 bug fix, or Phase 41 podcast). Keeps Phase 39 lean — service+walker+event only. | |
| Double-column feed | Pull MASONRY-01 work forward. Not recommended — Wave 3 deferral exists for a reason. | |
| Cosine threshold/cache | Unrelated subsystem (embedding pre-check). Not recommended. | |
| Auto-gen podcast debug | Unrelated subsystem (TTS pipeline). Not recommended. | ✓ |

**User's choice:** Auto-gen podcast debug
**Notes:** Operator initially chose to fold; later interrupted with mid-discussion clarification that the auto-gen podcast actually works as designed — only "issue" is that it doesn't fire when the app is backgrounded, which is an architectural limitation of the local-first / serverless design. Not a fixable bug. Operator wants this remembered for future client/server split. Result: podcast inspection plan dropped from Phase 39; architectural constraint captured in auto-memory `project_serverless_no_background_tasks.md`; the original todo can be moved to addressed.

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Storage shape | How `trellis_engagement_v1` is organized internally. | ✓ |
| Saved-post retrieval | What `getSavedPosts()` returns (postIds vs DailyPost[]). | ✓ |
| Event emissions | How engagementService notifies React UI on state changes. | ✓ |
| Anti-wire enforcement | How to enforce no double-emit ANCHOR_DISMISSED + CONCEPT_EXPLORED. | ✓ |

**User's choice:** All four areas
**Notes:** All gray areas selected for discussion.

---

## Podcast Fix Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| ≤2 files, ≤1 commit (Recommended) | Strict bisectability cap. | ✓ |
| ≤5 files, time-boxed 2h | Wider net; risk of multi-file fixes. | |
| No hard cap — use judgment | Most flexible; biggest scope-drift risk. | |

**User's choice:** ≤2 files, ≤1 commit (subsequently moot)
**Notes:** Selected before the operator's mid-discussion clarification dropped the podcast fold entirely. Not load-bearing for Phase 39 final shape; preserved here for audit completeness.

---

## Storage Shape & Saved-Post Retrieval

| Option | Description | Selected |
|--------|-------------|----------|
| IDs in engagement, snapshots from post-history (Recommended) | engagement stores `{ saved: string[], liked: string[], dismissed: string[] }`. `getSavedPosts(): DailyPost[]` resolves through `postHistoryService.getPosts()`. | ✓ |
| IDs only, return string[] | Service returns `string[]`; Phase 43 UI fully responsible for resolution. | |
| Inline DailyPost snapshots in engagement | Self-contained but duplicates post-history storage; risks drift. | |
| Hybrid: snapshot only for saved, IDs for liked/dismissed | Mixed shape; subtler API. | |

**User's choice:** IDs in engagement, snapshots from post-history
**Notes:** Reuses existing `post-history.service.ts` infrastructure (already stores 7-day rolling DailyPost snapshots with retention purge). No duplicate storage; cross-day persistence works as long as retention covers the saved post — addressed by D-04 pinning below.

---

## Event Emissions

| Option | Description | Selected |
|--------|-------------|----------|
| Two events: ANCHOR_DISMISSED + ENGAGEMENT_CHANGED (Recommended) | Walker subscribes to ANCHOR_DISMISSED. New `ENGAGEMENT_CHANGED { kind, id }` for save/like/undismiss. Mirrors GRAPH_UPDATED precedent. | ✓ |
| Per-action events | 5 new event types. Granular but violates CLAUDE.md best practice rule 6. | |
| Sync reads only, no extra events | UI manages own re-render state via local useState. Risk of drift. | |

**User's choice:** Two events: ANCHOR_DISMISSED + ENGAGEMENT_CHANGED
**Notes:** Walker has a specific consumer interest; UI has a broader interest. Single payload-typed event mirrors `GRAPH_UPDATED { kind }` precedent from CLAUDE.md §"Event bus — unified GRAPH_UPDATED."

---

## Anti-wire Enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Source-reading + behavioral both (Recommended) | Grep invariant test + event-bus log assertion. Defense-in-depth. | ✓ |
| Source-reading only | Cheaper; misses runtime composition violations. | |
| Behavioral only | Catches runtime double-emit; misses unreachable code paths. | |
| Runtime guard inside service | Strong but surfaces at runtime in production; risky. | |

**User's choice:** Source-reading + behavioral both
**Notes:** Two cheap tests covering static + runtime concerns. Source-reading catches "future caller wires both via separate handlers" at lint-equivalent cost; behavioral catches "dismissAnchor calls a helper that calls markExplored" at single-test-case cost.

---

## Saved-Post Longevity vs post-history Retention

| Option | Description | Selected |
|--------|-------------|----------|
| Pin: post-history skips purge for saved IDs (Recommended) | engagementService exposes `getPinnedIds(): string[]` (saved ∪ liked); `postHistoryService.purgeExpired()` reads it and skips matching posts. Saved posts effectively immortal. | ✓ |
| Bump retention default to e.g. 90 days | Simpler but doesn't actually solve the problem. | |
| Accept gaps; UI shows 'post no longer available' | Lets retention work as designed but degrades 'Saved' view. | |
| Defer entirely — Phase 43's problem | Punts the call to UI phase. | |

**User's choice:** Pin: post-history skips purge for saved IDs
**Notes:** Single localStorage source of truth (engagement). post-history's `purgeExpired()` extends with one-line filter check. Verify no import cycle (engagement does NOT need to import post-history at construction time, only at `getSavedPosts()` call time — fine for ESM).

---

## Dismiss Event Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| No — dismiss is ANCHOR_DISMISSED-only; undismiss is ENGAGEMENT_CHANGED-only (Recommended) | Walker subscribes to ANCHOR_DISMISSED. UI subscribes to BOTH. One event per semantic action. | ✓ |
| Yes — dismiss fires both (ANCHOR_DISMISSED + ENGAGEMENT_CHANGED kind:'dismiss') | Each consumer handles one event. Two emits per dismiss is harmless. | |

**User's choice:** No — dismiss is ANCHOR_DISMISSED-only; undismiss is ENGAGEMENT_CHANGED-only
**Notes:** UI subscribes to both events for full coverage. Walker subscribes to ANCHOR_DISMISSED only (no payload discrimination needed). Matches one-signal-per-semantic-event rule (CLAUDE.md best practice rule 6).

---

## Claude's Discretion

Areas where the user delegated to Claude's judgment:
- Engagement service file path: `app/src/services/engagement.service.ts`
- Internal storage helper functions modeled on `daily-read.service.ts:25-51`
- Test file paths: `engagement.service.test.mjs` + `engagement-anti-wire.test.mjs` (planner can collapse if preferred)
- Whether to expose a `subscribeEngagement(handler)` convenience helper (default: no, use direct event-bus)
- Whether `ENGAGEMENT_CHANGED` `kind` is a string literal union or enum-like const object (default: string literal union)

---

## Deferred Ideas

(See CONTEXT.md `<deferred>` section for full list.)

Highlights:
- Background podcast auto-gen — blocked on future client/server split
- Sort-by-recent for Saved/Liked views — needs timestamps; defer until UI surfaces need
- Dismiss cooldown — needs timestamps + cooldown windows; not in current ROADMAP
- Cross-device engagement sync — local-first scope; needs backend
- `subscribeEngagement(handler)` convenience helper — defer to Phase 43 if duplicate-subscribe boilerplate proves annoying

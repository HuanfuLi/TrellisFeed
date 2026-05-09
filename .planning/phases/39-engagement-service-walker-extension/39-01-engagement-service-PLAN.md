---
phase: 39-engagement-service-walker-extension
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/types/index.ts
  - app/src/services/engagement.service.ts
  - app/tests/services/engagement.service.test.mjs
  - app/tests/services/engagement-anti-wire.test.mjs
  - app/src/services/post-queue.service.ts
  - app/tests/services/derived-list.test.mjs
  - app/src/services/concept-feed.service.ts
  - app/src/services/post-history.service.ts
autonomous: true
requirements:
  - ENGAGE-01
  - ENGAGE-02
  - ENGAGE-03
must_haves:
  truths:
    - "engagementService.savePost(postId) / getSavedPosts() / removeSavedPost(postId) round-trips through localStorage key trellis_engagement_v1 and persists across same-day app reload"
    - "engagementService.likePost(postId) / unlikePost(postId) / isLiked(postId) round-trip through the same key"
    - "engagementService.dismissAnchor(anchorId) adds the anchor to a dismissed set; getDismissedAnchorIds() returns it; walkDerivedList(count, exploredIds, dismissedIds) skips matching entries lazily at walk time (no array splicing, cyclePosition uncorrupted)"
    - "ANCHOR_DISMISSED event added to AppEvent union; engagementService.dismissAnchor emits it; no code path emits both ANCHOR_DISMISSED and CONCEPT_EXPLORED for the same call (anti-wire test passes)"
    - "Saved/liked posts persist across day boundaries (no date-based reset); dismissed anchors only reset via explicit undo or Clear All Data"
  artifacts:
    - path: "app/src/services/engagement.service.ts"
      provides: "Local-first engagement leaf service (save/like/dismiss + reset)"
      contains: "STORAGE_KEY = 'trellis_engagement_v1'"
    - path: "app/src/types/index.ts"
      provides: "AppEvent union extended with ANCHOR_DISMISSED + ENGAGEMENT_CHANGED"
      contains: "ANCHOR_DISMISSED"
    - path: "app/src/services/post-queue.service.ts"
      provides: "walkDerivedList signature gains required positional dismissedIds arg; lazy-skip predicate ANDs both sets"
      contains: "dismissedIds"
    - path: "app/src/services/concept-feed.service.ts"
      provides: "Sole walker caller updated to pass engagementService.getDismissedAnchorIds() as third arg"
      contains: "engagementService"
    - path: "app/src/services/post-history.service.ts"
      provides: "purgeExpired filter pins saved/liked posts via engagementService.getPinnedIds()"
      contains: "getPinnedIds"
    - path: "app/tests/services/engagement.service.test.mjs"
      provides: "Behavioral test suite for engagement API + reset() + event emissions"
    - path: "app/tests/services/engagement-anti-wire.test.mjs"
      provides: "Source-reading invariant test forbidding co-emit of ANCHOR_DISMISSED + CONCEPT_EXPLORED in the same function body"
  key_links:
    - from: "app/src/services/engagement.service.ts"
      to: "app/src/lib/event-bus.ts"
      via: "eventBus.emit({ type: 'ANCHOR_DISMISSED' | 'ENGAGEMENT_CHANGED', payload })"
      pattern: "eventBus\\.emit\\(\\{\\s*type:\\s*'(ANCHOR_DISMISSED|ENGAGEMENT_CHANGED)'"
    - from: "app/src/services/concept-feed.service.ts"
      to: "app/src/services/engagement.service.ts"
      via: "engagementService.getDismissedAnchorIds() at refill site"
      pattern: "engagementService\\.getDismissedAnchorIds"
    - from: "app/src/services/concept-feed.service.ts"
      to: "app/src/services/post-queue.service.ts"
      via: "walkDerivedList(16, exploredIds, dismissedIds) call"
      pattern: "walkDerivedList\\(\\s*16\\s*,\\s*exploredIds\\s*,\\s*dismissedIds"
    - from: "app/src/services/post-history.service.ts"
      to: "app/src/services/engagement.service.ts"
      via: "engagementService.getPinnedIds() inside purgeExpired filter"
      pattern: "engagementService\\.getPinnedIds\\(\\)\\.has"
---

<objective>
Land the foundation engagement leaf service for save / like / dismiss state, extend the derived-list walker to lazily skip dismissed anchor IDs, and pin saved+liked posts against post-history retention purge — all per the locked CONTEXT.md decisions D-01 through D-08.

Purpose: Provides the API surface that Phase 43 (Engagement UI) wires into long-press menus, action rows, and the future "Saved" view. Closes ENGAGE-01 / ENGAGE-02 / ENGAGE-03 from REQUIREMENTS.md. No UI in this phase.

Output: A standalone leaf service (`app/src/services/engagement.service.ts`) modeled on `daily-read.service.ts` minus the date-keyed reset; extended walker signature with required positional `dismissedIds`; new `ANCHOR_DISMISSED` + `ENGAGEMENT_CHANGED` event types; cross-module pin-against-purge wire from post-history to engagement; behavioral + source-reading invariant tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/39-engagement-service-walker-extension/39-CONTEXT.md
@CLAUDE.md
@app/src/services/daily-read.service.ts
@app/src/services/trellis-credits.service.ts
@app/src/services/post-queue.service.ts
@app/src/services/post-history.service.ts
@app/src/types/index.ts

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from codebase. -->
<!-- Executor should use these directly — no codebase exploration needed. -->

From app/src/types/index.ts (AppEvent union pattern at lines 662-696):

```typescript
export type AppEvent =
  | { type: 'QUESTION_ASKED'; payload: Question }
  // ... existing members ...
  | { type: 'CONCEPT_EXPLORED'; payload: { anchorId: string } }
  | { type: 'GRAPH_UPDATED' };
```

New members to ADD (D-05):

```typescript
  | { type: 'ANCHOR_DISMISSED'; payload: { anchorId: string } }
  | { type: 'ENGAGEMENT_CHANGED'; payload: { kind: 'save' | 'unsave' | 'like' | 'unlike' | 'undismiss'; id: string } }
```

From app/src/lib/event-bus.ts (sync emit/subscribe API):

```typescript
export const eventBus: {
  subscribe<T extends AppEvent['type']>(eventType: T, handler: Handler<T>): Unsubscribe;
  emit(event: AppEvent): void;
};
```

From app/src/services/post-queue.service.ts (walker — extension site at line 366):

```typescript
walkDerivedList(count: number, exploredIds: Set<string>): string[]
// → must become:
walkDerivedList(count: number, exploredIds: Set<string>, dismissedIds: Set<string>): string[]
```

From app/src/services/post-history.service.ts (purgeExpired filter at line 64):

```typescript
const posts = loadPosts().filter(p => p.generatedAt > cutoff);
// → must become:
const pinned = engagementService.getPinnedIds();
const posts = loadPosts().filter(p => pinned.has(p.id) || p.generatedAt > cutoff);
```

From app/src/services/concept-feed.service.ts (sole walker caller at line 1209):

```typescript
const conceptIds = postQueueService.walkDerivedList(16, exploredIds);
// → must become:
const dismissedIds = new Set(engagementService.getDismissedAnchorIds());
const conceptIds = postQueueService.walkDerivedList(16, exploredIds, dismissedIds);
```

Engagement service public API (the contract this plan ships):

```typescript
export const engagementService: {
  // Saved posts
  savePost(postId: string): void;
  removeSavedPost(postId: string): void;
  isSaved(postId: string): boolean;
  getSavedPostIds(): string[];
  getSavedPosts(): DailyPost[];      // resolves through postHistoryService.getPosts()

  // Likes
  likePost(postId: string): void;
  unlikePost(postId: string): void;
  isLiked(postId: string): boolean;
  getLikedPostIds(): string[];
  getLikedPosts(): DailyPost[];      // resolves through postHistoryService.getPosts()

  // Dismissed anchors
  dismissAnchor(anchorId: string): void;
  undismissAnchor(anchorId: string): void;
  isDismissed(anchorId: string): boolean;
  getDismissedAnchorIds(): string[];

  // Cross-module helper — D-04 retention pin
  getPinnedIds(): Set<string>;       // saved ∪ liked

  // Test/dev affordance — Phase 43 wires Force-New-Day call site
  reset(): void;                     // does NOT emit ENGAGEMENT_CHANGED
};
```

Storage shape (D-03):

```typescript
interface EngagementState {
  saved: string[];      // postIds
  liked: string[];      // postIds
  dismissed: string[];  // anchorIds
}
```

Storage key: `'trellis_engagement_v1'` (the `_v1` suffix is locked by ROADMAP success criterion #1; do NOT normalize).

Event emission rules (D-05):
- `dismissAnchor` emits ONLY `ANCHOR_DISMISSED { payload: { anchorId } }` (NEVER also `ENGAGEMENT_CHANGED`).
- `undismissAnchor` emits ONLY `ENGAGEMENT_CHANGED { payload: { kind: 'undismiss', id } }` (NEVER also `ANCHOR_DISMISSED`).
- `savePost` / `removeSavedPost` / `likePost` / `unlikePost` each emit ONE `ENGAGEMENT_CHANGED` with `kind` set to `'save'` / `'unsave'` / `'like'` / `'unlike'` respectively.
- `reset()` emits NOTHING (D-08).
- All mutators are idempotent: re-saving an already-saved post is a no-op AND does NOT re-emit (check membership before push+emit).

</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend AppEvent union with ANCHOR_DISMISSED + ENGAGEMENT_CHANGED</name>
  <files>app/src/types/index.ts</files>
  <read_first>
    - app/src/types/index.ts (lines 658-697 — current AppEvent union shape; CONCEPT_EXPLORED + GRAPH_UPDATED siblings define the precedent)
    - .planning/phases/39-engagement-service-walker-extension/39-CONTEXT.md (D-05 — event-emission rules)
    - CLAUDE.md §"Event bus — unified GRAPH_UPDATED" (single-event-payload-discriminates-kind precedent)
  </read_first>
  <action>
    Add exactly two new members to the `AppEvent` discriminated union in `app/src/types/index.ts`. Insert them immediately AFTER the `CONCEPT_EXPLORED` line (line 690) and BEFORE the `GRAPH_UPDATED` block comment (lines 691-696). Keep the existing alphabetical-ish domain grouping by placing both engagement events adjacent to `CONCEPT_EXPLORED` (concept/anchor domain).

    Exact lines to add (verbatim, including the leading `  | `):

    ```typescript
      | { type: 'ANCHOR_DISMISSED'; payload: { anchorId: string } }
      | { type: 'ENGAGEMENT_CHANGED'; payload: { kind: 'save' | 'unsave' | 'like' | 'unlike' | 'undismiss'; id: string } }
    ```

    Do NOT touch any other part of the union. Do NOT delete or rename existing event types. Do NOT widen the `kind` literal to a generic `string`.
  </action>
  <verify>
    <automated>cd app && tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "type: 'ANCHOR_DISMISSED'" app/src/types/index.ts` returns 1
    - `grep -c "type: 'ENGAGEMENT_CHANGED'" app/src/types/index.ts` returns 1
    - `grep -E "kind:\s*'save'\s*\|\s*'unsave'\s*\|\s*'like'\s*\|\s*'unlike'\s*\|\s*'undismiss'" app/src/types/index.ts` returns ≥1 line
    - `grep -c "type: 'CONCEPT_EXPLORED'" app/src/types/index.ts` returns 1 (existing event NOT removed)
    - `grep -c "type: 'GRAPH_UPDATED'" app/src/types/index.ts` returns 1 (existing event NOT removed)
    - Running `cd app && tsc -b --noEmit` exits 0
  </acceptance_criteria>
  <done>AppEvent union contains the two new members; project still type-checks; no existing events were renamed or deleted.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement engagement.service.ts (leaf service)</name>
  <files>app/src/services/engagement.service.ts</files>
  <read_first>
    - app/src/services/daily-read.service.ts (full file — pattern precedent for STORAGE_KEY + freshState/loadState/saveState + sync API + reset())
    - app/src/services/trellis-credits.service.ts (minimal leaf-service shape — silent quota-drop idiom)
    - app/src/services/post-history.service.ts (lines 30-50 — getPosts() returns DailyPost[] sorted desc; engagement getSavedPosts/getLikedPosts will read from this)
    - app/src/lib/event-bus.ts (eventBus.emit signature)
    - app/src/types/index.ts (DailyPost type; AppEvent union after Task 1)
    - .planning/phases/39-engagement-service-walker-extension/39-CONTEXT.md (D-03 storage shape, D-04 pinning, D-05 event rules, D-08 reset semantics)
    - CLAUDE.md §"Best practices learned in Phase 32.1" rule 6 (one signal per semantic event)
  </read_first>
  <behavior>
    - savePost('p1') → state.saved becomes ['p1'], one ENGAGEMENT_CHANGED { kind:'save', id:'p1' } event emitted
    - savePost('p1') called twice → state.saved is still ['p1'], only ONE event emitted (idempotent)
    - removeSavedPost('p1') after save → state.saved is [], one ENGAGEMENT_CHANGED { kind:'unsave', id:'p1' }
    - removeSavedPost('p1') on never-saved post → no state change, NO event emitted (idempotent)
    - likePost / unlikePost / isLiked → mirror save API with kind: 'like'/'unlike'
    - dismissAnchor('a1') → state.dismissed becomes ['a1'], emits EXACTLY ONE ANCHOR_DISMISSED { anchorId:'a1' }, ZERO ENGAGEMENT_CHANGED
    - undismissAnchor('a1') after dismiss → state.dismissed is [], emits EXACTLY ONE ENGAGEMENT_CHANGED { kind:'undismiss', id:'a1' }, ZERO ANCHOR_DISMISSED
    - getPinnedIds() → returns Set<string> = saved ∪ liked (NOT dismissed)
    - getSavedPosts() → returns DailyPost[] resolved through postHistoryService.getPosts(); preserves saved-id insertion order; returns fewer items than getSavedPostIds().length when a post is missing from history (graceful degradation, no error)
    - reset() → wipes all three collections to []; persists; does NOT emit any event
    - State persists across module reload (writes to localStorage with key 'trellis_engagement_v1')
    - Corrupted localStorage JSON → loadState returns freshState (no throw)
    - localStorage write quota exceeded → silent drop (try/catch swallow)
  </behavior>
  <action>
    Create `app/src/services/engagement.service.ts` modeled on `daily-read.service.ts` MINUS the date field (engagement persists cross-day per success criterion #5).

    Required structure:

    1. Imports — keep leaf-module discipline (NO JSON imports, NO `react-i18next`, NO `lib/date.ts`):
       ```typescript
       import type { DailyPost } from '../types/index.ts';
       import { eventBus } from '../lib/event-bus.ts';
       import { postHistoryService } from './post-history.service.ts';
       ```

    2. STORAGE_KEY const — exact value `'trellis_engagement_v1'` (locked by ROADMAP success criterion #1; do NOT add or remove the `_v1` suffix):
       ```typescript
       const STORAGE_KEY = 'trellis_engagement_v1';
       ```

    3. Internal `EngagementState` interface — D-03 shape:
       ```typescript
       interface EngagementState {
         saved: string[];      // postIds
         liked: string[];      // postIds
         dismissed: string[];  // anchorIds
       }
       ```

    4. Helpers `freshState()`, `loadState()`, `saveState()` modeled on `daily-read.service.ts:25-51`:
       - `freshState()` → `{ saved: [], liked: [], dismissed: [] }`
       - `loadState()` → try parse from localStorage; on error or non-object, return freshState(); validate each field via `Array.isArray(...)` and fall back to `[]` per-field if missing.
       - `saveState(state)` → `try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* silent quota-drop */ }`

    5. Exported `engagementService` const object literal with the FULL API listed in `<interfaces>` above. Implementation rules:
       - Every mutator: load state → check membership → if change is a no-op, return WITHOUT emitting → otherwise mutate, save, emit exactly ONE event.
       - `savePost(postId)`: if `state.saved.includes(postId)` return; else push + saveState + `eventBus.emit({ type: 'ENGAGEMENT_CHANGED', payload: { kind: 'save', id: postId } })`.
       - `removeSavedPost(postId)`: if not in `state.saved` return; else filter it out + saveState + `eventBus.emit({ type: 'ENGAGEMENT_CHANGED', payload: { kind: 'unsave', id: postId } })`.
       - `likePost` / `unlikePost`: same pattern as save/removeSaved with `kind: 'like'` / `'unlike'`.
       - `dismissAnchor(anchorId)`: if `state.dismissed.includes(anchorId)` return; else push + saveState + `eventBus.emit({ type: 'ANCHOR_DISMISSED', payload: { anchorId } })`. **DO NOT also emit ENGAGEMENT_CHANGED in this method body.** (D-06 anti-wire invariant.)
       - `undismissAnchor(anchorId)`: if not in `state.dismissed` return; else filter it out + saveState + `eventBus.emit({ type: 'ENGAGEMENT_CHANGED', payload: { kind: 'undismiss', id: anchorId } })`. **DO NOT also emit ANCHOR_DISMISSED in this method body.**
       - `isSaved` / `isLiked` / `isDismissed`: `loadState().{collection}.includes(id)`.
       - `getSavedPostIds()` / `getLikedPostIds()` / `getDismissedAnchorIds()`: return shallow copy of the array (`[...loadState().{collection}]`).
       - `getPinnedIds(): Set<string>`: `const s = loadState(); return new Set([...s.saved, ...s.liked]);` — D-04. Does NOT include dismissed.
       - `getSavedPosts(): DailyPost[]`: load saved IDs; lookup each in `postHistoryService.getPosts()` (which returns sorted desc); return the resolved posts in saved-ID insertion order (NOT history order — preserves user-action sequence). Posts not found in history are silently dropped (graceful degradation per D-04 edge case).
       - `getLikedPosts(): DailyPost[]`: same pattern as getSavedPosts but using liked IDs.
       - `reset(): void`: `saveState(freshState())`. **DO NOT emit any event.** (D-08.)

    6. Inline comment block at the top of the file explaining: leaf-module discipline (no i18next chain, sync API, ID-only storage with snapshot resolution via postHistoryService at read time per D-03), and event-emission rules (one signal per semantic action per D-05; dismissAnchor uses ANCHOR_DISMISSED only per D-06). Reference Phase 39 + CONTEXT.md D-03/D-04/D-05/D-06/D-08.

    Do NOT add any `today()` helper (engagement has no date-keyed reset). Do NOT import `lib/date.ts`. Do NOT introduce `subscribeEngagement` convenience helper (Phase 43 territory; defer per CONTEXT.md discretion).
  </action>
  <verify>
    <automated>MISSING — paired test in Task 3 will exercise this file. For Task 2 in isolation, run `cd app && tsc -b --noEmit` to confirm the module type-checks against the AppEvent union from Task 1.</automated>
  </verify>
  <acceptance_criteria>
    - File exists at `app/src/services/engagement.service.ts`
    - `grep -c "STORAGE_KEY = 'trellis_engagement_v1'" app/src/services/engagement.service.ts` returns 1
    - `grep -c "export const engagementService" app/src/services/engagement.service.ts` returns 1
    - `grep -c "savePost\|removeSavedPost\|isSaved\|getSavedPostIds\|getSavedPosts" app/src/services/engagement.service.ts` returns ≥5
    - `grep -c "likePost\|unlikePost\|isLiked\|getLikedPostIds\|getLikedPosts" app/src/services/engagement.service.ts` returns ≥5
    - `grep -c "dismissAnchor\|undismissAnchor\|isDismissed\|getDismissedAnchorIds" app/src/services/engagement.service.ts` returns ≥4
    - `grep -c "getPinnedIds" app/src/services/engagement.service.ts` returns ≥1
    - `grep -c "reset()" app/src/services/engagement.service.ts` returns ≥1
    - `grep -c "ANCHOR_DISMISSED" app/src/services/engagement.service.ts` returns exactly 1 (single emit site inside dismissAnchor)
    - `grep -c "ENGAGEMENT_CHANGED" app/src/services/engagement.service.ts` returns 5 (one per: savePost, removeSavedPost, likePost, unlikePost, undismissAnchor)
    - `grep -E "from\s+['\"]\\.\\./locales" app/src/services/engagement.service.ts` returns NOTHING (leaf-module discipline)
    - `grep -E "from\s+['\"]\\.\\./lib/date" app/src/services/engagement.service.ts` returns NOTHING (no i18next chain)
    - `grep -c "from '../lib/event-bus.ts'" app/src/services/engagement.service.ts` returns 1
    - `grep -c "from './post-history.service.ts'" app/src/services/engagement.service.ts` returns 1
    - `cd app && tsc -b --noEmit` exits 0
  </acceptance_criteria>
  <done>engagement.service.ts exports the full API surface specified in `<interfaces>`; persists to `trellis_engagement_v1`; uses leaf-module discipline; type-checks clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Behavioral tests for engagement.service.ts (incl. anti-wire behavioral half of D-06)</name>
  <files>app/tests/services/engagement.service.test.mjs</files>
  <read_first>
    - app/tests/services/daily-read.service.test.mjs (parity target — describe/beforeEach + localStorage shim shape)
    - app/tests/services/trellis-credits.test.mjs (minimal leaf-service test shape)
    - app/src/services/engagement.service.ts (after Task 2 — the API under test)
    - .planning/phases/39-engagement-service-walker-extension/39-CONTEXT.md (D-06 — behavioral half of anti-wire enforcement: capture event-bus log, assert exactly 1 ANCHOR_DISMISSED + 0 CONCEPT_EXPLORED for a dismissAnchor call)
  </read_first>
  <action>
    Create `app/tests/services/engagement.service.test.mjs` mirroring the shape of `daily-read.service.test.mjs`. Use `node:test` describe/it/beforeEach and `node:assert/strict`. Install a `globalThis.localStorage` polyfill identical to the one in daily-read.service.test.mjs (Map-backed shim with getItem/setItem/removeItem/clear).

    Use dynamic import inside each test (`await import('../../src/services/engagement.service.ts')`) — needed because of Phase 37 leaf-module ESM requirements; copy the loader pattern from `trellis-credits.test.mjs`.

    Also subscribe to `eventBus` via dynamic import for the event-emission assertions:
    ```javascript
    const { eventBus } = await import('../../src/lib/event-bus.ts');
    const events = [];
    eventBus.subscribe('ANCHOR_DISMISSED', e => events.push(e));
    eventBus.subscribe('ENGAGEMENT_CHANGED', e => events.push(e));
    eventBus.subscribe('CONCEPT_EXPLORED', e => events.push(e));   // for anti-wire behavioral half
    ```

    REQUIRED test cases (one `it(...)` block each — name them clearly):

    1. `savePost adds postId to saved array and persists to trellis_engagement_v1`
       - Call savePost('p1'); assert getSavedPostIds() === ['p1']; assert JSON.parse(localStorage.getItem('trellis_engagement_v1')).saved deepEquals ['p1'].

    2. `savePost is idempotent — duplicate calls do not add twice and emit only one event`
       - Subscribe to ENGAGEMENT_CHANGED; call savePost('p1') twice; assert getSavedPostIds().length === 1; assert exactly 1 captured ENGAGEMENT_CHANGED with kind='save' and id='p1'.

    3. `removeSavedPost removes postId and emits ENGAGEMENT_CHANGED kind:'unsave'`
       - savePost('p1'); clear capture; removeSavedPost('p1'); assert getSavedPostIds() === []; assert exactly 1 ENGAGEMENT_CHANGED with kind='unsave', id='p1'.

    4. `removeSavedPost on never-saved post is a no-op (no event emitted)`
       - removeSavedPost('p-nope'); assert ZERO ENGAGEMENT_CHANGED captured.

    5. `likePost / unlikePost / isLiked round-trip with kind:'like'/'unlike'`
       - likePost('p1'); assert isLiked('p1') === true; assert 1 ENGAGEMENT_CHANGED kind='like'; unlikePost('p1'); assert isLiked('p1') === false; assert second event kind='unlike'.

    6. `dismissAnchor adds anchorId to dismissed and emits EXACTLY ONE ANCHOR_DISMISSED + ZERO ENGAGEMENT_CHANGED + ZERO CONCEPT_EXPLORED` (D-06 BEHAVIORAL HALF)
       - Subscribe to ANCHOR_DISMISSED, ENGAGEMENT_CHANGED, CONCEPT_EXPLORED separately into distinct arrays.
       - Call dismissAnchor('a1');
       - Assert exactly 1 ANCHOR_DISMISSED captured with payload.anchorId === 'a1';
       - Assert exactly 0 ENGAGEMENT_CHANGED captured;
       - Assert exactly 0 CONCEPT_EXPLORED captured.

    7. `dismissAnchor is idempotent — duplicate calls do not re-emit`
       - Call dismissAnchor('a1') twice; assert only 1 ANCHOR_DISMISSED captured total.

    8. `undismissAnchor emits EXACTLY ONE ENGAGEMENT_CHANGED kind:'undismiss' + ZERO ANCHOR_DISMISSED`
       - dismissAnchor('a1'); clear capture; undismissAnchor('a1'); assert getDismissedAnchorIds() === []; assert 1 ENGAGEMENT_CHANGED kind='undismiss'; assert 0 ANCHOR_DISMISSED.

    9. `getPinnedIds returns saved ∪ liked, NOT dismissed`
       - savePost('p1'); likePost('p2'); dismissAnchor('a1');
       - const pinned = getPinnedIds();
       - Assert pinned.has('p1') === true; pinned.has('p2') === true; pinned.has('a1') === false; pinned.size === 2.

    10. `getSavedPosts resolves through postHistoryService and silently drops missing posts`
        - Pre-seed `localStorage.setItem('trellis_post_history', JSON.stringify([{ id: 'p1', generatedAt: Date.now(), title: 'one' }]))`.
        - savePost('p1'); savePost('p-missing');
        - assert getSavedPostIds() === ['p1', 'p-missing'] (length 2);
        - assert getSavedPosts().length === 1 (graceful degradation per D-04 edge case);
        - assert getSavedPosts()[0].id === 'p1'.

    11. `state persists across same-day reload (round-trip via raw JSON)`
        - savePost('p1'); likePost('p2'); dismissAnchor('a1');
        - Read raw `localStorage.getItem('trellis_engagement_v1')`; parse; assert it deepEquals { saved: ['p1'], liked: ['p2'], dismissed: ['a1'] }.

    12. `reset() clears all three collections AND emits NOTHING` (D-08)
        - Subscribe to ANCHOR_DISMISSED, ENGAGEMENT_CHANGED, CONCEPT_EXPLORED.
        - savePost('p1'); likePost('p2'); dismissAnchor('a1'); clear capture arrays.
        - reset();
        - Assert getSavedPostIds() === [], getLikedPostIds() === [], getDismissedAnchorIds() === [].
        - Assert all three capture arrays are empty (zero events).

    13. `corrupted localStorage value loads as freshState (no throw)`
        - localStorage.setItem('trellis_engagement_v1', '{not valid json');
        - assert getSavedPostIds() === [], getLikedPostIds() === [], getDismissedAnchorIds() === [] (no throw).

    Use a `beforeEach` that clears localStorage AND re-creates the eventBus subscriptions (or relies on dynamic-import-fresh state — copy whichever pattern works; trellis-credits.test.mjs's per-test re-import + storage.clear() works fine).

    NOTE on event-bus statefulness: event-bus is a singleton, so subscribers from prior tests persist across describe-it boundaries. Either (a) collect events into per-test arrays declared inside each it() block (subscribers from prior its are harmless because their captures are out-of-scope), OR (b) use a beforeEach that creates the capture arrays fresh and pushes the unsubscribe handles into an `afterEach`. Pick whichever produces the cleanest test code.
  </action>
  <verify>
    <automated>cd app && node --test tests/services/engagement.service.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - File exists at `app/tests/services/engagement.service.test.mjs`
    - `grep -c "describe\|test(" app/tests/services/engagement.service.test.mjs` returns ≥13 (at least 13 cases)
    - `grep -c "ANCHOR_DISMISSED" app/tests/services/engagement.service.test.mjs` returns ≥3 (case 6 anti-wire behavioral, case 7 idempotency, case 8 negative)
    - `grep -c "CONCEPT_EXPLORED" app/tests/services/engagement.service.test.mjs` returns ≥1 (case 6 anti-wire behavioral half)
    - `grep -c "trellis_engagement_v1" app/tests/services/engagement.service.test.mjs` returns ≥2 (raw round-trip + corruption test)
    - `cd app && node --test tests/services/engagement.service.test.mjs` exits 0
  </acceptance_criteria>
  <done>All 13 behavioral test cases pass; the D-06 behavioral half (case 6 — exactly 1 ANCHOR_DISMISSED + 0 CONCEPT_EXPLORED on dismissAnchor) is locked in; reset() proven not to emit per D-08.</done>
</task>

<task type="auto">
  <name>Task 4: Source-reading anti-wire invariant test (D-06 static half)</name>
  <files>app/tests/services/engagement-anti-wire.test.mjs</files>
  <read_first>
    - app/tests/services/web-search-no-locale.test.mjs (FORBIDDEN_SUBSTRINGS source-reading pattern)
    - app/tests/state/useQuestions-system-prompt-stability.test.mjs (file-walking + co-occurrence-within-window pattern; the windowed regex idea is identical)
    - .planning/phases/39-engagement-service-walker-extension/39-CONTEXT.md (D-06 — source-reading half: assert no source file under app/src/ contains both `eventBus.emit({type:'ANCHOR_DISMISSED'` and `eventBus.emit({type:'CONCEPT_EXPLORED'` within the same function/closure body)
    - app/src/services/engagement.service.ts (target file — should pass this test by construction)
  </read_first>
  <action>
    Create `app/tests/services/engagement-anti-wire.test.mjs` — a source-reading invariant test that walks every `.ts` file under `app/src/` and asserts no single file contains BOTH event emissions in the same function body.

    The test MUST:

    1. Use `node:fs` + `node:path` to recursively walk `app/src/**/*.ts` and `app/src/**/*.tsx`. Skip `node_modules`, `.git`, build outputs, and any `*.test.*`/`*.spec.*` paths.

    2. For each file, read source; locate every occurrence of the literal substring `eventBus.emit({ type: 'ANCHOR_DISMISSED'` (allow flexible whitespace via regex: `/eventBus\.emit\(\s*\{\s*type:\s*['"]ANCHOR_DISMISSED['"]/g`).

    3. For each match, walk OUTWARD until the enclosing function body delimiter. Pragmatic implementation matching the prior-art pattern in useQuestions-system-prompt-stability.test.mjs: walk back up to 800 chars (typical max function body length used in this codebase per Phase 35 precedent) AND walk forward up to 800 chars; concatenate as the "function-window"; assert this window does NOT also contain `/eventBus\.emit\(\s*\{\s*type:\s*['"]CONCEPT_EXPLORED['"]/`.

       Implementation note: the 800-char window is a deliberate over-approximation chosen to be cheap and false-positive-tolerant. If a future legitimate emit site triggers a false positive, the contributor reads the failure message and either restructures the code (correct fix) or extracts an explanatory inline comment (explicit waiver).

    4. Assert ALSO the symmetric direction: locate every `eventBus.emit({ type: 'CONCEPT_EXPLORED'` match in non-engagement files and walk the same window; assert no `ANCHOR_DISMISSED` in the window.

    5. Provide a clear failure message for each violation: `${filePath} contains both ANCHOR_DISMISSED and CONCEPT_EXPLORED emit sites within an 800-char window — D-06 forbids co-emission. Move the second emit to a separate function or revert one of the two.`

    6. Counterweight assertion (matches Phase 35 negative-test idiom in useQuestions-system-prompt-stability.test.mjs): assert that `app/src/services/engagement.service.ts` IS in the scan list AND DOES contain at least one `eventBus.emit({ type: 'ANCHOR_DISMISSED'` reference. This catches a future contributor who deletes the engagement service or renames the event without updating the test scope (otherwise the test would silently pass on an empty scan).

    Required test cases (each as a `test(...)` or `it(...)` block):

    - `engagement.service.ts emits ANCHOR_DISMISSED at least once (counterweight — proves the scan reaches the target file)`
    - `no source file under app/src/ contains both ANCHOR_DISMISSED and CONCEPT_EXPLORED emit sites within the same 800-char window`

    Use the same import-style + describe/it shape as `web-search-no-locale.test.mjs`. Run-once `readFileSync` per file (no async I/O needed).
  </action>
  <verify>
    <automated>cd app && node --test tests/services/engagement-anti-wire.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - File exists at `app/tests/services/engagement-anti-wire.test.mjs`
    - `grep -c "ANCHOR_DISMISSED" app/tests/services/engagement-anti-wire.test.mjs` returns ≥2
    - `grep -c "CONCEPT_EXPLORED" app/tests/services/engagement-anti-wire.test.mjs` returns ≥2
    - `grep -c "engagement.service.ts" app/tests/services/engagement-anti-wire.test.mjs` returns ≥1 (counterweight)
    - `grep -c "readFileSync\|readdirSync\|fs\." app/tests/services/engagement-anti-wire.test.mjs` returns ≥1 (proves it walks files)
    - `cd app && node --test tests/services/engagement-anti-wire.test.mjs` exits 0
    - The test should produce a NON-ZERO exit if you temporarily add a stub `eventBus.emit({ type: 'CONCEPT_EXPLORED', payload: { anchorId: 'x' } })` line inside dismissAnchor in engagement.service.ts. (Manual sanity-check during execution; revert immediately. NOT a permanent test.)
  </acceptance_criteria>
  <done>Source-reading static invariant locks in D-06; counterweight prevents accidental scan-scope drift; test passes against the engagement.service.ts shipped in Task 2.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: Extend walkDerivedList signature with required positional dismissedIds + update existing derived-list tests</name>
  <files>app/src/services/post-queue.service.ts, app/tests/services/derived-list.test.mjs</files>
  <read_first>
    - app/src/services/post-queue.service.ts (lines 349-389 — full walkDerivedList implementation including the Phase 36 GAP-B `Math.max(count * 2, len)` comment block; the math MUST NOT regress)
    - app/tests/services/derived-list.test.mjs (lines 73-155 — existing walkDerivedList test shape; all current calls pass `new Set()` as second arg and need a third arg added)
    - .planning/phases/39-engagement-service-walker-extension/39-CONTEXT.md (D-07 — required positional third arg, NOT defaulted)
    - CLAUDE.md §"Concept Feed Generation Pipeline" → "Numeric defaults" subsection (the `count * 2` factor preserves lazy-skip headroom; the `len` floor preserves at-least-one-pass; do NOT regress to `len * 2`)
  </read_first>
  <behavior>
    - walkDerivedList(count, exploredIds, dismissedIds): same return shape as before, but the lazy-skip predicate ANDs both sets.
    - Skip an entry if `exploredIds.has(id) || dismissedIds.has(id)`.
    - cyclePosition still advances for skipped entries (lazy skip, never splice).
    - The Phase 36 GAP-B `maxSteps = Math.max(count * 2, len)` math MUST be preserved verbatim including the load-bearing comment block.
    - All existing derived-list tests pass once their calls are updated to include the third arg.
    - New test case: `walkDerivedList(4, emptySet, dismissedSet={'b'}) on derivedList=['a','b','c','d'] returns ['a','c','d'] then wraps`.
    - New test case: `walkDerivedList lazy-skips both explored and dismissed in same call`.
    - New test case: `walkDerivedList returns [] when every entry is in exploredIds OR dismissedIds (no infinite loop)`.
  </behavior>
  <action>
    Two paired edits in a single commit (atomic per CONTEXT.md D-01 cadence — source + test together because removing the optional default would otherwise break compilation if test files are committed separately).

    **Edit 5a — `app/src/services/post-queue.service.ts` (line ~366):**

    Change the walker signature from:
    ```typescript
    walkDerivedList(count: number, exploredIds: Set<string>): string[] {
    ```
    to:
    ```typescript
    walkDerivedList(count: number, exploredIds: Set<string>, dismissedIds: Set<string>): string[] {
    ```

    Inside the body, change the skip predicate (line ~385):
    ```typescript
      if (!exploredIds.has(id)) result.push(id);
    ```
    to:
    ```typescript
      if (!exploredIds.has(id) && !dismissedIds.has(id)) result.push(id);
    ```

    **DO NOT** change the `maxSteps = Math.max(count * 2, len)` line. **DO NOT** delete or shorten the Phase 36 GAP-B comment block (lines ~370-378) — it's load-bearing per CLAUDE.md and prevents regression to `len * 2`. **DO NOT** default `dismissedIds` to `new Set()` — D-07 explicitly requires positional, NOT defaulted, so future callers cannot silently bypass dismiss-skip.

    Add a one-line comment immediately above the new signature noting Phase 39 + D-07: `// Phase 39 D-07: dismissedIds is REQUIRED positional (not defaulted) so future callers must explicitly opt in to the dismiss-skip behavior.`

    **Edit 5b — `app/tests/services/derived-list.test.mjs`:**

    1. Update every existing `walkDerivedList(count, exploredIds)` call in the file to add a third arg `new Set()` (an empty dismissed set so existing tests' semantics are preserved). Touched calls (per the grep snapshot above): lines 47, 75, 83, 86, 94, 101, 128, 147 — verify by re-grepping post-edit.

    2. Add a new `describe('walkDerivedList — dismissedIds skip (Phase 39 D-07)', () => { ... })` block with at least these three new test cases:

       a. `walkDerivedList lazy-skips dismissed ids while honoring count`
          - Seed derivedList ['a','b','c','d'] via `appendToDerivedList(['a','b','c','d'])`.
          - `const out = postQueueService.walkDerivedList(3, new Set(), new Set(['b']));`
          - Assert `out` deepEquals `['a','c','d']`.
          - Assert `getCyclePosition()` advanced by 4 steps (not 3 — lazy skip still advances past 'b').

       b. `walkDerivedList lazy-skips both explored AND dismissed in one call`
          - Seed ['a','b','c','d','e','f'] via appendToDerivedList.
          - `const out = postQueueService.walkDerivedList(3, new Set(['b']), new Set(['d']));`
          - Assert `out` deepEquals `['a','c','e']`.

       c. `walkDerivedList returns [] when every entry is dismissed (no infinite loop)`
          - Seed ['a','b','c'] via appendToDerivedList.
          - `const out = postQueueService.walkDerivedList(4, new Set(), new Set(['a','b','c']));`
          - Assert `out` deepEquals `[]`.
          - The fact that the test returns within `Math.max(count*2, len) = 8` steps proves the maxSteps guard still works.

       d. (Optional bonus — add if straightforward) `walkDerivedList(16, emptySet, new Set(['a'])) on 4-entry list returns 16 entries × 3 unique (a is skipped, b/c/d wrap)`
          - Seed ['a','b','c','d']; out = walkDerivedList(16, new Set(), new Set(['a'])); assert out.length === 16; assert every entry is in {b,c,d}; this proves the Phase 36 GAP-B `count * 2` factor still works under dismissed-skip.

    Use the same describe/it/beforeEach style as the rest of the file. Match the existing localStorage shim setup at the top.
  </action>
  <verify>
    <automated>cd app && node --test tests/services/derived-list.test.mjs && tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E "walkDerivedList\(\s*count:\s*number\s*,\s*exploredIds:\s*Set<string>\s*,\s*dismissedIds:\s*Set<string>\s*\)" app/src/services/post-queue.service.ts` returns 1 (signature changed)
    - `grep -E "!exploredIds\.has\(id\)\s*&&\s*!dismissedIds\.has\(id\)" app/src/services/post-queue.service.ts` returns 1 (predicate updated)
    - `grep -c "Math.max(count \* 2, len)" app/src/services/post-queue.service.ts` returns 1 (Phase 36 GAP-B math preserved)
    - `grep -c "Phase 36 GAP-B" app/src/services/post-queue.service.ts` returns ≥1 (load-bearing comment preserved)
    - `grep -c "Phase 39 D-07" app/src/services/post-queue.service.ts` returns ≥1 (new comment added)
    - `grep -c "dismissedIds = new Set()" app/src/services/post-queue.service.ts` returns 0 (NOT defaulted — D-07 enforcement)
    - `grep -c "walkDerivedList(" app/tests/services/derived-list.test.mjs` returns ≥11 (8 existing + 3 new minimum)
    - `grep -E "walkDerivedList\([^)]*new Set\(\)\s*,\s*new Set\(" app/tests/services/derived-list.test.mjs` returns ≥3 (new test cases pass three args, including a non-empty dismissedSet)
    - `cd app && node --test tests/services/derived-list.test.mjs` exits 0
    - `cd app && tsc -b --noEmit` exits 0 (NOTE: this will FAIL until Task 6 updates the sole caller — sequence Task 5 + Task 6 in the same wave OR commit them together as Phase 37 D-03 atomic source+test pairing allows; if running tests in isolation produces a tsc error pointing to concept-feed.service.ts:1209, that confirms Task 6 is the next required edit)
  </acceptance_criteria>
  <done>Walker signature requires three positional args; predicate skips both sets; Phase 36 GAP-B math preserved verbatim; existing derived-list tests pass with the new arg; three new dismissed-skip test cases lock in Phase 39 D-07 semantics.</done>
</task>

<task type="auto">
  <name>Task 6: Update sole walker caller in concept-feed.service.ts to pass dismissedIds</name>
  <files>app/src/services/concept-feed.service.ts</files>
  <read_first>
    - app/src/services/concept-feed.service.ts (lines 1185-1215 — the refill-walk-step block; the walker call at line 1209)
    - app/src/services/engagement.service.ts (after Task 2 — for the getDismissedAnchorIds() signature)
    - .planning/phases/39-engagement-service-walker-extension/39-CONTEXT.md (D-07 — sole caller updates in same commit as walker signature change; passes dismissedIds populated from engagementService.getDismissedAnchorIds())
  </read_first>
  <action>
    Make TWO edits to `app/src/services/concept-feed.service.ts`:

    **Edit 6a — Add the import** (alongside the existing service imports near line 12):
    ```typescript
    import { engagementService } from './engagement.service.ts';
    ```
    Place it directly after the `import { dailyReadService } from './daily-read.service';` line (line 12) for grouping with other leaf-service imports. Use the explicit `.ts` extension to match the post-Phase-37 leaf-import convention enforced for downstream code (per Plan 37-02 close decision).

    **Edit 6b — Update the walker call** at line 1209.

    Current:
    ```typescript
        const conceptIds = postQueueService.walkDerivedList(16, exploredIds);
    ```

    Replace with:
    ```typescript
        const dismissedIds = new Set(engagementService.getDismissedAnchorIds());
        const conceptIds = postQueueService.walkDerivedList(16, exploredIds, dismissedIds);
    ```

    Update the existing comment block above the call (lines 1196-1208) to add a one-line note that dismissedIds participates in the same lazy-skip semantics as exploredIds. Suggested addition (insert after the existing line 1204 comment about lazy splice corruption):

    ```typescript
        // Phase 39 D-07: dismissedIds (from engagementService) is the second lazy-skip
        // gate. Same semantics as exploredIds — never splice the derived list.
    ```

    Do NOT touch any other walker-adjacent code. Do NOT change `MAX_QUEUE_SIZE` or `REFILL_THRESHOLD`. Do NOT alter the `appendToDerivedList(dueConceptIds)` call.
  </action>
  <verify>
    <automated>cd app && node --test tests/services/derived-list.test.mjs && tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "import { engagementService } from './engagement.service.ts'" app/src/services/concept-feed.service.ts` returns 1
    - `grep -c "engagementService.getDismissedAnchorIds()" app/src/services/concept-feed.service.ts` returns 1
    - `grep -E "walkDerivedList\(\s*16\s*,\s*exploredIds\s*,\s*dismissedIds\s*\)" app/src/services/concept-feed.service.ts` returns 1
    - `grep -c "const dismissedIds = new Set" app/src/services/concept-feed.service.ts` returns 1
    - `grep -c "Phase 39 D-07" app/src/services/concept-feed.service.ts` returns ≥1
    - `cd app && tsc -b --noEmit` exits 0
    - `cd app && node --test tests/services/derived-list.test.mjs` exits 0 (paired walker-test sanity)
  </acceptance_criteria>
  <done>Sole walker caller passes the dismissed set; project type-checks clean; downstream walker tests still green.</done>
</task>

<task type="auto">
  <name>Task 7: Pin saved/liked posts against post-history retention purge (D-04)</name>
  <files>app/src/services/post-history.service.ts</files>
  <read_first>
    - app/src/services/post-history.service.ts (full file — purgeExpired at lines 59-66 is the extension site)
    - app/src/services/engagement.service.ts (after Task 2 — for getPinnedIds() signature returning Set<string>)
    - .planning/phases/39-engagement-service-walker-extension/39-CONTEXT.md (D-04 — pin saved/liked so retention purge skips them; single-line semantic change at the filter predicate)
    - .planning/phases/39-engagement-service-walker-extension/39-CONTEXT.md "Integration Points" subsection (notes the import direction is post-history → engagement, NOT cyclical, because engagement only imports postHistoryService at getSavedPosts/getLikedPosts call time, which is fine for ESM)
  </read_first>
  <action>
    Two edits in `app/src/services/post-history.service.ts`:

    **Edit 7a — Add the import** at the top of the file alongside `settingsService`:
    ```typescript
    import { engagementService } from './engagement.service.ts';
    ```
    Place it directly after `import { settingsService } from './settings.service.ts';` (line 5).

    **Edit 7b — Extend the purgeExpired filter predicate** at lines 64-65.

    Current:
    ```typescript
        const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
        const posts = loadPosts().filter(p => p.generatedAt > cutoff);
    ```

    Replace with:
    ```typescript
        const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
        // Phase 39 D-04: pin saved/liked posts against retention purge so a post
        // saved >retentionDays ago is not silently dropped from the snapshot store.
        // engagementService.getPinnedIds() returns saved ∪ liked (NOT dismissed).
        const pinned = engagementService.getPinnedIds();
        const posts = loadPosts().filter(p => pinned.has(p.id) || p.generatedAt > cutoff);
    ```

    Do NOT touch addPost, getPosts, getPostsByDay, or clear methods. Do NOT change the early-return guard (`if (retentionDays == null || retentionDays <= 0) return;`).

    **Cycle check:** engagement.service.ts imports postHistoryService (Task 2) AND post-history.service.ts now imports engagementService — this is acceptable because:
    - engagementService only USES postHistoryService at `getSavedPosts()`/`getLikedPosts()` call time, NOT at module-init time.
    - postHistoryService only USES engagementService at `purgeExpired()` call time, NOT at module-init time.
    - ESM tolerates value-level cycles when neither side touches the other at top-level/initialization. Both top-levels only declare functions; both deferred reads happen at call time.
    - If `tsc -b --noEmit` flags a circular type import (it shouldn't, since both imports are value imports), the pragmatic fix is to make engagement.service.ts use a lazy import (`async`/`await import` inside `getSavedPosts`) — but this is unlikely to be needed.
  </action>
  <verify>
    <automated>cd app && tsc -b --noEmit && node --test tests/services/engagement.service.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "import { engagementService } from './engagement.service.ts'" app/src/services/post-history.service.ts` returns 1
    - `grep -E "engagementService\.getPinnedIds\(\)\.has\(p\.id\)\s*\|\|\s*p\.generatedAt\s*>\s*cutoff" app/src/services/post-history.service.ts` returns ≥1 line (the filter predicate)
    - `grep -c "Phase 39 D-04" app/src/services/post-history.service.ts` returns ≥1
    - `grep -c "pinned.has\|pinned = engagementService.getPinnedIds" app/src/services/post-history.service.ts` returns ≥2
    - `cd app && tsc -b --noEmit` exits 0
    - `cd app && node --test tests/services/engagement.service.test.mjs` exits 0 (engagement tests still pass with the back-edge import)
  </acceptance_criteria>
  <done>purgeExpired now skips posts whose IDs appear in saved ∪ liked; cross-module wire is one-line semantic change; ESM cycle is value-level only and resolves.</done>
</task>

<task type="auto">
  <name>Task 8: Full-suite green check + close-out test baselines</name>
  <files>(no edits — verification-only task; no file produced, but a SUMMARY.md will be written by the close-out step downstream)</files>
  <read_first>
    - .planning/STATE.md (test baselines from Plan 38-02 close: test:main 566/564/2; test:actions 16/16/0; tsc exits 0)
    - app/package.json (test scripts available — `test:main`, `test:actions`)
  </read_first>
  <action>
    Run the full project test suite + tsc to confirm Phase 39 introduces zero regressions.

    Steps:
    1. `cd app && tsc -b --noEmit` → must exit 0.
    2. `cd app && npm run test:main` → capture pass/fail counts. Acceptable: equal-or-better than the post-Plan-38-02 baseline of `566/564/2`. New tests added in Tasks 3, 4, 5 should ADD to the pass count (engagement.service.test.mjs ~13 cases + engagement-anti-wire.test.mjs ~2 cases + derived-list.test.mjs +3-4 new cases).
    3. `cd app && npm run test:actions` → must remain at `16/16/0` (Phase 39 doesn't touch actions).
    4. Spot-check the two pre-existing `test:main` failures from Plan 38-02 close (concept-feed.test.mjs ERR_MODULE_NOT_FOUND on extensionless youtube.service import + tests/services/trellis-layout.test.mjs:64 getVineColor date-dependent assertion) — confirm both are STILL the only failures (no new failure introduced).
    5. If a new failure appears in either tracked baseline, STOP and fix the root cause before proceeding to commit. Do NOT skip or `.skip` a real failure.

    Record actual numbers in the SUMMARY.md drafted at plan close (not in this PLAN file).
  </action>
  <verify>
    <automated>cd app && tsc -b --noEmit && npm run test:main && npm run test:actions</automated>
  </verify>
  <acceptance_criteria>
    - `cd app && tsc -b --noEmit` exits 0
    - `cd app && npm run test:main` pass count is ≥ post-Plan-38-02 baseline of 564 passing cases (additions from Tasks 3/4/5 should push pass count higher; expected lower bound after Phase 39: 564 + 13 + 2 + 3 = 582 passing minimum)
    - `cd app && npm run test:main` fail count is ≤ 2 (matches the two pre-existing pre-Phase-39 failures; no new failures)
    - `cd app && npm run test:actions` exits 0 with 16/16/0
    - The two pre-existing failure messages (concept-feed ERR_MODULE_NOT_FOUND + trellis-layout getVineColor date assertion) are the only failures — verifiable by `npm run test:main 2>&1 | grep -E "fail|FAIL" | head -10`
  </acceptance_criteria>
  <done>Full suite green minus the two pre-existing carry-over failures; Phase 39 introduces zero regressions; ready for close-out.</done>
</task>

</tasks>

<verification>
Run from `app/` directory:

1. `tsc -b --noEmit` — exits 0
2. `node --test tests/services/engagement.service.test.mjs` — all 13+ cases pass
3. `node --test tests/services/engagement-anti-wire.test.mjs` — both cases pass (counterweight + co-emit scan)
4. `node --test tests/services/derived-list.test.mjs` — all existing cases plus 3+ new dismissed-skip cases pass
5. `npm run test:main` — pass count ≥ 582 (Phase 38 baseline 564 + Phase 39 additions); fail count ≤ 2 (pre-existing only)
6. `npm run test:actions` — 16/16/0 (unchanged)

Manual greps that lock the contract surface:

7. `grep -c "STORAGE_KEY = 'trellis_engagement_v1'" app/src/services/engagement.service.ts` returns 1
8. `grep -c "type: 'ANCHOR_DISMISSED'" app/src/types/index.ts` returns 1
9. `grep -c "type: 'ENGAGEMENT_CHANGED'" app/src/types/index.ts` returns 1
10. `grep -E "walkDerivedList\(\s*count:\s*number\s*,\s*exploredIds:\s*Set<string>\s*,\s*dismissedIds:\s*Set<string>\s*\)" app/src/services/post-queue.service.ts` returns 1
11. `grep -c "Math.max(count \* 2, len)" app/src/services/post-queue.service.ts` returns 1 (Phase 36 GAP-B preserved)
12. `grep -E "walkDerivedList\(\s*16\s*,\s*exploredIds\s*,\s*dismissedIds\s*\)" app/src/services/concept-feed.service.ts` returns 1
13. `grep -c "engagementService.getPinnedIds()" app/src/services/post-history.service.ts` returns ≥1
</verification>

<success_criteria>
Phase 39 is complete when ALL of the following are true:

1. **Round-trip persistence (success criterion #1+2 + #5):**
   - engagementService.savePost / getSavedPosts / removeSavedPost round-trip through key `trellis_engagement_v1` and survive same-day reload (Task 3 case 1, 11)
   - engagementService.likePost / unlikePost / isLiked round-trip through the same key (Task 3 case 5, 11)
   - Saved/liked persist across day boundaries (no date-based reset code path exists in engagement.service.ts — proven by absence of `today()`/`date` field in the file)
   - Dismissed anchors only reset via explicit `undismissAnchor` or `reset()` (Task 3 case 12)

2. **Walker dismissed-skip (success criterion #3):**
   - dismissAnchor(anchorId) adds to dismissed set; getDismissedAnchorIds() returns it (Task 3 case 6)
   - walkDerivedList(count, exploredIds, dismissedIds) skips matching entries lazily at walk time (Task 5 cases a, b)
   - Phase 36 GAP-B `Math.max(count * 2, len)` math preserved verbatim (verification grep 11)
   - cyclePosition NOT corrupted (Task 5 case a asserts position advances by 4 not 3 when one entry skipped — proves lazy semantics, no splice)

3. **Anti-wire invariant (success criterion #4):**
   - ANCHOR_DISMISSED added to AppEvent union (verification grep 8)
   - engagementService.dismissAnchor emits exactly one ANCHOR_DISMISSED + zero ENGAGEMENT_CHANGED + zero CONCEPT_EXPLORED (Task 3 case 6 — behavioral half of D-06)
   - No source file under app/src/ contains both ANCHOR_DISMISSED and CONCEPT_EXPLORED emit sites within an 800-char window (Task 4 — static half of D-06)

4. **Cross-module pin (D-04):**
   - postHistoryService.purgeExpired() skips posts whose IDs are in engagementService.getPinnedIds() (Task 7 + verification grep 13)

5. **Reset semantics (D-08):**
   - engagementService.reset() exists; wipes saved + liked + dismissed; emits NOTHING (Task 3 case 12 — locks both behaviors)

6. **Test baselines preserved:**
   - tsc exits 0
   - test:main pass ≥ 582; fail ≤ 2 (pre-existing carry-overs only)
   - test:actions 16/16/0
</success_criteria>

<output>
After Plan 39-01 execution completes, create `.planning/phases/39-engagement-service-walker-extension/39-01-SUMMARY.md` per the standard SUMMARY template. The summary MUST include:

- Atomic-per-file commit log (8 expected commits — one per task, with hashes)
- Pre/post test baselines (test:main pass/fail/skipped + test:actions pass/fail/skipped + tsc exit)
- Confirmation of all 5 ROADMAP success criteria (mirror this plan's `must_haves.truths`)
- Deviations or decisions captured during execution (e.g., if cycle import required lazy import, if anti-wire window needed adjustment)
- Forward-pointers: Phase 43 owns the SettingsDataScreen Force-New-Day reset() call site + UI subscriber wiring + long-press menus + Saved view; Phase 41 will exercise dismissed-skip via integration test of the full refillQueue cycle.

Mark requirements ENGAGE-01, ENGAGE-02, ENGAGE-03 as complete in `.planning/REQUIREMENTS.md`.
</output>

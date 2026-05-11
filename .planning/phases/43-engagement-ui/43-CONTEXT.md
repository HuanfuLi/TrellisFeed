---
phase: 43-engagement-ui
status: ready-for-planning
gathered: 2026-05-11
requirements: [ENGAGE-01, ENGAGE-02, ENGAGE-03]
descoped: [ENGAGE-04]
---

# Phase 43: Engagement UI — Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the **Phase 39** engagement service into the **Phase 42** masonry feed and `PostDetailScreen`. Five user-visible surfaces ship in this phase:

1. **Long-press contextual menu** on every feed tile (Like / Save / Not interested) — bottom-sheet surface backed by `engagementService.savePost/likePost/dismissAnchor`.
2. **`/saved` view** — header-icon entry from `/home`, single-column list with **Saved | Liked tabs** inside the screen.
3. **"Deep dive" button** on `PostDetailScreen` — full-width subtle CTA below essay above takeaway; tap streams the `depth: 'deep'` (350-600w) variant in-place; cached `bodyMarkdownDeep` exposes a Standard/Deep segmented control on subsequent visits.
4. **`HomeScreen` `ANCHOR_DISMISSED` re-sync** — `[location.pathname]` effect filters dismissed-anchor tiles from `dailyPosts` (Phase 36-14 in-place pattern).
5. **`handleForceNewDay` reset extension** — adds `engagementService.reset()` alongside existing post-queue + cache + dailyRead resets.

**Folded scope addition (operator request 2026-05-11):**

6. **Tile simplification** — trim the presentation-style tag (image / text-art / video / news label) from every tile type across the feed. Single targeted cut; planner does NOT go hunting for additional redundancies.

**Out of Phase 43 scope (descoped this phase):**

- **ENGAGE-04** ("N connections in your graph" micro-label) — operator descoped 2026-05-11 with rationale "the post tile is already too rich; we should try to simplify instead." Drops Phase 43 SC-4 from ROADMAP entry; moves ENGAGE-04 from REQUIREMENTS.md active list to Out of Scope. Mechanical edits land inside a Phase 43 plan.

**Out of Phase 43 scope (deferred to future phases):**

- Broader tile-metadata audit beyond the single presentation-style-tag cut (e.g. news source attribution, video channel byline, news date stamp).
- Like-based feed re-ranking / quality feedback loop.
- Dismiss cooldown (re-evaluate dismissed concepts after N days).
- Cross-device engagement sync (requires client/server split).

</domain>

<decisions>
## Implementation Decisions

### Long-press contextual menu (LP-*)

- **LP-01:** **Bottom sheet anchored to viewport.** Slides up from bottom edge via framer-motion translateY, ~120-180px tall, backdrop dismiss + drag-down dismiss. NOT inline popover (anchor math breaks in MasonryFeed half-width tiles) and NOT centered modal (too heavy for one-tap actions). **Why:** mobile-native pattern matching iOS share sheet / Android bottom sheet; survives any tile scroll position; reusable infrastructure for future contextual menus.
- **LP-02:** **3 stacked rows with leading icon + i18n label.** Each row is a full-width tap target (≥44px minHeight per existing CLAUDE.md ChatInput-flex-shrink convention). Order: Like → Save → Not interested. Icons: `Heart`, `Bookmark`, `EyeOff` (lucide-react). NOT 3 horizontal icons (cramps Spanish/Japanese labels at narrow widths) and NOT 2×2 grid (backdrop tap already dismisses, explicit Cancel cell is redundant on mobile).
- **LP-03:** **Toast + persistent corner icon overlay on tile.** Confirmation feedback is two-layered: (a) brief `toast(t('engagement.toast.saved'), 'success')` / `liked` for immediate acknowledgement, (b) a small filled-heart / filled-bookmark corner icon on the tile that persists across re-renders to signal active state. Saved/liked state is visually distinguishable at a glance in the feed, not just in `/saved`.
- **LP-04:** **Dynamic menu labels for active state.** Menu reads current state via `engagementService.isSaved(postId)` + `engagementService.isLiked(postId)` when opened. If already saved → row label flips to `t('engagement.menu.unsave')` (i18n key) + filled icon; tap emits `ENGAGEMENT_CHANGED { kind: 'unsave', id }`. Single mental model: long-press is always how you change state. NOT hide-active-rows (discoverability problem — user can't see how to undo).
- **LP-05:** **Dismiss UX — fade out ALL same-anchor tiles in the current queue.** When `dismissAnchor` fires, `HomeScreen`'s `ANCHOR_DISMISSED` handler iterates `dailyPosts`, identifies every tile whose `sourceQuestionIds[0]` resolves to the dismissed anchor (or whose post's resolved-anchor matches), plays a 200ms framer-motion AnimatePresence fade-out, then removes them from state. Walker third-arg ensures future refills also skip. **Why:** consistent semantic — "I don't want to see this concept" is honored in one frame, not partially-now-fully-on-next-refill. Inline Undo toast for dismiss is **deferred to a future phase**.

### Saved-posts view (SV-*)

- **SV-01:** **Route: `/saved`.** Sub-screen rendered via `<Outlet>` overlay (zIndex 50), same pattern as `PostHistoryScreen` and `PodcastScreen`. Add to `app/src/App.tsx:294` router children list. Verb-aligned with the menu action ("Save" → `/saved`). NOT `/library` or `/bookmarks`.
- **SV-02:** **Entry point: header icon on `/home`.** Add a `Bookmark` lucide-react icon button to `HomeScreen`'s `Header` (parallel to existing podcast/history affordances). Tap → `navigate('/saved')`. One-tap from the main surface, visible at all times. NOT settings-menu link (less discoverable) and NOT BottomNav addition (would require a 6th tab, breaks the 5-slot SwipeTabContainer invariant).
- **SV-03:** **List layout: single-column archive style.** Mirror `PostHistoryScreen.tsx`'s compact card pattern — image thumbnail + title + concept tag + date saved. Tap a row → `navigate('/posts/:id')`. NOT MasonryFeed reuse (archive UX is "scan and pick", not "mosaic browsing"; tile re-render reruns lazy-image lifecycle; MasonryFeed assumes mixed `InfoFlowItem` types, saved-view is pure concept). NOT snippet-preview list (heavier per-row, fewer items above the fold; defer if needed).
- **SV-04:** **Tabs inside `/saved`: Saved | Liked.** Top-of-screen tab switcher renders Saved or Liked list based on active tab. Tab state owned by the screen (`useState<'saved' | 'liked'>('saved')`). New i18n keys: `saved.tabs.saved`, `saved.tabs.liked`, `saved.empty.savedTitle`, `saved.empty.likedTitle`, etc. **Operator chose tabs over the recommended private-only Like model** — the Like signal gets its own browsable surface, not just a per-tile heart icon. Tab interaction (swipe vs tap-only), sort order, and empty-state copy are Claude's discretion at planning time.

### Deep-dive UX (DD-*)

- **DD-01:** **Button placement: below essay body, above takeaway.** Render between `PostDetailScreen.tsx:837` (closing essay `</div>`) and `:840` (`{post.sourceType !== 'video' && (post.takeaway ...)`). Natural reading endpoint. NOT after takeaway (further-down placement lowers discoverability), NOT sticky CTA (layout complexity + potential conflict with the Phase 32.1 Header portal pattern).
- **DD-02:** **Visual: full-width subtle button with leading icon.** Centered, ~85% container width, padded 14-16px, `var(--surface-variant)` background, `var(--primary-40)` text + a small lucide-react icon (`Sparkles` or `ArrowDownToLine`). Label via `t('posts.detail.deepDive.cta')` — operator-pickable copy at planning time; suggested `"Deep dive into this concept"`. NOT compact pill (less discoverable) and NOT inline text link (lowest discoverability).
- **DD-03:** **Streaming UX: replace standard body in-place; show "Restore standard" affordance during stream.** On tap, the essay body `<div>` content (currently `<Markdown>{post.bodyMarkdown}</Markdown>`) is swapped to the streaming deep target. Above-body slot renders a small "Restore standard" button while `isStreamingDeep` is true. Tapping "Restore standard" aborts the deep `AbortController` AND restores the standard rendering (bodyMarkdown stays unchanged in state). **Operator chose replace-in-place over the recommended append-both** — interactive toggle UX preferred over scroll-to-find. NOT bottom-sheet modal (loses connection to surrounding context).
- **DD-04:** **Post-cache visual: Standard | Deep segmented control replaces the button.** Once `bodyMarkdownDeep` is non-empty (either freshly streamed and cached via `patchPostEssayInCache` OR cached from a prior session), the deep-dive button slot is replaced by a segmented control with two segments: Standard / Deep. Active segment renders the matching `bodyMarkdown` / `bodyMarkdownDeep` variant in the body slot. Toggle is purely client-side state, no re-stream. **Operator chose segmented toggle over append-both.** NOT destructive-replace (loses the standard variant for the user). Segmented-control implementation (custom inline-styled component vs lucide-react primitive vs a lightweight library) is Claude's discretion.
- **DD-05:** **AbortController contract preserved per Phase 41-02 D-08 audit.** Deep-stream re-render reuses the same pre-call guard + signal-arg pattern at `PostDetailScreen.tsx:314-350`:
  - Three `if (abortController.signal.aborted) return` pre-call guards immediately preceding each for-await opener.
  - Four signal-arg passes (`{ signal: abortController.signal }` on `generateConnectionPost`, `generateDiscoverPost`, `generatePostEssay`, `generateEssayMeta`).
  - Cancel-on-back via the existing cleanup effect; tapping "Restore standard" aborts the controller; navigating away aborts the controller.
  - `patchPostEssayInCache` only fires when `!abortController.signal.aborted` — guarantees `bodyMarkdownDeep` cache is never written from a partial stream.

### Tile simplification (TS-*)

- **TS-01:** **Trim ONLY the presentation-style tag across all tile types.** Remove the small chip / inline label that currently identifies post style (image / text-art / video / news) on `MemoizedConceptCard`, `ConnectionCard`, `MilestoneCard` if present. The visual content of each tile already disambiguates style (a video has a thumbnail with bars-crop, text-art has a stylized notebook background, news has a Georgia-serif headline, image has a square image). The explicit tag is redundant. **Why:** operator described tiles as "already too rich"; tag cut is the bounded simplification they greenlit. **Bounded scope** — planner does NOT propose additional metadata cuts. Other dense elements (news source attribution, news date, video channel byline) remain as-is this phase; future polish phase may revisit.

### Descopes (DS-*)

- **DS-01:** **ENGAGE-04 → Out of Scope.** Operator descoped 2026-05-11 — "tiles already too rich; should simplify instead." Phase 43 SC-4 ("Each tile shows a 'N connections in your graph' micro-label...") is dropped from the ROADMAP Phase 43 entry. **Mechanical edits required in Phase 43 implementation plans:**
  - `.planning/ROADMAP.md` — strike SC-4 from Phase 43 Success Criteria list; renumber SC-5/6 if planner prefers (or leave as 1/2/3/5/6 with a note).
  - `.planning/REQUIREMENTS.md` — change ENGAGE-04 checkbox status; move row from "Engagement signals" active list to a new / existing "Out of Scope" section with descoping rationale + date; update traceability matrix row (ENGAGE-04 | Phase 43 | Wave 3 | Pending → Out of Scope).
  - No code changes for the descope itself — `candidatePack`-based connection counting is never wired, no `connectionCount` field added to `DailyPost`, no tile placement code shipped.
- **DS-02:** **DD-01 placement decision UPDATED 2026-05-11 (UAT Test 7).** Original Phase 43-05 CONTEXT specified Deep Dive button + Standard|Deep segmented toggle placement as "below essay body, above takeaway" (between the scroll-70% sentinel and the takeaway block). Operator UAT feedback: "the toggle appeared below essay instead of above essay. You are right to design it above essay, I guess the prior decision was confusing." Updated placement: **deep-dive controls render above essay body** (ABOVE the essay-body container) so users see the depth-control affordance BEFORE reading. The scroll-70% sentinel (Detector A — CONCEPT_EXPLORED emit) stays in place; only the `renderDeepDiveControls()` invocation moves. **No changes to handleStartDeepDive / handleRestoreStandard internals (DD-03 streaming) or to the segmented toggle handler (DD-04) or to the AbortController contract (DD-05).** Closed by gap-closure plan 43-12. See `.planning/debug/deep-dive-toggle-below-essay-body.md` for full diagnosis.

### Carried-Forward Decisions (Locked by Prior Phases / ROADMAP / REQUIREMENTS — NOT Re-Discussed)

- **Service API + events are locked by Phase 39 D-01..D-08:** `savePost / removeSavedPost / likePost / unlikePost / dismissAnchor / undismissAnchor / isSaved / isLiked / isDismissed / getSavedPosts / getSavedPostIds / getLikedPosts / getLikedPostIds / getDismissedAnchorIds / getPinnedIds / reset` — full surface already shipped at `app/src/services/engagement.service.ts`. Phase 43 wires the UI; does NOT touch the service contract.
- **Two events:** `ANCHOR_DISMISSED { payload: { anchorId } }` (walker consumer; HomeScreen consumer for re-sync) + `ENGAGEMENT_CHANGED { payload: { kind, id } }` (UI re-render consumer for save/unsave/like/unlike/undismiss). **NO new event types** in Phase 43. Walker only subscribes to `ANCHOR_DISMISSED`; UI components subscribing to both events as needed.
- **Deep-dive engine is fully shipped (Phase 41-02):** `EssayOptions.depth?: 'standard' | 'deep'`, `bodyMarkdownDeep?: string` on `EssayContent` AND `PostSnapshot` (schema additivity preserved across cache boundary), depth-aware `patchPostEssayInCache`. Phase 43 only wires UI controls; does NOT touch `post-essay.service.ts`.
- **MasonryFeed leaf-tile contract** (Phase 42 D-01..D-11): `MemoizedConceptCard` / `ConnectionCard` / `MilestoneCard` are consumed verbatim. New long-press behavior is layered ONTO existing card render via a wrapping interaction-handler component or by injecting pointer handlers into `MasonryFeed`'s `renderTile` — exact mechanic is Claude's discretion. **Card components MUST NOT regress** the existing onClick / onActivate / data-feed-id / data-concept-id attributes. Specifically: the Phase 42 UAT-7+8 navigation-only video-tile contract MUST NOT be regressed — Detector D in PostDetailScreen remains the sole feed-level video signal.
- **Header portal positioning** (Phase 32.1 / CLAUDE.md): adding the Bookmark header icon must NOT introduce `transform` / `will-change` / `filter` / `contain` / `perspective` on any Header ancestor. Use the existing Header right-slot pattern.
- **Always-mounted screen re-sync principle** (Phase 36-14 / CLAUDE.md): HomeScreen's new `ANCHOR_DISMISSED` re-sync MUST live in a `[location.pathname]` effect, matching the canonical pattern at `HomeScreen.tsx`'s existing `exploredAnchors` + warm-start re-fallback effects.
- **AbortController re-use for deep stream** (Phase 41-02 D-08): pre-call guards + signal-arg passes pattern preserved (DD-05).
- **Atomic per-file commits + paired source+test commits** (Phase 37 D-03 / Phase 39/40/41/42 cadence): expect 8-12 atomic commits across 4-6 plans.
- **Source-reading invariant test pattern** (Phase 27/35/37/39/40/41/42): Phase 43 adds source-reading assertions for: (a) `engagementService.reset()` call lives inside `handleForceNewDay` in `SettingsDataScreen.tsx`, (b) long-press menu component never emits `CONCEPT_EXPLORED` (anti-wire — only `ANCHOR_DISMISSED` from the dismiss row + `ENGAGEMENT_CHANGED` from save/like rows), (c) Deep-dive button renders within the AbortController pattern, (d) tile presentation-style-tag rendering is gone (negative grep on the tag element key in InfoFlow.tsx).
- **i18n parity gate** (CLAUDE.md i18n Workflow): all new strings (long-press menu labels, toast confirmations, /saved screen copy, deep-dive button + segmented control labels, restore-standard label) land in all 4 locale bundles (`en/zh/es/ja`) in the SAME PR. Sonnet subagent at `app/scripts/translate-locales.md` for non-EN translations. `bundle-parity.test.mjs` is the standing gate.
- **Long-press timer = 480ms** — convention from `ChatMessage.tsx:122-128`. Reuse the timer + `didLongPress` ref pattern verbatim, OR factor a shared `useLongPress(ms, callback)` hook (Claude's discretion at planning time).
- **`engagementService.reset()` clears all three collections** (Phase 39 D-08). Force-New-Day wipes saves + likes + dismisses in one call. **Granularity stays as-spec'd** — no `resetDismissedOnly()` method added in Phase 43. Force-New-Day is a dev affordance for testing cold-start UX; wiping saves/likes alongside dismisses is acceptable. If a future product surface needs partial reset, extend the API then.

### Claude's Discretion

- **Bottom-sheet implementation:** custom inline-styled component (matches the project's no-Tailwind convention) vs. minimal hand-rolled overlay + framer-motion. Recommend custom inline styled; no new dependency.
- **Long-press hook factoring:** copy the `ChatMessage.tsx` timer pattern inline vs. extract `useLongPress(ms, callback)` into `app/src/hooks/`. Recommend extract — three consumers (`ChatMessage`, `MasonryFeed` tile wrapper, and future surfaces) justify the hook.
- **Long-press menu animation:** 200-250ms slide-up, ease-out cubic-bezier; framer-motion `<MotionConfig reducedMotion="user">` per Phase 42 D-03 precedent.
- **Saved/Liked tab interaction:** swipe-between-tabs vs tap-only. Recommend tap-only for v1 (simpler; swipe adds gesture state machine that could conflict with SwipeTabContainer at the parent level — `/saved` is a sub-screen so the parent strip isn't active, but matching the project's general approach keeps it predictable).
- **Sort order in Saved + Liked tabs:** most-recent-saved-first by default (insertion order of `engagementService.getSavedPostIds()` already provides this — `push` on save). No user-facing sort/filter controls in v1.
- **Empty state copy** for Saved + Liked tabs — hand-authored EN + Sonnet-translated zh/es/ja.
- **Segmented-control implementation** for DD-04: custom inline-styled component vs. a lightweight library. Recommend custom; project convention.
- **"Restore standard" copy** during deep-dive streaming — Claude's discretion (suggested `t('posts.detail.deepDive.restoreStandard')` or `t('posts.detail.deepDive.cancel')`).
- **HomeScreen `ANCHOR_DISMISSED` re-sync mechanic** — in-place client filter (Phase 36-14 pattern) recommended over refetch.
- **Tile corner-icon overlay placement** for save/like state (LP-03) — top-right vs top-left vs bottom-right. Coordinate with existing tile chrome; top-right preferred (away from concept tag at bottom-left). Two-icon stacking when both saved AND liked: Claude's call (vertical stack vs side-by-side; vertical stack preferred to keep edge-clear).
- **Test file naming** — `tests/components/LongPressMenu.behavior.test.mjs`, `tests/screens/SavedScreen.tabs.test.mjs`, `tests/screens/PostDetailScreen.deep-dive.test.mjs`, `tests/screens/HomeScreen.anchor-dismissed-resync.test.mjs`, `tests/components/InfoFlow.no-style-tag.test.mjs`, `tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs`. Planner can collapse / rename as preferred.

### Folded Todos

(None — `gsd-tools todo match-phase 43` returned zero matches.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 43 specs

- `.planning/ROADMAP.md` §"Phase 43: Engagement UI" lines 1161-1173 — success criteria (after SC-4 is struck per DS-01).
- `.planning/REQUIREMENTS.md` lines 16-19 (ENGAGE-01/02/03/04 acceptance) + line 72-75 (traceability matrix). ENGAGE-04 row mutates this phase (DS-01).

### Locked by prior phases (load-bearing)

- `.planning/phases/39-engagement-service-walker-extension/39-CONTEXT.md` D-01..D-08 — service API + events (`ANCHOR_DISMISSED`, `ENGAGEMENT_CHANGED { kind, id }`) + storage shape (ID-only arrays) + cross-day persistence + reset semantics. Phase 43 wires UI on top of this contract verbatim.
- `.planning/phases/40-source-diversity-leaf-module/40-CONTEXT.md` — source-reading-invariant test discipline (anti-async / no-fetch / no-chat-stream patterns); Phase 43 inherits the same testing rigor for long-press menu emissions.
- `.planning/phases/41-pipeline-wiring-essay-depth/` — `EssayOptions.depth: 'deep'` + `bodyMarkdownDeep?` schema-additive field on `EssayContent` AND `PostSnapshot` + depth-aware `patchPostEssayInCache` + AbortController pre-call-guards-and-signal-args contract at `PostDetailScreen.tsx:314-350`.
- `.planning/phases/42-masonry-feed-layout/42-CONTEXT.md` D-01..D-11 — MasonryFeed leaf-tile contract (height-accumulating split, framer-motion entrance on leaf tiles only, navigation-only video tiles, no transform/will-change on Header ancestors).

### CLAUDE.md load-bearing sections

- `CLAUDE.md` §"Header positioning (Phase 32.1 — load-bearing)" — adding the Bookmark header icon must NOT introduce transform/will-change/filter/contain/perspective on Header ancestors. Use the existing Header right-slot pattern; portal-vs-in-tree split is unchanged.
- `CLAUDE.md` §"Concept Feed Generation Pipeline (load-bearing)" — Phase 43 does NOT touch the pipeline. Derived list, walker, queue invariants stay locked. The walker third-arg (`dismissedIds`) wire from Phase 39 is preserved.
- `CLAUDE.md` §"Always-mounted screens must explicitly re-read service state on navigation" — HomeScreen's new ANCHOR_DISMISSED handler MUST sit in a `[location.pathname]` effect, matching `HomeScreen.tsx`'s existing `exploredAnchors` resync (Phase 36-14).
- `CLAUDE.md` §"Video post completion signals (Phase 36 GAP-C → Phase 42 UAT-7+8 — load-bearing)" — feed video tiles remain navigation-only. Long-press on a video tile opens the menu; tap navigates to PostDetailScreen; Detector D remains the sole video engagement signal. Do NOT re-introduce inline play in feed cards.
- `CLAUDE.md` §"Best practices learned in Phase 32.1" rules 2 + 6 — tests must guard the LIVE code path; one signal per semantic event.
- `CLAUDE.md` §"i18n Workflow (Phase 27+)" — all 4 locale bundles update together; `bundle-parity.test.mjs` enforces; runtime LLM translation prohibited; Sonnet subagent template at `app/scripts/translate-locales.md`.

### Source-of-truth files for code change

- `app/src/services/engagement.service.ts` — already shipped (Phase 39); consumer surface for all UI wiring.
- `app/src/components/MasonryFeed.tsx` — leaf-tile container; long-press handlers wrap renderTile output.
- `app/src/components/InfoFlow.tsx` — `MemoizedConceptCard`, `ConnectionCard`, `MilestoneCard`, `SuggestionCard` leaf components; presentation-style-tag removal site (TS-01).
- `app/src/screens/PostDetailScreen.tsx:801-839` — essay body div + sentinel + takeaway; deep-dive button + segmented control insertion site (DD-01..DD-05).
- `app/src/screens/PostDetailScreen.tsx:314-350` — AbortController contract; DD-05 pattern reuse.
- `app/src/services/post-essay.service.ts:14, 99, 135, 175, 217` — `EssayOptions.depth` knob already wired (Phase 41-02); consumed by deep-stream call.
- `app/src/screens/settings/SettingsDataScreen.tsx:77-140` — `handleForceNewDay`; `engagementService.reset()` call insertion site (SC-6).
- `app/src/screens/HomeScreen.tsx` — `dailyPosts` state + warm-start fallback + existing `[location.pathname]` effects (Phase 36-14); new ANCHOR_DISMISSED re-sync effect insertion site (SC-5).
- `app/src/screens/HomeScreen.tsx` Header slot — Bookmark icon → `/saved` navigation (SV-02).
- `app/src/App.tsx:294-321` — router; add `{ path: 'saved', element: <PageTransition><SavedScreen /></PageTransition> }`.
- `app/src/screens/SavedScreen.tsx` — **NEW** component (SV-01/02/03/04).
- `app/src/components/LongPressMenu.tsx` — **NEW** component (LP-01..LP-05); bottom-sheet shell consumed by MasonryFeed tile wrapper.
- `app/src/hooks/useLongPress.ts` — **NEW** (optional) shared hook factoring `ChatMessage.tsx` pattern; consumed by MasonryFeed + (eventual) ChatMessage migration.
- `app/src/locales/{en,zh,es,ja}.json` — new namespaces: `engagement.menu.*`, `engagement.toast.*`, `saved.tabs.*`, `saved.empty.*`, `posts.detail.deepDive.*`. Sonnet subagent translates non-EN.

### Pattern precedents

- `app/src/components/ChatMessage.tsx:119-140` — 480ms long-press timer + `didLongPress` ref pattern.
- `app/src/screens/PostHistoryScreen.tsx` — single-column archive list (image thumbnail + title + tag + date row); SavedScreen mirrors.
- `app/src/components/MasonryFeed.tsx:101-124` — inline SVG + framer-motion path-draw pattern (VineBloomCard); reference for any future deep-dive button micro-animation.
- `app/src/services/daily-read.service.ts:35-50` — `reset()` precedent; `engagementService.reset()` follows the same shape.
- `app/src/screens/HomeScreen.tsx` existing `[location.pathname]` effects — exploredAnchors resync + warm-start re-fallback (Phase 36-14); ANCHOR_DISMISSED handler joins this neighborhood.
- Phase 39/40/41/42 anti-wire test pattern (`engagement-anti-wire.test.mjs`, `source-diversity-anti-wire.test.mjs`, `useQuestions-system-prompt-stability.test.mjs`, MasonryFeed structural tests) — Phase 43 source-reading invariants follow.

### External resources

- framer-motion `<MotionConfig reducedMotion="user">` + AnimatePresence docs (`https://motion.dev/docs/react-quick-start`) — bottom-sheet slide-up + dismiss-tile fade-out idioms.
- lucide-react icons: `Heart`, `Bookmark`, `EyeOff`, `Sparkles`, `ArrowDownToLine`, `BookmarkPlus` — Phase 43 icon vocabulary.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`engagementService` (Phase 39)** — full API shipped; Phase 43 is pure UI wiring. No service changes.
- **`ChatMessage.tsx:119-140` long-press pattern** — 480ms timer + didLongPress ref + pointer event handlers (down/up/leave/move). Either copy verbatim into MasonryFeed tile wrapper or extract to `useLongPress(ms, callback)` hook (Claude's discretion).
- **`PostHistoryScreen.tsx`** — single-column archive list pattern (compact card with thumbnail + title + concept tag + date row). SavedScreen mirrors this shape with Saved | Liked tabs added.
- **`postHistoryService.getPosts()`** — used by `engagementService.getSavedPosts()` / `getLikedPosts()` for ID resolution (Phase 39 D-03).
- **framer-motion** v12.38.0 already installed (Phase 42) — `<MotionConfig reducedMotion="user">`, `<motion.div>`, `AnimatePresence` available for bottom-sheet slide-up + dismiss-tile fade-out.
- **`Header.tsx` portal pattern** (Phase 32.1) — adding a Bookmark icon to HomeScreen's header uses the existing right-slot pattern; no portal-vs-in-tree changes.
- **`PageTransition` + `<Outlet>` overlay** at zIndex 50 (Phase 22) — SavedScreen renders as a sub-screen above the always-mounted swipe strip; same routing pattern as `/history`, `/podcast`, `/review`.
- **`Header backTo="/home"` prop** — SavedScreen reuses this for the back affordance, no new infrastructure.
- **`toast()` helper** (`app/src/lib/toast.ts`) — `toast(t('engagement.toast.saved'), 'success')` for LP-03 confirmation feedback.
- **`patchPostEssayInCache` + AbortController** (Phase 41-02) — Deep-dive re-render reuses the existing essay streaming infrastructure end-to-end.

### Established Patterns

- **Inline styles with CSS variables** (NOT Tailwind) — all new components follow `--primary-40`, `--surface`, `--surface-variant`, `--muted-foreground`, `--radius-xl`, `--shadow-2` etc.
- **`ServiceResult<T>` pattern** — not applicable to engagement service (Phase 39 uses void / direct return); UI wiring stays consistent.
- **Atomic per-file commits + paired source+test** (Phase 37 D-03; reinforced in 39/40/41/42). Phase 43 expects ~8-12 atomic commits across ~4-6 plans.
- **Source-reading invariant tests** (Phase 27/35/37/39/40/41/42) — Phase 43 adds: anti-wire on long-press menu emissions, deep-dive AbortController shape, presentation-style-tag negative-grep, `engagementService.reset()` call site presence in handleForceNewDay.
- **Singleton service consumption pattern** — engagement.service.ts is the singleton; consumed at component render or event handler time via `engagementService.savePost(postId)` etc.
- **`[location.pathname]` effect re-sync** (Phase 36-14 / CLAUDE.md) — HomeScreen ANCHOR_DISMISSED handler joins existing effect neighborhood.
- **`<MotionConfig reducedMotion="user">` wrapping any framer-motion children** (Phase 42 D-03 / Pitfall 1) — long-press menu + dismiss fade-out wrap inside.
- **i18n parity** — all 4 bundles update together; `bundle-parity.test.mjs` is the gate.

### Integration Points

- **`HomeScreen.tsx` Header right-slot** — Bookmark icon button → `navigate('/saved')`. Add alongside existing podcast/history affordances if present; otherwise as the primary right-slot.
- **`MasonryFeed.tsx` `renderTile`** — wrap each tile body with long-press pointer handlers. Either via a new wrapper component (`<TileLongPressShell>`) or via the existing `<motion.div>` / `<div>` already at `renderTile`'s root. Coordinate with the existing onClick (handleActivate) so a quick tap still navigates and a held press opens the menu.
- **`PostDetailScreen.tsx:837` (between essay body close and takeaway open)** — DD-01 button insertion site.
- **`PostDetailScreen.tsx:80-90` state region** — add `streamingDeep`, `isStreamingDeep`, `deepError`, `activeVariant: 'standard' | 'deep'` state; consumed by DD-03/DD-04 render logic.
- **`SettingsDataScreen.tsx:77-140` handleForceNewDay** — add `engagementService.reset()` line alongside `dailyReadService.reset()` at `:133`. Source-reading test asserts the call site.
- **`App.tsx:294` router children** — insert `{ path: 'saved', element: <PageTransition><SavedScreen /></PageTransition> }` between `/review` and `/podcast` or alphabetically — Claude's call.
- **`InfoFlow.tsx` presentation-style-tag site** — locate the chip / inline label that renders post style identifier (likely a `<span>` with conditional rendering on `presentationStyle` or `sourceType`); delete the element AND any associated i18n keys / CSS. Negative-grep source-reading test enforces absence.

</code_context>

<specifics>
## Specific Ideas

- **Operator descoped ENGAGE-04 with strong tile-density rationale.** "The post tile is already too rich. We should try to simplify instead." This is a load-bearing UX signal that should weight future feed-tile decisions: prefer fewer signals + clearer hierarchy over adding metadata chips. The Phase 43 tile-simplification fold (TS-01) is the first concrete instance of acting on this preference.
- **Operator diverged from Recommended on 3 decisions** — every divergence makes the UX more interactive / browsable / state-rich:
  - SV-04: Saved | Liked tabs (operator) over private-only Like (recommended).
  - DD-03: Replace-in-place during deep stream (operator) over append-both (recommended).
  - DD-04: Standard | Deep segmented toggle (operator) over append-both (recommended).
  - These suggest the operator wants the engagement layer to feel **interactive and exploratory**, not passive. Planner should favor interactive controls + toggleable views where there's a genuine choice point.
- **The bounded tile-simplification fold (TS-01)** is the only post-MVP audit the operator approved. Resist the urge to expand. Future polish phase can re-open the question after operator sees v1 land.
- **Deep-dive AbortController contract MUST be preserved.** Phase 41-02 D-08 landed three pre-call guards + four signal-arg passes; Phase 43's deep-stream call adds a 5th signal-arg pass (`generatePostEssay({ depth: 'deep', signal })`) but otherwise reuses the same shape. "Restore standard" mid-stream = `abortController.abort()`; never sets `bodyMarkdownDeep` from partial stream.
- **Long-press timer is settled at 480ms across the codebase** — don't introduce a per-component variant. If 480ms feels wrong during UAT, change it everywhere in a single follow-up.
- **`engagementService.reset()` wipes saves+likes+dismisses** (Phase 39 D-08). Force-New-Day handler accepts this — operator confirmed via discretion-delegated path. If a future product surface (not a dev affordance) needs partial reset, extend the API in that phase; do NOT add `resetDismissedOnly()` opportunistically here.
- **HomeScreen ANCHOR_DISMISSED re-sync is in-place client filter** (Claude's discretion preferred per Phase 36-14 pattern). Do NOT call `conceptFeedService.getDailyPosts(questions)` on dismiss — that re-runs the LLM-touching cache hydrate path and is wasted work when we can client-filter the existing `dailyPosts` array.

</specifics>

<deferred>
## Deferred Ideas

### Out of Phase 43 scope (deferred to future phases)

- **Broader tile-metadata audit** beyond the single presentation-style-tag cut. News source attribution, news date stamp, video channel byline, video duration label — all stay as-is this phase. Operator description "too rich" applies broadly; a future polish phase can scope a proper tile audit after Phase 43's UI lands and operator has lived with it for a week.
- **Like-based feed re-ranking** — the Like signal is captured (Phase 39) and now browsable (Phase 43 SV-04), but does not yet influence the curiosity-feed mixer or walker. Future phase (likely v1.6 engagement-quality loop) can pull liked-anchor weight into the concept-feed pipeline.
- **Dismiss cooldown** — "re-evaluate dismissed concepts after 30 days" or similar windowing. Current model: dismiss persists until explicit undismiss or Force-New-Day or Clear-All-Data. Requires schema extension (timestamps in engagement state) — deferred until UX signal.
- **Cross-device engagement sync** — local-first scope; requires client/server split.
- **Undo toast for dismiss** (inline 5-second "Undo" affordance after a tile dismiss). Worth adding only if UAT shows operator regretting dismisses. Not in v1.
- **Bulk operations on Saved / Liked** — "unsave all from this week" / "clear all likes". Speculative; no current need.
- **Search / filter inside Saved + Liked tabs** — list will likely be short for early users; add only if list lengths grow large enough to justify.
- **`/liked` as a separate route** — if Saved + Liked tabs feel cramped or if Liked grows into its own surface need.
- **Tile-metadata simplification follow-up phase** — after Phase 43 ships and operator lives with TS-01 for a usage cycle, a v1.5.x or v1.6 polish phase can scope news source attribution / video channel byline / news date trims if still desired.
- **`resetDismissedOnly()` API method on engagementService** — if a future product surface (not a dev affordance) needs partial reset granularity, extend the API then. Don't anticipate.
- **N connections / familiarity micro-label revisit** — explicitly Out of Scope this phase (DS-01). If operator changes their mind in a future cycle, the `buildCandidateContextPack` helper at `canonical-knowledge.service.ts:222` is unchanged and ready to consume. Reopen by adding a new `connectionCount?: number` field on `DailyPost` + a populate site in `refillQueue`.

### Reviewed Todos (not folded)

- `.planning/todos/pending/2026-05-07-fix-cosine-similarity-threshold-cache-miss.md` — unrelated subsystem (`canonical-knowledge.service.ts` embedding pre-check); separate v1.5.x or future phase.
- `.planning/todos/pending/2026-05-09-inspect-auto-gen-podcast-working-or-not-and-debug.md` — already addressed via `~/.claude/projects/-Users-Code-EchoLearn/memory/project_serverless_no_background_tasks.md` (architectural limitation, not a bug); not Phase 43 scope.

</deferred>

---

*Phase: 43-engagement-ui*
*Context gathered: 2026-05-11*

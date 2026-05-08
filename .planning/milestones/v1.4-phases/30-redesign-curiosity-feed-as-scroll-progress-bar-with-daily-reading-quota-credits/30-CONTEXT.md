# Phase 30: Redesign curiosity feed as scroll progress bar with daily reading quota credits - Context

**Gathered:** 2026-04-17 (v2 — full re-scope after v1 UAT failure)
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform the static "CURIOSITY FEED" island card on HomeScreen into a scroll-aware progress tracker that monitors active concept exploration. The card lives inline in the feed, showing progress like "2 of 5 concepts explored". When the user scrolls it to the top, it pushes the "Good Morning" greeting off-screen and sticks as a compact progress bar header. Reading is tracked by active engagement (opening a post and scrolling 70%, spending 30s, or asking a follow-up) — not passive scrolling past feed items. Completing all concepts awards +1 trellis credit with celebration animation.

**Key difference from v1:** The previous implementation tracked "posts scrolled past" with a fixed sticky header replacing the greeting. v2 tracks "concepts actively explored" with a transforming inline card that collapses on scroll. This is a fundamentally different interaction model.

</domain>

<decisions>
## Implementation Decisions

### Progress Tracking
- **D-01:** Progress tracks **unique concepts explored**, not posts viewed or scrolled past. Concepts are identified by `anchorId` on posts. Two posts with the same anchorId = one concept.
- **D-02:** Quota target = **number of unique concept anchors** in today's feed. If 4 posts cover 3 distinct concepts, quota is 3.
- **D-03:** Reading one post per concept is enough — user does NOT need to read every post for the same concept.

### Reading Detection (active engagement)
- **D-04:** A concept is marked "explored" when user opens a post for that concept in PostDetailScreen AND meets ANY of three triggers:
  1. **Scroll 70%** of the post essay content (IntersectionObserver on a sentinel at 70% depth)
  2. **Spend 30 seconds** on the post (timer starts on PostDetailScreen mount for that post)
  3. **Ask a follow-up question** in the post thread
- **D-05:** PostDetailScreen communicates exploration via **event bus** — emits `CONCEPT_EXPLORED` with `anchorId`. HomeScreen subscribes and updates progress. Same pattern as `REVIEW_COMPLETED`.
- **D-06:** Each trigger fires once per concept per day (idempotent via `dailyReadService`). Re-opening an already-explored concept does not re-trigger.

### Card-to-Bar Transformation
- **D-07:** The CURIOSITY FEED card is **replaced in-place** with a progress card that lives inline in its current position (between bento grid and feed posts).
- **D-08:** Progress card uses `position: sticky; top: 0`. As user scrolls, the card sticks at the top, pushing the "Good Morning" greeting naturally off-screen above it.
- **D-09:** When stuck, an IntersectionObserver triggers a CSS class that **animates the card from full-size to compact bar** — shrinks height, padding, font-size over ~200ms ease transition.
- **D-10:** Full card state shows: icon, "Today's Concepts" title, "N of M explored" label, progress bar. Compact bar state shows: icon, "N/M", progress bar — one thin row.
- **D-11:** The "Good Morning" greeting **stays as-is** — it scrolls away naturally as the user scrolls down. No code change to the greeting itself.

### Non-Concept Feed Items
- **D-12:** Connection cards, news posts, video posts, and other non-anchored items are **excluded from the quota**. They appear in the feed as bonus content but don't affect the progress bar.
- **D-13:** No visual "bonus" badge on non-concept items — they just exist in the feed without any quota indicator.

### Reward & Celebration
- **D-14:** Completing all concepts awards **+1 trellis credit** via `trellisCreditsService.add(1)`. Credits awarded once per day (idempotent).
- **D-15:** Celebration: progress bar **turns gold** (`#E8A838`), **confetti burst** (reuse harvest pattern), label changes to "All caught up!". Same as v1 celebration design.
- **D-16:** After completion, feed **stays fully browsable**. Progress bar stays gold at 100%. No gate or collapse.

### Edge States
- **D-17:** When no concept posts exist today, the progress card is **hidden** (not rendered). Feed area shows an encouraging empty state.
- **D-18:** 0/0 progress is **never shown**. Card only renders when at least 1 concept post exists.

### Persistence
- **D-19:** Explored concept IDs and quota state persisted in **localStorage with daily reset**. Progress survives app restart within the same day.

### Bento Card
- **D-20:** Bento card showing concept topic names is **deferred to UI-SPEC design review**. The layout from v1 caused empty space issues. Will decide during `/gsd:ui-phase` based on visual design.

### i18n
- **D-21:** All new strings go through **full i18n** — en/zh/es/ja bundles in same PR.
- **D-22:** New i18n keys under `home.feed.*` namespace for progress labels, completion text, empty state. Exact key list determined during planning.

### Claude's Discretion
- Exact CSS transition properties for card-to-bar shrink animation
- IntersectionObserver threshold values and sentinel element placement
- Timer implementation for 30s dwell detection
- Whether to debounce concept exploration events
- Empty state icon and illustration choice
- Progress card border-radius, shadow, and background color in both states

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### HomeScreen & Feed
- `app/src/screens/HomeScreen.tsx` — Current HomeScreen with greeting, bento grid, and InfoFlow integration
- `app/src/components/InfoFlow.tsx` — Feed card rendering with CURIOSITY FEED island (to be transformed)
- `app/src/services/concept-feed.service.ts` — Daily post generation, caching, post-to-anchor mapping

### Post Detail & Reading
- `app/src/screens/PostDetailScreen.tsx` — Post detail view where reading triggers fire
- `app/src/services/post-essay.service.ts` — Essay content generation (scroll depth target)

### Credits & Celebration Patterns
- `app/src/services/trellis-credits.service.ts` — Existing credits service (pattern for dailyReadService)
- `app/src/screens/PlannerScreen.tsx` — TrellisStatusPanel harvest confetti pattern

### Event Bus & Types
- `app/src/lib/event-bus.ts` — Event bus for CONCEPT_EXPLORED signal
- `app/src/types/index.ts` — AppEvent union type (add CONCEPT_EXPLORED)

### i18n
- `app/src/locales/en.json` — Canonical locale bundle
- `app/scripts/translate-locales.md` — Sonnet subagent translation prompt

### Existing Components
- `app/src/components/ui/ProgressBar.tsx` — Reusable progress bar component

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ProgressBar` component: accepts `value` (0-100), `color`, `height`, `label` with smooth transition
- `trellisCreditsService`: localStorage counter pattern — reuse for dailyReadService
- Harvest confetti in TrellisStatusPanel: reuse for quota completion celebration
- `eventBus`: existing REVIEW_COMPLETED, HARVEST_COMPLETED patterns — add CONCEPT_EXPLORED

### Established Patterns
- Services return `ServiceResult<T>` (except simple localStorage wrappers like trellis-credits)
- Inline styles with CSS variables (`--primary-40`, `--surface`, `--shadow-1`)
- Event bus for cross-screen communication
- i18n via `useTranslation()` hook + `t('namespace.key')` pattern

### Integration Points
- HomeScreen: transform CURIOSITY FEED island region into progress card
- PostDetailScreen: add scroll/timer/follow-up detection, emit CONCEPT_EXPLORED
- InfoFlow: the card markup currently lives here, may need to move to HomeScreen
- concept-feed.service: extract unique anchorIds for quota calculation

</code_context>

<specifics>
## Specific Ideas

- Card-to-bar transition: full card → thin bar via CSS sticky + IntersectionObserver class toggle
- Three exploration paths: scroll 70%, dwell 30s, ask follow-up — any one marks the concept
- Greeting is not removed — it scrolls naturally away as the progress card pushes it out
- Confetti + gold bar + "+1 earned!" toast mirrors the harvest celebration
- Posts from same concept anchor share exploration state — reading one is enough

</specifics>

<deferred>
## Deferred Ideas

- **Bento card with concept topics** — Layout from v1 caused empty space. Defer to UI-SPEC design review during `/gsd:ui-phase`. May add as a sub-task if the design works, or drop entirely.

</deferred>

---

*Phase: 30-redesign-curiosity-feed-as-scroll-progress-bar-with-daily-reading-quota-credits*
*Context gathered: 2026-04-17 (v2 re-scope)*

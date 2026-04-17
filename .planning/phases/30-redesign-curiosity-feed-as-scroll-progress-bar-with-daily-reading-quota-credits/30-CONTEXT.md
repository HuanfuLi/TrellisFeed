# Phase 30: Redesign curiosity feed as scroll progress bar with daily reading quota credits - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the static "Curiosity Feed" island and vague "Good Evening" greeting banner on HomeScreen with two new surfaces:

1. A **sticky progress bar header** at the top of HomeScreen that tracks daily post reading progress, awards trellis credits on completion, and plays a celebration animation.
2. A **bento card** in the existing bento grid that shows the concept topics covered in today's feed.

The old greeting banner and CURIOSITY FEED static island are removed entirely.

</domain>

<decisions>
## Implementation Decisions

### Progress Bar Behavior
- **D-01:** Progress bar tracks **posts viewed** (discrete count, e.g. "2 of 4 today"). Not scroll position, not concepts, not time.
- **D-02:** Progress bar is a **sticky header** fixed at the top of HomeScreen. Replaces the "Good Evening" greeting banner entirely. All HomeScreen content (bento grid, posts) scrolls underneath it.
- **D-03:** Bar is **always visible** from the moment posts exist — no fade-in-on-scroll behavior.

### Daily Quota & Credits
- **D-04:** Daily quota target = **number of posts the feed generated today** (currently max 4 via `MAX_POSTS`). If feed has 3 posts, quota is 3/3. Always achievable.
- **D-05:** Completing the daily quota awards **+1 trellis credit** via the existing `trellisCreditsService`. Credits awarded once per day; re-reading doesn't re-award.
- **D-06:** After quota completion, feed **stays fully browsable**. Progress bar stays at 100% with "All caught up!" label. No gate, no collapse.

### Reading Detection
- **D-07:** A post counts as **read when user scrolls past its bottom edge** (bottom edge exits top of viewport). Simplest approach — no dwell timer, no tap required.
- **D-08:** Read post IDs persisted in **localStorage with daily reset**. Key pattern: `echolearn_daily_read_posts` with `{ date, readIds[], quotaCompleted }`. Progress survives app restart within the same day.

### Visual Design
- **D-09:** Progress bar is a **continuous smooth bar** (not segmented, not dots). Reuses the existing `ProgressBar` component pattern from `src/components/ui/ProgressBar.tsx`.
- **D-10:** Completion celebration: **bar color shifts from primary to gold/green**, brief **confetti burst** (reuse harvest confetti pattern from TrellisStatusPanel), **"+1 🍒" flies to trellis counter**. Label changes to "All caught up!".

### Curiosity Feed Island Fate
- **D-11:** The current static CURIOSITY FEED island card is **removed entirely**. Its function is split between the progress bar (numeric progress) and the new bento card (topic info).
- **D-12:** A new **bento card** in the HomeScreen bento grid shows **concept topics covered** in today's feed (e.g. "Quantum Computing, Neural Networks, +2 more"). Tapping could scroll to the feed section.

### Zero-Post & Edge States
- **D-13:** When no posts exist today, the progress bar header is **hidden** (not rendered). Feed area shows an encouraging empty state ("Your feed is brewing — ask a question to get started").
- **D-14:** 0/0 bar is **never shown**. Progress bar only renders when `dailyPosts.length > 0`.

### i18n
- **D-15:** All new user-facing strings go through **full i18n** — added to `en.json` and translated to zh/es/ja via the Phase 27 Sonnet subagent workflow. All 4 locale bundles ship in the same PR.
- **D-16:** New i18n keys under `home.feed.*` namespace: `progress` ("{{read}} of {{total}} today"), `complete` ("All caught up!"), `empty` (empty state message), `bentoTitle` ("Today's Feed"), `bentoMore` ("+{{count}} more"), `credits` ("+{{count}} earned!").

### Claude's Discretion
- Exact confetti particle count, animation duration, and easing curves
- Progress bar height, padding, and exact sticky positioning
- Bento card layout, icon choice, and truncation behavior for topic names
- IntersectionObserver vs manual scroll listener for read detection
- Whether the empty state message includes an icon/illustration

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### HomeScreen & Feed
- `app/src/screens/HomeScreen.tsx` — Current HomeScreen with greeting, bento grid, and InfoFlow integration
- `app/src/components/InfoFlow.tsx` — Feed card rendering (concept, connection, milestone types)
- `app/src/services/concept-feed.service.ts` — Daily post generation, caching, `MAX_POSTS`, `getCachedDailyPosts()`

### Credits & Celebration Patterns
- `app/src/services/trellis-credits.service.ts` — Existing credits service (`add()`, `getTotal()`, localStorage pattern)
- `app/src/screens/PlannerScreen.tsx` — TrellisStatusPanel harvest confetti + fly-to-counter animation pattern

### Reusable Components
- `app/src/components/ui/ProgressBar.tsx` — Existing progress bar component (value 0-100, color, height, label, transition animation)

### i18n
- `app/src/locales/en.json` — Canonical locale bundle (add `home.feed.*` keys here)
- `app/src/locales/index.ts` — i18next init, `SUPPORTED_LOCALES`
- `app/scripts/translate-locales.md` — Sonnet subagent translation prompt template
- `.planning/phases/27-add-i18n-l10n-support/27-CONTEXT.md` — i18n decisions and workflow

### Existing Patterns
- `app/src/lib/date.ts` — `getGreeting()` function (being replaced)
- `app/src/lib/event-bus.ts` — Event bus for cross-screen notifications (may need new events)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ProgressBar` component: accepts `value` (0-100), `color`, `height`, `label` props with `transition: width 0.4s ease`
- `trellisCreditsService`: localStorage-backed counter with `add(count)` and `getTotal()` — direct reuse for reading credits
- Harvest confetti pattern in `TrellisStatusPanel`: cherry particles fly to counter + confetti burst — reuse for quota completion
- `conceptFeedService.getCachedDailyPosts()`: returns today's posts from cache — use `.length` for quota target

### Established Patterns
- All services return `ServiceResult<T> = { success, data?, error? }`
- Settings/state stored in localStorage with service abstractions
- Event bus (`EventBus`) for cross-screen notifications (REVIEW_COMPLETED, HARVEST_COMPLETED, etc.)
- Inline styles with CSS variables (`--primary-40`, `--surface`, `--shadow-1`)
- i18n: `useTranslation()` hook, `t('namespace.key', { interpolation })` pattern

### Integration Points
- HomeScreen: replace greeting banner region + remove CURIOSITY FEED island + add bento card
- InfoFlow or its scroll container: add scroll/intersection observer for read detection
- Event bus: may need DAILY_QUOTA_COMPLETED event for cross-screen awareness
- Trellis credits counter in PlannerScreen header: already displays credit total

</code_context>

<specifics>
## Specific Ideas

- Progress bar label format: "2 of 4 today" (in-progress), "All caught up!" (complete)
- Bento card shows concept topic names (not post titles), with "+N more" overflow
- Confetti + credit fly animation mirrors the existing trellis harvest celebration
- Empty state copy: "Your feed is brewing — ask a question to get started"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 30-redesign-curiosity-feed-as-scroll-progress-bar-with-daily-reading-quota-credits*
*Context gathered: 2026-04-16*

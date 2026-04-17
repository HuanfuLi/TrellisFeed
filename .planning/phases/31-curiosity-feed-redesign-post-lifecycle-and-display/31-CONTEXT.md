# Phase 31: Curiosity feed redesign — post lifecycle, softer progress UX, and display strategy - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Overhaul the curiosity feed holistically: replace the rigid progress bar with an organic vine/garden illustration, make the concept checklist transparent and discoverable, redesign the post queue as a concept-driven FIFO buffer with weighted style distribution, define post lifecycle for local-first storage, and add supporting features (suggestion posts, inline landscape video playback, scroll-to-top, post history, feedback via email, starter post redesign).

</domain>

<decisions>
## Implementation Decisions

### Progress Visualization (Vine)
- **D-01:** Replace `ConceptProgressCard` and `CompactProgressBar` with a **horizontal vine** growing left-to-right. A small **potted plant** is anchored on the left end. As concepts are explored, the vine extends and sprouts **leaves and flowers**.
- **D-02:** The **same vine element** is used for both the inline card position (between bento grid and feed) and the compact sticky header. The compact header is a substitute that appears when the inline card scrolls away.
- **D-03:** **Tap the vine to expand** a concept checklist showing uncovered concept names. A **small down arrow** icon indicates expandability. Tap again or tap outside to collapse.
- **D-04:** Concept names in the expanded checklist are **tappable** — tapping navigates the user to the first post for that concept in the feed.
- **D-05:** Vine **completion state**: when all concepts are explored, all flowers bloom and fruit appears. This is the vine's own celebration visual, distinct from the gold bar in phase 30.
- **D-06:** Vine growth **updates on next view** of the Home screen, not in real-time (user is on PostDetailScreen when exploration triggers and cannot see the vine anyway).
- **D-07:** When **no concepts are due** today, the vine is **hidden entirely** (not rendered). Same as phase 30 D-17/D-18.

### Concept Transparency
- **D-08:** **No changes to post cards** in the feed. No badges, no styling differences between concept posts and bonus content. Existing post card designs are preserved.
- **D-09:** The **compact header** is the single source of truth for concept progress. Expandable checklist shows uncovered concepts only.

### Post Queue System
- **D-10:** **8-post FIFO buffer** persisted in localStorage. Posts are popped from the front when served, new posts pushed to the back. Serve **4 posts at a time** on pull-up.
- **D-11:** Queue **auto-refills when length drops below 8**. Refill runs in background, not blocking the user.
- **D-12:** Queue is **driven by a derived concept list** — today's due concepts from SM-2 scheduling (same source as flashcards and podcasts). New questions asked during the day are **appended** to the central concept list and picked up on the next queue refill.
- **D-13:** **Explored concepts are removed** from the derived list so subsequent cycles don't generate duplicate concept posts.
- **D-14:** **Priority ordering** on the derived list: weak concepts first. A concept is "important" if it has **low SM-2 ease factor (< 1.5) OR dying/falling trellis leaf state**. Important concepts get **2 posts per cycle**, others get **1 post**.
- **D-15:** **Cycle number** is persisted daily to track generation progress. Resets each new day.
- **D-16:** **FIFO is strict** — once posts are in the queue, order is fixed. Priority is applied at generation time, not at display time.

### Post Type Mix & Style Assignment
- **D-17:** Post styles are assigned **randomly per post** within a batch, constrained to these **global ratios**:
  - 10% image posts (expensive — Nano Banana API)
  - 25% text-art posts (cheap LLM generation)
  - 5% suggestion posts ("You may also like:")
  - 20% news posts (Tavily API)
  - 15% YouTube landscape videos
  - 25% YouTube shorts (portrait)
- **D-18:** Style is decided **before generation**, not after. This is a fundamental change from the current `assignPresentationStyles` post-hoc approach.
- **D-19:** **Image-less** style is **no longer a planned style** — it exists only as a fallback when Nano Banana image generation is unavailable.
- **D-20:** When a content source fails (YouTube API or Tavily returns no results for a concept), **fall back to text-art**. Ensure fallback is not falsely triggered (pre-check API key fields are non-empty before attempting).

### Generation Pipeline
- **D-21:** Generation order: (1) pre-check API keys, (2) fetch YouTube/Tavily in parallel for concepts assigned those styles, (3) reassign failures to text-art, (4) one batch LLM call for all remaining posts (image + text-art + suggestion + fallbacks). This minimizes LLM calls and right-sizes the batch.
- **D-22:** **No immediate post generation** for mid-day questions. New questions are picked up on the next queue refill cycle naturally.

### Suggestion Posts (New Post Type)
- **D-23:** New post type: **"You may also like:"** card showing **3 tappable topic suggestions**. Roughly similar height to image posts.
- **D-24:** Topics are **fresh/unexplored topics related to existing mindmap nodes** — graph neighbors, cross-concept connections, deeper dives, applications, contrasts, prerequisites. Examples from "CNN" + "Transformer" → "What is ViT?", "Difference between Transformer and CNN in image detection", "How does self-attention work?"
- **D-25:** Tapping a topic **navigates to Ask screen** and sends the topic as a question. Goes through the full system (off-topic filter, mindmap storage, SM-2, review cycles) like a normal user-driven QA.
- **D-26:** **Only the topic buttons are interactive.** Tapping the card itself is a no-op — no detail page for suggestion posts.
- **D-27:** Suggestion posts appear at **low frequency (5%)** to stay non-intrusive.

### Inline Video Playback
- **D-28:** **Landscape videos are playable inline** in the feed, same as portrait shorts. Tapping play does NOT trigger essay/summary generation. User can briefly watch and leave.
- **D-29:** **Both landscape and portrait videos stop playback on swipe-away** (screen navigation). Must handle cleanup when the video's viewport position changes.

### Warm Start (New Day)
- **D-30:** On a new day, **show the 8 unviewed posts left in yesterday's queue** as the initial feed. In the background, start generating today's concept posts to fill a new queue.
- **D-31:** Pull-up-for-more **serves from today's fresh queue** once generated.
- **D-32:** Edge case: if yesterday's queue is empty (rare — auto-refill should prevent this), **show the last 4 posts from yesterday** as a recap while generating.

### Post Lifecycle & Storage
- **D-33:** **7-day rolling window** by default. Posts older than 7 days are purged. Configurable to **"keep all"** in Settings (posts are assets — user paid API cost to generate them).
- **D-34:** Post retention setting lives in **Settings > Data & Privacy > Developer** section (will move to backend eventually).
- **D-35:** **No visual difference** for essay-less stubs vs full posts. Essay generates on tap in PostDetailScreen as currently implemented.
- **D-36:** **No feed-level dismiss/hide.** Delete only from PostDetailScreen (existing functionality). No swipe-to-dismiss — conflicts with screen-switching gestures.

### Post History
- **D-37:** A **simple history screen** showing past posts grouped by day. Accessible from **two entry points**: (1) a small history icon near the vine card area, and (2) in Settings > Data.

### Generation Rate Limiting
- **D-38:** **Daily generation cap** = configurable multiplier × number of today's due concepts. Default multiplier is **5** (each concept gets at most 5 posts per day). Setting lives in **Settings > Data & Privacy > Developer**.
- **D-39:** **Bonus post cap after completion** — after all concepts are explored, pull-up-for-more still generates bonus content but with a hard cap of **8 bonus posts max**. Configurable in **Settings > Data & Privacy > Developer**.

### Scroll-to-Top
- **D-40:** **Floating button** at bottom-right corner of Home screen. Appears after scrolling past a **pixel distance threshold** (exact value at Claude's discretion). Taps smooth-scrolls to top.

### Feedback
- **D-41:** "Posts not interesting?" button appears in the **empty-queue state** (botanical loading + message). Tapping opens the **device email client** with a pre-filled "to" address and subject line. Zero in-app UI.
- **D-42:** Same feedback entry point also accessible from **Settings** (email compose).

### Starter Posts (First-Time Experience)
- **D-43:** **Replace all 3 existing starter posts** with app-tutorial posts that introduce how to use the app. Current learning-science content ("Why do you forget things that fast?" etc.) is removed entirely. New starters serve as part of app onboarding.

### Post Interleaving
- **D-44:** Replace current fixed-interval interleaving (`interleaveNewsPosts` every 3rd, `assignPresentationStyles` video interval) with **weighted round-robin**. Style variety is enforced at generation time via batch ratio constraints (D-17). No post-hoc interleaving pass.

### Existing Infrastructure Reuse
- **D-45:** Reuse existing `infiniteScrollService` queue mechanics and `PullUpHint` pull-to-load-more gesture. Adapt queue size from 6 to 8 and batch size from 6 to 4.
- **D-46:** Reuse existing `dailyReadService` for tracking explored concepts (phase 30 infrastructure).
- **D-47:** Reuse existing event bus `CONCEPT_EXPLORED` pattern from phase 30 for vine updates.

### Claude's Discretion
- Vine SVG/CSS illustration implementation details (growth stages, leaf/flower assets, animation style)
- Exact pixel threshold for scroll-to-top button appearance
- Exact SM-2 ease threshold for "important" concept classification (suggested < 1.5 but can adjust)
- Starter post content and tutorial messaging
- History screen layout and grouping UI
- Queue auto-refill debouncing to avoid rapid successive generation calls
- Botanical loading state illustration for empty-queue state

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 30 (Predecessor — Current Implementation)
- `.planning/phases/30-redesign-curiosity-feed-as-scroll-progress-bar-with-daily-reading-quota-credits/30-CONTEXT.md` — All phase 30 decisions (D-01..D-22) on progress tracking, reading detection, card-to-bar, celebration, persistence
- `app/src/components/ConceptProgressCard.tsx` — Current progress card + compact bar (to be replaced by vine)
- `app/src/services/daily-read.service.ts` — Daily exploration tracking, anchor ID derivation, concept quota (reuse)

### Feed & Post Generation
- `app/src/services/concept-feed.service.ts` — `getDailyPosts`, `generateMorePosts`, `assignPresentationStyles`, `interleaveNewsPosts`, `applyStrategyBias`, `STARTER_POSTS` (all significantly changed)
- `app/src/services/infiniteScroll.service.ts` — Queue mechanics, pending queue, background refill (adapt)
- `app/src/components/PullUpHint.tsx` — Pull-to-load-more gesture (reuse)
- `app/src/components/InfoFlow.tsx` — Feed card rendering, post type handling

### Post Detail & Video
- `app/src/screens/PostDetailScreen.tsx` — Essay generation on-enter, reading detection triggers
- `app/src/services/youtube.service.ts` — YouTube video/shorts fetching (concept-specific search needed)
- `app/src/services/news.service.ts` — Tavily news fetching (concept-specific search needed)

### HomeScreen & Navigation
- `app/src/screens/HomeScreen.tsx` — Feed wiring, bento grid, greeting, compact header, infoFlowItems memo
- `app/src/components/BottomNavigation.tsx` — Swipe navigation (video stop on swipe-away)
- `app/src/components/SwipeTabContainer.tsx` — Screen mounting, swipe gestures

### Trellis & SM-2
- `app/src/services/trellis-state.service.ts` — `computeLeafState` for dying/falling classification
- `app/src/services/trellis-credits.service.ts` — Credit awarding on completion
- `app/src/services/review.mock.ts` — SM-2 scheduling, ease factor data

### Knowledge Graph
- `app/src/services/graph.service.ts` — Semantic candidates, graph neighbors (for suggestion post topics)

### Settings
- `app/src/screens/settings/SettingsDataScreen.tsx` — Developer section (new settings home)
- `app/src/screens/settings/SettingsShared.tsx` — Shared setting components

### Event Bus & Types
- `app/src/lib/event-bus.ts` — CONCEPT_EXPLORED signal
- `app/src/types/index.ts` — DailyPost, PresentationStyle, AppEvent types (extend for suggestion post)

### i18n
- `app/src/locales/en.json` — Canonical locale bundle (new keys needed)
- `app/scripts/translate-locales.md` — Sonnet subagent translation prompt

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `infiniteScrollService`: Queue with FIFO drain, background pre-generation, dedup — adapt for 8-post buffer / 4-post batch
- `PullUpHint`: Pull-to-load-more with elastic rubber-band and threshold — reuse as-is
- `dailyReadService`: localStorage daily tracking with auto-reset — reuse for explored concept tracking
- `ProgressBar` component: Can be removed or replaced by vine
- `trellisCreditsService`: Credit awarding pattern — reuse for completion reward
- `eventBus` CONCEPT_EXPLORED: Cross-screen communication — reuse for vine updates
- `computeLeafState`: Trellis state classification — reuse for importance scoring
- `shuffleArray`: Fisher-Yates shuffle utility — reuse for random style assignment

### Established Patterns
- Services return `ServiceResult<T>` (except simple localStorage wrappers)
- Inline styles with CSS variables (`--primary-40`, `--surface`, `--shadow-1`)
- Event bus for cross-screen communication
- i18n via `useTranslation()` hook + `t('namespace.key')` pattern
- Background generation with `_videoBgRunning` / `_textArtBgRunning` guard flags

### Key Architectural Changes
- `assignPresentationStyles` (post-hoc style assignment) → replaced by pre-generation style decision from derived concept list
- `interleaveNewsPosts` (fixed-interval interleaving) → replaced by weighted round-robin at generation time
- `generateDailyPostsWithLLM` (one big batch) → replaced by concept-driven queue refill pipeline
- `STARTER_POSTS` (learning-science content) → replaced by app-tutorial onboarding posts
- Video/news as separate content sources → unified as presentation styles of due concepts

### Integration Points
- HomeScreen: replace ConceptProgressCard with vine component, wire history icon, add scroll-to-top button
- InfoFlow: handle suggestion post type, inline landscape video playback
- SwipeTabContainer/BottomNavigation: stop video playback on swipe-away
- SettingsDataScreen: add post retention, generation cap, bonus cap settings
- concept-feed.service: major refactor of generation pipeline
- infiniteScrollService: adapt queue size/batch, add localStorage persistence

</code_context>

<specifics>
## Specific Ideas

- Vine metaphor: potted plant on left, vine grows rightward with leaves/flowers blooming. Completion = all flowers bloom + fruit appears
- Suggestion post examples from "CNN" + "Transformer": "What is ViT?", "Difference between Transformer and CNN in image detection", "How does self-attention work?", "How is CNN used in medical imaging?", "RNN vs Transformer for sequence modeling", "What is backpropagation?"
- Generation pipeline: API key pre-check → YouTube/Tavily parallel fetch → reassign failures → one LLM batch for rest. Minimizes API calls and avoids wasted generation
- Settings in Developer section because these configs will move to backend later
- "Posts not interesting?" → just opens email client. Zero in-app form UI

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 31-curiosity-feed-redesign-post-lifecycle-and-display*
*Context gathered: 2026-04-17*

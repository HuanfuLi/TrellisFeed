# QuestionTrace Phase 0/1 Prune Report

## Summary

This pass pruned the Trellis prototype down to the QuestionTrace research shell. The app now keeps the feed, post detail with post-context Q&A, saved/history, onboarding, settings, and the surviving data services. Removed routes and feature surfaces are no longer registered, hydrated, or wired into settings.

Final gate results from `app/`:

- `npx tsc -b --noEmit`: pass
- `npm test`: pass
- `npm run lint`: pass with existing warnings only, 0 errors
- `npm run build`: pass with Vite chunk-size/dynamic-import warnings

## Routes Removed

Removed from router and tab containers:

- `/ask`
- `/ask/:id`
- `/anchor/:id`
- `/cluster/:id`
- `/collections/:id`
- `/graph`
- `/planner`
- `/review`
- `/podcast`

Routes kept:

- `/home`
- `/posts/:id`
- `/saved`
- `/settings`
- `/settings/ai`
- `/settings/content`
- `/settings/features`
- `/settings/data`
- `/onboarding`

`SwipeTabContainer` and `BottomNavigation` now expose two top-level slots: Home and Settings.

## Major Removals

### Podcast

Removed:

- `app/src/screens/PodcastScreen.tsx`
- `app/src/services/podcast.service.ts`
- `app/src/services/podcast-prompt.ts`
- `app/src/services/podcast-view-model.ts`
- `app/src/state/usePodcast.ts`
- podcast hydration and scheduler/native notification startup
- podcast settings UI and saved-podcast engagement APIs
- podcast and TTS/STT focused tests

### Flashcards / SRS Review

Removed:

- `app/src/screens/ReviewScreen.tsx`
- `app/src/components/Flashcard.tsx`
- `app/src/services/flashcard.service.ts`
- `app/src/services/review.service.ts`
- `app/src/state/useReview.ts`
- flashcard hydration and review reminders
- review/SRS tests

Feed simplification:

- `concept-feed.service` now treats all unexplored anchor nodes as eligible instead of consuming SM-2 due state.
- Stored `reviewSchedule` fields remain on `Question` for persistence compatibility.

### Graph / Mindmap UI

Removed:

- `app/src/screens/GraphScreen.tsx`
- `app/src/screens/AnchorDetailScreen.tsx`
- `app/src/screens/ClusterDetailScreen.tsx`
- `app/src/screens/QuestionDetailScreen.tsx`
- `app/src/components/graph/*`
- `app/src/services/graph.service.ts`
- `app/src/services/graph-command.service.ts`
- `app/src/services/graph-edit-journal.service.ts`
- `app/src/services/graph-edit-journal-phrasing.ts`
- `mind-elixir` dependency and Vite manual chunk
- graph UI and graph-command tests

Kept:

- underlying anchor/cluster fields in the `Question` model
- `GRAPH_UPDATED` event usage for question/canonical knowledge resync
- `canonical-knowledge.service`

### Planner / Trellis Gamification

Removed:

- `app/src/screens/PlannerScreen.tsx`
- `app/src/services/planner.service.ts`
- `app/src/services/plannerAutoGen.service.ts`
- `app/src/services/moveGenerator.service.ts`
- `app/src/services/trajectoryAnalyzer.service.ts`
- `app/src/services/suggestionScorer.service.ts`
- `app/src/services/trellis-*.ts`
- `app/src/components/trellis/*`
- `app/src/components/VineProgress.tsx`
- `app/src/components/Confetti.tsx`
- `app/src/assets/planner-trellis/*`
- planner/trellis tests and action test script

Kept:

- `daily-read.service` explored-anchor mechanics because the surviving feed uses the lazy-skip walker and post exploration signals.

### Global Free-form Chat

Removed:

- `app/src/screens/AskScreen.tsx`
- `app/src/screens/ask-persist-target.ts`
- global ask routes and nav tab
- voice recording, STT, and TTS providers
- `capacitor-voice-recorder` dependency
- AskScreen and `useQuestions` global-chat streaming tests

Kept:

- `ChatInput` for PostDetail post-context Q&A
- markdown rendering for Q&A responses
- `post-context-qa.service`
- `session.service` and its DB table, because PostDetail Q&A still persists post-specific sessions

### Live Web / News / YouTube

Removed:

- `app/src/services/web-search.service.ts`
- `app/src/services/youtube.service.ts`
- `app/src/services/youtube-locale-url.ts`
- `app/src/services/news-source-metadata.ts`
- `app/src/services/source-diversity.service.ts`
- `app/src/services/api-availability.ts`
- `app/src/services/concept-feed-dedup.ts`
- `app/src/components/YouTubeEmbed.tsx`
- video/news branches from `concept-feed.service`, `post-essay.service`, `PostDetailScreen`, `InfoFlow`, and `MasonryFeed`
- YouTube/Tavily settings UI and tests

Style assignment now uses only:

- `image`
- `text-art`
- `suggestion`

Weights were redistributed to `image: 0.15`, `text-art: 0.75`, `suggestion: 0.10`, keeping the stratified largest-remainder sampler.

### Collections

Removed:

- `app/src/screens/CollectionDrillInScreen.tsx`
- `app/src/components/CollectionPickerSheet.tsx`
- `app/src/services/collection.service.ts`
- collection DB table/hydration
- collection tabs/search/picker tests
- `fuse.js` dependency

Kept:

- plain save/like through `engagement.service`
- `SavedScreen`, simplified to Saved and History tabs

### Token Analytics

Removed:

- `app/src/services/token-usage.service.ts`
- token usage settings UI
- provider usage logging calls
- monthly ask limit setting
- token usage tests

### Scheduler

Removed:

- `app/src/services/scheduler.service.ts`
- `app/src/services/scheduler.native.ts`
- `@capacitor/local-notifications` dependency

No scheduler jobs remain.

## Data Layer Changes

Kept services:

- `db.service`
- `question.service`
- `canonical-knowledge.service`
- `question-filter.service`
- `filter-corpus.service`
- `post-history.service`
- `daily-read.service`
- `settings.service`
- event bus
- i18n bundles
- `engagement.service`
- `content-pool.repository` / `frozen-feed.service`
- `post-qa.service` for canonical post-context Q&A

Removed DB tables / legacy heavy-store paths:

- flashcards
- podcasts
- collections
- planner tables
- video cache
- news posts

The generated daily/derived/queue feed, generated presentation styles, on-open
essay/image generation, generated session context, and their tests were removed
atomically in Phase 2 after every caller moved to `frozen-feed.service`. The
legacy `sessions` table may remain as inert storage schema, but participant Q&A
uses canonical `UserQuestion`/`AIAnswer` rows. `reviewSchedule` fields stayed on
questions because they are persisted historical shape, but the feed does not
consume them.

## Settings / Onboarding / Locale Cleanup

Settings now keeps:

- LLM provider keys
- embedding provider keys/debug thresholds
- theme
- locale
- privacy/data management

Settings copy in `en`, `zh`, `es`, and `ja` was updated for active screens so it no longer advertises YouTube, web search, TTS, podcast, review, planner, or token analytics. Large unused namespaces were left in place when not on active UI paths to avoid churn and preserve bundle parity.

Onboarding keeps:

- welcome
- language selection
- consent
- LLM setup

Welcome and consent copy now describe post-context Q&A and local study signals rather than review/podcast/planner workflows.

## Test / Script Changes

`app/package.json`:

- `test` now runs only `npm run test:main`
- `test:main` runs all remaining `*.test.mjs`
- `test:actions` was removed

Deleted tests for removed features:

- podcast
- flashcards/review
- graph command/UI
- planner/trellis
- AskScreen/global chat streaming
- news/web search/YouTube
- collections
- token usage
- scheduler/native notification related paths

Updated surviving guard tests cover the deterministic packaged pool, immutable-ID
engagement/history, frozen feed/detail/suggestions, condition-neutral canonical
Ask, load-bearing navigation/layout, and absence of generator/pipeline/live-content
acquisition paths. Obsolete generator, queue, spread, image, essay, carousel, and
generated-session tests were deleted with their production owners.

## Judgment Calls

- Replaced `session.service` with canonical same-post `UserQuestion`/`AIAnswer` hydration; complete threads survive restart without generated post snapshots.
- Kept raw review schedule fields on `Question` to avoid persistence-shape breakage, but stopped using them for the feed.
- Kept `GRAPH_UPDATED` and anchor/cluster model fields because question classification and canonical anchoring still use them.
- Kept the small `daily-read.service` exploration tracker because PostDetail still emits the study's scroll/dwell/Q&A exploration signals; all generated-feed quota/walker helpers were removed.
- Kept unused locale namespaces rather than deleting large sections, because unused keys are harmless and parity risk was not worth the churn in this prune pass.
- Kept a minimal `/settings/features` route because the requested surviving route list includes it, but removed deleted feature controls from the screen.

## Leftover Dead Context

The live app has no imports/routes for deleted services. A few comments and unused test helper files still mention old feature names:

- test helper comments under `app/tests/services/_actions-*` and `_trellis-*`
- some legacy explanatory comments in source/tests referencing old AskScreen or graph history
- unused locale namespaces for deleted UI
- CSS variables for old news card styling

These were left because they are inert, not imported by live app code, and pruning them would add churn outside the Phase 0/1 behavior surface.

Root-level docs (`README.md`, `ROADMAP.md`, `CLAUDE.md`, `PROJECT_DESCRIPTION.md`, `Documents/`) were not edited by this pass.

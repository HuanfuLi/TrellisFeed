# Evaluation Report 3/27

## Scope

Reviewed the EchoLearn codebase with focus on:

- dead code and unintegrated modules
- logic/runtime defects
- tooling health
- technical debt
- code structure and maintainability risk

Validation run:

- `npm test`: passes
- `npm run build`: fails
- `npm run lint`: fails

## Executive Summary

The codebase is feature-rich and moving quickly, but it currently has clear signs of drift between implementation, typing, and architecture. The most important near-term issues are:

1. the repository does not build cleanly
2. web data-clearing behavior is partially broken
3. several modules are implemented but not wired into production routes or flows
4. state management is fragmented across screen-local hooks rather than a shared source of truth

Overall maintainability risk: **moderate to high**.

## Tooling Health

### Build is currently broken

`npm run build` fails for multiple reasons:

- [app/src/components/FeedPostImage.tsx](/Users/Code/EchoLearn/app/src/components/FeedPostImage.tsx#L44) defines `AspectBox` without a `className` prop, but [app/src/components/FeedPostImage.tsx](/Users/Code/EchoLearn/app/src/components/FeedPostImage.tsx#L225) passes `className` into it.
- [app/src/components/InfoFlow.tsx](/Users/Code/EchoLearn/app/src/components/InfoFlow.tsx#L41) has an unused `feedIndex` parameter.
- [app/src/types/index.ts](/Users/Code/EchoLearn/app/src/types/index.ts#L489) does not include several error codes that are returned by image providers, while [app/src/providers/gemini.provider.ts](/Users/Code/EchoLearn/app/src/providers/gemini.provider.ts#L47), [app/src/providers/gemini.provider.ts](/Users/Code/EchoLearn/app/src/providers/gemini.provider.ts#L90), [app/src/providers/gemini.provider.ts](/Users/Code/EchoLearn/app/src/providers/gemini.provider.ts#L147), [app/src/providers/nanoBanana.provider.ts](/Users/Code/EchoLearn/app/src/providers/nanoBanana.provider.ts#L43), and [app/src/providers/nanoBanana.provider.ts](/Users/Code/EchoLearn/app/src/providers/nanoBanana.provider.ts#L95) return `API_KEY_NOT_CONFIGURED`, `RETRIES_EXHAUSTED`, and `INVALID_REQUEST`.

Impact:

- the codebase is not in a releasable type-safe state
- test success is giving a false sense of health because the test suite does not cover these build failures

### Lint is currently failing

`npm run lint` reports real unused code issues:

- [app/src/components/InfoFlow.tsx](/Users/Code/EchoLearn/app/src/components/InfoFlow.tsx#L41)
- [app/src/services/trajectoryAnalyzer.service.ts](/Users/Code/EchoLearn/app/src/services/trajectoryAnalyzer.service.ts#L88)

It also reports stale suppression comments in [app/src/screens/HomeScreen.tsx](/Users/Code/EchoLearn/app/src/screens/HomeScreen.tsx#L87), which is a sign that cleanup is not keeping pace with implementation.

## Logic Errors

### Web clear-all-data path is incomplete

[app/src/services/db.service.ts](/Users/Code/EchoLearn/app/src/services/db.service.ts#L114) only supports `DELETE FROM <table> WHERE <col> = ?` in the localStorage backend, but [app/src/services/db.service.ts](/Users/Code/EchoLearn/app/src/services/db.service.ts#L199) calls `DELETE FROM questions`, `DELETE FROM edge_weights`, and similar table-wide deletes with no `WHERE`.

Impact:

- `clearAllTables()` is effectively a no-op on web for the localStorage-backed database tables
- “Clear All Data” can leave data behind even though the UI reports success

### Gemini text-model default is set to an image model

[app/src/screens/SettingsScreen.tsx](/Users/Code/EchoLearn/app/src/screens/SettingsScreen.tsx#L355) and [app/src/screens/SettingsScreen.tsx](/Users/Code/EchoLearn/app/src/screens/SettingsScreen.tsx#L406) default the **LLM** Gemini model to `gemini-3.1-flash-image-preview`.

Impact:

- text chat configuration can be initialized with a model intended for image generation
- this is likely to produce avoidable request failures or undefined behavior in text-only flows

### Home feed refresh helper has ineffective cancellation

[app/src/screens/HomeScreen.tsx](/Users/Code/EchoLearn/app/src/screens/HomeScreen.tsx#L58) creates a `refreshFeed()` helper that returns a cleanup callback, but callers do not use that return value.

Impact:

- cancellation logic is misleading
- the code suggests lifecycle safety that is not actually enforced

This is not the most severe bug in the repo, but it is a correctness smell in a screen already handling async feed regeneration and event-driven updates.

## Dead Code and Unintegrated Code

### Unrouted screen

[app/src/screens/ConnectionPostScreen.tsx](/Users/Code/EchoLearn/app/src/screens/ConnectionPostScreen.tsx#L26) is implemented, but [app/src/App.tsx](/Users/Code/EchoLearn/app/src/App.tsx#L161) does not register a route for it.

Impact:

- the file is effectively dead in production
- there are two competing implementations for connection-post behavior, because connection flows are now handled through [app/src/screens/PostDetailScreen.tsx](/Users/Code/EchoLearn/app/src/screens/PostDetailScreen.tsx)

### Unused hooks

These hooks appear to be unused by the app runtime:

- [app/src/hooks/useInfiniteScroll.ts](/Users/Code/EchoLearn/app/src/hooks/useInfiniteScroll.ts#L35)
- [app/src/hooks/usePostCarousel.ts](/Users/Code/EchoLearn/app/src/hooks/usePostCarousel.ts#L32)
- [app/src/state/useQuestions.ts](/Users/Code/EchoLearn/app/src/state/useQuestions.ts#L149) (`useTodayQuestions`)

Impact:

- maintenance surface is larger than the live feature surface
- future edits can accidentally update the dead abstraction instead of the active one

### Unused or partially abandoned feature modules

These modules are present but not wired into the live app flow:

- [app/src/services/plannerAutoGen.service.ts](/Users/Code/EchoLearn/app/src/services/plannerAutoGen.service.ts#L16) is stubbed and returns inert values
- [app/src/services/moveGenerator.service.ts](/Users/Code/EchoLearn/app/src/services/moveGenerator.service.ts) is not referenced by runtime code
- [app/src/services/trajectoryAnalyzer.service.ts](/Users/Code/EchoLearn/app/src/services/trajectoryAnalyzer.service.ts) is only exercised by tests and not connected to planner UX
- [app/src/services/suggestionScorer.service.ts](/Users/Code/EchoLearn/app/src/services/suggestionScorer.service.ts) is not connected to production flows

Impact:

- the codebase contains “future architecture” that increases complexity without delivering current value
- readers must distinguish active behavior from speculative behavior manually

### Unused UI exports

Within [app/src/components/InfoFlow.tsx](/Users/Code/EchoLearn/app/src/components/InfoFlow.tsx#L376) and [app/src/components/InfoFlow.tsx](/Users/Code/EchoLearn/app/src/components/InfoFlow.tsx#L698), `ImmersiveInfoFlow` and `InfoFlowPreview` are exported but do not appear to be integrated into current routes/screens.

### Legacy mock service subtree appears inactive

The following mock services appear disconnected from the live app:

- [app/src/services/mock/question.mock.ts](/Users/Code/EchoLearn/app/src/services/mock/question.mock.ts#L115)
- [app/src/services/mock/podcast.mock.ts](/Users/Code/EchoLearn/app/src/services/mock/podcast.mock.ts#L35)
- [app/src/services/mock/review.mock.ts](/Users/Code/EchoLearn/app/src/services/mock/review.mock.ts#L17)

`settings.mock.ts` is active, but the broader mock-service subtree looks like leftover scaffolding from an earlier architecture.

## Technical Debt

### Global persistence services plus local hook state creates duplication

[app/src/state/AppProvider.tsx](/Users/Code/EchoLearn/app/src/state/AppProvider.tsx#L3) is explicitly a pass-through. Meanwhile hooks like [app/src/state/useQuestions.ts](/Users/Code/EchoLearn/app/src/state/useQuestions.ts#L22), [app/src/state/useReview.ts](/Users/Code/EchoLearn/app/src/state/useReview.ts#L20), and [app/src/state/usePodcast.ts](/Users/Code/EchoLearn/app/src/state/usePodcast.ts#L19) each load and own their own screen-local state from service singletons.

Impact:

- the app has multiple state authorities: local React state, localStorage-backed services, SQLite write-through, and a lightweight event bus
- synchronization is selective and manual rather than systemic
- maintainability depends on developers remembering where to emit events and where to reload data

### Event coverage is inconsistent

Some hooks subscribe to selected events, such as [app/src/state/useReview.ts](/Users/Code/EchoLearn/app/src/state/useReview.ts#L42) and [app/src/state/usePodcast.ts](/Users/Code/EchoLearn/app/src/state/usePodcast.ts#L35), but the overall pattern is incomplete. This makes freshness and side-effect behavior harder to reason about across screens.

### Async-heavy screens are carrying orchestration responsibility

Key screens such as:

- [app/src/screens/AskScreen.tsx](/Users/Code/EchoLearn/app/src/screens/AskScreen.tsx)
- [app/src/screens/HomeScreen.tsx](/Users/Code/EchoLearn/app/src/screens/HomeScreen.tsx)
- [app/src/screens/PostDetailScreen.tsx](/Users/Code/EchoLearn/app/src/screens/PostDetailScreen.tsx)

contain large amounts of orchestration logic, persistence interactions, UI state, and streaming behavior in the same files.

Impact:

- screens are harder to audit for correctness
- feature changes have a higher chance of introducing regressions
- readability cost is high for new contributors

### Type system drift

The shared error-code union no longer matches provider behavior. This is more than a compile problem; it indicates that contracts are being changed locally instead of centrally.

### Tests are not aligned with production integration risk

The test suite passes, but it did not catch:

- current build failure
- current lint failure
- unintegrated screens/hooks/services
- incorrect web DB clearing behavior

This indicates stronger coverage at the unit level than at the integration/release-readiness level.

## Code Structure Evaluation

Current structure characteristics:

- good separation by domain folder (`services`, `screens`, `components`, `state`, `providers`)
- weak runtime cohesion between those layers
- no real shared application state layer despite the presence of `AppProvider`
- multiple partially overlapping architectural styles:
  - screen-local hooks
  - service singletons
  - event-bus synchronization
  - localStorage persistence
  - SQLite write-through

Assessment:

- the structure is still understandable for a single active developer
- it is already showing maintainability strain
- human readability is reduced by inactive abstractions, duplicate flows, and large orchestration-heavy screens
- without cleanup, the codebase is likely to become harder to modify safely as more features are added

## Final Assessment

The codebase does **not** look like it needs a full rewrite, but it **is** at the point where maintainability is being materially affected by dead code, broken build health, incomplete integrations, and fragmented state management. The strongest signal is not any single bug; it is the combination of:

- passing tests with failing build/lint
- dead modules coexisting with live ones
- production logic split across services, hooks, screens, and event wiring

That combination is usually where readability and change safety start to decay noticeably.

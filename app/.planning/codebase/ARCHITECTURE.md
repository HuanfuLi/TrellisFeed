# Architecture

**Analysis Date:** 2026-03-31

## Pattern Overview

**Overall:** Layered React application with service-based data management and event-driven synchronization.

**Key Characteristics:**
- React 19 + React Router v7 for client-side routing and navigation
- Service layer abstracts data operations and business logic (question storage, flashcards, planner)
- Custom hook layer (`state/`) provides component-level state management without Context
- Event-driven architecture via singleton EventBus for cross-hook synchronization
- Multi-backend data layer: localStorage (primary), SQLite (native Capacitor), abstracted via `db.service.ts`
- Provider pattern for external services (LLM, TTS, STT, embeddings, image generation)

## Layers

**Presentation Layer:**
- Purpose: Render UI, handle user interactions, dispatch state updates
- Location: `src/screens/`, `src/components/`
- Contains: Screen components (13 screens), reusable UI components (7 base UI components + feature components like ChatInput, Flashcard, MoveCard)
- Depends on: State hooks (`state/`), components, react-router-dom
- Used by: React render cycle

**State/Logic Layer:**
- Purpose: Manage application state, coordinate data loading/mutations, expose hooks for screens
- Location: `src/state/`
- Contains: 8 custom hooks (useQuestions, useReview, usePlanner, usePodcast, useSettings, useDailyRefresh, usePlannerAutoGen, AppProvider)
- Depends on: Services, providers, event bus
- Used by: Screen components via React hooks

**Service Layer:**
- Purpose: Encapsulate business logic, data persistence, external API calls
- Location: `src/services/`
- Contains: 20+ services including question.service, flashcard.service, session.service, planner.service, concept-feed.service, etc.
- Depends on: Providers (LLM, TTS, STT, embedding), db.service, event bus, localStorage
- Used by: State hooks, other services

**Provider Layer:**
- Purpose: Abstract external service integrations (LLM, text-to-speech, speech-to-text, embeddings, image generation)
- Location: `src/providers/`
- Contains: LLM routing (Claude, Gemini, OpenAI), TTS (OpenAI), STT (speech recognition), embedding (text vectors)
- Depends on: External APIs (Anthropic, Google, OpenAI)
- Used by: Services, state hooks

**Data/Storage Layer:**
- Purpose: Persist and retrieve application data
- Location: `src/services/db.service.ts`, localStorage keys in services
- Contains: SQLite backend for native (Capacitor), localStorage fallback for web
- Depends on: Capacitor SQLite plugin (native only), browser localStorage API
- Used by: Services (question.service, planner.service, session.service)

**Library/Utility Layer:**
- Purpose: Provide cross-cutting utilities
- Location: `src/lib/`
- Contains: EventBus (pub/sub), date helpers, toast notifications, voice recording, theme system
- Depends on: None
- Used by: Services, hooks, components

## Data Flow

**Question Asking Flow (Ask Screen):**

1. User inputs text in `AskScreen` → calls `useQuestions.askStreaming()`
2. `useQuestions` → calls `questionService.askStreaming()` with streaming callback
3. `questionService.askStreaming()`:
   - Filters questions for context via `question-filter.service`
   - Calls `chatStream()` from `providers/llm` with system prompt + context
   - Extracts answer content, calls `chatCompletion()` for extracting flashcards
   - Classifies & anchors question via `canonical-knowledge.service.classifyAndAnchor()`
   - Persists Question to localStorage + SQLite
   - Emits `QUESTION_ASKED` event
4. EventBus distributes event → all `useQuestions` instances update via `QUESTION_ASKED` subscriber
5. `AskScreen` receives streaming tokens via callback, renders response incrementally
6. Session stored via `sessionService` (localStorage)

**Knowledge Graph Organization:**

1. Questions flow in → canonical knowledge service builds hierarchies (root → branch → cluster)
2. `canonical-knowledge.service` organizes via keyword extraction and LLM-assisted classification
3. `graph.service` maintains graph relationships, edge weights stored in SQLite
4. `concept-feed.service` generates daily feed by selecting recent/related/resurfaced questions
5. Concept feed includes seeded starter posts + connection cards between concepts

**Planner Auto-Suggestion Flow:**

1. `plannerAutoGen.service` analyzes learning trajectory via `trajectoryAnalyzer.service`
2. Scores candidate moves via `suggestionScorer.service` + `moveGenerator.service`
3. Generates learning chunks (review/compare/discover) ranked by trajectory signals
4. Planner chunks stored in SQLite
5. `PlannerScreen` loads via `usePlanner` hook, allows pin/delete/status changes

**State Management:**

- No Context API in use (AppProvider is pass-through)
- Each hook maintains isolated state: useState for data, errors, loading flags
- Cross-hook sync via EventBus: QUESTION_ASKED, MOVE_DELETED, etc.
- localStorage is source of truth for questions, sessions, flashcards, settings
- SQLite (native) mirrors localStorage as backup/durability layer

## Key Abstractions

**Question (Knowledge Node):**
- Purpose: Core unit representing a user question and its answer
- Examples: `src/types/index.ts` (Question interface), stored/retrieved by `question.service`
- Pattern: Single question can be anchor node (concept container), cluster node (aggregate), or Q&A node (reviewable)

**FlashCard:**
- Purpose: Reviewable knowledge unit extracted from Q&A
- Examples: `flashcard.service.ts` extracts via LLM, stored in localStorage under `echolearn_flashcards`
- Pattern: SM-2 scheduling algorithm for review intervals

**ChatSession:**
- Purpose: Conversation context and history
- Examples: `session.service.ts` (SESSIONS_KEY = 'echolearn_sessions')
- Pattern: Active session tracked separately, used for follow-up filtering

**PlannedMove:**
- Purpose: Auto-generated learning suggestion linking concept to action
- Examples: `planner.service.ts`, types in `types/planner.ts`
- Pattern: Moves ranked by trajectory signals, user can pin/complete/delete

**DailyPost:**
- Purpose: Feed item (starter post, recent question, connection card, etc.)
- Examples: `concept-feed.service.ts` generates, stored in `STORAGE_KEY = 'echolearn_daily_posts'`
- Pattern: Generated daily, fingerprinted to detect cache invalidation

**EventBus:**
- Purpose: Decoupled pub/sub for inter-hook communication
- Examples: `lib/event-bus.ts` singleton, events in `types/index.ts` as discriminated union
- Pattern: Strongly typed, handlers remove themselves automatically on unsubscribe

## Entry Points

**App Root:**
- Location: `src/main.tsx`
- Triggers: Page load
- Responsibilities: Bootstrap theme, create React root, mount AppProvider

**Router:**
- Location: `src/App.tsx` (createBrowserRouter)
- Triggers: Navigation or direct URL access
- Responsibilities: Route matching, render RootLayout + screen components, handle onboarding gate

**RootLayout:**
- Location: `src/App.tsx` (RootLayout function)
- Triggers: Every navigation (except /onboarding)
- Responsibilities: Fixed safe-area padding, BottomNavigation, voice recording handlers, ToastContainer, recording indicator

**Screens:**
- Location: `src/screens/` (13 screens)
- Triggers: Route matches (e.g., `/home` → HomeScreen, `/ask` → AskScreen)
- Responsibilities: Screen-specific UI, state management via hooks, navigation

## Error Handling

**Strategy:** Result-based error handling (ServiceResult<T> = { success, data?, error? })

**Patterns:**
- Services return typed results, never throw (except catastrophic failures)
- Components check `success` flag, display error via toast() helper
- Retry logic: Some services (LLM calls) have builtin timeout/retry via AbortSignal
- Validation errors (missing API keys) shown inline in SettingsScreen
- Storage quota exceeded (localStorage full) shown in session.service.saveAll() with toast

## Cross-Cutting Concerns

**Logging:** console.error for failures, console.log for debug. No structured logging framework.

**Validation:** LLM responses validated for content extraction (e.g., JSON parsing in flashcard extraction). Input text normalized in canonical-knowledge-service (normalizeText).

**Authentication:** Settings-based (API keys stored in localStorage via mockSettingsService). No OAuth/JWT. User consent gated via `settings.preferences.aiConsentGiven`.

**Caching:** concept-feed.service caches daily posts with fingerprint, invalidates when question pool changes. ImageGeneration bootstraps on app start, caches generated image URLs.

**Theming:** CSS custom properties (--primary-40, --surface, --radius-xl, etc.). applyTheme() applies to document root, syncs with OS dark/light mode.

**Safe Area Handling:** Capacitor safe area variables (--safe-area-top, --safe-area-bottom) used for padding, preventing status bar/home indicator overlap.

---

*Architecture analysis: 2026-03-31*

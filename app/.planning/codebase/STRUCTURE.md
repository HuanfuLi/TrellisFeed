# Codebase Structure

**Analysis Date:** 2026-03-31

## Directory Layout

```
src/
├── main.tsx                    # React root, AppProvider entry
├── App.tsx                     # Router setup, RootLayout, onboarding gate
├── index.css                   # Global styles, CSS custom properties
├── types/
│   ├── index.ts               # All domain types (Question, FlashCard, ChatSession, etc.)
│   ├── planner.ts             # Planner domain types (PlannerChunk, PlannedMove, etc.)
│   └── carousel.ts            # PostCarousel types
├── lib/
│   ├── event-bus.ts           # EventBus singleton, pub/sub
│   ├── date.ts                # Date helpers (today, formatDate, getGreeting)
│   ├── toast.ts               # toast() helper
│   ├── theme.ts               # applyTheme(), matchMedia listeners
│   ├── voice-recorder.ts      # startVoiceRecording, stopVoiceRecording
│   ├── haptics.ts             # Haptic feedback (vibrate)
│   └── moveNavigator.ts       # Route navigation helpers
├── providers/
│   ├── llm/
│   │   └── index.ts           # LLM routing (Claude, Gemini, OpenAI)
│   ├── embedding/
│   │   └── index.ts           # Text embedding (cosine similarity)
│   ├── tts/
│   │   └── index.ts           # Text-to-speech (OpenAI API)
│   ├── stt/
│   │   └── index.ts           # Speech-to-text (Whisper API)
│   ├── gemini.provider.ts     # Google Gemini client
│   ├── nanoBanana.provider.ts # NanoBanana inference
│   └── imageProvider.interface.ts
├── services/
│   ├── db.service.ts          # SQLite/localStorage abstraction
│   ├── question.service.ts    # Question CRUD, ask(), askStreaming()
│   ├── session.service.ts     # ChatSession CRUD, active session tracking
│   ├── flashcard.service.ts   # FlashCard storage, LLM extraction
│   ├── review.service.ts      # SM-2 scheduling algorithm
│   ├── planner.service.ts     # PlannerChunk CRUD, thread organization
│   ├── plannerAutoGen.service.ts  # Auto-suggestion generation
│   ├── moveGenerator.service.ts   # Move ranking
│   ├── suggestionScorer.service.ts # Move scoring
│   ├── trajectoryAnalyzer.service.ts # Learning signals analysis
│   ├── canonical-knowledge.service.ts # Graph org, classification, hierarchy
│   ├── concept-feed.service.ts # Daily post generation, feed caching
│   ├── graph.service.ts       # Graph relationships, edge weights
│   ├── podcast.service.ts     # Podcast generation, audio blobs
│   ├── question-filter.service.ts # Question context filtering
│   ├── postFormatting.service.ts  # Post markdown formatting
│   ├── post-context-qa.service.ts # Connection card generation
│   ├── imageGeneration.service.ts # Image gen from prompts
│   ├── imageGeneration.bootstrap.ts # Image gen key setup
│   ├── infiniteScroll.service.ts # Infinite scroll pagination
│   ├── scheduler.service.ts   # Foreground task scheduler
│   ├── scheduler.native.ts    # Native OS notifications
│   └── mock/
│       ├── settings.mock.ts   # localStorage settings persistence
│       ├── question.mock.ts   # (legacy mock)
│       ├── review.mock.ts     # (legacy mock)
│       ├── calendar.mock.ts   # (legacy mock)
│       └── podcast.mock.ts    # (legacy mock)
├── state/
│   ├── AppProvider.tsx        # Pass-through provider (composition point)
│   ├── useQuestions.ts        # Question state, ask/askStreaming
│   ├── useReview.ts           # FlashCard review state
│   ├── usePodcast.ts          # Podcast state, generation
│   ├── usePlanner.ts          # PlannerChunk state, CRUD
│   ├── usePlannerAutoGen.ts   # Auto-suggestion generation
│   ├── useSettings.ts         # Settings state (API keys, preferences)
│   └── useDailyRefresh.ts     # Daily reset signals
├── components/
│   ├── BottomNavigation.tsx   # NavLink-based 4-tab nav (Home/Ask/Calendar/Settings)
│   ├── ChatInput.tsx          # Input box with attachments
│   ├── ChatMessage.tsx        # Message bubble with markdown
│   ├── Flashcard.tsx          # Card flip for review
│   ├── InfoFlow.tsx           # Infinite scroll feed component
│   ├── MoveCard.tsx           # Learning move suggestion card
│   ├── ConceptCard.tsx        # Concept display card
│   ├── Markdown.tsx           # Markdown renderer
│   ├── Confetti.tsx           # Celebration animation
│   ├── DetailMenu.tsx         # Context menu (pin/delete)
│   ├── FeedPostImage.tsx      # Post image rendering
│   ├── PostCarousel.tsx       # Carousel for multiple posts
│   ├── PageTransition.tsx     # Slide transition animation
│   ├── PullUpHint.tsx         # Pull-down refresh indicator
│   └── ui/
│       ├── Button.tsx         # Base button component
│       ├── Card.tsx           # Base card component
│       ├── Badge.tsx          # Label badge
│       ├── Header.tsx         # Screen header with back/title
│       ├── ProgressBar.tsx    # Progress visualization
│       ├── Skeleton.tsx       # Loading skeleton
│       └── Toast.tsx          # Toast notification container
└── screens/
    ├── OnboardingScreen.tsx   # First-time user flow
    ├── HomeScreen.tsx         # Info flow feed (recent/related/resurfaced)
    ├── AskScreen.tsx          # Chat interface, session history
    ├── QuestionDetailScreen.tsx # Single question view
    ├── ReviewScreen.tsx       # FlashCard review, library
    ├── PlannerScreen.tsx      # Learning tasks, move execution
    ├── PodcastScreen.tsx      # Podcast player, generation
    ├── SettingsScreen.tsx     # User preferences, API keys
    ├── GraphScreen.tsx        # Knowledge graph visualization
    ├── PostDetailScreen.tsx   # Single post/concept view
    ├── AnchorDetailScreen.tsx # Anchor node + attached Q&A
    ├── ClusterDetailScreen.tsx # Cluster node view
    └── ConnectionPostScreen.tsx # Connection card details
```

## Directory Purposes

**types/:**
- Purpose: TypeScript interfaces and types for the entire application
- Contains: Question, FlashCard, ChatSession, PlannedMove, DailyPost, BlindboxItem, ReviewSchedule, and 30+ supporting types
- Key files: `src/types/index.ts` (primary), `src/types/planner.ts` (planner domain), `src/types/carousel.ts` (post carousel)

**lib/:**
- Purpose: Cross-cutting utility functions and singletons
- Contains: EventBus pub/sub, date formatting, toast notifications, voice recording, theme management
- Key files: `src/lib/event-bus.ts` (strongly typed event dispatcher), `src/lib/date.ts` (date helpers), `src/lib/toast.ts` (notification)

**providers/:**
- Purpose: Abstract external service integrations
- Contains: LLM routing (Claude/Gemini/OpenAI), TTS, STT, embeddings, image generation
- Key files: `src/providers/llm/index.ts` (multi-provider LLM), `src/providers/tts/index.ts` (OpenAI speech), `src/providers/stt/index.ts` (speech recognition)

**services/:**
- Purpose: Business logic and data persistence
- Contains: 20+ specialized services for questions, flashcards, planner, podcast, graph, feeds, scheduling
- Key files: `src/services/question.service.ts` (1166 lines), `src/services/concept-feed.service.ts` (965 lines), `src/services/db.service.ts` (abstraction layer)

**state/:**
- Purpose: React hooks that manage application state and expose APIs to screens
- Contains: 8 custom hooks, each managing one aspect (questions, review, planner, podcast, settings)
- Key files: `src/state/useQuestions.ts` (question state + streaming), `src/state/usePodcast.ts` (podcast generation)

**components/:**
- Purpose: Reusable UI components
- Contains: Base UI components (Button, Card, Badge, Header) + feature components (ChatInput, Flashcard, MoveCard, InfoFlow)
- Key files: `src/components/ui/` (7 base components), feature components in root (ChatMessage, Markdown, PageTransition)

**screens/:**
- Purpose: Full-page views corresponding to routes
- Contains: 13 screens (HomeScreen, AskScreen, ReviewScreen, PlannerScreen, etc.)
- Key files: `src/screens/AskScreen.tsx` (872 lines, main Q&A interface), `src/screens/SettingsScreen.tsx` (1059 lines, longest screen)

## Key File Locations

**Entry Points:**
- `src/main.tsx`: React root, theme bootstrap, AppProvider mount
- `src/App.tsx`: Router creation, RootLayout, onboarding gate
- `src/index.css`: Global CSS variables (--primary-40, --surface, node colors)

**Configuration:**
- `src/services/mock/settings.mock.ts`: localStorage-based settings persistence (API keys, theme, preferences)
- `src/lib/theme.ts`: Theme application, dark/light mode sync with OS

**Core Logic:**
- `src/services/question.service.ts`: Question CRUD, ask(), askStreaming() with LLM integration
- `src/services/canonical-knowledge.service.ts`: Knowledge graph organization, classification, hierarchy building
- `src/services/concept-feed.service.ts`: Daily feed generation (recent/related/resurfaced + starter posts)
- `src/state/useQuestions.ts`: Hook exposing question state + streaming ask

**Testing:**
- No test files found. No test framework configured (eslint.config.js present, no jest/vitest config)

## Naming Conventions

**Files:**
- Services: `*.service.ts` (e.g., `question.service.ts`, `session.service.ts`)
- Hooks: `use*.ts` (e.g., `useQuestions.ts`, `usePlanner.ts`)
- Screens: `*Screen.tsx` (e.g., `HomeScreen.tsx`, `AskScreen.tsx`)
- Components: PascalCase `.tsx` (e.g., `ChatInput.tsx`, `BottomNavigation.tsx`)
- Types: `index.ts` (all types in one file) + domain-specific files (`planner.ts`, `carousel.ts`)
- Libraries: `*.ts` descriptive names (e.g., `event-bus.ts`, `date.ts`)

**Functions:**
- Event handlers: `on*` or `handle*` (e.g., `onLoadMore`, `handleAskLongPress`)
- Async operations: no prefix convention, some use `_run*` for internal (e.g., `_runMigrations`)
- Utilities: descriptive action names (e.g., `normalizeText`, `toKeywords`, `embedText`)

**Variables:**
- State variables: camelCase (e.g., `questions`, `isAsking`, `reviewCount`)
- Refs: `*Ref` (e.g., `containerRef`, `questionsRef`, `isLoadingMoreRef`)
- Constants: UPPER_SNAKE_CASE for immutable (e.g., `STORAGE_KEY`, `PULL_THRESHOLD`, `MAX_POSTS`)

**Types:**
- Interfaces: PascalCase (e.g., `Question`, `FlashCard`, `PlannedMove`)
- Unions: PascalCase (e.g., `ChunkType = 'review' | 'compare' | 'discover'`)
- Service results: Generic `ServiceResult<T> = { success, data?, error? }`

## Where to Add New Code

**New Feature (end-to-end):**
1. Type definition: Add to `src/types/index.ts` (or `src/types/domain.ts` if large)
2. Service layer: Add `src/services/feature.service.ts` following ServiceResult pattern
3. State hook: Add `src/state/useFeature.ts` exposing data + mutation functions
4. Screen: Add `src/screens/FeatureScreen.tsx` using hook + components
5. Navigation: Add route to `App.tsx` router config
6. Tab link: Add to `BottomNavigation.tsx` if it's a primary tab

**New Component:**
- Implementation: `src/components/NewComponent.tsx` (PascalCase)
- Props: Typed interface in same file or imported from `src/types/`
- Styling: Inline styles with CSS variables (not Tailwind classes for most)
- Export: Named export (e.g., `export function NewComponent() { ... }`)

**Utilities:**
- Shared helpers: `src/lib/helper-name.ts` (descriptive, lowercase with dashes)
- Service helpers: Keep internal to service file unless reused across 2+ services
- Event types: Extend `AppEvent` discriminated union in `src/types/index.ts`

**Styling:**
- Use CSS custom properties: `var(--primary-40)`, `var(--surface-variant)`, `var(--radius-xl)`, `var(--shadow-1)`
- No Tailwind classes for most styling — inline styles with vars
- Safe area variables: `var(--safe-area-top)`, `var(--safe-area-bottom)` (set by theme.ts)
- Node colors: `var(--node-mint)`, `var(--node-salmon)`, `var(--node-lilac)`, `var(--node-peach)`, `var(--node-sky)`

## Special Directories

**services/mock/:**
- Purpose: Legacy mock implementations (kept for backwards compatibility)
- Generated: No
- Committed: Yes
- Notes: `settings.mock.ts` is active (localStorage-based). Others (question.mock, calendar.mock, etc.) are legacy fallbacks.

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (via npm install)
- Committed: No (listed in .gitignore)

**.git/:**
- Purpose: Version control
- Generated: Yes
- Committed: N/A

---

*Structure analysis: 2026-03-31*

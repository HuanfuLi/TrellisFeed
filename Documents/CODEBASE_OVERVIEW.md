# EchoLearn Codebase Overview

This document provides a comprehensive map of the EchoLearn codebase to help developers and AI agents understand the project structure, data models, and business logic.

## 📁 Project Structure

```text
app/src/
├── components/       # Reusable UI components (Atomic design)
│   ├── ui/           # Low-level primitives (Button, Card, etc.)
│   └── ...           # Feature-specific components (Flashcard, ChatMessage)
├── lib/              # Utilities (date, event-bus, theme, toast)
├── providers/        # External API abstractions (LLM, STT, TTS)
├── screens/          # Top-level page components (HomeScreen, AskScreen, etc.)
├── services/         # Business logic and data persistence
│   └── mock/         # Mock implementations for development
├── state/            # React hooks for state management (AppProvider, useQuestions, etc.)
├── types/            # Centralized TypeScript interfaces
└── App.tsx           # Main router and layout configuration
```

---

## 🏗️ Data Models (Interfaces)

Defined in `app/src/types/index.ts`.

### Knowledge Domain
- **`Question`**: Represents a single Q&A interaction.
  - `id`, `content`, `answer`, `summary`, `keywords`, `relatedQuestionIds`, `reviewSchedule`.
- **`ReviewSchedule`**: Spaced repetition tracking.
  - `nextReviewDate`, `reviewCount`, `easeFactor`.

### Learning Domain
- **`FlashCard`**: Extracted knowledge point for review.
  - `front`, `back`, `sessionId`, `pinned`, `reviewSchedule`.
- **`DailyPodcast`**: AI-generated audio recap.
  - `date`, `script`, `audioPath`, `status` (`pending`, `generating`, `ready`, `failed`).

### Productivity Domain
- **`TimeBlock`**: A scheduled period in the calendar.
  - `startTime`, `endTime`, `label`, `todos`.
- **`TodoItem`**: Tasks within a TimeBlock.
  - `status` (`pending`, `completed`, `postponed`), `pinned`.

---

## 🛠️ Services

Services handle business logic and interact with `localStorage`.

### `questionService` (`services/question.service.ts`)
- **`ask(content)`**: Sends a prompt to the LLM, parses the response, and saves a `Question`.
- **`buildAndSave(...)`**: Internal helper to create and persist a `Question` object.
- **`getRecent(limit)`**: Retrieves the latest questions.
- **`getByDate(date)`**: Retrieves questions for a specific day.

### `sessionService` (`services/session.service.ts`)
- **`getActive()`**: Gets or creates the current `ChatSession`.
- **`save(session)`**: Persists session updates.
- **`createNew()`**: Starts a fresh conversation.

### `flashcardService` (`services/flashcard.service.ts`)
- **`processSession(session)`**: Uses LLM to extract `FlashCard` pairs from a completed chat session.
- **`getDue()`**: Returns cards ready for review based on their schedule or `pinned` status.
- **`togglePin(id)`**: Ensures a card always appears in the daily review queue.

### `podcastService` (`services/podcast.service.ts`)
- **`generatePodcast(date)`**: Summarizes daily questions using LLM and synthesizes audio via TTS.
- **`getAudioPath(id)`**: Returns the temporary Blob URL for the podcast audio.

### `reviewService` (`services/review.service.ts`)
- **`submitReview(id, rating)`**: Updates a card's `ReviewSchedule` using the SM-2 algorithm.

---

## 🔗 State Management (Hooks)

Hooks in `app/src/state/` wrap services and provide reactive state to components.

- **`useQuestions`**: Manages the list of questions and the `askStreaming` workflow.
- **`useReview`**: Provides the daily queue of flashcards and handles review submissions.
- **`useCalendar`**: Manages `TimeBlock` and `TodoItem` state (currently powered by `mockCalendarService`).
- **`usePodcast`**: Tracks the generation progress and list of available podcasts.
- **`useSettings`**: Provides global configuration (`LLMConfig`, `TTSConfig`, `Preferences`).

---

## 📡 AI Providers

Abstracted in `app/src/providers/`.

- **`llm/index.ts`**:
  - `chatCompletion`: One-shot AI response.
  - `chatStream`: Streaming AI response (supports OpenAI, Claude, Gemini).
- **`stt/index.ts`**:
  - `transcribeAudio`: Audio-to-text using OpenAI Whisper API.
- **`tts/index.ts`**:
  - `synthesize`: Text-to-speech using OpenAI TTS API.

---

## ⚡ Event System

The `eventBus` (`lib/event-bus.ts`) enables decoupled communication.

Key events:
- `QUESTION_ASKED`: Triggered when a new question is saved.
- `FLASHCARDS_CREATED`: Triggered after session post-processing.
- `PODCAST_GENERATION_PROGRESS`: Used for real-time progress bars.
- `SESSION_UPDATED`: Triggered when messages are added to a chat.

---

## 🚦 Application Flow

1. **Entry Point**: `main.tsx` renders `AppProvider` -> `App`.
2. **Routing**: `App.tsx` defines the `RootLayout` with `BottomNavigation`.
3. **Onboarding**: Redirects to `/onboarding` if `preferences.onboardingCompleted` is false.
4. **Core Loop**:
   - `AskScreen` -> Ask AI questions.
   - `SessionService` -> Groups questions into sessions.
   - `FlashcardService` -> Extracts cards from sessions.
   - `ReviewScreen` -> Review due cards.
   - `PodcastScreen` -> Listen to daily summaries.

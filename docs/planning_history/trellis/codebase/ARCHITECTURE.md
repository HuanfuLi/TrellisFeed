# Architecture

## Design Patterns
The application follows a **layered architecture** with a clear separation of concerns:
- **Presentation Layer (Screens & Components)**: React components responsible for rendering the UI and handling user interactions.
- **Business Logic Layer (Services)**: Services that manage application logic, data orchestration, and communication with providers/DB.
- **Infrastructure Layer (Providers & DB)**: Abstractions for external APIs (LLM, Embedding, STT, TTS) and local storage (SQLite/LocalStorage).

## Core Systems
- **Knowledge Management**: The `canonical-knowledge.service.ts` and `graph.service.ts` manage the structure and relationships of concepts within the EchoLearn ecosystem.
- **Review System**: The `review.service.ts` and `flashcard.service.ts` implement spaced repetition logic based on SQLite-stored metadata.
- **AI Integration**: The `providers/` directory contains various implementations for AI services, which are dynamically routed based on user configuration.

## Data Flow
EchoLearn utilizes a **unidirectional data flow** managed through React Context and custom hooks:
- **State Management**: The `AppProvider.tsx` provides global state (user settings, session data) to the entire application.
- **Hooks**: Feature-specific state and logic are encapsulated within custom hooks (e.g., `usePlanner.ts`, `usePodcast.ts`).
- **Persistence**: Services interact with the `db.service.ts` to persist state across sessions, ensuring data remains available even when the app is closed.

## Component Interactions
- **Routing**: `react-router-dom` manages navigation between screens.
- **Transitions**: `framer-motion` and `PageTransition.tsx` handle fluid UI animations during navigation.
- **Native Bridges**: `Capacitor` bridges the web view with native mobile features (SQLite, Haptics, App Lifecycle).

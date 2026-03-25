# Project Description: EchoLearn

EchoLearn is an AI-powered personalized learning platform designed to facilitate non-linear knowledge acquisition through AI-driven content generation, visual knowledge mapping, and spaced repetition. It bridges the gap between passive content consumption and active, long-term learning by organizing information into "canonical knowledge" and "learning chunks."

## Core Vision
EchoLearn aims to provide a "second brain" for learners, where information is not just stored but actively integrated into their mental models. It leverages Large Language Models (LLMs) to generate personalized learning paths, answer complex questions, and create engaging content like AI-generated podcasts and connection cards.

## Key Features

### 1. AI-Powered "ASK" & Contextual QA
- **Contextual Exploration**: Users can ask questions about concepts, and the system provides AI-generated answers grounded in their existing knowledge base.
- **Deep Dives**: Supports multi-turn conversations and deep dives into specific sub-topics, automatically linking them back to the central knowledge graph.

### 2. Knowledge Graph & Visual Mapping
- **Mind Elixir Integration**: Visualizes the relationships between different concepts using an interactive mind-map interface.
- **Non-Linear Navigation**: Allows users to explore their knowledge base spatially rather than just through lists.

### 3. AI-Generated Concept Feed
- **Learning Posts**: AI generates "posts" that break down complex topics into digestible pieces.
- **Connection Cards**: Highlights semantic relationships between seemingly unrelated topics to foster multidisciplinary understanding.

### 4. Review & Spaced Repetition (SRS)
- **Automated Flashcards**: The system automatically generates flashcards from learning content.
- **Spaced Repetition Logic**: Uses SQLite-backed metadata to schedule reviews, ensuring long-term retention of concepts.

### 5. Learning Planner & Chunks
- **Learning Path Orchestration**: Organizes broad topics into "learning chunks" and manageable paths.
- **Progress Tracking**: Monitors user mastery across different domains.

### 6. Podcast Mode
- **Audio-Based Learning**: Converts text-based learning content into conversational AI-generated podcasts for on-the-go consumption.

## Design Philosophy & UX

EchoLearn prioritizes a high-quality, "native-first" mobile experience, avoiding the "web-wrapped" feel through several key principles:

- **Visual Theme**: Uses a Material You-inspired "Nature & Growth" theme with a consistent semantic palette across light and dark modes.
- **Tactile Feedback**: Incorporates physical responses to user actions, including "active-squish" effects on taps and haptic feedback via Capacitor Haptics.
- **Motion & Lifecycle**: Leverages Framer Motion for fluid page transitions and custom CSS keyframes (e.g., `mic-pulse`, `aha-pop`) to make the UI feel reactive and "alive."
- **Mobile-Optimized Layout**: Implements safe area awareness (notches, home bars) and mobile-first spacing (capped container widths, 44px+ tap targets).
- **Accessibility**: Includes features like Speech-to-Text (STT) and high-contrast dark mode support.

## Tech Stack

- **Framework**: [React](https://react.dev/) (v19.2.0) with [TypeScript](https://www.typescriptlang.org/) (v5.9.3)
- **Native Bridge**: [Capacitor](https://capacitorjs.com/) (v8.1.0) for cross-platform (iOS/Android/Web) deployment.
- **Build Tool**: [Vite](https://vitejs.dev/) (v7.3.1)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (v4.2.1)
- **Animations**: [Framer Motion](https://www.framer.com/motion/) (v12.38.0)
- **Database**: [SQLite](https://github.com/capacitor-community/sqlite) (@capacitor-community/sqlite v8.0.1) with `localStorage` fallback for web.
- **Knowledge Visualization**: [Mind Elixir](https://mind-elixir.com/) (v5.9.3)
- **AI Providers**: Support for Anthropic (Claude), Google Gemini, OpenAI, and local providers (e.g., LM Studio).

## Architecture

The application follows a **layered, service-oriented architecture**:

1.  **Presentation Layer**: React screens (in `src/screens/`) and components (in `src/components/`) handle UI and user interaction.
2.  **Business Logic Layer (Services)**: Located in `src/services/`, these singleton-like classes manage data orchestration, AI prompts, and business rules (e.g., `canonical-knowledge.service.ts`, `planner.service.ts`).
3.  **Infrastructure Layer (Providers)**: Located in `src/providers/`, these abstract communication with external AI APIs and local storage.
4.  **State Management**: Uses React Context (`AppProvider.tsx`) and custom hooks for unidirectional data flow.

## Project Structure

- `app/`: The core mobile/web application code.
    - `src/components/`: Reusable UI elements and screen-specific components.
    - `src/screens/`: High-level page components routed via React Router.
    - `src/services/`: Core business logic and data management services.
    - `src/providers/`: AI service abstractions (LLM, STT, TTS, Embedding).
    - `src/state/`: Global React state providers and hooks.
- `openspec/`: Contains detailed functional and technical specifications for each feature.
- `.planning/`: Contains project roadmaps, architecture docs, and current phase progress.

## Current Status (March 2026)
EchoLearn has successfully completed **Milestone 1: Learning Loop Foundation**. All core services (ASK, Graph, Review, Planner, Podcast) are functional and verified. The latest enhancement (Phase 6) introduced a hybrid Question Quality Evaluation layer that flags off-topic and meta-questions while preserving knowledge graph integrity. The system is now ready for Milestone 2: Collaborative Knowledge & Advanced Orchestration.

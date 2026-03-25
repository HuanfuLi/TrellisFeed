# EchoLearn: AI-Powered Personalized Learning

EchoLearn is a serverless, privacy-first mobile knowledge management application built with **React 19**, **TypeScript**, **Vite**, and **Capacitor 8**. It helps users transform fragmented information into a structured knowledge base using AI-driven Q&A, interactive mind maps, and spaced repetition.

## 🚀 Milestone 1.0 Complete: Learning Loop Foundation

Milestone 1 established the "Learning Loop Foundation" for EchoLearn, enabling a seamless flow from initial AI-driven inquiry (ASK) to long-term knowledge retention.

### Key Features
- **Contextual Q&A:** Multi-turn conversations grounded in your existing knowledge base.
- **Visual Knowledge Graph:** Interactive mind maps powered by Mind Elixir.
- **AI-Generated Concept Feed:** Discovery posts and semantic connection cards.
- **Spaced Repetition (SRS):** Automated flashcard generation and review scheduling.
- **Learning Planner:** Organized "chunks" and paths for structured mastery.
- **AI Podcasts:** Audio-based conversational learning content.
- **Quality Evaluation:** Hybrid pattern+LLM filtering for off-topic questions.

## 🏗️ Architecture & Technology Stack

- **Frontend:** React 19 (Hooks-based), React Router 7, Tailwind CSS 4.
- **Native Bridge:** Capacitor 8 (Cross-platform Android/iOS/Web).
- **Persistence:** Local-first with SQLite (capacitor-community/sqlite) and localStorage.
- **Animations:** Framer Motion for fluid page transitions.
- **AI Providers:** Support for OpenAI, Claude, Gemini, and local LLMs (LM Studio/Ollama).

## 📂 Project Structure

- `/app/src/components`: Atomic UI components and screens.
- `/app/src/services`: Business logic (ASK, Review, Planner, Podcast).
- `/app/src/providers`: LLM, STT, TTS, and Embedding abstractions.
- `/openspec`: Detailed functional and technical specifications.
- `.planning`: Roadmaps, architecture documents, and milestone archives.

## 🛠️ Development

### Prerequisites
- Node.js (v18+)
- Android Studio / Xcode (for mobile builds)

### Core Commands
```bash
cd app
npm install         # Install dependencies
npm run dev         # Start web development server
npm run build       # Build for production
npx cap sync        # Sync web build to native platforms
```

## 📜 Roadmap
The project has successfully shipped **v1.0 (Learning Loop Foundation)**. We are now entering **Milestone 2: Collaborative Knowledge & Advanced Orchestration**.

See [ROADMAP.md](ROADMAP.md) for detailed phase planning.

---
*Built with ❤️ for lifelong learners.*

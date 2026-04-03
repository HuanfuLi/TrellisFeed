# EchoLearn: AI-Powered Personalized Learning

EchoLearn is a serverless, privacy-first mobile knowledge management application built with **React 19**, **TypeScript**, **Vite**, and **Capacitor 8**. It helps users transform fragmented information into a structured knowledge base using AI-driven contextual Q&A, interactive mind maps, auto-generated flashcards, and spaced repetition.

## 🚀 Milestone 1.1 Complete: Engagement & Discovery Iteration

Milestone 1.1 radically expands upon the core foundation by introducing enhanced visuals, advanced orchestration, and optimized inference capabilities.

### Key Features
- **Cluster-Aware Knowledge Graph:** Mind maps are dynamically organized into aggregated cluster nodes and anchors for frictionless navigation deep into complex domains.
- **Image-Forward Concept Feed:** "Posts" feature multi-style AI-generated images with carousel galleries to improve concept discovery absorption. 
- **Intelligent Planner:** Auto-suggests optimal learning actions evaluating trajectory data, prioritizing weak areas, and generating actionable targets straight from Check-Ins. 
- **Contextual Q&A Threading:** Multi-turn conversational interfaces leverage true append-only session history for continuous learning without redundant context overhead overhead.
- **Token Optimization Tracking:** Transparent LLM analytics surface token cost boundaries per internal service interface within the Developer tools.
- **Spaced Repetition (SRS):** Automated flashcard generation, scheduling loops, and targeted "Cluster Reviews".

## 🏗️ Architecture & Technology Stack

- **Frontend:** React 19 (Hooks-based), React Router 7, Tailwind 4.
- **Native Bridge:** Capacitor 8 (Cross-platform Android/iOS/Web).
- **Persistence:** Local-first SQLite (`capacitor-community/sqlite`) plus localStorage fallbacks.
- **Animations:** Custom CSS keyframes and Framer Motion context layouts.
- **AI Providers:** Modular wrappers for OpenAI, Claude, Gemini, Local models (LM Studio), and image-generation endpoints.

## 📂 Project Structure

- `/app/src/components`: UI components and shared structures.
- `/app/src/services`: Business logic (ASK, Review, Planner, Podcast, Token Tracker).
- `/app/src/providers`: LLM, STT, TTS, Images, and Embedding.
- `.planning`: Active roadmaps, phase specifications, and milestone logs.
- `Documents`: Validation logs, UAT testing scripts, and historic change logs.

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
The project has successfully shipped **v1.1 (Engagement & Discovery Iteration)**. We are currently moving aggressively into **Milestone v2.0: Dynamic Learning Orchestration & Diagnostic Dialogue**.

See [ROADMAP.md](ROADMAP.md) for macro-level planning or `.planning/ROADMAP.md` for specific granular phase tracking.

---
*Built with ❤️ for lifelong learners.*

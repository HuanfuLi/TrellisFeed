# EchoLearn

## What This Is

EchoLearn is a personal learning assistant that helps users retain and connect knowledge through spaced repetition, AI-powered Q&A, knowledge graph visualization, and daily podcast summaries. It runs as a web app and native mobile app (iOS/Android via Capacitor).

## Core Value

**Users ask questions and the system helps them remember answers** — through flashcards (SM-2 scheduling), knowledge graph organization, and daily recap podcasts.

## Requirements

### Validated

- ✓ AI-powered Q&A with streaming responses (Claude, OpenAI, Gemini) — existing
- ✓ Session-based chat with history — existing
- ✓ Flashcard extraction from Q&A with SM-2 spaced repetition — existing
- ✓ Knowledge graph (mind map) with canonical knowledge organization — existing
- ✓ Daily podcast generation with TTS audio — existing
- ✓ Planner with auto-generated learning suggestions — existing
- ✓ Daily concept feed with connection cards — existing
- ✓ Calendar with time blocks and todos — existing
- ✓ Settings with multi-provider LLM/TTS/embedding configuration — existing
- ✓ Onboarding flow — existing
- ✓ Dark mode and theme system — existing
- ✓ Native mobile support via Capacitor (notifications, SQLite, haptics, voice) — existing
- ✓ Speech-to-text input via OpenAI Whisper — existing
- ✓ Image generation for feed posts — existing
- ✓ Pull-to-load infinite scroll feed — existing

### Active

- [ ] Reduce API token consumption across LLM, TTS, and embedding calls
- [ ] Fix known bugs (podcast audio persistence, image cache metadata, request deduplication)
- [ ] Improve data persistence reliability (localStorage quota, dual-write sync)
- [ ] Add error recovery patterns (retry, backoff, resumable operations)

### Out of Scope

- Multi-user / authentication — single-user local app by design
- Cloud sync / server backend — all data local (localStorage + SQLite)
- Social features (sharing, comments) — personal learning tool

## Context

**Tech stack:** React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 4 + Capacitor 8 (iOS/Android)

**Architecture:** Layered (screens → state hooks → services → providers) with EventBus for cross-hook sync. Data stored in localStorage (web) and SQLite (native). No server — all AI calls go directly to provider APIs from the client.

**Key technical debt:**
- 17 services write to localStorage directly (~5MB quota risk)
- Dual-write to localStorage + SQLite creates sync complexity
- Fire-and-forget async chains with no failure visibility
- No request deduplication for LLM/embedding calls (wasted tokens)
- Large screen components (800+ lines) need decomposition

**Token cost drivers:**
- LLM calls: Q&A streaming, flashcard extraction, question classification, canonical knowledge anchoring, concept feed generation, podcast script generation, planner auto-suggestions
- TTS calls: Podcast audio synthesis
- Embedding calls: Per-question embedding for cosine similarity

## Constraints

- **Storage**: localStorage ~5MB quota on iOS Safari; IndexedDB for larger data (audio, images)
- **Platform**: Must work on web + iOS + Android via Capacitor
- **API keys**: Users provide their own keys — no backend proxy
- **Offline**: Graceful degradation when no API keys configured or network unavailable

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| localStorage as primary store | Simplicity, works on web without plugins | ⚠️ Revisit — quota issues emerging |
| EventBus for cross-hook sync | Avoids Context API complexity, decoupled | ✓ Good |
| SM-2 for spaced repetition | Industry standard, well-understood algorithm | ✓ Good |
| Multi-provider LLM support | Users choose their preferred AI provider | ✓ Good |
| Client-side API calls (no backend) | Privacy, simplicity, no server costs | — Pending |
| CSS variables over Tailwind classes | Inline style convention established early | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-01 after initialization (brownfield)*

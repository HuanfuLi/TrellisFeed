# PROJECT: EchoLearn

## What This Is

EchoLearn is an AI-powered personalized learning platform designed to facilitate non-linear knowledge acquisition through AI-driven content generation, visual knowledge mapping, and spaced repetition. It bridges the gap between passive content consumption and active, long-term learning.

The platform prioritizes a high-quality, native-first mobile experience built with React, TypeScript, Vite, and Capacitor, combining local-first privacy with seamless AI integration (OpenAI, Claude, Gemini, and local LLMs).

## Core Value

Enable learners to transform fragmented information into structured knowledge through AI-driven Q&A, visual mapping, and adaptive spaced repetition—all while maintaining complete local-first privacy.

## Current Milestone: v1.1 (Engagement & Discovery Iteration)

**Goal:** Enhance user engagement through rich post formats (Rednote-style), smarter milestone cards, and automated Planner suggestions.

**Target features:**
- Redesign Home Feed posts with image-forward design (AI-generated images, titles with emojis)
- Implement scroll-to-load more posts (replacing "More" button)
- Add visual variety to milestone cards (more designs to prevent boredom)
- Auto-generate Planner "Suggested Moves" when Knowledge Graph is populated
- Integrate Nano Banana and Gemini API for image generation
- Add daily auto-refresh of suggested moves and allow user retry/regeneration

## Key Decisions

- **Local-First Privacy:** All user data persists locally via localStorage/SQLite. No backend required.
- **LLM Flexibility:** Support multiple providers (OpenAI, Claude, Gemini, local endpoints like LM Studio).
- **Visual-First UX:** Post feeds emphasize images and hooks (questions/stories) to drive engagement.
- **Adaptive Recommendations:** Planner logic respects user trajectory, review performance, and engagement patterns.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

**Phase 14 complete (2026-03-29):** Knowledge Graph Classification & Anchor Nodes — dedicated second LLM classification call, concept anchor nodes (isAnchorNode), Q&A attachment via parentId, mindmap renders anchors as collapsed leaves with expand/retract Q&A children. GRAPH-01 through GRAPH-06 validated.

**Phase 23 complete (2026-04-09):** Incremental Classification Pipeline + Ask Rate Limiter — replaced single-call classification with 3-step branch→cluster→anchor pipeline using append-only messages for KV cache efficiency. Added configurable monthly rate limiter with Settings UI, inline warning/error banners, and send button disable at limit.

**Phase 26 complete (2026-04-15):** Trellis Harvest Panel + Node Actions + Suggested Moves Refactor — Planner now shows a flat 3-column status panel (Dying | Fruit | Dead) with Fruit as a centered harvest button (direct tap, fly-to-counter + confetti, credits persisted). Suggested Moves refactored to be trellis-health-driven (dead → dying → filtered autoGen); heal, re-plant, and prune actions live directly on the rows. Re-plant reuses the "Learn as Post" flow (fire-and-forget, bumps node to dying state). PrunedSection archive at page bottom. UX simplified from the originally-planned bottom-sheet design per user feedback (D-09/D-14/D-17 voided, D-13 modified — see `.planning/phases/26-*/26-ADDENDUM.md`). Also landed cross-cutting fix: BottomNavigation tap = instant transport (reverted from Phase 22's animated jump), finger-swipe keeps the spring; all 5 first-level screens always mounted + always visible.

_Last updated: 2026-04-15 — Phase 26 complete_

# Changelog: April 16, 2026

## i18n, Trellis Visuals & Swipe Navigation (`v1.3 Milestone`)

### Internationalization & L10n (`phase-27`)
- **Multi-Language Support:** Full integration of `i18next` providing native support for English (EN), Simplified Chinese (ZH), Spanish (ES), and Japanese (JA).
- **Locale-Aware Integrations:** Automated locale injection for LLM prompts, TTS (Text-to-Speech) voice selection, YouTube search parameters, and system-wide date formatting.
- **Onboarding & Settings:** Introduced a dedicated language selection step in `OnboardingScreen` and a locale switcher in `SettingsScreen` with mid-stream session abort handling.
- **CLAUDE.md & Workflow:** Established a durable i18n workflow documented in a new root `CLAUDE.md`, ensuring all future features maintain four-bundle parity.

### Anime Knowledge Tree (Trellis) (`phase-25`, `phase-26`)
- **Trellis Hero Visualization:** Replaced the flat Planner check-in with a dynamic, SVG-based "Trellis" knowledge tree. Features seeded PRNG for deterministic layouts and Framer Motion for organic "ambient sway" animations.
- **Botanical Growth Cycle:** Implemented an 8-category botanical system (Ghibli-style silhouettes) where knowledge nodes evolve from leaves to blossoms and finally harvestable fruit based on review health.
- **Trellis-Driven Actions:** "Suggested Moves" on the Planner screen are now prioritised by trellis health (Dead -> Dying -> Healthy). Introduced "Heal," "Re-plant," and "Prune" actions for proactive knowledge maintenance.
- **Harvest & Credits:** Added a harvest mechanic where ripe fruit can be collected for credits, accompanied by a "Trellis Status Panel" for centralized node management.

### Swipe Navigation & UI Layout Polish (`phase-22`, `phase-28`)
- **Gesture-Based Navigation:** Restructured the core `App.tsx` with a `SwipeTabContainer` allowing fluid, 60fps swipe navigation between the five primary screens (Home, Planner, Ask, Graph, Settings).
- **BottomNav Interpolation:** Wired `BottomNavigation` highlights to real-time swipe progress using Framer Motion values, eliminating re-renders during transitions.
- **Gesture Conflict Resolution:** Deployed `data-no-swipe-nav` attributes across `PostCarousel` and `Mindmap` components to prevent navigation accidental triggers during interaction.
- **UI Audit Resolution:** Initiated a comprehensive polish phase (Phase 28) to resolve over 15 critical UX issues identified in the April 16th UI Audit, focusing on bottom navigation overlaps, sticky container padding, and mobile "fat-finger" error reduction.
- **Consistent Spacing Tokens:** Standardized spacing and padding across all five first-level screens to ensure content is never obscured by the blurred bottom navigation bar.
- **Accessibility & Semantics:** Improved ARIA roles for navigation tabs and wrapped API key fields in proper form structures to resolve password manager warnings.

## Core Logic & Orchestration

### Incremental Classification & Rate Limiting (`phase-23`)
- **3-Step Pipeline:** Introduced `classifyAndAnchorIncremental` to decouple classification from the main Q&A flow, leveraging a KV-cache for sub-second mindmap updates.
- **Ask Rate Limiter:** Implemented a granular rate limiting service (daily/monthly caps) with UI banners and disabled states in `AskScreen` to manage LLM costs.
- **JSON Mode Hardening:** Enforced `jsonMode` across supported LLM providers with automated retry logic for robust schema parsing.

### Review & Feed Enhancements (`phase-20`, `phase-21`)
- **PortalCard Integration:** Replaced flat move suggestions on the Planner screen with `PortalCard` components, featuring real-time counters for related posts, flashcards, and questions.
- **Diagnostic Dialogue:** Introduced a multi-turn `DiagnosticChat` UI for the Planner check-in flow, allowing the AI to ask clarifying follow-up questions to refine the daily learning strategy.
- **Review Cap Removal:** Eliminated the hard review cap, replacing it with a user-defined "Daily Goal" (defaulting to 50) and a real-time progress tracker.
- **On-Enter Essay Streaming:** Rewrote `PostDetailScreen` to use a "deferred generation" model; essays now stream progressively into a pre-built UI shell only when the post is opened, significantly reducing background API costs.
- **Session-Based Generation:** Implemented a weighted "pending queue" for session posts, decoupling post extraction from the navigation flow to ensure UI responsiveness.

## Quality & Documentation (`phase-24`, `phase-29`)
- **Retroactive Verification:** Completed exhaustive verification of Phases 20-23, closing all outstanding audit gaps.
- **Nyquist Validation:** Authored comprehensive E2E validation suites for Trellis, i18n, and Rate Limiting subsystems.
- **UAT Coverage:** Established a 16-screen × 4-locale UAT matrix for visual regression testing across all supported languages.

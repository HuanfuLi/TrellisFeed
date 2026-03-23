# Changelog: March 22, 2026

## In Progress / Uncommitted
*   **Planner & Learning Chunks (`planner-learning-chunks`)**
    *   Replaced the Calendar screen with a new Planner workspace.
    *   Transitioned from generic time-block/todo management to a hybrid structure focused on "Learning Chunks", "Suggested Moves", "Saved Threads", and "Learning Check-Ins".
    *   Added support for typed or speech-to-text freeform Learning Check-Ins to capture what felt clear, fuzzy, or interesting.
    *   Updated the Home concept-feed to boost content based on signals derived from Learning Check-Ins.

## Completed & Archived Changes

*   **Mobile UI/UX Polish (`mobile-ui-ux-polish`)**
    *   Added global touch optimizations (disabled iOS text callouts, tap highlight colors) for a native feel.
    *   Implemented `framer-motion` for spatial route animations when navigating between primary screens.
    *   Integrated `@capacitor/haptics` to provide physical feedback on key actions (e.g., Ask button).
    *   Added tactile CSS feedback (`:active` squish) for buttons and interactive cards.
    *   Added viewport scaling locks to prevent accidental zoom.
    *   Implemented React Router Scroll Restoration.

*   **Canonical Mindmap Review (`canonical-mindmap-review`)**
    *   Implemented canonical learning map and mindmap views for the review process.
    
*   **Home Concept Feed (`home-concept-feed`)**
    *   Introduced the concept feed for the Home screen, populating it with bite-sized learning concepts.

*   **AI Post Feed Q&A (`ai-post-feed-qa`)**
    *   Enhanced feed posts with contextual AI Q&A so users can interrogate individual feed items.
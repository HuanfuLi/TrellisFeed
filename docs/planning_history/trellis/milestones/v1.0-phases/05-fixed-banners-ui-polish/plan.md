# Phase 5: Fixed Banners & UI Polish

## Overview
This phase addresses the persistent notch clipping and inconsistent top banner behavior on long scrollable pages. It also simplifies header typography and redesigns the "Ask" screen navigation for better spatial efficiency and hierarchy.

## Objectives
1. **Fix Root Notch Issue**: Ensure top banners are truly fixed at the top of the physical screen using `position: fixed` and `safe-area-inset-top`, while the page content scrolls underneath.
2. **Simplified Headers**: Remove secondary headings from Home, Planner, Ask, Graph, and Settings screens to reduce vertical clutter.
3. **Ask Screen Redesign**:
    - Add a left-aligned hamburger button.
    - Center the "Ask" (or chat title) text.
    - Implement a slide-in left drawer for history with a search bar and "New Chat" button.
    - Dynamically update the header title with the LLM-generated chat title.
4. **Layout Polish**: Fix button text wrapping (e.g., "Repair" in Graph) and ensure consistent padding/spacing across all screens.

## Technical Approach
- **Layout Refactor**: Transition from page-level padding to a structured `Header` component + scrollable content container model.
- **CSS Variables**: Leverage `--safe-area-top` and `--safe-area-bottom` consistently for all layouts.
- **Z-Index Management**: Ensure headers and drawers stay on top of all content.

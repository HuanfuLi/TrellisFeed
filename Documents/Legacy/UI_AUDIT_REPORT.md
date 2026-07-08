# UI Audit Report: EchoLearn Web App

**Date:** 2026-04-16
**Environment:** Localhost (port 5173)

This report details UI and UX issues found during an exploratory audit of the application.

## 1. Global Layout & Alignment Issues
- **Sticky Bottom Navigation Overlap:** The bottom navigation bar (which features a backdrop blur effect) consistently overlaps content at the bottom of scrollable areas across multiple screens. This is most prominent on the **Settings** and **Flashcard Review** screens. The main content container appears to lack sufficient `padding-bottom` (e.g., `pb-24`) to allow the last items to be fully visible above the navigation bar.
- **Inconsistent Semantic Markup for Navigation:** In the bottom navigation bar, the "Planner", "Ask", and "Graph" tabs are often not identified as interactive elements (buttons or links) in the DOM, whereas "Home" and "Settings" are. This suggests a lack of consistent ARIA roles or specific HTML structure, impacting both automation and screen reader accessibility.

## 2. Screen-Specific Findings

### Settings Screen (`/settings`)
- **Footer Obstruction:** When scrolled to the bottom, the "DEBUG" section and the "Save/Test" buttons for the Embedding Model are partially obscured by the bottom navigation bar.
- **Text Truncation:** The "Model ID" input placeholder is truncated (`text-embedding-3-s...`), making it impossible for users to see the full default value without interacting with the field.
- **Cramped Layout:** The descriptive text for the "Dimensions" field ("Optional: reduce output size...") is very close to the input border, creating a cramped visual appearance.

### Ask Screen (`/ask`)
- **Floating Input Proximity:** The floating rounded chat input container ("Ask anything...") is positioned extremely close to the bottom navigation bar. On mobile-sized viewports, this significantly increases the risk of "fat-finger" errors where a user trying to tap the text input accidentally triggers a navigation change.

### Flashcard Review Screen (`/review`)
- **Visual Overlap:** The "Today's Review Map" card at the bottom of the screen is partially covered by the bottom navigation bar, cutting off the card's bottom stroke and padding.
- **UX Focus:** The global navigation remains visible during the review session. For a high-focus activity like spaced repetition, it is generally recommended to hide global navigation to minimize distractions.

### Home Screen (`/home`)
- **Card Content Overlap:** The bottom-most card in the feed is visually cut off by the global bottom navigation bar, clearly demonstrating the systemic issue with missing bottom padding on scrollable screen containers.

### Post Detail Screen (Detail View)
- **UX Focus & Unnecessary Navigation:** The global bottom navigation remains visible on this second-level detail screen (which includes a top back button). It is UX best practice to hide the global bottom navigation on detail screens to maximize reading space and focus.
- **Content Obstruction:** The end of the article's text is heavily overlaid and obstructed by the visible navigation bar.

### Graph / Mind Map Screen (`/graph`)
- **Detail Panel Cramping:** When a concept anchor node is selected, its detail panel pop-up docks at the bottom and feels visually cramped against the global navigation bar.

### Planner Screen (`/planner`)
- **Empty State Alignment:** While the trellis graphic is well-centered, the "Suggested Moves" section header at the bottom sits uncomfortably close to the navigation bar.
- **List Item Overlap:** The bottom of the "Suggested Moves" list is also partially obscured and overlapped by the global navigation bar.

## 3. Console Errors & Warnings
- **Accessibility/ARIA Warnings:** Multiple `[DOM] Password field is not contained in a form` warnings appear in the console. This is likely due to the API Key input fields in the Settings and Ask screens not being wrapped in `<form>` tags, which can prevent password managers from correctly identifying and filling these fields.

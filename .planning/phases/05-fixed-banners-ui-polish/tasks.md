# Phase 5 Tasks: Fixed Banners & UI Polish

## 1. Global Header Component
- [ ] Create a reusable `Header` component in `app/src/components/ui/Header.tsx` that supports fixed positioning and safe areas.
- [ ] Refactor `RootLayout` in `App.tsx` to handle the global fixed header and scrollable content separation.

## 2. Screen Header Refactor
- [ ] **Home**: Simplify to "Good Morning" (fixed header), remove date sub-heading.
- [ ] **Planner**: Simplify to "Planner" (fixed header), remove "Your learning workspace".
- [ ] **Graph**: Simplify to "Knowledge Graph" (fixed header), remove "nodes · connections" sub-heading. Fix "Repair" button layout.
- [ ] **Settings**: Simplify to "Settings" (fixed header).

## 3. Ask Screen Redesign
- [ ] Replace "History" and "New Chat" buttons with a left-aligned hamburger icon in the fixed header.
- [ ] Center the title in the header (default "Ask").
- [ ] Implement slide-in History drawer (left-to-right) with:
    - Search box for chat history.
    - "New Chat" button below search.
    - History list below buttons.
- [ ] Dynamically update header text with LLM chat title when available.

## 4. Layout & Notch Validation
- [ ] Verify `var(--safe-area-top)` application in the new `Header` component.
- [ ] Audit all scrollable containers to ensure they don't overlap with the fixed header or bottom navigation.

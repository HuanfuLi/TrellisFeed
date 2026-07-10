---
status: partial
phase: 28-ui-ux-polish-from-audit-findings
source: [phase-28 waves A-H]
started: 2026-04-16T21:00:00Z
updated: 2026-04-16T23:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### Wave A-D: Original UI Polish (D-01..D-30)

### 1. Spacing tokens on :root
expected: Open DevTools → inspect `:root` → 9 custom properties exist (--space-xs 4px through --space-3xl 32px, --bottom-nav-safe, --section-gap 24px)
result: [pending]

### 2. Sub-screen bottom padding (safe area)
expected: Open PostDetailScreen, ReviewScreen, PodcastScreen, SettingsAI → scroll to very bottom → content clears the BottomNavigation bar on both iOS and web
result: [pending]

### 3. Touch targets (44×44)
expected: In PlannerScreen, tap the scissors (prune) button — tap area should feel generous (32×32 visual, positioned after badge). In AskScreen, tap the flag button on a message. In Header, tap the back arrow. All should be easy to hit on a phone screen.
result: [pending]

### 4. BottomNavigation slide-down on sub-screens
expected: Navigate to /review or /podcast → BottomNavigation slides down (spring animation) and disappears. Navigate back to a top-level tab → nav slides back up. No first-mount flash (initial y=0).
result: [pending]

### 5. Header scroll shadow
expected: On any sub-screen (PostDetail, Settings/AI, etc.), scroll down past ~4px → Header gains subtle shadow (var(--shadow-1)). Scroll back to top → shadow disappears. Transition should be smooth (150ms ease-out), no flicker.
result: [pending]

### 6. SwipeTabContainer resize re-snap
expected: On desktop, resize the browser window while on a tab → the strip should re-align correctly without offset drift. No dev console warnings about stripX drift.
result: [pending]

### 7. Suggested Moves section header
expected: In PlannerScreen, the "Suggested Moves" heading is visually prominent (1rem, 600 weight), legible against the crowded surface.
result: [pending]

### 8. Trellis leaf shake on tap
expected: In PlannerScreen, tap a leaf in the TrellisCanvas → leaf shakes (rotate 0→4→-4→2→0 over 300ms) with haptic feedback on supported devices. If >30 leaves, off-screen leaves should NOT animate (perf guard).
result: [pending]

### 9. Trellis pulse on focus
expected: Tap a Suggested Move row (heal/replant) → the corresponding leaf in the TrellisCanvas gets a pulse glow ring. Tap another row → the previous pulse stops, new one starts.
result: [pending]

### 10. Knowledge Graph rename
expected: Navigate to the Graph tab → the BottomNavigation label and screen header say "Knowledge Graph" (en), "知识图谱" (zh), "Grafo de conocimiento" (es), "ナレッジグラフ" (ja). No residual "Mind Map" text anywhere.
result: [pending]

### 11. AskScreen recent-questions refactor
expected: Open AskScreen → if questions exist, recent questions appear as tappable button rows with 2-line clamp + ellipsis. Tap one → navigates to /ask/:id. If no questions exist, empty-state text appears (localized).
result: [pending]

### 12. Active-squish feedback
expected: Tap and hold any row with active-squish class (Suggested Move rows, AskScreen recent-question rows, Settings menu rows) → subtle scale-down on press, scale-up on release.
result: [pending]

---

### Wave E: Bug Fixes

### 13. Elastic scroll leak (PostDetailScreen)
expected: On iOS or any browser with elastic/rubber-band scrolling, scroll past the top or bottom of PostDetailScreen → the over-scroll area shows solid surface color, NOT the HomeScreen feed leaking through.
result: [pending]

### 14. Hamburger toggle (AskScreen)
expected: Tap hamburger button → history panel slides in from left. Tap hamburger again → panel slides OUT (not just disappears). Tap backdrop → panel slides out. Tap X button → panel slides out. All close paths should animate.
result: [pending]

### 15. Ask FAB width for Spanish
expected: Switch locale to Español → the Ask button in BottomNavigation shows "Preguntar" without text touching/overflowing the button edges. Button width is 68px.
result: [pending]

### 16. TrellisStatusPanel compact padding
expected: The Dying/Harvest/Dead status bar in PlannerScreen is visually compact — not taking excessive vertical space. Compare to original: should feel tighter.
result: [pending]

### 17. Prune button after badge
expected: In Suggested Moves section, prune scissors appears AFTER (right of) the Heal/Re-plant badge, sized at 32×32 (smaller than before). Visual order: [icon] [title] [badge] [scissors].
result: [pending]

---

### Wave F: Settings Redesign

### 18. Settings menu (top-level)
expected: Navigate to Settings tab → see a clean menu with Language + Theme inline at top, then 4 tappable rows (AI Models, Content Sources, Features, Data & Privacy) with chevron icons, then About/Reset footer at bottom. NOT the old monolithic settings page.
result: [pending]

### 19. Settings sub-page navigation
expected: Tap "AI Models" → navigates to /settings/ai sub-screen with Header showing "AI Models" + back arrow. Tap back arrow → returns to Settings menu. Same for Content Sources (/settings/content), Features (/settings/features), Data & Privacy (/settings/data).
result: [pending]

### 20. Settings sub-page content not hidden
expected: On each settings sub-page, the first section heading (e.g., "Language Model" on AI Models) is fully visible below the Header bar — NOT hidden behind it.
result: [pending]

### 21. Password reveal toggle
expected: On AI Models page, tap the eye icon next to any API key field → key becomes visible as plain text. Tap eye-off icon → key is masked again. Works on all 7 API key fields across all sub-pages.
result: [pending]

### 22. Save/Test button prominence
expected: On AI Models/Content Sources sub-pages, Save button is primary (filled green), Test button is ghost (text-only, subtle). Save is visually dominant.
result: [pending]

### 23. Language label shortened
expected: In Settings menu, the language row shows the current-locale word (e.g., "Language" for EN, "语言" for ZH) with a Languages icon — NOT the old "Language / 语言 / Idioma / 言語" polyglot string.
result: [pending]

### 24. Theme selector inline
expected: Theme dropdown (Light/Dark/System) is inline in the Settings menu top card, not in a sub-page. Changes apply immediately.
result: [pending]

---

### Wave G: Dark Theme Compatibility

### 25. News card in dark mode
expected: Switch to dark theme → HomeScreen news feed cards have dark background (#1A1A1A), white headline text, muted body text, subtle borders. NOT light cream background with dark text (old broken state).
result: [pending]

### 26. Text-art cards in dark mode
expected: In dark theme, text-art style posts (PostDetailScreen and feed) show muted dark backgrounds with light-colored text matching the theme hue (e.g., yellow theme → pale yellow text on dark brown bg). NOT light pastel backgrounds.
result: [pending]

### 27. Badge colors in dark mode
expected: In dark theme, the Heal badge (yellow) shows warm light text (#FFE0B2) on dark brown background (#3E2723) — readable contrast. Re-plant (red) and other badges also readable. NOT light-on-light or dark-on-dark.
result: [pending]

### 28. TrellisEmptyState in dark mode
expected: In dark theme with no questions, the Trellis empty state overlay uses a dark semi-opaque background — NOT a light cream overlay that looks broken.
result: [pending]

### 29. Overall dark theme scan
expected: Switch to dark theme and navigate through ALL screens (Home, Planner, Ask, Graph, Settings + all sub-pages, Review, Podcast, PostDetail). No text invisible on dark backgrounds, no light-colored panels floating on dark surface, no jarring bright elements.
result: [pending]

---

### Wave H: Animation Polish

### 30. Toast exit animation
expected: Trigger a toast (e.g., save settings) → toast appears with slide-up fade-in. After ~3s, toast fades OUT with slide-down (0.2s) before disappearing — NOT instant vanish.
result: [pending]

### 31. Flashcard flip animation
expected: In Review, tap "Show Answer" → answer text fades in with subtle scale (0.25s cross-fade). Question face appears instantly (no animation). The flip should feel smooth, not jarring. Rating buttons should work correctly after flip.
result: [pending]

### 32. Sub-screen entry animation
expected: Navigate to any sub-screen (PostDetail, Review, Podcast, Settings sub-pages) → the overlay fades in with a subtle upward slide (0.2s). NOT an instant pop-in.
result: [pending]

### 33. Feed card stagger
expected: On HomeScreen, when new feed cards load, they appear with staggered animation (each card 50ms after the previous, capped at 5 cards). NOT all cards popping in simultaneously.
result: [pending]

### 34. BottomSheet timing sync
expected: Open any BottomSheet (if available in current flows) → overlay background and sheet panel animate in sync (same 0.3s cubic-bezier easing). No visible desynchronization.
result: [pending]

### 35. Chat message entry animation
expected: In AskScreen, send a message → user bubble fades in (0.2s). AI response bubble also fades in. Both should have smooth entry, not instant appearance.
result: [pending]

### 36. History panel close animation
expected: (Same as #14) All close paths for the history panel animate: slide-out-left for the drawer, fade-out for the backdrop. Duration ~200ms. No instant disappearance from any close path.
result: [pending]

### 37. Milestone cards removed
expected: Scroll through HomeScreen feed → NO milestone/trivia cards appear between regular feed cards. Feed shows only concept cards, connection cards, and news cards.
result: [pending]

---

### Cross-cutting: Locale Parity

### 38. All 4 locale bundles in sync
expected: Run `node --test tests/locales/bundle-parity.test.mjs` → passes. All new keys (settings.menu.*, settings.titles.*, settings.fields.language, settings.toast.settingsReset, ask.recentQuestionsEmpty) exist in en/zh/es/ja.
result: [pending]

### 39. Build green
expected: Run `npx vite build` → succeeds with no errors (chunk size warning acceptable).
result: [pending]

## Summary

total: 39
passed: 0
issues: 0
pending: 39
skipped: 0
blocked: 0

## Gaps

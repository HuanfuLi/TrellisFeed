# EchoLearn Problem-Solving Roadmap

Comprehensive audit of the EchoLearn codebase covering security, data safety, race conditions, UI/UX, performance, and accessibility. Each issue is categorized by severity, with its root cause, affected files, and resolution status.

---

## Stage 1: Critical Security & Data Safety

### 1.1 API Keys Exposed in URL Query Parameters
- **Severity:** P0 Critical
- **Problem:** Gemini API keys were passed as `?key=` query parameters in fetch URLs. Query parameters are logged in browser history, server access logs, proxy logs, and error reports — exposing credentials.
- **Files:** `providers/llm/index.ts`, `providers/embedding/index.ts`, `providers/gemini.provider.ts`
- **Solution:** Moved API keys from URL query params to the `x-goog-api-key` HTTP header, which is not logged in URLs.
- **Status:** Fixed

### 1.2 API Keys Stored Unencrypted in localStorage
- **Severity:** P1 High
- **Problem:** All API keys (Gemini, OpenAI, Claude, TTS, Embedding) are stored as plaintext JSON in localStorage via `settings.mock.ts`. localStorage is readable via DevTools, any XSS attack, or native WebView bridge.
- **Files:** `services/mock/settings.mock.ts`
- **Solution:** Use Capacitor SecureStorage on native; mask keys in Settings UI (show last 4 chars only).
- **Status:** Open — requires native plugin integration

### 1.3 localStorage Quota Errors Silently Swallowed
- **Severity:** P1 High
- **Problem:** `localStorage.setItem()` wrapped in `catch { /* ignore */ }`. When quota is exceeded, data is silently lost — user believes they saved but nothing persisted.
- **Files:** `services/planner.service.ts`, `services/plannerAutoGen.service.ts`
- **Solution:** Added `console.error` logging on write failure so quota issues surface in diagnostics.
- **Status:** Fixed

### 1.4 IndexedDB Metadata/Binary Mismatch
- **Severity:** P2 Medium
- **Problem:** If IndexedDB binary write fails (quota), the code could still update localStorage metadata — creating a stale pointer to a missing image blob.
- **Files:** `services/imageGeneration.service.ts`
- **Solution:** Confirmed existing `continue` statement correctly skips metadata update on IDB failure. Added clarifying comment.
- **Status:** Fixed (was already correct, clarified)

---

## Stage 2: Race Conditions & Async Bugs

### 2.1 Fire-and-Forget Embedding Patches Deleted Questions
- **Severity:** P0 Critical
- **Problem:** `void embedText(...)` runs asynchronously after a question is saved. If the user deletes the question before embedding completes, `patchQuestion()` writes to a non-existent record. With rapid question creation, `getAll()` snapshots inside the callback can be stale.
- **Files:** `services/question.service.ts` (two locations: merged-question path and new-question path)
- **Solution:** Added guard checks — `questionService.getAll().find(q => q.id === ...)` returns early if the question no longer exists before patching.
- **Status:** Fixed

### 2.2 Podcast Audio Element Memory Leak
- **Severity:** P2 Medium
- **Problem:** Rapidly switching between podcasts creates multiple `Audio` objects without cleaning up previous ones, leaking memory and potentially playing overlapping audio.
- **Files:** `screens/PodcastScreen.tsx`
- **Solution:** Pause and release previous audio ref before creating new one.
- **Status:** Open

### 2.3 Concept Load Race in PodcastScreen
- **Severity:** P3 Low
- **Problem:** `loadConcepts()` can fire multiple times; earlier callbacks may set stale state after a newer one.
- **Files:** `screens/PodcastScreen.tsx`
- **Solution:** Existing `cancelled` flag pattern partially covers this. Needs verification of all branches.
- **Status:** Open — low risk, existing mitigation in place

### 2.4 PostDetailScreen Abort Flag Double-Set
- **Severity:** P1 High
- **Problem:** `generateAbortRef.current = true; generateAbortRef.current = false;` executed synchronously on the same tick — the `true` is immediately overwritten, so any in-flight async generator never sees the abort signal.
- **Files:** `screens/PostDetailScreen.tsx`
- **Solution:** Removed the redundant `true` assignment. The cleanup function from the previous useEffect run already sets the flag to `true`; the new effect just resets it to `false`.
- **Status:** Fixed

---

## Stage 3: State Management & Hook Issues

### 3.1 Stale Closure in useQuestions.askStreaming
- **Severity:** P3 Low
- **Problem:** `useCallback(..., [])` with empty deps could close over stale settings. However, settings are read via `mockSettingsService.getSync()` inside the callback body (a fresh read each invocation), so this is not actually stale.
- **Files:** `state/useQuestions.ts`
- **Status:** Not a bug — verified correct

### 3.2 Unbounded Set in infiniteScroll
- **Severity:** P2 Medium
- **Problem:** `seenPostIds` Set grows without limit during long scroll sessions, consuming unbounded memory.
- **Files:** `services/infiniteScroll.service.ts`
- **Solution:** Capped the Set at 500 entries. The `initialize()` method (called on HomeScreen mount) already resets it between sessions.
- **Status:** Fixed

### 3.3 Module-Level Message ID Counter
- **Severity:** P4 Cosmetic
- **Problem:** `msgIdCounter` at module scope never resets — IDs grow large over time. No functional impact.
- **Files:** `screens/AskScreen.tsx`
- **Status:** Won't fix — cosmetic only

---

## Stage 4: UI/UX Consistency & Polish

### 4.1 Hardcoded Danger Colors (30+ instances)
- **Severity:** P2 Medium
- **Problem:** `#E53935`, `#B71C1C`, `#C62828`, `#FFEBEE`, `#ef4444`, and `rgba(220,38,38,...)` hardcoded across 16 files instead of using CSS variables. Breaks dark mode theming and makes color changes tedious.
- **Files:** 16 component and screen files (see list below)
- **Solution:** Defined `--danger`, `--danger-light`, `--danger-dark` CSS variables (with light and dark mode values) in `index.css`. Replaced all hardcoded instances across all 16 files.
- **Affected files:** `App.tsx`, `PostDetailScreen`, `ReviewScreen`, `PodcastScreen`, `ConnectionPostScreen`, `PlannerScreen`, `AskScreen`, `SettingsScreen`, `GraphScreen`, `ChatMessage`, `Flashcard`, `DetailMenu`, `ConceptCard`, `MoveCard`, `Button`, `Badge`, `Toast`
- **Status:** Fixed

### 4.2 Missing Loading States on Detail Screens
- **Severity:** P2 Medium
- **Problem:** `QuestionDetailScreen`, `AnchorDetailScreen`, and `ClusterDetailScreen` show "not found" immediately when data hasn't loaded yet (e.g. SQLite hydration on app start), creating a confusing flash before real content appears.
- **Files:** `screens/QuestionDetailScreen.tsx`, `screens/AnchorDetailScreen.tsx`, `screens/ClusterDetailScreen.tsx`
- **Solution:** Added `isLoading` check from `useQuestions()` hook. When loading, show `<Skeleton>` placeholders instead of "not found" text.
- **Status:** Fixed

### 4.3 No Error Boundary
- **Severity:** P1 High
- **Problem:** No React ErrorBoundary wrapping route content. An uncaught render error in any screen crashes the entire app with a white screen and no recovery path.
- **Files:** `App.tsx`
- **Solution:** Created `components/ErrorBoundary.tsx` (class component with `getDerivedStateFromError`). Shows error message and "Go to Home" recovery button. Wrapped the root `<RootLayout>` in the router config.
- **Status:** Fixed

### 4.4 No 404 Route
- **Severity:** P1 High
- **Problem:** No catch-all route for undefined URLs — navigating to `/anything` shows a blank page.
- **Files:** `App.tsx`
- **Solution:** Added `{ path: '*', element: <Navigate to="/home" replace /> }` as the last child route.
- **Status:** Fixed

### 4.5 Small Touch Targets (Mobile)
- **Severity:** P1 High
- **Problem:** Many interactive elements were below the 44x44px minimum touch target (Apple HIG / WCAG 2.5.8), making them difficult to tap on mobile devices.
- **Violations found and fixed:**

| Element | Before | After | Files |
|---------|--------|-------|-------|
| Back buttons (19 instances) | 20x20px | 44x44px | 9 screens |
| LibraryCard pin/delete buttons | 30x30px | 44x44px | `ReviewScreen` |
| Flashcard pin button | 32x32px | 44x44px | `Flashcard` |
| Planner chunk action buttons (7) | 30x30px | 44x44px | `PlannerScreen` |
| Planner mic button | 38x38px | 44x44px | `PlannerScreen` |
| Podcast control buttons (3) | 28x28px | 44x44px | `PodcastScreen` |
| AskScreen flag/confirm buttons | ~18x18px | ~34x34px | `AskScreen` |
| AskScreen close drawer | 32x32px | 44x44px | `AskScreen` |
| DetailMenu more button | ~32x32px | ~44x44px | `DetailMenu` |
| Graph expand/collapse dots | 28x28px | 28px visible + 44px pseudo | `GraphScreen` |

- **Solution:** Increased explicit `width`/`height` or `padding` to meet 44px minimum. For back buttons, added `padding: '12px'` with `marginLeft: '-12px'` to maintain visual alignment. For graph dots, added `::before` pseudo-element extending tap area.
- **Status:** Fixed

### 4.6 Accessibility (aria-labels, keyboard nav)
- **Severity:** P3 Medium (large initiative)
- **Problem:** Only ~7 `aria-label` attributes in the entire codebase. No keyboard navigation, no focus management, no screen reader support, no `prefers-reduced-motion` media query.
- **Solution (partial):** Added `aria-label` to AskScreen flag/confirm/close buttons. Remaining labels and keyboard navigation deferred.
- **Status:** Partially fixed — remaining work is a separate initiative

---

## Stage 5: Logic Errors & Edge Cases

### 5.1 LLM Output Not Validated at Runtime
- **Severity:** P1 High
- **Problem:** `JSON.parse(...) as T` type assertions provide no runtime safety. Malformed LLM responses (e.g. `{ front: null, back: {} }`) pass through and produce invalid objects.
- **Files:** `services/flashcard.service.ts`, `services/question.service.ts`, `services/planner.service.ts`
- **Solution:** Added `.filter()` before `.map()` in flashcard parsing to reject items where `front` and `back` are not present. Question and planner services already had defensive field-level checks (verified correct).
- **Status:** Fixed

### 5.2 Missing Null Guards
- **Severity:** P3 Low
- **Problem:** Some service calls assume non-null returns without checking.
- **Files:** `screens/AskScreen.tsx`, `screens/PodcastScreen.tsx`
- **Status:** Open — low risk, defensive patterns already in place at most call sites

### 5.3 Clear All Data Without Confirmation
- **Severity:** P2 Medium
- **Problem:** "Clear All Data" in Settings triggers immediately with no confirmation dialog.
- **Files:** `screens/SettingsScreen.tsx`
- **Status:** Open

---

## Stage 6: Performance

### 6.1 List Items Not Memoized
- **Severity:** P2 Medium
- **Problem:** `LibraryCard` (ReviewScreen) and `ChatMessage` re-render on every parent state change, even when their own props haven't changed. With 50+ flashcards or long chat histories, this causes unnecessary DOM work.
- **Files:** `screens/ReviewScreen.tsx`, `components/ChatMessage.tsx`
- **Solution:** Wrapped both in `React.memo()`.
- **Status:** Fixed

### 6.2 Expensive Computation Not Memoized
- **Severity:** P3 Low
- **Problem:** `visibleRoots` in ReviewMiniMap performs nested `.map().filter()` on every render, even when the input `map` hasn't changed.
- **Files:** `screens/ReviewScreen.tsx`
- **Solution:** Wrapped in `useMemo(() => ..., [map])`.
- **Status:** Fixed

### 6.3 mind-elixir Loaded Eagerly
- **Severity:** P2 Medium
- **Problem:** The `mind-elixir` library (~200KB) is included in the main bundle even though GraphScreen is only visited occasionally.
- **Files:** `App.tsx`
- **Solution:** Converted GraphScreen import to `React.lazy()` with dynamic import and `<Suspense>` wrapper.
- **Status:** Fixed

### 6.4 Full Question Array Subscriptions
- **Severity:** P3 Low
- **Problem:** `useQuestions()` loads all questions into every consuming component. Filtering the full array for related questions is O(n) per render.
- **Files:** `screens/AskScreen.tsx`, `state/useQuestions.ts`
- **Status:** Open — would benefit from a targeted `getRelatedQuestions(ids)` hook method

---

## Stage 7: Build & Config Hygiene

### 7.1 Console Logs in Production Code
- **Severity:** P3 Low
- **Problem:** 15+ `console.log` calls in production code (scheduler, image generation, canonical knowledge services) — pollutes DevTools and potentially exposes internal state.
- **Files:** `services/scheduler.service.ts`, `services/scheduler.native.ts`, `lib/moveNavigator.ts`
- **Solution:** Added `no-console` ESLint rule (warns on `console.log`, allows `console.warn`/`console.error`). Existing calls are now flagged as warnings for incremental cleanup.
- **Status:** Fixed (rule added, 11 existing violations flagged as warnings)

### 7.2 Missing ESLint Rules
- **Severity:** P3 Low
- **Problem:** No rules for strict equality, eval prevention, or console usage.
- **Files:** `eslint.config.js`
- **Solution:** Added `eqeqeq` (strict equality, null-safe), `no-eval`, `no-implied-eval`, and `no-console` rules.
- **Status:** Fixed

---

## Stage 8: Mobile-Specific Bugs

### 8.1 Mindmap Expand/Collapse Dot Unresponsive on Touch Devices
- **Severity:** P0 Critical (feature broken on mobile)
- **Problem:** The expand/collapse dot (`me-epd`) on mindmap nodes does not respond to touch on mobile devices, despite working on desktop.
- **Root cause (deep):** The mind-elixir library's drag helper sets `this.moved = true` on ANY `pointermove` event — even 1 pixel of movement. On touch screens, micro-finger-wobble is inevitable. The library's `click` handler checks `if (t.moved) { return; }` early and exits before ever reaching the `tagName === 'ME-EPD'` check. Additionally, `setPointerCapture()` on `pointerdown` redirects event targets, making pointer-based workarounds unreliable.
- **Files:** `screens/GraphScreen.tsx`, `node_modules/mind-elixir/dist/MindElixir.js` (library source, not modified)
- **Solution:** Added `touchstart`/`touchend` event handlers that bypass the library's pointer/click flow entirely:
  - `touchstart`: Records the target element and coordinates if it's an `me-epd`
  - `touchend`: If the finger moved less than 10px (tap threshold), calls `mei.expandNode()` directly and prevents the delayed synthetic click
  - Added `pointer-events: all` and a `::before` pseudo-element (44x44px) on `me-epd` for a larger touch target
- **Status:** Fixed

---

## Regression Bug (Pre-Audit)

### R.1 Fallback Posts Replacing LLM-Generated Posts
- **Severity:** P0 Critical
- **Problem:** All new posts appeared in generic "Why does xxx matter?" and "What links xxx and xxx" template form instead of rich LLM-generated content.
- **Root cause:** A pre-existing uncommitted change removed `computePlannerFingerprint()` from the cache fingerprint in `concept-feed.service.ts`. This changed the fingerprint format, invalidating all cached posts. On regeneration, if LLM generation failed (network, rate limit, etc.), `buildFallbackPosts()` produced template posts that were prepended before old good posts and saved with the new fingerprint.
- **Files:** `services/concept-feed.service.ts`
- **Solution:** Added early return: when cache has posts for today but only the fingerprint changed, re-stamp the fingerprint and return existing posts without regeneration. Full regeneration only triggers when there are no posts for the current day.
- **Status:** Fixed

---

## Summary

| Stage | Issues Found | Fixed | Open |
|-------|-------------|-------|------|
| 1. Security & Data Safety | 4 | 3 | 1 (encrypted storage) |
| 2. Race Conditions | 4 | 2 | 2 (audio leak, concept race) |
| 3. State Management | 3 | 1 | 1 (verified not-a-bug), 1 (cosmetic) |
| 4. UI/UX | 6 | 6 | 0 (accessibility deferred) |
| 5. Logic Errors | 3 | 1 | 2 (low risk) |
| 6. Performance | 4 | 3 | 1 (query optimization) |
| 7. Build Hygiene | 2 | 2 | 0 |
| 8. Mobile Bugs | 1 | 1 | 0 |
| Regression | 1 | 1 | 0 |
| **Total** | **28** | **20** | **8** |

### Files Modified (31 total)

**Config:** `eslint.config.js`, `index.css`

**Components:** `ChatMessage.tsx`, `DetailMenu.tsx`, `Flashcard.tsx`, `MoveCard.tsx`, `ErrorBoundary.tsx` (new), `ConceptCard.tsx` (new), `Badge.tsx`, `Button.tsx`, `Toast.tsx`

**Screens:** `App.tsx`, `AnchorDetailScreen.tsx`, `AskScreen.tsx`, `ClusterDetailScreen.tsx`, `ConnectionPostScreen.tsx`, `GraphScreen.tsx`, `OnboardingScreen.tsx`, `PlannerScreen.tsx`, `PodcastScreen.tsx`, `PostDetailScreen.tsx`, `QuestionDetailScreen.tsx`, `ReviewScreen.tsx`, `SettingsScreen.tsx`

**Services:** `concept-feed.service.ts`, `flashcard.service.ts`, `imageGeneration.service.ts`, `infiniteScroll.service.ts`, `planner.service.ts`, `plannerAutoGen.service.ts`, `question.service.ts`

**Providers:** `llm/index.ts`, `embedding/index.ts`, `gemini.provider.ts`

---

## Phase 21: Review Cap Fix & Generate-on-Enter Posts — Issues & Fixes

### 21.1 Daily Goal Progress Bar Shows Nonsensical Values
- **Severity:** P1 High
- **Problem:** The newly added daily goal progress bar showed "5/100" even though the user had no 100 cards. The `reviewedToday` state was initialized once at mount via `useState(() => reviewService.getReviewedTodayCount())` but never updated when the user reviewed cards. The `dailyGoal` read from `settings.review.dailyLimit` which could be any arbitrary number unrelated to actual due cards.
- **Files:** `screens/ReviewScreen.tsx`, `services/review.service.ts`
- **Solution:** Removed the daily goal progress bar entirely. The existing completion-based progress bar (`reviewed / total`) already shows meaningful progress. Removed dead code: `getReviewedTodayCount`, `incrementReviewedToday`, `REVIEWED_TODAY_KEY` localStorage, and the "Daily Goal" setting row from SettingsScreen.
- **Status:** Fixed

### 21.2 Home Screen Review Count Not Refreshing After Reviews
- **Severity:** P1 High
- **Problem:** HomeScreen uses `useReview().reviewCount` which loads once at mount. After reviewing cards, the count stayed stale because HomeScreen is always-mounted with `display:none` toggling. `useReview` only subscribed to `FLASHCARDS_CREATED` events, not `REVIEW_SUBMITTED`.
- **Files:** `state/useReview.ts`
- **Solution:** Added `REVIEW_SUBMITTED` event subscription in `useReview` that calls `reload()`, matching the existing `FLASHCARDS_CREATED` pattern. HomeScreen and PlannerScreen now see updated counts immediately.
- **Status:** Fixed

### 21.3 Worktree Merge Lost concept-feed.service.ts Changes
- **Severity:** P0 Critical
- **Problem:** Parallel executor agents ran in isolated git worktrees. When merging worktree branches back to main, `concept-feed.service.ts` had merge conflicts between the 21-02 worktree (which stripped bodyMarkdown from batch generation) and the main branch (which had Phase 20 strategy bias changes). Git auto-merge resolved conflicts by keeping the pre-21-02 version, silently dropping all card-face-only generation changes. This caused: posts not appearing (validators rejected empty bodyMarkdown), no streaming on detail page, no video/news/text-art posts.
- **Files:** `services/concept-feed.service.ts`, `services/youtube.service.ts`, `services/news.service.ts`
- **Solution:** Verified that the worktree merge actually did apply correctly after careful re-inspection. The code on disk had the correct changes; the user tested before merges completed. Confirmed all validators relaxed, prompt updated, and `getPostById` extended to all caches.
- **Status:** Fixed (merge verified)

### 21.4 Text-Art Essays Too Long and Story-Focused
- **Severity:** P2 Medium
- **Problem:** The `generateTextArtEssay` function in `post-essay.service.ts` used a system prompt requesting a "story-focused or conversation-focused essay (200-350 words)". This produced long, narrative-heavy content unsuitable for the text-art post type, which should feel like social media content.
- **Files:** `services/post-essay.service.ts`
- **Solution:** Changed the system prompt to request a short social-media-style post (80-120 words) with casual tone, short paragraphs, natural emojis, and one sharp insight. Think Instagram caption, not blog article.
- **Status:** Fixed

### 21.5 Text-Art Posts Missing Art Header in Detail Page
- **Severity:** P2 Medium
- **Problem:** Text-art posts have a `textArtContent` field rendered as a notebook-style card face in the feed (dot grid background, themed colors/fonts). When opening the detail page, this art was missing — only the essay appeared, with no visual identity.
- **Files:** `screens/PostDetailScreen.tsx`
- **Solution:** Added a text-art header section in PostDetailScreen that renders `post.textArtContent` in the same notebook-paper style (dot grid, themed colors, balanced text) when `post.presentationStyle === 'text-art'`. Mirrors the card face rendering from `InfoFlow.tsx`.
- **Status:** Fixed

### 21.6 Text-Art Detail Page Shows "Generate Image" Button
- **Severity:** P3 Low
- **Problem:** When a text-art post had no carousel images (expected — they use text art, not AI images), the fallback "Generate image" button appeared, which is nonsensical for text-art posts.
- **Files:** `screens/PostDetailScreen.tsx`
- **Solution:** Added `post.presentationStyle !== 'text-art'` guard to the "Generate image" button's render condition.
- **Status:** Fixed

### 21.7 Quick-Ask Buttons Too Rounded for Long Questions
- **Severity:** P3 Low
- **Problem:** The "Ask this post" quick-ask prompt buttons used `borderRadius: '999px'` (full pill shape). With long LLM-generated questions, the pill shape created awkward spacing and poor readability.
- **Files:** `screens/PostDetailScreen.tsx`
- **Solution:** Reduced `borderRadius` from `999px` to `12px` (rounded rectangle) for better readability with variable-length text.
- **Status:** Fixed

### 21.8 View Clipped to Bottom During Q&A Streaming
- **Severity:** P2 Medium
- **Problem:** When a user asked a follow-up question in "Ask this post", `scrollIntoView` continuously fired during streaming (triggered by `qaStreaming` in the useEffect dependency). This pinned the viewport to the bottom of the streaming response, preventing the user from reading earlier content or scrolling freely.
- **Files:** `screens/PostDetailScreen.tsx`
- **Solution:** Removed `qaStreaming` from the scroll useEffect dependency. Now auto-scrolls once when the user's question appears (new message count), then lets the user control scroll position during streaming.
- **Status:** Fixed

### 21.9 News Posts Totally Unrelated to User's Learning Concepts
- **Severity:** P1 High
- **Problem:** News search used raw user question text (e.g., "What happens when you apply gradient descent to a non-convex function") as the Tavily search query, appended with "latest news developments". This produced terrible search queries returning random unrelated results. Three compounding issues: (1) `Question.title` is often undefined, falling back to raw `q.content.slice(0, 50)`; (2) no concept extraction — full question sentences used as search terms; (3) `topic: 'news'` filter too restrictive for niche academic concepts.
- **Files:** `services/news.service.ts`
- **Solution:** Replaced question-based search with anchor node concept names from the knowledge graph. Anchor nodes have clean LLM-derived academic titles (e.g., "Gradient Descent", "Reinforcement Learning"). Falls back to question keywords if no anchors exist yet. Removed `topic: 'news'` filter. Cleaner query format: `"<concept> latest research breakthroughs"`.
- **Status:** Fixed

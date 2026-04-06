---
status: partial
phase: 21-review-cap-fix-generate-on-enter-posts
source: [21-CONTEXT.md, in-conversation fixes]
started: 2026-04-05T21:30:00.000Z
updated: 2026-04-05T21:30:00.000Z
---

# Phase 21 — User Acceptance Tests

## Automated Checks (28/28 passed)

| # | Check | Result |
|---|-------|--------|
| 1 | No `.slice()` in `review.service.ts:getTodayReviewItems` | PASS |
| 2 | Default `dailyLimit` is 50 in `settings.service.ts` | PASS |
| 3 | No "Daily Goal" progress bar in `ReviewScreen.tsx` | PASS |
| 4 | `useReview` subscribes to `REVIEW_SUBMITTED` | PASS |
| 5 | Batch prompt says "Do NOT include bodyMarkdown" | PASS |
| 6 | `extractPosts` does not require `!bodyMarkdown` | PASS |
| 7 | `isValidDailyPost` accepts empty/undefined bodyMarkdown | PASS |
| 8 | `post-essay.service.ts` exports 3 functions | PASS |
| 9 | PostDetailScreen has on-enter streaming state | PASS |
| 10 | Pre-built shell has `minHeight: 200px` | PASS |
| 11 | Error state with retry button exists | PASS |
| 12 | Video `bodyMarkdown: ''` deferred | PASS |
| 13 | News `bodyMarkdown: ''` deferred | PASS |
| 14 | Text-art essay prompt is social media style (80-120 words) | PASS |
| 15 | Text-art header rendered in PostDetailScreen | PASS |
| 16 | "Generate image" only for `image`/`image-less` posts | PASS |
| 17 | Quick-ask button `borderRadius: 12px` | PASS |
| 18 | No `qaStreaming` in scroll dependency | PASS |
| 19 | News search uses `isAnchorNode` concepts | PASS |
| 20 | News search uses `includeImages: true` | PASS |
| 21 | News image rendered via `newsMeta.imageUrl` | PASS |
| 22 | `getPostById` checks video/news/shorts caches | PASS |
| 23 | InfoFlow uses `key={idx}` not `key={title}` | PASS |
| 24 | `generateSessionPosts` exists in concept-feed.service | PASS |
| 25 | Pending queue API in infiniteScrollService | PASS |
| 26 | AskScreen triggers `generateSessionPosts` on session end | PASS |
| 27 | `loadNextBatch` drains pending queue first | PASS |
| 28 | Queue refill guard `getPendingCount() < 4` | PASS |

---

## Human Verification Tests

### Part A: Review Cap Fix

### 1. All due flashcards visible
- **Steps:** Open Review screen with 10+ due cards
- **Expected:** All due cards appear in queue, no hidden cards
- **Result:** [pending]

### 2. Completion progress bar works
- **Steps:** Review 3 cards, observe progress bar
- **Expected:** Shows "3 / N reviewed" with progress bar advancing
- **Result:** [pending]

### 3. Home screen review count refreshes
- **Steps:** Note review count on Home, go to Review, review 2 cards, return to Home
- **Expected:** Count decreases by 2 without page refresh
- **Result:** [pending]

### 4. Planner screen review count refreshes
- **Steps:** Note review count on Planner, review a card, return to Planner
- **Expected:** Count decreases by 1
- **Result:** [pending]

---

### Part B: Generate-on-Enter Posts

### 5. Feed loads fast (card-face only)
- **Steps:** Clear `echolearn_daily_posts` from localStorage, reload app
- **Expected:** Feed appears in <5s with post cards (titles, hooks, previews) but no essay bodies
- **Result:** [pending]

### 6. Opening a post streams essay
- **Steps:** Tap any post card in the feed
- **Expected:** Detail page shows heading + skeleton pulse, then essay streams in progressively via Markdown. No layout shift during streaming.
- **Result:** [pending]

### 7. Re-visit shows cached essay
- **Steps:** Go back to feed, tap the same post again
- **Expected:** Essay appears instantly (no skeleton, no streaming)
- **Result:** [pending]

### 8. whyCare / takeaway / quickAskPrompts appear after essay
- **Steps:** Open a post, wait for essay to complete
- **Expected:** "Why Care" section, "Takeaway" box, and 3 follow-up question buttons appear after streaming finishes
- **Result:** [pending]

---

### Part C: Post Type Variants

### 9. Video post streams summary on-enter
- **Steps:** Open a video post from the feed
- **Expected:** YouTube embed at top, then essay summary streams in (not pre-generated)
- **Result:** [pending]

### 10. News post streams summary on-enter
- **Steps:** Open a news post from the feed
- **Expected:** Source image at top (if available from Tavily), then summary streams in
- **Result:** [pending]

### 11. News posts related to user concepts
- **Steps:** Observe news post topics in feed
- **Expected:** News topics match user's knowledge graph anchors (not random)
- **Result:** [pending]

### 12. Text-art post detail page
- **Steps:** Open a text-art post from feed
- **Expected:** Notebook-style header (dot grid, themed font) at top, then short social-media-style essay (80-120 words), no "Generate image" button
- **Result:** [pending]

### 13. Image/image-less posts show "Generate image"
- **Steps:** Open an image-style post that has no cached images
- **Expected:** "Generate image" button visible at top
- **Result:** [pending]

### 14. Non-image posts hide "Generate image"
- **Steps:** Open a news, video, or text-art post
- **Expected:** No "Generate image" button
- **Result:** [pending]

---

### Part D: UI Fixes

### 15. Quick-ask buttons readable with long text
- **Steps:** Open any post, observe "Ask this post" buttons
- **Expected:** Buttons have rounded rectangle shape (not pill), adequate padding for long questions
- **Result:** [pending]

### 16. No scroll clip during Q&A streaming
- **Steps:** Ask a follow-up question in "Ask this post", try scrolling up during streaming
- **Expected:** User can freely scroll during streaming, not pinned to bottom
- **Result:** [pending]

### 17. No duplicate key console warning
- **Steps:** Open browser console, browse the feed
- **Expected:** No "Encountered two children with the same key" warnings
- **Result:** [pending]

---

### Part E: Session-Based Post Generation

### 18. Posts generated after session ends
- **Steps:** Ask 2-3 questions on Ask screen, tap "New Chat" or navigate to Home
- **Expected:** After ~5-10s, new posts appear in `infiniteScrollService` pending queue (verify via console: `infiniteScrollService.getPendingCount()`)
- **Result:** [pending]

### 19. Queued posts served on swipe-to-load
- **Steps:** After test 18, swipe to load more on Home feed
- **Expected:** Session-generated posts appear first (related to concepts just asked about)
- **Result:** [pending]

### 20. Follow-up questions don't flood feed
- **Steps:** Ask Q1, ask follow-up Q2, ask follow-up Q3 in same session, then leave
- **Expected:** Only one batch of ~6 posts generated (not 6 per question), because session processing fires once on session end
- **Result:** [pending]

### 21. Posts weighted toward session concepts
- **Steps:** Ask about "transformer architecture", then leave session, swipe to load
- **Expected:** Most new posts relate to transformers / ML, with possible cross-concept connections
- **Result:** [pending]

---

## Summary

| Category | Tests | Passed | Pending |
|----------|-------|--------|---------|
| Automated | 28 | 28 | 0 |
| Review Cap (A) | 4 | 0 | 4 |
| Generate-on-Enter (B) | 4 | 0 | 4 |
| Post Type Variants (C) | 6 | 0 | 6 |
| UI Fixes (D) | 3 | 0 | 3 |
| Session Post Gen (E) | 4 | 0 | 4 |
| **Total** | **49** | **28** | **21** |

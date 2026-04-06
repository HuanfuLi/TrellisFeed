---
status: complete
phase: 21-review-cap-fix-generate-on-enter-posts
source: [21-00-SUMMARY.md, 21-01-SUMMARY.md, 21-02-SUMMARY.md, manual fixes]
started: 2026-04-05T22:00:00.000Z
updated: 2026-04-05T23:30:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. All due flashcards visible in review queue
expected: Open Review screen. All due flashcards appear — no hidden cards, no hard cap.
result: pass

### 2. Review progress bar shows completion
expected: Review a few cards. Progress bar advances "X / Y reviewed". No "Daily Goal" bar.
result: pass (after fix: removed leftover setReviewedToday call that crashed handleRate)

### 3. Home screen review count refreshes after review
expected: Note count on Home, review 2 cards, return. Count decreases by 2 immediately.
result: pass

### 4. Feed loads with posts
expected: On first load of the day, feed generates posts via LLM. Subsequent loads serve from cache.
result: pass (after fix: restored original getDailyPosts pipeline, added missing questionService import)

### 5. Opening a post streams essay into pre-built shell
expected: Tap post card. Title + skeleton pulse immediately, essay streams in progressively. No layout shift.
result: pass

### 6. Re-visiting a post shows cached essay instantly
expected: Go back, tap same post. Essay appears immediately — no skeleton, no streaming.
result: pass

### 7. whyCare / takeaway / follow-up prompts appear after essay
expected: Open post, wait for essay to complete. Why Care, Takeaway, and 3 follow-up buttons appear.
result: pass

### 8. Text-art post detail shows notebook header + short essay
expected: Notebook-style header at top, short social-media-style essay, no "Generate image" button.
result: pass

### 9. Video post streams summary on-enter
expected: YouTube embed at top, summary streams in below.
result: blocked
blocked_by: third-party
reason: "YouTube API key returning 403 Forbidden — quota exhausted"

### 10. News post shows source image and streams summary
expected: Source image at top (if available), summary streams in below.
result: pass

### 11. News posts are related to your learning concepts
expected: News topics match knowledge graph anchors, not random.
result: pass

### 12. "Generate image" only on image/image-less posts
expected: "Generate image" visible on image posts. Not on news, video, text-art.
result: pass

### 13. Quick-ask buttons have readable shape
expected: Rounded rectangle shape, readable with long text.
result: pass

### 14. No scroll clip during Q&A streaming
expected: Can scroll freely during streaming response.
result: pass

### 15. No duplicate key console warnings
expected: No "Encountered two children with the same key" warnings.
result: pass

### 16. Session-based post generation triggers on session end
expected: Ask questions, tap New Chat or switch session. Posts generated and enqueued.
result: pass (after fixes: added missing questionService import, removed pendingCount cap, decoupled from processSessionIfNeeded, removed route-change effect)

### 17. Queued session posts appear on swipe-to-load
expected: Swipe to load more. 6 posts from queue appear. No extra LLM call for those.
result: pass (after fix: uncapped MAX_POSTS=4 in extractPosts/parseGeneratedPosts)

### 18. Follow-up questions don't flood the feed
expected: Multiple questions in one session produce one batch on session exit. No duplicate flashcards.
result: pass (after fix: track by sessionId:messageCount, trigger only on session exit not navigation)

### 19. Error state with retry on LLM failure
expected: Error message with Retry button on LLM failure.
result: pass

## Summary

total: 19
passed: 18
issues: 0
pending: 0
skipped: 0
blocked: 1

## Gaps

[none — blocked test (video) is due to exhausted YouTube API quota, not a code issue]

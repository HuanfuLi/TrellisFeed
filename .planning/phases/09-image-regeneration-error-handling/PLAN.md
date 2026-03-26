# Phase 9: Image Regeneration & Error Handling

**Milestone:** v1.1 (Engagement & Discovery Iteration)  
**Status:** Planning  
**Depends on:** Phase 7, Phase 8 (Post Detail page)

## Goal

Add user controls for image regeneration and implement comprehensive error handling for image generation failures, ensuring the app degrades gracefully when APIs fail or hit rate limits.

## Requirements

- **IMAGE-04**: User can trigger image regeneration if unsatisfied
- **IMAGE-05**: Image generation failures handled gracefully (error states, retry)

## User Stories

1. **As a learner**, I want to regenerate post images if I don't like the current ones, so I can see alternative visual representations of the concept.
2. **As a learner**, I want helpful error messages when image generation fails, so I understand what's happening and what to do.
3. **As a learner**, I want the feed to continue working even if some image generations fail, so I don't lose access to all posts.

## Success Criteria

1. ✅ User can tap "Regenerate" button on post detail to create new images
2. ✅ Regeneration shows loading state during API call
3. ✅ Failed regeneration shows error with clear message
4. ✅ Retry button appears for failed regenerations
5. ✅ API rate limit errors are communicated clearly
6. ✅ Feed shows graceful fallback if individual post image fails
7. ✅ Error states don't break layout or cause crashes
8. ✅ Max 3 regeneration attempts per post (prevent API spam)

## Task Breakdown

### Wave 1: Regeneration UI & Flow (Days 1-2)

#### T9.1: Regenerate Button Component
- Add "Regenerate" button to post detail page
- Position near image carousel
- Show loading spinner during API call
- **Acceptance:** Button renders, styling consistent with theme

#### T9.2: Image Regeneration Service Method
- Extend `ImageGenerationService.regenerateImages(postId)`
- Delete cached images for postId
- Trigger new generation with same post
- Update cache with new images
- Return new `GeneratedImage[]`
- **Acceptance:** Service method works, old images cleared

#### T9.3: Regeneration Flow UI
- Show progress indicator during regeneration
- Update carousel with new images as they arrive
- Smooth transition from old to new images (Framer Motion)
- Show success toast: "New images generated!"
- **Acceptance:** UX is smooth, user sees progress

#### T9.4: Regeneration Counter
- Track regeneration attempts per post (max 3)
- Show counter or disable button if limit reached
- Message: "Max regenerations reached. Try later."
- Reset counter daily or weekly
- **Acceptance:** Counter increments, button disables at limit

### Wave 2: Error Handling (Days 2-3)

#### T9.5: Error State Component
- Create `ImageErrorState.tsx` component
- Show error icon, message, and action buttons
- Implement retry, dismiss, or "Use Fallback" actions
- **Acceptance:** Component renders in post feed and detail

#### T9.6: Image Generation Error Boundaries
- Wrap image generation in try-catch
- Capture specific errors: network, quota, rate limit, timeout
- Map errors to user-friendly messages:
  - Network error: "Can't reach image service. [Retry] [Skip]"
  - Quota exceeded: "Image limit reached today. Try tomorrow. [Skip]"
  - Rate limited: "Too many requests. Wait a moment. [Retry]"
  - Timeout: "Image took too long. [Regenerate]"
- **Acceptance:** All error types handled, messages helpful

#### T9.7: Fallback Image Handling
- If both Nano Banana and Gemini fail, use fallback:
  - Option A: Gradient + emoji + title
  - Option B: Placeholder SVG illustration
  - Option C: Just show post title (text-only fallback)
- Maintain consistent look across feed
- **Acceptance:** Feed displays all posts even if images fail

#### T9.8: Error Logging & Monitoring
- Log errors to service for debugging (non-sensitive)
- Track error rates by provider (Nano Banana vs Gemini)
- Show "Report Error" option for persistent failures
- **Acceptance:** Errors logged, can diagnose issues

### Wave 3: Resilience & Testing (Days 3-4)

#### T9.9: Rate Limit Handling
- Implement exponential backoff (1s → 2s → 4s)
- Detect 429 responses from both providers
- Queue failed requests with delayed retry
- Show user: "Retrying in Xs..."
- **Acceptance:** Rate limits don't crash app, retries work

#### T9.10: API Quota Management
- Track daily/monthly quota usage for each provider
- Show quota status in Settings
- Prevent requests if quota nearly exhausted
- **Acceptance:** Quota tracked and respected

#### T9.11: Unit Tests
- Test error boundary logic
- Test fallback image selection
- Test error message mapping
- Test regeneration counter
- **Acceptance:** >80% coverage, all edge cases tested

#### T9.12: Integration Tests
- Test regeneration flow end-to-end
- Test error recovery with retries
- Test fallback image display
- **Acceptance:** All scenarios work without crashes

### Wave 4: Polish & Handoff (Days 4)

#### T9.13: Mobile Testing
- Test on iOS/Android with various error scenarios
- Test in low-battery mode (throttled API)
- Test with offline mode then reconnect
- **Acceptance:** All devices handle errors gracefully

#### T9.14: Documentation
- Document error handling architecture
- Document regeneration flow and limits
- Create troubleshooting guide
- **Acceptance:** Phase 10+ can rely on robust error handling

---

## Estimated Scope: 3-4 working days

**Key focus:** Graceful degradation + helpful UX when things fail.

---

_Phase 9 Plan | Image Regeneration & Error Handling_

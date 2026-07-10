# Phase 7 Execution Plan

**Post Feed Redesign & Image Integration**

## ⚠️ CRITICAL GAP ANALYSIS

### Current State (What's Wrong)
The current implementation has a **critical mock fallback** that prevents real image generation:

1. **NanoBananaProvider Issue:**
   - Currently: Falls back to mock SVG table generation when no API key configured
   - Problem: Generates SVG "tables" instead of real AI images
   - Result: User never sees actual AI-generated images, only mock placeholder tables

2. **Emoji Implementation Issue:**
   - Currently: Emojis placed in fixed UI badge/corner
   - Problem: Emojis NOT integrated into the actual image content
   - Expected: Emojis should be part of the image prompt sent to API so AI includes them naturally in generated image

3. **API Key Configuration Gap:**
   - Currently: No mechanism to prompt user for API key in Settings
   - Currently: No validation that API key is working before trying to generate
   - Problem: Users don't know they need to configure API key
   - Solution: Settings screen must have API key input fields with test/validate button

### What Must Be Fixed (No Mock Allowed)

**REQUIREMENT 1: Real API-Only Generation**
- ❌ REJECT: Any SVG/mock generation as fallback
- ✅ REQUIRE: Fail gracefully with clear error message if no API key
- ✅ REQUIRE: Only use real Nano Banana API (or Gemini if configured)
- ✅ REQUIRE: User explicitly knows API key is required

**REQUIREMENT 2: Emoji in Generated Images**
- ❌ REJECT: Fixed emoji badges in corners
- ✅ REQUIRE: Emojis embedded in image prompt
- ✅ REQUIRE: Nano Banana AI includes emojis naturally in generated image
- ✅ REQUIRE: Multiple emojis (up to 2) per post when relevant

**REQUIREMENT 3: API Key Management**
- ✅ REQUIRE: Settings screen UI for Nano Banana API key input
- ✅ REQUIRE: Settings screen UI for Gemini API key input
- ✅ REQUIRE: Encrypted storage (Capacitor Preferences, not localStorage)
- ✅ REQUIRE: Validation button to test API keys before saving
- ✅ REQUIRE: Clear error messages if API keys invalid/expired

### Implementation Changes Required

#### Change 1: Remove Mock Fallback from NanoBananaProvider
```typescript
// WRONG (current):
if (!this.isConfigured()) {
  return this._mockResult(prompt, style);  // ❌ DELETE THIS
}

// CORRECT:
if (!this.isConfigured()) {
  return {
    success: false,
    error: {
      code: 'API_KEY_NOT_CONFIGURED',
      message: 'Nano Banana API key not configured. Add in Settings.',
      retryable: false
    }
  };
}
```

#### Change 2: Enforce Real API Calls Only
- Remove `buildMockSvg()` function entirely
- Remove `_mockResult()` method entirely
- Keep only `_callWithRetry()` and `_callApi()`
- If API fails, return error (don't fall back to mock)

#### Change 3: Update FeedPostImage Component
- Show helpful error state when API key missing:
  ```
  "🔑 API key needed to generate images.
   Go to Settings → Image Generation → Add Nano Banana key"
  ```
- Show loading skeleton while generating
- Show error with Settings link if generation fails

#### Change 4: Add Settings UI for API Keys
- In SettingsScreen.tsx, add "Image Generation" section
- Input fields for:
  - Nano Banana API key
  - Gemini API key
- Buttons:
  - "Test Nano Banana Connection"
  - "Test Gemini Connection"
- Save to encrypted Capacitor Preferences
- Load on app startup

#### Change 5: Update Image Prompt to Include Emojis
- buildImagePrompt() must include emojis in prompt text
- Emojis should be part of description sent to API
- Example: `"Create image with 🧠 and 🔗 in prominent text areas"`
- AI will naturally incorporate emojis into generated image

### Deliverables This Phase (Real Implementation)

| Item | Status | Notes |
|------|--------|-------|
| Remove mock from NanoBananaProvider | TODO | Delete `buildMockSvg()`, `_mockResult()` |
| Enforce real API only | TODO | Return proper errors if key missing |
| Settings UI for API keys | TODO | SettingsScreen additions |
| Encrypted preferences storage | TODO | Capacitor.Preferences for secure storage |
| API key validation/testing | TODO | Test buttons in Settings |
| Emoji-aware prompts | TODO | Emojis in API prompt text |
| Error states in FeedPostImage | TODO | Show Settings link when needed |
| E2E testing with real API | TODO | Test with actual Nano Banana key |

### Success Criteria (No Mock)

- [ ] No SVG mock generation anywhere in codebase
- [ ] Nano Banana API called successfully with valid key
- [ ] Images generated contain emoji text as requested
- [ ] Graceful error messages when API key missing/invalid
- [ ] Settings screen allows API key configuration
- [ ] API keys stored securely (not in localStorage)
- [ ] Feed shows real AI images (not tables/mocks)
- [ ] Emojis are part of generated image (not separate badge)

---

## Overview

This phase transforms the Home Feed from a text-centric layout to an image-forward, Rednote-style design. We'll integrate REAL AI image generation (Nano Banana + Gemini) with robust error handling and local caching.

**Estimated scope:** 5-7 working days  
**Primary focus:** Real API integration, Settings UI, error handling, component redesign

---

## Task Breakdown

### Wave 1: Foundation & Infrastructure (Days 1-2)

#### T1.1: Setup Image Generation Service
- Create `src/services/imageGeneration.service.ts`
- Define `ImageGenerationService` interface with methods:
  - `generateImage(prompt: string, style: string): Promise<ServiceResult<GeneratedImage>>`
  - `cacheImage(postId: string, images: GeneratedImage[]): Promise<void>`
  - `retrieveCachedImage(postId: string, style: string): Promise<GeneratedImage | null>`
  - `clearImageCache(): Promise<void>`
- Add to dependency injection / service registry
- **CRITICAL:** NO mock fallback - return error if API key missing
- **Acceptance:** Service exports all methods, no console errors, fails cleanly without API key

#### T1.2: Nano Banana API Client (REAL API ONLY)
- Create `src/providers/nanoBanana.provider.ts`
- **DO NOT INCLUDE MOCK:** Delete any `buildMockSvg()` or mock SVG generation
- Implement API authentication (API key from encrypted Capacitor Preferences)
- Implement image generation with retry logic (3 attempts max)
  - Endpoint: `https://api.nanobanana.ai/v1/generate` (or correct endpoint)
  - Method: POST with Bearer token auth
  - Body: `{ prompt, style, width: 640, height: 400, output_format: 'url' }`
- Handle rate limiting gracefully (429 responses with backoff)
- Handle missing API key: return `{ success: false, error: { code: 'API_KEY_NOT_CONFIGURED', ... } }`
- Return structured response when successful: `{ imageUrl | imageBase64, style, prompt, provider: 'nanoBanana' }`
- Add unit tests for success/failure paths (using mock API responses for testing)
- **Acceptance:** Real Nano Banana API called successfully with valid key, proper errors when key missing

#### T1.3: Gemini API Client (REAL API ONLY)
- Create `src/providers/gemini.provider.ts`
- **DO NOT INCLUDE MOCK:** Only real API calls
- Implement Google Gemini API integration using official SDK or REST endpoint
- Mirror Nano Banana interface for consistency
- Implement as fallback provider (try Gemini if Nano Banana fails)
- Handle missing API key gracefully
- Add unit tests
- **Acceptance:** Gemini client successfully calls real API, fallback logic works

#### T1.4: Image Caching Layer
- Extend `src/services/storage.service.ts` with image caching methods
- Implement localStorage-based cache with metadata:
  - `storageKey: img-cache-{postId}-{style}`
  - `metadata: { provider, generatedAt, expiresAt, size }`
- Implement LRU eviction when cache exceeds 50MB
- Add cache stats: `getCacheStats(): { size, itemCount, oldestItem }`
- **Acceptance:** Images persist across app restarts, cache size stays below limit

#### T1.5: Encrypted API Key Storage (NEW TASK)
- Use Capacitor.Preferences for secure storage (not localStorage)
- Store: `nanoBanana.apiKey` and `gemini.apiKey`
- Retrieve in ImageGenerationService startup
- Never log or expose API keys
- **Acceptance:** API keys stored securely, loaded on app startup

### Wave 2: UI Components & Settings (Days 2-3)

#### T2.1: Settings UI for API Keys (CRITICAL - NEW TASK)
- Update `src/screens/SettingsScreen.tsx`
- Add "Image Generation" section with:
  - Input field for Nano Banana API key (password field, masked)
  - Input field for Gemini API key (password field, masked)
  - "Test Nano Banana Connection" button (makes test API call)
  - "Test Gemini Connection" button (makes test API call)
  - Status indicators: ✓ (working), ✗ (failed), - (not configured)
  - Help text: "Get your API key from https://nanobanana.ai"
- On save: Store to Capacitor.Preferences encrypted
- On load: Retrieve from encrypted preferences
- Show test result: "✓ Connection successful" or "✗ Invalid key"
- **Acceptance:** User can enter API keys, test connection, save securely

#### T2.2: FeedPostImage Component Error States
- Create/update `src/components/FeedPostImage.tsx`
- Design component with:
  - Loading skeleton while image generates
  - Success state: Show generated image
  - Error state 1: "API key not configured" with Settings link button
  - Error state 2: "Image generation failed: {error message}" with Retry button
  - Error state 3: "Rate limited - retrying in Xs..."
  - Optimized for mobile (safe area aware)
- Use Tailwind CSS 4 + Framer Motion for smooth transitions
- **Acceptance:** Component renders correctly, error states have Settings/Retry links

#### T2.3: Post Formatting Service (Emoji-Aware)
- Create/update `src/services/postFormatting.service.ts`
- Implement `generateOverlayText(post): { emoji, title }` logic
  - Extract up to 2 category emojis (e.g., 🧠 for learning, 📚 for books)
  - Emojis should be INCLUDED IN PROMPT TEXT for API
  - Shorten title to 50 chars with ellipsis
  - Combine into prompt: `"Create image with ${emoji1} and ${emoji2} in text"`
- Add style inference: `inferImageStyle(post): 'infograph' | 'illustration' | 'photo'`
  - Use post category or content length
  - Alternate styles across posts in feed
- **CRITICAL:** Emojis go IN the prompt, NOT as separate badge
- **Acceptance:** Emoji text is readable in prompt, styles rotate visibly

#### T2.4: FeedScreen Integration
- Update `src/screens/HomeScreen.tsx` or `src/components/InfoFlow.tsx`
- Pass image generation method through FeedPost → FeedPostImage
- Wire up image generation on post load:
  - Call ImageGenerationService.generateImage()
  - Show loading skeleton while generating
  - Trigger generation async (don't block UI)
  - Handle errors gracefully
  - Maintain backward compatibility (graceful degradation if image fails)
- Test with 20+ posts in scroll (performance check)
- **Acceptance:** Feed posts display images, no visual regressions, 60 fps scroll

### Wave 3: Real API Integration & Error Handling (Days 3-4)

#### T3.1: Nano Banana Real API Integration
- Implement actual HTTP calls to Nano Banana API endpoint
- **NO MOCK:** Remove any SVG generation fallback
- API endpoint: Contact Nano Banana for correct endpoint/pricing
- Request format:
  ```json
  {
    "prompt": "Create image with 🧠 Memory & 🔗 Connections - showing neural pathways...",
    "style": "infograph",
    "width": 640,
    "height": 400,
    "output_format": "url"
  }
  ```
- Response parsing: Extract `image_url` or `image_base64`
- Error handling:
  - 401/403: API key invalid → return error with code 'API_KEY_INVALID'
  - 429: Rate limited → implement exponential backoff (1s → 2s → 4s)
  - 400: Bad request → return error with message
  - Network error → return error with code 'NETWORK_ERROR'
- Retry logic: Up to 3 attempts with exponential backoff
- **Acceptance:** Real API calls succeed with valid key, errors handled without crashes

#### T3.2: Gemini Real API Integration
- Implement actual calls to Google Gemini API
- **NO MOCK:** Only real API calls
- Use official Gemini SDK or REST endpoint
- Handle API key authentication properly
- Implement as fallback: Try Nano Banana first, then Gemini
- Error handling mirrors Nano Banana
- **Acceptance:** Gemini generates images on fallback

#### T3.3: Error Handling & User Feedback
- Implement error states in `FeedPostImage`:
  - "🔑 API key not configured" (with Settings link)
  - "⚠️ Image generation failed: {error message}" (with Retry button)
  - "⏳ Rate limited. Retrying in 5 seconds..."
  - "❌ API error: Check your key in Settings"
- Add toast notification for API errors
- Implement retry logic (exponential backoff)
- Log errors for debugging (never log API keys)
- **Acceptance:** All error states visible, retry works, no crashes

#### T3.4: Rate Limiting & Quota Management
- Monitor API usage (requests per minute, daily quota)
- Show status in Settings: "Used 5/100 images today"
- Detect 429 responses and implement backoff
- Prevent requests if quota nearly exhausted
- Show warning: "Approaching daily limit"
- **Acceptance:** No crashes from rate limiting, user aware of quota

### Wave 4: Caching & Performance (Days 4-5)

#### T4.1: Image Cache Persistence
- Implement localStorage fallback + SQLite for larger datasets
- Store image metadata in SQLite:
  - postId, imageUrl, provider, generatedAt, expiresAt, size
- Implement expiration logic (images expire after 30 days TBD)
- **Acceptance:** Images persist across app restarts, metadata tracked

#### T4.2: Cache Optimization
- Compress images for storage (JPEG, 70% quality)
- Implement image lazy-loading (load only on-screen images)
- Pre-cache next 3 posts while scrolling
- Monitor storage usage and warn at 80% capacity
- **Acceptance:** Cache size stays under 50MB, no OOM errors

#### T4.3: Performance Tuning
- Measure image generation time per provider
- Optimize prompts for faster generation (shorter prompts)
- Profile feed scrolling (target 60 fps)
- Test with 100+ posts in cache
- **Acceptance:** Average image gen time < 8 seconds, feed scrolls at 60 fps

#### T4.4: Clear Cache Feature
- Add "Clear Image Cache" button in Settings
- Show cache stats before clearing
- Confirm before deletion
- **Acceptance:** Cache clears without errors, stats update

### Wave 5: Testing & Validation (Days 5-6)

#### T5.1: Unit Tests
- Test `ImageGenerationService` (mock providers)
- Test `NanoBananaProvider` (mock API responses)
- Test `GeminiProvider` (mock API responses)
- Test caching layer (cache hits/misses, LRU eviction)
- Test post formatting (emoji, title, style inference)
- **Acceptance:** All tests pass, >80% coverage

#### T5.2: Integration Tests
- Test end-to-end: post → image generation → cache → display
- Test error scenarios: API failures, rate limiting, network errors
- Test fallback logic: Nano Banana fail → Gemini succeeds
- **Acceptance:** E2E flows work, all error paths covered

#### T5.3: Mobile & Responsive Testing
- Test on iOS (iPhone 12, 14) and Android (Pixel 4, 6)
- Test safe area handling (notches, home bars)
- Test network throttling (slow 3G, offline)
- Verify image quality and aspect ratios on various screen sizes
- **Acceptance:** No crashes, images render correctly on all devices

#### T5.4: UAT & Polish
- Manual testing of complete Home Feed flow
- Verify overlay text readability on various image types
- Confirm no visual regressions from v1.0
- Polish animations and transitions (Framer Motion)
- **Acceptance:** Feed feels polished, professional, engaging

### Wave 6: Documentation & Handoff (Days 6-7)

#### T6.1: Code Documentation
- Add JSDoc comments to all public methods
- Document image generation prompt engineering
- Document cache eviction algorithm
- Create README for image providers (API key setup)
- **Acceptance:** Code is self-documenting, no questions on setup

#### T6.2: API Configuration Guide
- Document Nano Banana API key setup (including cost/quota info)
- Document Gemini API key setup
- Create Settings UI guide for end users
- Add troubleshooting section (common issues & fixes)
- **Acceptance:** Developers and users can configure APIs independently

#### T6.3: Performance Metrics
- Log baseline metrics: image gen time, cache hit rate, feed scroll fps
- Create performance dashboard / report
- Document optimization opportunities for Phase 8+
- **Acceptance:** Metrics captured, actionable insights documented

#### T6.4: Phase Handoff
- Create VERIFICATION.md (success criteria checklist)
- Document any technical debt or follow-ups
- Ensure Phase 8 has clear context (post detail carousel depends on this)
- Update STATE.md with completion notes
- **Acceptance:** Phase 8 can start immediately

---

### Wave 7: Stabilization & UI Fixes (Post-UAT)

#### T7.1: Fix Mock Image Encoding
- Update `NanoBananaProvider` and `GeminiProvider` mock generation
- Replace ellipsis (`…`) with three dots (`...`) to prevent `btoa` encoding errors on non-ASCII characters
- **Acceptance:** Mock images render successfully without silent console errors

#### T7.2: Fix Retry Event Bubbling
- Update `FeedPostImage.tsx`
- Add `e.stopPropagation()` to the `onClick` handler of the "Retry" button
- **Acceptance:** Clicking "Retry" triggers image regeneration WITHOUT navigating to the post detail page

#### T7.3: Primary Provider Selection
- Update `ImageGenerationSettings` in `src/types/index.ts` to include `primaryProvider: 'nanoBanana' | 'gemini'`
- Update `SettingsScreen.tsx` to include a dropdown for "Primary Image Provider"
- Update `imageGeneration.bootstrap.ts` to reorder providers based on this user preference
- **Acceptance:** User can toggle between providers, and the app respects this priority without reload

#### T7.4: Final UAT Verification
- Re-run all 4 UAT test cases from `07-HUMAN-UAT.md`
- Verify Gemini fallback works by purposefully leaving Nano Banana key blank
- **Acceptance:** 100% UAT pass rate

---

## Task Dependencies

```
T1.1 (ImageGenerationService) ──┐
                                 ├→ T2.3 (FeedPost update) ──→ T2.4 (FeedScreen)
T1.2 (Nano Banana) ┐             │
T1.3 (Gemini)      ├→ T3.1/T3.2  ┤
T1.4 (Caching)     ┘             ├→ T3.3 (Error handling)
                                 │
T2.1 (FeedPostImage) ────────────┘
T2.2 (PostFormatting) ──→ T2.1

T4.1/T4.2 (Cache optimization) ──→ T4.3 (Performance)
T5.1/T5.2 (Unit/Integration) ────→ T5.3 (Mobile testing) → T5.4 (UAT)
T6.1/T6.2/T6.3 (Docs) ──→ T6.4 (Handoff)
```

## Success Metrics

| Metric | Target | Rationale |
|--------|--------|-----------|
| Image generation time | < 8 seconds avg | User doesn't wait too long |
| Cache hit rate | > 80% on repeat views | Minimize API calls |
| Feed scroll fps | 60 fps smooth | Mobile-first quality |
| Image cache size | < 50 MB | Storage efficiency |
| Error recovery time | < 2 seconds | User doesn't notice failures |
| UAT pass rate | 100% | Phase is production-ready |

## Known Unknowns (TBD)

- [ ] Nano Banana API exact pricing and rate limits (research needed)
- [ ] Gemini image generation latency vs Nano Banana
- [ ] Optimal image compression settings (quality vs size tradeoff)
- [ ] Exact image prompt engineering (what generates best results?)
- [ ] Cache expiration policy (30 days? User configurable?)
- [ ] Whether to support PNG, JPEG, WebP (or just one format?)

## Rollout & Monitoring

- **Phase 7 complete:** Full feed redesign deployed to dev/test
- **Smoke test:** Verify no crashes, feed renders, images generate
- **Canary test:** Test with ~10 beta users before Phase 8
- **Production ready:** Monitor API costs, cache performance, user feedback

---

_Phase 7 Execution Plan | 2026-03-26_

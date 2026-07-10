# Phase 7: Post Feed Redesign & Image Integration

**Milestone:** v1.1 (Engagement & Discovery Iteration)  
**Status:** Planning  
**Started:** 2026-03-26

## Goal

Redesign the Home Feed to display posts with an image-forward, Rednote-style layout. Integrate AI image generation capabilities (Nano Banana and Gemini APIs) with local caching to provide visually engaging, diverse post experiences.

## Requirements

- **FEED-01**: Image-forward post design (large image with emoji/text overlay)
- **FEED-02**: Multiple image style generation (infograph, illustration, photo-style)
- **FEED-03**: Catchy title/question/story overlay on images
- **IMAGE-01**: Nano Banana API integration
- **IMAGE-02**: Gemini API integration
- **IMAGE-03**: Image caching (local storage)

## User Stories

1. **As a learner**, I want to see posts with large, visually appealing images so that the feed feels more engaging and modern.
2. **As a learner**, I want post titles/questions to appear as prominent text/emoji overlays on images so that I can quickly understand the post topic.
3. **As a developer**, I need to generate diverse image styles (infographs, illustrations, photos) so that posts don't feel repetitive.
4. **As a privacy-conscious user**, I want generated images cached locally so that the app doesn't repeatedly call external APIs.
5. **As a learner**, I want fallback image handling if generation fails so that the feed still works gracefully.

## Success Criteria

1. ✅ Home Feed displays posts with large images (≥60% of post component height)
2. ✅ AI generates 2+ image styles per post within 5-10 seconds
3. ✅ Post titles/questions render as emoji-enhanced text overlays on images
4. ✅ Images persist in local storage across app restarts
5. ✅ Nano Banana API successfully integrates and generates images
6. ✅ Gemini API successfully integrates as fallback provider
7. ✅ Image generation errors show user-friendly error states
8. ✅ No broken feeds or visual layout regressions compared to v1.0

## Technical Approach

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Home Feed Screen (updated UI)                               │
├─────────────────────────────────────────────────────────────┤
│  Service Layer:                                             │
│  ├─ FeedService (existing, fetch posts)                    │
│  ├─ ImageGenerationService (NEW)                           │
│  │  ├─ generateImage(prompt, style)                        │
│  │  ├─ cacheImage(postId, images)                          │
│  │  └─ getImageStyle() → infers from prompt                │
│  └─ PostFormattingService (NEW)                            │
│     ├─ formatPostWithImage(post, image)                    │
│     └─ generateOverlayText(post) → emoji + title           │
├─────────────────────────────────────────────────────────────┤
│  Providers:                                                 │
│  ├─ NanoBananaProvider (primary image generation)          │
│  └─ GeminiProvider (fallback image generation)             │
├─────────────────────────────────────────────────────────────┤
│  Storage:                                                   │
│  ├─ localStorage (image cache, metadata)                   │
│  └─ SQLite (post + image metadata)                         │
└─────────────────────────────────────────────────────────────┘
```

### Component Structure

- **FeedPost** (existing) → Enhanced with image rendering
- **FeedPostImage** (NEW) → Large image with overlay text
- **ImagePlaceholder** (NEW) → Loading + error states
- **FeedScreen** (existing) → Updated to use new components

### Image Generation Flow

```
User scrolls feed
    ↓
Post loads from DB
    ↓
Check if image cached? → YES → Render cached image
    ↓ NO
Request image generation
    ↓
Try Nano Banana API
    ├─ Success → Cache locally → Render
    └─ Fail → Try Gemini API
         ├─ Success → Cache locally → Render
         └─ Fail → Show error state + retry option
```

### API Integration Details

**Nano Banana:**
- Endpoint: `https://api.nanobanana.com/generate`
- Required: API key, prompt, style parameter
- Returns: Image URL or base64
- Rate limits: [To be researched]

**Gemini:**
- Endpoint: Via official Google SDK
- Required: API key, prompt, configuration
- Returns: Image base64 or URL
- Rate limits: [To be researched]

### Data Model

```typescript
interface GeneratedImage {
  id: string;              // UUID
  postId: string;          // FK to post
  prompt: string;          // Image generation prompt
  style: 'infograph' | 'illustration' | 'photo';
  imageUrl?: string;       // Remote URL (if from provider)
  imageBase64?: string;    // Local cache (base64)
  provider: 'nanoBanana' | 'gemini';
  generatedAt: number;     // Timestamp
  cachedAt?: number;       // When stored locally
  error?: string;          // If generation failed
}

interface PostWithImages {
  post: Post;
  images: GeneratedImage[];
  primaryImage: GeneratedImage;
}
```

### Caching Strategy

- Store up to 50MB of images locally (configurable)
- Use LRU eviction when quota exceeded
- Persist across app restarts (localStorage + SQLite metadata)
- Clear cache option in Settings

## Dependencies

- **Upstream:** Existing FeedService, Post model, localStorage/SQLite
- **Downstream:** Phase 8 (post detail carousel) depends on this
- **External:** Nano Banana API, Gemini API (keys in user settings)

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Image generation latency (5-10s) | Poor UX if not handled | Show loading skeleton, prioritize posts on screen |
| API key exposure | Security breach | Store in encrypted Capacitor Preferences, never commit |
| Rate limiting / quota | Feed breaks | Implement retry logic, fallback to placeholder |
| Storage quota exceeded | App crashes | Monitor cache size, implement LRU eviction |
| Network failure | No images | Graceful degradation (show text-only fallback) |

## Acceptance Criteria (UAT)

- [ ] Home Feed displays posts with large images (minimum 200px height)
- [ ] All posts have visible title/emoji overlay on image
- [ ] Image generation completes within 10 seconds on average
- [ ] Images persist after closing and reopening the app
- [ ] No console errors or crashes during normal feed scrolling
- [ ] Image generation failures show user-friendly error messages
- [ ] Fallback text-only post format appears if image generation fails
- [ ] Network errors don't break the entire feed

## Notes

- This phase establishes the foundation for Phase 8 (post detail carousel)
- Image styling/prompts will be defined in task breakdown
- API rate limits and quota sizing TBD during planning
- Consider image compression and format optimization for storage efficiency

---

_Phase 7 Plan | Post Feed Redesign & Image Integration | 2026-03-26_

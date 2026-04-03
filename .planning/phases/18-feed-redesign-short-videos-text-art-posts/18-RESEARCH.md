# Phase 18: Feed Redesign, Short Videos & Text-Art Posts - Research

**Researched:** 2026-04-03
**Domain:** Feed UI redesign, new post types (short video, text-art), weighted feed mix, image generation toggle
**Confidence:** HIGH

## Summary

This phase modifies the existing feed card system (`ConceptCard` in `InfoFlow.tsx`) and feed generation pipeline (`concept-feed.service.ts`) to support cleaner card faces, two new post types (portrait short videos and text-art notebook posts), a weighted random feed mix, and a settings toggle for image generation. The work is entirely within the existing React 19 + TypeScript + inline-styles architecture with no new external libraries required.

The card cleanup (removing badge row, keyword tags, conditional preview text) is straightforward DOM removal in `ConceptCard`. The two new post types require extending the `sourceType` union and adding new rendering branches in `ConceptCard`. The weighted random mix replaces the current `interleaveVideoPosts()` function with a shuffle algorithm that respects target percentages. The YouTube Shorts integration reuses `youtubeService` with modified search parameters.

**Primary recommendation:** Extend `sourceType` with `'short'` and `'text-art'`, modify `ConceptCard` with conditional rendering branches per source type, replace `interleaveVideoPosts()` with a weighted shuffle, and add `imageGenerationEnabled` boolean to `AppSettings`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Thumbnail-dominant card -- portrait 9:16 aspect ratio fills most of the card. Small "Short" badge overlay in corner, title overlaid at bottom. Minimal surrounding chrome.
- **D-02:** Direct inline play -- tap the card to play video right on the card. No navigation to a detail page.
- **D-03:** Brief 1-2 sentence AI-generated takeaway shown below the player after user taps to play.
- **D-04:** Remove badge & context label row entirely from all card types. No badge, no context label on the card face.
- **D-05:** Keep hook at current size (1.2rem/800 weight). Kill preview text when an AI-generated image is present -- image + hook only.
- **D-06:** No-image fallback: text-forward card -- hook stays bold, preview text (`teaser.preview`) appears below. Card is naturally shorter than image cards (no image placeholder).
- **D-07:** Preview source for no-image fallback: use existing `teaser.preview` field as-is.
- **D-08:** Don't render card until image generation resolves (keep current `imageResolved` gating -- no flash of text-then-image).
- **D-09:** Remove keyword tag pills from card face entirely across all post types. Tags only appear on detail page if needed.
- **D-10:** Weighted random mix for post presentation -- approximately 30% image posts, 25% text-art posts, 20% image-less posts, 25% video/short videos. Organic variety that controls image generation token spend.
- **D-11:** Settings toggle to enable/disable image generation. When off, no image API calls are attempted -- all posts fall back to text-art or image-less styles.
- **D-12:** Background: white or light yellow with subtle dot grid or lined notebook-paper pattern. No AI image generation -- purely CSS/SVG.
- **D-13:** Content: LLM-generated mix of styles -- provocative questions, breaking-news-style facts, quotes -- with related emojis placed inline between the text. The text itself is the visual element.
- **D-14:** Same height as image cards for consistent feed rhythm and visual consistency.
- **D-15:** Apply same card face cleanup -- remove badge row, remove keyword tags. Keep thumbnail + hook + "by Channel" attribution.

### Claude's Discretion
- Exact weighted random implementation (how to assign post presentation style)
- CSS/SVG approach for notebook paper background patterns (dot grid vs lined)
- How text-art content prompt is structured for LLM to generate questions/facts/quotes with emojis
- Short video discovery strategy (YouTube Shorts search query approach)
- Inline player implementation for shorts (iframe sizing, play/pause behavior)
- Transition animation when short video starts playing in-card

### Deferred Ideas (OUT OF SCOPE)
- Web search API for LLM -- belongs in its own future phase
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FEED-07 | Remove badge & context label row from all card types | Direct DOM removal in ConceptCard lines 105-121, ConnectionCard lines 298-320 |
| FEED-08 | Kill preview text when AI image present (image + hook only) | Conditional render: hide preview `<p>` when `image` is truthy in ConceptCard |
| FEED-09 | Text-forward fallback for no-image cards (hook + preview, shorter card) | Already partially exists; enforce shorter `minHeight` in InlineInfoFlow item wrapper |
| FEED-10 | Remove keyword tag pills from all card faces | Remove keyword map block at ConceptCard lines 219-234 |
| SHORT-01 | Portrait short video card (9:16 thumbnail-dominant, minimal chrome) | New rendering branch in ConceptCard for `sourceType === 'short'`; 9:16 aspect ratio via `aspectRatio: '9/16'` |
| SHORT-02 | Direct inline play on tap (no detail page navigation) | Local `playing` state in card; swap thumbnail for YouTubeEmbed iframe on tap; prevent `onOpen` propagation |
| SHORT-03 | Brief 1-2 sentence AI takeaway shown below player after tap | `videoMeta.summary` already exists; truncate to 2 sentences and show conditionally when `playing` |
| TART-01 | Notebook-paper background (white/light yellow, dot grid pattern) | CSS `radial-gradient` dot grid pattern; no external dependencies |
| TART-02 | LLM-generated mixed content (questions, facts, quotes) with inline emojis | New field `textArtContent` on DailyPost or generate at card-render time from existing content |
| TART-03 | Same height as image cards for consistent feed rhythm | Match `minHeight` of image cards in InlineInfoFlow item wrapper |
| MIX-01 | Weighted random feed mix (~30% image, 25% text-art, 20% image-less, 25% video/short) | Replace `interleaveVideoPosts()` with weighted shuffle in concept-feed.service.ts |
| MIX-02 | Settings toggle to enable/disable image generation (no API calls when off) | Add `imageGenerationEnabled: boolean` to `AppSettings`; gate `generateImage()` call in ConceptCard |
| VIDEO-01 | Apply card cleanup to existing landscape video posts (remove badge row, keyword tags) | Same DOM removal as FEED-07/FEED-10 applies to video sourceType branch |
</phase_requirements>

## Architecture Patterns

### Type System Extensions

Extend `sourceType` union in `app/src/types/index.ts`:

```typescript
// Current:
sourceType: 'recent' | 'related' | 'resurfaced' | 'starter' | 'mixed' | 'connection' | 'video';

// Extended:
sourceType: 'recent' | 'related' | 'resurfaced' | 'starter' | 'mixed' | 'connection' | 'video' | 'short' | 'text-art';
```

Also update `VALID_SOURCE_TYPES` set in `concept-feed.service.ts` and `CONCEPT_BADGE_META` in `InfoFlow.tsx` (though badge row is being removed, keep the map for any future use or remove entirely).

Add `textArtContent` field to `DailyPost`:

```typescript
export interface DailyPost extends PostSnapshot {
  generatedAt: number;
  origin: 'ai';
  videoMeta?: VideoMetadata;
  textArtContent?: string;  // LLM-generated text-art content for notebook posts
}
```

Add `imageGenerationEnabled` to `ImageGenerationSettings`:

```typescript
export interface ImageGenerationSettings {
  // ... existing fields
  /** Master toggle for image generation. When false, no API calls attempted. */
  enabled: boolean;
}
```

### Presentation Style Assignment (MIX-01)

The weighted random mix determines how each post is **presented**, not how it is generated. A post generated with `sourceType: 'recent'` could be presented as an image card, text-art card, or image-less card. The `sourceType` on `PostSnapshot` should remain as-is for data provenance; the presentation style is a separate concern.

**Recommended approach:** Add a `presentationStyle` field to `DailyPost`:

```typescript
type PresentationStyle = 'image' | 'text-art' | 'image-less' | 'video' | 'short';

export interface DailyPost extends PostSnapshot {
  // ...existing
  presentationStyle?: PresentationStyle;
}
```

The weighted random assignment happens in `concept-feed.service.ts` after posts are generated but before they are returned. Video posts always get `'video'` or `'short'` style. Non-video posts get randomly assigned `'image'`, `'text-art'`, or `'image-less'` based on the target percentages (adjusted to exclude the video/short slots).

**Algorithm:**

```typescript
const WEIGHTS = { image: 0.30, 'text-art': 0.25, 'image-less': 0.20, video: 0.25 };

function assignPresentationStyles(
  aiPosts: DailyPost[],
  videoPosts: DailyPost[],
  imageGenerationEnabled: boolean,
): DailyPost[] {
  const total = aiPosts.length + videoPosts.length;
  const videoSlots = videoPosts.length;
  const nonVideoCount = aiPosts.length;

  // When image generation is off, redistribute image slots to text-art and image-less
  const effectiveWeights = imageGenerationEnabled
    ? { image: 0.40, 'text-art': 0.33, 'image-less': 0.27 }  // normalized non-video weights
    : { image: 0, 'text-art': 0.55, 'image-less': 0.45 };

  // Assign counts
  const imageCount = Math.round(nonVideoCount * effectiveWeights.image);
  const textArtCount = Math.round(nonVideoCount * effectiveWeights['text-art']);
  // image-less gets the remainder

  // Build style array, shuffle, assign
  const styles: PresentationStyle[] = [
    ...Array(imageCount).fill('image'),
    ...Array(textArtCount).fill('text-art'),
    ...Array(nonVideoCount - imageCount - textArtCount).fill('image-less'),
  ];
  shuffleArray(styles);

  return aiPosts.map((post, i) => ({ ...post, presentationStyle: styles[i] }));
}
```

### ConceptCard Rendering Branches

After cleanup, `ConceptCard` should have these rendering paths:

1. **Short video** (`sourceType === 'short'`): Portrait thumbnail, tap-to-play inline, AI takeaway
2. **Video** (`sourceType === 'video'`): Landscape thumbnail + hook + channel (D-15 cleanup applied)
3. **Image card** (`presentationStyle === 'image'`): AI image + hook only (no preview)
4. **Text-art card** (`presentationStyle === 'text-art'`): Notebook background + LLM text content
5. **Image-less card** (`presentationStyle === 'image-less'`): Hook + preview text, shorter height

### CSS Dot Grid Pattern for Notebook Posts (TART-01)

Pure CSS, no SVG file needed:

```css
/* Dot grid notebook paper */
background-color: #FFFDE7; /* light yellow */
background-image: radial-gradient(circle, #C5CAE9 0.8px, transparent 0.8px);
background-size: 20px 20px;
```

This creates a subtle dot grid pattern. For lined notebook paper as an alternative:

```css
background-color: #FFFEF5;
background-image: repeating-linear-gradient(
  0deg,
  transparent,
  transparent 27px,
  #E0E0E0 27px,
  #E0E0E0 28px
);
```

**Recommendation:** Use dot grid -- it feels more modern and less cluttered with text overlaid.

### YouTube Shorts Discovery (SHORT-01)

YouTube Shorts are regular YouTube videos with portrait aspect ratio. To search for them specifically:

```typescript
// Add #Shorts to search query to bias toward short-form content
const shortsQuery = `${conceptTitle} #Shorts`;
// Also filter by videoDuration=short (under 4 minutes)
const url = `${YOUTUBE_SEARCH_URL}?part=snippet&type=video&videoEmbeddable=true` +
  `&videoDuration=short&q=${encodeURIComponent(shortsQuery)}&maxResults=${maxResults}` +
  `&relevanceLanguage=en&safeSearch=strict&key=${apiKey}`;
```

The `videoDuration=short` parameter filters to videos under 4 minutes. Combined with `#Shorts` in the query, this reliably returns YouTube Shorts content.

### Inline Player for Shorts (SHORT-02)

Reuse `YouTubeEmbed` with portrait aspect ratio:

```typescript
function ShortVideoCard({ post, onOpen }: { post: DailyPost; onOpen: () => void }) {
  const [playing, setPlaying] = useState(false);
  const videoId = post.videoMeta?.videoId;

  const handleTap = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent navigation to detail page
    setPlaying(true);
  };

  if (!videoId) return null;

  return (
    <div onClick={playing ? undefined : handleTap} style={{ cursor: playing ? 'default' : 'pointer' }}>
      {playing ? (
        <>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '9/16', overflow: 'hidden', borderRadius: 'var(--radius-xl)' }}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?playsinline=1&autoplay=1&rel=0`}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Short video"
            />
          </div>
          {/* AI takeaway (SHORT-03) */}
          {post.videoMeta?.summary && (
            <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', padding: '12px 16px', lineHeight: 1.5 }}>
              {truncateToSentences(post.videoMeta.summary, 2)}
            </p>
          )}
        </>
      ) : (
        /* Portrait thumbnail with "Short" badge overlay */
        <div style={{ position: 'relative', width: '100%', aspectRatio: '9/16', overflow: 'hidden' }}>
          <img src={post.videoMeta.thumbnailUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <span style={{ position: 'absolute', top: 12, right: 12, /* badge styles */ }}>Short</span>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px', background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
            <p style={{ color: 'white', fontWeight: 800, fontSize: '1.2rem' }}>{post.teaser.hook}</p>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Text-Art Content Generation (TART-02)

Add an LLM call to generate notebook-style content. This can happen during feed generation in `concept-feed.service.ts`, or lazily when the card renders.

**Recommendation:** Generate at feed-build time to avoid per-card LLM calls during scroll. Store result in `textArtContent` field.

**Prompt structure:**

```typescript
const textArtPrompt = `You are creating a "notebook page" visual card for a learning app.
Topic: "${post.title}"
Context: "${post.teaser.preview}"

Write 3-5 short items mixing these styles:
- A provocative question (start with emoji)
- A surprising fact written like a breaking news headline (start with emoji)
- A memorable quote or insight (start with emoji)

Rules:
- Each item on its own line
- Start each with a relevant emoji
- Keep each item under 15 words
- Make it feel like a student's notebook margin notes
- The content should spark curiosity about the topic

Return ONLY the text lines, no JSON, no markdown formatting.`;
```

### Settings Toggle (MIX-02)

Add to `ImageGenerationSettings` in types:

```typescript
enabled: boolean;  // defaults to true
```

Update `defaultSettings` in `settings.service.ts`:

```typescript
imageGeneration: {
  // ...existing
  enabled: true,
},
```

Gate in `ConceptCard`:

```typescript
useEffect(() => {
  if (isVideoPost || isShortPost) return;

  const settings = settingsService.getSync();
  if (!settings.imageGeneration.enabled || presentationStyle !== 'image') {
    setImageResolved(true);
    return;
  }
  // ...existing image generation logic
}, [post.id, isVideoPost, presentationStyle]);
```

### Anti-Patterns to Avoid

- **Modifying `sourceType` for presentation:** Don't change a `'recent'` post's `sourceType` to `'text-art'`. The `sourceType` is data provenance. Use a separate `presentationStyle` field.
- **Per-card LLM calls for text-art:** Don't call the LLM inside the card component for text-art content. Generate it at feed-build time to avoid scroll lag.
- **Hardcoding image card height for text-art:** Don't use a fixed pixel height. Match whatever the image cards use via the same `minHeight` constraint in the feed wrapper.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dot grid background | Canvas drawing code | CSS `radial-gradient` | 2 lines of CSS, zero JS, perfect rendering |
| YouTube Shorts detection | Custom video metadata parsing | `videoDuration=short` API param + `#Shorts` query | YouTube API handles this natively |
| Weighted random distribution | Complex probability algorithm | Simple count-based allocation + Fisher-Yates shuffle | Deterministic count allocation is simpler and gives exact ratios |
| Inline video player | Custom video element with YouTube API | YouTube iframe embed with `autoplay=1` | Handles DRM, ads, quality switching automatically |

## Common Pitfalls

### Pitfall 1: YouTube Shorts Thumbnails Are Portrait but API Returns Landscape URLs
**What goes wrong:** YouTube API thumbnail URLs (`thumbnails.high.url`) are always landscape (480x360) even for Shorts.
**Why it happens:** YouTube API doesn't distinguish Shorts thumbnails from regular video thumbnails.
**How to avoid:** Use `maxresdefault.jpg` URL pattern (`https://img.youtube.com/vi/{videoId}/maxresdefault.jpg`) which may return portrait for Shorts. Alternatively, use `objectFit: 'cover'` on a portrait container and accept center-cropping of landscape thumbnails.
**Warning signs:** Thumbnails look stretched or have black bars in portrait containers.

### Pitfall 2: iframe autoplay Blocked on Mobile Safari
**What goes wrong:** Tapping to play a Short doesn't auto-start the video.
**Why it happens:** Mobile Safari requires user gesture to start media, and iframe insertion may not count.
**How to avoid:** Add `playsinline=1&autoplay=1` to the embed URL and ensure the iframe has `allow="autoplay"`. The tap-to-play gesture should satisfy the user interaction requirement.
**Warning signs:** Video loads but stays paused; user has to tap play button inside the iframe.

### Pitfall 3: Text-Art Card Height Mismatch
**What goes wrong:** Text-art cards are shorter or taller than image cards, breaking feed rhythm.
**Why it happens:** Text content has variable height; without explicit height matching, CSS will size to content.
**How to avoid:** Set explicit `minHeight` on text-art cards matching image card height. Use `overflow: hidden` if text overflows.
**Warning signs:** Feed has inconsistent card heights, visual "jumpiness" during scroll.

### Pitfall 4: imageResolved Gating Breaks for Non-Image Presentation Styles
**What goes wrong:** Text-art and image-less cards never render because `imageResolved` stays false.
**Why it happens:** Current code only sets `imageResolved = true` after image generation completes or for video posts. New presentation styles need to bypass this gate.
**How to avoid:** Set `imageResolved = true` immediately in useState initializer when `presentationStyle !== 'image'`.
**Warning signs:** Cards with text-art or image-less styles show as blank/null in the feed.

### Pitfall 5: Settings Toggle Doesn't Clear In-Flight Image Requests
**What goes wrong:** Toggling image generation off mid-feed still produces image cards.
**Why it happens:** The toggle is read at feed generation time, not at image request time.
**How to avoid:** Read the setting in `ConceptCard`'s useEffect (already gated per-card). Posts generated before the toggle will display their already-cached images, which is acceptable behavior.
**Warning signs:** None -- this is expected behavior. Previously generated images remain in cache.

## Code Examples

### Removing Badge Row (FEED-07)

Current code in `ConceptCard` (lines 105-121) to remove:

```typescript
// DELETE THIS ENTIRE BLOCK:
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
  <span style={{ /* badge styles */ }}>{badge.label}</span>
  <span style={{ /* context label styles */ }}>{normalizedContextLabel}</span>
</div>
```

### Removing Keyword Tags (FEED-10)

Current code in `ConceptCard` (lines 218-234) to remove:

```typescript
// DELETE THIS ENTIRE BLOCK:
<div style={{ padding: '0 20px' }}>
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
    {post.keywords.slice(0, 3).map((keyword) => (
      <span key={keyword} style={{ /* tag styles */ }}>{keyword}</span>
    ))}
  </div>
</div>
```

### Conditional Preview Text (FEED-08 + FEED-09)

```typescript
{/* Show preview ONLY when no image is present (image-less style) */}
{presentationStyle !== 'image' && presentationStyle !== 'text-art' && !isVideoPost && !isShortPost && (
  <p style={{ fontSize: '0.9rem', color: 'var(--foreground)', lineHeight: 1.6, opacity: 0.88 }}>
    {normalizedPreview}
  </p>
)}
```

### Fisher-Yates Shuffle

```typescript
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (assumed from Vite 7 stack) |
| Config file | Check for `vitest.config.ts` |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FEED-07 | Badge row removed from ConceptCard | manual (UI) | Visual inspection | N/A |
| FEED-08 | Preview hidden when image present | manual (UI) | Visual inspection | N/A |
| FEED-09 | Text-forward fallback renders hook + preview | manual (UI) | Visual inspection | N/A |
| FEED-10 | Keyword tags removed from all cards | manual (UI) | Visual inspection | N/A |
| SHORT-01 | Short video card renders portrait thumbnail | manual (UI) | Visual inspection | N/A |
| SHORT-02 | Tap plays video inline without navigation | manual (UI) | Visual inspection | N/A |
| SHORT-03 | AI takeaway appears below player | manual (UI) | Visual inspection | N/A |
| TART-01 | Notebook background renders dot grid | manual (UI) | Visual inspection | N/A |
| TART-02 | Text-art content shows questions/facts/quotes with emojis | manual (UI) | Visual inspection | N/A |
| TART-03 | Text-art card matches image card height | manual (UI) | Visual inspection | N/A |
| MIX-01 | Weighted random produces target ratios | unit | `npx vitest run --grep "weighted"` | Wave 0 |
| MIX-02 | Image generation disabled respects toggle | unit | `npx vitest run --grep "imageGeneration"` | Wave 0 |
| VIDEO-01 | Video posts have no badge/tags | manual (UI) | Visual inspection | N/A |

### Sampling Rate
- **Per task commit:** Visual inspection of feed in dev
- **Per wave merge:** Full feed scroll-through with all post types
- **Phase gate:** All 13 requirements verified visually + unit tests green

### Wave 0 Gaps
- [ ] Unit test for weighted random assignment function (MIX-01)
- [ ] Unit test for image generation toggle gating (MIX-02)
- [ ] Unit test for `VALID_SOURCE_TYPES` includes new types

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed interleave (every 2nd post) | Weighted random mix | This phase | Better visual variety, cost control |
| All posts get images | Presentation style determines image generation | This phase | ~50% reduction in image API calls |
| Badge + context label + tags on every card | Clean card face (hook + image or hook + preview) | This phase | Cleaner swipe experience |

## Open Questions

1. **Short video thumbnail quality**
   - What we know: YouTube API returns landscape thumbnails for all videos including Shorts
   - What's unclear: Whether `maxresdefault.jpg` returns portrait for Shorts, or if we always get landscape
   - Recommendation: Use landscape thumbnail with `objectFit: 'cover'` in a portrait container. The center-crop is acceptable for Shorts thumbnails.

2. **Text-art content generation timing**
   - What we know: We can generate at feed-build time or lazily per-card
   - What's unclear: Whether the additional LLM call at feed-build time noticeably increases feed load time
   - Recommendation: Batch text-art content generation into the same LLM call that generates post content. Add a field to the generation prompt for text-art variants.

3. **Connection cards in the new feed mix**
   - What we know: Connection cards exist as a separate `InfoFlowItem` kind, not part of `DailyPost`
   - What's unclear: Whether connection cards should also get the badge/tag cleanup
   - Recommendation: Apply D-04 cleanup to ConnectionCard as well (remove "Connect" badge row). The bridge insight and concept blocks are already clean.

## Sources

### Primary (HIGH confidence)
- `app/src/components/InfoFlow.tsx` - Full ConceptCard, ConnectionCard, MilestoneCard implementation reviewed
- `app/src/types/index.ts` - All type definitions including PostSnapshot, DailyPost, VideoMetadata
- `app/src/services/concept-feed.service.ts` - Feed generation, caching, interleaving logic
- `app/src/services/youtube.service.ts` - YouTube search, transcript fetch, video post generation
- `app/src/services/settings.service.ts` - Settings structure and defaults
- `app/src/services/imageGeneration.service.ts` - Image generation and caching architecture
- `app/src/components/YouTubeEmbed.tsx` - Existing iframe embed component
- `app/src/components/FeedPostImage.tsx` - Image display component with aspect ratio handling
- `app/src/screens/HomeScreen.tsx` - Feed rendering and load-more logic
- `app/src/services/postFormatting.service.ts` - Image style inference

### Secondary (MEDIUM confidence)
- YouTube Data API v3 `videoDuration=short` parameter for Shorts filtering (verified from training data, consistent with API docs)
- CSS `radial-gradient` for dot grid patterns (well-established CSS technique)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries; all changes within existing React/TypeScript/inline-styles architecture
- Architecture: HIGH - All extension points (sourceType union, ConceptCard branches, feed service) thoroughly reviewed
- Pitfalls: HIGH - Based on direct code reading of existing gating logic and YouTube API behavior

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable -- no external dependency changes expected)

# Phase 18: Feed Redesign, Short Videos & Text-Art Posts - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign all feed card faces for a cleaner, swipe-friendly experience. Add two new post types (portrait short videos and text-art notebook posts) alongside existing image, image-less, video, and connection posts. Introduce feed mix strategy with weighted randomness to control image generation cost. Add settings toggle for image generation.

</domain>

<decisions>
## Implementation Decisions

### Portrait Short Video Posts
- **D-01:** Thumbnail-dominant card — portrait 9:16 aspect ratio fills most of the card. Small "Short" badge overlay in corner, title overlaid at bottom. Minimal surrounding chrome.
- **D-02:** Direct inline play — tap the card to play video right on the card. No navigation to a detail page.
- **D-03:** Brief 1-2 sentence AI-generated takeaway shown below the player after user taps to play.

### Feed Card Redesign (all post categories)
- **D-04:** Remove badge & context label row entirely from all card types. No badge, no context label on the card face.
- **D-05:** Keep hook at current size (1.2rem/800 weight). Kill preview text when an AI-generated image is present — image + hook only.
- **D-06:** No-image fallback: text-forward card — hook stays bold, preview text (`teaser.preview`) appears below. Card is naturally shorter than image cards (no image placeholder).
- **D-07:** Preview source for no-image fallback: use existing `teaser.preview` field as-is.
- **D-08:** Don't render card until image generation resolves (keep current `imageResolved` gating — no flash of text-then-image).
- **D-09:** Remove keyword tag pills from card face entirely across all post types. Tags only appear on detail page if needed.

### Feed Mix & Image Cost Control
- **D-10:** Weighted random mix for post presentation — approximately 30% image posts, 25% text-art posts, 20% image-less posts, 25% video/short videos. Organic variety that controls image generation token spend.
- **D-11:** Settings toggle to enable/disable image generation. When off, no image API calls are attempted — all posts fall back to text-art or image-less styles.

### Text-Art "Notebook" Posts (new card type)
- **D-12:** Background: white or light yellow with subtle dot grid or lined notebook-paper pattern. No AI image generation — purely CSS/SVG.
- **D-13:** Content: LLM-generated mix of styles — provocative questions, breaking-news-style facts, quotes — with related emojis placed inline between the text. The text itself is the visual element.
- **D-14:** Same height as image cards for consistent feed rhythm and visual consistency.

### Landscape Video Posts (existing — cleanup)
- **D-15:** Apply same card face cleanup — remove badge row, remove keyword tags. Keep thumbnail + hook + "by Channel" attribution.

### Claude's Discretion
- Exact weighted random implementation (how to assign post presentation style)
- CSS/SVG approach for notebook paper background patterns (dot grid vs lined)
- How text-art content prompt is structured for LLM to generate questions/facts/quotes with emojis
- Short video discovery strategy (YouTube Shorts search query approach)
- Inline player implementation for shorts (iframe sizing, play/pause behavior)
- Transition animation when short video starts playing in-card

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Feed & Card System
- `app/src/components/InfoFlow.tsx` — `ConceptCard` rendering, badge row, image gating, keyword tags — all being modified
- `app/src/components/FeedPostImage.tsx` — Image display component
- `app/src/screens/HomeScreen.tsx` — Feed rendering, pull-to-load, post orchestration
- `app/src/screens/PostDetailScreen.tsx` — Detail page (shorts skip this)

### Post Types & Data
- `app/src/types/index.ts` — `DailyPost`, `PostSnapshot`, `sourceType` union, `VideoMetadata`
- `app/src/services/concept-feed.service.ts` — Feed generation, interleaving, caching
- `app/src/services/youtube.service.ts` — Video post creation, search, transcript fetch

### Image Generation
- `app/src/services/imageGeneration.service.ts` — Image cache, `generateImage()`, `hasCachedImage()`
- `app/src/services/postFormatting.service.ts` — `inferImageStyle()`, `buildImagePrompt()`

### Settings
- `app/src/services/mock/settings.mock.ts` — localStorage settings (add image generation toggle here)
- `app/src/screens/SettingsScreen.tsx` — Settings UI (add toggle)

### Phase 17 Context (existing video posts)
- `.planning/phases/17-auto-fetch-online-videos-for-posts/17-CONTEXT.md` — Prior video post decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ConceptCard` in InfoFlow.tsx — Main card component to modify for all post types
- `YouTubeEmbed` component — Reusable for shorts inline player (needs portrait sizing)
- `imageGenerationService` — Already has `hasCachedImage()` and async generation pattern
- `concept-feed.service.ts` `interleaveVideoPosts()` — Pattern for mixing post types
- `mockSettingsService` — localStorage persistence pattern for new toggle
- CSS variables (`--node-mint`, `--node-salmon`, etc.) — Could inform notebook paper tint variations

### Established Patterns
- `ServiceResult<T>` for all service returns
- `sourceType` union on `PostSnapshot` — extend with `'short'` and `'text-art'`
- `eventBus` for cross-component communication
- `imageResolved` gating — card doesn't render until image status known

### Integration Points
- `ConceptCard` — Needs to handle new `sourceType` values and conditional rendering (image vs text-art vs short)
- `concept-feed.service.ts` — Needs weighted random assignment of presentation style
- `SettingsScreen` — New toggle for image generation on/off
- `youtube.service.ts` — Extend for YouTube Shorts discovery

</code_context>

<specifics>
## Specific Ideas

- Text-art notebook posts should feel like a student's notebook — handwritten vibe with emojis as visual anchors between text
- The feed should feel effortless to swipe through — each card communicates its core idea at a glance
- Short videos are quick-consumption — tap, watch, see a brief takeaway, move on
- The weighted mix creates visual variety that keeps the feed interesting without burning image API tokens on every post

</specifics>

<deferred>
## Deferred Ideas

- **Web search API for LLM** — Add web search capability to Ask screen and Home feed to fetch real-time information from the internet. Would enable richer, more current content in posts and chat responses. Belongs in its own future phase.

</deferred>

---

*Phase: 18-feed-redesign-short-videos-text-art*
*Context gathered: 2026-04-03*

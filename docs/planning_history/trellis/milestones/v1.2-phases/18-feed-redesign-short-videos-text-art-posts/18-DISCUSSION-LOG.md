# Phase 18: Feed Redesign, Short Videos & Text-Art Posts - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 18-feed-redesign-short-videos-text-art
**Areas discussed:** Short video card design, Short video interaction model, Short video content, Feed card redesign (badge, hook/preview, tags, spacing), Feed mix strategy, Image provider resolution, Text-art post design

---

## Short Video Card Design

| Option | Description | Selected |
|--------|-------------|----------|
| Thumbnail-dominant | Large portrait 9:16 thumbnail, small badge overlay, title at bottom | ✓ |
| Compact portrait | Smaller portrait thumbnail with title underneath, no description | |
| Two-column row | 2 short thumbnails side-by-side in one feed row | |

**User's choice:** Thumbnail-dominant
**Notes:** Focus on video content itself with less elements on post face

## Short Video Interaction Model

| Option | Description | Selected |
|--------|-------------|----------|
| Direct inline play | Tap card to play right there, no navigation | ✓ |
| Full-screen player | Opens immersive full-screen portrait player, swipe for next | |
| Detail page | Navigate to PostDetailScreen with embedded player + summary | |

**User's choice:** Direct inline play

## Short Video Content

| Option | Description | Selected |
|--------|-------------|----------|
| No summary | Just video, channel name, topic tag | |
| Brief takeaway | 1-2 sentence AI-generated key point below player | ✓ |
| Full summary | Same transcript summary as landscape videos | |

**User's choice:** Brief takeaway

## Badge & Context Label Row

| Option | Description | Selected |
|--------|-------------|----------|
| Remove entirely | No badge, no context label on card face | ✓ |
| Badge overlaid on image | Small translucent pill in corner of image | |
| Keep but mute | Same position, smaller/lighter text | |

**User's choice:** Remove entirely

## Hook / Title Treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Larger hook, kill preview | Bump hook size, remove preview when image present | ✓ (modified) |
| Larger hook, preview as subtitle | Hook bigger, preview shrinks to single muted line | |
| Keep both, tighten | Same structure, reduced padding | |

**User's choice:** Keep current hook size (already large enough), kill preview when image exists. Show preview as fallback when no image.
**Notes:** Led to follow-up discussion on no-image card layout

## No-Image Card Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Text-forward card | Hook bold + preview below, card naturally shorter | ✓ |
| Colored/gradient background | Tinted background using node colors, hook + preview overlay | |
| Image placeholder | Skeleton/pattern area where image would be | |

**User's choice:** Text-forward card

## Preview Source (no-image fallback)

| Option | Description | Selected |
|--------|-------------|----------|
| teaser.preview as-is | Existing preview field | ✓ |
| bodyMarkdown excerpt | First ~120 chars of full essay body | |

**User's choice:** teaser.preview as-is

## Image Loading Transition

| Option | Description | Selected |
|--------|-------------|----------|
| Swap seamlessly | Preview disappears when image arrives | |
| Don't show until resolved | Card gated on imageResolved (current behavior) | ✓ |

**User's choice:** Keep current gating behavior

## Keyword Tags

| Option | Description | Selected |
|--------|-------------|----------|
| Remove from card face | Tags only on detail page | ✓ |
| Grey/muted, max 2 | Much lighter, reduced count | |
| Single topic label | One small muted topic label | |

**User's choice:** Remove entirely

## Card Spacing

| Option | Description | Selected |
|--------|-------------|----------|
| More whitespace | Bigger gaps between cards | |
| Edge-to-edge images | Images bleed to card edges | |
| Keep current | Current spacing is fine | ✓ |

**User's choice:** Keep current spacing

## Feed Mix Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed ratio | e.g., 2 image, 1 text-art, 1 image-less per 6 posts | |
| Weighted random | ~30% image, 25% text-art, 20% image-less, 25% video/short | ✓ |
| Claude's discretion | Just make a good mix | |

**User's choice:** Weighted random

## Image Provider Resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Settings toggle | Manual enable/disable in Settings, no API calls when off | ✓ |
| Auto-detect on failure | Try once, cache status on failure | |
| Both | Toggle + auto-detect safety net | |

**User's choice:** Settings toggle

## Text-Art Content Source

| Option | Description | Selected |
|--------|-------------|----------|
| Curated hook/question | Use teaser.hook or provocative question | |
| Preview excerpt | Use teaser.preview or essay chunk | |
| Mix of styles | Questions, breaking-news facts, quotes — LLM decides | ✓ |

**User's choice:** Mix of styles
**Notes:** User wants to add more content varieties later, including web search API for real-time info. Deferred to future phase.

## Text-Art Card Size

| Option | Description | Selected |
|--------|-------------|----------|
| Same as image cards | Consistent height in feed | ✓ |
| Variable/shorter | Natural height based on content | |

**User's choice:** Same height as image cards

## Claude's Discretion

- Weighted random implementation details
- CSS/SVG approach for notebook paper backgrounds
- Text-art LLM prompt structure
- Short video discovery (YouTube Shorts search)
- Inline player implementation for shorts
- Transition animations

## Deferred Ideas

- Web search API integration for LLM in Ask and Home feed — future phase

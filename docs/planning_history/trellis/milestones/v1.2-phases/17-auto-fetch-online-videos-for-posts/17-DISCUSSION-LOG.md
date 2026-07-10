# Phase 17: Auto-fetch Online Videos for Posts - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 17-auto-fetch-online-videos-for-posts
**Areas discussed:** Video source & discovery, Content extraction, Post transformation, Thumbnail vs AI image

---

## Video Source & Discovery

| Option | Description | Selected |
|--------|-------------|----------|
| User pastes URL manually | User finds and shares YouTube links | |
| Auto-search based on SM-2 due concepts | Search YouTube for concepts due for review today | ✓ |
| Both manual + auto | Support both approaches | |

**User's choice:** Auto-search YouTube based on SM-2 due concepts. Reuse the same spaced repetition logic that drives flashcard review.
**Notes:** 3 video posts per day initially. Pull-for-more generates 4 additional each time. Video posts mix into existing feed.

---

## In-App Video Playback

| Option | Description | Selected |
|--------|-------------|----------|
| YouTube iframe embed | Embed via iframe in WebView, works on Capacitor native | ✓ |
| Link out to YouTube app | Open videos externally | |
| Native video player SDK | Use platform-specific video SDK | |

**User's choice:** YouTube iframe embed
**Notes:** User asked if YouTube can be played in-app. Confirmed iframe approach works in Capacitor WebView without native SDK.

---

## Post Transformation

| Option | Description | Selected |
|--------|-------------|----------|
| Full AI essay from transcript | Use transcript + AI to write an essay post | |
| Video card with embedded player + summary | Feed card looks like post, detail shows video + AI summary | ✓ |
| Lightweight metadata only | Just title, thumbnail, link | |

**User's choice:** Video card with embedded player + summary from transcript
**Notes:** New sourceType: 'video'. Feed card looks like a regular post. Detail page has embedded YouTube player on top + AI-generated summary below. Summary generated from video transcript via captions API.

---

## Thumbnail vs AI Image

| Option | Description | Selected |
|--------|-------------|----------|
| YouTube thumbnail | Use video thumbnail as card image — free, contextual | ✓ |
| AI-generated image | Generate image via Gemini — costs tokens | |
| Both with preference | Try thumbnail first, AI fallback | |

**User's choice:** Use YouTube thumbnail
**Notes:** Thumbnails are free and contextually relevant. No AI image generation needed for video posts.

---

## Claude's Discretion

- YouTube API key storage approach
- Transcript extraction method details
- Videos-without-transcript fallback handling
- Feed interleaving strategy
- VideoPost detail screen layout

## Deferred Ideas

None — discussion stayed within phase scope

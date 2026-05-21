---
created: 2026-05-21T19:32:00.000Z
title: "Nothing new today" empty-state card shows while the feed has content
area: ui
files:
  - app/src/screens/HomeScreen.tsx
  - app/src/locales/en.json
---

## Problem

Surfaced during device UAT (2026-05-21, screenshot). The "Nothing new today /
Check back later for fresh concepts to explore" empty-state card renders ABOVE a
curiosity feed that is clearly populated with text-art posts. The copy directly
contradicts the visible feed below it.

## Root cause (located)

`HomeScreen.tsx:959`:
```tsx
{conceptQuota === 0 && dailyPosts.length > 0 && questions.length > 0 && (
  // renders home.feed.emptyTitle / emptyBody  (lines ~974, ~977)
)}
```
The card is gated on `conceptQuota === 0` (no NEW concepts due today) but is
shown even when `dailyPosts.length > 0` — so it co-exists with the populated
`MasonryFeed` (rendered at ~1055). The intent was "no new concepts, but here's
your existing feed," but the wording reads as an empty feed.

## Direction (operator decision)

Two options:
1. Hide the card entirely when `dailyPosts.length > 0` (only show it on a truly
   empty feed).
2. Reword to distinguish "no NEW concepts today" from "empty feed" (e.g.
   "You're all caught up on new concepts — here's more to revisit") so it makes
   sense sitting above review content.

Pick the messaging direction with the operator. Localize the new copy in all 4
bundles (en/zh/es/ja) per the i18n workflow.

## Routing

Triage into Phase 56 (UI Polish). NOT part of Phase 55.1.

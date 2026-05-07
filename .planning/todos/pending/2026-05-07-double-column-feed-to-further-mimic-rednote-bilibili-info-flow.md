---
created: 2026-05-07T09:44:12.954Z
title: Double column feed to further mimic Rednote/Bilibili info flow
area: ui
files:
  - app/src/components/InfoFlow.tsx
  - app/src/screens/HomeScreen.tsx
---

## Problem

The home post feed (`InfoFlow`) currently renders as a single-column vertical list. To more closely mimic the Xiaohongshu (Rednote) / Bilibili discovery-feed UX — which is the implicit reference for this surface — switch to a two-column masonry layout where cards have variable heights and tile in alternating columns. Single-column feeds feel longer-form and content-heavy; two-column masonry reads as denser, more browsable, and visually closer to the social discovery feeds users already pattern-match to.

Constraints / things to think through before picking this up:
- Mixed post types (image, text-art, video, short, news, suggestion) have very different intrinsic heights — masonry needs to handle variable card heights without huge whitespace.
- The lazy-skip walker + infinite-scroll pipeline (`useInfiniteScroll`, `concept-feed.service.ts`) feeds posts in order; two-column placement must not break the cycle-position invariants documented in CLAUDE.md (the derived list is append-only, the queue is cyclic, 4 served per swipe).
- Detail navigation (`onOpen` → `/posts/:id`) and tap-to-play short cards (`InfoFlow.tsx:295`, `setVideoPlaying`) must still fire the existing CONCEPT_EXPLORED detectors (Phase 36 GAP-C, see CLAUDE.md "Video & short post completion signals").
- Header positioning is portal-vs-in-tree depending on context (CLAUDE.md "Header positioning") — don't add `transform`/`will-change`/`filter` to ancestors of the column wrappers.
- Visual rhythm: alternating short-form cards (shorts, image) with longer text-art / news cards is part of why the Rednote feed feels engaging — placement strategy should preserve some of that spread.

## Solution

TBD. Two natural approaches:

1. **CSS columns** (`column-count: 2; column-gap: 8px`) on the feed container — simplest, but card order flows top-to-bottom-then-next-column rather than left-right zigzag, which doesn't match Rednote.
2. **Manual 2-column masonry** — track each column's running height in state, append the next post to the shorter column. Matches Rednote behavior exactly. Slightly more work but the right pattern.

Recommend (2). Implement as a layout wrapper around the existing card components rather than rewriting the cards themselves. Verify on Android WebView since that's where layout regressions historically bite (CLAUDE.md best practice rule 3).

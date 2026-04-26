# Phase 33: EchoLearn → Trellis Rebrand

## Overview

Rebrand the app from "EchoLearn" to "Trellis" across all user-visible surfaces, app configuration, and platform assets. Logo asset: `Assets/Trellis_logo.png` (2048x2048 RGBA PNG).

## Completed (commit pending)

### App Configuration
- [x] `capacitor.config.ts` — appId `com.echolearn.app` → `com.trellis.app`, appName → `Trellis`
- [x] `ios/App/App/capacitor.config.json` — same
- [x] `android/.../capacitor.config.json` — same
- [x] `ios/App/App/Info.plist` — CFBundleDisplayName → `Trellis`, microphone description updated
- [x] `index.html` — `<title>Trellis</title>`, favicon links updated to PNG icons

### iOS App Icon
- [x] `AppIcon-512@2x.png` replaced (1024x1024 resized from Trellis logo)

### Web Icons
- [x] `public/favicon-32x32.png` — generated
- [x] `public/favicon-16x16.png` — generated
- [x] `public/apple-touch-icon.png` (180x180) — generated
- [x] `public/pwa-192x192.png` — generated
- [x] `public/pwa-512x512.png` — generated

### User-Visible Strings (all 4 locales: en/zh/es/ja)
- [x] Onboarding: "Welcome to Trellis", privacy consent intro/blurb, skip button
- [x] Settings about: "Trellis v1.0.0"
- [x] Settings privacy blurb: "Trellis is local-first..."
- [x] Consent: "Trellis never transmits..." / "Skip — I'll use Trellis without AI features"
- [x] Starter posts: "Welcome to Trellis", "Trellis follows a proven learning loop..."
- [x] Starter post keywords: `['trellis', 'getting-started']`
- [x] Podcast fallback script: "Welcome to your daily Trellis podcast..."
- [x] Notification body: "Tap to open Trellis..."
- [x] GraphScreen theme name: `'Trellis'`
- [x] Email subjects: `Trellis%20Feedback`
- [x] Comment: `// Trellis is local-first OSS...`

### Internal Console Prefixes
- [x] All `[EchoLearn]` console.warn prefixes → `[Trellis]` (7 files)

### Android App Icon
- [ ] **Deferred** — user will replace manually in Android Studio

## Deferred: localStorage Key Migration

All `echolearn_` localStorage keys and the `echolearn` SQLite connection name were **intentionally left unchanged** to avoid wiping existing user data on upgrade. This requires a migration step.

### Keys to migrate (48 occurrences across 25 files)

Prefix `echolearn_` → `trellis_` for all keys:

**Core data stores:**
- `echolearn_questions` — question.service.ts, canonical-knowledge.service.ts (×4)
- `echolearn_settings` — settings.service.ts
- `echolearn_flashcards` — flashcard.service.ts

**Feed pipeline:**
- `echolearn_daily_posts` — concept-feed.service.ts
- `echolearn_connection_posts` — concept-feed.service.ts
- `echolearn_post_history` — post-history.service.ts, concept-feed-dedup.ts (×3)
- `echolearn_post_queue` — post-queue.service.ts
- `echolearn_video_cache` — youtube.service.ts, concept-feed.service.ts
- `echolearn_news_posts` — concept-feed.service.ts
- `echolearn_short_posts` — concept-feed.service.ts

**Services:**
- `echolearn_ask_rate_limit` — ask-rate-limiter.service.ts
- `echolearn_trajectory_signals` — trajectoryAnalyzer.service.ts
- `echolearn_feed_views` — trajectoryAnalyzer.service.ts
- `echolearn_planned_moves` — plannerAutoGen.service.ts
- `echolearn_suggestions_last_refresh` — plannerAutoGen.service.ts
- `echolearn_planner_chunks` — planner.service.ts
- `echolearn_planner_checkins` — planner.service.ts
- `echolearn_planner_refresh_enabled` — SettingsFeaturesScreen.tsx
- `echolearn_planner_refresh_time` — SettingsFeaturesScreen.tsx
- `echolearn_reorg_snapshot` — canonical-knowledge.service.ts
- `echolearn_api_availability_day` — api-availability.ts

**Other persistence:**
- `echolearn_active_session` — session.service.ts
- `echolearn_sessions` — session.service.ts
- `echolearn` SQLite connection — db.service.ts

**IndexedDB stores** (podcast audio, image blobs):
- `echolearn_podcast_audio` — podcast.service.ts
- `echolearn_images` — imageGeneration.service.ts

### Migration strategy

1. Create a `migrateLegacyKeys()` function in a new `migration.service.ts`
2. On app startup (before any service init), check if `echolearn_settings` exists in localStorage
3. If found: iterate all known key names, copy `echolearn_X` → `trellis_X`, delete old keys
4. SQLite: check for `echolearn` database, if exists create `trellis` database, copy tables, drop old
5. IndexedDB: similar key-prefix migration
6. Set a `trellis_migration_v1_complete` flag to skip on subsequent launches
7. All service `STORAGE_KEY` constants updated from `echolearn_` to `trellis_` prefix

### When

After presentation. User will request as a separate task in a future session.

## Verification

- [x] TypeScript compiles clean (`tsc --noEmit` — 0 errors)
- [x] Bundle parity test passes (all 4 locale key sets match)
- [x] Full test suite: 449 pass / 27 fail (baseline unchanged — 27 failures are pre-existing JSON import attribute errors, not regressions)
- [x] No user-visible "EchoLearn" string remains in `app/src/` (grep verified)
- [x] All `echolearn_` localStorage keys preserved (48 occurrences, data backward-compatible)

---

## Functional Changes Addendum (Phase 34 close-out, 2026-04-25)

Per 34-CONTEXT.md D-11, the rebrand WIP carries the following functional improvements alongside the cosmetic rebrand. They are committed in **Commit 2** of the 5-commit shape (`refactor(feed+review): JSON parser hardening, image pre-gen architecture shift, queue tuning, ReviewScreen dedup`):

1. **Truncation-tolerant JSON parser** in `concept-feed.service.ts` — defends against partial LLM streams returning incomplete JSON; falls back to recoverable parse instead of throwing.
2. **ReviewScreen flashcard dedup (two-pass)** in `ReviewScreen.tsx` — eliminates duplicate flashcards in the daily review queue across sessions.
3. **Style weight rebalance** in `style-assignment.ts` — text-art bumped 40 → 55%, news dropped 20 → 10% (`STYLE_WEIGHTS` const).
4. **REFILL_THRESHOLD bumped 8 → 12** in `post-queue.service.ts` — earlier refill triggers prevent the queue from emptying mid-swipe while image-gen is in flight (CLAUDE.md "Numeric defaults" updated).
5. **`enqueueInterleaved` method** added to `post-queue.service.ts` — interleaves news/connection cards alongside concept-driven posts.
6. **Image pre-generation moved from `HomeScreen.handleLoad` to `concept-feed.service.ts:refillQueue`** — cycle-aware pre-gen so images are ready when the queue serves them. **Test guard updated by Plan 34-02** (`HomeScreen.image-pregen-filter.test.mjs` now reads `concept-feed.service.ts:refillQueue` instead of `HomeScreen.tsx:handleLoad`).
7. **In-flight image dedupe** in `imageGeneration.service.ts` — second concurrent request for the same prompt key returns the first request's promise instead of starting a new generation.
8. **InfoFlow div role refactor** in `InfoFlow.tsx` — accessibility improvements; explicit `role="button"` for tappable cards.

### Why bundled with rebrand

Per 34-CONTEXT.md D-11: "Acceptable because they're behind code paths already audited (post-queue, concept-feed) and tests still pass." Test baseline before/after: 449 pass / 27 fail held (or improved post-Plan 34-01/02).

### Out of scope (deferred to v1.5)

- Append-only derived list + persistent cycle position in concept-feed pipeline (CLAUDE.md "Concept Feed Generation Pipeline" gaps).
- localStorage key migration (`echolearn_*` → `trellis_*`) — preserved intentionally to avoid disrupting existing user data.

---
*Addendum created: 2026-04-25. Author: Phase 34 plan 34-08.*

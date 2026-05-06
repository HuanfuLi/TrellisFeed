---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 08
type: execute
wave: 2
depends_on: ["06", "07"]
files_modified:
  - app/src/components/YouTubeEmbed.tsx
  - app/src/components/InfoFlow.tsx
  - app/src/screens/PostDetailScreen.tsx
  - app/tests/screens/PostDetailScreen.video-detector.test.mjs
  - app/tests/components/InfoFlow.short-tap-emit.test.mjs
  - CLAUDE.md
  - .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT-RETEST.md
autonomous: true
requirements: [GAP-C]
gap_closure: true
must_haves:
  truths:
    - "Video posts (sourceType === 'video') opened in PostDetailScreen fire CONCEPT_EXPLORED via a YouTube IFrame API postMessage detector when the player reaches state ENDED (info=0) OR currentTime/duration ≥ 0.8."
    - "Short posts (sourceType === 'short') in the home feed fire CONCEPT_EXPLORED when the user taps to play (via InfoFlow's setVideoPlaying handler), since shorts never navigate to PostDetailScreen and cannot use the existing detectors."
    - "YouTubeEmbed iframe src includes `enablejsapi=1` so postMessage events from YouTube reach the parent window."
    - "Both feed iframes (video + short in InfoFlow) include `enablejsapi=1` for future symmetry, but only the InfoFlow short tap-to-play handler emits — feed video posts route to PostDetailScreen via onOpen for the postMessage detector."
    - "Existing detectors A/B/C are unchanged. The new Detector D listens for `https://www.youtube.com` origin only (security)."
    - "No new event types are introduced — both code paths emit the existing `CONCEPT_EXPLORED` event."
    - "Phase 33 fixes preserved (dueAnchors filter, allExplored cap-gate). Phase 36-01..05 fixes preserved (stratified allocation, derived list, walker)."
  artifacts:
    - path: app/src/components/YouTubeEmbed.tsx
      provides: "iframe src with enablejsapi=1 query param"
      contains: "enablejsapi=1"
    - path: app/src/components/InfoFlow.tsx
      provides: "Short tap-to-play emit + enablejsapi=1 in feed iframes"
      contains: "dailyReadService.markExplored"
    - path: app/src/screens/PostDetailScreen.tsx
      provides: "Detector D — YouTube IFrame API postMessage listener for video posts"
      contains: "Detector D"
    - path: app/tests/screens/PostDetailScreen.video-detector.test.mjs
      provides: "Source-reading + behavior test asserting Detector D parses ENDED postMessage"
      contains: "Detector D"
    - path: app/tests/components/InfoFlow.short-tap-emit.test.mjs
      provides: "Source-reading test asserting setVideoPlaying for shorts emits CONCEPT_EXPLORED"
      contains: "short tap"
    - path: CLAUDE.md
      provides: "Documentation of video/short completion-signal detectors"
      contains: "Detector D"
  key_links:
    - from: "app/src/components/YouTubeEmbed.tsx (iframe src)"
      to: "app/src/screens/PostDetailScreen.tsx (Detector D window message listener)"
      via: "YouTube IFrame API postMessage protocol — requires enablejsapi=1 to activate"
      pattern: "enablejsapi=1"
    - from: "app/src/components/InfoFlow.tsx (setVideoPlaying tap handler for shorts)"
      to: "app/src/services/daily-read.service.ts (markExplored + CONCEPT_EXPLORED emit)"
      via: "direct call from the onClick handler at the short card branch"
      pattern: "dailyReadService.markExplored"
---

<objective>
Close GAP-C (MAJOR): video and short posts have ZERO completion-signal paths. Two compounding architectural failures, neither caused by Phase 36 (pre-existing drift since video/short presentation styles were added in Phase 17/18 era):

(1) **Video posts (full-length, sourceType === 'video')**: open in PostDetailScreen but the YouTube iframe (`YouTubeEmbed.tsx`) renders WITHOUT `enablejsapi=1`, so YouTube's IFrame Player API postMessage channel is closed. Even if Detector D were added today, the player is an opaque wall. Detector A (scroll-70%) is structurally unreliable for video posts (sentinel position depends on essay length + video height + viewport). Detector B (30s dwell) fires only IF user stays 30s+ — fails for short videos served as 'video' type. Detector C (Q&A follow-up) requires user submission.

(2) **Short posts (sourceType === 'short')**: `InfoFlow.tsx:295` sets `interactive = !isShortPost` blocking navigation to PostDetailScreen entirely. Shorts play inline in the feed; ZERO signal paths exist.

Fix architecture (per UAT.md "missing" prescription):
- For video posts: add `enablejsapi=1` to YouTubeEmbed iframe src + add Detector D (window 'message' listener) in PostDetailScreen that parses YouTube IFrame API postMessage events. Listen for `{event:'onStateChange', info:0}` (ENDED) and `{event:'infoDelivery', info:{currentTime, duration}}` (heartbeat). Fire `emitExplored` on ENDED OR when currentTime/duration ≥ 0.8. Trust origin `https://www.youtube.com` only.
- For short posts: tap-to-play is a strong implicit signal (5-15s clips). Wire `InfoFlow.tsx`'s `setVideoPlaying(post.id)` tap-to-play handler at line 423 to ALSO call `dailyReadService.markExplored(anchorId)` + emit `CONCEPT_EXPLORED` with the resolved anchor ID. Resolve anchor via existing `getAnchorIdForPost(post, byId)` from daily-read.service.

DO NOT introduce new event types — reuse `CONCEPT_EXPLORED`. DO NOT redesign the post detail flow. DO NOT touch the detectors A/B/C; add D alongside them.

Purpose: Restore the design intent that video/short engagement = concept-explored signal, so the lazy-skip walker stops re-suggesting watched concepts and the vine progress increments correctly.

Output: 3 production code changes (YouTubeEmbed + InfoFlow + PostDetailScreen), 2 new tests, 1 CLAUDE.md documentation block.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT.md
@.planning/debug/video-completion-signal-missing.md
@CLAUDE.md
@app/src/components/YouTubeEmbed.tsx
@app/src/components/InfoFlow.tsx
@app/src/screens/PostDetailScreen.tsx
@app/src/services/daily-read.service.ts
@app/src/lib/event-bus.ts
@app/src/services/question.service.ts

<interfaces>
Detectors A/B/C in PostDetailScreen.tsx (lines 124-149, 406-411):
```typescript
// Detector A: Scroll 70% sentinel (IntersectionObserver) — line 124-137
// Detector B: 30s dwell timer — line 139-149
// Detector C: Q&A follow-up — line 409 (handleAsk -> emitExplored)
const emitExplored = useCallback((anchorId: string) => {
  if (hasEmittedRef.current) return;
  if (dailyReadService.isExplored(anchorId)) { hasEmittedRef.current = true; return; }
  hasEmittedRef.current = true;
  dailyReadService.markExplored(anchorId);
  eventBus.emit({ type: 'CONCEPT_EXPLORED', payload: { anchorId } });
}, []);
```

YouTube IFrame API postMessage protocol (no SDK needed — direct postMessage events):
- ENDED state: `{ event: 'onStateChange', info: 0 }`  (info=0 means ENDED; -1=UNSTARTED, 0=ENDED, 1=PLAYING, 2=PAUSED, 3=BUFFERING, 5=CUED)
- Heartbeat (every ~250ms during playback): `{ event: 'infoDelivery', info: { currentTime: number, duration: number, ... } }`
- Origin: messages arrive from `https://www.youtube.com` (or `https://www.youtube-nocookie.com` for the privacy domain). Trust origin via `event.origin` check.
- Activation requires `enablejsapi=1` in the iframe src AND the iframe must be loaded from `youtube.com` (not a local file://). Capacitor in-app webview serves from a real http(s) origin so this works on iOS/Android.

InfoFlow short tap-to-play handler (line 420-424 — ConceptCard component scope):
```typescript
onClick={(e) => {
  if (videoPlaying !== post.id) {
    e.stopPropagation();
    setVideoPlaying(post.id);
  }
}}
```

InfoFlow currently does NOT import `dailyReadService`, `getAnchorIdForPost`, `eventBus`, or `questionService`. New imports required.

`dailyReadService.markExplored(anchorId)` is idempotent (line 60-65 of daily-read.service.ts):
```typescript
markExplored(anchorId: string): void {
  const state = loadState();
  if (!state.exploredAnchors.includes(anchorId)) {
    state.exploredAnchors.push(anchorId);
    saveState(state);
  }
}
```

`getAnchorIdForPost(post, byId)` returns the anchor ID or null (daily-read.service.ts:101-111). Caller must build the byId map from questionService.getAll().

`eventBus.emit({ type: 'CONCEPT_EXPLORED', payload: { anchorId } })` — already used by PostDetailScreen's emitExplored at line 121. Reuse exact same shape.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add enablejsapi=1 to YouTubeEmbed + InfoFlow feed iframes</name>
  <files>app/src/components/YouTubeEmbed.tsx, app/src/components/InfoFlow.tsx</files>
  <read_first>
    - app/src/components/YouTubeEmbed.tsx (full file — single iframe at line 21)
    - app/src/components/InfoFlow.tsx (lines 337-339 video iframe, lines 438-440 short iframe)
    - .planning/debug/video-completion-signal-missing.md (Evidence: YouTubeEmbed.tsx and InfoFlow.tsx iframe srcs)
    - .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT.md (Gap 3 missing field — names enablejsapi=1 specifically)
  </read_first>
  <action>
    EDIT 1 — `app/src/components/YouTubeEmbed.tsx` line 21:

REPLACE:
```typescript
        src={`https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0`}
```

WITH (verbatim):
```typescript
        // Phase 36 GAP-C: enablejsapi=1 activates the YouTube IFrame Player API
        // postMessage channel — required for Detector D in PostDetailScreen to
        // observe ENDED + currentTime events. See .planning/debug/video-completion-signal-missing.md.
        src={`https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&enablejsapi=1`}
```

EDIT 2 — `app/src/components/InfoFlow.tsx` line 338 (video card inline iframe in the feed):

REPLACE:
```typescript
                  src={`https://www.youtube.com/embed/${post.videoMeta.videoId}?autoplay=1&playsinline=1&rel=0`}
```

WITH (verbatim):
```typescript
                  // Phase 36 GAP-C: enablejsapi=1 added for symmetry with YouTubeEmbed.
                  // Inline-feed video posts route to PostDetailScreen via onOpen for the
                  // Detector D postMessage path; this iframe is the inline preview.
                  src={`https://www.youtube.com/embed/${post.videoMeta.videoId}?autoplay=1&playsinline=1&rel=0&enablejsapi=1`}
```

EDIT 3 — `app/src/components/InfoFlow.tsx` line 439 (short card inline iframe in the feed):

REPLACE:
```typescript
                  src={`https://www.youtube.com/embed/${post.videoMeta.videoId}?playsinline=1&autoplay=1&rel=0`}
```

WITH (verbatim):
```typescript
                  // Phase 36 GAP-C: enablejsapi=1 added for symmetry. Shorts emit
                  // CONCEPT_EXPLORED on tap-to-play (see setVideoPlaying handler) — the
                  // postMessage path is not used here, but keep the param for any future
                  // postMessage-based detection on shorts.
                  src={`https://www.youtube.com/embed/${post.videoMeta.videoId}?playsinline=1&autoplay=1&rel=0&enablejsapi=1`}
```

NO other changes. Do NOT modify the iframe attributes (allow / allowFullScreen / referrerPolicy / title) — those are correct.
  </action>
  <verify>
    <automated>cd app && grep -c "enablejsapi=1" src/components/YouTubeEmbed.tsx src/components/InfoFlow.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "enablejsapi=1" app/src/components/YouTubeEmbed.tsx` returns 1
    - `grep -c "enablejsapi=1" app/src/components/InfoFlow.tsx` returns ≥2 (one for video iframe, one for short iframe)
    - `grep -c "Phase 36 GAP-C" app/src/components/YouTubeEmbed.tsx` returns 1
    - `grep -c "Phase 36 GAP-C" app/src/components/InfoFlow.tsx` returns ≥2
    - `cd app && npx tsc -b --noEmit` exits 0
  </acceptance_criteria>
  <done>
    All three iframe srcs include `enablejsapi=1`; comment blocks reference Phase 36 GAP-C; tsc clean.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add Detector D (YouTube postMessage listener) to PostDetailScreen for video posts</name>
  <files>app/src/screens/PostDetailScreen.tsx</files>
  <read_first>
    - app/src/screens/PostDetailScreen.tsx (lines 100-150 emitExplored + Detectors A/B; line 406-411 Detector C; line 589-601 video render branch)
    - app/src/services/daily-read.service.ts (markExplored + getAnchorIdForPost)
    - .planning/debug/video-completion-signal-missing.md (full diagnosis — note YouTube IFrame API protocol details)
    - .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT.md (Gap 3 missing field — exact postMessage parsing prescription)
  </read_first>
  <action>
    Add a new useEffect block in PostDetailScreen.tsx, INSERTED IMMEDIATELY AFTER the Detector B useEffect (which currently ends at line 149). The new block becomes "Detector D" — Detector C is the existing Q&A follow-up at line 406-411 (NOT a new detector; just label-aligned with existing comments).

INSERT the following block (verbatim) after line 149 and before the line 152 useEffect that calls `postHistoryService.addPost`:

```typescript
  // Detector D: YouTube IFrame API postMessage listener for video posts (Phase 36 GAP-C).
  // The iframe in YouTubeEmbed.tsx now includes `enablejsapi=1`, which activates YouTube's
  // postMessage protocol. We listen for two event shapes:
  //   - { event: 'onStateChange', info: 0 } — playback ENDED (info=0; -1=UNSTARTED, 0=ENDED, 1=PLAYING, 2=PAUSED, 3=BUFFERING, 5=CUED)
  //   - { event: 'infoDelivery', info: { currentTime, duration, ... } } — heartbeat (~250ms)
  // Fire emitExplored on ENDED OR when currentTime/duration ≥ 0.8 (video substantially watched).
  // Origin is restricted to https://www.youtube.com (and the privacy mirror youtube-nocookie.com)
  // to prevent untrusted page from spoofing concept-explored signals.
  // See .planning/debug/video-completion-signal-missing.md for the full diagnosis;
  // CLAUDE.md "Concept Feed Generation Pipeline" section documents this contract.
  useEffect(() => {
    if (!post) return;
    if (post.sourceType !== 'video') return;
    if (!resolvedAnchorId) return;
    if (dailyReadService.isExplored(resolvedAnchorId)) return;

    const handleMessage = (event: MessageEvent) => {
      // Origin allowlist — only trust messages from YouTube domains.
      if (event.origin !== 'https://www.youtube.com' && event.origin !== 'https://www.youtube-nocookie.com') {
        return;
      }
      // YouTube IFrame API sends a JSON-encoded string. Parse defensively — some
      // unrelated postMessage payloads (e.g., from extensions) may arrive as objects.
      let data: { event?: string; info?: unknown };
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (!data || typeof data !== 'object') return;

      // ENDED state — emit immediately.
      if (data.event === 'onStateChange' && data.info === 0) {
        emitExplored(resolvedAnchorId);
        return;
      }
      // Heartbeat — emit when watched ≥ 80% of duration.
      if (data.event === 'infoDelivery' && data.info && typeof data.info === 'object') {
        const info = data.info as { currentTime?: number; duration?: number };
        if (typeof info.currentTime === 'number' && typeof info.duration === 'number' && info.duration > 0) {
          if (info.currentTime / info.duration >= 0.8) {
            emitExplored(resolvedAnchorId);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [post?.id, post?.sourceType, resolvedAnchorId, emitExplored]);
```

NO changes to Detectors A/B/C. NO changes to the video render branch at lines 589-601 (YouTubeEmbed remains the renderer). NO changes to `emitExplored` (the existing helper is reused as-is — it's already idempotent via `hasEmittedRef`).

Note on dependencies: the `[post?.id, post?.sourceType, resolvedAnchorId, emitExplored]` array follows the same pattern as Detectors A/B (which use `[resolvedAnchorId, emitExplored]`). The added `post?.id` and `post?.sourceType` are defensive — re-attach the listener when the post changes (e.g., user opens a different video post via deeplink without navigating away).

Note on `dailyReadService` import: PostDetailScreen.tsx already imports `dailyReadService` at line 14 — no new import needed.
  </action>
  <verify>
    <automated>cd app && grep -c "Detector D" src/screens/PostDetailScreen.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "Detector D" app/src/screens/PostDetailScreen.tsx` returns ≥1
    - `grep -c "onStateChange" app/src/screens/PostDetailScreen.tsx` returns ≥1
    - `grep -c "infoDelivery" app/src/screens/PostDetailScreen.tsx` returns ≥1
    - `grep -c "https://www.youtube.com" app/src/screens/PostDetailScreen.tsx` returns ≥1 (origin allowlist)
    - `grep -c "addEventListener('message'" app/src/screens/PostDetailScreen.tsx` returns ≥1
    - `grep -c "removeEventListener('message'" app/src/screens/PostDetailScreen.tsx` returns ≥1
    - The existing Detectors A and B code (lines 124-149) is byte-unchanged: `grep -c "Detector A: Scroll 70%" app/src/screens/PostDetailScreen.tsx` returns 1 AND `grep -c "Detector B: 30s dwell" app/src/screens/PostDetailScreen.tsx` returns 1
    - `cd app && npx tsc -b --noEmit` exits 0
  </acceptance_criteria>
  <done>
    Detector D useEffect exists in PostDetailScreen.tsx; parses YouTube IFrame API postMessage events; restricts origin to YouTube domains; fires emitExplored on ENDED or ≥80% playback; cleanup function removes the listener; Detectors A/B/C unchanged; tsc clean.
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire short tap-to-play emit in InfoFlow.tsx</name>
  <files>app/src/components/InfoFlow.tsx</files>
  <read_first>
    - app/src/components/InfoFlow.tsx (lines 1-16 imports; line 70 ConceptCard signature; lines 418-424 short tap-to-play onClick handler; line 819 parent setVideoPlaying state)
    - app/src/services/daily-read.service.ts (markExplored, getAnchorIdForPost)
    - app/src/services/question.service.ts (getAll signature)
    - app/src/lib/event-bus.ts (eventBus.emit signature — match shape from PostDetailScreen line 121)
  </read_first>
  <action>
    EDIT 1 — `app/src/components/InfoFlow.tsx` add new imports near the top of the file. Find the import block (lines 1-13) and ADD these new imports after the existing service imports (verbatim — do NOT consolidate with existing imports):

```typescript
import { dailyReadService, getAnchorIdForPost } from '../services/daily-read.service';
import { questionService } from '../services/question.service';
import { eventBus } from '../lib/event-bus';
```

(Place these AFTER the line `import { settingsService } from '../services/settings.service';` and BEFORE the line `import { SuggestionCard } from './SuggestionCard';`. Order matters for diff-readability but not behavior.)

EDIT 2 — modify the short card onClick handler at line 420-424. Find:

```typescript
            onClick={(e) => {
              if (videoPlaying !== post.id) {
                e.stopPropagation();
                setVideoPlaying(post.id);
              }
            }}
```

REPLACE WITH (verbatim):

```typescript
            onClick={(e) => {
              if (videoPlaying !== post.id) {
                e.stopPropagation();
                setVideoPlaying(post.id);
                // Phase 36 GAP-C: tap-to-play on a short post is a strong implicit
                // completion signal (5-15s clips). Shorts have interactive=false at
                // ConceptCard line 295 — they never navigate to PostDetailScreen, so
                // Detectors A/B/C/D never run. Emit CONCEPT_EXPLORED here instead.
                // Idempotent via dailyReadService.markExplored (no-op if already set).
                // See .planning/debug/video-completion-signal-missing.md.
                try {
                  const allQ = questionService.getAll({ includeFlagged: true });
                  const byId = new Map(allQ.map(q => [q.id, q]));
                  const anchorId = getAnchorIdForPost(post, byId);
                  if (anchorId && !dailyReadService.isExplored(anchorId)) {
                    dailyReadService.markExplored(anchorId);
                    eventBus.emit({ type: 'CONCEPT_EXPLORED', payload: { anchorId } });
                  }
                } catch (err) {
                  // Defensive: never let signal-emit errors break tap-to-play.
                  console.warn('[InfoFlow] short tap-to-play emit failed:', err);
                }
              }
            }}
```

NO other changes to InfoFlow. Do NOT modify the video card onClick at line 368-371 — those video posts route via `onOpen → PostDetailScreen → Detector D` (the postMessage path covers them). Adding emit here too would double-fire for video posts that the user opens to detail.

Do NOT touch the parent `videoPlaying` state at line 819 or the swipe-stop logic at lines 826-868 — those are unrelated to GAP-C.
  </action>
  <verify>
    <automated>cd app && grep -c "Phase 36 GAP-C" src/components/InfoFlow.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "import { dailyReadService, getAnchorIdForPost }" app/src/components/InfoFlow.tsx` returns 1
    - `grep -c "import { questionService }" app/src/components/InfoFlow.tsx` returns 1
    - `grep -c "import { eventBus }" app/src/components/InfoFlow.tsx` returns 1
    - `grep -c "dailyReadService.markExplored" app/src/components/InfoFlow.tsx` returns 1
    - `grep -c "type: 'CONCEPT_EXPLORED'" app/src/components/InfoFlow.tsx` returns 1
    - The video card onClick at line 368-371 is byte-unchanged (does NOT contain markExplored): use a regex that finds the video card branch and asserts no markExplored within ~5 lines. Verifiable via: `awk '/setVideoPlaying\(post.id\);/' RS='\\n' app/src/components/InfoFlow.tsx | grep -c markExplored` returns exactly 1 (only the short branch, not the video branch). If this awk pattern is unreliable on macOS BSD awk, use the simpler byte-stable check: `grep -c "markExplored" app/src/components/InfoFlow.tsx` returns exactly 1.
    - `cd app && npx tsc -b --noEmit` exits 0
  </acceptance_criteria>
  <done>
    InfoFlow.tsx has new imports for dailyReadService/questionService/eventBus; short tap-to-play onClick fires markExplored + CONCEPT_EXPLORED with the resolved anchor ID; video card onClick unchanged; tsc clean.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Source-reading tests for Detector D + short tap emit</name>
  <files>app/tests/screens/PostDetailScreen.video-detector.test.mjs, app/tests/components/InfoFlow.short-tap-emit.test.mjs</files>
  <read_first>
    - app/src/screens/PostDetailScreen.tsx (verify the post-edit Detector D block strings are stable)
    - app/src/components/InfoFlow.tsx (verify the post-edit short onClick block strings are stable)
    - app/tests/components/ChatInput.flex-shrink.test.mjs (existing source-reading test pattern)
    - .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT.md (Gap 3 missing field — last bullet calls for these tests)
  </read_first>
  <behavior>
    Test file 1 — PostDetailScreen.video-detector.test.mjs:
    - Test 1: source contains "Detector D" comment block
    - Test 2: source contains origin allowlist for `https://www.youtube.com`
    - Test 3: source contains `data.event === 'onStateChange' && data.info === 0` (ENDED detection)
    - Test 4: source contains `info.currentTime / info.duration >= 0.8` (heartbeat threshold)
    - Test 5: source contains `window.addEventListener('message'` AND `window.removeEventListener('message'` (cleanup invariant — listener registered AND removed)
    - Test 6: Detectors A and B comment headers still present (regression guard — fix did not delete the existing detectors)

    Test file 2 — InfoFlow.short-tap-emit.test.mjs:
    - Test 1: source contains "Phase 36 GAP-C" comment in the short tap branch
    - Test 2: source contains `dailyReadService.markExplored(anchorId)` exactly once (only in the short branch)
    - Test 3: source contains `type: 'CONCEPT_EXPLORED'` exactly once (only in the short branch)
    - Test 4: source contains the new imports (`dailyReadService`, `getAnchorIdForPost`, `questionService`, `eventBus`)
  </behavior>
  <action>
    CREATE FILE 1 — `app/tests/screens/PostDetailScreen.video-detector.test.mjs` (verbatim):

```javascript
// Phase 36 GAP-C regression guard: ensures PostDetailScreen.tsx contains Detector D
// (YouTube IFrame API postMessage listener) for video posts, and Detectors A/B
// remain intact. See .planning/debug/video-completion-signal-missing.md.
//
// Source-reading test (no React render harness needed) — same pattern as
// app/tests/components/ChatInput.flex-shrink.test.mjs.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POST_DETAIL_PATH = resolve(__dirname, '../../src/screens/PostDetailScreen.tsx');
const source = readFileSync(POST_DETAIL_PATH, 'utf-8');

describe('PostDetailScreen Detector D (Phase 36 GAP-C)', () => {
  it('contains Detector D comment block for video posts', () => {
    assert.ok(
      source.includes('Detector D'),
      'PostDetailScreen.tsx must declare Detector D — the YouTube IFrame API postMessage listener for video posts. See .planning/debug/video-completion-signal-missing.md.',
    );
  });

  it('restricts postMessage origin to YouTube domains', () => {
    assert.ok(
      source.includes("event.origin !== 'https://www.youtube.com'"),
      'Detector D must check event.origin against https://www.youtube.com to prevent spoofed concept-explored signals from untrusted iframes.',
    );
    assert.ok(
      source.includes('youtube-nocookie.com'),
      'Detector D should also accept the privacy-mirror domain youtube-nocookie.com (used by some Capacitor configs).',
    );
  });

  it('parses ENDED state from onStateChange events', () => {
    assert.ok(
      source.includes("data.event === 'onStateChange' && data.info === 0"),
      'Detector D must fire emitExplored when YouTube reports state change to ENDED (info=0). info=0 is the ENDED state per YouTube IFrame API spec.',
    );
  });

  it('parses heartbeat events and fires at >=80% playback', () => {
    assert.ok(
      source.includes("data.event === 'infoDelivery'"),
      'Detector D must parse infoDelivery heartbeat events.',
    );
    assert.ok(
      source.includes('info.currentTime / info.duration >= 0.8'),
      'Detector D must fire emitExplored when currentTime/duration >= 0.8 (video substantially watched).',
    );
  });

  it('registers and cleans up the message listener', () => {
    assert.ok(
      source.includes("window.addEventListener('message'"),
      'Detector D must register a window message listener.',
    );
    assert.ok(
      source.includes("window.removeEventListener('message'"),
      'Detector D must clean up the listener on unmount to prevent leaks across post navigation.',
    );
  });

  it('preserves existing Detectors A and B', () => {
    assert.ok(
      source.includes('Detector A: Scroll 70%'),
      'Phase 36 GAP-C fix must NOT remove Detector A (scroll 70% sentinel).',
    );
    assert.ok(
      source.includes('Detector B: 30s dwell'),
      'Phase 36 GAP-C fix must NOT remove Detector B (30s dwell timer).',
    );
  });
});
```

CREATE FILE 2 — `app/tests/components/InfoFlow.short-tap-emit.test.mjs` (verbatim):

```javascript
// Phase 36 GAP-C regression guard: ensures InfoFlow.tsx fires CONCEPT_EXPLORED
// on short tap-to-play. Shorts never navigate to PostDetailScreen (interactive=false
// at line 295), so the existing detectors A/B/C/D never run for them.
// See .planning/debug/video-completion-signal-missing.md.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INFOFLOW_PATH = resolve(__dirname, '../../src/components/InfoFlow.tsx');
const source = readFileSync(INFOFLOW_PATH, 'utf-8');

describe('InfoFlow short tap-to-play emit (Phase 36 GAP-C)', () => {
  it('contains Phase 36 GAP-C comment in the short tap branch', () => {
    assert.ok(
      source.includes('Phase 36 GAP-C'),
      'InfoFlow.tsx must reference Phase 36 GAP-C in the short tap-to-play handler comment.',
    );
  });

  it('fires markExplored exactly once (only in the short branch, not the video branch)', () => {
    const matches = source.match(/dailyReadService\.markExplored/g) || [];
    assert.equal(
      matches.length,
      1,
      `InfoFlow.tsx must call dailyReadService.markExplored exactly once — in the short tap branch. ` +
      `Found ${matches.length} occurrences. Video posts route via onOpen → PostDetailScreen → Detector D, ` +
      `so they should NOT have a duplicate emit here (would double-fire).`,
    );
  });

  it("emits CONCEPT_EXPLORED event exactly once via eventBus", () => {
    const matches = source.match(/type:\s*['"]CONCEPT_EXPLORED['"]/g) || [];
    assert.equal(
      matches.length,
      1,
      'InfoFlow.tsx must emit CONCEPT_EXPLORED exactly once (in the short tap-to-play handler). ' +
      'Reuse the existing event type — do NOT introduce a new event (CLAUDE.md best practice rule 6).',
    );
  });

  it('imports the required services and event bus', () => {
    assert.ok(
      source.includes("from '../services/daily-read.service'"),
      'InfoFlow.tsx must import dailyReadService and getAnchorIdForPost from daily-read.service.',
    );
    assert.ok(
      source.includes("from '../services/question.service'"),
      'InfoFlow.tsx must import questionService to build the byId map for getAnchorIdForPost.',
    );
    assert.ok(
      source.includes("from '../lib/event-bus'"),
      'InfoFlow.tsx must import eventBus to emit CONCEPT_EXPLORED.',
    );
  });
});
```

NO other test files. Place each in the indicated location; the directories `app/tests/screens/` and `app/tests/components/` may already exist (verify; create if missing — `app/tests/components/` already exists per the ChatInput test reference).
  </action>
  <verify>
    <automated>cd app && node --test tests/screens/PostDetailScreen.video-detector.test.mjs tests/components/InfoFlow.short-tap-emit.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `cd app && node --test tests/screens/PostDetailScreen.video-detector.test.mjs` reports `tests 6 / pass 6 / fail 0`
    - `cd app && node --test tests/components/InfoFlow.short-tap-emit.test.mjs` reports `tests 4 / pass 4 / fail 0`
    - Combined +10 tests: full `npm test` reports pass count ≥ 432 (Phase 36 baseline 422 + 36-06's +3 + 36-07's +3 + this plan's +10 = 438; but plans are independent — each plan target is +N from baseline. For this plan in isolation: ≥432 if 36-06 and 36-07 not yet merged. If all three closure plans land together: ≥438.)
    - `cd app && npx tsc -b --noEmit` exits 0
  </acceptance_criteria>
  <done>
    Two new test files exist with 10 GREEN tests total covering Detector D + short tap emit; tests would have caught GAP-C pre-merge.
  </done>
</task>

<task type="auto">
  <name>Task 5: Document video/short completion-signal detectors in CLAUDE.md</name>
  <files>CLAUDE.md</files>
  <read_first>
    - CLAUDE.md ("Concept Feed Generation Pipeline" section — find a good insertion point near the existing detector references). NOTE: Plan 36-07 (Wave 1) ran before this plan and may have added a "Walker termination guard" bullet to the "Numeric defaults" subsection AND a closed-divergence strikethrough entry. RE-READ the live CLAUDE.md before inserting the new "Video & short post completion signals" top-level section so you do not collide with 36-07's edits or duplicate its content.
    - app/src/screens/PostDetailScreen.tsx (the new Detector D block — verify wording matches what we document)
  </read_first>
  <action>
    Add a NEW load-bearing rule subsection to CLAUDE.md, AFTER the existing "Concept Feed Generation Pipeline" section's "When in doubt" subsection and BEFORE the next major rule (`## Header positioning`).

INSERT this entire block (verbatim):

```markdown
___

## Video & short post completion signals (Phase 36 GAP-C — load-bearing)

Video and short posts have explicit completion-signal detectors so the lazy-skip walker (Phase 36 GAP-2) sees `CONCEPT_EXPLORED` events for video-only engagement. Without these detectors, watching a video for a concept never increments vine progress and the walker keeps re-suggesting the same concept on subsequent refills.

### Detector inventory (PostDetailScreen.tsx + InfoFlow.tsx)

| Detector | Where | Trigger | Post types covered |
|----------|-------|---------|---------------------|
| A — scroll 70% sentinel | `PostDetailScreen.tsx:124-137` | IntersectionObserver fires on essay sentinel | text/image/news (sentinel below essay body) |
| B — 30s dwell timer | `PostDetailScreen.tsx:139-149` | setTimeout(30_000) on resolvedAnchorId | all post types reaching detail screen |
| C — Q&A follow-up | `PostDetailScreen.tsx:406-411` | handleAsk on user submit | all post types reaching detail screen |
| **D — YouTube IFrame API postMessage** | `PostDetailScreen.tsx` (after Detector B) | window 'message' event: `onStateChange info=0` (ENDED) OR `infoDelivery currentTime/duration >= 0.8` | video (sourceType='video') |
| **Short tap-to-play emit** | `InfoFlow.tsx` (short card onClick) | setVideoPlaying invoked on short post | short (sourceType='short') — never reaches detail screen |

### Why both Detector D AND the short tap emit exist

- Video posts (`sourceType === 'video'`) navigate to PostDetailScreen via `onOpen`. Detector D listens on the parent window for postMessage events from the YouTube iframe (which now includes `enablejsapi=1` — required to activate the API channel).
- Short posts (`sourceType === 'short'`) have `interactive=false` at `InfoFlow.tsx:295` and play inline in the feed without navigating. Detectors A/B/C/D never run. Tap-to-play (5-15s clips) is the strongest implicit signal available — `setVideoPlaying(post.id)` fires `dailyReadService.markExplored` + `eventBus.emit({type: 'CONCEPT_EXPLORED', ...})` directly.

### Rules

1. **Don't remove `enablejsapi=1` from YouTubeEmbed.tsx or InfoFlow.tsx iframe srcs.** Without it, YouTube's IFrame Player API postMessage channel is closed and Detector D receives nothing. Tests at `app/tests/screens/PostDetailScreen.video-detector.test.mjs` enforce Detector D's structure but cannot detect a missing query param at compile time — the iframe-src tests at `app/tests/components/InfoFlow.short-tap-emit.test.mjs` do not directly assert this either, but `grep -c "enablejsapi=1" app/src/components/YouTubeEmbed.tsx app/src/components/InfoFlow.tsx` is the source-of-truth check (must return ≥3).
2. **Don't remove the origin allowlist from Detector D** (`event.origin !== 'https://www.youtube.com' && event.origin !== 'https://www.youtube-nocookie.com'`). Without it, any iframe on the page can spoof concept-explored signals.
3. **Don't add a duplicate emit in the InfoFlow video card onClick** (line ~368-371). Video posts route through PostDetailScreen → Detector D; adding an emit at the feed-tap point would double-fire (idempotent via `hasEmittedRef`/markExplored, but still unnecessary work + confusing semantics). Test `InfoFlow.short-tap-emit.test.mjs` enforces `markExplored` is called exactly once in InfoFlow.tsx.
4. **Don't introduce new event types** for video/short completion. Reuse `CONCEPT_EXPLORED` (CLAUDE.md best practice rule 6 — one signal per semantic event). The walker subscribes to a single event; multiple events would fragment the lazy-skip flow.
5. **Don't refactor PostDetailScreen.tsx's video render branch** (lines 589-601) to a native `<video>` element. The current `YouTubeEmbed` is correct; the postMessage path is preferred over swapping renderers.

___
```

The `---` separator at the start matches the existing CLAUDE.md convention between major sections (verify by reading the existing section boundaries — "ChatInput flex shrink" / "Root overflow clip" / "SwipeTabContainer resize" all use `---` separators).

NO other CLAUDE.md changes. Do NOT touch any other load-bearing rule section. Do NOT modify the "Best practices learned in Phase 32.1" list — those are preserved byte-stable.
  </action>
  <verify>
    <automated>grep -c "Video & short post completion signals" CLAUDE.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "Video & short post completion signals" CLAUDE.md` returns 1
    - `grep -c "Detector D" CLAUDE.md` returns ≥1
    - `grep -c "Phase 36 GAP-C" CLAUDE.md` returns ≥1
    - `grep -c "enablejsapi=1" CLAUDE.md` returns ≥1
    - Other load-bearing rule sections byte-stable: `grep -c "html, body { overflow: hidden }" CLAUDE.md` returns 3 (unchanged); `grep -c "minWidth: 0" CLAUDE.md` returns 2 (unchanged); `grep -c "USER_ACK_BEFORE_GRAPH_CONTEXT" CLAUDE.md` returns 2 (unchanged); `grep -c "ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD" CLAUDE.md` returns 1 (unchanged).
  </acceptance_criteria>
  <done>
    CLAUDE.md has a new top-level rule section documenting Detectors A/B/C/D + the short tap-to-play emit; cross-references the test files and source line ranges; all other load-bearing rule sections byte-stable.
  </done>
</task>

<task type="auto">
  <name>Task 6: Append GAP-C retest recipes to 36-UAT-RETEST.md</name>
  <files>.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT-RETEST.md</files>
  <read_first>
    - .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT-RETEST.md (created by Plan 36-06; append additional sections — DO NOT replace existing content)
    - .planning/debug/video-completion-signal-missing.md (reproduction steps in Symptoms section)
  </read_first>
  <action>
    Append the following to `36-UAT-RETEST.md` (DO NOT touch existing content from 36-06; this is an append-only edit). Add at the bottom of the file (verbatim):

```markdown

### Test 3 (GAP-C retest — video completion signal)

**Setup**: Have ≥1 video post in the home feed (sourceType==='video', not 'short'). Open one
of the questions whose anchor is the video's source — verify it's NOT yet in
`localStorage.echolearn_daily_read.exploredAnchors`.

**Reproduction steps for Detector D (full-length video)**:
1. Tap a video post card from the home feed → PostDetailScreen opens.
2. Press play on the YouTube iframe.
3. Watch ≥80% of the video OR let it finish to ENDED.
4. Open browser devtools console (or Capacitor LiveReload remote console on device).
5. Observe.

**Expected after GAP-C fix**:
- DevTools Application → Local Storage → `echolearn_daily_read` → `exploredAnchors` array now
  contains the video's resolved anchor ID.
- Returning to home feed: VineProgress chip increments by 1.
- Subsequent refill cycles do NOT generate new posts for this anchor (lazy-skip in walkDerivedList).
- No console errors about cross-origin postMessage.

**Reproduction steps for short tap-to-play emit**:
1. Find a short post in the home feed (presentationStyle==='short' / sourceType==='short').
2. Tap the play button (thumbnail tap).
3. Open browser devtools console.

**Expected after GAP-C fix**:
- Tap-to-play swaps thumbnail for the YouTube iframe AND fires `CONCEPT_EXPLORED` immediately.
- DevTools Application → Local Storage → `echolearn_daily_read` → `exploredAnchors` contains the
  short's resolved anchor ID after the tap.
- VineProgress chip increments by 1 on next home-feed render.
- Subsequent refill cycles do NOT generate new posts for this anchor.

**Failure mode (GAP-C active, pre-fix)**:
- Watching the video to completion → `exploredAnchors` is unchanged. VineProgress does not
  increment. Walker continues to re-suggest the same anchor on swipe-for-more.
- Tapping a short to play → no signal at all. Same blind-spot symptoms.
```

Final `36-UAT-RETEST.md` contains: Test 1 (GAP-A from 36-06), Test 3 (GAP-C from 36-08). NOTE: there is intentionally no Test 2 — GAP-B is asserted via the new automated tests in Plan 36-07 (refill-queue-integration.test.mjs Test 7) and does not need a manual UAT walk-through (the metric `text-art ≥ floor(N×0.55)` is verified by code, not by visual count of 16 posts).

If, however, an operator wants to spot-check GAP-B in dev, the recipe is:
1. Clear localStorage `echolearn_post_queue` and `echolearn_daily_read`.
2. Reload home with exactly 1 question/anchor present.
3. Swipe for more until ~16 posts have been viewed across two refill cycles.
4. Count text-art presentation styles. Expected: ≥8 (= floor(16 × 0.55)). Pre-fix: ~4 (~50%).

Add this as Test 2 (optional) for completeness:

```markdown

### Test 2 (GAP-B retest — text-art ≥ floor(N×0.55) at N=16, OPTIONAL — primary verification is automated)

**Setup**: Single non-important anchor in localStorage (one Q&A → one anchor → derivedList.length=4
after first refill).

**Reproduction steps**:
1. Open home feed; trigger refillQueue (swipe-for-more once → triggers refill).
2. Continue swiping until 16+ posts have been served from the queue across one or two refill
   cycles.
3. Count the number of posts where presentationStyle === 'text-art' (visible as text-only cards
   with a colored background and Georgia / Courier / Palatino / etc. font).

**Expected after GAP-B fix**:
- text-art count >= 8 out of any 16 served (floor(16 × 0.55)). Pre-fix observed: ~4.
- News + video + short combined are ≤ ~6 (≈ 3 × 0.10 × 16 = ~5; ±1 stratification slack).

**Primary verification**: `cd app && node --test tests/services/refill-queue-integration.test.mjs`
asserts this in code (Test 7); manual check is for operator confidence, not gating.

**Failure mode (GAP-B active, pre-fix)**: text-art count = 4 across 16 posts (50%). News/video/
short combined dominate at ~67% of posts (~10 out of 16).
```
  </action>
  <verify>
    <automated>grep -c "Test 3 (GAP-C retest" .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT-RETEST.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "Test 3 (GAP-C retest" .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT-RETEST.md` returns 1
    - `grep -c "Test 2 (GAP-B retest" .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT-RETEST.md` returns 1
    - The Test 1 (GAP-A) section from Plan 36-06 is preserved: `grep -c "Test 1 (GAP-A retest" .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT-RETEST.md` returns 1
    - File contains "Detector D" and "short tap-to-play" subsections
  </acceptance_criteria>
  <done>
    36-UAT-RETEST.md contains all three retest recipes (GAP-A from 36-06; GAP-B optional manual + automated cross-reference; GAP-C with both Detector D and short tap-to-play sub-recipes); ready for operator walk-through after merge.
  </done>
</task>

</tasks>

<verification>
Phase-level checks for this plan:

```bash
# 1. enablejsapi=1 in all three iframe srcs
grep -c "enablejsapi=1" app/src/components/YouTubeEmbed.tsx
# Expect: 1
grep -c "enablejsapi=1" app/src/components/InfoFlow.tsx
# Expect: ≥2

# 2. Detector D wired in PostDetailScreen
grep -c "Detector D" app/src/screens/PostDetailScreen.tsx
# Expect: ≥1
grep -c "addEventListener('message'" app/src/screens/PostDetailScreen.tsx
# Expect: ≥1
grep -c "removeEventListener('message'" app/src/screens/PostDetailScreen.tsx
# Expect: ≥1

# 3. Short tap-to-play emits in InfoFlow
grep -c "dailyReadService.markExplored" app/src/components/InfoFlow.tsx
# Expect: 1 (only short branch)
grep -c "type: 'CONCEPT_EXPLORED'" app/src/components/InfoFlow.tsx
# Expect: 1

# 4. Existing detectors A and B preserved
grep -c "Detector A: Scroll 70%" app/src/screens/PostDetailScreen.tsx
# Expect: 1
grep -c "Detector B: 30s dwell" app/src/screens/PostDetailScreen.tsx
# Expect: 1

# 5. New test files pass
cd app && node --test tests/screens/PostDetailScreen.video-detector.test.mjs
# Expect: tests 6 / pass 6 / fail 0
cd app && node --test tests/components/InfoFlow.short-tap-emit.test.mjs
# Expect: tests 4 / pass 4 / fail 0

# 6. CLAUDE.md updated
grep -c "Video & short post completion signals" CLAUDE.md
# Expect: 1
grep -c "Phase 36 GAP-C" CLAUDE.md
# Expect: ≥1

# 7. Other load-bearing rules byte-stable
grep -c "html, body { overflow: hidden }" CLAUDE.md   # Expect: 3
grep -c "USER_ACK_BEFORE_GRAPH_CONTEXT" CLAUDE.md     # Expect: 2

# 8. Full npm test no new failures
cd app && npm test
# Expect: pass count ≥ 432, fail count ≤ 26

# 9. tsc clean
cd app && npx tsc -b --noEmit
# Expect: exit 0
```
</verification>

<success_criteria>
- [ ] YouTubeEmbed.tsx iframe src includes `enablejsapi=1`
- [ ] InfoFlow.tsx video AND short feed iframes include `enablejsapi=1` (≥2 occurrences)
- [ ] PostDetailScreen.tsx has Detector D useEffect with origin allowlist + ENDED + heartbeat parsing + listener cleanup
- [ ] InfoFlow.tsx short card onClick fires `dailyReadService.markExplored` + `eventBus.emit({type:'CONCEPT_EXPLORED',...})` (exactly once — only in short branch, not video branch)
- [ ] InfoFlow.tsx imports `dailyReadService`, `getAnchorIdForPost`, `questionService`, `eventBus`
- [ ] Detectors A/B/C unchanged
- [ ] No new event types — `CONCEPT_EXPLORED` reused
- [ ] Two new test files pass (10 GREEN tests total)
- [ ] CLAUDE.md has new "Video & short post completion signals" rule section
- [ ] 36-UAT-RETEST.md has Test 3 (GAP-C) and optional Test 2 (GAP-B) recipes
- [ ] Other CLAUDE.md load-bearing sections byte-stable (Phase 33/35 invariants preserved)
- [ ] `npm test` no new failures (Phase 36 baseline 422 / 26 preserved)
- [ ] `tsc -b --noEmit` exit 0
</success_criteria>

<output>
After completion, create `.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-08-SUMMARY.md`
</output>

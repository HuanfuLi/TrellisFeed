---
status: complete
phase: 52-podcast-quality-defaults-and-learner-controls
source: [52-01-SUMMARY.md, 52-02-SUMMARY.md, 52-03-SUMMARY.md]
started: 2026-05-20T02:01:39Z
updated: 2026-05-20T02:29:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill the running dev server. Start the app fresh and open it. App boots without console errors; navigating to the Podcast screen renders the player/generate card plus the Length × Style chip selectors — no crash, no blank screen.
result: pass
note: Podcast screen renders fine on fresh start. A pre-existing DEV-only console.warn from InfoFlow.tsx:260 ("Forced text-art fallback", sourceType 'mixed' / presentationStyle undefined) fires on the Home feed — unrelated to Phase 52 scope (InfoFlow/concept-feed untouched this phase), card still renders via text-art fallback. Tracked as out-of-scope pre-existing feed-data noise, not a Phase 52 gap.

### 2. Length × Style Chip Selectors Render
expected: On the Podcast screen, a Length row shows 4 chips (Brief / Standard / Deep / Extended) and a Style row shows 3 chips (Focused / Conversational / Review Drill). On a fresh install, Standard and Conversational are pre-selected (highlighted with the green accent fill).
result: pass
note: Chips render and correct defaults (Standard + Conversational) are highlighted. But the operator flagged 3 follow-up issues on this panel — see Gaps GAP-1, GAP-2, GAP-3.

### 3. Generate Podcast With Selected Options
expected: Select Deep + Review Drill, then tap Generate. The podcast generates using those options. The resulting audio/script is noticeably longer than Standard and reads as an active-recall "drill" (more retrieval questions), not a casual recap.
result: issue
reported: "Generated, but cannot play. Play button can click and change to pause button, but progress bar did not move, no time duration, no sound."
severity: blocker
note: Generation itself succeeded (podcast was produced with the selected options). Playback is broken — see GAP-4. Content length/style quality could not be assessed because there is no audio; deferred to Test 9 (content structure) via script preview.

### 4. Cached-Options Badge
expected: After a podcast is ready, the player card shows an inline badge reading "Cached: Deep · Review Drill" (matching whatever options it was generated with). Podcasts generated before this feature show no badge (no crash).
result: pass

### 5. Dirty State + Regenerate Button
expected: With a ready podcast, change a chip (e.g. Deep → Brief). A full-width "Regenerate with new options" button appears in the player card. Tapping it discards the old audio and regenerates with the new options; the badge updates and the Regenerate button disappears once selection matches the cached options again.
result: pass

### 6. Playback-Rate Cycle (1x / 1.5x / 2x)
expected: While a podcast plays, a speed button in the player controls cycles 1x → 1.5x → 2x → 1x. Audio speed changes audibly with each tap (no pitch distortion). The chosen rate persists when you switch to a different day's podcast.
result: pass
note: Button cycles 1x→1.5x→2x→1x. The audible-speed-change clause could not be fully exercised because GAP-4 blocks playback; recommend a quick re-confirm of audible rate change once the playback fix lands.

### 7. Settings — Default Podcast Length & Style
expected: In Settings → Features, the Podcast section has two new rows: Default Podcast Length (Brief/Standard/Deep/Extended) and Default Podcast Style (Focused/Conversational/Review Drill). Changing them and saving makes the next podcast generation (and the chip defaults on the Podcast screen) use those values.
result: pass
note: When GAP-1 lands (Brief removed, "Review Drill"→"Review"), this Settings Length dropdown must drop to 3 options and the Style label must match — keep PodcastScreen chips and Settings rows in sync.

### 8. Settings — TTS Model (OpenAI only)
expected: In Settings → AI, the TTS section shows a TTS Model row with Standard (tts-1) and HD (tts-1-hd) when the TTS provider is OpenAI. Default is Standard. Selecting HD persists. When the TTS provider is NOT OpenAI (e.g. gptsovits), the TTS Model row is hidden.
result: pass
note: TTS Model row works as specified. Operator surfaced an unrelated pre-existing bug while here — provider switch wipes the API key — logged as GAP-5 (out of Phase 52 scope, pending routing decision).

### 9. Five-Section Educational Content Structure
expected: A generated podcast (any length) covers all five sections — a recap of what you reviewed, a connection to prior knowledge, a misconception check, retrieval-practice questions, and a concrete next action — rather than the old generic 90-second radio recap. Even Brief includes all five (just denser).
result: pass

### 10. Localized UI (zh / es / ja)
expected: Switch the app language to Chinese, Spanish, or Japanese. The chip labels, the "Cached: …" badge, the Regenerate button, and the new Settings rows all render translated. Proper nouns (tts-1, tts-1-hd, OpenAI) stay untranslated. Labels fit within the chips on a narrow phone.
result: pass

## Summary

total: 10
passed: 9
issues: 1
pending: 0
skipped: 0
gaps: 5

## Gaps

- truth: "The Length × Style config panel reads cleanly without chip overflow."
  status: failed
  reason: "Operator (Test 2): LENGTH (4 chips) and STYLE (3 chips) both wrap to two lines — looks cluttered. Directed fix: remove the 'Brief' length option (Standard is already short) leaving 3 lengths (Standard/Deep/Extended); rename style label 'Review Drill' → 'Review'. NOTE: removing Brief revises locked decision D-01 (operator had chosen 4 lengths over researcher's 3) — operator is the decision authority and is now revising it during UAT."
  severity: minor
  test: 2
  artifacts: []
  missing: []

- truth: "A freshly generated podcast plays back: progress advances, duration shows, audio is audible."
  status: failed
  reason: "Operator (Test 3): generation succeeded but playback is dead — play button toggles to pause, but the progress bar never moves, no duration is shown, and there is no sound. Old podcasts (e.g. Apr 21 'Daily Recap' = 1:46) DID have audio, so TTS is configured; this is a regression in the freshly-generated/options path. Suspects: (a) PodcastScreen mount-time audio wiring change — `audioRef.current.playbackRate = playbackRate` added right after `audioRef.current = audio`, possibly before metadata/src ready; (b) the options/cache path in podcast.service.ts not producing or storing the audio blob for the new generation; (c) audioBlobUrls map miss on the regenerated id. Needs diagnosis."
  severity: blocker
  test: 3
  artifacts: []
  missing: []

- truth: "The podcast config panel is unobtrusive for a low-frequency action."
  status: failed
  reason: "Operator (Test 2): the config panel should be an expandable section, collapsed by default (length/style is not changed often). It should also be repositioned BELOW the podcast player / 'no podcast yet' panel and ABOVE the Knowledge Today panel — currently it sits at the top above the player."
  severity: minor
  test: 2
  artifacts: []
  missing: []

- truth: "Exactly one of {podcast player, 'No podcast for today' empty state} renders at a time."
  status: failed
  reason: "Operator (Test 2): the podcast player (showing a stale TUE APR 21 'Daily Recap') AND the 'No podcast for today' empty-state panel both render simultaneously. Regression — likely introduced by the Phase 52 PodcastScreen.tsx rewrite that added the chip selectors to both no-podcast and ready states. The two panels must be mutually exclusive (today-has-podcast → player; today-empty → empty state, optionally with most-recent in History)."
  severity: major
  test: 2
  artifacts: []
  missing: []

- truth: "An entered provider API key survives switching providers and switching back."
  status: failed
  reason: "Operator (Test 8): switching the AI provider loses the entered API key — the user must reconfigure. Root cause confirmed at SettingsAIScreen.tsx:138-147: the provider onChange spreads a `defaults[p]` object that hard-sets `apiKey: ''`, and the config stores a single `apiKey` slot (not per-provider), so switching away blanks it and switching back does not restore it. PRE-EXISTING — introduced in commit 6bdd3f4a (iOS-style Settings redesign), NOT Phase 52 (Phase 52's only SettingsAIScreen change was the TTS Model row, 44a5fdc4). OUT OF PHASE 52 SCOPE. Routing decision pending: fold into the Phase 52 gap-closure batch, or track as its own bug/phase. Proper fix would store per-provider keys (e.g. apiKeys: Record<provider, string>) so each provider remembers its own."
  severity: major
  test: 8
  scope: out-of-phase-52
  artifacts: []
  missing: []

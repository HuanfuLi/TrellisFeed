---
status: complete
phase: 52-podcast-quality-defaults-and-learner-controls
source: [52-01-SUMMARY.md, 52-02-SUMMARY.md, 52-03-SUMMARY.md]
started: 2026-05-20T02:01:39Z
updated: 2026-05-20T02:35:00Z
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
  reason: "Operator (Test 3): generation succeeded but playback is dead — play toggles to pause, no progress, no duration, no sound. DIAGNOSED (debug session .planning/debug/phase-52-podcast-playback-and-dual-render.md): the audio-element code is byte-identical pre/post-52. Real cause is twofold and upstream of the audio wiring: (1) the `selected` fallback at PodcastScreen.tsx:104-106 (`selectedId ? find : todayPodcast ?? podcasts[0] ?? null`) can bind the player to a stale podcast id, so the wiring effect (lines 200-239, bails at 204 unless selected.status==='ready' AND getAudioPath(selected.id) returns a blob) leaves audioRef.current null; tapping play hits the `if (!audio)` early-return at lines 243-246 — flips isPlaying, touches no element → exact symptom. (2) `isDirty` permanent-true loop: currentHash (lines 111-122) is computed over todayConceptIds (SM-2 due + planner extras) while the service computes optionsHash over the questions IT resolves (podcast.service.ts:178, with getRecent(5) fallback at 173-176); when the id-lists diverge, selected.optionsHash !== currentHash forever → fresh podcast is treated dirty and Regenerate fires against selected.date (possibly the stale Apr-21 date)."
  severity: blocker
  test: 3
  root_cause: "PodcastScreen.tsx:104-106 stale `selected` fallback + lines 111-122 isDirty hash computed over a different concept-id list than podcast.service.ts:178 optionsHash"
  fix_direction: "On generate, deterministically set selectedId to the returned (today's) podcast id; fix the line 104-106 fallback so the main player never silently binds a stale entry; reconcile currentHash with the SAME concept-id list the service uses (or have the service echo back resolved conceptIdList/optionsHash) so a freshly-generated, unchanged-chips podcast yields isDirty===false."
  artifacts: [app/src/screens/PodcastScreen.tsx, app/src/services/podcast.service.ts]
  missing: ["behavioral/render test: after generation, selected is today's podcast and getAudioPath(selected.id) is non-null (play does not hit !audio branch)", "test: freshly generated podcast with unchanged chips yields isDirty===false (currentHash === service optionsHash incl. getRecent(5) fallback)"]

- truth: "The podcast config panel is unobtrusive for a low-frequency action."
  status: failed
  reason: "Operator (Test 2): the config panel should be an expandable section, collapsed by default (length/style is not changed often). It should also be repositioned BELOW the podcast player / 'no podcast yet' panel and ABOVE the Knowledge Today panel — currently it sits at the top above the player."
  severity: minor
  test: 2
  artifacts: []
  missing: []

- truth: "Exactly one of {podcast player, 'No podcast for today' empty state} renders at a time."
  status: failed
  reason: "Operator (Test 2): player (stale Apr-21 'Daily Recap') AND 'No podcast for today' empty-state render simultaneously. DIAGNOSED: the two blocks key off DIFFERENT state and were never mutually exclusive — player renders on `selected && selected.status === 'ready'` (PodcastScreen.tsx:627) where `selected` falls back to podcasts[0] (line 104-106), while the empty/generate block renders on `!todayPodcast || ...` (line 773). This dual-render is a LATENT pre-52 bug (both conditions byte-identical at eb6f3d81^:518/615); Phase 52 made it operator-visible by adding the always-on Length×Style chip Card at line 563 (condition includes `|| (selected && selected.status === 'ready')`), so the screen now stacks chips + stale player + empty-state."
  severity: major
  test: 2
  root_cause: "PodcastScreen.tsx:104-106 `selected` fallback to podcasts[0]; player gate (627) keys off `selected`, empty-state gate (773) keys off `todayPodcast` — divergent sources, no else/exclusion."
  fix_direction: "Make player vs empty-state mutually exclusive on a single source of truth: gate the main player on `selected` being TODAY's podcast (only fall back to podcasts[0] for the History/all-podcasts view), or render empty/generate as an `else` against `selected?.status === 'ready'`. Product intent to confirm: no-today-but-old-exists → show generate prompt + chips, reach old podcasts via History."
  artifacts: [app/src/screens/PodcastScreen.tsx]
  missing: ["render test: todayPodcast undefined + stale ready podcasts[0] → player and 'No podcast for today' empty-state are NOT both rendered"]

- truth: "An entered provider API key survives switching providers and switching back."
  status: failed
  reason: "Operator (Test 8): switching the AI provider loses the entered API key — the user must reconfigure. Root cause confirmed at SettingsAIScreen.tsx:138-147: the provider onChange spreads a `defaults[p]` object that hard-sets `apiKey: ''`, and the config stores a single `apiKey` slot (not per-provider), so switching away blanks it and switching back does not restore it. PRE-EXISTING — introduced in commit 6bdd3f4a (iOS-style Settings redesign), NOT Phase 52 (Phase 52's only SettingsAIScreen change was the TTS Model row, 44a5fdc4). OUT OF PHASE 52 SCOPE. Routing decision pending: fold into the Phase 52 gap-closure batch, or track as its own bug/phase. Proper fix would store per-provider keys (e.g. apiKeys: Record<provider, string>) so each provider remembers its own."
  severity: major
  test: 8
  scope: folded-into-phase-52 (operator approved widening scope; pre-existing bug fixed alongside podcast gaps)
  artifacts: []
  missing: []

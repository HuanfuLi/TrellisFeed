---
status: investigating
trigger: "Diagnose two Phase 52 PodcastScreen regressions: (A) freshly generated podcast won't play (button toggles, no progress/duration/sound); (B) player + empty-state render simultaneously. Diagnose only, do not fix."
created: 2026-05-19
updated: 2026-05-19
---

## Current Focus

hypothesis: "BUG A: audioRef.current is null at play time because the new podcast id used by getAudioPath differs from selected.id, OR the wiring effect's selected.id dep doesn't change. BUG B: selected falls back to podcasts[0] (stale Apr 21) when todayPodcast is undefined, so player + empty-state both render — pre-existing logic exposed by Phase 52."
test: "Trace optionsHash cache path + selected derivation + audio wiring effect deps against pre-52 git version."
expecting: "Identify exact lines."
next_action: "Confirm the id-stability of generated podcast and whether playbackRate-on-mount assignment could throw."

## Symptoms

expected: "(A) Freshly generated podcast plays with audio + progress + duration. (B) Player and empty-state are mutually exclusive."
actual: "(A) Play button toggles to pause but no progress/no duration/no sound on freshly generated. OLD Apr 21 podcast DID play pre-52. (B) Player (stale Apr 21) + 'No podcast for today' render at once."
errors: "none reported"
reproduction: "(A) Generate today's podcast, tap play. (B) Have an old ready podcast but none for today; open PodcastScreen."
started: "Phase 52 (commits 52-01/02/03, eb6f3d81 is the screen rewrite)"

## Eliminated

- hypothesis: "BUG A caused by mount-time audioRef.current.playbackRate assignment throwing before metadata"
  evidence: "Setting .playbackRate on a fresh Audio element with a src is valid HTML5 and does not throw pre-metadata. The line is after audioRef.current = audio so ref is non-null. Not the cause."
  timestamp: 2026-05-19
- hypothesis: "BUG A caused by tts/index.ts model un-hardcode producing bad/no audio"
  evidence: "Diff shows model: config.model ?? 'tts-1' — identical default. 'no sound' is because audio element never plays (handlePlayPause !audio branch), not bad TTS output."
  timestamp: 2026-05-19
- hypothesis: "BUG A is a change in PodcastScreen audio handler/wiring code"
  evidence: "handlePlayPause, handleSeek, hasAudio, and the audio-wiring useEffect are byte-identical pre/post-52 EXCEPT the single inserted playbackRate line. The audio code itself did not regress."
  timestamp: 2026-05-19

## Evidence

- timestamp: 2026-05-19
  checked: "git diff eb6f3d81^..eb6f3d81 render conditions"
  found: "Pre-52 had exactly 2 panel conditions: player `selected && selected.status==='ready'` and empty/generate `!todayPodcast || pending || failed`. Phase 52 ADDED a third (chip Card, line 563) that renders in BOTH states, and re-ordered so player is line 627, empty is line 773. The player and empty conditions are otherwise unchanged."
  implication: "Player + empty-state are NOT mutually exclusive: when todayPodcast is undefined AND podcasts[0] is a stale ready podcast, `selected` falls back to podcasts[0] (line 104-106) so player renders, while !todayPodcast makes empty-state render too. Latent pre-52; Phase 52's always-on chip Card made the broken state visually prominent."

- timestamp: 2026-05-19
  checked: "selected derivation PodcastScreen.tsx:104-106"
  found: "selected = selectedId ? find(selectedId) : (todayPodcast ?? podcasts[0] ?? null). The podcasts[0] fallback is the dual-render trigger and also points play/regenerate at the wrong (stale) podcast."
  implication: "BUG B root cause. Also couples to BUG A: regenerate/play act on selected which may be the stale Apr-21 podcast, not today's."

- timestamp: 2026-05-19
  checked: "service generatePodcast optionsHash (podcast.service.ts:178-193) vs screen currentHash (PodcastScreen.tsx:111-122)"
  found: "Service computes optionsHash over conceptIdList = the questions IT resolves (getDueForReview or getRecent(5) fallback). Screen computes currentHash over todayConceptIds = Knowledge Today list (SM-2 due + planner additions). When the screen passes [] or a list that diverges from what the service resolves (e.g. fallback to getRecent when due-list empty, or planner extras not passed), service's optionsHash != screen's currentHash."
  implication: "isDirty (line 122) stays permanently true → Regenerate CTA never clears, and every generation can be seen as a fresh/forced regen. Contributing factor to the confused fresh-generation state, though not the direct play failure."

- timestamp: 2026-05-19
  checked: "audio lifecycle vs handlePlayPause !audio branch (lines 200-257)"
  found: "handlePlayPause's `if (!audio) { setIsPlaying(prev=>!prev); return; }` exactly reproduces operator symptom: button toggles play<->pause, but no playback/progress/duration/sound. This fires whenever audioRef.current is null at tap time."
  implication: "BUG A = audioRef.current is null when play is tapped on the fresh podcast. The wiring effect (line 200) only sets the ref when `selected.status==='ready'` AND getAudioPath(selected.id) returns a blob. The blob is keyed by the service's generation id; if `selected` is not the just-generated podcast (podcasts[0] fallback / stale selectedId) OR getAudioPath misses for selected.id, ref stays null."

- timestamp: 2026-05-19
  checked: "test coverage tests/screens/PodcastScreen.options.test.mjs"
  found: "Entirely source-read (regex) + locale-parity assertions. No component render, no behavioral test. Cannot catch either runtime bug."
  implication: "Both regressions shipped GREEN because the Phase 52 tests only assert source text and i18n parity. Behavioral/render tests are absent."

## Resolution

root_cause: |
  BUG B (player + empty-state both render): PodcastScreen.tsx:104-106 derives
  `selected = ... : (todayPodcast ?? podcasts[0] ?? null)`. When there is NO
  podcast for today (`todayPodcast` undefined) but an OLD ready podcast exists,
  `selected` falls back to `podcasts[0]` (the stale Apr-21 'Daily Recap'), so the
  player block (line 627, `selected && selected.status==='ready'`) renders, WHILE
  the empty/generate block (line 773, `!todayPodcast || ...`) ALSO renders because
  todayPodcast is undefined. The two conditions key off DIFFERENT state
  (`selected` vs `todayPodcast`) and were never made mutually exclusive. This
  dual-render was latent pre-Phase-52 (identical conditions at eb6f3d81^:518/615)
  but Phase 52 added an always-on chip Card (line 563) rendering in this same
  state, making the broken layout prominent and operator-visible.

  BUG A (fresh podcast won't play): the operator's exact symptom (play toggles to
  pause, no progress/duration/sound) is produced ONLY by handlePlayPause's
  `if (!audio)` early-return (line 243-246), i.e. `audioRef.current` is null at
  tap time. The audio code itself is unchanged from pre-52; what regressed is the
  podcast `selected` points to and the options/cache path: (1) the same
  podcasts[0]/selectedId fallback (line 104-106) can make `selected` a podcast
  whose id has no blob in `audioBlobUrls`, so the wiring effect (line 200, gated on
  getAudioPath(selected.id)) bails at line 204 and never assigns audioRef.current;
  (2) the new isDirty derivation (line 122) compares the screen's currentHash
  (over todayConceptIds) against the service's optionsHash (over the questions the
  service itself resolves, podcast.service.ts:178) — these id-lists diverge when
  the service hits its getRecent(5) fallback or when planner extras aren't passed,
  leaving isDirty permanently true and the regenerate CTA pointed at
  `selected.date` (possibly the stale podcast's date, not today). Net: a freshly
  generated podcast can render a player whose audioRef is wired to the wrong (or
  no) blob, so play does nothing.

fix: "DIRECTION ONLY (no fix applied per diagnose-only mode) — see report."
verification: "n/a — diagnose only"
files_changed: []

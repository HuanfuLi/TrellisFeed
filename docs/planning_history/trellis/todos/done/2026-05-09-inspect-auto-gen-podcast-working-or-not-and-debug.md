---
created: 2026-05-09T06:16:16.657Z
title: Inspect auto-gen podcast working or not and debug
area: general
resolves_phase: 54
files:
  - app/src/services/podcast.service.ts
  - app/src/state/usePodcast.ts
  - app/src/screens/PodcastScreen.tsx
---

## Problem

Auto-generated podcast feature status is unverified — needs end-to-end inspection on a real device to confirm whether daily podcast auto-generation is firing, whether audio synthesis (TTS) succeeds, whether playback works, and where it breaks if it doesn't.

Specific things to check:
- Is the daily auto-generation cron/scheduler actually firing?
- When triggered, does the LLM call to generate the podcast script succeed?
- Does the TTS synthesis (provider — OpenAI / Gemini / local) produce a playable audio blob?
- Does the audio blob URL persist correctly? (`URL.createObjectURL` lifecycle?)
- Does PodcastScreen list / play / seek the generated podcast correctly?
- Any silent failures in the pipeline that surface only on device (not web)?

Surfaced during 2026-05-09 Phase 38 device UAT session — operator wants this validated against the v1.5 baseline before further v1.5 phases land that could touch the same surfaces (Phase 41 pipeline wiring may interact with podcast generation).

## Solution

TBD. First-pass approach:
1. Read podcast.service.ts + usePodcast.ts to map the auto-gen trigger path (when does it fire? cron-style? on app open? on date change?).
2. Check whether there's a "generate now" dev affordance in SettingsDataScreen or similar — if not, add one for diagnostic purposes.
3. Boot app on device, trigger generation manually, watch console logs for errors at: LLM script-gen step, TTS synth step, blob persist step, list-render step.
4. If silent failure: add structured logging at each pipeline boundary and re-run.
5. If a specific provider is broken: check API key state in settings, test endpoint manually.

May warrant a dedicated debug session via `/gsd:debug` if the pipeline is non-trivially broken.

Possible Phase candidates if it's a real gap: a small targeted fix-phase OR fold into Phase 41 (pipeline wiring + essay depth) since both touch the LLM + TTS pipeline.

## Disposition

Closed per Phase 54 D-07 — auto-gen podcast device-verified working by operator on
2026-05-20. No defects found; no diagnostics build performed; no code change required.
QUALITY-03 is satisfied by the operator's device verification, not by a fix.

Light source sanity-check (non-gating, per D-07): `scheduler.service.ts:checkPodcast`
wraps `podcastService.generatePodcast` in a try/catch (lines 87-98), so a failed
generation only logs a warning and cannot crash the scheduler poll loop. The daily
`trellis_scheduler_podcast_done` flag is date-stamped (`isDoneToday` compares the stored
value against `today()`, scheduler.service.ts:35-36), so it self-resets on date-mismatch
rather than being permanent. No issues found.

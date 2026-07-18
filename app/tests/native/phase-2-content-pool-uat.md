# Phase 2 native content-pool UAT

Status: **PASS — Android API 36.1 emulator matrix complete; physical-device UAT waived by research owner**
Prepared: 2026-07-17 (America/Indianapolis)
Last emulator run: 2026-07-18 (Android API 36.1, `Medium_Phone_API_36.1`)

## Artifact under test

| Field | Value |
|---|---|
| Git commit used for the final synced build | `4047cc22b48e77ed36edfe5bb39c27f134fd919b` |
| Content-pool version | `pilot-v1-20260717` |
| Approved posts | 77 |
| `manifest.json` SHA-256 | `9fed9992776fab0b4b11b50913a7949a00aca42034b76b62c3f7ee468e2568cc` |
| Android debug APK SHA-256 | `7f963d52dc58497134553ecefbbe5d51c9418a29b232d22477f05ae7ded214b5` |
| Android application ID | `com.trellis.app` |
| iOS bundle ID / development team | `com.huanfuli.trellis` / `ZW465WJST3` |

The pool is immutable. A future pool change requires a new version and checksum;
this record must not be reused for a different artifact.

## Automated preflight

| Check | Result | Evidence |
|---|---|---|
| Production build and deterministic packaging | PASS | `npm run build`; packaged 77 posts from `pilot-v1-20260717` |
| App regression suite | PASS | `npm test`: 496/496 |
| Lint | PASS | `npm run lint`: 0 errors, 7 pre-existing warnings |
| Capacitor native asset sync and Android APK assembly | PASS | `npx cap sync android`; `gradlew.bat assembleDebug` |
| Packaged files byte-identical in web, Android, and iOS assets | PASS | `app/tests/phase2/frozen-cutover.test.mjs` |
| No pipeline/review/run-cache/credential files in participant bundles | PASS | `app/tests/phase2/frozen-cutover.test.mjs` |
| Native identifiers unchanged | PASS | Android `com.trellis.app`; iOS `com.huanfuli.trellis`, team `ZW465WJST3` |
| Android API 36.1 clean-install/restart offline smoke | PASS | Frozen pool imported and recovered with `pilot-v1-20260717` ready in IndexedDB |

## Runtime and waiver scope

The final runtime matrix was executed in the production Capacitor WebView on a
clean Android API 36.1 emulator. UI input used ADB and Chrome DevTools Protocol;
CDP inspection of IndexedDB was read-only except for test interaction generated
by the app itself. Two deployed-backend UAT accounts were used: `1001` control
and `1002` experimental. No credential value is recorded here.

No iOS simulator was run because the preparation host is Windows and has no
Xcode runtime. After the Android emulator matrix passed, the research owner
explicitly waived physical Android and physical iOS UAT on 2026-07-17. This is a
waiver, not a claim that iOS runtime execution occurred. Cross-platform packaged
asset and native identifier contracts remain covered by automated tests.

| Platform | Device / OS | Artifact | Reviewer decision | Date | Result |
|---|---|---|---|---|---|
| Android | `Medium_Phone_API_36.1`, API 36.1 | commit/checksums above | Emulator matrix accepted | 2026-07-18 | PASS |
| Android physical | Not run | Same release boundary | Waived after emulator pass | 2026-07-17 | WAIVED |
| iOS physical | Not run | Same packaged web asset boundary | Waived after emulator pass | 2026-07-17 | WAIVED |

## Required test matrix

Failed observations are retained inline with their fixes and retest evidence.

| ID | Verification | Android API 36.1 | iOS physical | Evidence / notes |
|---|---|---|---|---|
| N-01 | Offline clean install imports pinned pool and reaches setup without pipeline access. | PASS | WAIVED | Airplane mode preceded first launch; IndexedDB reached ready state for `pilot-v1-20260717` and no content-pipeline request occurred. |
| N-02 | One online account binding, then offline full-article Home → PostDetail → Saved. | PASS | WAIVED | Real deployed `/v1/install/resolve` succeeded. Offline `candidate-0000/0001/0002` rendered 145121/109242/123513 stored body characters; save and Saved recovery passed with exact source URLs. |
| N-03 | Offline force-stop/restart preserves pool, order, full text, saves, and ready state. | PASS | WAIVED | Version, identity, engagement, saved text, and feed state recovered after force-stop/restart. |
| N-04 | Online YouTube playback/progress and exact frozen source URL. | PASS | WAIVED | Real iframe playback was visible. Source activation opened `https://www.youtube.com/watch?v=-bSd0BcAOLA`, exactly matching the frozen URL. |
| N-05 | Offline/player failure shows reviewed fallback and transcript-unavailable notice. | PASS after fix | WAIVED | Initial run failed because Android WebView kept `navigator.onLine=true`. Commit `22bf6c1` added native network status and localized fallback. Retest showed reviewed digest/summary, source link, and exact transcript-unavailable notice with no dead iframe. |
| N-06 | Control/experimental provider configuration and frozen suggestions are identical. | PASS | WAIVED | Fresh `1001`/`1002` installs had identical provider/model defaults. `candidate-0027` rendered the same five suggestion IDs, text, and types. |
| N-07 | Typed, suggested, follow-up, insufficient-evidence, and off-topic Ask parity. | PASS | WAIVED | Both conditions remained post-scoped. Live Gemini checks covered all five categories; experimental used the currently available `gemini-3.1-flash-lite`. Automated parity contract also passed. |
| N-08 | Malicious fixture is rejected before model/write and raw text is absent durably. | PASS after fix | WAIVED | Initial run exposed a deterministic pre-gate gap. Commit `049827b` added a fail-closed direct-imperative gate. Clean-install retest found zero Q/A/upload rows and no raw malicious text in any research store. |
| N-09 | Restart recovers same-post thread without cross-post leakage. | PASS | WAIVED | Five-category thread recovered on `candidate-0027`; navigating to `candidate-0000` showed no leaked thread. |
| N-10 | Interaction events contain only allowlisted fields. | PASS after fix | WAIVED | Actual `feed_impression`, `post_open`, `source_click`, `video_play`, `video_progress`, question, answer, and save records matched the allowlist. Frozen videos omit duration, so initial code never emitted progress; commit `4047cc2` added bounded elapsed milestones. At 16 seconds the WebView persisted 5- and 15-second `video_progress` events with `durationMs=16000`. Recommendation-reason events are not applicable until the Phase 3 recommendation surface exists; Phase 2 has no call site. |
| N-11 | Header, scroll, keyboard, pull/back, edge swipe, and root overflow remain stable. | PASS | WAIVED | ADB exercised vertical scroll, pull, edge swipe, keyboard open/close, and system back without layout or route regression. Android reported `mInputShown=true` while focused and false after back. Header/overflow/swipe automated contracts passed in the 496-test suite. |
| N-12 | en/zh/es/ja UI localizes while frozen content remains English. | PASS | WAIVED | Runtime switching produced localized Ask placeholders and source labels for all four locales; the same frozen English video title/content remained present. |

## Sign-off

- Android emulator reviewer: Codex automated operator run, 2026-07-18
- Research owner decision: physical Android/iOS device UAT waived after simulator pass, 2026-07-17
- Final result: **PASS — N-01 through N-12 passed on Android API 36.1; physical-device rows explicitly waived**

# Phase 2 native content-pool UAT

Status: **BLOCKED — Android emulator N-05 failed; remaining matrix and physical-device verification pending**
Prepared: 2026-07-17 (America/Indianapolis)
Last emulator run: 2026-07-18 (Android API 36.1, `Medium_Phone_API_36.1`)

## Artifact under test

| Field | Value |
|---|---|
| Git commit used for the synced build | `f001ea00dbe4a224717755e8d33fbb9f56f9d5bf` |
| Content-pool version | `pilot-v1-20260717` |
| Approved posts | 77 |
| `manifest.json` SHA-256 | `9fed9992776fab0b4b11b50913a7949a00aca42034b76b62c3f7ee468e2568cc` |
| Android application ID | `com.trellis.app` |
| iOS bundle ID | `com.huanfuli.trellis` |
| iOS development team | `ZW465WJST3` |

Do not sign this checklist against a different commit or manifest checksum. If
the pool changes, create and package a new immutable version; never edit
`content_pool_v1` prospectively to make a failed result pass.

## Automated preflight

| Check | Result | Evidence |
|---|---|---|
| Production build and deterministic packaging | PASS | `npm run build`; packaged 77 posts from `pilot-v1-20260717` |
| Capacitor Android/iOS asset sync | PASS | `npx cap sync`; both web-asset copies completed |
| Android debug APK assembly | PASS | `gradlew.bat assembleDebug`; `app-debug.apk` SHA-256 `baeaa270aeb754d6541299c62927a1577eca487a728f7785cea85996abdf372a` |
| Android API 36.1 emulator clean-install/restart offline smoke | PASS | With airplane mode enabled before first launch, the app stayed alive, reached Research Setup, persisted `pilot-v1-20260717` in IndexedDB, and retained it after force-stop/restart |
| Packaged files byte-identical in web, Android, and iOS assets | PASS | `app/tests/phase2/frozen-cutover.test.mjs` |
| No pipeline/review/run-cache/credential files in participant bundles | PASS | `app/tests/phase2/frozen-cutover.test.mjs` |
| Android application ID unchanged | PASS | `android/app/build.gradle`: `com.trellis.app` |
| iOS signing identifiers unchanged | PASS | Xcode project: `com.huanfuli.trellis`, team `ZW465WJST3` |
| Native source diff after sync | PASS | No tracked Android/iOS source diff |
| Android physical-device availability on preparation host | BLOCKED | Android SDK/emulator is available, but `adb devices -l` found no physical device |
| iOS physical-device availability on preparation host | BLOCKED | Windows host has no Xcode, CocoaPods, or `xcodebuild` |

## Device records

Fill one row per physical-device installation. Evidence may be a short video,
screenshots, or a timestamped test log.

| Platform | Device / OS | Clean-install build commit | Pool version + checksum match | Reviewer | Date | Result |
|---|---|---|---|---|---|---|
| Android |  |  |  |  |  | PENDING |
| iOS |  |  |  |  |  | PENDING |

## Android emulator run record

This run used a clean install on the Android API 36.1 emulator. UI actions were
performed against the production Capacitor WebView using ADB and Chrome DevTools
Protocol input/click events. CDP was also used for read-only IndexedDB inspection.
The local fixture research backend could not be called from the HTTPS Capacitor
page because Chromium blocked the HTTP endpoint as mixed content, so the control
fixture identity was inserted directly into `research_metadata`. This means any
matrix row that specifically requires the real `/v1/install/resolve` binding call
is not a full pass.

The WebView was configured with the operator's Gemini credential for live Q&A.
The credential itself is not recorded in this artifact.

## Required test matrix

Run every row on both Android and iOS. For Ask parity, use two fresh study
identities assigned to the control and experimental conditions and submit the
same questions against the same post. A clean install can import the pool fully
offline, but the server-owned study assignment intentionally requires one online
`/v1/install/resolve` call. Therefore verify offline import first, briefly enable
network only to bind the assigned account, then disable it again before opening
the participant feed.

| ID | Verification | Android | iOS | Evidence / notes |
|---|---|---|---|---|
| N-01 | Disable networking before first launch. Clean install imports the pinned pool/version without contacting the content pipeline and reaches Research Setup. | PASS (emulator) | PENDING | Airplane mode was enabled before first launch. The clean install stayed alive, reached Research Setup, and persisted ready pool version `pilot-v1-20260717` in IndexedDB. First import took approximately 55–80 seconds. |
| N-02 | Bind the assigned account using the one required online setup call, disable networking, then browse multiple full article posts; Home → PostDetail → Saved works with no live article or thumbnail fetch. | BLOCKED (partial) | PENDING | Offline Home/PostDetail/Saved navigation, full frozen article text, save, and Saved recovery passed. The required real resolve call was not exercised: mixed-content blocking required direct fixture-identity insertion. Multiple article posts were not exhaustively opened. |
| N-03 | Force-stop/restart while still offline. The pool version, order, full article text, saves, and ready state are unchanged. | PASS (emulator) | PENDING | Force-stop/relaunch remained offline; the same ready version, frozen feed/article data, and saved post recovered from IndexedDB. Restart hydration took approximately 80 seconds. |
| N-04 | Online selected YouTube playback/progress works when the provider permits it; source click opens the exact frozen URL. | BLOCKED (partial) | PENDING | `candidate-0027` loaded the real YouTube iframe online; ADB play produced visible moving video/subtitles and an audio-stream-open log. The exact frozen source click target was not independently exercised, so the complete row is not a pass. |
| N-05 | Offline/unavailable/origin-referrer error 153 shows the frozen digest/summary, source link, and exact transcript-unavailable notice without a blank/dead card. | FAIL (emulator) | PENDING | With network disabled, force-stop/relaunch, and `candidate-0027` reopened, the embedded frame showed Chromium's `Webpage not available` / `net::ERR_NAME_NOT_RESOLVED`. The app did not replace it with `Video unavailable - showing reviewed summary`, and no exact transcript-unavailable notice exists in the current locale/UI contract. The frozen source link remained present. Root evidence: `OriginalContent.tsx` relies on `navigator.onLine`, window online/offline events, and iframe `onError`; Android WebView stayed logically online and the iframe navigation failure did not reach React's `onError`. |
| N-06 | Control and experimental installs expose identical provider/model configuration and the same frozen suggested questions. | PENDING | PENDING | Experimental identity/install was not run. |
| N-07 | Ask identical typed, suggested, follow-up, insufficient-evidence, and off-topic questions in both conditions; filtering and answer quality remain post-scoped and condition-neutral. | BLOCKED (partial) | PENDING | Control identity only: live Gemini Q&A passed for a typed on-topic question, a clicked frozen suggestion, a same-post follow-up, an unsupported-statistics question (answered that the post did not establish sample size/confidence interval), and `What is the weather?` (gentle redirect: current post does not establish the answer). Experimental parity was not run, so condition neutrality is unverified. |
| N-08 | Submit the local fixture-safe malicious case. It is rejected before model/write and its raw text is absent from durable Q&A and upload/event records. | PENDING | PENDING | Not executed before the emulator run was interrupted. |
| N-09 | Restart after successful Q&A. The complete same-post thread recovers without cross-post context. | PENDING | PENDING | Successful control Q&A was created, but the required post-Q&A restart and cross-post isolation check were not executed. |
| N-10 | Source clicks, video progress, questions, saves, and recommendation reasons emit only allowlisted event fields. | PENDING | PENDING | Interactions occurred, but durable event/upload records were not inspected for allowlist compliance. |
| N-11 | Header remains stable; scrolling, keyboard resize, pull/back gestures, commit-on-release edge swipe, and root overflow show no regression. | BLOCKED (partial) | PENDING | Basic article scrolling, system back, and text-input/keyboard interaction worked. Pull gesture, commit-on-release edge swipe, root-overflow invariants, and the complete header matrix were not reliably exercised. |
| N-12 | English, Simplified Chinese, Spanish, and Japanese UI locales render correctly while frozen content remains English. | PENDING | PENDING | Only English was exercised. |

## Sign-off

Phase 2 cannot be accepted until every required row passes on both physical
platforms. Record a failure in place and link the prospective fix; do not erase
the failed observation.

- Android reviewer/signature: ____________________  Date: __________
- iOS reviewer/signature: ________________________  Date: __________
- Research owner acceptance: _____________________  Date: __________
- Final result: **BLOCKED — N-05 failed on Android emulator; remaining Android/iOS rows pending**

# Phase 2 native content-pool UAT

Status: **BLOCKED — physical-device verification pending**
Prepared: 2026-07-17 (America/Indianapolis)

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
| N-01 | Disable networking before first launch. Clean install imports the pinned pool/version without contacting the content pipeline and reaches Research Setup. | PENDING | PENDING |  |
| N-02 | Bind the assigned account using the one required online setup call, disable networking, then browse multiple full article posts; Home → PostDetail → Saved works with no live article or thumbnail fetch. | PENDING | PENDING |  |
| N-03 | Force-stop/restart while still offline. The pool version, order, full article text, saves, and ready state are unchanged. | PENDING | PENDING |  |
| N-04 | Online selected YouTube playback/progress works when the provider permits it; source click opens the exact frozen URL. | PENDING | PENDING |  |
| N-05 | Offline/unavailable/origin-referrer error 153 shows the frozen digest/summary, source link, and exact transcript-unavailable notice without a blank/dead card. | PENDING | PENDING |  |
| N-06 | Control and experimental installs expose identical provider/model configuration and the same frozen suggested questions. | PENDING | PENDING |  |
| N-07 | Ask identical typed, suggested, follow-up, insufficient-evidence, and off-topic questions in both conditions; filtering and answer quality remain post-scoped and condition-neutral. | PENDING | PENDING |  |
| N-08 | Submit the local fixture-safe malicious case. It is rejected before model/write and its raw text is absent from durable Q&A and upload/event records. | PENDING | PENDING |  |
| N-09 | Restart after successful Q&A. The complete same-post thread recovers without cross-post context. | PENDING | PENDING |  |
| N-10 | Source clicks, video progress, questions, saves, and recommendation reasons emit only allowlisted event fields. | PENDING | PENDING |  |
| N-11 | Header remains stable; scrolling, keyboard resize, pull/back gestures, commit-on-release edge swipe, and root overflow show no regression. | PENDING | PENDING |  |
| N-12 | English, Simplified Chinese, Spanish, and Japanese UI locales render correctly while frozen content remains English. | PENDING | PENDING |  |

## Sign-off

Phase 2 cannot be accepted until every required row passes on both physical
platforms. Record a failure in place and link the prospective fix; do not erase
the failed observation.

- Android reviewer/signature: ____________________  Date: __________
- iOS reviewer/signature: ________________________  Date: __________
- Research owner acceptance: _____________________  Date: __________
- Final result: **PENDING**

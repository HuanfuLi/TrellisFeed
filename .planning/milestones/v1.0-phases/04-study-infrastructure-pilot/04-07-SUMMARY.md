---
phase: 04-study-infrastructure-pilot
plan: 07
subsystem: research-infrastructure
tags: [cloudflare-worker, wrangler, cors, deployment-contract, pilot-protocol, adb, android, d1-ingest]

requires:
  - phase: 04-06
    provides: canonical Worker consolidation and the original backend-first pilot deploy gate
provides:
  - tracked exact-origin deployment contract for the canonical research collector
  - config-derived regression coverage for both public endpoint preflights
  - pilot deploy gate requiring uploaded binding inspection and real-origin OPTIONS evidence
  - fresh API 36 enrollment, consent, persistence, and real-ingest evidence for seeded account 1001
affects: [phase-04-uat, phase-04-verification, STUDY-03, STUDY-05]

tech-stack:
  added: []
  patterns: [tracked non-secret deployment vars, config-derived runtime tests, exact-origin release gates]

key-files:
  created: [research-backend/test/deployment-config.test.mjs, .planning/debug/resolved/phase4-android-webview-cors.md]
  modified: [research-backend/wrangler.jsonc, docs/pilot_protocol.md, .planning/phases/04-study-infrastructure-pilot/04-UAT.md, .planning/phases/04-study-infrastructure-pilot/04-VERIFICATION.md]

key-decisions:
  - "The tracked Wrangler vars object contains only the exact four-origin RESEARCH_ALLOWED_ORIGINS binding; credentials remain Worker secrets."
  - "Origin-less admin/export smoke is supplementary and cannot replace uploaded-version inspection plus public-endpoint preflights."

patterns-established:
  - "Deployment config is executable test input rather than an unverified operational artifact."
  - "Both public endpoints must prove exact Android WebView-origin behavior before a deploy passes."

requirements-completed: []

coverage:
  - id: D1
    description: "Canonical tracked config supplies and tests the exact non-secret origin allowlist"
    requirement: STUDY-03
    verification:
      - kind: integration
        ref: "research-backend/test/deployment-config.test.mjs"
        status: pass
      - kind: other
        ref: "cd research-backend && node --test test/deployment-config.test.mjs test/cors-auth.test.mjs && npm test"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pilot protocol gates deploys on the canonical Worker, uploaded binding, exact preflights, and a denied near-match"
    requirement: STUDY-05
    verification:
      - kind: other
        ref: "04-07-PLAN.md Task 2 inline deploy CORS gate verification"
        status: pass
    human_judgment: false
  - id: D3
    description: "Fresh API 36 WebView enrollment and behavioral-event ingest pass through the canonical Worker"
    requirement: STUDY-03
    verification:
      - kind: manual
        ref: "ADB-only install/clear/enroll/consent/post/relaunch on emulator-5554"
        status: pass
      - kind: integration
        ref: "Read-only remote D1 user 1001 count/window query"
        status: pass
    human_judgment: false

duration: multi-session
completed: 2026-07-20
status: complete
---

# Phase 4 Plan 07: Android WebView CORS Gap Closure Summary

**The canonical deployment carries a config-tested exact origin allowlist, and a fresh API 36 WebView now enrolls, persists account 1001, and uploads real research events through it.**

## Performance

- **Duration:** Multi-session; Task 5 continuation ran from 2026-07-20T05:49:44Z through report refresh
- **Started:** 2026-07-20T04:36:39Z
- **Completed:** 2026-07-20
- **Tasks:** 5 of 5 complete
- **Files created/modified:** 3 committed implementation/protocol files plus 4 uncommitted planning artifacts

## Accomplishments

- Added a TDD deployment regression that reads `wrangler.jsonc`, pins the canonical Worker/D1 target, rejects unsafe tracked vars, and exercises both public preflight paths for all approved, near-match, and missing-binding cases.
- Restored only the approved non-secret `RESEARCH_ALLOWED_ORIGINS` value to the canonical Wrangler config without changing `worker.ts` or any deployment identity.
- Hardened pilot protocol §1.2 with pre-deploy tests, canonical-target confirmation, 100%-traffic binding inspection, exact positive preflights, and a denied near-match check while retaining migration/admin/export gates.
- Recorded the authorized canonical Worker redeploy as version `55b154c5-8dd2-4f25-8045-673ceb9fa406`, with passing live preflights for both public endpoints and denied near-match origins.
- Passed the full fresh-device boundary on API 36: real account-1001 enrollment, current consent, feed/post interaction, relaunch persistence, sanitized logcat, and a +19 remote D1 behavioral-event delta.

## Task Status

| Task | Status | Commit | Files |
|---|---|---|---|
| Task 1 RED: Add failing deployment config contract | COMPLETE | `5d9f6c5` | `research-backend/test/deployment-config.test.mjs` |
| Task 1 GREEN: Restore canonical origin binding | COMPLETE | `f729bcb` | `research-backend/wrangler.jsonc` |
| Task 2: Make real-origin preflights part of the deploy gate | COMPLETE | `2bf0fce` | `docs/pilot_protocol.md` |
| Task 3: Authorize canonical redeploy and live smoke | COMPLETE — operator authorized the bounded canonical deploy and seeded-account-1001 write | — | — |
| Task 4: Redeploy and prove the live uploaded binding | COMPLETE | — (live operation; no source commit) | `question-trace-research-collector` version `55b154c5-8dd2-4f25-8045-673ceb9fa406` |
| Task 5: Fresh API 36.1 enrollment/ingest and report refresh | COMPLETE | — (`commit_docs=false`) | UAT, verification, resolved debug session, summary |

## Task Commits

1. **Task 1 RED:** `5d9f6c5` — `test(04-07): add failing deployment config contract`
2. **Task 1 GREEN:** `f729bcb` — `fix(04-07): restore canonical origin binding`
3. **Task 2:** `2bf0fce` — `docs(04-07): require real-origin deploy evidence`

No plan-metadata commit was created because `commit_docs=false` and the plan is paused before Task 3.

## Files Created/Modified

- `research-backend/test/deployment-config.test.mjs` — loads the tracked canonical config and proves exact, fail-closed CORS behavior without D1 work.
- `research-backend/wrangler.jsonc` — adds only the exact approved non-secret origin binding.
- `docs/pilot_protocol.md` — amends only §1.2 with the stronger deploy and real-origin verification gate.
- `.planning/phases/04-study-infrastructure-pilot/04-UAT.md` — resolves Test 19 while preserving the original failed-device report and adds the successful retest evidence.
- `.planning/debug/resolved/phase4-android-webview-cors.md` — preserves the diagnosis and records the verified resolution after moving from the active debug directory.
- `.planning/phases/04-study-infrastructure-pilot/04-VERIFICATION.md` — re-verifies the phase, removes resolved pool/database/device items, and retains only the genuine 3–5-person pilot as human-needed.
- `.planning/phases/04-study-infrastructure-pilot/04-07-SUMMARY.md` — uncommitted complete execution record for the orchestrator.

## Verification

- RED: `node --test test/deployment-config.test.mjs` failed against the origin-less config as required (1 pass, 3 failures, 0 skips).
- GREEN/Task 1: targeted config+CORS tests passed 8/8 with 0 skips.
- Task 1 full backend suite: passed 49/49 with 0 failures and 0 skips.
- Task 2 inline protocol verification printed `deploy CORS gate ok`.
- Task 2 rerun: targeted tests passed 8/8 and the full backend suite passed 49/49, both with 0 skips.
- Scope checks proved `worker.ts` unchanged, Wrangler vars exact, and protocol content outside §1.2 unchanged.
- Task 4 live boundary: canonical Worker version `55b154c5-8dd2-4f25-8045-673ceb9fa406` carried the required origin binding; `https://localhost` preflights on `/v1/install/resolve` and `/v1/ingest` returned 204 with exact headers, while near-match origins returned 403.
- Task 5 app gates: `npm test` passed 611/611 with zero failures/skips; lint passed with zero errors (7 existing warnings); production build passed and packaged 77 posts from `pilot-graph-20260718`; the package check verified the same pool; Capacitor sync and Gradle `assembleDebug` passed.
- Task 5 APK identity: `com.trellis.app`, versionCode 1/versionName 1.0, compile/target SDK 36, assembled `2026-07-20T05:54:46Z`, SHA-256 `2ebd83d0e8f0313538fef2620943681d2bd08778850a42e0236eee0ac8d38a30`.
- Task 5 ADB boundary: the only device was `emulator-5554` at SDK 36; install and data clear succeeded; account 1001 advanced from Research Setup to onboarding, accepted the current five-disclosure consent, rendered Home, opened a real post, and remained bound after relaunch.
- Task 5 log/remote evidence: sanitized logcat showed both `https://localhost` launches and zero targeted CORS/network-error matches. Read-only D1 queries returned 19 behavioral events for account 1001, received `2026-07-20T05:57:50.509Z`–`05:59:17.790Z`, a +19 delta from baseline; the query wrote zero rows.

## Decisions Made

None beyond the plan's locked contract. The implementation uses the exact approved origins, canonical Worker/D1 identity, existing fail-closed runtime, and Worker-secret credential boundary.

## Deviations from Plan

None — the plan was completed within the authorized scope; Task 5 changed only the required uncommitted planning reports.

## Issues Encountered

None.

## Known Stubs

- `docs/pilot_protocol.md` retains explicit operator placeholders for the live database, 100%-traffic version ID, and canonical Worker base URL. These are intentional copy-time inputs; no credential or private value is tracked.

## Operator Evidence

- Task 3 authorization covered the existing canonical Worker redeploy and the seeded-account-1001 live smoke; no duplicate Worker, migration, secret change, or live-row deletion was authorized or performed.
- Task 4 redeployed only `question-trace-research-collector` on 2026-07-20 as version `55b154c5-8dd2-4f25-8045-673ceb9fa406` with `RESEARCH_ALLOWED_ORIGINS` bound.
- Live positive preflights for `https://localhost` passed on both public endpoints with exact ACAO, `Vary`, methods, and allowed headers; near-match origins were denied with 403.

## Task 5 Fresh-Device Evidence

- **Window:** smoke began `2026-07-20T05:55:11.648Z`; enrollment submitted at `05:56:36.124Z`; consent completed at `05:57:49.404Z`; post opened at `05:58:13.989Z`; relaunch began at `05:59:06.265Z`.
- **Freshness and interaction method:** `adb install -r` followed by successful `pm clear com.trellis.app`; logcat cleared before launch; all UI inspection used `uiautomator dump`, and all interaction used `adb shell input`/`monkey` only.
- **Hierarchy assertions:** setup showed account value 1001 and Confirm account; successful submit showed Welcome rather than the preserved failure message; consent showed all five disclosures and an enabled Continue after explicit acceptance; Home showed the packaged feed; Post Detail showed the selected frozen article; relaunch hierarchy still exposed account ID 1001 and Home/Post content.
- **Transport assertion:** remote account-1001 count was 19 versus the provided pre-smoke baseline of 0. Event breakdown was 16 `feed_impression`, 2 `post_open`, and 1 `app_open`; first/last receipt times fall inside the retest window.
- **Prohibitions honored:** no fetch stub, DevTools override, Computer Use, emulator-window click/focus, AI request, remote D1 mutation query, row deletion, deploy, or secret command occurred during Task 5.

## Completion Status

Tasks 1–5 are complete. Planning artifacts remain uncommitted because `commit_docs=false` and the assignment explicitly prohibited commits.

## Next Phase Readiness

- Configuration, regression, protocol, live Worker, fresh Android, and ingest gates are verified.
- The CORS gap is resolved and archived under `.planning/debug/resolved/`.
- The separate 3–5-person pilot remains the only human-needed item; this single seeded-account infrastructure smoke does not claim STUDY-05 complete.

## Self-Check: PASSED

- Found all implementation/protocol deliverables, refreshed UAT/verification, resolved debug report, and this uncommitted summary.
- Found commits `5d9f6c5`, `f729bcb`, and `2bf0fce`; each commit contains only its explicit task file.
- Confirmed Task 5 changed no app/backend source, performed no commit, and remote verification queries reported zero writes.

---
*Phase: 04-study-infrastructure-pilot*
*Completed after Task 5 fresh-device re-verification: 2026-07-20*

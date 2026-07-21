# Phase 01 Deployment and Real-Device Smoke

- Verified at: 2026-07-12T02:45:59Z
- Remote database migration: `0002_install_tokens.sql` applied
- Deployment version source: Secret Change, serving 100% of production traffic
- Browser platform: approved Vite development origin
- Native platform: Android debug research build on a participant-style physical phone
- Build isolation: reconstructed Phase-1-only worktree, excluding concurrent Phase 2 content-pool work

## Sanitized results

| Check | Result |
|---|---|
| Real browser preflight returns the exact approved-origin CORS grant | PASS |
| Authenticated numeric-account enrollment returns a one-time opaque installation token | PASS |
| Installation token accepts an identity-free behavioral event | PASS |
| Missing or incorrect installation token is rejected | PASS |
| Disallowed origin is rejected without an access-control grant | PASS |
| Researcher status and export routes remain protected without admin authentication | PASS |
| Export implementation still produces exactly the two required CSV entries | PASS (backend regression suite) |
| Fresh install opens in English and accepts only a neutral numeric account | PASS |
| Participant routes and research writes remain blocked until affirmative consent | PASS (local and remote counts zero before consent) |
| Settings exposes only numeric account identity and language selection | PASS |
| Retired microphone and notification permissions/prompts are absent | PASS |
| Multiple behavioral and Q/A records persist while fully offline | PASS |
| Force-stop and offline relaunch preserve identity, consent, records, and pending queue | PASS |
| Network restoration drains pending uploads without participant action | PASS |
| WebView connectivity ambiguity is covered by a low-frequency retry fallback | PASS (device regression plus automated trigger test) |
| Hidden diagnostics rejects an unconfigured build and requires the configured researcher PIN | PASS |
| Unlocked diagnostics exposes only pending count, last success, and recovery export | PASS |
| Recovery export action completes without an application error | PASS |
| Collector receives both behavioral and Q/A rows for the temporary account | PASS |
| Admin status and archive endpoints reject unauthenticated access | PASS |
| Temporary account, installation, behavioral event, and Q/A rows removed | PASS (verified zero remaining rows) |
| Temporary local participant data removed and app returned to fresh English setup | PASS |

No endpoint, origin string, database or Worker identifier, account identifier, authorization header value, token, password, PIN, or key material is recorded in this evidence.

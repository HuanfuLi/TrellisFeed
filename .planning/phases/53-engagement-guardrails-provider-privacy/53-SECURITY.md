---
phase: 53
slug: engagement-guardrails-provider-privacy
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-20
updated: 2026-05-20
---

# Phase 53 - Security

Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| test harness -> module under test | The in-memory localStorage shim lets privacy goldens seed private sentinel data before provider modules are imported. Incorrect shim behavior could mask a leak. | Test-only private sentinel fixtures for collections, engagement, and graph edit journal data. |
| device localStorage -> provider fetch body | Private user data lives in dedicated `trellis_*` localStorage keys; the risk is interpolation into outbound LLM/TTS request bodies. | User collections/tags, saved/liked engagement state, and graph correction log entries. |
| source code -> outbound provider payload | Future code changes could read private services while assembling prompt-bearing provider requests. | Private local data crossing from app services into LLM/TTS provider payloads. |
| product design -> engagement mechanics | Future changes could add coercive engagement constructs contrary to the locked non-pushy product stance. | Engagement UI/logic signals that influence learner behavior. |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-53-01 | Information Disclosure | Privacy goldens; `providers/tts/index.ts` `synthesize`; `providers/llm/index.ts` `chatCompletion` | mitigate | `app/tests/helpers/memory-localstorage.mjs` provides a faithful dependency-free Storage shim so private sentinels are really seeded. `app/tests/providers/privacy-payload-tts.test.mjs` and `app/tests/providers/privacy-payload-llm.test.mjs` seed all three protected keys and assert captured outbound provider bodies exclude those sentinels, with non-vacuous positive capture assertions. | closed |
| T-53-02 | Information Disclosure | Provider chokepoints and prompt-bearing call-sites | mitigate | `app/tests/providers/privacy-callsite-structural.test.mjs` asserts provider chokepoints do not reference private services, all non-reorg prompt call-sites do not read graph-edit-journal, prompt call-sites do not read collections, and engagement reads are limited to the documented concept-feed dismissed-anchor ID filter. The D-07 `reorganizeMindmap` journal read remains the only documented exception. | closed |
| T-53-03 | Engagement ethics (non-STRIDE) | `src/**` engagement mechanics | mitigate | `app/tests/learn-04-no-pushy-mechanics.test.mjs` recursively scans source for forbidden coercive constructs: streaks, leaderboards, stop cues, mandated/daily goals, and public-like/like-count mechanics. A positive regression guard confirms allowed hidden `liked` and reward vocabulary do not trip the guard. | closed |
| T-53-SC | Tampering | npm/pip/cargo installs | accept | No packages were installed for this phase. All added tests/helpers use Node built-ins plus existing project dependencies. | closed |

Status: open or closed.
Disposition: mitigate (implementation required), accept (documented risk), transfer (covered outside the current plan).

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-53-01 | T-53-SC | Supply-chain tampering risk from new installs is accepted because the phase added no packages and introduced only dependency-free helpers/tests using Node built-ins plus existing project dependencies. | GSD phase plan + Codex security audit | 2026-05-20 |

---

## Security Audit 2026-05-20

| Metric | Count |
|--------|-------|
| Threats found | 4 |
| Closed | 4 |
| Open | 0 |

### Evidence

- `node --test tests/providers/privacy-payload-tts.test.mjs tests/providers/privacy-payload-llm.test.mjs tests/providers/privacy-callsite-structural.test.mjs tests/learn-04-no-pushy-mechanics.test.mjs` from `app/`: 38 tests passed, 0 failed.
- Chokepoint grep found no `engagement.service`, `collection.service`, or `graph-edit-journal` references in `src/providers/llm/index.ts`, `src/providers/llm/locale-directive.ts`, `src/providers/llm/user-content-bracketing.ts`, or `src/providers/tts/index.ts`.
- Prompt-call-site grep found only the documented exceptions: `src/services/canonical-knowledge.service.ts` imports graph-edit-journal for the D-07 `reorganizeMindmap` path, and `src/services/concept-feed.service.ts` imports engagement service for the dismissed-anchor ID filter.
- Coercive-mechanics grep found no source matches for streaks, leaderboards, stop cues, mandated/daily goals, or public-like/like-count constructs.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-20 | 4 | 4 | 0 | Codex |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

Approval: verified 2026-05-20

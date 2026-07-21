---
phase: 4
slug: study-infrastructure-pilot
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-18
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `04-RESEARCH.md` ## Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:test` + `assert/strict` (Node 22.19.0) |
| **Config file** | `app/scripts/run-tests.mjs` (app); none for backend — `node --test test/*.test.mjs` |
| **Quick run command** | app: `node --test tests/services/study-context.service.test.mjs tests/services/upload-queue.service.test.mjs tests/phase1/consent-gate.test.mjs tests/locales/bundle-parity.test.mjs` · backend: `node --test test/validation.test.mjs test/ingest.test.mjs test/export.test.mjs` |
| **Full suite command** | `cd app && npm test` · `cd research-backend && npm test` |
| **Estimated runtime** | quick <30s; full app suite ~1–2 min |

---

## Sampling Rate

- **After every task commit:** Run the relevant single-file app or backend command (<30s)
- **After every plan wave:** app `npm test` + backend `npm test`; locale parity + missing-key after any consent copy change
- **Before `/gsd-verify-work`:** app `npm test` + `npm run lint`, backend `npm test`, all green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

*Rows keyed to the requirement → test map in `04-RESEARCH.md` and the eight Required Executable Assertions. Threat refs live in each PLAN's `<threat_model>` block.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-T1 | 01 | 1 | STUDY-03 | plan TM | wire allowlist rejects extras/identity | unit | backend `node --test test/validation.test.mjs` | ✅ extends | ⬜ pending |
| 04-01-T2 | 01 | 1 | STUDY-03 | plan TM | D1 schema/index shape pinned | integration | backend `node --test test/migration-schema.test.mjs` | ❌ W0 | ⬜ pending |
| 04-02-T1 | 02 | 2 | STUDY-03 | plan TM | server identity, cross-account 409, idempotent insert | integration | backend `node --test test/ingest.test.mjs` | ✅ extends | ⬜ pending |
| 04-02-T2 | 02 | 2 | STUDY-03/04, RQ-03 | plan TM | 4-file ZIP, served_at join, zero-activity participant row | integration | backend `node --test test/export.test.mjs` | ✅ extends | ⬜ pending |
| 04-03-T1 | 03 | 2 | STUDY-03 | plan TM | dbQuery-only projection, consent-gated, idempotent | integration | app `node --test tests/services/recommendation-research.service.test.mjs` | ❌ W0 | ⬜ pending |
| 04-03-T2 | 03 | 2 | STUDY-03 | plan TM | recommendation kind delivery/receipt/poison-row | integration | app `node --test tests/services/upload-queue.service.test.mjs` | ✅ extends | ⬜ pending |
| 04-03-T3 | 03 | 2 | STUDY-03 | plan TM | control rows carry no contributing trace IDs; throwing-spy stays green | integration | app `node --test tests/services/recommendation-research.service.test.mjs tests/services/recommendation.service.test.mjs tests/phase1/consent-gate.test.mjs` | mixed | ⬜ pending |
| 04-04-T1 | 04 | 1 | STUDY-01 | plan TM | versioned research consent; legacy aiConsentGiven never satisfies | unit | app `node --test tests/phase4/onboarding-consent.test.mjs tests/phase1/consent-gate.test.mjs` | ❌ W0 | ⬜ pending |
| 04-04-T2 | 04 | 1 | STUDY-01 | plan TM | five §14.3 disclosures, no topic/key step | unit | app `node --test tests/phase4/onboarding-consent.test.mjs tests/phase1/consent-gate.test.mjs tests/services/interaction-log.service.test.mjs` | ❌ W0 | ⬜ pending |
| 04-04-T3 | 04 | 1 | STUDY-01 | plan TM | 4-locale parity for consent copy | locale | app `node --test tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs` | ✅ | ⬜ pending |
| 04-05-T1 | 05 | 3 | STUDY-02 | plan TM | seeded assignment drives ranker+logging; no randomizer | traceability | app `node --test tests/services/study-context.service.test.mjs tests/services/interaction-log.service.test.mjs tests/services/recommendation.service.test.mjs` + backend validation/ingest | ✅ | ⬜ pending |
| 04-05-T2 | 05 | 3 | STUDY-02 | — | D-15 doc wording aligned | source assertion | grep-based acceptance criteria in plan | ✅ | ⬜ pending |
| 04-06-T1 | 06 | 3 | STUDY-05/04, RQ-03 | plan TM | protocol doc complete incl. blind-scoring + re-freeze precondition | doc + source assertion | plan acceptance criteria | ❌ new doc | ⬜ pending |
| 04-06-T2 | 06 | 3 | STUDY-05 | plan TM | live D1 migrate+deploy+4-file smoke (operator) | checkpoint:human-verify | manual — blocking gate | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/tests/services/recommendation-research.service.test.mjs` — dbQuery projection, order, crash reconciliation, control privacy, wire shape
- [ ] `app/tests/phase4/onboarding-consent.test.mjs` — research-consent version/gate + five-item/no-topic/no-key contract
- [ ] Extend `app/tests/services/upload-queue.service.test.mjs` — recommendation kind delivery, receipt/reconcile, poison-row
- [ ] Extend `research-backend/test/validation.test.mjs` — recommendation allowlist/bounds/identity rejection
- [ ] Extend `research-backend/test/ingest.test.mjs` — immutable insert, retry, cross-account 409, server identity
- [ ] Extend `research-backend/test/export.test.mjs` — exact four-file ZIP, recommendation columns/served join, zero-activity participant row
- [ ] Migration/schema assertion for the recommendations D1 table + indexes
- [ ] Manual UAT evidence template in `docs/pilot_protocol.md`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end pilot run (3–5 users) | STUDY-05 | Requires humans + operator-controlled deployment | Follow `docs/pilot_protocol.md` checklist after operator pool re-freeze |
| External oral-test capture/join | STUDY-04 / RQ-03 | Recording is out-of-band by design (D-06) | Neutral `user_id` filenames; join to `participants.csv` after blinded scoring |
| Live D1 migration/deploy smoke | STUDY-03 | Live credentials are operator-controlled | Backend-first migrate + deploy + smoke before client distribution |
| In-app onboarding/consent on device | STUDY-01 | WebView rendering + i18n visual check | Fresh install → welcome → language → consent (5 §14.3 items visible in all 4 locales) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

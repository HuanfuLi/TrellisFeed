# Phase 1: Rebrand + research shell hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `01-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-07-10
**Phase:** 1-Rebrand + research shell hardening
**Areas discussed:** 研究账号、组别与日志；研究人员隐藏设置与研究 key 交付；参与者可见的品牌与设置文案

---

## 研究账号、组别与日志

| Topic | Alternatives considered | Selected |
|---|---|---|
| Participant identity | Separate anonymous local ID; pre-created research account | Pre-created research account; its stable numeric ID is `userId` |
| Condition allocation | App-performed stratified randomization; research-team allocation | Research team manually balances/assigns after Zoom pretests and maps a fixed account to condition |
| Participant settings | Broad inherited settings; account ID and language only | Neutral numeric account ID and UI language only; Saved stays available |
| Event detail | Broad page/source/device context; minimum behavioral fields | Minimum behavioral fields and related IDs/duration; no redundant source, position, or page context |
| Client key delivery | Manual entry; build-time injection | Build-time study-package injection, with no real secret committed or documented |

**Notes:** A participant is never told their experimental condition. Each pre-assigned account is installed on one participant-owned phone and cannot be logged out, switched, or modified by the participant. The existing experiment-design document conflicts with this manual allocation decision and needs later alignment.

---

## 研究人员隐藏设置与研究 key 交付

| Topic | Alternatives considered | Selected |
|---|---|---|
| Access | Participant-visible configuration; researcher PIN | PIN-protected hidden researcher page |
| Device/account policy | Allow switching after handoff; one account per device | One participant-owned phone permanently bound to one account |
| Local researcher operations | Full admin controls; diagnostics and export only | Pending count, last success, and per-device recovery export only |
| Network handling | Online-only upload; local queue and retry | Persist locally first and auto-retry after offline use until server acknowledgment |
| Collection scope | Interface-only now; real backend later | Deploy a real simple collection backend and fixed URL in Phase 1 |
| Central access | Researcher-only endpoint; protected webpage | Simple password-protected researcher webpage |
| Export | One mixed dataset; two CSV files | One archive containing behavioral-event CSV and question/answer CSV, plus basic upload health |

**Notes:** The central-page password is separate from the app PIN and remains server-side. The participant package cannot contain the researcher webpage password. No destructive controls are wanted.

---

## 参与者可见的品牌与设置文案

| Topic | Alternatives considered | Selected |
|---|---|---|
| Brand prominence | Repeat QuestionTrace throughout the app; system-level name only | QuestionTrace on the home screen/system surface; neutral in-app functional titles |
| Initial language | Follow device language; default English | Default English |
| Account display | Account profile/name; neutral numeric ID | Pure neutral numeric identifier only |
| Language change | Restart required; immediate | Immediate UI update without restart; content stays English |

**Notes:** The supported UI languages are English, Chinese, Spanish, and Japanese. Participants see no condition, study explanation, or additional settings data.

---

## the agent's Discretion

- Pick minimal suitable backend/storage/deployment and retry/export mechanics.
- Keep all secrets, credentials, actual URLs, and participant data out of source control and planning artifacts.

## Deferred Ideas

- Update the experimental-design document so its account/condition assignment wording matches the decided researcher-led manual balancing procedure.

# Phase 1: Rebrand + research shell hardening - Context

**Gathered:** 2026-07-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a stable QuestionTrace research shell: complete rebrand and storage rename, fixed research-account/condition plumbing, minimum-compliant behavioral logging, and a usable end-to-end collection path from the participant's phone to a protected researcher download page. This phase intentionally includes the real logging backend and deployment, rather than leaving the collection loop for a later phase. It does not add participant capabilities beyond browsing posts, post-scoped questions, Saved, and the deliberately minimal Settings page.

</domain>

<decisions>
## Implementation Decisions

### Research accounts, conditions, and participant surface
- **D-01:** Researchers pre-create neutral, numeric-only accounts. During in-person installation they enter the account assigned after the Zoom pretest; that stable account ID is the `userId` for every record.
- **D-02:** Account-to-condition mapping is fixed before handoff and hidden from participants. Researchers manually balance/assign people after pretests (including speaking amount); the app must not automate stratification or random assignment.
- **D-03:** Each app install is on one participant's own phone and permanently bound to its assigned account. No logout, account switch, condition switch, or participant data-clear action exists.
- **D-04:** Participant-visible routes are limited to feed/posts, post-scoped Ask, Saved, and Settings. Settings shows only the neutral numeric account ID and UI language. It contains no name, group, study explanation, privacy/data controls, or other account details.
- **D-05:** `QuestionTrace` is the mobile system/home-screen application name. In-app pages use neutral functional titles such as Feed, Saved, and Settings rather than repeatedly foregrounding the research brand.
- **D-06:** UI starts in English. Participants can switch the UI immediately to English, Chinese, Spanish, or Japanese without restart; curated content, questions, and answers remain English in all UI languages.

### Behavioral logging and privacy
- **D-07:** Log each required interaction with event type, timestamp, account ID, fixed condition, topic ID, related post/question/recommendation IDs, and applicable reading/video duration. Store submitted question text and answer data as question/answer records, not duplicated as arbitrary event payload.
- **D-08:** Do not collect source URL, feed display position, route/page-context fields, device metadata, keystroke timing, or any other redundant context derivable from identifiers and time order. Continue to exclude every prohibited category in RSD §14.2.
- **D-09:** The logging contract must cover all RSD §14.1 events before personalization is introduced and must support the RQ-01 behavioral measures.

### Researcher-only settings and recovery
- **D-10:** A hidden researcher page is protected by a researcher PIN. The PIN is a gate for the participant UI; it must not expose account/condition changes or destructive controls.
- **D-11:** The hidden page shows only necessary local diagnostics: pending upload count and last successful upload time. It can export the current participant's local records as a recovery backup; it cannot clear records, alter accounts/conditions, or accept API-key input.
- **D-12:** Study-specific client API configuration is injected when building the research installation package. No researcher manually enters a key, and no actual secret may be placed in the repository, planning documents, tests, logs, or user-facing output.

### Online collection and researcher export
- **D-13:** Phase 1 includes a real, simple log-collection backend deployed at a fixed online URL. Records are queued locally first, then uploaded when created; failed uploads retry automatically after connectivity returns until the server acknowledges receipt. Participants may use the app offline.
- **D-14:** The central data page is a minimal, password-protected researcher webpage. It is not participant-facing and has no general user accounts, editing, or complex dashboard. Its management password is server-side only and must never be embedded in the participant app.
- **D-15:** The researcher page provides basic upload-health status and one downloadable archive containing two CSV files: (1) behavioral events, and (2) question/answer records. The mobile hidden-page export remains a per-participant recovery copy, while the webpage export aggregates all accounts.

### the agent's Discretion
- Choose the simplest maintainable backend, database, upload batching/retry strategy, export mechanism, PIN storage mechanism, and deployment host that satisfy the locked behavior above.
- Define non-secret configuration conventions and test fixtures. Never invent or commit real client keys, PINs, passwords, URLs, or participant data.
- Preserve native bundle identifiers while changing all required display/rebrand surfaces.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research contract and scope
- `docs/research_system_design.md` §6.5, §9.8, §14.1–§14.3, §15.3, §23 — condition persistence, event schema, required/prohibited collection, frozen scope, and logging-before-personalization.
- `docs/SCOPE.md` — locked research boundaries and permanently pruned capabilities; do not reintroduce them.
- `CLAUDE.md` — load-bearing invariants to read before altering the feed pipeline, data layer, question filter, navigation shell, or headers; four-locale parity is mandatory for visible strings.
- `docs/prune_report.md` — Phase 0 pruning evidence and remaining dead-code sweep targets.

### Study protocol alignment
- `Documents/QuestionTrace_Research_Experimental_Design_EN.docx` §5, §7, §11–§15 — study procedure, pretest baselines, analysis, and privacy. Its wording about system stratified randomization must be aligned to the locked research-team manual assignment protocol above.

### Phase and requirement tracking
- `.planning/PROJECT.md` — project-level locked decisions and constraints.
- `.planning/REQUIREMENTS.md` — Phase 1 requirements `SHELL-01` through `SHELL-04`, `LOG-01`, and `RQ-01`.
- `.planning/ROADMAP.md` — Phase 1 success criteria and coarse-phase rule. The operator explicitly moved the real collection backend/export closure into Phase 1; planning must reconcile that allocation without creating extra phases.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/src/services/db.service.ts` — current IndexedDB/localStorage persistence seam; rename `trellis` and `trellis_db_` namespaces here without a migration framework.
- `app/src/services/settings.service.ts` and `app/src/state/useSettings.ts` — existing persisted settings flow, currently using `trellis_settings`.
- `app/src/lib/event-bus.ts` and `app/src/types/index.ts` — application event contract and reactive mutation pattern; logging and settings changes should integrate here so Capacitor screens re-read state.
- `app/src/locales/en.json`, `app/src/locales/zh.json`, `app/src/locales/es.json`, `app/src/locales/ja.json` — the four required locale bundles.

### Established Patterns
- Settings are currently split across `app/src/screens/SettingsScreen.tsx` and `app/src/screens/settings/`; Phase 1 must reduce the participant surface rather than expose inherited data/developer/configuration screens.
- `app/src/services/db.service.ts` exposes a persistence seam used by tests; persistence tests should verify through that seam instead of in-memory mirrors.
- The Capacitor app cannot rely on browser refresh; all mutation-driven UI state must use the established event-bus re-read pattern.

### Integration Points
- Add condition/account resolution before all event writes, then carry the resolved values through the local event store, upload queue, and server records.
- Connect the hidden researcher entry from a non-participant-visible route/path, guarded by the researcher PIN.
- Replace the existing app naming/storage references across web, Capacitor, settings, and locale surfaces while keeping bundle identifiers unchanged.

</code_context>

<specifics>
## Specific Ideas

- Numeric account identifiers are intentionally neutral and provide no clue about experimental group.
- Fixed content IDs plus timestamp order are enough to reconstruct reading order; logging source/display-position/page-context duplicates is unwanted.
- The study is conducted with a Zoom pretest followed by researcher-led account allocation during in-person app installation.
- Keep both the participant experience and researcher webpage intentionally small: the tool is a research instrument, not a consumer product or administrative platform.

</specifics>

<deferred>
## Deferred Ideas

- **Protocol document alignment:** revise `Documents/QuestionTrace_Research_Experimental_Design_EN.docx` to replace the current system-performed stratified randomization wording with researcher-led, pretest-informed manual balancing and fixed-account assignment.

</deferred>

---

*Phase: 1-Rebrand + research shell hardening*
*Context gathered: 2026-07-10*

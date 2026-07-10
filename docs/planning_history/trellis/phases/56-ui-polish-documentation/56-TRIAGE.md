---
phase: 56-ui-polish-documentation
plan: 56-02
artifact: operator-triage
created: 2026-07-08
status: approved_worklist
operator_decision_source: "User approved assistant recommended triage in chat on 2026-07-08"
---

# Phase 56 Operator Triage

This file is the gating worklist for Phase 56 fix waves. Plans 56-03, 56-04, and 56-05 may touch only items marked `APPROVED` or `ADDED` here.

## APPROVED

### POLISH-01 visual / copy / color

| ID | Verdict | Scope | Approved direction |
|---|---|---|---|
| F-V01 | APPROVED | `app/src/screens/PlannerScreen.tsx` | Replace hardcoded green icon hex values with the matching CSS variable token (`var(--primary-40)`). |
| F-V02 | APPROVED | `app/src/screens/settings/SettingsDataScreen.tsx`, locale bundles | Replace Force-New-Day English toast literals with i18n keys in all four bundles (`en`, `zh`, `es`, `ja`). |

### POLISH-02 animation

| ID | Verdict | Resolution | Approved direction |
|---|---|---|---|
| F-A01 | APPROVED | simplify | Rewrite `glow-pulse` so keyframes animate only `transform` and `opacity`; remove per-frame `box-shadow`. |
| F-A02 | APPROVED | simplify | Rewrite `aha-pulse` so keyframes animate only `transform` and `opacity`; remove per-frame `box-shadow`. |
| F-A04 | APPROVED | simplify | Remove `status-glow` box-shadow animation in `TrellisStatusPanel`; keep the existing static shadow, no new motion. |
| F-A-RM | APPROVED | add reduced-motion block | Add one `@media (prefers-reduced-motion: reduce)` block in `index.css` disabling approved ambient CSS loops. |

### POLISH-03 navigation / back-button

| ID | Verdict | Approved direction |
|---|---|---|
| F-N01 | APPROVED | Align QuestionDetailScreen visual back with hardware/history back by replacing `Header backTo="/ask"` with a history-pop visual back affordance (`navigate(-1)`), preserving the existing Header portal split. |
| F-N02 | APPROVED | Align SavedScreen visual back with hardware/history back by replacing `Header backTo="/home"` with a history-pop visual back affordance (`navigate(-1)`), preserving the existing Header portal split. |

### DOCS-01 archive / update

| ID | Verdict | Approved direction |
|---|---|---|
| F-D01 | APPROVED | Move `Documents/UI_AUDIT_REPORT.md` to `Documents/Legacy/UI_AUDIT_REPORT.md` via `git mv`. |
| F-D02 | APPROVED | Move `Documents/CHANGELOG_4_05.md`, `Documents/CHANGELOG_SUMMARY_4_05.md`, and `Documents/CHANGELOG_4_16.md` to `Documents/Legacy/` via `git mv`. |
| F-D03 | APPROVED | Move `.planning/v1.1-MILESTONE-AUDIT.md`, `.planning/v1.3-INTEGRATION-CHECK.md`, and `.planning/v1.3-MILESTONE-AUDIT.md` to `.planning/milestones/` via `git mv`. |
| F-D04 | APPROVED | Update `.planning/codebase/CONVENTIONS.md` to distinguish installed Tailwind CSS from the actual component styling convention: inline styles with CSS variables for most UI. |

## CUT / DEFERRED / ACCEPTED AS-IS

| ID | Verdict | Rationale |
|---|---|---|
| F-V03 | CUT / DEFERRED | Broader recovery/overdue state-token cleanup touches AnchorDetail/Review/InfoFlow state color semantics. Defer to a dedicated tokenization pass; only the explicitly approved Planner icon token fix lands now. |
| F-V04 | CUT | Text-art / blindbox palettes are authored presentation palettes; tokenizing them now is churn without a clear visual bug. |
| F-V05 | CUT | Home fruit gold is functional fruit-credit coloring; leave until a fruit/rewards token pass. |
| F-V06 | CUT | AskScreen warning/error fallback hex values are fallback-only and low-value for this phase. |
| F-V07 | CUT | GraphScreen palette is component-local third-party mind-map theming and already dark-mode branches. |
| F-A03 | CUT / WATCH | `glow-ring` uses `filter`; keep unless device UAT shows jank. Do not touch in 56-03. |
| F-A05 | CUT / WATCH | `node-pop` SVG radius animation is graph-local and not currently operator-reported jank. |
| F-A06 | CUT / WATCH | `edge-draw` stroke-dashoffset animation is graph-local and not currently operator-reported jank. |
| F-N03 | CUT / WATCH | CollectionDrillIn currently has Saved-origin entry semantics; leave `backTo="/saved"` unchanged. |
| F-N04 | ACCEPT AS CORRECT | Settings sub-page `backTo="/settings"` is intentional and matches normal entry history. |
| F-N05 | ACCEPT AS CORRECT | Settings root has no dynamic service state that requires `[location.pathname]` resync today. |
| F-D05 | KEEP LIVE | Current live docs remain at top level / current locations. |
| DR-03 | CUT | Do not rename `hydrate*FromSQLite` function names in Phase 56; naming debt is acknowledged but code churn is out of scope. |
| C-02 | CUT | Keep `SQLite` in proper-noun list unless a broader glossary cleanup is requested. |

## ADDED

No additional operator-added findings beyond the approved list above.

## CLAUDE.md CORRECTIONS

Apply only the following exact approved corrections in 56-05. No other `CLAUDE.md` hunks are authorized.

### DR-01 — Brand history / database name

Verdict: APPROVED stale-doc update.

Approved corrected wording:

> **Brand history:** Renamed EchoLearn → Trellis on 2026-05-07. The on-disk directory and the `~/.claude/projects/-Users-Code-EchoLearn/` auto-memory path are intentionally preserved for backwards compatibility. Current durable app storage uses IndexedDB with `IDB_NAME = 'trellis'` in `db.service.ts`; current localStorage keys use the `trellis_*` prefix. All user-facing surfaces — app name, bundle-facing copy, and product docs — say Trellis.

### DR-02 — Yesterday queue snapshot

Verdict: APPROVED stale-doc update.

Approved corrected wording:

> Yesterday-queue snapshot: the durable snapshot is stored in IndexedDB under `SQLITE_ROW_ID_YESTERDAY = 'queue_yesterday'` in `post-queue.service.ts`, with `_yesterday` as the synchronous in-memory read mirror for `getYesterdayQueue()`. `hydrateQueueFromSQLite()` and `normalizeState()` populate that snapshot on date mismatch before today's queue is rehydrated. The old localStorage key `trellis_post_queue_yesterday` is legacy-only and appears in `db.service.ts` solely as a stale key to purge after IndexedDB hydration.

## Execution Constraints for Fix Waves

- 56-03 may modify only the approved visual/copy/animation items above; no new motion or unapproved color-token sweep.
- 56-04 may modify only F-N01 and F-N02; App.tsx global `backButton` handler must remain untouched.
- 56-05 may archive only F-D01/F-D02/F-D03 docs, update only F-D04 convention wording, and apply only DR-01/DR-02 exact CLAUDE.md wording.
- Keep-live docs (`CHANGELOG_5_20.md`, `EMAIL-DRAFT-PROFESSOR.md`, `LANDING-VIDEO-SCRIPT.md`, `Documents/README.md`) must not move.

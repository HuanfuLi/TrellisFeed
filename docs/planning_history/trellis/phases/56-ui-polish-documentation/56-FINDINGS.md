---
phase: 56-ui-polish-documentation
plan: 56-01
artifact: findings
created: 2026-07-08
source: fresh source audit
status: ready_for_operator_triage
requirements: [POLISH-01, POLISH-02, POLISH-03, DOCS-01]
---

# Phase 56 Findings — UI Polish, Animation, Navigation, Documentation

This is the Wave-1 candidate list for operator triage. It is intentionally source-reading based: no source files were modified while producing this report.

Decision rule for later waves: only findings marked APPROVED or ADDED in `56-TRIAGE.md` may be fixed.

## POLISH-01 Visual / Copy / Color Findings

### Screen coverage matrix

All 18 target screens were checked against the 6-pillar rubric: copywriting, hierarchy, color, typography, spacing, motion.

| Screen | Copy | Hierarchy | Color | Typography | Spacing | Motion | Candidate findings |
|---|---|---|---|---|---|---|---|
| HomeScreen | OK | OK | Review | OK | OK | OK | F-V05 |
| AskScreen | OK | OK | Review | OK | OK | F-A-SAFE | F-V06 |
| PlannerScreen | OK | OK | Finding | OK | OK | OK | F-V01 |
| GraphScreen | OK | OK | Review | OK | OK | OK | F-V07 |
| SettingsScreen | OK | OK | OK | OK | OK | OK | None |
| PostDetailScreen | OK | OK | Review | OK | OK | F-A-SAFE | F-V04 |
| QuestionDetailScreen | OK | OK | OK | OK | OK | OK | F-N01 |
| AnchorDetailScreen | OK | OK | Finding | OK | OK | OK | F-V03 |
| ClusterDetailScreen | OK | OK | OK | OK | OK | OK | F-N-OK |
| CollectionDrillInScreen | OK | OK | Review | OK | OK | OK | F-N03 |
| ReviewScreen | OK | OK | Finding | OK | OK | OK | F-V03 |
| PodcastScreen | OK | OK | OK | OK | OK | F-A-SAFE | F-N-OK |
| SavedScreen | OK | OK | Review | OK | OK | F-A-SAFE | F-N02 |
| OnboardingScreen | OK | OK | OK | OK | OK | OK | F-N-OK |
| SettingsAIScreen | OK | OK | OK | OK | OK | OK | F-N04 |
| SettingsContentScreen | OK | OK | OK | OK | OK | OK | F-N04 |
| SettingsFeaturesScreen | OK | OK | OK | OK | OK | OK | F-N04 |
| SettingsDataScreen | Finding | OK | OK | OK | OK | OK | F-V02, F-N04 |

### Candidate findings

#### F-V01 — Planner row icons use hardcoded green hex instead of design tokens

- Severity: Low
- Pillars: Color, visual consistency
- Evidence: `app/src/screens/PlannerScreen.tsx:214` uses `#4CAF50`; `app/src/screens/PlannerScreen.tsx:264` uses `#66BB6A`.
- Why it matters: Phase 56 contract requires token-first polish fixes. These are semantically Trellis-green recovery icons and should resolve through the CSS variable system unless the operator wants an explicit state-color exception.
- Proposal: approve token replacement to `var(--primary-40)` or record as accepted functional-color exception.

#### F-V02 — SettingsDataScreen Force-New-Day dev toasts are hardcoded English

- Severity: Low
- Pillars: Copywriting, i18n
- Evidence: `app/src/screens/settings/SettingsDataScreen.tsx:91`, `:139`, `:143` call `toast()` with English literals.
- Why it matters: The strings are visible from Settings → Data/Privacy developer affordances and bypass the four-locale bundle contract.
- Proposal: approve adding i18n keys to all locale bundles, or mark this dev-only copy as accepted.

#### F-V03 — Recovery/overdue state colors are repeated as raw amber/red hex

- Severity: Low
- Pillars: Color, dark-mode parity
- Evidence: `app/src/screens/AnchorDetailScreen.tsx:230-231`, `:254-255`; `app/src/screens/ReviewScreen.tsx:732`; `app/src/components/InfoFlow.tsx:392`, `:608`.
- Why it matters: `#f59e0b` / `#ef4444` are functional state colors. They are consistent enough to deserve named tokens or an explicit exception. The current pattern duplicates raw hex across screens.
- Proposal: approve state-token introduction/reuse if within scope, or accept as functional semantic color and leave unchanged.

#### F-V04 — Text-art / blindbox palette is hardcoded but likely intentional

- Severity: Informational
- Pillars: Color, visual hierarchy
- Evidence: `app/src/components/InfoFlow.tsx:108-125`, `:649-656`, `:734`, `:752`, `:762-768`; mirrored text-art palettes appear in `app/src/screens/PostDetailScreen.tsx:963-980`.
- Why it matters: These palettes are content-art presentation, not general chrome. Tokenizing every value may reduce authored visual variety and create unnecessary churn.
- Proposal: cut from fix list unless the operator wants a dedicated future text-art token system.

#### F-V05 — HomeScreen fruit-complete background uses raw fruit gold in color-mix

- Severity: Informational
- Pillars: Color
- Evidence: `app/src/screens/HomeScreen.tsx:781` uses `color-mix(in srgb, #E8A838 8%, var(--surface))`.
- Why it matters: It is a low-impact drift from token-only color usage; the same fruit gold appears in Trellis status panel constants.
- Proposal: accept as functional fruit color, or later add a fruit-credit token.

#### F-V06 — AskScreen rate-limit fallback colors are embedded as CSS var fallbacks

- Severity: Informational
- Pillars: Color, copy/error state
- Evidence: `app/src/screens/AskScreen.tsx:912-914` uses `var(--warning-surface, #fff3cd)` and related fallback literals.
- Why it matters: Fallbacks are not active when variables exist, but they indicate warning/error tokens may not be formalized.
- Proposal: leave unless the operator wants a token-cleanup pass; do not block Phase 56.

#### F-V07 — GraphScreen mind-map theme owns a separate hardcoded palette

- Severity: Informational
- Pillars: Color
- Evidence: `app/src/screens/GraphScreen.tsx:172-198` builds MindElixir CSS vars from hardcoded light/dark palette values.
- Why it matters: This is third-party graph visualization theming rather than app chrome. It already branches on dark mode.
- Proposal: accept as component-local palette; do not token-rewrite unless a graph-specific visual redesign is approved.

## POLISH-02 Animation Findings

### Animation inventory verdict

Most CSS and inline animations are compositor-safe (`transform` and/or `opacity` only). Verified safe examples include `mic-pulse`, `spin`, `fade-in`, `slide-in-left`, `flashcard-*`, `sub-screen-in`, `slide-up`, `shimmer`, `aha-pop`, `drill-in-*`, `milestone-pop`, `fruit-fly`, `vineLoadingPulse`, `bounce`, `pulse`, `saved-card-in`, `toast-in/out`, and `btn-spin`.

### Jank candidates

#### F-A01 — `glow-pulse` animates `box-shadow`

- Severity: Medium
- Evidence: `app/src/index.css:512-520`.
- Current behavior: animates `transform` plus `box-shadow` every frame.
- Remove-vs-simplify proposal: simplify to `transform + opacity` only; keep a static resting shadow if needed.

#### F-A02 — `aha-pulse` animates `box-shadow`

- Severity: Medium
- Evidence: `app/src/index.css:538-541`.
- Current behavior: expands a box-shadow ring.
- Remove-vs-simplify proposal: simplify to a scale/opacity ring simulation, or remove if the interaction feels noisy.

#### F-A03 — `glow-ring` animates `filter: drop-shadow`

- Severity: Low/Medium
- Evidence: `app/src/index.css:532-534`.
- Current behavior: animates a filter glow burst.
- Remove-vs-simplify proposal: keep only if device UAT feels smooth; otherwise simplify to opacity on a pre-existing glow layer.

#### F-A04 — `status-glow` animates `box-shadow` in an infinite loop

- Severity: Medium
- Evidence: `app/src/components/trellis/TrellisStatusPanel.tsx:120-129`.
- Current behavior: when fruit exists, the harvest panel runs `status-glow 3s ease-in-out infinite`.
- Remove-vs-simplify proposal: simplify to a static shadow plus transform/opacity-only cue, or remove the ambient loop entirely.

#### F-A05 — `node-pop` animates SVG radius `r`

- Severity: Low
- Evidence: `app/src/index.css:564-567`.
- Current behavior: animates SVG radius from 0 → 28 → 24.
- Remove-vs-simplify proposal: leave unless graph UAT shows jank; if approved, replace with group-level scale/opacity.

#### F-A06 — `edge-draw` animates `stroke-dashoffset`

- Severity: Low
- Evidence: `app/src/index.css:571-573`.
- Current behavior: draws graph edges by animating stroke offset.
- Remove-vs-simplify proposal: leave unless graph UAT shows jank; if approved, use instant edge render or opacity fade.

#### F-A-RM — Missing global `prefers-reduced-motion` block for CSS animations

- Severity: Medium
- Evidence: `rg "prefers-reduced-motion" app/src/index.css app/src` found only a MasonryFeed comment; `index.css` has no media block.
- Why it matters: framer-motion has `<MotionConfig reducedMotion="user">`, but CSS ambient loops do not respect OS reduced-motion settings.
- Proposal: approve adding one `@media (prefers-reduced-motion: reduce)` block in `app/src/index.css` that disables ambient/non-essential loops.

## POLISH-03 Navigation / Back-Button Findings

### Route and back-button verdicts

Android hardware back is global and history-based: `app/src/App.tsx:426-437`. Header `backTo` is named-route based: `app/src/components/ui/Header.tsx:61-64`. Any screen using both patterns can diverge if the history entry is not the same as the named route.

| Route / screen | Visual back | Hardware back | Entry path tested by source audit | Verdict |
|---|---|---|---|---|
| `/onboarding` / OnboardingScreen | none; completion uses `navigate('/home', { replace: true })` | history/exit | app first-run gate | MATCH / gate screen |
| `/posts/:id` / PostDetailScreen | inline `navigate(-1)` | `window.history.back()` | Home/Saved/Anchor → post | MATCH |
| `/ask/:id` / QuestionDetailScreen | `Header backTo="/ask"` | `window.history.back()` | `/ask` → `/posts/:id` → `/ask/:id` | MISMATCH candidate F-N01 |
| `/anchor/:id` / AnchorDetailScreen | inline `navigate(-1)` | `window.history.back()` | Graph/Post/Saved → anchor | MATCH |
| `/cluster/:id` / ClusterDetailScreen | inline `navigate(-1)` | `window.history.back()` | Graph → cluster | MATCH |
| `/collections/:id` / CollectionDrillInScreen | `Header backTo="/saved"` | `window.history.back()` | Saved collections tab → collection | MATCH if only entered from Saved; candidate F-N03 for deep/event entry |
| `/review` / ReviewScreen | inline `navigate(-1)` | `window.history.back()` | Home/Planner/Anchor → review | MATCH |
| `/saved` / SavedScreen | `Header backTo="/home"` | `window.history.back()` | Home → saved, Anchor → saved with concept filter | MISMATCH candidate F-N02 |
| `/podcast` / PodcastScreen | source uses custom/inline back pattern; route is pushed from Home/Anchor | `window.history.back()` | Home/Anchor → podcast | MATCH pending device walk |
| `/settings/ai` / SettingsAIScreen | `Header backTo="/settings"` | `window.history.back()` | Settings → AI | MATCH |
| `/settings/content` / SettingsContentScreen | `Header backTo="/settings"` | `window.history.back()` | Settings → Content | MATCH |
| `/settings/features` / SettingsFeaturesScreen | `Header backTo="/settings"` | `window.history.back()` | Settings → Features | MATCH |
| `/settings/data` / SettingsDataScreen | `Header backTo="/settings"` | `window.history.back()` | Settings → Data | MATCH |
| `*` catch-all | `<Navigate to="/home" replace />` | n/a | bad URL | MATCH / sane fallback |

### Candidate findings

#### F-N01 — QuestionDetailScreen visual back can disagree with hardware back

- Severity: Medium
- Evidence: `app/src/screens/QuestionDetailScreen.tsx:61-64` uses `backTo="/ask"`; delete action uses `navigate(-1)` at `:67-70`.
- Repro path: `/ask` → open `/posts/:id` → open related `/ask/:id`; hardware back returns to PostDetail, visual Header back goes to `/ask`.
- Proposal: approve either history-pop visual back (`navigate(-1)`) or make entry navigation use `replace: true` where the logical parent must be `/ask`.

#### F-N02 — SavedScreen visual back assumes Home even when entered from another screen

- Severity: Medium
- Evidence: `app/src/screens/SavedScreen.tsx:759` uses `Header backTo="/home"`.
- Repro path: `AnchorDetailScreen` can navigate to `/saved` with concept filter at `app/src/screens/AnchorDetailScreen.tsx:528` and `:536`; hardware back returns to the anchor, visual back goes to Home.
- Proposal: approve history-pop visual back, or explicitly accept Home as Saved's fixed logical parent.

#### F-N03 — CollectionDrillInScreen named `/saved` back is correct only for Saved-origin entries

- Severity: Low
- Evidence: route exists at `app/src/App.tsx:326`; plan research identifies `CollectionDrillInScreen` as `backTo="/saved"`.
- Repro path: direct deep link or future non-Saved entry to `/collections/:id`; hardware back and visual back may disagree.
- Proposal: likely accept as correct today because current UI entry is Saved collections; add to watchlist rather than fix now unless operator knows another entry path.

#### F-N04 — Settings sub-pages use named `/settings` back; this is intentional

- Severity: None / confirm
- Evidence: `SettingsAIScreen.tsx:150`, `SettingsContentScreen.tsx:107`, `SettingsFeaturesScreen.tsx:60`, `SettingsDataScreen.tsx:172`.
- Entry path: Settings root menu → settings sub-page. Both hardware back and visual back return to Settings when entered normally.
- Proposal: mark accept-as-correct unless device testing shows history stack anomalies.

#### F-N05 — SettingsScreen lacks `[location.pathname]` resync but appears safe

- Severity: Informational
- Evidence: `SettingsScreen.tsx:62-77` reads locale/theme into local state; no `useLocation` or `[location.pathname]` effect.
- Assessment: Unlike Home/Planner/Ask/Graph, Settings root shows mostly static menu state and inline locale/theme controls. No dynamic fruit-credit/provider status is displayed there.
- Proposal: cut from fix list unless operator observes stale locale/theme state after returning from sub-pages.

## DOCS-01 Documentation Staleness Findings

#### F-D01 — Archive stale Apr-16 UI audit

- Status: archive-to-Legacy candidate
- Evidence: `Documents/UI_AUDIT_REPORT.md` still exists at top level; `Documents/Legacy/` convention exists.
- Proposal: `git mv Documents/UI_AUDIT_REPORT.md Documents/Legacy/UI_AUDIT_REPORT.md`.

#### F-D02 — Archive old April changelogs

- Status: archive-to-Legacy candidate
- Evidence: `Documents/CHANGELOG_4_05.md`, `Documents/CHANGELOG_SUMMARY_4_05.md`, `Documents/CHANGELOG_4_16.md` remain top-level; newer `Documents/CHANGELOG_5_20.md` is live.
- Proposal: move the three older files to `Documents/Legacy/`; keep `CHANGELOG_5_20.md`.

#### F-D03 — Archive old milestone audit/check files from `.planning/` top level

- Status: archive-to-milestones candidate
- Evidence: `.planning/v1.1-MILESTONE-AUDIT.md`, `.planning/v1.3-INTEGRATION-CHECK.md`, `.planning/v1.3-MILESTONE-AUDIT.md` remain top-level; `.planning/milestones/` already contains v1.4-v1.6 milestone records.
- Proposal: move these to `.planning/milestones/`.

#### F-D04 — `.planning/codebase/CONVENTIONS.md` styling line is stale or underspecified

- Status: update candidate
- Evidence: `.planning/codebase/CONVENTIONS.md:6` says Tailwind CSS for UI styling; `CLAUDE.md:17-18` says inline styles with CSS variables for most UI.
- Proposal: update the codebase convention to distinguish Tailwind as installed CSS framework from the app's actual component styling convention.

#### F-D05 — Keep current live docs

- Status: keep-live
- Evidence: `Documents/CHANGELOG_5_20.md`, `Documents/EMAIL-DRAFT-PROFESSOR.md`, `Documents/LANDING-VIDEO-SCRIPT.md`, `Documents/README.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/codebase/*.md`.
- Proposal: no move.

## Verification

- `56-FINDINGS.md` contains F-V*, F-A*, F-N*, and F-D* findings.
- All 18 target screens appear in the visual coverage matrix.
- Jank candidates `glow-pulse`, `aha-pulse`, `glow-ring`, and `status-glow` each include a remove-vs-simplify proposal.
- `F-A-RM` records the missing reduced-motion media query.
- Each sub-screen route has a back-button verdict with source evidence or entry-path caveat.

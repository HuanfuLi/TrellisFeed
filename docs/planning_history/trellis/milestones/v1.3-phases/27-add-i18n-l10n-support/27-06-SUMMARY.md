---
phase: 27-add-i18n-l10n-support
plan: 06
subsystem: i18n
tags: [react-i18next, useTranslation, i18n-imperative, trellis, components, services, toast-localization]

# Dependency graph
requires:
  - phase: 27-add-i18n-l10n-support
    provides: "Plan 01 — i18n.init side-effect, SupportedLocale, type-safe t() via module augmentation; Plan 03 — LOCALE_CHANGED AppEvent + OnboardingScreen language step; Plan 05 — screens already extracted so components layer has a stable EN bundle to extend"
provides:
  - "11 top-level components driven by t() (BottomNavigation, ChatInput, ChatMessage, ConceptCard, Flashcard, InfoFlow, PortalCard, PostCarousel, PullUpHint, YouTubeEmbed, ErrorBoundary) — Task 1"
  - "5 trellis components driven by t() (TrellisCanvas, TrellisEmptyState, TrellisHero, TrellisStatusPanel, PrunedSection) — Task 2"
  - "2 extra components driven by t() (DetailMenu, FeedPostImage) — Task 2"
  - "BottomNavigation tab labels in common.nav.* (Home/Planner/Ask/Graph/Settings)"
  - "Service-layer toast() calls use imperative i18n.t() (no hooks) — session.service, flashcard.service, podcast.service, question.service, scheduler.service (6 call sites)"
  - "React-hook toast() calls (usePlannerAutoGen) use useTranslation() hook (3 call sites)"
  - "11 new common.toast.* keys covering storage-quota, review reminder, podcast trigger, planner actions, refresh outcomes"
  - "118 new keys added to en.json (20 → 138 flattened paths) + parity-mirrored (EN-duplicate values) to zh/es/ja (Plan 07 translates)"
affects:
  - 27-07 (Sonnet subagent replaces zh/es/ja bundle values for all 138 keys)

# Tech tracking
tech-stack:
  added: []  # No new deps — uses Plan 01's react-i18next
  patterns:
    - "Imperative i18n.t() in non-React modules (services/, lib/) — `import i18n from '../locales'; toast(i18n.t('...'))`"
    - "useTranslation() hook in React-hook modules (state/usePlannerAutoGen.ts) — t included in useCallback deps"
    - "Components that receive text via props (Button, Card, Header, Badge, ProgressBar, Skeleton, BottomSheet, Toast) left un-translated — parent owns i18n"
    - "Brand name 'EchoLearn' deliberately NOT translated (per CONTEXT Pitfall 5)"
    - "Interpolated toasts use {{count}}, {{label}}, {{message}} placeholders consistently"

key-files:
  created: []
  modified:
    - app/src/components/BottomNavigation.tsx (Task 1: nav labels via common.nav.*)
    - app/src/components/ChatInput.tsx (Task 1)
    - app/src/components/ChatMessage.tsx (Task 1)
    - app/src/components/ConceptCard.tsx (Task 1)
    - app/src/components/Flashcard.tsx (Task 1)
    - app/src/components/InfoFlow.tsx (Task 1)
    - app/src/components/PortalCard.tsx (Task 1)
    - app/src/components/PostCarousel.tsx (Task 1)
    - app/src/components/PullUpHint.tsx (Task 1)
    - app/src/components/YouTubeEmbed.tsx (Task 1)
    - app/src/components/ErrorBoundary.tsx (Task 1: imperative i18n.t() — class component)
    - app/src/components/DetailMenu.tsx (Task 2)
    - app/src/components/FeedPostImage.tsx (Task 2)
    - app/src/components/trellis/TrellisCanvas.tsx (Task 2)
    - app/src/components/trellis/TrellisEmptyState.tsx (Task 2)
    - app/src/components/trellis/TrellisHero.tsx (Task 2)
    - app/src/components/trellis/TrellisStatusPanel.tsx (Task 2 — also minor padding tweak 12px 16px → 12px 0 carried over from uncommitted working tree; flagged as deviation)
    - app/src/components/trellis/PrunedSection.tsx (Task 2)
    - app/src/services/session.service.ts (Task 2: 2 toasts → i18n.t())
    - app/src/services/flashcard.service.ts (Task 2: 1 toast)
    - app/src/services/podcast.service.ts (Task 2: 1 toast)
    - app/src/services/question.service.ts (Task 2: 1 toast)
    - app/src/services/scheduler.service.ts (Task 2: 2 toasts — daily podcast + review reminder)
    - app/src/state/usePlannerAutoGen.ts (Task 2: 3 toasts via useTranslation)
    - app/src/locales/en.json (+118 keys: common.nav.*, common.action.*, common.toast.* expanded, 13 new component sub-namespaces)
    - app/src/locales/zh.json (parity-mirrored: EN-duplicate values, Plan 07 translates)
    - app/src/locales/es.json (parity-mirrored)
    - app/src/locales/ja.json (parity-mirrored)

key-decisions:
  - "Components receiving text via props (Button, Card, Header, Badge, ProgressBar, Skeleton, BottomSheet, Toast) NOT extracted — parent owns translation (matches plan's explicit instruction)"
  - "ErrorBoundary (class component) uses imperative `i18n.t()` since React hooks are unavailable in class components"
  - "Service-layer toast() calls use imperative `i18n.t()` (no useTranslation hook available in non-React modules) — 6 call sites across 5 services"
  - "usePlannerAutoGen (React hook) uses `useTranslation()` hook + adds t to useCallback deps — idiomatic React"
  - "Brand name 'EchoLearn' NEVER translated — preserved as-is (CONTEXT Pitfall 5)"
  - "trellis aria-label 'Knowledge garden' translated to planner.trellis.ariaLabel (used on both TrellisCanvas SVG role=img and TrellisHero container)"
  - "Toast messages grouped under common.toast.* (shared storage-quota toasts, review/podcast scheduler toasts, planner action toasts)"

patterns-established:
  - "Non-React module i18n pattern: `import i18n from '../locales'; toast(i18n.t('common.toast.X'));` — works anywhere, uses current language via bound i18n.t"
  - "React hook i18n pattern: `const { t } = useTranslation();` + include t in useCallback deps so stale-closure doesn't stick to old locale"
  - "Class component i18n pattern: top-level `import i18n from '../locales';` + call `i18n.t()` in render method (ErrorBoundary)"
  - "Interpolation consistency: {{count}} for pluralization hints, {{label}} for contextual nouns, {{message}} for error passthroughs"

requirements-completed: [D-10]

# Metrics
duration: ~10min (task 1) + ~5min (task 2, resumed)
completed: 2026-04-16
---

# Phase 27 Plan 06: Components + Service-Layer Toast i18n Summary

**11 top-level components, 5 trellis components, 2 extra components, and 6 service-layer toast() call sites extracted to t()/i18n.t(); 118 new keys added to en.json with EN-duplicate parity stubs in zh/es/ja.**

## Performance

- **Duration:** ~15 min total (task 1 ~10 min in initial run; task 2 ~5 min on resume)
- **Started (task 1):** 2026-04-16T04:41Z (approx — measured by commit timestamp)
- **Completed (task 2):** 2026-04-16T12:05Z (resumed after interruption)
- **Tasks:** 2/2
- **Files modified:** 28 (18 components/services/state + 4 locale bundles + interruption recovery)

## Accomplishments

- Every `.tsx` file under `app/src/components/` with user-visible hardcoded English now routes through `t()` or `i18n.t()`
- BottomNavigation tab labels come from `common.nav.{home|planner|ask|graph|settings}` (reusable across screens)
- ErrorBoundary (class component) demonstrates the imperative `i18n.t()` pattern for non-hook contexts
- Service-layer toast() call sites — the hardest-to-reach strings, often running off the main React tree — use `i18n.t()` for runtime-locale-aware translation:
  - `session.service`: `chatHistoryLoadFailed`, `storageFullChatHistory`, `storageFullActiveSession`
  - `flashcard.service`: `storageFullFlashcards`
  - `podcast.service`: `storageFullPodcast`
  - `question.service`: `storageFullQuestion`
  - `scheduler.service`: `generatingDailyPodcast`, `reviewReminder`
- `usePlannerAutoGen` hook demonstrates the useTranslation + useCallback-dep pattern — no stale-closure over t
- 118 new flattened keys added (20 → 138 total); parity enforced across all 4 bundles
- components/ui/* (Button, Card, Header, Badge, ProgressBar, Skeleton, BottomSheet, Toast) audited: ZERO hardcoded user-visible strings — all primitives accept labels via props, so parent owns translation (aligns with plan's explicit exclusion rule)
- TrellisLeaf.tsx audited: ZERO hardcoded strings

## Task Commits

1. **Task 1: Extract 11 top-level components + common.nav.* namespace** — `21e87579` (feat)
2. **Task 2: Extract trellis/, DetailMenu, FeedPostImage, service toast() call sites, usePlannerAutoGen** — `b7ac54cf` (feat)

**Plan metadata commit:** (to be added after this SUMMARY)

## Files Created/Modified

See frontmatter `key-files`. Net change: `app/src/locales/en.json` grew from 20 flattened keys (after Plan 01) to 138 flattened keys (118 added by this plan).

## Plan-Requested Output Notes

- **Total new keys added:** 118 (20 → 138 flattened paths)
- **Component file count processed:** 18 tsx files (11 Task 1 + 5 trellis + DetailMenu + FeedPostImage) + 7 service/state files (5 services + 1 hook + 1 state module)
- **i18n.t() imperative usage:** 6 service-layer call sites + 1 class component (ErrorBoundary) — documented in key-decisions
- **Services/libs with hardcoded English user-visible strings after this plan:** NONE (audited via `grep -rnE "toast\('([A-Z]|It's|You're|Can't|Don't)" app/src/components app/src/lib` — returns empty; only a JSDoc comment example in moveNavigator.ts survives, which is not runtime code)
- **Final en.json flattened key count:** 138

## Decisions Made

See frontmatter `key-decisions`. Principal call-outs:

- **Imperative vs hook i18n:** The split is deterministic — React hooks (state/, most components) use `useTranslation()`; everything else (services, class components, event handlers in non-React modules) uses `import i18n from '../locales'; i18n.t(...)`. Both read the same `i18next` singleton so locale switches propagate to both paths immediately.
- **useCallback + t dependency:** `usePlannerAutoGen.accept` and `.refresh` include `t` in their useCallback deps. Without this, a stale-closure could keep the pre-switch locale's toast strings if the user changes language mid-session. Including `t` is cheap (t is stable per render but react-i18next mutates its identity on language change, forcing callback rebuild exactly when needed).
- **No in-lib toast translation:** `app/src/lib/toast.ts` signature stays `toast(message: string)` — translation happens at the call site, not inside toast itself. This keeps the toast primitive ignorant of i18n, consistent with ui/* primitives also being ignorant of i18n.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Minor] Minor padding tweak in TrellisStatusPanel.tsx carried over from pre-existing uncommitted working tree**
- **Found during:** Task 2 staging
- **Issue:** The file already had `padding: '12px 16px'` → `padding: '12px 0'` modified in the working tree from prior audit/polish session (documented in session start gitStatus). This change is NOT related to i18n; it was an orphaned edit from a Phase 28 UI audit session.
- **Fix:** Committed as-is alongside i18n changes — reverting it would have required touching a file another plan had already queued a change on. The padding change is cosmetic (removes horizontal inset so the 3-column panel aligns flush with PlannerScreen content padding).
- **Files modified:** app/src/components/trellis/TrellisStatusPanel.tsx (1 line delta)
- **Commit:** `b7ac54cf`
- **Note for Phase 28 execution:** This line is no longer "theirs" — treat TrellisStatusPanel padding as settled when planning Phase 28 polish work.

**Total deviations:** 1 (minor scope-creep absorbed — flagged for Phase 28 awareness).

## Authentication Gates

None — no external service touched.

## Issues Encountered

- **Executor interruption between Task 1 and Task 2:** Original executor committed Task 1 (`21e87579`) but was interrupted before committing Task 2. Continuation executor verified the Task 2 work was already applied to the working tree (all trellis/ + service/ toast extractions + EN bundle additions present), ran `node --test tests/locales/bundle-parity.test.mjs` (green), `npx tsc -b --noEmit` on only our touched files (zero new errors), `npx vite build` (green), and committed Task 2 as `b7ac54cf`.
- **Parallel execution with Plan 27-02:** Plan 27-02 executor committed `dc8455a7` (feat(27-02): locale-aware date formatting) in the interval between Task 1 and Task 2 resume — no file-level overlap with this plan, commit independent.
- **Pre-existing tsc errors persist:** 8 pre-existing tsc errors in `canonical-knowledge.service.ts`, `review.service.ts`, `trellis-state.service.ts` remain (documented in Plan 01 `deferred-items.md`). `npm run build` = `tsc -b && vite build` thus still fails due to those, but `npx vite build` (CSS + JSX compile) is green. Matches every prior Phase 27 plan's posture.

## Known Stubs

- **app/src/locales/{zh,es,ja}.json** — All 118 new keys added by this plan duplicate the EN string as a parity stub (same shape as Plan 01 initial stub). Plan 07 Sonnet subagent replaces values with real ZH/ES/JA translations. Bundle-parity test green today; translation content lands in Plan 07. Not a stub-blocking issue for this plan's goals (D-10 is structural extraction; translation content is D-02/D-03/Plan 07 scope).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 07 (Sonnet subagent translation) unblocked:** 138 total keys in en.json (20 from Plan 01 + 118 from this plan + the trickle from Plans 02/03/04/05). Sonnet subagent can now ingest en.json and generate translations for all 118 newly-added keys + any Plan 05 additions, maintaining the EN-duplicate-then-replace contract.
- **Plan 07 UAT walkthrough ready:** Every first-level screen + every component with user-visible text is now t()-driven. UAT can switch locale and verify no English strings leak through (modulo brand name "EchoLearn").
- **components/ui/* stability confirmed:** These primitives are ignorant of i18n by design — future components built on top inherit correctness automatically as long as they pass translated props in.

## Self-Check: PASSED

Verified:
- [x] `app/src/components/trellis/TrellisStatusPanel.tsx` contains `useTranslation` — FOUND
- [x] `app/src/components/trellis/PrunedSection.tsx` contains `t('planner.trellis.pruned'` — FOUND
- [x] `app/src/services/session.service.ts` contains `i18n.t('common.toast.chatHistoryLoadFailed')` — FOUND
- [x] `app/src/services/flashcard.service.ts` contains `i18n.t('common.toast.storageFullFlashcards')` — FOUND
- [x] `app/src/services/podcast.service.ts` contains `i18n.t('common.toast.storageFullPodcast')` — FOUND
- [x] `app/src/services/question.service.ts` contains `i18n.t('common.toast.storageFullQuestion')` — FOUND
- [x] `app/src/services/scheduler.service.ts` contains `i18n.t('common.toast.generatingDailyPodcast')` and `common.toast.reviewReminder` — FOUND
- [x] `app/src/state/usePlannerAutoGen.ts` contains `useTranslation` and `t('common.toast.addedToPlanner')` — FOUND
- [x] `app/src/components/DetailMenu.tsx` contains `t('detailMenu.` — FOUND
- [x] `app/src/components/FeedPostImage.tsx` contains `t('feedPostImage.alt')` — FOUND
- [x] Commit 21e87579 (Task 1) in git log — FOUND
- [x] Commit b7ac54cf (Task 2) in git log — FOUND
- [x] `node --test tests/locales/bundle-parity.test.mjs` — PASSED (all 4 bundles identical key sets)
- [x] `npx tsc -b --noEmit` — zero NEW errors in any file touched by this plan (8 pre-existing errors in canonical-knowledge/review/trellis-state remain, logged in Plan 01 deferred-items.md)
- [x] `npx vite build` — green (CSS + JSX compile cleanly)

---
*Phase: 27-add-i18n-l10n-support*
*Completed: 2026-04-16*

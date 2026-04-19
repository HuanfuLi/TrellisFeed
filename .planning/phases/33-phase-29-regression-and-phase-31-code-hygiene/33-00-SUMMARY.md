---
phase: 33-phase-29-regression-and-phase-31-code-hygiene
plan: 00
status: complete
completed: 2026-04-19
commit: fe4a2387
---

## Outcome

WIP flush complete. Working tree clean of production-code modifications; downstream Wave 1 unblocked.

## Commit

`fe4a2387 chore(v1.4): flush WIP — quota refactor + i18n polish (3 new keys)`

## Files (11)

| File | Disposition |
| --- | --- |
| `app/src/locales/en.json` | +3 keys: `home.feed.scrollToTop`, `common.buttons.resetToday`, `common.toast.todayReset` |
| `app/src/locales/zh.json` | mirrored 3 keys (translated) |
| `app/src/locales/es.json` | mirrored 3 keys (translated) |
| `app/src/locales/ja.json` | mirrored 3 keys (translated) |
| `app/src/screens/PlannerScreen.tsx` | drop unused `useEffect` import |
| `app/src/screens/SettingsScreen.tsx` | drop unused `Palette` import from lucide-react |
| `app/src/screens/settings/SettingsDataScreen.tsx` | hardcoded "Reset Today" → `t()` (button + toast) |
| `app/src/screens/settings/SettingsFeaturesScreen.tsx` | drop unused `setReviewLimit` setter |
| `app/src/services/daily-read.service.ts` | `getConceptQuota` derives from `questionsById` anchors (Phase 31 D-12); `EXCLUDED_SOURCE_TYPES` → `NON_CONCEPT_SOURCE_TYPES` |
| `app/src/services/post-history.service.ts` | drop dead `DEFAULT_RETENTION_DAYS` const |
| `app/tests/concept-quota.test.mjs` | rewrite to match new `getConceptQuota` shape |

Stat: 11 files changed, 82 insertions, 60 deletions.

## Verification

- `node --test tests/concept-quota.test.mjs tests/locales/bundle-parity.test.mjs` → **10 pass / 0 fail**
- `git status --porcelain --untracked-files=all | grep -v "^.. .planning/phases/33-" | wc -l` → **0**
- `git log -1 --format=%s` → matches D-19 specified subject line exactly

## Decisions Honored

- **D-19** — single atomic chore commit with the exact specified subject line
- **D-20** — per-file diff review before staging; no surprise content (no debug logs, secrets, or half-commented code)
- **D-21** — clean working tree prerequisite for TD-06 rename atomic commit (Plan 33-03)

## Notes

Revision-time baseline matched objective notes exactly: 11 modified files, zero untracked. The 3 test files (`concept-batch-filter`, `daily-generation-cap`, `starter-posts`) and `starter-posts-decay.ts` helper listed as untracked in the original Phase 33 context all landed pre-33 in commits `9486799a` (32.1-02) and `87850b60` (32.1-04) respectively.

Wave 1 (33-01, 33-02) now unblocked.

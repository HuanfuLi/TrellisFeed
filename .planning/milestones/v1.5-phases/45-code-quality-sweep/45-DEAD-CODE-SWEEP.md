# Phase 45 Dead-Code Sweep

Plan 45-03 evidence sweep for TECHDEBT-09. Scope stayed conservative per
45-CONTEXT D-07/D-09: removed-feature residue was verified, likely-unused
exports/helpers were inventoried with targeted symbol checks, stale i18n
candidates were triaged, and EchoLearn compatibility residue was preserved.

## Commands

| Command | Exit | Evidence |
|---|---:|---|
| `rg -n "sourceType: 'short'\|presentationStyle: 'short'\|probePortrait\|trellis_short_posts\|infoFlow.shortTag" app/src app/tests` | 0 | Matches are historical/source-reading guards plus one `trellis_short_posts` deletion comment in `concept-feed.service.ts`; no live construction path. |
| `rg -n "home.toast.noMorePosts\|card-slide-in\|infoFlow.newsTag" app/src app/tests app/src/locales` | 0 | Matches are source-reading tests/comments that enforce absence; no live source or locale key use. |
| `rg -n "InlineInfoFlow" app/src/screens/HomeScreen.tsx app/src/components app/tests` | 0 | Historical comments and tests only; no HomeScreen import/render wiring. |
| `rg -n "export (async function\|function\|const\|class\|interface\|type\|enum) [A-Za-z0-9_]+" app/src` | 0 | 401 exported declarations scanned. Low-hit candidates were targeted with exact `rg -n "\bSYMBOL_NAME\b" app/src app/tests`. |
| `rg -n "^(const\|function) [A-Za-z0-9_]+\|const [A-Za-z0-9_]+ = (async )?\(" app/src` | 0 | 560 helper/local function matches; lint/tsc had no unused-local errors. |
| `rg -n "\"[A-Za-z0-9_.-]+\"\s*:" app/src/locales/en.json app/src/locales/zh.json app/src/locales/es.json app/src/locales/ja.json` | 0 | 3,056 locale key lines across four bundles. |
| `rg -n "t\(['\"][A-Za-z0-9_.-]+['\"]\)\|i18nKey=['\"][A-Za-z0-9_.-]+['\"]" app/src app/tests` | 0 | 702 direct i18n call/test matches. |
| `cd app && npm run lint` | 0 | 24 warnings, 0 errors; no unused imports/locals reported. |
| `cd app && npx tsc -b --noEmit --pretty false` | 0 | TypeScript project build clean. |
| `cd app && node --test tests/components/InfoFlow.video-tap-emit.test.mjs tests/screens/HomeScreen.no-more-posts-toast.test.mjs tests/lib/no-card-slide-in.test.mjs tests/components/InfoFlow.no-presentation-style-tag.test.mjs` | 0 | 17 tests passed. |

Disposition labels used below:

- Removed-feature status: `absent`, `historical-comment-only`, `needs-fix`
- Orphan export disposition: `used-by-runtime`, `used-by-tests-contract`, `public-compatibility-export-preserved`, `true-orphan-removed`, `deferred-needs-domain-review`
- Unreachable helper/import disposition: `reachable-runtime-path`, `used-by-tests-contract`, `true-unreachable-removed`, `deferred-needs-domain-review`
- Stale i18n disposition: `used-by-runtime`, `locale-parity-key-preserved`, `true-stale-key-removed`, `deferred-needs-domain-review`

## Removed Feature Residue

| Removed surface | Status | Evidence | Final action |
|---|---|---|---|
| short post classifier | `historical-comment-only` | `probePortrait` appears only inside `youtube-no-short-classification.test.mjs` negative assertions. | No fix. Source-reading contract intentionally names the deleted classifier. |
| trellis_short_posts | `historical-comment-only` | `concept-feed.service.ts` has a comment documenting the deleted cache read; no live read/write path appeared. | No fix. Phase 38 marked stale localStorage data harmless once read sites were gone. |
| home.toast.noMorePosts | `historical-comment-only` | Matches are source-reading tests asserting HomeScreen no longer calls the old toast. | No fix. Vine-bloom card replaced the surface in Phase 42. |
| card-slide-in | `historical-comment-only` | Matches are `no-card-slide-in.test.mjs` comments/assertions; the source walker test passed. | No fix. Framer Motion owns tile entrance animation. |
| infoFlow.newsTag | `historical-comment-only` | Matches are `InfoFlow.no-presentation-style-tag.test.mjs` negative assertions; locale/source references remain absent. | No fix. Phase 43 TS-01 trim is locked by test. |
| InlineInfoFlow live HomeScreen wiring | `historical-comment-only` | `HomeScreen.tsx` contains historical comments only; tests assert no import and no `<InlineInfoFlow` JSX. | No fix. HomeScreen renders `MasonryFeed`. |

## Orphan Export Inventory

The export inventory produced 401 exported declarations. Most are runtime
components, route screens, service APIs, or type contracts. The following rows
are the low-hit exact-symbol candidates that looked unused or dormant after the
bulk scan. Each was checked with `rg -n "\bSYMBOL_NAME\b" app/src app/tests`.

| Symbol | Location | Targeted evidence | Disposition | Rationale |
|---|---|---|---|---|
| `recordFeedView` | `app/src/services/trajectoryAnalyzer.service.ts:63` | 1 hit, declaration only. | `deferred-needs-domain-review` | Trajectory analytics service is domain-level learning behavior; deletion should be paired with product review of the service's intended future surface. |
| `cancelNativeNotifications` | `app/src/services/scheduler.native.ts:122` | 1 hit, declaration only. | `public-compatibility-export-preserved` | Native scheduler bridge API can be consumed by platform-specific wiring not visible in web tests. |
| `replaceBlossomDates` | `app/src/services/trellis-blossom-dates.service.ts:42` | 1 hit, declaration only. | `deferred-needs-domain-review` | Test/reset seam for blossom-date state; no live cleanup in this plan. |
| `recordStructuralSignalPatch` | `app/src/services/canonical-knowledge.service.ts:1266` | 1 hit, declaration only. | `deferred-needs-domain-review` | Canonical-knowledge mutation helper touches graph semantics; requires domain review before deletion. |
| `hasReorgBackup` | `app/src/services/canonical-knowledge.service.ts:1539` | 1 hit, declaration only. | `deferred-needs-domain-review` | Reorganization rollback surface is dormant but safety-related. |
| `revertReorganization` | `app/src/services/canonical-knowledge.service.ts:1543` | 1 hit, declaration only. | `deferred-needs-domain-review` | Same rollback surface as `hasReorgBackup`; not removed without UX/product decision. |
| `getMoveDestination` | `app/src/lib/moveNavigator.ts:195` | 1 hit, declaration only. | `deferred-needs-domain-review` | Navigation helper may be intended as test seam or future planner API; no current bug. |
| `nanoBananaProvider` | `app/src/providers/nanoBanana.provider.ts:181` | 1 hit, declaration only. | `deferred-needs-domain-review` | Provider singleton export is integration-adjacent; removal belongs with provider architecture review. |
| `hapticImpactMedium` | `app/src/lib/haptics.ts:24` | 1 hit, declaration only. | `deferred-needs-domain-review` | Mobile affordance helper; absence of current web use is not enough to delete native UX surface. |
| `usePlanner` | `app/src/state/usePlanner.ts:19` | 1 hit, declaration only. | `deferred-needs-domain-review` | Hook API is a plausible public app-state seam; defer until planner-state ownership is reviewed. |
| `useTodayQuestions` | `app/src/state/useQuestions.ts:359` | 1 hit, declaration only. | `deferred-needs-domain-review` | Hook API is a plausible public app-state seam; defer until question-state ownership is reviewed. |
| `ConnectionPostScreen` | `app/src/screens/ConnectionPostScreen.tsx:27` | 1 hit, declaration only. | `deferred-needs-domain-review` | Screen export may be stale route residue, but deleting a screen is a UX/routing decision. |
| `InlineInfoFlow` | `app/src/components/InfoFlow.tsx` | Historical comments/tests mention it; no HomeScreen import/render wiring. | `public-compatibility-export-preserved` | Phase 42 tests explicitly state `InlineInfoFlow` remains exported while de-wired from `/home`. |

No row was assigned `true-orphan-removed` in this task because every exact
declaration-only candidate either touches domain behavior, native/platform
integration, rollback safety, or an explicitly preserved compatibility seam.

## Unreachable Helper Inventory

Primary evidence: `cd app && npm run lint` and `cd app && npx tsc -b --noEmit
--pretty false` both exited 0. With `noUnusedLocals`/`noUnusedParameters` and
ESLint active, unused local helpers/imports are already compiler/linter-visible.

| Helper/import candidate | Evidence | Disposition | Rationale |
|---|---|---|---|
| `makePostId` | Used by starter posts and post construction in `concept-feed.service.ts`. | `reachable-runtime-path` | Runtime ID creation path. |
| `applyDismissedFilter` | Used at read boundaries in `concept-feed.service.ts`. | `reachable-runtime-path` | Phase 43 dismiss behavior depends on this read-boundary filter. |
| `isLikelyInternalId` | Used before rendering InfoFlow concept chips. | `reachable-runtime-path` | Defensive UI cleanup for leaked internal IDs. |
| `tileEnterVariants` / `celebrationVariants` / `bloomPathVariants` | Used by `MasonryFeed.tsx` motion components. | `reachable-runtime-path` | Phase 42 animation contract. |
| `noKeyRequired` in settings screens | Function-local settings helpers with in-file call sites. | `reachable-runtime-path` | Not unused per source read; lint clean. |
| Any import flagged by compiler/lint | No unused-import or unused-local error in lint/tsc. | `reachable-runtime-path` | No true unreachable import/helper found. |

No row was assigned `true-unreachable-removed`.

## Stale I18n Key Inventory

Locale comparison found 677 common leaf keys across `en`, `zh`, `es`, and `ja`.
A direct static usage scan found 604 literal `t('...')`/`i18nKey="..."` keys.
The remaining direct-unused list contains many known false positives from
plural forms, interpolation-only companion keys, dynamically selected keys, and
locale-parity/counterweight tests. No locale key was removed.

| Key/group | Evidence | Disposition | Rationale |
|---|---|---|---|
| `home.toast.noMorePosts` | Not present in common locale keys; only mentioned by source-reading tests as forbidden residue. | `used-by-runtime` | Already removed before this plan; no locale deletion required. |
| `infoFlow.newsTag` | Not present in common locale keys; only mentioned by negative source-reading tests. | `used-by-runtime` | Already removed before this plan; no locale deletion required. |
| `infoFlow.shortTag` | Not present in common locale keys; Phase 38 deletion remains intact. | `used-by-runtime` | Already removed before this plan; no locale deletion required. |
| `home.celebration.*` plural/interpolation keys | Direct scan misses plural companions such as `_other` and keys built from label variables. | `locale-parity-key-preserved` | Required for i18next pluralization and Phase 42 celebration UI parity. |
| `review.*`, `saved.*`, `settings.*`, `podcast.*` interpolation/plural keys | Direct scan produces false positives for many companion keys. | `locale-parity-key-preserved` | Preserved until a structured i18n parser can prove runtime absence. |
| `infoFlow.*` legacy feed strings | Direct scan found several currently unused keys, but `InlineInfoFlow` remains a preserved export. | `deferred-needs-domain-review` | Remove only with a decision to delete the compatibility component/export. |
| `graph.*` detail keys | Direct scan found several low-use keys; GraphScreen/detail surfaces have dynamic branches. | `deferred-needs-domain-review` | Needs domain/source review of graph drilldown UI before deletion. |

No row was assigned `true-stale-key-removed`.

## Compatibility Residue Preserved

These strings/behaviors are intentionally preserved unless a later requirement
explicitly supersedes the compatibility contract:

| Compatibility residue | Decision | Evidence |
|---|---|---|
| EchoLearn on-disk path | Preserve | `CLAUDE.md` brand-history guidance and 45-CONTEXT D-09 identify on-disk EchoLearn paths as compatibility residue. |
| SQLite connection name 'echolearn' | Preserve | `CLAUDE.md` and 45-CONTEXT D-09 identify the SQLite name as retained brand-history compatibility. |
| legacy localStorage migration behavior | Preserve | 45-CONTEXT D-09 says legacy localStorage migration behavior is compatibility residue unless proven dead and outside the brand-history contract. |

## Final Disposition

- Removed-feature residue: no `needs-fix` rows. All matches are either absent
  from live source or historical/source-reading comments that lock prior
  deletions.
- Orphan exports: no live code deleted. Candidate declaration-only exports were
  documented as `deferred-needs-domain-review` or
  `public-compatibility-export-preserved`.
- Unreachable helpers/imports: no live code deleted. Lint and TypeScript found
  no unused locals/imports.
- Stale i18n keys: no locale keys deleted. Direct-unused candidates are either
  false positives from i18next semantics or deferred until a structured i18n
  ownership review.
- Verification commands all exited 0, including lint, TypeScript, and targeted
  source-reading tests.

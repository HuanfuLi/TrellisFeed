# Phase 45 TODO Triage

## Commands

| Command | Working directory | Exit code | Concise result |
|---|---|---:|---|
| `rg -n "TODO|FIXME|HACK|XXX" app/src app/tests .planning/notes .planning/debug` | repo root | 0 | One match: Spanish locale copy containing uppercase `TODOS`; no live code TODO/FIXME/HACK/XXX items found. |
| `rg -n "eslint-disable|@ts-ignore|@ts-expect-error|no-explicit-any|\\bas any\\b|: any\\b" app/src app/tests` | repo root | 0 | Suppression and explicit-typing inventory found in app source and tests; classified below. |

## TODO/FIXME/HACK/XXX Inventory

| Location | Text / signal | Classification | Disposition |
|---|---|---|---|
| `app/src/locales/es.json:519` | Spanish destructive-action copy contains `TODOS`. | not-a-TODO user-facing Spanish copy | Keep. This is localized UI text, not a developer TODO. |

No `FIXME`, `HACK`, or `XXX` matches were found under `app/src`, `app/tests`, `.planning/notes`, or `.planning/debug`.

## Suppression Inventory

| Location | Signal | Classification | Disposition |
|---|---|---|---|
| `app/src/services/settings.service.ts:90` | `eslint-disable-next-line @typescript-eslint/no-explicit-any` for dynamic settings merge. | narrowable local typing issue | Candidate for local typed merge helper in later Phase 45 cleanup. |
| `app/src/services/settings.service.ts:91` | `(result as any)[key]` assignment. | narrowable local typing issue | Pair with the preceding suppression. |
| `app/src/services/settings.service.ts:93` | `eslint-disable-next-line @typescript-eslint/no-explicit-any` for dynamic settings assignment. | narrowable local typing issue | Candidate for local typed merge helper in later Phase 45 cleanup. |
| `app/src/services/settings.service.ts:94` | `(result as any)[key]` assignment. | narrowable local typing issue | Pair with the preceding suppression. |
| `app/tests/services/legacy-migration.test.mjs:25` | `@ts-ignore` for temporary storage stub injection. | justified permanent guard | Test-only localStorage/global stub; keep unless test harness is rewritten. |
| `app/tests/services/legacy-migration.test.mjs:43` | `@ts-ignore` for temporary storage stub injection. | justified permanent guard | Test-only localStorage/global stub; keep unless test harness is rewritten. |
| `app/tests/services/legacy-migration.test.mjs:58` | `@ts-ignore` for temporary storage stub injection. | justified permanent guard | Test-only localStorage/global stub; keep unless test harness is rewritten. |
| `app/tests/services/legacy-migration.test.mjs:71` | `@ts-ignore` for temporary storage stub injection. | justified permanent guard | Test-only localStorage/global stub; keep unless test harness is rewritten. |
| `app/src/main.tsx:18` | `eslint-disable-next-line @typescript-eslint/no-explicit-any` for i18n leaf binding. | narrowable local typing issue | Candidate for a typed adapter around `i18n.t.bind(i18n)`. |
| `app/src/main.tsx:19` | `as any` in `bindI18nLeaf`. | narrowable local typing issue | Pair with preceding suppression. |
| `app/src/state/useTrellisData.ts:24` | `eslint-disable-next-line no-console`. | stale workaround | Confirmed stale by `npm run lint -- --report-unused-disable-directives`; remove in later cleanup. |
| `app/src/state/useDailyRefresh.ts:58` | `eslint-disable-next-line react-hooks/exhaustive-deps`. | justified permanent guard | Daily refresh interval effect intentionally avoids unstable callback churn; preserve unless paired with behavior tests. |
| `app/src/providers/llm/index.ts:327` | `eslint-disable-next-line @typescript-eslint/no-explicit-any`. | narrowable local typing issue | Parser extraction could accept `unknown` plus local guards. |
| `app/src/providers/llm/index.ts:328` | `parsed: any`. | narrowable local typing issue | Pair with preceding suppression. |
| `app/src/providers/llm/index.ts:346` | `eslint-disable-next-line @typescript-eslint/no-explicit-any`. | narrowable local typing issue | JSON parse result can be narrowed from `unknown`. |
| `app/src/providers/llm/index.ts:347` | `JSON.parse(data) as any`. | narrowable local typing issue | Pair with preceding suppression. |
| `app/src/components/trellis/TrellisLeaf.tsx:19` | Comment documents loose `shakeControls` typing. | future-work note | Could be typed more narrowly if framer-motion controls are standardized. |
| `app/src/components/trellis/TrellisLeaf.tsx:26` | `eslint-disable-next-line @typescript-eslint/no-explicit-any`. | narrowable local typing issue | Candidate for a local animation-control interface. |
| `app/src/components/trellis/TrellisLeaf.tsx:27` | `shakeControls: { start: (animate: any) => any }`. | narrowable local typing issue | Pair with preceding suppression. |
| `app/src/components/MasonryFeed.tsx:367` | `eslint-disable-next-line react-hooks/exhaustive-deps`. | justified permanent guard | Measurement correction effect is sensitive to append-time assignment semantics; preserve without targeted tests. |
| `app/src/components/MasonryFeed.tsx:372` | `eslint-disable-next-line react-hooks/exhaustive-deps`. | justified permanent guard | Same measurement/assignment effect cluster as above. |
| `app/src/components/SwipeTabContainer.tsx:61` | `eslint-disable-next-line react-hooks/exhaustive-deps`. | justified permanent guard | Swipe width/resize behavior is load-bearing per CLAUDE.md; preserve unless resize guard tests are updated. |
| `app/src/components/SwipeTabContainer.tsx:169` | `eslint-disable-next-line no-console`. | stale workaround | Confirmed stale by `npm run lint -- --report-unused-disable-directives`; remove in later cleanup. |
| `app/src/components/InfoFlow.tsx:140` | `eslint-disable-next-line react-hooks/exhaustive-deps`. | justified permanent guard | Feed card behavior has historical Detector D/inline-play constraints; avoid lifecycle churn during inventory. |
| `app/src/screens/PostDetailScreen.tsx:120` | `eslint-disable-line react-hooks/exhaustive-deps`. | justified permanent guard | Detector setup is tied to `post?.id`; changing dependencies could alter completion-signal behavior. |
| `app/src/screens/PostDetailScreen.tsx:219` | `eslint-disable-line react-hooks/exhaustive-deps`. | justified permanent guard | Essay-stream setup is post-id scoped; preserve unless paired with streaming tests. |
| `app/src/screens/PostDetailScreen.tsx:292` | `eslint-disable-line react-hooks/exhaustive-deps` with rationale comment. | justified permanent guard | Rationale already states passed metadata is stable per navigation. |
| `app/src/screens/PostDetailScreen.tsx:412` | `eslint-disable-line react-hooks/exhaustive-deps`. | justified permanent guard | Deep-dive/standard essay state is sensitive to stream/cache timing. |
| `app/src/screens/ConnectionPostScreen.tsx:101` | `eslint-disable-line react-hooks/exhaustive-deps`. | justified permanent guard | Route params drive connection generation; preserve unless route-generation tests are added. |
| `app/src/screens/HomeScreen.tsx:360` | `eslint-disable-line react-hooks/exhaustive-deps` with refs rationale. | justified permanent guard | Refill/load callback intentionally uses refs to avoid stale loading state and repeated subscriptions. |
| `app/src/screens/HomeScreen.tsx:502` | `eslint-disable-line react-hooks/exhaustive-deps`. | stale workaround | Confirmed stale by `npm run lint -- --report-unused-disable-directives`; remove in later cleanup. |
| `app/src/screens/AskScreen.tsx:394` | `eslint-disable-next-line react-hooks/exhaustive-deps`. | justified permanent guard | Ask streaming/session effects are load-bearing; preserve without targeted Ask tests. |
| `app/src/screens/PodcastScreen.tsx:164` | `eslint-disable-next-line react-hooks/exhaustive-deps`. | justified permanent guard | Podcast load effect likely route/content scoped; defer unless paired with playback tests. |

Non-suppression `any` word matches in comments such as `feed-spread.ts` safety comments, `providers/tts/index.ts`, and source-reading test prose are not explicit `any` typing and need no code action.

## In-Scope Closures

- Remove the three stale workaround directives already proven unused: `SwipeTabContainer.tsx:169`, `HomeScreen.tsx:502`, and `useTrellisData.ts:24`.
- Consider narrowing `settings.service.ts`, `main.tsx`, `providers/llm/index.ts`, and `TrellisLeaf.tsx` explicit `any` usages only when the local replacement is obvious and covered by existing tests.

## Deferred Items

- Hook dependency suppressions with load-bearing lifecycle behavior are deferred unless a later task adds targeted tests first.
- Test-only `@ts-ignore` lines in `legacy-migration.test.mjs` are retained as justified permanent guard rows because they support global stub injection.

## Decision Coverage

- D-13 is represented by the TODO/FIXME/HACK/XXX inventory and closure/defer disposition sections.
- D-14 is represented by the suppression classifications using exactly the required four-label vocabulary.

---
phase: 56-ui-polish-documentation
plan: 56-01
artifact: claude-drift-report
created: 2026-07-08
status: ready_for_operator_triage
requirements: [DOCS-02]
---

# CLAUDE.md Drift Report

This report mechanically compares load-bearing `CLAUDE.md` claims against current source. It does not edit `CLAUDE.md`. Corrections require operator approval in `56-TRIAGE.md`.

| ID | CLAUDE.md claim | Actual code value | Evidence | Verdict | Proposed resolution | Confirm required |
|---|---|---|---|---|---|---|
| DR-01 | Brand history says the SQLite connection name `'echolearn'` in `db.service.ts` is preserved for backwards compat. | `db.service.ts` now implements `IndexedDBBackend`; `IDB_NAME = 'trellis'`. No SQLite connection name appears in that file. | `CLAUDE.md:5`; `app/src/services/db.service.ts:180-190` | DRIFTED | Stale-doc update: rewrite Brand History to say on-disk directory and Claude memory path remain EchoLearn-derived, while current IndexedDB database name is `trellis`. | yes |
| DR-02 | Yesterday snapshot is `STORAGE_KEY_YESTERDAY = 'trellis_post_queue_yesterday'` written by `postQueueService.load()` on date mismatch. | Current snapshot row is `SQLITE_ROW_ID_YESTERDAY = 'queue_yesterday'` in IndexedDB/in-memory mirror. Old `trellis_post_queue_yesterday` appears only in legacy localStorage purge list. | `CLAUDE.md:61-62`; `app/src/services/post-queue.service.ts:20-34`; `app/src/services/db.service.ts:346-352` | DRIFTED | Stale-doc update: describe IndexedDB row `queue_yesterday`, `normalizeState()` / hydrate behavior, and remove localStorage-key write language. | yes |
| DR-03 | `hydrateAllFromSQLite()` and many `hydrate*FromSQLite` names imply SQLite. | The functions still carry SQLite names, but comments now say IndexedDB is the persistence backend. This is a naming fossil in code, not a `CLAUDE.md` standalone claim to fix silently. | `app/src/App.tsx:342-381`; `app/src/services/post-queue.service.ts:13-20` | VERIFIED_WITH_NAMING_DEBT | Do not rename in Phase 56; mention in docs only if operator approves broader wording. | yes |
| V-01 | `MAX_QUEUE_SIZE = 32`. | Matches current constant. | `CLAUDE.md:55`; `app/src/services/post-queue.service.ts:49-50` | VERIFIED | No change. | no |
| V-02 | `REFILL_THRESHOLD = 24`. | Matches current constant. | `CLAUDE.md:55`; `app/src/services/post-queue.service.ts:49` | VERIFIED | No change. | no |
| V-03 | Walker guard is `Math.max(count * 2, len)`. | Matches current implementation. | `CLAUDE.md:60`; `app/src/services/post-queue.service.ts:495-517` | VERIFIED | No change. | no |
| V-04 | YouTube Detector D requires `enablejsapi=1`. | Iframe src includes `enablejsapi=1`. | `CLAUDE.md:109`; `app/src/components/YouTubeEmbed.tsx:20-24` | VERIFIED | No change. | no |
| V-05 | Anchor pre-check threshold is `0.82`. | Matches `ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD = 0.82`. | `CLAUDE.md:247`; `app/src/services/canonical-knowledge.service.ts:48-51` | VERIFIED | No change. | no |
| V-06 | Anchor backfill cap is 8. | Matches `ANCHOR_BACKFILL_PER_CLASSIFICATION = 8`. | `CLAUDE.md:248`; `app/src/services/canonical-knowledge.service.ts:53-58` | VERIFIED | No change. | no |
| V-07 | RAW-ARGMAX floor band `[0.35, 0.70]` and `OFF_TOPIC_MARGIN = 0.02`. | Matches exported constants. | `CLAUDE.md:270-282`; `app/src/services/question-filter.service.ts:97-109` | VERIFIED | No change. | no |
| V-08 | `html, body { overflow: hidden }` is load-bearing. | Present. | `CLAUDE.md:148-166`; `app/src/index.css:297-302` | VERIFIED | No change. | no |
| V-09 | App root includes `overflowX: 'hidden'`. | Present. | `CLAUDE.md:156-160`; `app/src/App.tsx:140-141` | VERIFIED | No change. | no |
| V-10 | `SwipeTabContainer` focus-out resets document scrollLeft. | Present. | `CLAUDE.md:156-160`; `app/src/components/SwipeTabContainer.tsx:92-105` | VERIFIED | No change. | no |
| V-11 | `SwipeTabContainer` resize guard returns when width is unchanged. | Present. | `CLAUDE.md:171-179`; `app/src/components/SwipeTabContainer.tsx:129-133` | VERIFIED | No change. | no |
| V-12 | ChatInput input keeps `minWidth: 0`. | Present with load-bearing comment. | `CLAUDE.md:137-144`; `app/src/components/ChatInput.tsx:168-178` | VERIFIED | No change. | no |
| V-13 | `WEB_SEARCH_TOOL_PROMPT` is part of byte-stable Ask system prompt. | Constant exists and is included in system-prompt assembly. | `CLAUDE.md:286-317`; `app/src/state/useQuestions.ts:16`, `:214` | VERIFIED | No change. | no |
| V-14 | `USER_ACK_BEFORE_GRAPH_CONTEXT` is byte-stable and reused. | Constant exists and is used in both pass message arrays. | `CLAUDE.md:294-306`; `app/src/state/useQuestions.ts:228`, `:255`, `:321` | VERIFIED | No change. | no |
| V-15 | Header portal-vs-in-tree split is context-based. | `insideSwipeTab` controls in-tree vs `createPortal`. | `CLAUDE.md:118-133`; `app/src/components/ui/Header.tsx:139-155` | VERIFIED | No change. | no |
| V-16 | `BASE_ENTRIES_PER_CONCEPT = 4`, doubled when important. | Matches buildConceptBatch. | `CLAUDE.md:81-83`; `app/src/services/concept-feed.service.ts:900-926`, `:960-974` | VERIFIED | No change. | no |
| V-17 | Video/news posts that defer to streamer set `bodyMarkdown: ''`. | Video and news creation paths set empty bodyMarkdown. | `CLAUDE.md:205-214`, `:327`; `app/src/services/concept-feed.service.ts:1275-1280`, `:1339-1344` | VERIFIED | No change. | no |
| C-01 | Settings sub-pages read from `settingsService.getSync()`. | True; each sub-page initializes local state from `settingsService.getSync()`. | `CLAUDE.md:22`; `app/src/screens/settings/SettingsAIScreen.tsx:29-41`; `SettingsContentScreen.tsx:31-35`; `SettingsFeaturesScreen.tsx:20-46`; `SettingsDataScreen.tsx` settings rows | VERIFIED | No change. | no |
| C-02 | Proper-noun list includes SQLite. | Still listed as a proper noun even though active persistence moved to IndexedDB. This is not wrong as a term, but may be less relevant. | `CLAUDE.md:373`; current code still has SQLite-named hydrate functions | ACCEPTABLE | Leave unless operator wants wording cleanup. | yes |

## Recommended operator decisions for 56-02

1. Approve DR-01 as stale-doc update, not code regression. The IndexedDB database name `trellis` is the current implementation.
2. Approve DR-02 as stale-doc update. The old `trellis_post_queue_yesterday` localStorage key is now only a purge target.
3. Do not rename `hydrate*FromSQLite` functions in Phase 56. That is code churn outside the docs/polish scope.

## Safety checks

The following high-stakes safety docs remain present and should not be removed in any approved edit:

- YouTube `enablejsapi=1` requirement and Detector D origin allowlist: `CLAUDE.md:107-111`.
- RAW-ARGMAX malicious gate section: `CLAUDE.md:262-282`.
- Header portal-vs-in-tree invariant: `CLAUDE.md:118-133`.
- Root overflow and SwipeTabContainer keyboard invariants: `CLAUDE.md:148-180`.

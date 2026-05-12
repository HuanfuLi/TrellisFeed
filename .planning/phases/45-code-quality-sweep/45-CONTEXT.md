# Phase 45: Code Quality Sweep - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Mechanical hygiene pass for v1.5: TypeScript strictness audit, dead-code sweep, performance profiling, TODO/FIXME triage, and operator-note bug sweep. This phase closes TECHDEBT-07, TECHDEBT-09, TECHDEBT-10, TECHDEBT-11, and TECHDEBT-12. New product capabilities, broad UI redesign, feed-density changes, and dependency-version changes belong outside Phase 45.

</domain>

<decisions>
## Implementation Decisions

### Sweep Order
- **D-01:** Start with inventory artifacts before code edits: `45-TSC-AUDIT.md`, `45-TODO-TRIAGE.md`, and `45-PERF-AUDIT.md` or equivalent. Planning should make the audit outputs first-class deliverables, not afterthought notes.
- **D-02:** Fix order should be: existing test/TypeScript/lint blockers, dead-code and deleted-feature residue, diagnosed operator-note bugs, then performance findings. This keeps mechanical correctness ahead of speculative tuning.
- **D-03:** Phase 44 dependency bumps are intentionally parallel-safe but separate. Phase 45 should not bump packages or chase dependency-driven regressions unless a bug is proven independent of version changes.

### TypeScript Strictness
- **D-04:** Do not broaden strictness flags opportunistically. Audit the current TypeScript configuration and current `tsc -b --noEmit` result, then fix low-risk gaps or document deferrals with rationale.
- **D-05:** Existing source comments such as `eslint-disable`, `@ts-ignore`, and `no-explicit-any` suppressions are triage inputs. Remove or narrow them where local typing is obvious; preserve documented browser/Capacitor/React-hook exceptions when the alternative would be churn.
- **D-06:** Known stale tests around Phase 42/43 constants and Node test import behavior should be treated as hygiene targets if still failing when Phase 45 starts. Do not mask failures by weakening assertions unless the underlying canonical value changed and is documented.

### Dead Code And Removed-Feature Residue
- **D-07:** Remove true orphan exports, unused imports, unreachable helper functions, stale removed-feature residue, and stale i18n keys. Avoid broad refactors whose only benefit is aesthetic.
- **D-08:** When deleting code that has a load-bearing history, pair the deletion with source-reading or behavioral tests where practical. Carry forward the Phase 37/39/40/41/42/43 pattern: tests should guard the live path and avoid aspirational dead-code checks.
- **D-09:** Preserve explicitly documented compatibility residue, including the on-disk EchoLearn path and legacy localStorage migration behavior, unless an audit proves it is dead and not part of the brand-history compatibility contract.

### Performance Profiling
- **D-10:** Required profiling areas are first paint, queue refill, masonry scroll, and GraphScreen Android drag lag. Produce a documented profile with evidence for each rather than relying on impressions.
- **D-11:** Fix P0/P1 performance issues only when the fix is localized and low-risk. Defer broad architectural changes, full GraphScreen rewrites, or speculative animation rewrites with a clear rationale.
- **D-12:** Prefer targeted instrumentation, browser/Android WebView observation, and existing service seams. Do not add persistent product telemetry or user-visible diagnostics as part of this hygiene phase.

### TODO/FIXME Triage
- **D-13:** Catalogue project-wide TODO/FIXME/HACK/XXX plus suppression comments in `45-TODO-TRIAGE.md`. Each item must be closed, deferred to v1.6, or marked in-scope-for-v1.5 and closed inline.
- **D-14:** Suppression comments are not automatically bugs. Classify each as: justified permanent guard, narrowable local typing issue, stale workaround, or future-work note.

### Operator Notes And Debug Files
- **D-15:** Treat `.planning/notes/*` and relevant `.planning/debug/*` as triage inputs. Do not rediscover diagnosed root causes; planning should read these files first and either close, fold into Phase 45, or defer each with rationale.
- **D-16:** `.planning/notes/2026-05-08-fix-youtube-landscape-video.md` appears already addressed by Phase 38's YouTube short/video removal. Phase 45 should mark it reviewed/closed unless code inspection shows a remaining bug.
- **D-17:** `.planning/notes/2026-05-09-graphscreen-drag-lag-android.md` belongs under the performance audit. Diagnose and document it; fix only if the cause is localized.
- **D-18:** The diagnosed Force-New-Day / feed issues in `.planning/debug/` are candidate in-scope bug closures because they are concrete runtime defects with root-cause notes. Planning should check whether existing Phase 43 follow-up plans already cover them before creating duplicate work.

### the agent's Discretion
- Exact names and split of audit artifacts beyond the required content.
- Whether to group fixes by concern area or by file, as long as commits remain reviewable and verification stays clear.
- Exact profiling toolchain, provided evidence is captured in the phase artifact and manual Android observations are not lost.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope
- `.planning/ROADMAP.md` § Phase 45: Code Quality Sweep — fixed goal, requirements, and success criteria.
- `.planning/REQUIREMENTS.md` TECHDEBT-07, TECHDEBT-09, TECHDEBT-10, TECHDEBT-11, TECHDEBT-12 — requirement ownership and traceability.
- `.planning/PROJECT.md` § Current Milestone and Key Decisions — local-first, testability, feed-pipeline, and compatibility constraints.
- `.planning/STATE.md` § Last decisions and Phase 43 close-out notes — known pre-existing failures and deferred hygiene signals.

### Prior Phase Contracts
- `.planning/phases/37-i18n-leaf-module-refactor/37-CONTEXT.md` — leaf-module testability, `.ts` import convention, source-reading test discipline.
- `.planning/phases/38-v1-4-carry-over-cleanup/38-CONTEXT.md` — YouTube short/video removal and broader brand-history sweep rules.
- `.planning/phases/39-engagement-service-walker-extension/39-CONTEXT.md` — engagement service contract and anti-wire testing.
- `.planning/phases/40-source-diversity-leaf-module/40-CONTEXT.md` — leaf service and anti-wire pattern.
- `.planning/phases/41-pipeline-wiring-essay-depth/41-CONTEXT.md` — AbortSignal and cache-additivity contracts.
- `.planning/phases/42-masonry-feed-layout/42-CONTEXT.md` — masonry, reduced-motion, queue threshold, and test invariants.
- `.planning/phases/43-engagement-ui/43-CONTEXT.md` — tile-density descope, interaction contracts, and Phase 43 deferred hygiene.

### Operator Notes And Diagnoses
- `.planning/notes/2026-05-08-fix-youtube-landscape-video.md` — review as likely already closed by Phase 38.
- `.planning/notes/2026-05-09-graphscreen-drag-lag-android.md` — Android GraphScreen drag-lag performance note.
- `.planning/debug/dismiss-not-propagating-to-same-anchor-tiles.md` — diagnosed dismiss-filter cache overwrite issue.
- `.planning/debug/duplicate-post-keys-after-force-new-day.md` — diagnosed duplicate key issue after Force-New-Day.
- `.planning/debug/feed-not-auto-populating-after-force-new-day.md` — older Force-New-Day auto-population diagnosis; check supersession before acting.
- `.planning/debug/vine-chip-not-clearing-after-force-new-day.md` — older vine-chip stale state diagnosis; check supersession before acting.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/package.json` — scripts: `npm run build`, `npm run lint`, `npm test`, `npm run test:main`, `npm run test:actions`.
- `app/tests/**` — extensive source-reading and behavioral test pattern; use targeted `.test.mjs` files with `node:test` and `assert/strict`.
- `app/src/services/refill-mutex.ts`, `app/src/services/feed-spread.ts`, `app/src/lib/i18n-leaf.ts` — existing pure leaf-module extraction precedents for making logic testable under Node.
- `.planning/codebase/*.md` — existing maps for conventions, testing, concerns, stack, structure, and integrations.

### Established Patterns
- Atomic, reviewable commits by file or concern are a repeated planning constraint from prior phases.
- Source-reading tests are accepted in this codebase when they guard brittle integration contracts, deleted residue, or anti-wire invariants.
- Top-level screens are always mounted in `SwipeTabContainer`; state that can change while another screen is foregrounded needs route-aware re-sync or event-bus invalidation.
- All new or changed user-facing strings require four-locale parity (`en`, `zh`, `es`, `ja`) and bundle-parity tests.

### Integration Points
- TypeScript audit: `app/tsconfig*.json`, `app/src/**/*.ts`, `app/src/**/*.tsx`, and current `tsc -b --noEmit` behavior.
- Dead-code sweep: `app/src/`, `app/tests/`, locale bundles, and removed-feature residue from YouTube shorts / old feed components.
- Performance audit: `app/src/screens/HomeScreen.tsx`, `app/src/components/MasonryFeed.tsx`, `app/src/services/concept-feed.service.ts`, `app/src/services/post-queue.service.ts`, `app/src/screens/GraphScreen.tsx`, and trellis graph components/services.
- TODO/FIXME audit: `app/src`, `app/tests`, `.planning/notes`, `.planning/debug`, and suppression comments.

</code_context>

<specifics>
## Specific Ideas

- Operator preference from Phase 43 remains load-bearing: feed tiles are already visually rich, so Phase 45 must not reopen broad tile-metadata additions. Hygiene can remove clutter; it should not add new tile signals.
- GraphScreen Android drag lag has a warm-up pattern. Treat it as a profiling target, not a guaranteed rewrite.
- Force-New-Day and dismiss bugs have root-cause writeups. Use those notes to plan precise fixes instead of starting fresh.

</specifics>

<deferred>
## Deferred Ideas

- Broad UI polish and tile-metadata redesign beyond hygiene.
- Major dependency upgrades or package migrations; Phase 44 owns in-major dependency sweep, and v1.6 owns held-back majors.
- Persistent telemetry or user-visible diagnostic tooling.
- Backend/cross-device sync for engagement or notes.

</deferred>

---

*Phase: 45-code-quality-sweep*
*Context gathered: 2026-05-12*

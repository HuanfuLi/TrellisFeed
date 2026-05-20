# Project Retrospective — Trellis (formerly EchoLearn)

Living document. Each milestone close-out appends a new section before "Cross-Milestone Trends."

---

## Milestone: v1.4 — Curiosity Feed Redesign + UI Polish

**Shipped:** 2026-05-08
**Phases:** 10 (28, 29, 30, 31, 32-absorbed, 32.1, 33, 34, 35, 36) | **Plans:** 63

### What Was Built

- **VineProgress** — organic SVG vine with flowers + expandable concept checklist; replaced rigid ConceptProgressCard. Sticky compact mode + inline mode share the same component.
- **Three-list concept feed pipeline** — daily concept list (anchor nodes via SM-2) → derived list (append-only, weighted, persistent with cyclePosition) → 32-max queue (cyclic walker, 4 per swipe, refill threshold 16, Promise-mutex guarded). Lazy-skip explored anchors at walk time. Stratified style allocation (largest-remainder + Fisher-Yates) + spreadByConcept mixer before spreadByStyle. Yesterday-queue snapshot durable across cold starts. Dev "Force New Day" affordance with symmetric two-cache mutation.
- **Ask-chat KV-cache prefix preservation** — `useQuestions.ts:askStreaming` system prompt byte-stable; per-turn graph context in tail-position assistant message; USER_ACK_BEFORE_GRAPH_CONTEXT user-ack inserted for strict-alternation chat templates (Qwen via LM Studio).
- **UI/UX audit shipped** — 9 CSS spacing tokens, BottomNavigation slide-down on sub-screens, Header scroll-shadow via context, SwipeTabContainer resize re-sync, 44×44 WCAG touch targets, trellis shake-on-tap + haptic + pulse-on-focus, "Knowledge Graph" rename, Settings iOS-style sub-page navigation, dark-theme audit (13 CSS vars), animation polish across 7 surfaces.
- **Code hygiene cleanup** — TD-04/05/06 closed, perf memoization (React.memo on ConceptCard + VineProgress), leaf modules (`feed-spread.ts`, `refill-mutex.ts`) for testability.
- **v1.3 gap closure** — TD-01/02/03, AbortSignal plumbing, .ts extension sweep on failing-test chain, 25 UAT checkpoints across phases 20/21/22/26.
- **Rebrand** — EchoLearn → Trellis, single commit, with localStorage migration via `legacy-migration.service.ts`.

### What Worked

- **Phase 36's leaf-module pattern** — extracting pure logic into `feed-spread.ts` and `refill-mutex.ts` so tests could exercise behavior without dragging in the i18n chain. Pattern was discovered mid-phase as a workaround and is now an established CLAUDE.md convention.
- **Source-reading invariant tests with anchor-pair extraction** — Phase 35/36 tests that read source text to assert structural invariants (e.g., "USER_ACK_BEFORE_GRAPH_CONTEXT is between history and assistant context in BOTH passes"). The anchor-pair extraction (slicing between two unique markers) eliminated regex false-positives that whole-file regexes would hit.
- **CLAUDE.md three-place documentation pattern** — for load-bearing rules: project-level CLAUDE.md, auto-memory, AND inline comment at the code site. Operator-flagged after the 5+-time concept-feed-pipeline re-explanation. Multiple Phase 36 lessons followed this discipline.
- **Atomic commits per task with explicit cross-references** — every Phase 36 task was a single commit with hash recorded in subsequent docs. Made bisection trivial when round-3 vs round-4 regressions surfaced.
- **gsd-debugger / scientific debugging** — round-4 sub-issue (b) was diagnosed by running the actual test, watching it fail, then tracing the consumer side — `loadCache` rejected on date mismatch, but `today()` couldn't advance under the dev button, so the rejection was a no-op. The fix (Plan 36-15) was authored against the diagnosed root cause, not the symptom.

### What Was Inefficient

- **Phase 32 absorbed** — 3 plans drafted but never executed; UAT retest absorbed by Phase 32.1 (legitimate), verification write-ups absorbed by Phase 34 (delayed by 2 weeks). Cost: 2 weeks of stale "where's 30-VERIFICATION.md?" confusion. Lesson: when an audit gap is identified, plan it into the next phase not "the next phase after that."
- **Round 3 → round 4 regression** — Plan 36-13 framed the daily-posts cache mutation as "redundant" and removed it; round-4 UAT exposed that `loadCache` rejection trivially passes on the dev-button path. The framing was wrong because dev affordances simulate wall-clock events that real services can't observe; revert took a full plan (36-15) including a "DO NOT FLIP THIS BACK" marker. Lesson: when removing code, prove it's unreachable on EVERY path, not just the natural one.
- **CLI tooling fit** — `gsd-tools.cjs milestone complete` couldn't recognize v1.4 phases because ROADMAP marked v1.4 as "(next) — PLANNING" rather than "✓ COMPLETE". The CLI archived empty placeholders; manual repair needed for the actual ROADMAP content extraction. Lesson: CLI tools assume a specific ROADMAP grammar; verify it before relying.
- **Source-file extension sweep abandoned** — running `.ts` extensions across 84 files broke 6 source-reading invariant tests (regex assertions ended at literal `.service'`). Reverted. The actual fix is the i18n leaf-module pattern (carried to v1.5). Lesson: a "mechanical sweep" can collide with strict source-reading test patterns; check first.
- **CLI ran from wrong cwd** — initial `gsd-tools milestone complete` was invoked from `app/` cwd, found stale scaffold `app/.planning/`, and operated on it. Took 5 minutes to diagnose. Lesson: tooling that uses cwd-relative paths must be invoked from project root explicitly.

### Patterns Established

- **Leaf-module extraction for service-layer testability** — when a service has pure-logic helpers but transitively imports the i18n chain, extract the pure logic into a leaf module. Tests import the leaf; product code imports both. Examples: `feed-spread.ts`, `refill-mutex.ts`. Carried to v1.5 for systemic i18n cleanup.
- **Source-reading invariant tests with anchor-pair extraction** — for structural invariants that don't have a clean unit test, read the file's source and grep for required patterns within an anchored range. Used by Phase 35 system-prompt stability test, Phase 36-13 force-new-day test, Phase 36-14 vine resync test.
- **Always-mounted screen state-resync** — when a SwipeTabContainer slot reads from a service whose state mutates while another slot is foregrounded, the slot MUST add a `[location.pathname]` `useEffect` that re-syncs on navigation back. Documented in CLAUDE.md.
- **Dev affordance + service-side reset + UI-side resync triple-guard** — for dev affordances simulating wall-clock events: handler mutates ALL date-stamped storage keys; rejection-on-mismatch fires on next read; navigation effect re-pulls from service. Single source of asymmetry → three layers of defense.
- **"DO NOT FLIP THIS BACK" embedded markers** — when a test assertion is inverted in response to a UAT regression, embed a 3–5-paragraph rationale block in the test body so a future agent reading the test in isolation has the historical context. Phase 36-15 Test 6 is the canonical example.

### Key Lessons

1. **Test-coverage scope vs reality scope.** Plan 36-04's integration smoke at `walkDerivedList(2, 4-entry)` passed, but the real failure was at `walkDerivedList(16, 4-entry)` — the cap defect was masked by the small smoke `count`. Lesson: integration smokes must use realistic call patterns, not minimal ones.
2. **Pre-existing drift surfaces only when scope is tight enough.** GAP-A (cold-start empty feed) and GAP-C (video completion signal absent) were pre-existing v1.3-era bugs. They became visible only when Phase 36 forced UAT into a tight enough scope that they couldn't hide. Lesson: tight UAT scope is a feature, not a constraint.
3. **Cache-rejection patterns must mirror across all date-stamped keys.** Plan 36-13 removed one of two date-stamped cache keys assuming the other made it redundant. The dev affordance bypassed the natural-midnight path. Lesson: symmetric cache invalidation is symmetric, full stop — the only test for "redundant" is "does the dev path also trip both."
4. **CLI tools that operate on planning directories assume specific grammar.** `gsd-tools milestone complete` couldn't recognize v1.4 phases because the ROADMAP marker was "(next) — PLANNING" not "✓ COMPLETE". Lesson: when running close-out tools, ensure ROADMAP markers match the tool's grammar OR be ready to repair the output.
5. **Source-reading tests resist mechanical refactors.** A blanket `.ts` extension sweep broke source-reading regex assertions that ended at `\.service['"]`. Lesson: source-reading tests are fragile by design — any sweep that touches imports must update the test patterns first.

### Cost Observations

- Model mix: ~70% Opus 4.7, ~20% Sonnet, ~10% Haiku (estimated)
- Sessions: ~25 (one per phase + audit + close-out)
- Notable: Phase 36 burned the most cycles (16 plans across 4 rounds) — about 35% of total v1.4 effort. The reason: each round surfaced a new regression that required diagnosing, planning, executing, and re-verifying. The total work was justified — each round closed real bugs — but the late-round bugs (round 3 sub-issue e, round 4 sub-issues a + b) ate disproportionate time because they were interaction bugs invisible to unit tests.

### v1.5 first wave (carry-overs)

1. **i18n leaf-module refactor** — extract `t(key, opts)` into `src/lib/i18n-leaf.ts` so services can be imported by `node --test` without the Vite-only `import.meta.env.DEV` chain. Closes 10 carried test failures (trellis-state, trellis-layout, concept-feed). Estimated 1–2h.
2. **VALIDATION drift cleanup** — flip 34-VALIDATION.md to validated; normalize 35-VALIDATION.md from `approved` → `validated`.
3. **ROADMAP polish** — append 36-14 + 36-15 plan bullets to Phase 36 entry to match `Plans: 16/16` count (now archived to `.planning/milestones/v1.4-ROADMAP.md`).
4. **33-HUMAN-UAT-1/2** — touch-target feel + React.memo behavioral correctness on physical device.
5. **CLAUDE.md `echolearn_*` localStorage references** — bulk rename or annotate brand-history note.

---

## Milestone: v1.5 — Curiosity Feed v2 + Tech-Debt Hardening

**Shipped:** 2026-05-13
**Phases:** 10 (37-46) | **Plans:** 44 plan files / 48 summary files

### What Was Built

- Pinterest-style two-column masonry feed with vine-bloom end state.
- Local-first engagement service and UI: save, like, dismiss, saved/liked views, long-press menu, and dismiss filtering through walker/read boundaries.
- Richer content pipeline: Deep Dive essays, citation rendering, Tavily source diversity, and queued-news multi-source grounding.
- v1.4 carry-over cleanup: i18n leaf module, validation drift, roadmap polish, device retests, brand-history docs, and YouTube short removal.
- Hardening sweep: dependency updates, strictness/lint/dead-code/TODO/operator-note/performance audits, and GraphScreen Android drag mitigation.

### What Worked

- Leaf-helper seams remained effective: `i18n-leaf.ts`, `source-diversity.service.ts`, and `news-source-metadata.ts` let tests cover behavior without importing the full app chain.
- Source-reading tests caught wiring drift where DOM/runtime harnesses would have been expensive.
- Milestone audit before archive found a real CONTENT-03 integration gap; the Phase 46 closure kept the fix narrow and test-backed.
- Separating self-contained hardening phases from feature phases avoided dependency/strictness churn during UI work.

### What Was Inefficient

- Phase 43 accumulated many UI gap-closure plans after UAT, which was correct but expensive.
- Nyquist metadata remains stale for phases 38, 40, and 41 even though verification passed.
- `gsd-tools milestone complete` produced a zero-count v1.5 milestone entry, requiring manual repair.
- The known stale `tests/concept-feed.test.mjs` `buildFallbackPosts` contract remains deferred.

### Patterns Established

- Testable production helpers for service data shaping, exemplified by `news-source-metadata.ts`.
- Audit-driven gap closure phase after milestone review, exemplified by Phase 46.
- Dedicated close-out artifacts (`*-VERIFY.md`, `*-VALIDATION.md`, `*-SUMMARY.md`, `*-VERIFICATION.md`) as archive-grade evidence.

### Key Lessons

1. Milestone audits need to inspect active runtime paths, not only direct generation paths; CONTENT-03 was only incomplete on queued prefetch.
2. When a helper extraction changes source shape, update source-reading tests in the same plan or the test suite becomes stale.
3. UI UAT should happen before broad close-out when layout/interaction changes span mounted screens, portals, and gesture surfaces.
4. CLI archive output must be reviewed before commit; grammar drift in planning files can produce empty milestone stats.

### Cost Observations

- Model mix: mostly Opus-quality planning/execution with Sonnet verification/integration (estimated).
- Sessions: high, due to multi-phase milestone plus UAT/gap closure loops.
- Notable: Phase 43 and Phase 46 provided the highest leverage: Phase 43 exposed the real user-facing engagement workflow, and Phase 46 converted a static audit finding into a narrow durable regression.

---

## Milestone: v1.6 — Control, Graph Trust, Retrieval, and Ethical Engagement

**Shipped:** 2026-05-20
**Phases:** 7 (47-53) | **Plans:** 39 plan files / 39 summary files / 72 tasks

### What Was Built

- Filter redesign: regex pattern library replaced with a hybrid narrow-regex + dual-vector embedding classifier behind a pre-LLM gate, plus structural input bracketing.
- Graph command service (seven verbs, mutex-serialized, journaled, one typed `GRAPH_UPDATED` per mutation) and a gesture-driven correction UI with preview/confirm and persistent Undo.
- Retrieval + library (collections, saved/liked/history, debounced search) and concept dashboard / recovery surfaces reading the live canonical graph.
- Podcast quality defaults with bounded length × style controls, options-hash caching, and TTS safety fallback.
- Provider-privacy payload goldens + a non-pushy-engagement negative-invariant guard (test-only phase).

### What Worked

- The leaf-module + source-reading test patterns scaled cleanly into a new domain: Phase 53 enforced both a runtime payload boundary (fetch-stub goldens) and a structural call-site assertion with zero source changes.
- The verifier's mutation-testing habit (inject a leak → confirm red → restore) gave high confidence the guards are non-vacuous, not green-by-accident.
- Catching the operator's design objection early in Phase 53 discuss-phase prevented building coercive engagement mechanics (mandated goals/stop-cues/reflection) that conflicted with the product's reward-based stance — a rescope, not rework after the fact.
- Worktree-isolated parallel execution with central merge + post-merge full-suite gate kept the 1471-test suite green across every wave.

### What Was Inefficient

- Three phases (49, 50, 52) reached the milestone audit with verification paper-trail gaps — 49 had no VERIFICATION.md (UAT-only), 50 was stuck at `human_needed`, 52's VALIDATION.md was a stale draft. Functionally complete, but the audit had to spawn three reconciliation agents to close the records.
- Phase 50 again needed a large UAT-driven gap-closure tail (13 plans), echoing v1.5's Phase 43.
- The `milestone complete` CLI again produced a noisy auto-extracted accomplishment list (per-plan fragments incl. review-fix lines), requiring a full manual rewrite of the MILESTONES.md entry — same class of issue as v1.4/v1.5.

### Patterns Established

- **Provider-boundary privacy goldens**: seed sentinels into live storage keys, stub fetch, assert the captured request body excludes them — a reusable shape for any "private data must not leave the device" guarantee.
- **Documented scoped exceptions in structural guards**: an allowlist (e.g. `reorganizeMindmap` reads the graph-edit journal) keeps a negative-invariant test honest without weakening it everywhere.
- **Discuss-phase as a design gate**: surfacing a premise conflict to the operator and rescoping before planning, rather than after execution.

### Key Lessons

1. Verification records should be advanced to their terminal state when a UAT closes the human items — otherwise `human_needed`/missing VERIFICATION.md silently accrues and surfaces only at milestone audit.
2. A passing phase verifier does not imply a finalized VALIDATION.md; the Nyquist record needs its own post-execution reconcile.
3. Single-file `tsc` checks can produce false errors out of project context (the Phase 49 verifier's SavedScreen.tsx claim) — always confirm against a project-level `tsc -b --noEmit`.
4. CLI-generated milestone summaries remain unreliable; budget for a manual rewrite at every close.

### Cost Observations

- Model mix: Opus planning/execution + Sonnet verification/integration/nyquist (per config).
- Sessions: high — 7 phases plus a milestone audit that fanned out to integration + 3 reconciliation agents.
- Notable: the test-only Phase 53 was cheap to execute but high-leverage — it converted a privacy/ethics design stance into durable regression guards.

---

## Cross-Milestone Trends

- **Leaf modules are now a standing architecture pattern.** v1.4 discovered it for testability; v1.5 applied it to i18n/source-diversity/news metadata; v1.6 extended it to filter classification, podcast view-models, and privacy goldens.
- **Source-reading + structural tests are powerful but need maintenance.** They caught load-bearing invariants across v1.4–v1.6; helper extraction and import-shape changes require paired test updates.
- **UAT finds interaction bugs that unit tests miss.** v1.4 Force-New-Day, v1.5 engagement/masonry, and v1.6 graph-correction/retrieval flows all needed human-visible retest loops.
- **Verification paper-trail drifts from functional reality.** v1.5 left stale Nyquist metadata (38/40/41); v1.6 left three phases (49/50/52) with missing/stale verification records despite passing UATs — reconcile records when UATs close, not at milestone audit.
- **Archive tooling needs verification.** v1.4, v1.5, and v1.6 close-outs all required manual review/repair of CLI-generated milestone summaries.

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

## Cross-Milestone Trends

(Will fill in when v1.5 closes — need at least 2 milestones with retrospectives to identify patterns.)

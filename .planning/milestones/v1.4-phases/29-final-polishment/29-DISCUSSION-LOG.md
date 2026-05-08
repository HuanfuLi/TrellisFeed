# Phase 29: Final polishment — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `29-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 29-final-polishment
**Areas discussed:** Execution shape, tsc/Node 25 fix scope, Abort cancellation semantics, UAT format + ownership (surfaced in round 2)

---

## Execution shape

### Plan structure

| Option | Description | Selected |
|--------|-------------|----------|
| 4 separate plans | 29-01 TD-01 / 29-02 TD-02+03 / 29-03 tsc+Node 25 / 29-04 UAT. Cleanest blast-radius isolation. | ✓ |
| 2 plans | Code fixes bundled, UAT separate. Fewer coordination overheads. | |
| 1 monolithic plan | Everything in one plan. Minimal overhead but harder to verify. | |

**User's choice:** 4 separate plans → D-01

### Ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Strict serial (code → UAT) | Land code fixes first, THEN run UAT on clean build. Safer but slower. | |
| Parallel (code + UAT independent) | UAT runs on current main (tests against shipped behavior); tech-debt fixes proceed in parallel. Fastest. | ✓ |
| Hybrid | UAT on current main for baseline, fix code, spot-retest touched paths. Most thorough, adds retest overhead. | |

**User's choice:** Parallel → D-02

### New-issue handling during UAT

| Option | Description | Selected |
|--------|-------------|----------|
| Defer all new issues to v1.4 | Log as backlog. Phase 29 closes only the 25 listed items. Fastest close. | |
| Inline fix if trivial (<30 min) | Small bugs in-scope; bigger → v1.4. Pragmatic middle ground. | |
| Inline fix whatever walkthrough surfaces | Widest net; milestone quality wins over schedule. Unbounded UAT scope, bounded code scope. | ✓ |

**User's choice:** Inline fix whatever walkthrough surfaces → D-03

**Notes:** Combined with D-11 (strictest done), 29-04 is explicitly an unbounded plan. Planner should design it as checkpoint-heavy / iterative.

---

## tsc/Node 25 fix scope

### tsc sweep

| Option | Description | Selected |
|--------|-------------|----------|
| Narrow — documented items only | Fix only the 4 files listed in deferred-items.md. Smallest radius. | |
| Run tsc fresh + fix every error | Full `tsc -b --noEmit`, fix everything. Clean slate but unknown size. | |
| Documented + same-file siblings | Fix the 4 files; include neighbor errors in same files; don't chase unrelated. | ✓ |

**User's choice:** Documented + same-file siblings → D-04

### Node 25 ERR_MODULE_NOT_FOUND

| Option | Description | Selected |
|--------|-------------|----------|
| Add extensions to failing tests' import graphs | Fix 5 documented failing test files + transitive intra-src imports. Targeted. | ✓ |
| Add extensions to every intra-src import app-wide | Full sweep, future-proofs Node 25+. Touches many unrelated files. | |
| Configure around it (Node loader / tsconfig tweak) | Keep imports extension-less. Minimal source churn but adds build config complexity. | |

**User's choice:** Add extensions to failing tests' import graphs → D-05 (+ D-19 explicit rejection of config-workaround)

---

## Abort cancellation semantics

### PostDetailScreen abort triggers (TD-02)

| Option | Description | Selected |
|--------|-------------|----------|
| LOCALE_CHANGED only | Parity with D-22. Cleanest. | |
| LOCALE_CHANGED + unmount | Also cancels on nav-away. More user-friendly. | |
| LOCALE_CHANGED + unmount + timeout | All above + timeout guard. Most robust. | ✓ |

**User's choice:** LOCALE_CHANGED + unmount + timeout → D-06

### classifyAndAnchorIncremental signal depth (TD-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Pass signal to every chatCompletion (all 3 steps) — "Cancel mid-step (<100ms response)" | Exact D-22 parity. ~5-line change. Recommended. | ✓ |
| Check signal.aborted between steps only — "Cancel between steps (5-30s delayed response)" | Lighter touch but less responsive. Simpler mental model. | |

**User's choice:** Cancel mid-step (<100ms response) → D-07

**Notes:** User initially picked "I am confused. Please expand with more details" — reframed in plain language (what the pipeline is, what cancellation looks like, timing response). User then confidently chose mid-step cancel.

### Partial state on abort

| Option | Description | Selected |
|--------|-------------|----------|
| Discard — nothing persists | No patchPostEssayInCache on abort; classify already commits only after all 3 steps. Matches D-22 discard-on-abort. | ✓ |
| Keep partial stream buffer visible | Preserve partial streamingBody in cache for quick retry. Risks confusing UX. | |

**User's choice:** Discard — nothing persists → D-08

---

## UAT format + ownership (surfaced in round 2)

### UAT log format

| Option | Description | Selected |
|--------|-------------|----------|
| Single UAT-LOG.md in Phase 29 dir | One flat file, 25 items grouped by source phase. Easy end-to-end review. | ✓ |
| Per-phase UAT logs in Phase 29 dir | 4 files: 29-UAT-phase20.md, etc. Easier phase mapping but more files. | |
| Update each archived VERIFICATION.md in-place | Flip status + re_verification. Evidence with source phase, but edits archive files. | |

**User's choice:** Single UAT-LOG.md → D-09 (+ D-21 adds archive-file status flip as a secondary update for bookkeeping)

### Inline-fix commit location

| Option | Description | Selected |
|--------|-------------|----------|
| Inside plan 29-04 | Walkthrough + fixes bundled; predictable ownership. | ✓ |
| Spawn new plans per fix | Each bug gets own plan. More planning overhead. | |
| Inline if <30min, new plan if bigger | Pragmatic middle ground. | |

**User's choice:** Inside plan 29-04 → D-10

### Definition of done

| Option | Description | Selected |
|--------|-------------|----------|
| 4 VERIFICATIONs + all 25 UAT + all surfaced fixes | Strictest; nothing ships with open items. Longest timeline, cleanest milestone state. | ✓ |
| 4 VERIFICATIONs + 25 UAT (surfaced fixes can defer) | Scope protection; new issues can defer. | |
| 4 VERIFICATIONs only (UAT is evidence, not a gate) | Least strict; human_needed phases can stay human_needed if items fail. | |

**User's choice:** Strictest (all 4 + all 25 + all surfaced) → D-11

---

## Claude's Discretion

- Plan subagent spawning pattern for 29-04 — checkpoint-heavy single-wave vs two-part plan. Planner chooses at plan time.
- Error message copy for aborted post essay — silent discard is default; toast allowed if planner finds a confusing surface.
- 29-03 file ordering (tsc first vs Node 25 first) — planner's choice; both converge.
- Branching — work on `main` per project cadence unless planner identifies a cross-plan interaction.

## Deferred Ideas

- 23-05 DEDUP plan — remains deferred; revisit only if dedup surfaces as observed problem.
- Broader tsc / Node 25 cleanup — out of scope; any errors found outside the 4 documented files go to v1.4 backlog.
- Node loader config / tsconfig moduleResolution tweak — explicitly rejected (D-19).
- Per-phase UAT log files — rejected in favor of single log (D-09).
- `useAbortOnLocaleChange` custom hook — deferred; keep TD-02/03 structurally parallel to inlined Phase 27 pattern.
- Captured UAT screenshots — optional per Phase 27 precedent; operator's choice.

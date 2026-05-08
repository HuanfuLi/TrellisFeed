---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 05
subsystem: docs
tags: [docs, claude-md, concept-feed-pipeline, gap-closure]
requires:
  - 36-01 (stratified style allocation — closes GAP-3)
  - 36-02 (concept-axis spread — closes GAP-4)
  - 36-03 (persistent derivedList + cyclic walker — closes GAP-1 + GAP-2)
provides:
  - "CLAUDE.md Concept Feed Generation Pipeline section reflects post-Phase-36 reality"
  - "MAX_QUEUE_SIZE = 32 is now documented (closes GAP-6 doc drift)"
  - "Future agents reading CLAUDE.md find pointers to appendToDerivedList + walkDerivedList implementations"
affects:
  - CLAUDE.md (single section: "Concept Feed Generation Pipeline")
tech-stack:
  added: []
  patterns:
    - "Doc-sync: when code closes a gap, the doc that names the gap must be updated in the same wave"
key-files:
  modified:
    - path: CLAUDE.md
      what: "Concept Feed Generation Pipeline section — Numeric defaults bullet + diagram DERIVED LIST box wording + Known divergences list"
      why: "Phase 32.1 lesson #2: documentation must guard the LIVE code path; outdated docs mislead future agents"
decisions:
  - "Documented MAX_QUEUE_SIZE under Numeric defaults rather than under Files — operator-visible constants belong with the rest of the numeric defaults (refill threshold, swipe count, style weights) for at-a-glance discovery"
  - "Phrasing chose `MAX_QUEUE_SIZE = 32` (constant-first) rather than `Queue maximum size: 32 (MAX_QUEUE_SIZE)` (label-first) so the regex `MAX_QUEUE_SIZE.*32` matches positively. Test contract enforces discoverability."
  - "Used strikethrough + closure annotation rather than deletion for GAP-1/3/4 entries. Future agents grepping CLAUDE.md history for the original gap text will still find it (with its closure context)."
  - "Preserved the GAP-5 line (queue serves variable count vs. strictly 4 per swipe) as an explicit `(Out of scope for Phase 36.)` note rather than removing it. Out-of-scope is not the same as not-a-gap."
metrics:
  duration: 5 minutes
  completed: 2026-05-06
  files_changed: 1
  lines_added: 14
  lines_removed: 7
---

# Phase 36 Plan 05: CLAUDE.md doc-sync Summary

Surgical update to CLAUDE.md's "Concept Feed Generation Pipeline" section so the doc describes what the code DOES (post-Phase-36) instead of what it WAS. Four targeted edits in one atomic commit; all other CLAUDE.md sections byte-stable.

## What changed

### Edit 1 — Numeric defaults: document MAX_QUEUE_SIZE

Added one new bullet to the existing list under `### Numeric defaults`:

```
- Queue maximum size: `MAX_QUEUE_SIZE` = **32** (in `post-queue.service.ts:13`).
  enqueueInterleaved + enqueue both cap at this size. Refill threshold (12)
  gives a 20-post runway between refills.
```

Closes GAP-6 (doc drift): the constant has existed in code at `post-queue.service.ts:13` since the post-queue service was first introduced, but was never documented in CLAUDE.md.

### Edit 2 — Diagram DERIVED LIST box: cross-reference appendToDerivedList

The "Update mode: APPEND-ONLY" line in the boxed diagram now ends with:

```
... Implemented as
postQueueService.appendToDerivedList(ids[]) — dedups by conceptId.
```

Future agents who read "the derived list is append-only" can immediately find the implementation method by name.

### Edit 3 — Diagram DERIVED LIST box: lazy-skip removal trigger

Replaced the old "REMOVE that concept's remaining entries from the derived list" wording (which described a never-implemented physical removal) with the lazy-skip mechanism that 36-03 actually shipped:

```
Removal trigger: when user READS a post of a concept
(CONCEPT_EXPLORED event), the concept is added to
dailyReadService.getExploredAnchors(). The walker
(postQueueService.walkDerivedList) LAZILY skips explored ids
at walk time rather than physically splicing the array
(which would corrupt cyclePosition — see RESEARCH § Pitfall 1).
```

This is the canonical pattern from 36-RESEARCH.md § Pitfall 1 — physical splice on CONCEPT_EXPLORED would corrupt `cyclePosition`, so the design lazy-skips at walk time.

### Edit 4 — Known divergences: strike GAP-1 / GAP-3 / GAP-4

Three of the four pre-existing divergence bullets are now struck through with closure annotations naming the Phase 36 plan that closed each:

| Pre-Phase-36 line | Closure |
|---|---|
| ~~Derived list is currently rebuilt every refill~~ | **CLOSED via Phase 36 GAP-1 + GAP-2** (36-03) |
| ~~Style sampling is i.i.d. per entry~~ | **CLOSED via Phase 36 GAP-3** (36-01) |
| ~~Style-axis interleave only~~ | **CLOSED via Phase 36 GAP-4** (36-02) |

The "Each concept gets at most 2 entries" line was rewritten as a non-strikethrough statement of intent: `BASE_ENTRIES_PER_CONCEPT (4) entries by default, doubled to 8 if important`. Phase 36 didn't change the per-concept multiplicity — it changed the style proportionality, which is now stratified.

The "Removal on read is NOT wired" line (already struck via Phase 33) was extended: "**Phase 36 layered the lazy-skip walker on top**". Belt-and-suspenders: build-time filter (Phase 33) + walk-time skip (Phase 36).

GAP-5 (queue serves variable count instead of strictly 4 per swipe) stays in the list with `(Out of scope for Phase 36.)` annotated.

## Acceptance criteria

All 6 sentinel greps pass:

| Pattern | Count |
|---|---|
| `MAX_QUEUE_SIZE.*32` | 1 |
| `postQueueService.appendToDerivedList` | 1 |
| `walkDerivedList` | 2 |
| `Phase 36 GAP-1` | 1 |
| `Phase 36 GAP-3` | 1 |
| `Phase 36 GAP-4` | 1 |
| `CLOSED via Phase 36` | 3 |

All 6 byte-stability greps pass for OTHER load-bearing rule sections:

| Pattern | Count |
|---|---|
| `html, body { overflow: hidden }` | 3 |
| `minWidth: 0` | 2 |
| `Never re-introduce dynamic content into the system prompt` | 1 |
| `USER_ACK_BEFORE_GRAPH_CONTEXT` | 2 |
| `normalizeAnchorName` | 3 |
| `ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD` | 1 |

GAP-5 preservation: `grep -c "Queue serves variable count"` returns 1 (preserved as out-of-scope).

Closed-gap raw lines (should all be 0 after edits): all 0.

## Diff scope

```
git diff --shortstat CLAUDE.md
 1 file changed, 14 insertions(+), 7 deletions(-)
```

All hunks scoped to the `## Concept Feed Generation Pipeline` H2 section (lines 24–95). No other CLAUDE.md section touched. The diagram's box-drawing widths are visually preserved (78-char content rows; em-dash and `§` characters expand byte length but render as a single column).

## Deviations from Plan

None — the plan's `<action>` text was followed verbatim. One minor wording adjustment: the example bullet in §<action> EDIT 1 read `Queue maximum size: **32** (\`MAX_QUEUE_SIZE\` in ...)`. I rephrased to `Queue maximum size: \`MAX_QUEUE_SIZE\` = **32** (in ...)` so the regex `MAX_QUEUE_SIZE.*32` matches positively (the original phrasing put `32` BEFORE `MAX_QUEUE_SIZE` in the line, and the test contract requires the constant name then the value). This is a regex-compliance tweak, not a semantic change.

## Commit

- `e97e5df5`: `docs(36-05): update CLAUDE.md Concept Feed Pipeline section — close GAP-1/2/3/4 + document MAX_QUEUE_SIZE (closes GAP-6)` (1 file, +14/−7)

Branch: `gsd/phase-33-hygiene-and-polish`. Committed with `--no-verify` per parallel-execution coordination with Plan 36-04.

## Self-Check: PASSED

- File `CLAUDE.md` exists: FOUND
- Commit `e97e5df5` exists: FOUND
- All 6 required-content greps return ≥ 1
- All 6 byte-stability greps return ≥ 1
- GAP-5 preservation grep returns 1
- All 3 closed-gap raw-line greps return 0
- Diff size 14+/7− is within the plan's "small change (~30-50 lines)" bound

---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 05
type: execute
wave: 3
depends_on: [01, 02, 03]
files_modified:
  - CLAUDE.md
autonomous: true
requirements: [GAP-6, GAP-1, GAP-2, GAP-3, GAP-4]
gap_closure: true
must_haves:
  truths:
    - "CLAUDE.md 'Numeric defaults' subsection documents `MAX_QUEUE_SIZE = 32` (closes GAP-6 — doc drift; the constant exists in code but was never documented)"
    - "CLAUDE.md 'Update mode: APPEND-ONLY' line cross-references postQueueService.appendToDerivedList so future agents can find the implementation"
    - "CLAUDE.md 'Removal trigger' line is updated to reflect the LAZY-SKIP mechanism (via walkDerivedList + exploredIds) rather than the old (never-implemented) physical removal"
    - "CLAUDE.md 'Known divergences from design' list strikes through GAP-1, GAP-2, GAP-3, GAP-4 entries with closure-commit anchors"
    - "No load-bearing rule in any other CLAUDE.md section is altered (Header positioning, ChatInput flex shrink, Root overflow clip, SwipeTabContainer resize, Event bus, News post pipeline, Anchor name normalization, Classification dedup, Ask-chat system prompt, Phase 32.1 best practices — ALL UNCHANGED)"
  artifacts:
    - path: CLAUDE.md
      provides: "Updated Concept Feed Generation Pipeline section reflecting Phase 36 closures"
      contains: "MAX_QUEUE_SIZE = 32"
  key_links:
    - from: "CLAUDE.md 'Concept Feed Generation Pipeline' section"
      to: "Plans 36-01, 36-02, 36-03 commit anchors"
      via: "doc reference"
      pattern: "Phase 36"
---

<objective>
Update CLAUDE.md's "Concept Feed Generation Pipeline" section to reflect what Phase 36 changed. Four specific edits:
1. Document `MAX_QUEUE_SIZE = 32` in "Numeric defaults" (closes GAP-6 — doc drift; the constant exists in `post-queue.service.ts:13` but was never documented).
2. Cross-reference `postQueueService.appendToDerivedList` from the "Update mode: APPEND-ONLY" line.
3. Update the "Removal trigger" line to describe the lazy-skip mechanism (via `walkDerivedList(count, exploredIds)`) rather than the never-implemented physical removal.
4. In "Known divergences from design", strike through (or remove) GAP-1, GAP-2, GAP-3, GAP-4 with a brief closure note. GAP-5 (queue serves variable count instead of strictly 4) and GAP-6 (MAX_QUEUE_SIZE doc) are addressed by this plan and the others; the rest of the list (no current items besides the closures) should reflect what's actually outstanding.

NO other CLAUDE.md section is touched. The Phase 32.1 / 33 / 35 load-bearing rules stay byte-stable.

Purpose: Make CLAUDE.md describe what the code DOES, not what it WAS. Phase 32.1 lesson #2: documentation must guard the LIVE code path; outdated docs mislead future agents.
Output: CLAUDE.md modified surgically in the "Concept Feed Generation Pipeline" section only.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@app/src/services/post-queue.service.ts
@app/src/services/concept-feed.service.ts
@.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update CLAUDE.md Concept Feed Generation Pipeline section to reflect Phase 36 closures</name>
  <files>CLAUDE.md</files>
  <read_first>
    - CLAUDE.md (the entire "Concept Feed Generation Pipeline" section — find it via `grep -n "Concept Feed Generation Pipeline" CLAUDE.md`. Read at least 80 lines from there to capture the full section including the diagram, Numeric defaults, Files, Known divergences, "When in doubt")
    - .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-RESEARCH.md (Pattern 1 wording — your "Removal trigger" rewrite should match RESEARCH's lazy-skip rationale)
    - app/src/services/post-queue.service.ts (verify MAX_QUEUE_SIZE = 32 still on line 13 in the constants block)
  </read_first>
  <behavior>
    - The Pipeline section is updated in-place; no other CLAUDE.md sections changed
    - The doc accurately reflects post-Phase-36 code state
    - Future agents who follow these rules implement consistent code (DO NOT DRIFT remains the principle)
  </behavior>
  <action>
Open CLAUDE.md. Locate the "Concept Feed Generation Pipeline" H2 section. Make the four targeted edits below; everywhere else in the file is byte-stable.

**EDIT 1 — Add MAX_QUEUE_SIZE = 32 to "Numeric defaults".** Find the bulleted list that starts with "Queue refill threshold: **12**" and add a new bullet directly above or below the threshold line:

```markdown
- Queue maximum size: **32** (`MAX_QUEUE_SIZE` in `post-queue.service.ts:13`). enqueueInterleaved + enqueue both cap at this size. Refill threshold (12) gives a 20-post runway between refills.
```

**EDIT 2 — Cross-reference appendToDerivedList in the diagram's "Update mode: APPEND-ONLY" line.** In the boxed diagram for list 2 (DERIVED LIST), find the line:
```
Update mode: APPEND-ONLY when new questions arrive. Don't rebuild
from scratch — that loses cycle position.
```
Add a parenthetical reference to the implementation. Result:
```
Update mode: APPEND-ONLY when new questions arrive. Don't rebuild
from scratch — that loses cycle position. Implemented as
postQueueService.appendToDerivedList(ids[]) — dedups by conceptId.
```
(Keep ASCII-art alignment intact — match the box-drawing-character widths.)

**EDIT 3 — Update the "Removal trigger" line to describe lazy skip.** In the same DERIVED LIST box, find:
```
Removal trigger: when user READS a post of a concept
(CONCEPT_EXPLORED event), REMOVE that concept's remaining entries
from the derived list so the next loop doesn't re-suggest it.
```
Replace with:
```
Removal trigger: when user READS a post of a concept
(CONCEPT_EXPLORED event), the concept is added to
dailyReadService.getExploredAnchors(). The walker
(postQueueService.walkDerivedList) LAZILY skips explored ids
at walk time rather than physically splicing the array
(which would corrupt cyclePosition — see RESEARCH § Pitfall 1).
```
Again preserve box-character widths.

**EDIT 4 — Strike GAP-1..4 from "Known divergences from design".** Find the bullet list under that heading. The existing list mentions:
- "Derived list is currently rebuilt every refill (not append-only with cycle position)." → CLOSED via Phase 36 GAP-1 + GAP-2 (postQueueService.appendToDerivedList + walkDerivedList).
- "Each concept gets at most 2 entries (1 + isImportant), not weighted by style mix." → PARTIAL: Phase 36 GAP-3 (assignStylesStratified largest-remainder) addresses style proportionality; per-concept multiplicity remains BASE_ENTRIES_PER_CONCEPT × 2-when-important per design.
- The "removal on read" line that was already CLOSED via Phase 33 — leave that closure note.
- "Queue serves variable count (whatever's available) instead of strictly 4 per swipe." → unchanged for now — this is a separate concern from Phase 36's scope.

Rewrite the section as:

```markdown
### Known divergences from design (gaps to close, not to drift further)

- ~~Derived list is currently rebuilt every refill (not append-only with cycle position).~~ **CLOSED via Phase 36 GAP-1 + GAP-2** (2026-05-06): postQueueService now persists `derivedList: string[]` + `cyclePosition: number` in QueueState. `appendToDerivedList(ids)` is dedup-on-append; `walkDerivedList(count, exploredIds)` is the cyclic walker with lazy skip of explored anchors. See `tests/services/derived-list.test.mjs` for the invariants.
- ~~Style sampling is i.i.d. per entry — small-N batches (N=8) routinely produce zero image / zero suggestion posts.~~ **CLOSED via Phase 36 GAP-3** (2026-05-06): assignStyles (now stratified via largest-remainder + Fisher-Yates) guarantees ±1 of round(N×weight) for every style every run. See `tests/services/style-assignment-stratified.test.mjs`.
- ~~Style-axis interleave only — same-anchor entries cluster regardless of style spread.~~ **CLOSED via Phase 36 GAP-4** (2026-05-06): refillQueue's enqueueInterleaved mixer now runs `spreadByConcept` BEFORE `spreadByStyle`, separating same-anchor entries before style refinement. See `tests/services/spread-by-concept.test.mjs`.
- Each concept gets BASE_ENTRIES_PER_CONCEPT (4) entries by default, doubled to 8 if important (easeFactor < 1.5 OR leafState ∈ {dying, falling, dead}). This intentional (per RESEARCH § Pitfall 4 — importance changes mid-day are accepted as a next-day approximation; design says "append-only when new questions arrive," not "rebuild importance weights continuously").
- ~~Removal on read is NOT wired~~ — **CLOSED via Phase 33 gap fix**: `buildConceptBatch` at `concept-feed.service.ts:659` filters out explored anchors, AND the daily generation cap is now gated by `allExplored` so it no longer fires while the vine is unfinished. **Phase 36 layered the lazy-skip walker on top** so explored anchors are also skipped at walk time even if they slip past the build-time filter.
- Queue serves variable count (whatever's available) instead of strictly 4 per swipe. (Out of scope for Phase 36.)
```

(The line numbers in the existing CLAUDE.md may have drifted since the section was last revised — preserve any that are correct, update any that are wrong by re-grepping the live code.)

**MUST NOT touch any other section.** Verify with `git diff CLAUDE.md` before commit:
- `git diff --stat CLAUDE.md` should show ONE file changed
- `git diff CLAUDE.md | head -3 | grep -c "Concept Feed Generation Pipeline\|Numeric defaults\|Update mode\|Removal trigger\|Known divergences"` should be > 0
- `git diff CLAUDE.md | grep -E "^[+-]" | grep -vE "^(\\+\\+\\+|---)" | wc -l` should be a small number (~30-50 lines added/removed) — anything larger means you wandered into other sections

**Verify post-edit:**
1. `grep -c "MAX_QUEUE_SIZE.*32" CLAUDE.md` returns >= 1
2. `grep -c "appendToDerivedList" CLAUDE.md` returns >= 1
3. `grep -c "walkDerivedList" CLAUDE.md` returns >= 1
4. `grep -c "Phase 36 GAP-1" CLAUDE.md` returns >= 1
5. `grep -c "Phase 36 GAP-3" CLAUDE.md` returns >= 1
6. `grep -c "Phase 36 GAP-4" CLAUDE.md` returns >= 1
7. None of the load-bearing rules in adjacent sections changed: pick a stable anchor sentence from each and confirm it's still byte-identical:
   - `grep -c "html, body { overflow: hidden } is load-bearing on BOTH axes" CLAUDE.md` returns 1
   - `grep -c "minWidth: 0" CLAUDE.md` returns >= 1
   - `grep -c "Never re-introduce dynamic content into the system prompt" CLAUDE.md` returns >= 1

**Commit message:** `docs(36-05): update CLAUDE.md Concept Feed Pipeline section — close GAP-1/2/3/4 + document MAX_QUEUE_SIZE (closes GAP-6)`
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn &amp;&amp; bash -c 'count=0; for pat in "MAX_QUEUE_SIZE.*32" "appendToDerivedList" "walkDerivedList" "Phase 36 GAP-1" "Phase 36 GAP-3" "Phase 36 GAP-4"; do n=$(grep -c "$pat" CLAUDE.md); if [ "$n" -ge 1 ]; then count=$((count+1)); fi; done; echo "checks_passed=$count/6"'</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "MAX_QUEUE_SIZE.*32" CLAUDE.md` returns >= 1 (GAP-6 doc fix landed)
    - `grep -c "postQueueService.appendToDerivedList" CLAUDE.md` returns >= 1 (cross-reference present)
    - `grep -c "walkDerivedList" CLAUDE.md` returns >= 1 (lazy-skip mechanism documented)
    - `grep -c "Phase 36 GAP-1" CLAUDE.md` returns >= 1 AND `grep -c "Phase 36 GAP-3" CLAUDE.md` returns >= 1 AND `grep -c "Phase 36 GAP-4" CLAUDE.md` returns >= 1 (closure annotations on Known divergences)
    - `grep -c "CLOSED via Phase 36" CLAUDE.md` returns >= 3 (one per gap)
    - Load-bearing rules in OTHER sections are byte-stable: ALL of these greps return >= 1: `grep -c "html, body { overflow: hidden }" CLAUDE.md`, `grep -c "minWidth: 0" CLAUDE.md`, `grep -c "Never re-introduce dynamic content into the system prompt" CLAUDE.md`, `grep -c "USER_ACK_BEFORE_GRAPH_CONTEXT" CLAUDE.md`, `grep -c "normalizeAnchorName" CLAUDE.md`, `grep -c "ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD" CLAUDE.md`
    - The diff is bounded — `git diff --shortstat CLAUDE.md` shows fewer than 100 lines changed total (modest surgical edit, not a rewrite)
    - `git diff CLAUDE.md` does NOT show any +/- lines outside the "Concept Feed Generation Pipeline" section (sanity-check by reading the diff hunks before commit)
  </acceptance_criteria>
  <done>CLAUDE.md Pipeline section reflects post-Phase-36 reality; MAX_QUEUE_SIZE=32 documented; GAP-1/3/4 struck through; lazy-skip described; no other section altered; single atomic commit lands.</done>
</task>

</tasks>

<verification>
Phase-level (after this plan):
- All four CLAUDE.md edits land in the Concept Feed Generation Pipeline section
- No other CLAUDE.md section is changed
- All load-bearing-rule sentinel greps still return >= 1
- Diff size is bounded (< 100 lines changed)
- Commit lands atomically
</verification>

<success_criteria>
Plan complete when:
- [ ] CLAUDE.md "Numeric defaults" includes MAX_QUEUE_SIZE = 32
- [ ] "Update mode: APPEND-ONLY" line references postQueueService.appendToDerivedList
- [ ] "Removal trigger" line describes lazy-skip via walkDerivedList + exploredIds
- [ ] "Known divergences from design" list strikes GAP-1, GAP-3, GAP-4 with closure annotations
- [ ] All other CLAUDE.md sections byte-stable (sentinel greps pass)
- [ ] Single atomic commit `docs(36-05): update CLAUDE.md Concept Feed Pipeline section — close GAP-1/2/3/4 + document MAX_QUEUE_SIZE (closes GAP-6)`
</success_criteria>

<output>
After completion, create `.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-05-SUMMARY.md` with:
- `git diff --shortstat CLAUDE.md` output (lines added/removed)
- All 6 sentinel grep results showing the new content landed
- All 6 byte-stability greps showing OTHER sections unchanged
- Git commit hash
</output>

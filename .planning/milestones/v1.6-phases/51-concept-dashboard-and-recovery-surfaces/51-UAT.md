---
status: complete
phase: 51-concept-dashboard-and-recovery-surfaces
source: [51-01-SUMMARY.md]
started: 2026-05-19T10:55:00Z
updated: 2026-05-19T13:10:00Z
---

## Current Test

(none — UAT complete)

## Tests

### 1. AnchorDetailScreen leaf-state badge renders
expected: |
  Below the anchor title (above the stats row), a small pill shows the leaf
  state with appropriate label + color. Dying = amber, falling = red, dead =
  muted, green/blossom/fruit = their respective colors.
result: pass
notes: |
  Initial run revealed 2 bugs (leaf-state stuck on bud + Anchor not found
  for old anchors). Both fixed in-session (commits a97fbbe9 + 4ccf83a7).
  Operator confirmed pass on retry: old anchors load and leaf states
  reflect actual review schedule.

### 2. Flashcards button morphs to "Review Now" for dying/falling/dead
expected: |
  Open an anchor whose leaf state is dying, falling, or dead (the badge from
  Test 1 confirms state). The existing primary "Flashcards" button changes
  its label to "Review Now" and its background to amber (dying) / red
  (falling) / muted (dead). When you open a healthy anchor (green/blossom/
  fruit), the button reverts to the normal Flashcards label + color.
result: blocked
blocked_by: prior-phase
reason: |
  No anchors in current data carry flashcards (anchorCardCount === 0 across
  the board). The morph behavior is structurally enforced by
  AnchorDetailScreen.recovery.test.mjs source tests (passing) and observable
  on a future device session once real flashcards exist. The operator-designed
  alternative for the no-flashcard recovery path (Learn-as-Post escalation)
  is now wired and IS observable on dead anchors today via commit 12a79c3e.

### 3. "Appears in" footer renders with counts
expected: |
  Scroll AnchorDetailScreen to the bottom (below the Q&A list). An "Appears
  in" footer is visible with up to three link-out rows:
    - "N saved posts" (count of saved posts whose source Q&As belong to this concept)
    - "N in collections" (count of this concept's posts that appear in any collection)
    - "N podcasts" (count of podcasts whose Q&A scope intersects this concept)
  Rows with count = 0 may be hidden or rendered as disabled.
result: pass
notes: |
  Initial run revealed Bug 4 (footer hidden across all anchors). Two
  rounds of fix:
    - Round 1 (commit 3a9eec57): conceptPosts filter now accepts both
      qa-children-ids AND anchor.id in sourceQuestionIds intersection.
      Only fixed video/news/concept-feed posts; missed discover posts.
    - Round 2 (commit 0d27547b): three-predicate matchesAnchor +
      saveDiscoverPost write-site fix + savedCount via getSavedPostIds
      raw-id list. Catches Learn-as-Post / replant posts whose
      sourceQuestionIds was empty.
  Operator confirmed footer now shows correct counts on retry.

### 4. Deep-link: "N saved posts" filter persists (CR-01 smoke)
expected: |
  From AnchorDetailScreen's "Appears in" footer, tap the "N saved posts" row.
  You land on SavedScreen. The "Saved" tab is selected and the concept filter
  chip is preselected with the anchor's name. The visible items are ONLY
  those whose source Q&A belongs to this concept — not the full saved list.
  This is the CR-01 fix smoke check (queueMicrotask deferral preserving the
  route-state filter through the [activeTab] reset effect).
result: pass
notes: |
  CR-01 fix confirmed working on device. The queueMicrotask deferral
  successfully preserves the route-state filter through React's
  [activeTab] reset effect tick ordering — a behavior the unit test
  suite enforces structurally but cannot exercise. Operator verified
  the chip is preselected, the Saved tab is active, and items are
  correctly filtered to the concept.

### 5. Deep-link: "N podcasts" → PodcastScreen filtered + Clear works
expected: |
  From AnchorDetailScreen's "Appears in" footer, tap the "N podcasts" row.
  You land on PodcastScreen with a banner above the podcast list reading
  "Filtered by {concept name} · Clear" (or equivalent). The visible podcasts
  are only those whose questionIds intersect this concept's Q&As. Tapping
  "Clear" in the banner removes the filter and shows all podcasts; the banner
  disappears.
result: pass
notes: |
  Route-state filter + clear banner verified on device. Confirms the
  PodcastScreen consume-state-then-clear pattern works correctly under
  React StrictMode + the new route-state handoff from AnchorDetailScreen.

### 6. Feed-tile concept badge tappable → AnchorDetailScreen
expected: |
  Open Home (feed view). On any feed tile (image, text-art, video, news,
  connection), find the small concept badge/pill (typically near the title
  or above it). Tap the badge — NOT the rest of the tile. You navigate
  directly to that concept's AnchorDetailScreen. Tapping the tile body
  (outside the badge) still opens the post detail as before.
result: pass
notes: |
  Confirmed: badge tap navigates to /anchor/:id without firing the tile
  body tap (e.stopPropagation works). Both navigation targets are
  reachable correctly.

### 7. Feed-tile concept badge amber dot only for dying/falling/dead
expected: |
  In Home feed, look at concept badges across multiple tiles. A small amber
  attention dot (~6px) appears INSIDE the badge ONLY when the concept's leaf
  state is dying, falling, or dead. Concepts in bud / green / blossom / fruit
  states have NO dot. Binary signal — no color variation across the recovery
  states; just present or absent. This is the operator-bounded "tile
  simplicity" rule (one signal, not a palette).
result: pass
notes: |
  Initial run had three failure modes on device:
    (1) Badge amber dot missing — fixed by passing fcMap to
        computeLeafState in InfoFlow + title fallback for legacy posts
        with empty sourceQuestionIds (commits b45321f3, 4d768b61).
    (2) Badge not tappable / no navigation — fixed alongside (1) via
        the same touch-action + WebkitTapHighlightColor tightening.
    (3) VineProgress dropdown items non-interactable on device — went
        through 7 attempts in this session (b45321f3 → b9cc9aa5),
        ultimately resolved by a follow-up agent. Handoff doc at
        .planning/phases/51-concept-dashboard-and-recovery-surfaces/BUG-6-HANDOFF.md
        captured the failed attempt chain so the next agent could
        bypass the dead ends. Operator confirmed dropdown now works
        AND that performance was enhanced by the follow-up agent.

### 8. PostDetailScreen contextLabel + connection pills tappable
expected: |
  Open any post detail screen.
    (a) Find the contextLabel line (typically "{concept} · {narrativeMode}"
        near the top metadata). Tap the concept word — you navigate to
        AnchorDetailScreen for that concept.
    (b) On a connection-type post (one that bridges two concepts), find the
        two concept pills (usually labelled with conceptNounA / conceptNounB).
        Tap either pill — you navigate to that concept's AnchorDetailScreen.
  Non-resolvable contextLabels (no anchor link) render as static text, not
  tappable.
result: pass
notes: |
  Part (a) — concept-anchor chip. Initial spec was misframed (assumed
  the contextLabel TEXT was the concept name — actually the LLM-generated
  contextLabel is content-type + tone like "Video · contrast"). Redesigned
  the deep-link as a tappable pill chip showing the concept anchor name,
  with the content-type/narrativeMode text demoted to static metadata
  beside it. Three sequential fixes needed on Capacitor:
    1. Semantic + UX: chip shows anchor name, not "VIDEO" (commit 3a4ee3a0).
    2. Async data loading: useEffect-based name resolution so the chip
       renders on device even when the question store loads after first
       paint (commit 9699094b). Also swapped color-mix() to rgba() for
       WebView version safety.
    3. Strict vs loose anchor resolution: chip's nav target uses
       resolveAnchorId (strict, isAnchorNode-validated) instead of
       getAnchorIdForPost (loose, falls back to sourceQuestionIds[0]
       which could be a Q&A leaf). Loose path was producing "Anchor not
       found" on device for posts whose parent walk failed (commit
       a427cf4c). Matches the working InfoFlow badge resolution pattern.
  Part (b) — connection pills: structurally tappable in code via the
  same resolveAnchorId path. Deferred verification: operator has no
  connection cards in current device data (require ≥2 anchors with
  enough semantic similarity for the LLM to generate a bridge). Code
  is unchanged from the original Phase 51-01 plan and was reviewed +
  passed CR-02. Mark pass on (a) only; (b) inherits via source-test
  parity with the same resolveAnchorId helper.

## Summary

total: 8
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 1
fixes_in_session: 9
  # Bug 1 — computeLeafState bud gate respects overdue children
  # Bug 2 — AnchorDetailScreen anchor lookup bypasses recent-50 cap
  # Bug 3 — purge stale fc-seed-* placeholder flashcards from existing installs
  # Bug 4 — Appears-in conceptPosts filter accepts qa-child-ids OR anchor.id (round 1 + 2)
  # Bug 5 — Feed-tile badge fcMap + title fallback (device-parity for amber dot + tap)
  # Bug 6 — VineProgress dropdown items use <button> + stopPropagation + touchAction (device-parity)
  # Gap B — SM-2 overdue penalty + large-gap reset (calcNextInterval)
  # Gap C — visual overdue cue (sort oldest-overdue + days-overdue badge + i18n)
  # Learn-as-Post escalation morph for dead / recovery-without-flashcards anchors

## Gaps

- truth: "Leaf-state badge reflects the actual concept state (dying/falling/dead/green/blossom/fruit, not stuck on bud)."
  status: failed
  reason: "User reported: 'Literally all anchors shows New badge, even though many of them has not been reviewed for weeks.'"
  severity: major
  test: 1
  root_cause: |
    `computeLeafState` (trellis-state.service.ts:55-60) bud gate fires whenever
    BOTH (a) anchorReviewCount === 0 AND lastReviewedAt is null/0, AND (b) no
    child Q&A has reviewCount > 0. For users who created Q&As but never
    generated flashcards (or never opened the Flashcards review flow), this
    condition is true forever — even when the Q&A's `reviewSchedule.nextReviewDate`
    is weeks overdue. The gate ignores nextReviewDate-based overdue-ness when
    reviewCount is 0.

    Pre-existing logic flaw, NOT a Phase 51 regression — same path runs
    on PlannerScreen's vine via buildTrellisState. Phase 51 surfaces it
    prominently by placing the badge on the primary concept page.
  artifacts:
    - app/src/services/trellis-state.service.ts:55-60
    - app/src/screens/AnchorDetailScreen.tsx:157
  missing:
    - "Overdue-driven leaf-state transition independent of reviewCount."
    - "Test fixture exercising 'Q&A overdue but never reviewed → dying/falling/dead'."

- truth: "AnchorDetailScreen opens for any existing anchor — old or recent."
  status: failed
  reason: "User reported: 'some old anchors cannot open anchor detail page, the detail page showed Anchor not found.'"
  severity: blocker
  test: (pre-Test-1 precondition; blocks Tests 1–5)
  root_cause: |
    AnchorDetailScreen.tsx:30,32 resolves the anchor via
    `useQuestions().getById(id)`. `useQuestions` loads via
    `questionService.getRecent(50)` (state/useQuestions.ts:59,79), so `getById`
    only searches the recent-50 questions. Anchors created earlier than
    the most-recent 50 questions return undefined → not-found branch
    renders `graph.anchor.notFound`.

    WR-04 fixed the SECONDARY undercount (qaChildren counts in the
    Appears-in footer) by switching to `questionService.getAll({ includeFlagged: true })`,
    but the PRIMARY anchor lookup itself still flows through the hook.
    Partial fix.

    Pre-existing latent bug — but Phase 51 introduced new navigation
    paths into AnchorDetailScreen (feed-tile badges, PostDetail
    contextLabel, PostDetail connection pills, Appears-in footer
    link-outs) that will silently fail when targeting old anchors.
    The phase's deep-link UX is gated by this.
  artifacts:
    - app/src/screens/AnchorDetailScreen.tsx:30-32
    - app/src/state/useQuestions.ts:47-79,406-411
  missing:
    - "Anchor lookup that bypasses the recent-50 cap (mirroring WR-04 for qaChildren)."
    - "Test fixture exercising 'navigate to old anchor → screen loads, not Anchor not found'."

  related_finding: "Compare InfoFlow.tsx:39 — that file already switched to questionService.getAll for the same recent-50 undercount reason. AnchorDetailScreen needs the same treatment for the primary lookup."
  status_after_fix: resolved
  fix_commit: a97fbbe9

- truth: "Stale fc-seed-* placeholder flashcards (dialectical materialism, quantum entanglement, etc.) do not appear on the device of any user — fresh install OR existing install carrying pre-Phase-38-04 data."
  status: failed
  reason: "User reported via /gsd:verify-work: 'The flashcard showed 5 due today, and all 5 are default placeholders like What is dialectical materialism?. I explicitly asked to DELETE those placeholders before, and they are not actually deleted!' Clarified: the prior delegated ask was to remove them from SOURCE so no user would ever see them."
  severity: major
  test: (out-of-scope for Phase 51, surfaced incidentally during Test 2 setup)
  root_cause: |
    Phase 38-04 (commit 8829a68c, 2026-05-09) deleted `makeSeedCards`
    from flashcard.service.ts so new installs start with `[]`, but
    shipped no migration for existing installs whose `trellis_flashcards`
    localStorage already held the 5 seed records. Stable ids
    fc-seed-1..fc-seed-5 + sessionId='seed' + nextReviewDate='today'
    meant the placeholders showed as "5 due today" forever.
  artifacts:
    - app/src/services/flashcard.service.ts (loadAll — now includes purgeStaleSeedCards migration)
    - app/tests/services/flashcard-seed-purge.test.mjs (new, 6 tests)
  missing: []
  status_after_fix: resolved
  fix_commit: c55e4cba

# Secondary observation (informational, not blocking Phase 51):
# "Why no flashcards due today from real Q&As" — flashcards are LLM-extracted
# only via flashcardService.processSession on chat-session inactivation
# (AskScreen.tsx:154,198,470). No automatic Q&A → flashcard projection runs
# today (the canonical-knowledge.service.ts getDueProjectedFlashcards path
# exists but is dead code with no production consumer). If user hasn't been
# asking new questions in Ask, no new flashcards generate. Filed as future
# product question rather than a phase-blocking bug.

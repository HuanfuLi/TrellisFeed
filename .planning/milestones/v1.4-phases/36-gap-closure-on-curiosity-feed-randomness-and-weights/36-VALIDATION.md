---
phase: 36
slug: gap-closure-on-curiosity-feed-randomness-and-weights
status: passed
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-06
updated: 2026-05-06
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `36-RESEARCH.md` § Validation Architecture.
> Audited 2026-05-06 — see § Validation Audit at the bottom.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` with esbuild tsx loader |
| **Config file** | none — see `app/package.json` `"test"` script |
| **Quick run command** | `cd app && node --test tests/services/derived-list.test.mjs tests/services/style-assignment-stratified.test.mjs tests/services/spread-by-concept.test.mjs tests/services/refill-queue-integration.test.mjs tests/services/style-assignment.test.mjs tests/services/post-queue.test.mjs` |
| **Full suite command** | `cd app && npm test` |
| **Estimated runtime** | ~6 seconds (quick — 53 tests), ~60 seconds (full — 448 tests) |

---

## Sampling Rate

- **After every task commit:** Run quick command above
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 6 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 36-W0-01 | 36-00 | 0 | GAP-1 / GAP-2 / REGRESSION | unit (10 tests) | `node --test tests/services/derived-list.test.mjs` | ✅ | ✅ green |
| 36-W0-02 | 36-00 | 0 | GAP-3 | unit (10 tests) | `node --test tests/services/style-assignment-stratified.test.mjs` | ✅ | ✅ green |
| 36-W0-03 | 36-00 | 0 | GAP-4 | unit (7 tests) | `node --test tests/services/spread-by-concept.test.mjs` | ✅ | ✅ green |
| 36-01-01 | 36-01 | 1 | GAP-3 | unit (flips W0-02 GREEN) | `node --test tests/services/style-assignment-stratified.test.mjs` | ✅ | ✅ green |
| 36-02-01 | 36-02 | 1 | GAP-4 | unit (flips W0-03 GREEN) | `node --test tests/services/spread-by-concept.test.mjs` | ✅ | ✅ green |
| 36-03-01 | 36-03 | 2 | GAP-1 / GAP-2 | unit (flips W0-01 GREEN) | `node --test tests/services/derived-list.test.mjs` | ✅ | ✅ green |
| 36-04-01 | 36-04 | 3 | GAP-1..4 (integration) | integration (6 tests) | `node --test tests/services/refill-queue-integration.test.mjs` | ✅ | ✅ green |
| 36-05-01 | 36-05 | 3 | GAP-6 (doc drift) | grep contract | `grep -q "MAX_QUEUE_SIZE.*32" CLAUDE.md && grep -q "postQueueService.appendToDerivedList" CLAUDE.md && grep -q "walkDerivedList" CLAUDE.md && grep -q "Queue serves variable count" CLAUDE.md` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Coverage rollup (post-execution):** 53 Phase 36 tests across 4 new + 2 unchanged files; 53/53 pass; full `npm test` baseline preserved at 422 pass / 26 pre-existing fail (unrelated JSON-import-attribute issues with `locales/en.json`).

---

## Wave 0 Requirements

- [x] `app/tests/services/derived-list.test.mjs` — covers GAP-1 (append-only, persistence, reset, migration), GAP-2 (walker advances, wraps, lazy-skip explored, returns empty when all explored), REGRESSION (important anchors get 2× entries — Test 10 enforces multiplicity preservation, blocker fix from checker iteration 1)
- [x] `app/tests/services/style-assignment-stratified.test.mjs` — covers GAP-3 (round(N×w) ±1 per style across 50-run invariant; small-batch text-art floor; image/suggestion present in 8-entry batches; respects API-availability redistribution BEFORE stratification; Fisher-Yates produces different orders across runs)
- [x] `app/tests/services/spread-by-concept.test.mjs` — covers GAP-4 (no same-concept-adjacent when 2+ concepts; single-concept input unchanged; combined with spreadByStyle preserves both invariants; dominant-bucket 6-of-8 case verifies two-branch placement keeps max-run ≤ 2)

*All three were NEW files in Wave 0 (RED) and flipped GREEN in Waves 1+2. Existing test files (`style-assignment.test.mjs`, `post-queue.test.mjs`, `concept-batch-filter.test.mjs`, `concept-feed-cross-cycle-dedup.test.mjs`) provide regression coverage and continue to pass.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Feed feels varied across 4-post swipes after fix | GAP-3, GAP-4 (subjective UX) | Distribution feel is judgmental, not assertable in unit tests beyond the ±1 / no-adjacent invariants already covered | After install: open app, swipe-for-more 5×, observe — image/news/video/short should each appear at least once across the 20 posts; same concept should not appear in 2 of any 4 consecutive posts when ≥2 concepts are due |
| No regression in image pre-gen + downgrade flow | (already-correct invariant from Phase 31) | Async + provider-dependent | After install with image-gen key: trigger refill; check devtools for `[refillQueue] pre-generating N image(s)` log + no `downgraded` post-render fallback in InfoFlow |
| GAP-6 doc-sync grep contract | GAP-6 | Documentation grep is a structural assertion, not a behavioral test — covered as a grep-AC in Plan 36-05 and verified by `36-VERIFICATION.md` must-have #8 | The 4-grep contract above (Per-Task row 36-05-01) functions as a CI sentinel; if CLAUDE.md drift removes any of those strings, future doc-syncs must fail-loud |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING test references
- [x] No watch-mode flags
- [x] Feedback latency < 10s (~6s quick)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-06

---

## Validation Audit 2026-05-06

| Metric | Count |
|--------|-------|
| Tasks audited | 8 |
| COVERED | 8 |
| PARTIAL | 0 |
| MISSING | 0 |
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Tests in Phase 36 quick run | 53 |
| Tests passing | 53 |
| Tests failing | 0 |
| Pre-existing baseline failures (unrelated) | 26 (JSON-import-attribute on `locales/en.json`) |

**Audit method:**
1. Cross-referenced each task in Per-Task Map against existing test files via `node --test` quick run.
2. Verified GAP-6 doc-sync grep contract (4 strings present in CLAUDE.md, including the preserved "Queue serves variable count" line that documents out-of-scope GAP-5).
3. Confirmed `36-VERIFICATION.md` reports 13/13 must-haves passed independently.

**Auditor:** main-session orchestrator (no `gsd-nyquist-auditor` spawn needed — zero gaps).

**Notes:**
- GAP-5 (variable-count vs strict-4 per swipe) is intentionally out of scope; the only caller (`infiniteScrollService.loadNextBatch`) passes the default 4. No test added because there's no gap to close — the loose contract is empirically tight.
- The `concept-batch-filter.test.mjs` "pending-ID predicate" mismatch flagged in RESEARCH § Open Question 2 is not a Phase 36 gap (the test still validates valid logical properties of the filter; alignment with the live contract was deferred to a future cleanup phase per RESEARCH recommendation).

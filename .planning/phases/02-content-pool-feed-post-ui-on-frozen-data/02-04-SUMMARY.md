---
phase: 02-content-pool-feed-post-ui-on-frozen-data
plan: 04
subsystem: content-pipeline
tags: [review-ui, immutable-freeze, content-pool, provenance, sha256]
requires:
  - phase: 02-03
    provides: AI preprocessing and content-hash-bound Codex advisory gate
provides:
  - Loopback-only operator review with append-only approve, needs-edit, and reject decisions
  - Immutable checksum-verified pilot content pool with 77 approved posts
  - Approval audit records and fixed source assets for every frozen post
affects: [02-09, frozen-content-packaging, phase-3-ranking]
tech-stack:
  added: []
  patterns: [operator-is-gate-of-record, content-hash-bound-approval, atomic-immutable-freeze]
key-files:
  created:
    - data/content_pool_v1/manifest.json
    - data/content_pool_v1/posts.json
    - data/content_pool_v1/review_logs/approval-audit.json
  modified:
    - tools/content_pipeline/src/review/store.ts
    - tools/content_pipeline/src/review/ui/review.ts
    - tools/content_pipeline/src/freeze/build.ts
key-decisions:
  - "The operator accepted 77 approved posts as sufficient for the pilot; 80 is not a hard freeze threshold."
  - "Per-candidate editorial review records only approve, needs-edit, reject, and optional notes; platform/rights policy is handled separately at batch/content-type level."
patterns-established:
  - "Every approval is bound to the current candidate content hash and current Codex advisory hash."
  - "Frozen output is atomically promoted, checksum-addressed, independently verifiable, and overwrite-refusing."
requirements-completed: [CONT-02, CONT-03]
coverage:
  - id: D1
    description: Secure loopback-only review UI records simple operator decisions without AI auto-approval.
    requirement: CONT-02
    verification:
      - kind: integration
        ref: tools/content_pipeline/test/review.test.mjs
        status: pass
    human_judgment: false
  - id: D2
    description: Immutable deterministic freezer rejects stale approvals, tampering, unsafe paths, and overwrite attempts.
    requirement: CONT-03
    verification:
      - kind: integration
        ref: tools/content_pipeline/test/freeze.test.mjs
        status: pass
      - kind: other
        ref: npm run cli -- freeze --output ../../data/content_pool_v1 --verify-only
        status: pass
    human_judgment: false
  - id: D3
    description: Operator reviewed all 82 candidates and froze the 77 approved records into the real pilot pool.
    requirement: CONT-03
    verification:
      - kind: manual_procedural
        ref: tools/content_pipeline/runs/pilot-v1-20260716/review/decisions.jsonl and data/content_pool_v1/review_logs/approval-audit.json
        status: pass
    human_judgment: false
duration: multi-session
completed: 2026-07-17
status: complete
---

# Phase 02 Plan 04: Human Review and Immutable Freeze Summary

**A loopback-only operator workflow produced the immutable `pilot-v1-20260717` pool with 77 approved, checksum-verified posts and matching source/audit records.**

## Performance

- **Duration:** Multi-session curation and review
- **Started:** 2026-07-11
- **Completed:** 2026-07-17
- **Tasks:** 3/3
- **Frozen files:** 86 manifest-tracked files plus manifest

## Accomplishments

- Implemented and hardened the local review server, inert review UI, append-only decision log, and content-hash/Codex freshness gates.
- Reviewed all 82 formal candidates: 77 approved, 4 rejected, and 1 needs edit; only the 77 final approvals entered the pool.
- Atomically froze and independently verified 77 posts, 77 source assets, 77 source files, and 77 approval audit records under version `pilot-v1-20260717`.

## Task Commits

1. **Task 1: Build the local review application** — `9521cda`, `542729a` plus follow-up hardening in `4b8cb9d`
2. **Task 2: Implement immutable freeze and verification** — `db45590` plus final contract alignment in `4b8cb9d`
3. **Task 3: Curate, review, and freeze the pilot artifact** — `4b8cb9d`

## Files Created/Modified

- `data/content_pool_v1/manifest.json` — immutable version, counts, fixed filenames, and bundle hashes.
- `data/content_pool_v1/{posts,concepts,claims,suggested_questions,source_assets}.json` — approved runtime records.
- `data/content_pool_v1/source_files/` — one inert article body or reviewed video digest per frozen post.
- `data/content_pool_v1/review_logs/approval-audit.json` — final hash-bound approval audit.
- `tools/content_pipeline/src/review/` — local review server, decision store, and simplified review workspace.
- `tools/content_pipeline/src/freeze/` — atomic freezer and independent verifier.

## Decisions Made

- The operator explicitly accepted 77 posts as sufficient and declined further collection.
- Editorial review was simplified to three dispositions plus optional notes. Rights/platform policy was removed from the repeated per-item form and retained as a separate batch/content-type concern; the system does not imply individual permission was obtained.
- Preprocessing scores remain the canonical frozen quality/interest/education/difficulty values instead of requiring the operator to retype them.

## Deviations from Plan

### Operator-authorized changes

1. **Simplified the formal review record**
   - **Issue:** The planned per-item rubric, scores, reviewer identity, and rights fields made an 82-item review needlessly repetitive.
   - **Resolution:** At the operator's direction, retained only approve, needs-edit, reject, and optional notes while preserving automatic content-hash and Codex-freshness checks.
   - **Verification:** Review tests and TypeScript build passed; every candidate received a final decision.

2. **Accepted the actual calibrated pool size and mix**
   - **Issue:** The plan estimated 100–150 raw candidates, approximately 50 approvals, and a roughly 70/30 text/video mix.
   - **Resolution:** The operator approved the actual 82-candidate run and froze 77 posts: 51 text/social/article records and 26 videos (approximately 66/34).
   - **Verification:** Manifest counts, feed order, source assets/files, and approval audits all equal 77.

**Total deviations:** 2 operator-authorized scope calibrations.
**Impact on plan:** The immutable participant artifact and two-gate integrity remain intact; no rejected or needs-edit candidate was frozen.

## Issues Encountered

- Earlier candidate batches contained shallow landing pages, abstracts, truncated social embeds, and overlong videos. The pool was recollected and calibrated before the formal 82-item run.
- The former review UI expired quickly and exposed excessive fields. Its session was extended to eight hours and the decision surface simplified before final review.

## User Setup Required

None. Provider credentials remain local pipeline configuration and are not included in the frozen pool.

## Next Phase Readiness

- Plan 02-09 can package `data/content_pool_v1` into the app and bind the production reader.
- The frozen directory is immutable; corrections require a new content-pool version rather than editing `pilot-v1-20260717`.

---
*Phase: 02-content-pool-feed-post-ui-on-frozen-data*
*Completed: 2026-07-17*

---
phase: 02-content-pool-feed-post-ui-on-frozen-data
plan: 02
subsystem: content-collection
tags: [typescript, ssrf, jsdom, readability, dedupe, quality-gates]
requires:
  - phase: 02-content-pool-feed-post-ui-on-frozen-data
    provides: strict content records, frozen-pool schemas, and pipeline test harness
provides:
  - Operator-only curated URL-list collector with public-network and bounded-fetch enforcement
  - Inert article and injected YouTube transcript extraction with normalized source artifacts
  - Deterministic evidence-preserving dedupe and mechanical human-review quality signals
affects: [02-ai-preprocessing, 02-human-review, 02-content-freeze]
tech-stack:
  added: ["@mozilla/readability@0.6.0", "jsdom@29.1.1"]
  patterns: [injected network/process seams, fail-closed acquisition, inert structured text, advisory-only mechanical gates]
key-files:
  created: [tools/content_pipeline/src/cli.ts, tools/content_pipeline/src/collect/fetch-candidate.ts, tools/content_pipeline/src/extract/article.ts, tools/content_pipeline/src/dedupe/index.ts, tools/content_pipeline/src/quality/index.ts]
  modified: [tools/content_pipeline/package.json, tools/content_pipeline/package-lock.json, tools/content_pipeline/test/collector.test.mjs]
key-decisions:
  - "Collection accepts only operator-authored URL lists and revalidates public destinations at every redirect; it never discovers sources or runs in the participant app."
  - "Article and transcript outputs retain full normalized plain text and stable blocks, while active markup, resource loading, and implicit subprocess acquisition remain outside the artifact boundary."
  - "Dedupe and mechanical scoring preserve all evidence and can reject or prioritize review, but only a human reviewer can approve content."
patterns-established:
  - "Acquisition seam: DNS, transport, transcript, time, and logging behavior are injected for deterministic offline tests."
  - "Review boundary: automated front-half stages emit reason-coded evidence without an approval field."
requirements-completed: [CONT-02]
coverage:
  - id: D1
    description: Secure bounded operator URL-list collection for pilot and later-study candidate ranges
    requirement: CONT-02
    verification:
      - kind: integration
        ref: "tools/content_pipeline/test/collector.test.mjs#URL policy, redirect, bounds, dry-run, resume, and 800-candidate tests"
        status: pass
      - kind: other
        ref: "node src/cli.ts collect --seeds test/fixtures/dry-run-seeds.json --run-dir test/.dry-run-verification --dry-run"
        status: pass
    human_judgment: false
  - id: D2
    description: Inert article and explicitly configured YouTube transcript extraction with stable normalized artifacts
    requirement: CONT-02
    verification:
      - kind: integration
        ref: "tools/content_pipeline/test/collector.test.mjs#extract dependencies, hostile XSS article, and YouTube transcript tests"
        status: pass
    human_judgment: false
  - id: D3
    description: Deterministic evidence-preserving dedupe and reason-coded mechanical quality gates
    requirement: CONT-02
    verification:
      - kind: unit
        ref: "tools/content_pipeline/test/dedupe.test.mjs"
        status: pass
      - kind: unit
        ref: "tools/content_pipeline/test/quality.test.mjs"
        status: pass
    human_judgment: false
duration: 10min
completed: 2026-07-11
status: complete
---

# Phase 02 Plan 02: Secure Offline Collection Front Half Summary

**A curated-list-only collector now produces bounded inert article/video candidates with deterministic duplicate groups and advisory mechanical review signals.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-11T20:30:40Z
- **Completed:** 2026-07-11T20:40:50Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- Added a resumable operator CLI for the locked 100–150 candidate pilot profile and explicit later-topic runs up to 800, with SSRF, redirect, MIME, byte, timeout, path, and secret controls.
- Added inert Readability article extraction and canonical YouTube ID handling through an injected adapter or operator transcript file, producing stable normalized plain-text blocks and hashes.
- Added order-independent exact/near duplicate grouping and reason-coded mechanical quality verdicts that preserve evidence and never grant final approval.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement the seed-list CLI and SSRF-resistant collector** - `ddddb55` (feat)
2. **Task 2: Extract and normalize inert article/video candidates** - `1df9f08` (feat)
3. **Task 3: Add deterministic dedupe and mechanical quality gates** - `ccfdccb` (feat)

## Files Created/Modified

- `tools/content_pipeline/src/cli.ts` - Curated seed-list parsing, pilot/study caps, dry-run reporting, resumable safe artifacts, and constrained output paths.
- `tools/content_pipeline/src/collect/url-policy.ts` - Public HTTP(S)-only DNS/IP validation.
- `tools/content_pipeline/src/collect/fetch-candidate.ts` - Per-hop validation and bounded injected transport.
- `tools/content_pipeline/src/extract/article.ts` - Resource-free inert DOM cleanup and plain structured Readability extraction.
- `tools/content_pipeline/src/extract/youtube.ts` - Canonical video ID parser and injected/operator transcript extraction.
- `tools/content_pipeline/src/normalize/candidate.ts` - Canonical URL/date/language/duration normalization, stable blocks, attribution, and content hashes.
- `tools/content_pipeline/src/dedupe/index.ts` - Bounded deterministic exact and shingle-similarity grouping.
- `tools/content_pipeline/src/quality/index.ts` - Mechanical extraction, URL, language, date, transcript, relevance, and concentration signals.
- `tools/content_pipeline/test/collector.test.mjs` - Offline SSRF, bounds, path, secret, dependency, XSS, extraction, and transcript verification.
- `tools/content_pipeline/test/dedupe.test.mjs` - Order-independent evidence-preserving duplicate group tests.
- `tools/content_pipeline/test/quality.test.mjs` - Evergreen, dated, promotional, short, concentration, and approval-boundary tests.

## Decisions Made

- Kept acquisition entirely operator-side and seed-list-driven; no search/discovery or participant runtime capability was introduced.
- Required transcript acquisition to arrive through an injected adapter or operator-supplied text, with no implicit `yt-dlp` download or shell interpolation.
- Returned all dedupe component IDs and `requiresHumanReview: true`; quality dispositions are limited to `reject`, `review-priority`, or `review`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Execution resumed after a quota interruption with Task 1 already committed and Task 2 safely staged. The staged files were inspected, verified, and committed without resetting, duplicating, or recommitting Task 1.

## User Setup Required

None - no external service configuration required.

## Test Results

- `npm --prefix tools/content_pipeline test` - 40/40 passed.
- `npm --prefix tools/content_pipeline run build` - passed.
- Task 2 focused extraction/XSS/YouTube command - 11/11 collector tests passed under Node's test runner.
- Task 3 focused dedupe/quality command - 5/5 passed.
- Fixture `collect --dry-run` - passed with two stable candidates and no network/process calls.

## Next Phase Readiness

- Plan 02-03 can consume normalized full-text blocks, provenance hashes, duplicate groups, and advisory quality signals for AI preprocessing and review.
- No blocker remains; actual source selection and final acceptance stay operator-owned as required.

## Self-Check: PASSED

---
*Phase: 02-content-pool-feed-post-ui-on-frozen-data*
*Completed: 2026-07-11*

# Phase 2 Content Calibration Status

Updated: 2026-07-17 (America/Indianapolis)

## Operator decisions received

- Batch v2: 82 reviewed — 60 keep, 18 reject, 4 unsure.
- Batch v3: 34 reviewed — 23 keep, 9 reject, 2 unsure.
- The exported v3 operator record is `candidate-calibration-decisions (1).json`.
- Batch v4: 9 reviewed — 7 keep, 2 reject, 0 unsure.
- The exported v4 operator record is `candidate-calibration-decisions (2).json`.
- Eight operator-kept v2 items are excluded from the current eligible count because the source is a post/article published before the locked 2025-07-16 recency cutoff.

## Final calibrated pilot

- Explicitly kept and mechanically eligible before formal review: **82**.
- Formal operator-approved and frozen: **77**.
- The operator accepted 77 as sufficient for this pilot; 80 is no longer a hard freeze threshold.
- Additional collection required: **0**.
- Unsure items do not count as approvals and cannot pass the freeze gate.

Final eligible mix:

- 30 YouTube videos
- 25 X posts
- 13 Reddit discussions
- 5 articles
- 5 papers
- 4 reports

## Final incremental calibration batch

- Raw candidates considered: 10.
- Mechanically accepted for operator calibration: 9 (6 Reddit, 3 X).
- Mechanically rejected: 1 duplicate URL.
- Maximum eligible pool after this batch: 84.
- Seed: `tools/content_pipeline/seeds/ai-agents-future-work-v4-increment.json`.
- Validation report: `.planning/tmp/candidate-batch4-validation.json`.
- Operator decisions: `.planning/tmp/candidate-batch4-decisions.json`.

## Formal pipeline status

- Approved seed: `tools/content_pipeline/seeds/ai-agents-future-work-approved.json`.
- Reconciliation report: `.planning/tmp/calibration-reconciliation.json`.
- Formal run: `tools/content_pipeline/runs/pilot-v1-20260716`.
- Collection: 82/82 collected.
- Normalization: 82/82 normalized with full text for text sources and fixed official YouTube URLs for videos.
- Gemini preprocessing: 82/82 completed, 0 failures; no transcript, audio, or video bytes persisted.
- Gemini/Codex repair loop: 71 wrappers revised overall; 14 required a second revision.
- Final Codex advisory: 82/82 advance to human review, 0 blocked, 0 rejected.
- Formal operator review: 82/82 decided — 77 approved, 4 rejected, 1 needs edit.
- Frozen pool: `data/content_pool_v1/`, immutable version `pilot-v1-20260717`.
- Freeze verification: valid; 77 posts, 77 source assets, 77 source files, and 77 approval audit records.

## Locked curation and display feedback

- Reddit candidates must have a standalone substantive OP (at least 80 meaningful words in the final batch).
- Reddit discussion rendering must preserve speaker attribution and comment boundaries. When public Reddit JSON is unavailable, show the attributed OP only and send reviewers/users to the explicit original URL for replies; never flatten multiple speakers into one block.
- X long posts must not be represented by a truncated oEmbed excerpt. The final batch stores a full-text review snapshot from the public FxTwitter mirror only after its opening text matches X's official oEmbed; the X URL remains the canonical source.
- Obvious advertisements, course funnels, product promotions, synthetic-looking videos, repetitive presentation formats, and context-poor excerpts are rejected.
- Videos should normally be 2–10 minutes and must not exceed 20 minutes.
- The participant-facing freeze requires preprocessing, a current Codex advisory verdict, and an explicit operator decision bound to the final content hash. Platform and rights policy is handled separately at the batch/content-type level, not as a repeated per-candidate form.

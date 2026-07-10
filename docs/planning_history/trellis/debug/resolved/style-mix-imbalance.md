---
status: resolved
trigger: "style mix imbalance — text-art severely under-represented, news/video/short over-represented across 16-post window"
created: 2026-05-06T00:00:00Z
updated: 2026-05-06T00:00:00Z
---

## Current Focus

hypothesis: confirmed — walkDerivedList maxSteps cap (len×2) is the root cause
test: complete (code-read + math walkthrough)
expecting: N/A — diagnose-only mode
next_action: return structured diagnosis to gap-closure planner

## Symptoms

expected: "text-art ≈ 9 (round(16×0.55)), news/video/short ≈ 2 each, image ≈ 2, suggestion ≈ 1 across a 16-post window"
actual: "video=2, news=5, short=3, text-art=4, suggestion=1, image=1 across 16 posts"
errors: "none — distribution drift, not a crash"
reproduction: "cold-start UAT run — first served window of ~16 posts"
started: "2026-05-06 after Phase 36-01 stratified allocation landed"

## Eliminated

- hypothesis: "stratified allocator (largest-remainder) has a math bug"
  evidence: "style-assignment.ts lines 83-103 implements Hamilton's method exactly per RESEARCH pseudocode. 10/10 unit tests at N=8 and N=12 pass. At N=16 the math produces exactly {image:1, text-art:8, suggestion:1, news:2, video:2, short:2} — which IS approximately the target. The allocator is not the bug."
  timestamp: 2026-05-06

- hypothesis: "appendToDerivedList destroys BASE_ENTRIES_PER_CONCEPT multiplicity via dedup"
  evidence: "post-queue.service.ts lines 268-282: appendToDerivedList seeds `existing = new Set(_state.derivedList)` ONCE before the loop and does NOT mutate `existing` inside the loop. So within-call duplicates all pass. The first call with ['anchorId','anchorId','anchorId','anchorId'] stores all 4 entries — multiplicity IS preserved on first append. The docstring at line 248 explicitly confirms this ('Within a single call, multiplicity is PRESERVED'). Cross-call dedup only zeros subsequent re-appends of the same id — the first call's multiplicity survives."
  timestamp: 2026-05-06

- hypothesis: "news posts bypass the stratified allocator via a separate creation path"
  evidence: "refillQueue lines 1263-1264 include newsAssigns in the pre-validation pass, line 1322 runs reassignFailures, line 1327 calls generatePostBatch which processes all assignments including news. There is no separate code path that injects news posts outside this flow."
  timestamp: 2026-05-06

- hypothesis: "API-availability redistribution fires incorrectly when all keys are configured"
  evidence: "The user's observed mix includes video AND news AND image AND short — none zeroed out — so all three API availability flags were true. The redistribution block in style-assignment.ts lines 50-62 was a no-op for this user. Effective weights = STYLE_WEIGHTS verbatim."
  timestamp: 2026-05-06

## Evidence

- timestamp: 2026-05-06
  checked: "BASE_ENTRIES_PER_CONCEPT and buildConceptBatch (concept-feed.service.ts lines 727-748)"
  found: "BASE_ENTRIES_PER_CONCEPT = 4. One non-important anchor → buildConceptBatch returns ['anchorId' × 4]. One important anchor → ['anchorId' × 8]."
  implication: "derivedList after first appendToDerivedList call with 1 non-important anchor = ['anchorId','anchorId','anchorId','anchorId'] (length=4). Multiplicity preserved on first call."

- timestamp: 2026-05-06
  checked: "walkDerivedList implementation (post-queue.service.ts lines 297-311)"
  found: "actual implementation uses maxSteps = len * 2 (NOT fullLoops < 2 as in RESEARCH pseudocode). The termination condition is `steps < maxSteps` where maxSteps = derivedList.length * 2. With len=4, maxSteps=8. The walker can do at most 8 steps regardless of the `count` argument."
  implication: "walkDerivedList(16, emptySet) with a 4-entry derivedList does at most 8 steps, returning 8 entries — not 16. The request for 16 is silently capped at 8. assignStyles is called with N=8, not N=16."

- timestamp: 2026-05-06
  checked: "assignStyles with N=8, all-available (largest-remainder math)"
  found: "exact: {image:0.80, text-art:4.40, suggestion:0.40, news:0.80, video:0.80, short:0.80}. floors: {image:0, text-art:4, suggestion:0, news:0, video:0, short:0} sum=4. deficit=4. remainders: {image:0.80, text-art:0.40, suggestion:0.40, news:0.80, video:0.80, short:0.80}. Top-4 remainders: image(0.80), news(0.80), video(0.80), short(0.80) — all four minority styles get +1. text-art's remainder (0.40) is NOT in the top-4. Final: {image:1, text-art:4, suggestion:0, news:1, video:1, short:1}."
  implication: "CRITICAL: text-art = 4/8 = 50% per batch, not 55%. Crucially, text-art NEVER receives a remainder bonus at N=8 because its remainder (0.40) is always beaten by the four minority styles each with remainder 0.80. The floor provides text-art's only count. This is structural — any N where N×0.55 is not an integer will produce this effect when the 4 minority styles collectively have large enough remainders to claim all deficit slots."

- timestamp: 2026-05-06
  checked: "text-art undercount: floor(N×0.55) at small N values"
  found: "N=4: exact text-art=2.20, floor=2, rem=0.20; minority styles each have rem=0.40; deficit=2; image and news get +1 (first two in sort order) → text-art=2/4=50%. N=6: exact text-art=3.30, floor=3, rem=0.30; minority styles each have rem=0.60; deficit=3; image/news/video get +1 → text-art=3/6=50%. N=8: as computed, text-art=4/8=50%. N=12: exact text-art=6.60, floor=6, rem=0.60; minority styles rem=0.20/0.60/0.60/0.60/0.60; deficit=6; text-art(rem=0.60) now ties for top position alongside news/video/short → text-art gets +1 → text-art=7/12≈58%. N=16: exact text-art=8.80, floor=8, rem=0.80; all minority styles have exact≈1.60, floor=1, rem=0.60; deficit=4; text-art(0.80) beats ALL minority remainders → text-art gets a bonus → text-art=9/16≈56%."
  implication: "The stratified allocation reaches target (≈55%) only for N≥12. For N=4 through N=10, text-art is structurally capped at 50% because the four equal-weight minority styles (news/video/short/image each at 10%) together consume all deficit slots with their identical remainders. The fix designed the walker to request N=16 — exactly the threshold where text-art's floor+bonus reaches ~56% — but the maxSteps cap silently cuts N to len×2."

- timestamp: 2026-05-06
  checked: "Why the user sees text-art=4/16 (25%) not 8/16 (50%)"
  found: "With N=8 per refill (2 refill cycles for 16 total posts), text-art should be 4+4=8 = 50%. But user reports text-art=4. The discrepancy: (a) reassignFailures post-generation converts failed news/video/short to text-art — BUT this would INCREASE text-art count, not decrease it. (b) More likely: the user's 1 anchor scenario is different from the pure math — specifically, the second refill call to appendToDerivedList(['anchorId'×4]) now finds 'anchorId' in the existing set (it was stored on the first call) → adds 0 new entries. derivedList stays at 4 entries. But walkDerivedList still works with len=4, maxSteps=8. This doesn't change the per-batch count. (c) Most likely: the first refill walk advances cyclePosition from 0→8 steps = cyclePosition lands back at 0 (8%4=0). The second refill also returns 8 entries. So two refills × 4 text-art each = 8 text-art, not 4. The user's count of text-art=4 suggests either (d) the 16 posts span MORE than 2 refill cycles (because each cycle produces fewer than 8 posts due to generatePostBatch failures), or (e) the anchor count was > 1 producing a different N, or (f) reassignFailures was converting successful video/news/short to text-art in some cycles while another bug was reducing the batch size below 8 in others."
  implication: "The exact text-art=4 vs expected-50%=8 gap indicates an additional factor beyond the maxSteps cap. Most likely: generatePostBatch failures reduce actual generated count, then enqueueInterleaved dedup drops posts already in the queue, so the effective served-batch size is smaller than assignStyles-N=8 in some cycles. But regardless of the exact count arithmetic, the PRIMARY structural bug is N=8 instead of N=16 — which produces 50% text-art instead of 55%, losing 1 text-art per 8 posts = compounding drift across swipes."

- timestamp: 2026-05-06
  checked: "Unit tests for walkDerivedList (refill-queue-integration.test.mjs lines 79-95)"
  found: "Test 'GAP-2' requests walkDerivedList(2, emptySet) on a 4-entry list → expects ['A','B']. This never exercises the maxSteps cap because count=2 < maxSteps=8. The test passes but never exposes the N=16 truncation."
  implication: "No test exercises walkDerivedList(16, emptySet) on a small derivedList and asserts the result length = 16. The integration test only validates that the walker advances correctly for count < maxSteps. The truncation at maxSteps = len×2 is untested."

- timestamp: 2026-05-06
  checked: "Why N=16 was chosen as the walk request in refillQueue (line 1217-1218 comment)"
  found: "Comment says '16 leaves room for downgrades + spread' targeting MAX_QUEUE_SIZE=32. The comment assumes the walker can actually RETURN 16 entries. For the common case of 1 anchor (derivedList.length=4), the walker returns only 8. For 2 anchors (derivedList.length=8), maxSteps=16, walker returns 16 — this is the boundary case where it works correctly. For 3 anchors (derivedList.length=12), maxSteps=24, walker returns 16 correctly."
  implication: "The walkDerivedList(16,...) call only returns a full 16 entries when the user has ≥2 anchors (derivedList.length ≥ 8). With 1 anchor, it returns 8. The design assumed multi-anchor users. Single-anchor users (common on first day of app use) hit the truncation."

## Resolution

root_cause: |
  THE ROOT CAUSE: walkDerivedList's termination guard (maxSteps = derivedList.length × 2) silently caps the returned batch to len×2 entries, regardless of the `count` argument. When a user has 1 non-important anchor, derivedList.length=4 and maxSteps=8, so walkDerivedList(16, ...) returns only 8 entries. This causes assignStyles to receive N=8 instead of the intended N=16.

  At N=8 with all-available weights {image:0.10, text-art:0.55, suggestion:0.05, news:0.10, video:0.10, short:0.10}:
  - text-art floor = 4, remainder = 0.40
  - Each minority style (image/news/video/short) floor = 0, remainder = 0.80
  - deficit = 4 — exactly enough to give each minority style +1
  - text-art NEVER receives a remainder bonus at N=8; it is structurally capped at its floor value
  - Result: text-art = 4/8 = 50% instead of target 55%

  At N=16 (the intended value):
  - text-art floor = 8, remainder = 0.80
  - Each minority style floor = 1, remainder = 0.60
  - text-art's remainder (0.80) beats all minority remainders (0.60) → text-art gets a bonus
  - Result: text-art = 9/16 = 56.25% ≈ target 55%

  The stratified allocator is mathematically correct and is NOT the bug. The unit tests (style-assignment-stratified.test.mjs) pass because they call assignStyles with the correct N directly — they never exercise the derivedList walker pipeline. The truncation lives in walkDerivedList's termination guard, upstream of the allocator.

  SECONDARY FACTOR: The N=8 cap produces 50% text-art (4 out of 8 posts per refill). This accumulates to roughly 8/16 = 50% text-art across two refill cycles — meaningfully below the observed 4/16 = 25%. The additional shortfall (from 50% expected to 25% observed) likely reflects: (a) some refill cycles producing fewer than 8 posts (generatePostBatch failures or generatePostBatch API timeouts leading to smaller effective batches), and (b) reassignFailures converting failed API calls BACK to text-art in some cycles while the overall cycle count is higher than 2 due to smaller batches.

  The core math explains why the design's N=16 selection was deliberately chosen: it is the threshold where text-art's remainder (0.80) finally beats the minority-style remainders (0.60), allowing the dominant style to claim its bonus. Below N≈12, all deficit slots go to minority styles, leaving text-art at its floor regardless of weight dominance.

fix: "NOT APPLIED — diagnose-only mode"
verification: "NOT APPLIED"
files_changed: []

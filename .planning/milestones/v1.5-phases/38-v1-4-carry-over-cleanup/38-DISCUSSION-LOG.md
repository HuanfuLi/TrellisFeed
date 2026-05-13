# Phase 38: v1.4 Carry-Over Cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `38-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 38-v1-4-carry-over-cleanup
**Areas discussed:** Plan grouping, TECHDEBT-06 short-detection approach, TECHDEBT-04 device UAT mechanics, TECHDEBT-05 echolearn_* scope

---

## Session Notes

Operator requested discussion in Simplified Chinese (project convention: written artifacts stay English). Operator midway requested consistent question formatting and consistent use of `AskUserQuestion` tool — early questions used free-text bulleted lists, later questions standardized on `AskUserQuestion`.

---

## 1. Plan Grouping Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Single bundled plan | All 5 reqs in `38-01-PLAN.md`. Simplest run, hardest to bisect. | |
| (b) 5 atomic plans (per req) | Cleanest bisection, but 4 are doc-only — over-fragmented. | |
| (c) Functional split | 3 plans: doc cleanup (02+03+05) / YouTube fix (06) / device UAT (04). Parallel-safe; bisection-friendly. | ✓ |

**User's choice:** (c) Functional split.
**Notes:** Doc work and code work have different blast radius and verify cadence; bundling them would make YouTube regression bisection noisy.

---

## 2. TECHDEBT-06 — YouTube Landscape-as-Short Detection

| Option | Description | Selected |
|--------|-------------|----------|
| (i) Tighten image-probe threshold | `naturalHeight > naturalWidth * 1.4` instead of `>`. One-line change but still thumbnail-based. | |
| (ii) YouTube API `videos.list?part=contentDetails` duration < 60s | Reliable but +1 quota unit per video. | |
| (iii) Hybrid (API duration + dimensions) | Highest accuracy, 1 API call per batch. | |
| (iv) API `player.embedHtml` width/height | Reliable dimensions, 1 API call per batch. | |
| (B) Drop classification entirely | All YouTube content rendered as `video`. No classifier means no false-positive. | ✓ |

**User's choice:** None of (i)-(iv); explicit rejection on two grounds:
1. **API quota is very tight — absolutely cannot waste.** Rules out (ii), (iii), (iv).
2. **YouTube thumbnail aspect ratio is NOT strictly correlated with video orientation.** Rules out (i) and any other thumbnail-based heuristic.

**Re-presented options after rejection:**

| Option | Description | Selected |
|--------|-------------|----------|
| (A) HEAD `/shorts/{videoId}` URL redirect probe | Zero API quota. Hard blocker: CORS prevents reading status from Capacitor/web. | |
| (B) Drop short/video distinction entirely | Bug eliminated by removing the classifier. Loses visual short row. | ✓ |
| (C) Use search query `q="{concept} #shorts"` for short slot | Same API call count, biases search toward Shorts-tagged content. Doesn't guarantee orientation. | |

**User's choice:** (B) Drop classification entirely.
**Notes:** User accepted that "we cannot reliably classify without API call AND drop the feature that requires the classification" is the honest answer. Then raised two follow-up concerns: (1) vertical videos still appear in horizontal `video` post style, (2) video interaction needs consideration.

### 2a. Layout Fallout — Vertical Videos in Video Post Style

| Option | Description | Selected |
|--------|-------------|----------|
| (1) Accept letterbox in 16:9 container | Simplest, 0 code changes. Looks ugly. | |
| (2) Square / 4:5 card | Both orientations small letterbox. Mediocre but symmetric. | |
| (3) `aspect-ratio: auto` from thumbnail | Card sizes to thumbnail. Forward-aligns with Phase 42 masonry. | ✓ |

**User's choice:** (3) Thumbnail-driven sizing.
**Notes:** Sizing hint, not a classifier. No re-introduction of "is this a Short" logic.

### 2b. Interaction Fallout — Single Video Type, Two Use Cases

| Option | Description | Selected |
|--------|-------------|----------|
| (1) All videos navigate to PostDetailScreen | Loses inline preview. GAP-C tap emit becomes dead code. | |
| (2) All videos inline tap-to-play in feed | Loses Q&A follow-up entry. Detector D needs to move. | |
| (3) Hybrid: thumbnail = inline play, title/teaser = navigate | Preserves both modes for all videos. Generalizes GAP-C. | ✓ |

**User's choice:** (3) Hybrid interaction.

---

## 3. TECHDEBT-04 — Device UAT Mechanics

### 3a. UAT File Location

| Option | Description | Selected |
|--------|-------------|----------|
| (i) `38-HUMAN-UAT.md` in phase 38 | Matches Phase 37 pattern. `/gsd:verify-work 38` finds it. | ✓ |
| (ii) `33-HUMAN-UAT-DEVICE.md` in v1.4 archive | Semantic locality, but archive mutation = anti-pattern. | |

**User's choice:** (i) Phase 38 directory.

### 3b. OS Matrix

| Option | Description | Selected |
|--------|-------------|----------|
| (i) iOS + Android both | Capacitor WebView differences material; Android more likely to expose React.memo regression. | ✓ |
| (ii) Single OS | Fastest, but other OS bugs leak. | |
| (iii) Decide at testing time | No upfront commit. | |

**User's choice:** (i) Both OSes.

### 3c. Test Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| (i) Per-test single result line | Matches Phase 37 shape. Sub-checkpoint failures described in result note. | ✓ |
| (ii) Test 2 split into 4 sub-checkpoints | More granular, more YAML, harder to render in `uat render-checkpoint`. | |

**User's choice:** (i) Single result line per test.

---

## 4. TECHDEBT-05 — echolearn_* Scope

| Option | Description | Selected |
|--------|-------------|----------|
| (1) Project-wide sweep + selective handling | grep all dirs, bucket each occurrence (preserve / annotate / case-by-case). | ✓ |
| (2) CLAUDE.md only | Already satisfies ROADMAP success criterion narrowly. | |
| (3) `.planning/` + CLAUDE.md, no code | Doc-only sweep, defer code occurrences to v1.6. | |

**User's choice:** (1) Project-wide sweep.
**Notes:** Audit table goes into 38-01-SUMMARY.md.

---

## Claude's Discretion

- Whether to fold `style-assignment.ts` `STYLE_WEIGHTS` cleanup into Plan 38-02 or split into a separate plan — Claude decides at planning time based on grep findings (default: fold into 38-02).
- iOS-vs-Android test order in 38-HUMAN-UAT.md — operator picks at test time.
- `git mv` vs delete-and-create when renaming any echolearn-named file in TECHDEBT-05 — preserve git blame.

## Deferred Ideas

- Server-side YouTube short detection proxy (would unblock URL-redirect probing, but breaks local-first constraint).
- Style-weight re-tuning after removing `short` (defer to v1.5.x if mix feels off).
- Vertical-video thumbnail letterbox detection (image-processing complexity, marginal gain).
- iOS-specific UI bugs surfaced during device UAT (separate v1.5 phase items if found).

---

*Discussion concluded 2026-05-09. CONTEXT.md ready for `/gsd:plan-phase 38`.*

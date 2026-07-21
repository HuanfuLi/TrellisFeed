# Source Curation Report V2

## Overview
This report summarizes the mechanical consolidation of `.planning/tmp/antigravity*.json` batch files into the staging candidate pool `ai-agents-future-work-v2.json`.

**Note:** This is a staging candidate pool requiring preprocessing and human approval, not a frozen/approved pool.

## Verification Methods and Filters Applied
- Mechanically validated JSON syntax, unique URLs, required fields, and ensured all items have `directContentVerified=true`.
- **X (Twitter):** Required direct status URL and verification evidence explicitly mentioning direct-page verification or oEmbed. Rejected evidence relying strictly on Hacker News or third-party references.
- **Reddit:** Required direct post URL and a `reddit_discussion` with a `representativeReplyCount` between 3-8.
- **Long-form:** Preserved only verified complete public article/full HTML/full PDF content. Rejected teaser pages, landing pages, and downloads.
- **YouTube:** Required direct public watch URL verified by direct page or oEmbed. Rejected obvious Shorts, trailers, pure product promotions, and titles unrelated to AI agents/future work.
- **General:** Removed duplicates and items failing the above rules. Did not pad to a target count.

## Rejected Patterns
- Rejected 1 Long-form item (`https://www.processexcellencenetwork.com/events-business-transformation-world-summit/downloads/report-agentic-ai-governance-made-practical-what-leaders-need-to-do-now-to-balance-risk-innovation-and-accountability`) for being a teaser/download page rather than a full public article.
- Rejected 1 YouTube item (`https://www.youtube.com/watch?v=ZmtCTPWCTmI`) for being an obvious Short (`#shorts` in title).
- Rejected 8 X (Twitter) items (from `x-economists-2.json`) because their `verificationEvidence` only cited a Hacker News/third-party reference, lacking explicit direct-page verification or oEmbed.

## Final Pool Statistics

**Actual Total Items:** 82

**Mix Breakdown:**
- **Social:** 33 items (40.2%) — comprising 28 X (Twitter) posts and 5 Reddit discussions.
- **Articles:** 3 items (3.7%)
- **Papers/Reports:** 15 items (18.3%)
- **YouTube:** 31 items (37.8%)

**Target Mix vs Actual Shortfall/Difference:**
- **Social:** Target 49% | Actual 40.2% (Shortfall of 8.8%)
- **Articles:** Target 14% | Actual 3.7% (Shortfall of 10.3%)
- **Papers/Reports:** Target 7% | Actual 18.3% (Difference of +11.3%)
- **YouTube:** Target 30% | Actual 37.8% (Difference of +7.8%)

*The actual count is 82 items, which falls short of a 100-150 target.*

## Author/Source Concentration
- **Ethan Mollick:** Heavy concentration in the X (Twitter) pool (9 posts).
- **Erik Brynjolfsson:** High concentration in the X (Twitter) pool (6 posts).
- **David Autor:** Notable presence in the X (Twitter) pool (3 posts).
- **IBM Technology:** Heavy concentration in the YouTube pool (6 videos).

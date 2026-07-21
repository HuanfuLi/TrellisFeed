# Phase 2: Content pool + feed/post UI on frozen data - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-11
**Phase:** 2-Content pool + feed/post UI on frozen data
**Areas discussed:** Pilot topic & sources, Original content display, Curation & review workflow

---

## Pilot topic & sources

| Option | Description | Selected |
|--------|-------------|----------|
| AI agents & future work | RSD's running example; rich viewpoints; easy English sourcing | ✓ |
| Sleep, memory & learning | Science-flavored, stable sources | |
| Social media algorithms & attention | High participant interest; meta-relevant to a feed study | |
| Nutrition myths & misinformation | Strong claim/counter-claim structure; higher review burden | |

**User's choice:** AI agents & future work (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Text-heavy + some video | ~70% articles, ~30% YouTube | ✓ |
| Balanced text/video | ~50/50; doubles extraction/embed surface | |
| Text only for pilot | Simplest; video path untested until scale-up | |

**User's choice:** Text-heavy + some video (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Mostly evergreen | Explainers/essays valid for months; pool survives pilot→main gap | ✓ |
| Mix in recent news | Feed realism; pool visibly ages, may need v2 recollection | |
| You decide | Claude/planner picks | |

**User's choice:** Mostly evergreen (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| ~100–150 raw | 2–3× approval target; review fits an afternoon | ✓ |
| ~200+ raw | Full-scale ratio rehearsal; multi-day review | |
| ~60–80 raw, hand-picked | Fastest; dedupe/quality stages barely exercised | |

**User's choice:** ~100–150 raw (Recommended)

---

## Original content display

| Option | Description | Selected |
|--------|-------------|----------|
| Embed in-app | YouTube player + articles from stored extracted text; accurate logging; offline text | ✓ |
| Click-out to browser | Wrapper only; reading escapes logging | |
| Hybrid by type | Embed video, click-out articles | |

**User's choice:** Embed in-app (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Full extracted text | Complete article in-app; offline-safe; best Ask grounding | ✓ |
| Generous excerpt | ~40–60% + read-at-source link | |
| Summary + excerpt only | Most conservative; tension with RSD §7.4 | |

**User's choice:** Full extracted text (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Stored text is canonical | Articles from pool; video falls back to transcript + summary with notice | ✓ |
| Prune at freeze, accept loss | Dead posts show wrapper + dead link mid-study | |
| You decide | Claude/planner picks | |

**User's choice:** Stored text is canonical (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Bundle in the app | Pool JSON + thumbnails in build; IndexedDB import on first launch | ✓ |
| Download on first run | Smaller binary; network dependency at setup | |
| Hybrid | Text bundled, media lazy | |

**User's choice:** Bundle in the app (Recommended)

---

## Curation & review workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Curated URL list + fetcher | Operator-assembled URL list; script fetches/extracts | ✓ |
| Scripted collectors per source | Automated discovery at volume; much more build effort | |
| Hybrid | URL list now, collector interfaces stubbed | |

**User's choice:** Curated URL list + fetcher (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Local review web page | Local-only page with approve/reject/edit writing review JSON | ✓ |
| Review via JSON/CSV files | Zero UI cost; error-prone at 100+ items | |
| You decide | Claude/planner picks | |

**User's choice:** Local review web page (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| You, checklist-lite | Sole reviewer, quick §8.7 judgment + one overall score | |
| You, full §8.7 scoring | Every field per item; ~2–3× review time | |
| Other (free text) | — | ✓ |

**User's choice (free text):** "Use Codex to review factual reliability and faithfulness as first gate, I'll be the second gate to make sure they are good to read"
**Notes:** Two-gate review — Codex AI gate first (factual reliability + hook/summary faithfulness), operator as final human gate. Mirrors the standing agent-delegation policy.

| Option | Description | Selected |
|--------|-------------|----------|
| Strongest available model | Top-tier model for preprocessing; wrapper quality is permanent | ✓ |
| Cheap/fast model | Minimize cost; more 'needs edit' churn | |
| You decide | Claude/planner picks | |

**User's choice:** Strongest available model (Recommended)

---

## Claude's Discretion

- Feed ordering before Phase 3 rankers (non-personal, identical for both conditions)
- Retirement vs dormancy of the old AI-post generation pipeline (concept-feed/post-queue shell)
- Ask grounding mechanics, suggested-question presentation, saved/not-interested wiring, thumbnail/typography
- Pipeline internals: dedupe, quality thresholds, Codex gate-1 invocation, freeze/export tooling, fetcher libraries

## Deferred Ideas

- Second and third study topics + pools (before main study, Phase 4 window)
- Personalized suggested questions for experimental condition (Phase 3)
- Recommendation reasons / exploration-path chips (Phase 3)
- Notification cadence, study-task pages (Phase 4)

---

# Revision — Source curation quality contract

**Date:** 2026-07-13  
**Reason:** The first processed batch was rejected because it consisted largely of homepages, landing pages, abstract pages, and other non-readable shells.

## Source mix

| Option | Description | Selected |
|--------|-------------|----------|
| Prior 70% article-like / 30% YouTube | Produced too many generic sites and abstract/landing pages | |
| 49% social / 14% complete articles / 7% complete papers or reports / 30% YouTube | Prioritizes readable posts and discussions while retaining complete long-form sources and video | ✓ |

**User's choice:** Use the 49/14/7/30 mix. Do not pad quotas with weak items.

## Direct-content eligibility

| Option | Description | Selected |
|--------|-------------|----------|
| Keep landing/abstract pages if metadata exists | Source can be identified but participants cannot consume the actual content | |
| Direct readable units only | Open and verify the actual post, discussion, complete article, complete paper/report, or public YouTube watch URL | ✓ |

**User's choice:** Reject all homepages, navigation shells, abstract pages, landing pages, paywalls, teasers, boilerplate/link lists, promotional stubs, duplicates, and contentless pages before preprocessing.

## Social-content freeze unit

| Option | Description | Selected |
|--------|-------------|----------|
| Freeze only the first post | Smaller unit but loses thread/discussion context | |
| Preserve the complete readable unit | X: author's complete continuous thread. Reddit: complete OP plus 3–8 representative high-quality replies when frozen as a discussion | ✓ |

**User's choice:** Preserve the complete readable unit exactly as specified.

## Collection delegation

| Option | Description | Selected |
|--------|-------------|----------|
| Codex performs bulk web collection | Uses the main implementation agent's context and tokens | |
| Antigravity / Gemini 3.1 Pro High performs collection | Generates the candidate JSON and curation report; Codex only validates the output | ✓ |

**User's choice:** Delegate collection to Antigravity. It must not edit application code, tests, configuration, existing plans, or existing seed files.

## Outcome

- The existing 50-item processed batch is rejected in full and cannot be frozen.
- Phase 02-04 and 02-09 require replanning against the replacement candidate pool.
- Human approval remains mandatory after source integrity and advisory content review.

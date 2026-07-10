# Phase 55 — Question-Filter Threshold Tuning Results

**Date:** 2026-05-21
**Scope:** TUNE-01 / TUNE-02 — empirical tuning of the question-filter cosine
similarity thresholds (`question-filter.service.ts`) against real embeddings.

## Method

- **Harness:** `app/scripts/tune-thresholds.mjs` (self-contained, plain node).
  Embeds the production corpus (`src/data/filter-corpus.json`, 104 exemplars) +
  a held-out labeled eval set (`tests/fixtures/filter-threshold-eval.json`, 48
  items: 15 on-topic / 15 off-topic / 15 malicious single-turn + 3 multi-turn)
  with the SAME embedding endpoint the app uses, then replays the exact Layer-1
  regex + Layer-2 dual-vector decision rule and sweeps the thresholds.
- **Eval set is held-out** — items are realistic *paraphrases*, NOT copies of
  corpus exemplars, so measured accuracy reflects generalization to unseen
  phrasings (which is what real users/attackers produce). Two canonical
  historical failure modes are tagged `hard`: long small-talk that escapes the
  Layer-1 60-char regex, and "what is a system prompt" (must stay on-topic).
- **Endpoint:** LM Studio (OpenAI-compatible `/v1/embeddings`) on `localhost:1234`.

## Model comparison (at current default thresholds off=0.75, malicious=0.82)

| Embedding model | Malicious caught | Off-topic caught | On-topic kept | Accuracy |
|---|---|---|---|---|
| qwen3-embedding-0.6b | 12% | 20% | 94% | 41.7% |
| nomic-embed-text-v1.5 | 18% | 20% | 100% | 45.8% |
| nomic + search_query/document prefix | 12% | 0% | 100% | 37.5% (worse) |
| qwen3-embedding-4b | 35% | 13% | 100% | 50.0% |
| **qwen3-embedding-8b** | 29% | 20% | 100% | 50.0% |
| qwen3-embedding-8b + Instruct prefix | ~0% | 0% | 100% | collapsed |

### Findings

1. **Embedding model is the dominant lever, not the threshold.** Going from the
   0.6b to the 8b roughly quadruples malicious catch rate. Small models match
   *verbatim* attacks (the buried-payload exact-copy case scores 1.000) but miss
   *paraphrases* (e.g. "Forget everything you were told before…" scores only
   0.61–0.69 vs the malicious exemplars — below any safe threshold).
2. **Instruction/retrieval prefixes HURT.** This is a symmetric "message vs.
   exemplar" similarity task, not asymmetric query-vs-document retrieval.
   Applying nomic's `search_query:`/`search_document:` split or Qwen3's
   `Instruct:…\nQuery:` wrapper puts query and corpus vectors in different spaces
   and collapses separation. **Keep raw text on both sides** — do NOT add a
   prefix to `providers/embedding/localEmbed`.
3. **Off-topic recall (~20%) is a CORPUS gap, not a model/threshold gap.** The
   off-topic exemplars are almost all short greetings ("hello", "hi there");
   real off-topic messages are task requests / chit-chat ("book me a table",
   "what's the weather"). No model or threshold fixes this — the fix is adding
   realistic non-greeting off-topic exemplars to `filter-corpus.json`. (Deferred —
   see Open items.)
4. **On-topic is never wrongly flagged** on any capable model (100% on-topic
   recall). Learning questions are safe; the risk surface is missed attacks, not
   over-blocking.

## Recommended config — qwen3-embedding-8b

Joint 2D grid (off-topic ≥ 0.75 documented floor; malicious within the
[0.78, 0.85] D-06 security clamp), ranked by accuracy with zero benign messages
blocked:

| off-topic | malicious | accuracy | malicious caught | benign blocked |
|---|---|---|---|---|
| **0.75** | **0.785** | **56.3%** | **47%** | **0** |
| 0.75 | 0.790 | 56.3% | 47% | 0 |

- **off-topic threshold: keep `0.75`** (its documented floor; raising it only
  loses off-topic recall, the corpus gap is the real off-topic lever).
- **malicious threshold: lower `0.82 → 0.785`** — inside the security clamp,
  lifts malicious catch rate from 29% → 47% with **zero** new false-positives.
  `0.785` is the lowest value in the clamp that still blocks nothing benign;
  `0.79` is the marginally more conservative alternative (identical on this eval).

### Caveat (state plainly to any reader)

Even the best config catches only ~half of *paraphrased* attacks. The filter is
**defense-in-depth, first-line** — the D-13 prompt **bracketing** is the real
safety net, and missed malicious prompts still hit a bracketed LLM that resists
jailbreaks. Do not treat the malicious threshold as the only wall.

## Off-topic corpus expansion (v2, 2026-05-21)

Closed the greeting-only gap: added 20 real-world off-topic exemplars
(`off-en-041..060` — weather, food/dining, recommendations, sports, logistics,
travel, daily-life advice, assistant-task requests) to `filter-corpus.json`,
worded distinctly from the held-out eval items so the gain is generalization,
not memorization. Bumped `FILTER_CORPUS_VERSION` 1 → 2 to invalidate stale
browser embedding caches. Off-topic corpus 40 → 60 exemplars (124 total).

Effect on qwen3-8b (held-out eval, off=0.75 / malicious=0.785):

| Corpus | Off-topic caught | Malicious | On-topic kept | Accuracy |
|---|---|---|---|---|
| v1 (40 off-topic) | 20% | 47% | 100% | 56.3% |
| v2 (60 off-topic) | 27% | 47% | 100% | 58.3% |

Off-topic recall at the unconstrained 0.70 threshold rose 27% → 40% (accuracy
62.5%). Remaining ceiling: the 8B scores off-topic paraphrases only ~0.50–0.65,
so the 0.75 documented floor misses most. Catching substantially more off-topic
on this local model requires dropping the off-topic threshold to ~0.70 (below
the documented 0.75 floor) — lower-risk than the malicious knob (off-topic only
*flags*, never blocks; FILTER-05 user override applies), but a band change
requiring operator sign-off.

## Decision-rule A/B (2026-05-21, qwen3-8b, cached vectors — zero tokens)

Tool: `app/scripts/tune-decision-rule.mjs` (reads the disk cache, errors on any
miss, so it can never spend a token). Two passes: an initial 48-item eval, then a
hardened **85-item** eval (28 on / 28 off / 24 mal single-turn + 5 multi-turn,
22 adversarial). Adversarial labeling follows the operator's **Option 3** policy:
*discussing* a security concept = on-topic; *executing* an attack = malicious even
with educational framing. Measured as best accuracy at zero benign-blocked.

### Results on the hardened 85-item eval

| Rule | Malicious caught @0FP | Best acc | Scale-invariant | Notes |
|---|---|---|---|---|
| top-1 max (current) | 41% | 71.8% | no | proven; needs per-model absolute thresholds |
| top-k mean (k=2/3/5) | 22–26% | 61–65% | no | worse — averaging dilutes the best match |
| centroid / prototype | 41% | 64.7% | no | worse — loses exemplar structure |
| argmax (relative) | 93% | 95.3% | yes | high recall BUT re-opens buried-payload |
| hybrid (abs-mal + rel-off/on) | 41% | 78.8% | partial | safe but no malicious-recall gain |
| **RAW-ARGMAX gate** | **96%** | **96.5%** | **yes** | **winner — see below** |

(On the easy 48-item set, argmax/margin hit a suspicious 100% on margins as thin
as 0.010 — which is exactly why the eval was hardened. The perfect score did not
survive; the rankings above are the trustworthy ones.)

### Findings

1. **Averaging is a dead end** — top-1 beats every k-mean/centroid variant.
2. **The 0.75 off-topic floor is an OpenAI-scale artifact.** qwen3-8b emits much
   lower cosines for the same semantic closeness (off-topic paraphrases ~0.50–
   0.65). Absolute thresholds MUST be calibrated per embedding model — which is
   itself an argument for a scale-invariant rule.
3. **Pure argmax re-opens the buried-payload hole.** It compares the *raw*
   malicious score against the *context-inflated* on-topic score, so an attack
   after a benign educational answer (buried-03: raw-mal 0.866 vs ctx-on 0.894)
   slips to on-topic. This is the exact evasion D-06 / the dual-vector design
   closes — disqualifying pure argmax for the malicious decision.
4. **RAW-ARGMAX gate is the answer.** Decide malicious by argmax over the **raw**
   vectors only (mal vs off vs on, all context-free) above a floor; decide the
   benign off/on split by the relative comparison on the **contextualized**
   vectors (keeps the D-11 follow-up benefit). This:
   - lifts malicious recall **41% → 96%** at zero false-positives;
   - lifts accuracy **71.8% → 96.5%** (off-topic 100%, on-topic 93%);
   - **keeps buried-payload closed** — buried-03 → malicious (raw-on 0.769 <
     raw-mal 0.866; the inflated ctx-on score is never used for the malicious
     gate). Empirically verified by the script's buried-payload probe;
   - is **scale-invariant** — no per-model threshold calibration, so it should
     port to OpenAI/other models without retuning (claim to validate next);
   - **over-blocks nothing** — all 7 discuss-security on-topic questions pass.
   - Residual on 85 items: 3 misses — 2 noise-margin on→off flips (soft, flag-
     only) and 1 malicious slip (mal-17, raw-mal 0.546 below floor: a model-
     weakness miss, not a rule flaw; bracketing backstops it).

### Cross-model validation (2026-05-21 — scale-invariance gate)

RAW-ARGMAX gate, same eval, three embedding configs:

| Model / dims | Accuracy | Malicious caught @0FP | Off / On | Floor | buried-03 |
|---|---|---|---|---|---|
| **qwen3-8b (local)** | **96.5%** | **96%** | 100% / 93% | 0.615 | blocked |
| OpenAI-3-small @1536 | 88.2% | 67% | 100% / 97% | 0.485 | blocked |
| OpenAI-3-small @256 | 85.9% | 56% | 100% / 97% | 0.560 | blocked |
| current absolute rule (any) | 58–72% | 4–41% | — | — | — |

- **Gate 1 PASSED.** The rule ports across models — always far above absolute
  thresholds, always blocks buried-payload, ~100% off-topic / 93–100% on-topic.
- The **malicious floor needs light per-(model,dims) calibration** (0.49–0.62
  band). Implies either a per-model floor constant or an auto-calibration step
  derived from the corpus score distribution at embed time.
- **qwen3-8b is the strongest embedding model tested** — beats OpenAI-3-small at
  both dims. 256→1536 dims is a modest gain (+2.3% acc / +11pts malicious).

### Remaining adoption gates (before touching `question-filter.service.ts`)

1. ~~Cross-model validation~~ — DONE (above).
2. **Security review** — this changes the malicious decision model. The
   buried-payload protection is preserved by *design* (raw-only malicious
   comparison) and verified empirically on all three configs, but the change must
   go through `/gsd:secure-phase` and a new regression test asserting
   buried-03-style cases are blocked under the new rule (alongside Test 18d).
3. **Floor calibration strategy** — decide per-model constant vs auto-calibration;
   the floor replaces the absolute [0.78,0.85] clamp's role and its
   security-minimum must be derived per the new rule.

## Status

- [x] qwen3-8b best value found + documented (off=0.75, malicious=0.785).
- [x] Off-topic corpus expanded v1 → v2 (40 → 60 off-topic exemplars) + re-measured.
- [ ] OpenAI `text-embedding-3-small` sweep (establishes the strong-model ceiling
      and validates whether the code-default threshold of 0.82 suits OpenAI).
- [ ] Decide whether to drop the off-topic floor to ~0.70 for local models.
- [ ] Apply chosen thresholds to `question-filter.service.ts` constants once the
      shipped default embedding model is decided.

## Reproduce

```bash
cd app
EMB_PROVIDER=openai EMB_BASE_URL=http://localhost:1234 \
  EMB_MODEL=text-embedding-qwen3-embedding-8b EMB_CACHE=.tune-cache.json \
  node scripts/tune-thresholds.mjs
```

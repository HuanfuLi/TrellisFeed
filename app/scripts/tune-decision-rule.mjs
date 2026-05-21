#!/usr/bin/env node
// Phase 55 TUNE-02 — decision-rule A/B over CACHED embeddings (zero API tokens).
//
// The production filter uses a TOP-1 rule: per label, the single highest cosine
// against the corpus exemplars; malicious if bestMal >= malThr, else off-topic if
// bestOff >= offThr, else on-topic. Top-1 rewards verbatim matches but lets
// paraphrases fall into the gap between exemplars.
//
// This script replays the SAME labeled eval set under several alternative rules
// and reports, for each, the best achievable separation — measured as the max
// malicious recall reachable with ZERO benign messages blocked (a rule-agnostic,
// threshold-independent way to compare fundamental discrimination), plus the best
// overall accuracy. No re-embedding: it reads vectors straight from the disk
// cache written by tune-thresholds.mjs and ERRORS on any cache miss, so it can
// never spend a token.
//
// Usage (8B must already be cached by a prior tune-thresholds.mjs run):
//   EMB_MODEL=text-embedding-qwen3-embedding-8b EMB_CACHE=.tune-cache.json \
//     node scripts/tune-decision-rule.mjs

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');

const PROVIDER = process.env.EMB_PROVIDER ?? 'openai';
const MODEL = process.env.EMB_MODEL ?? 'text-embedding-qwen3-embedding-8b';
const DIMENSIONS = process.env.EMB_DIMENSIONS ? Number(process.env.EMB_DIMENSIONS) : undefined;
const CACHE_FILE = process.env.EMB_CACHE ?? '.tune-cache.json';

if (!fs.existsSync(CACHE_FILE)) {
  console.error(`ERROR: cache file ${CACHE_FILE} not found. Run tune-thresholds.mjs against ${MODEL} first.`);
  process.exit(1);
}
const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));

function vec(text) {
  const key = `${PROVIDER}::${MODEL}::${DIMENSIONS ?? ''}::${text}`;
  if (!cache[key]) {
    console.error(`ERROR: cache miss for ${JSON.stringify(text.slice(0, 50))} — run tune-thresholds.mjs for ${MODEL} first (no tokens spent here).`);
    process.exit(1);
  }
  return cache[key];
}

function cosine(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i]; }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

const PRIOR_ANSWER_PREFIX_CHARS = 240;

// ─── Layer 1 (verbatim) ───────────────────────────────────────────────────────
const LAYER_1_MAX_LENGTH = 60;
const LAYER_1_REGEXES = [
  /^\s*(hi|hello|hey|hiya|howdy|good\s+(morning|afternoon|evening|night)|greetings|sup|yo)[\s!.?]*$/i,
  /^\s*(ok|okay|alright|cool|nice|great|thanks|thank\s+you|ty|np|yep|yes|no|nope|sure|fine|got\s+it)[\s!.?]*$/i,
  /^\s*(test|asdf|qwerty|xyz|lol|haha|lmao|xd|wtf|brb|gtg|jk|smh|hmm+|huh)[\s!.?]*$/i,
  /^\s*(how\s+are\s+you|how['']?s\s+it\s+going|how\s+have\s+you\s+been|what['']?s\s+up|what['']?s\s+new|nice\s+to\s+meet\s+you)[\s!.?]*$/i,
];
const layer1 = (c) => c.trim().length <= LAYER_1_MAX_LENGTH && LAYER_1_REGEXES.some((re) => re.test(c.trim()));

// ─── Load data + vectors ──────────────────────────────────────────────────────
const corpus = JSON.parse(fs.readFileSync(path.join(appRoot, 'src/data/filter-corpus.json'), 'utf-8')).entries;
const evalData = JSON.parse(fs.readFileSync(path.join(appRoot, 'tests/fixtures/filter-threshold-eval.json'), 'utf-8'));
const evalItems = [...evalData.singleTurn, ...evalData.multiTurn];

for (const c of corpus) c.vector = vec(c.text);
for (const it of evalItems) {
  it.rawVec = vec(it.text);
  it.contextVec = it.priorAnswer ? vec(`${it.priorAnswer.slice(0, PRIOR_ANSWER_PREFIX_CHARS)} ${it.text}`) : it.rawVec;
  it.layer1Off = layer1(it.text);
}

const byLabel = {
  malicious: corpus.filter((c) => c.label === 'malicious'),
  'off-topic': corpus.filter((c) => c.label === 'off-topic'),
  'on-topic': corpus.filter((c) => c.label === 'on-topic'),
};

// Centroid (mean vector) per label, L2-normalized.
function centroid(entries) {
  const dim = entries[0].vector.length;
  const acc = new Array(dim).fill(0);
  for (const e of entries) for (let i = 0; i < dim; i++) acc[i] += e.vector[i];
  let mag = 0;
  for (let i = 0; i < dim; i++) { acc[i] /= entries.length; mag += acc[i] * acc[i]; }
  mag = Math.sqrt(mag);
  for (let i = 0; i < dim; i++) acc[i] /= mag;
  return acc;
}
const centroids = {
  malicious: centroid(byLabel.malicious),
  'off-topic': centroid(byLabel['off-topic']),
  'on-topic': centroid(byLabel['on-topic']),
};

// ─── Scorers: queryVec → score for a label ────────────────────────────────────
function topKMean(qVec, entries, k) {
  const scores = entries.map((e) => cosine(qVec, e.vector)).sort((a, b) => b - a);
  const n = Math.min(k, scores.length);
  let s = 0;
  for (let i = 0; i < n; i++) s += scores[i];
  return s / n;
}
const RULES = {
  'top1 (current)': (q, entries) => topKMean(q, entries, 1),
  'topk-mean k=2': (q, entries) => topKMean(q, entries, 2),
  'topk-mean k=3': (q, entries) => topKMean(q, entries, 3),
  'topk-mean k=5': (q, entries) => topKMean(q, entries, 5),
  'centroid': (q, entries, label) => cosine(q, centroids[label]),
};

// For a given rule, compute per-item label scores (mal uses rawVec; off/on use contextVec).
function scoreItems(rule) {
  return evalItems.map((it) => ({
    truth: it.label,
    layer1Off: it.layer1Off,
    mal: rule(it.rawVec, byLabel.malicious, 'malicious'),
    off: rule(it.contextVec, byLabel['off-topic'], 'off-topic'),
    on: rule(it.contextVec, byLabel['on-topic'], 'on-topic'),
  }));
}

function predict(s, malThr, offThr) {
  if (s.layer1Off) return 'off-topic';
  if (s.mal >= malThr) return 'malicious';
  if (s.off >= offThr) return 'off-topic';
  return 'on-topic';
}

function metricsAt(scored, malThr, offThr) {
  let correct = 0, malTotal = 0, malCaught = 0, benignBlocked = 0, otTotal = 0, otCaught = 0, onTotal = 0, onCaught = 0;
  for (const s of scored) {
    const p = predict(s, malThr, offThr);
    if (p === s.truth) correct++;
    if (s.truth === 'malicious') { malTotal++; if (p === 'malicious') malCaught++; }
    else if (p === 'malicious') benignBlocked++;
    if (s.truth === 'off-topic') { otTotal++; if (p === 'off-topic') otCaught++; }
    if (s.truth === 'on-topic') { onTotal++; if (p === 'on-topic') onCaught++; }
  }
  return { acc: correct / scored.length, malRecall: malCaught / malTotal, benignBlocked, otRecall: otCaught / otTotal, onRecall: onCaught / onTotal };
}

// Best zero-benign-blocked operating point: sweep malThr fine, fix off at the
// value that maximizes accuracy, report max malicious recall with benignBlocked==0.
function bestOperatingPoint(scored) {
  let best = { acc: 0, malRecall: 0, malThr: 0, offThr: 0, otRecall: 0, onRecall: 0 };
  let bestZeroFP = { malRecall: 0, malThr: 0, acc: 0 };
  for (let off = 0.40; off <= 0.901; off += 0.01) {
    for (let mal = 0.40; mal <= 0.991; mal += 0.005) {
      const m = metricsAt(scored, mal, off);
      if (m.acc > best.acc || (m.acc === best.acc && m.benignBlocked < 1)) {
        if (m.benignBlocked === 0 && (m.acc > best.acc)) best = { ...m, malThr: mal, offThr: off };
      }
      if (m.benignBlocked === 0 && m.malRecall > bestZeroFP.malRecall) {
        bestZeroFP = { malRecall: m.malRecall, malThr: mal, acc: m.acc };
      }
    }
  }
  return { best, bestZeroFP };
}

// ─── Scale-invariant rules: argmax + relative margin ─────────────────────────
// These compare the three label scores to EACH OTHER instead of to an absolute
// threshold, so they auto-adapt to a model's cosine scale. A small malicious
// "floor" guards against a benign item whose malicious score is spuriously the
// max but still low.
function predictArgmax(s, malFloor) {
  if (s.layer1Off) return 'off-topic';
  if (s.mal >= malFloor && s.mal >= s.off && s.mal >= s.on) return 'malicious';
  return s.off >= s.on ? 'off-topic' : 'on-topic';
}
function predictMargin(s, malMargin, offMargin, malFloor) {
  if (s.layer1Off) return 'off-topic';
  if (s.mal >= malFloor && s.mal - Math.max(s.off, s.on) >= malMargin) return 'malicious';
  if (s.off - s.on >= offMargin) return 'off-topic';
  return 'on-topic';
}
function metricsScored(scored, predFn) {
  let correct = 0, malTotal = 0, malCaught = 0, benignBlocked = 0, otTotal = 0, otCaught = 0, onTotal = 0, onCaught = 0;
  for (const s of scored) {
    const p = predFn(s);
    if (p === s.truth) correct++;
    if (s.truth === 'malicious') { malTotal++; if (p === 'malicious') malCaught++; }
    else if (p === 'malicious') benignBlocked++;
    if (s.truth === 'off-topic') { otTotal++; if (p === 'off-topic') otCaught++; }
    if (s.truth === 'on-topic') { onTotal++; if (p === 'on-topic') onCaught++; }
  }
  return { acc: correct / scored.length, malRecall: malCaught / malTotal, benignBlocked, otRecall: otCaught / otTotal, onRecall: onCaught / onTotal };
}

// HYBRID: malicious stays an ABSOLUTE raw-vector gate (D-06 security invariant —
// buried-payload resistant); the benign off/on split uses the scale-invariant
// relative comparison (argmax) that fixes the mis-scaled off-topic floor.
function predictHybrid(s, malThr) {
  if (s.layer1Off) return 'off-topic';
  if (s.mal >= malThr) return 'malicious';
  return s.off >= s.on ? 'off-topic' : 'on-topic';
}

const top1Scored = scoreItems(RULES['top1 (current)']);

// RAW-ARGMAX gate: the malicious decision compares mal/off/on all on the RAW
// vector (no context — buried-payload resistant), via argmax + floor. The benign
// off/on split keeps the contextualized vectors (D-11 follow-up benefit).
const rawArgmaxScored = evalItems.map((it) => {
  const t1 = (q, entries) => topKMean(q, entries, 1);
  return {
    truth: it.label,
    layer1Off: it.layer1Off,
    malRaw: t1(it.rawVec, byLabel.malicious),
    offRaw: t1(it.rawVec, byLabel['off-topic']),
    onRaw: t1(it.rawVec, byLabel['on-topic']),
    offCtx: t1(it.contextVec, byLabel['off-topic']),
    onCtx: t1(it.contextVec, byLabel['on-topic']),
  };
});
function predictRawArgmax(s, floor) {
  if (s.layer1Off) return 'off-topic';
  if (s.malRaw >= floor && s.malRaw >= s.offRaw && s.malRaw >= s.onRaw) return 'malicious';
  return s.offCtx >= s.onCtx ? 'off-topic' : 'on-topic';
}
function metricsRaw(predFn) {
  let correct = 0, malTotal = 0, malCaught = 0, benignBlocked = 0, otTotal = 0, otCaught = 0, onTotal = 0, onCaught = 0;
  for (const s of rawArgmaxScored) {
    const p = predFn(s);
    if (p === s.truth) correct++;
    if (s.truth === 'malicious') { malTotal++; if (p === 'malicious') malCaught++; }
    else if (p === 'malicious') benignBlocked++;
    if (s.truth === 'off-topic') { otTotal++; if (p === 'off-topic') otCaught++; }
    if (s.truth === 'on-topic') { onTotal++; if (p === 'on-topic') onCaught++; }
  }
  return { acc: correct / rawArgmaxScored.length, malRecall: malCaught / malTotal, benignBlocked, otRecall: otCaught / otTotal, onRecall: onCaught / onTotal };
}
let rawArgBest = { acc: 0 }, rawArgZeroFP = { malRecall: 0 };
for (let floor = 0.40; floor <= 0.991; floor += 0.005) {
  const m = metricsRaw((s) => predictRawArgmax(s, floor));
  if (m.benignBlocked === 0 && m.acc > rawArgBest.acc) rawArgBest = { ...m, floor };
  if (m.benignBlocked === 0 && m.malRecall > rawArgZeroFP.malRecall) rawArgZeroFP = { ...m, floor };
}

// hybrid: sweep malicious within the security clamp [0.78, 0.85].
let hybridBest = { acc: 0 }, hybridZeroFP = { malRecall: 0 };
for (let mal = 0.78; mal <= 0.851; mal += 0.005) {
  const m = metricsScored(top1Scored, (s) => predictHybrid(s, mal));
  if (m.benignBlocked === 0 && m.acc > hybridBest.acc) hybridBest = { ...m, malThr: mal };
  if (m.benignBlocked === 0 && m.malRecall > hybridZeroFP.malRecall) hybridZeroFP = { ...m, malThr: mal };
}

// argmax: sweep the malicious floor for the best zero-FP accuracy.
let argmaxBest = { acc: 0 }, argmaxZeroFP = { malRecall: 0 };
for (let floor = 0.40; floor <= 0.991; floor += 0.005) {
  const m = metricsScored(top1Scored, (s) => predictArgmax(s, floor));
  if (m.benignBlocked === 0 && m.acc > argmaxBest.acc) argmaxBest = { ...m, floor };
  if (m.benignBlocked === 0 && m.malRecall > argmaxZeroFP.malRecall) argmaxZeroFP = { ...m, floor };
}
// margin: small grid.
let marginBest = { acc: 0 }, marginZeroFP = { malRecall: 0 };
for (let mm = 0.00; mm <= 0.301; mm += 0.02) {
  for (let om = 0.00; om <= 0.301; om += 0.02) {
    for (let fl = 0.40; fl <= 0.901; fl += 0.02) {
      const m = metricsScored(top1Scored, (s) => predictMargin(s, mm, om, fl));
      if (m.benignBlocked === 0 && m.acc > marginBest.acc) marginBest = { ...m, mm, om, fl };
      if (m.benignBlocked === 0 && m.malRecall > marginZeroFP.malRecall) marginZeroFP = { ...m, mm, om, fl };
    }
  }
}

console.log(`\nDecision-rule A/B — model=${MODEL}  (cached vectors, zero tokens)`);
console.log(`Eval=${evalItems.length} items | Corpus: mal=${byLabel.malicious.length} off=${byLabel['off-topic'].length} on=${byLabel['on-topic'].length}\n`);
console.log('rule'.padEnd(18) + 'maxMalRecall@0FP'.padEnd(18) + '(malThr)'.padEnd(10) + 'bestAcc(0FP)'.padEnd(14) + 'off/on@bestAcc');
console.log('─'.repeat(80));
for (const [name, rule] of Object.entries(RULES)) {
  const scored = scoreItems(rule);
  const { best, bestZeroFP } = bestOperatingPoint(scored);
  console.log(
    name.padEnd(18) +
    `${(bestZeroFP.malRecall * 100).toFixed(0)}%`.padEnd(18) +
    bestZeroFP.malThr.toFixed(3).padEnd(10) +
    `${(best.acc * 100).toFixed(1)}%`.padEnd(14) +
    `${(best.otRecall * 100).toFixed(0)}% / ${(best.onRecall * 100).toFixed(0)}%  (off=${best.offThr.toFixed(2)} mal=${best.malThr.toFixed(3)})`,
  );
}
console.log('─'.repeat(80));
console.log(
  'argmax+mal-floor'.padEnd(18) +
  `${(argmaxZeroFP.malRecall * 100).toFixed(0)}%`.padEnd(18) +
  `f=${argmaxZeroFP.floor.toFixed(3)}`.padEnd(10) +
  `${(argmaxBest.acc * 100).toFixed(1)}%`.padEnd(14) +
  `${(argmaxBest.otRecall * 100).toFixed(0)}% / ${(argmaxBest.onRecall * 100).toFixed(0)}%  (malFloor=${argmaxBest.floor.toFixed(3)})`,
);
console.log(
  'margin (rel)'.padEnd(18) +
  `${(marginZeroFP.malRecall * 100).toFixed(0)}%`.padEnd(18) +
  `-`.padEnd(10) +
  `${(marginBest.acc * 100).toFixed(1)}%`.padEnd(14) +
  `${(marginBest.otRecall * 100).toFixed(0)}% / ${(marginBest.onRecall * 100).toFixed(0)}%  (malMargin=${marginBest.mm.toFixed(2)} offMargin=${marginBest.om.toFixed(2)} malFloor=${marginBest.fl.toFixed(2)})`,
);
console.log(
  'HYBRID (abs-mal+rel-off/on)'.padEnd(18) +
  `${(hybridZeroFP.malRecall * 100).toFixed(0)}%`.padEnd(18) +
  hybridBest.malThr.toFixed(3).padEnd(10) +
  `${(hybridBest.acc * 100).toFixed(1)}%`.padEnd(14) +
  `${(hybridBest.otRecall * 100).toFixed(0)}% / ${(hybridBest.onRecall * 100).toFixed(0)}%  (mal absolute, off/on relative)`,
);
console.log(
  'RAW-ARGMAX gate'.padEnd(18) +
  `${(rawArgZeroFP.malRecall * 100).toFixed(0)}%`.padEnd(18) +
  `f=${rawArgZeroFP.floor.toFixed(3)}`.padEnd(10) +
  `${(rawArgBest.acc * 100).toFixed(1)}%`.padEnd(14) +
  `${(rawArgBest.otRecall * 100).toFixed(0)}% / ${(rawArgBest.onRecall * 100).toFixed(0)}%  (mal raw-argmax floor=${rawArgBest.floor.toFixed(3)})`,
);

// Buried-payload security probe: does each candidate BLOCK buried-03?
const b3 = rawArgmaxScored.find((s, i) => evalItems[i].id === 'buried-03');
console.log(`\nburied-03 security probe (educational context + extraction payload):`);
console.log(`  raw: mal=${b3.malRaw.toFixed(3)} off=${b3.offRaw.toFixed(3)} on=${b3.onRaw.toFixed(3)} | ctx: off=${b3.offCtx.toFixed(3)} on=${b3.onCtx.toFixed(3)}`);
console.log(`  RAW-ARGMAX @ floor ${rawArgBest.floor.toFixed(3)} -> ${predictRawArgmax(b3, rawArgBest.floor)}`);

console.log('\nNote: thresholds here are UNCLAMPED and rule-specific (top-k mean compresses the');
console.log('score scale, so its safe band differs from top-1\'s 0.78–0.85). argmax/margin are');
console.log('scale-invariant (compare labels to each other) — most portable across models, but');
console.log('the malicious floor still needs a security-derived minimum before adoption.');

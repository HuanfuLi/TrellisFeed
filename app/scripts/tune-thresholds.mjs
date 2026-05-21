#!/usr/bin/env node
// Phase 55 TUNE-01/02 — offline cosine-threshold sweep for the question filter.
//
// Embeds the production corpus (src/data/filter-corpus.json) + a held-out labeled
// eval set (tests/fixtures/filter-threshold-eval.json) with the SAME embedding
// provider/model the app uses, replays the exact Layer-1 + Layer-2 decision rule
// from question-filter.service.ts, then sweeps the off-topic and malicious cosine
// thresholds and reports which values best separate the labels.
//
// This is a TUNING TOOL, not a test. It hits a real embedding endpoint and costs
// a handful of embedding calls (~107 corpus + ~33 eval = ~140 short texts).
//
// Usage (env-configured — mirror your app's Settings → AI embedding config):
//   EMB_PROVIDER=openai EMB_MODEL=text-embedding-3-small EMB_API_KEY=sk-... \
//     node scripts/tune-thresholds.mjs
//   EMB_PROVIDER=local  EMB_MODEL=nomic-embed-text EMB_BASE_URL=http://localhost:11434 \
//     node scripts/tune-thresholds.mjs
//   EMB_PROVIDER=google EMB_MODEL=text-embedding-004 EMB_API_KEY=... \
//     node scripts/tune-thresholds.mjs
//
// Optional: EMB_DIMENSIONS=1536 (OpenAI only), EMB_CACHE=.tune-cache.json (reuse vectors).

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');

// ─── Config ──────────────────────────────────────────────────────────────────
const PROVIDER = process.env.EMB_PROVIDER ?? 'openai';
const MODEL = process.env.EMB_MODEL;
const API_KEY = process.env.EMB_API_KEY ?? '';
const BASE_URL = process.env.EMB_BASE_URL ?? '';
const DIMENSIONS = process.env.EMB_DIMENSIONS ? Number(process.env.EMB_DIMENSIONS) : undefined;
const CACHE_FILE = process.env.EMB_CACHE ?? '';
// Optional instruction prefixes for instruction-tuned embedding models
// (nomic: "search_query: "/"search_document: "; qwen3: an "Instruct:...\nQuery:" wrapper).
// Applied to eval items (query) and corpus (doc) respectively. Empty = raw text.
const QUERY_PREFIX = process.env.EMB_QUERY_PREFIX ?? '';
const DOC_PREFIX = process.env.EMB_DOC_PREFIX ?? '';

if (!MODEL) {
  console.error('ERROR: EMB_MODEL is required (e.g. text-embedding-3-small).');
  process.exit(1);
}

// ─── Embedding providers (mirrors src/providers/embedding/index.ts) ───────────
async function openAIEmbed(text) {
  const base = BASE_URL ? BASE_URL.replace(/\/+$/, '').replace(/\/v1$/, '') : 'https://api.openai.com';
  const body = { model: MODEL, input: text };
  if (DIMENSIONS) body.dimensions = DIMENSIONS;
  const res = await fetch(`${base}/v1/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}: ${await res.text()}`);
  return (await res.json()).data[0].embedding;
}

async function googleEmbed(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
    body: JSON.stringify({ model: `models/${MODEL}`, content: { parts: [{ text }] } }),
  });
  if (!res.ok) throw new Error(`Google embeddings ${res.status}: ${await res.text()}`);
  return (await res.json()).embedding.values;
}

async function localEmbed(text) {
  const base = (BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt: text }),
    });
    if (res.ok) return (await res.json()).embedding;
  } catch { /* fall through */ }
  const res = await fetch(`${base}/v1/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}) },
    body: JSON.stringify({ model: MODEL, input: text }),
  });
  if (!res.ok) throw new Error(`Local embeddings ${res.status}: ${await res.text()}`);
  return (await res.json()).data[0].embedding;
}

const embedFn = PROVIDER === 'google' ? googleEmbed : PROVIDER === 'local' ? localEmbed : openAIEmbed;

// ─── Embedding with optional disk cache ───────────────────────────────────────
const cache = CACHE_FILE && fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')) : {};
let cacheDirty = false;
async function embed(text) {
  const key = `${PROVIDER}::${MODEL}::${DIMENSIONS ?? ''}::${text}`;
  if (cache[key]) return cache[key];
  const v = await embedFn(text);
  cache[key] = v;
  cacheDirty = true;
  return v;
}

function cosine(a, b) {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i]; }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Layer 1 (verbatim from question-filter.service.ts) ───────────────────────
const LAYER_1_MAX_LENGTH = 60;
const LAYER_1_REGEXES = [
  /^\s*(hi|hello|hey|hiya|howdy|good\s+(morning|afternoon|evening|night)|greetings|sup|yo)[\s!.?]*$/i,
  /^\s*(ok|okay|alright|cool|nice|great|thanks|thank\s+you|ty|np|yep|yes|no|nope|sure|fine|got\s+it)[\s!.?]*$/i,
  /^\s*(test|asdf|qwerty|xyz|lol|haha|lmao|xd|wtf|brb|gtg|jk|smh|hmm+|huh)[\s!.?]*$/i,
  /^\s*(how\s+are\s+you|how['']?s\s+it\s+going|how\s+have\s+you\s+been|what['']?s\s+up|what['']?s\s+new|nice\s+to\s+meet\s+you)[\s!.?]*$/i,
];
function layer1(content) {
  const t = content.trim();
  if (t.length > LAYER_1_MAX_LENGTH) return false;
  return LAYER_1_REGEXES.some((re) => re.test(t));
}

const PRIOR_ANSWER_PREFIX_CHARS = 240;

// ─── Load data ────────────────────────────────────────────────────────────────
const corpus = JSON.parse(fs.readFileSync(path.join(appRoot, 'src/data/filter-corpus.json'), 'utf-8')).entries;
const evalData = JSON.parse(fs.readFileSync(path.join(appRoot, 'tests/fixtures/filter-threshold-eval.json'), 'utf-8'));
const evalItems = [...evalData.singleTurn, ...evalData.multiTurn];

console.log(`\nProvider=${PROVIDER} Model=${MODEL}${DIMENSIONS ? ` dim=${DIMENSIONS}` : ''}`);
console.log(`Corpus=${corpus.length} exemplars | Eval=${evalItems.length} labeled items\n`);

// ─── Embed corpus ─────────────────────────────────────────────────────────────
if (QUERY_PREFIX || DOC_PREFIX) console.log(`Prefixes: query=${JSON.stringify(QUERY_PREFIX)} doc=${JSON.stringify(DOC_PREFIX)}`);
process.stdout.write('Embedding corpus');
for (const e of corpus) { e.vector = await embed(`${DOC_PREFIX}${e.text}`); process.stdout.write('.'); }
process.stdout.write('\nEmbedding eval');
for (const it of evalItems) {
  it.rawVec = await embed(`${QUERY_PREFIX}${it.text}`);
  it.contextVec = it.priorAnswer
    ? await embed(`${QUERY_PREFIX}${it.priorAnswer.slice(0, PRIOR_ANSWER_PREFIX_CHARS)} ${it.text}`)
    : it.rawVec;
  process.stdout.write('.');
}
process.stdout.write('\n');
if (cacheDirty && CACHE_FILE) fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));

// ─── Score each eval item (best cosine per label) ─────────────────────────────
// Malicious uses rawVec; off-topic + on-topic use contextVec (dual-vector rule).
for (const it of evalItems) {
  let bestMal = -1, bestOff = -1, bestOn = -1;
  let exMal = '', exOff = '', exOn = '';
  for (const c of corpus) {
    if (c.label === 'malicious') { const s = cosine(it.rawVec, c.vector); if (s > bestMal) { bestMal = s; exMal = c.text; } }
    else if (c.label === 'off-topic') { const s = cosine(it.contextVec, c.vector); if (s > bestOff) { bestOff = s; exOff = c.text; } }
    else { const s = cosine(it.contextVec, c.vector); if (s > bestOn) { bestOn = s; exOn = c.text; } }
  }
  it.bestMal = bestMal; it.bestOff = bestOff; it.bestOn = bestOn;
  it.exMal = exMal; it.exOff = exOff; it.exOn = exOn;
  it.layer1Off = layer1(it.text);
}

function predict(it, malThr, offThr) {
  if (it.layer1Off) return 'off-topic';
  if (it.bestMal >= malThr) return 'malicious';
  if (it.bestOff >= offThr) return 'off-topic';
  return 'on-topic';
}

// ─── Per-item score table ─────────────────────────────────────────────────────
const DEF_OFF = 0.75, DEF_MAL = 0.82;
console.log('─'.repeat(92));
console.log('PER-ITEM SCORES (best cosine per label) — predicted @ current defaults off=0.75 mal=0.82');
console.log('─'.repeat(92));
console.log('id'.padEnd(11) + 'truth'.padEnd(11) + 'mal'.padEnd(7) + 'off'.padEnd(7) + 'on'.padEnd(7) + 'pred@def'.padEnd(11) + 'ok hard');
for (const it of evalItems) {
  const pred = predict(it, DEF_MAL, DEF_OFF);
  const ok = pred === it.label ? '✓' : '✗';
  console.log(
    it.id.padEnd(11) + it.label.padEnd(11) +
    it.bestMal.toFixed(3).padEnd(7) + it.bestOff.toFixed(3).padEnd(7) + it.bestOn.toFixed(3).padEnd(7) +
    pred.padEnd(11) + `${ok}  ${it.hard ? 'HARD' : ''}`,
  );
}

// ─── Confusion + metrics helper ───────────────────────────────────────────────
function evaluate(malThr, offThr) {
  let correct = 0;
  let malTotal = 0, malCaught = 0;        // malicious recall
  let benignBlocked = 0;                   // on/off-topic predicted malicious (UX-critical FP)
  let otTotal = 0, otCorrect = 0;          // off-topic recall
  let onTotal = 0, onCorrect = 0;          // on-topic recall (don't over-flag learners)
  for (const it of evalItems) {
    const pred = predict(it, malThr, offThr);
    if (pred === it.label) correct++;
    if (it.label === 'malicious') { malTotal++; if (pred === 'malicious') malCaught++; }
    else if (pred === 'malicious') benignBlocked++;
    if (it.label === 'off-topic') { otTotal++; if (pred === 'off-topic') otCorrect++; }
    if (it.label === 'on-topic') { onTotal++; if (pred === 'on-topic') onCorrect++; }
  }
  return {
    acc: correct / evalItems.length,
    malRecall: malCaught / malTotal,
    malMissed: malTotal - malCaught,
    benignBlocked,
    otRecall: otCorrect / otTotal,
    onRecall: onCorrect / onTotal,
  };
}

// ─── Malicious threshold sweep (clamped band 0.78–0.85), off-topic fixed ──────
console.log('\n' + '─'.repeat(92));
console.log('MALICIOUS THRESHOLD SWEEP (security clamp band 0.78–0.85; off-topic fixed at 0.75)');
console.log('thr'.padEnd(7) + 'malRecall'.padEnd(12) + 'missed'.padEnd(9) + 'benignBlocked'.padEnd(16) + 'overallAcc');
for (let t = 0.78; t <= 0.851; t += 0.005) {
  const m = evaluate(t, DEF_OFF);
  console.log(
    t.toFixed(3).padEnd(7) + (m.malRecall * 100).toFixed(0).padEnd(2).concat('%').padEnd(12) +
    String(m.malMissed).padEnd(9) + String(m.benignBlocked).padEnd(16) + (m.acc * 100).toFixed(1) + '%',
  );
}

// ─── Off-topic threshold sweep, malicious fixed at default ────────────────────
console.log('\n' + '─'.repeat(92));
console.log('OFF-TOPIC THRESHOLD SWEEP (malicious fixed at 0.82)');
console.log('thr'.padEnd(7) + 'offRecall'.padEnd(12) + 'onRecall'.padEnd(12) + 'overallAcc');
for (let t = 0.70; t <= 0.921; t += 0.01) {
  const m = evaluate(DEF_MAL, t);
  console.log(
    t.toFixed(2).padEnd(7) + (m.otRecall * 100).toFixed(0).concat('%').padEnd(12) +
    (m.onRecall * 100).toFixed(0).concat('%').padEnd(12) + (m.acc * 100).toFixed(1) + '%',
  );
}

// ─── Joint 2D grid (off-topic × malicious) ───────────────────────────────────
// Off-topic stays within its documented floor (>= 0.75); malicious within the
// security clamp [0.78, 0.85]. Ranked by overall accuracy, zero-benign-blocked
// preferred. This is the authoritative "best pair" search.
console.log('\n' + '─'.repeat(92));
console.log('JOINT GRID — best (off-topic, malicious) pairs  [off>=0.75 floor, mal in 0.78-0.85 clamp]');
console.log('off'.padEnd(7) + 'mal'.padEnd(7) + 'acc'.padEnd(9) + 'malRecall'.padEnd(12) + 'offRecall'.padEnd(12) + 'onRecall'.padEnd(11) + 'benignBlocked');
const grid = [];
for (let off = 0.75; off <= 0.811; off += 0.01) {
  for (let mal = 0.78; mal <= 0.851; mal += 0.005) {
    const m = evaluate(mal, off);
    grid.push({ off, mal, ...m });
  }
}
grid.sort((a, b) => (b.acc - a.acc) || (a.benignBlocked - b.benignBlocked) || (b.malRecall - a.malRecall));
for (const g of grid.slice(0, 8)) {
  console.log(
    g.off.toFixed(2).padEnd(7) + g.mal.toFixed(3).padEnd(7) +
    (g.acc * 100).toFixed(1).concat('%').padEnd(9) +
    (g.malRecall * 100).toFixed(0).concat('%').padEnd(12) +
    (g.otRecall * 100).toFixed(0).concat('%').padEnd(12) +
    (g.onRecall * 100).toFixed(0).concat('%').padEnd(11) +
    String(g.benignBlocked),
  );
}

// ─── Recommendation ───────────────────────────────────────────────────────────
// Malicious: within [0.78,0.85] maximize recall subject to zero benign-blocked;
//            tie-break toward HIGHER thr (safer against future false-positives).
let bestMal = null;
for (let t = 0.85; t >= 0.779; t -= 0.005) {
  const m = evaluate(t, DEF_OFF);
  if (m.benignBlocked === 0) { if (!bestMal || m.malRecall > bestMal.recall) bestMal = { thr: t, recall: m.malRecall, missed: m.malMissed }; }
}
if (!bestMal) {
  // No zero-FP point — pick max recall, report the FP cost.
  let best = null;
  for (let t = 0.78; t <= 0.851; t += 0.005) { const m = evaluate(t, DEF_OFF); if (!best || m.malRecall > best.recall) best = { thr: t, recall: m.malRecall, missed: m.malMissed, fp: m.benignBlocked }; }
  bestMal = best;
}

// Off-topic: maximize balanced (offRecall + onRecall)/2; tie-break toward higher
//            on-topic recall (don't punish genuine learners by over-flagging).
let bestOff = null;
for (let t = 0.70; t <= 0.921; t += 0.01) {
  const m = evaluate(DEF_MAL, t);
  const bal = (m.otRecall + m.onRecall) / 2;
  if (!bestOff || bal > bestOff.bal || (bal === bestOff.bal && m.onRecall > bestOff.onRecall)) {
    bestOff = { thr: t, bal, otRecall: m.otRecall, onRecall: m.onRecall };
  }
}

const finalMetrics = evaluate(bestMal.thr, bestOff.thr);
const defMetrics = evaluate(DEF_MAL, DEF_OFF);
console.log('\n' + '═'.repeat(92));
console.log('RECOMMENDATION');
console.log('═'.repeat(92));
console.log(`  malicious threshold : ${bestMal.thr.toFixed(3)}  (was 0.820)  — malRecall=${(bestMal.recall * 100).toFixed(0)}% missed=${bestMal.missed}${bestMal.fp ? ` benignBlocked=${bestMal.fp}` : ' benignBlocked=0'}`);
console.log(`  off-topic threshold : ${bestOff.thr.toFixed(2)}   (was 0.75)   — offRecall=${(bestOff.otRecall * 100).toFixed(0)}% onRecall=${(bestOff.onRecall * 100).toFixed(0)}%`);
console.log(`  overall accuracy    : ${(defMetrics.acc * 100).toFixed(1)}% @ defaults  →  ${(finalMetrics.acc * 100).toFixed(1)}% @ recommended`);
console.log('\n  NOTE: malicious threshold is security-clamped to [0.78, 0.85]; recommendation respects that band.');
console.log('  Review the per-item misses above before applying — a recommendation that lowers');
console.log('  the malicious threshold to catch one paraphrase may not be worth re-opening FP surface.\n');

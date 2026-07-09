// Profiling artifact for GAP-B (BUGFIX-05): localize the dominant cost of the
// Planner trellis at production scale (large knowledge graphs).
//
// MEASURE FIRST — this script does NOT apply a fix. It seeds large synthetic
// graphs (N ∈ {200, 1000, 3000} anchors with QA children), times each phase of
// buildTrellisState in isolation, and prints a per-phase ms breakdown plus an
// event-storm estimate (B consecutive GRAPH_UPDATED recomputes).
//
// Runs under the repo's node --test harness (tsx loader via test:main glob).
//   cd app && node --test scripts/profile-trellis.mjs
//
// Phases timed:
//   (a) full buildTrellisState(questions)
//   (b) aggregate per-node computeLeafState cost (in isolation, no side-effects)
//   (c) fcMap build (flashcardService.getAll() pass)
//   (d) in-loop blossom-date persistence side-effect (setBlossomDate / clearBlossomDate)
//   (e) B-event recompute storm (buildTrellisState × B)
//
// The dominant phase is printed as "DOMINANT: <phase> at N=3000" and pasted
// into 55.1-06-SUMMARY.md as the measurement artifact Task 2's fix must cite.

import test from 'node:test';
import { __setNowForTesting, today } from '../src/lib/date.ts';

// ── In-memory localStorage shim (node --test has no DOM) ──────────────────────
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
  key: (i) => Array.from(storage.keys())[i] ?? null,
  get length() { return storage.size; },
};

// Pin the clock so overdue arithmetic + blossom-date math is deterministic.
__setNowForTesting(new Date(2026, 4, 20, 12, 0, 0).getTime());

const {
  buildTrellisState,
  computeLeafState,
} = await import('../src/services/trellis-state.service.ts');
const {
  buildAnchorReflectionTree,
} = await import('../src/services/canonical-knowledge.service.ts');
const {
  getBlossomDates, setBlossomDate, clearBlossomDate,
} = await import('../src/services/trellis-blossom-dates.service.ts');
const { flashcardService } = await import('../src/services/flashcard.service.ts');

// ── Synthetic graph seeding ───────────────────────────────────────────────────
// Mirrors the Question shape questionService.getAll() returns. Spreads anchors
// across multiple branches/clusters and gives each anchor a few QA children.
// A fraction of anchors are seeded to reach 'blossom' (all children reviewed +
// ease > 2.5) so the in-loop blossom-date persistence side-effect actually fires.
function seedGraph(nAnchors, { childrenPer = 3, branches = 12, clustersPerBranch = 5, blossomFraction = 0.3 } = {}) {
  const questions = [];
  const isoToday = today();
  for (let i = 0; i < nAnchors; i++) {
    const branchIdx = i % branches;
    const clusterIdx = (i / branches | 0) % clustersPerBranch;
    const anchorId = `anchor-${i}`;
    const isBlossom = (i % 100) < (blossomFraction * 100);
    // blossom anchors: children all reviewed + high ease; otherwise overdue mix
    questions.push({
      id: anchorId,
      content: `concept ${i}`,
      answer: 'a',
      title: `Concept ${i}`,
      keywords: [],
      timestamp: Date.now(),
      date: isoToday,
      isAnchorNode: true,
      rootLabel: 'Knowledge',
      branchLabel: `Branch ${branchIdx}`,
      clusterLabel: `Cluster ${branchIdx}-${clusterIdx}`,
      reviewSchedule: { nextReviewDate: isoToday, reviewCount: 2, easeFactor: 2.8, interval: 5, lastReviewedAt: null },
      createdAt: Date.now(),
    });
    for (let c = 0; c < childrenPer; c++) {
      questions.push({
        id: `${anchorId}-qa-${c}`,
        content: `qa ${i}-${c}`,
        answer: 'a',
        title: `QA ${i}-${c}`,
        keywords: [],
        timestamp: Date.now(),
        date: isoToday,
        parentId: anchorId,
        rootLabel: 'Knowledge',
        branchLabel: `Branch ${branchIdx}`,
        clusterLabel: `Cluster ${branchIdx}-${clusterIdx}`,
        reviewSchedule: isBlossom
          ? { nextReviewDate: '2026-06-10', reviewCount: 3, easeFactor: 2.9, interval: 12, lastReviewedAt: null }
          : { nextReviewDate: '2026-05-15', reviewCount: 1, easeFactor: 2.0, interval: 3, lastReviewedAt: null },
        createdAt: Date.now(),
      });
    }
  }
  return questions;
}

function ms(fn) {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
}

// Time (b): aggregate per-node computeLeafState in isolation (rebuild tree once,
// then call computeLeafState for every anchor + legacy node without persistence).
function timeComputeLeafStateAggregate(questions) {
  const tree = buildAnchorReflectionTree(questions);
  const blossomDates = getBlossomDates();
  let n = 0;
  const dt = ms(() => {
    tree.forEach((root) => root.branches.forEach((branch) => branch.clusters.forEach((cluster) => {
      cluster.anchors.forEach(({ anchor, qaChildren }) => { computeLeafState(anchor, qaChildren, blossomDates[anchor.id]); n++; });
      cluster.legacyNodes.forEach((q) => { computeLeafState(q, [], blossomDates[q.id]); n++; });
    })));
  });
  return { dt, n };
}

// Time (c): fcMap build pass (flashcardService.getAll()).
function timeFcMapBuild() {
  return ms(() => {
    const fcMap = new Map();
    const allCards = flashcardService.getAll();
    for (const card of allCards) {
      if (!card.nodeId) continue;
      const existing = fcMap.get(card.nodeId);
      if (!existing || card.reviewSchedule.reviewCount > existing.reviewCount) fcMap.set(card.nodeId, card.reviewSchedule);
    }
  });
}

// Time (d): in-loop blossom-date persistence side-effect. Reproduce the EXACT
// pattern in buildTrellisState: for each blossom node, getBlossomDates() +
// setBlossomDate() (each a full JSON.parse + JSON.stringify of the growing map).
function timeBlossomWriteSideEffect(questions) {
  storage.clear(); // start with empty blossom map so every blossom node WRITES
  const tree = buildAnchorReflectionTree(questions);
  let writes = 0;
  const dt = ms(() => {
    const blossomDates = getBlossomDates();
    tree.forEach((root) => root.branches.forEach((branch) => branch.clusters.forEach((cluster) => {
      cluster.anchors.forEach(({ anchor, qaChildren }) => {
        const state = computeLeafState(anchor, qaChildren, blossomDates[anchor.id]);
        if (state === 'blossom' || state === 'fruit') {
          if (!blossomDates[anchor.id]) { const t = today(); blossomDates[anchor.id] = t; setBlossomDate(anchor.id, t); writes++; }
        } else if (blossomDates[anchor.id]) { delete blossomDates[anchor.id]; clearBlossomDate(anchor.id); writes++; }
      });
    })));
  });
  return { dt, writes };
}

function fmt(x) { return x.toFixed(2).padStart(9); }

test('profile-trellis: per-phase breakdown at production scale', () => {
  const Ns = [200, 1000, 3000];
  const B = 8; // event-storm: 8 consecutive GRAPH_UPDATED recomputes
  const rows = [];

  console.log('\n=== Trellis profiling (GAP-B / BUGFIX-05) ===');
  console.log('Each N = anchor count; +3 QA children per anchor; 30% blossom; 12 branches.');
  console.log(`Columns (ms): build=full buildTrellisState | leafAgg=Σ computeLeafState | fcMap | blossomWrite=in-loop persistence | storm=build×${B}`);
  console.log('N      | nodes  |     build |   leafAgg |     fcMap | blossomWrite |     storm');
  console.log('-------|--------|-----------|-----------|-----------|--------------|----------');

  for (const N of Ns) {
    const questions = seedGraph(N);
    // warm any module-level caches once, untimed
    storage.clear();
    buildTrellisState(questions);

    storage.clear();
    const build = ms(() => buildTrellisState(questions));
    const leaf = timeComputeLeafStateAggregate(questions);
    const fcMap = timeFcMapBuild();
    const blossom = timeBlossomWriteSideEffect(questions);

    storage.clear();
    const storm = ms(() => { for (let b = 0; b < B; b++) buildTrellisState(questions); });

    const nodeCount = N + N * 3; // anchors + children that became leaves? children are qaChildren, not separate leaves
    rows.push({ N, nodeCount: N, build, leafAgg: leaf.dt, fcMap, blossomWrite: blossom.dt, blossomWrites: blossom.writes, storm });
    console.log(`${String(N).padEnd(6)} | ${String(N).padEnd(6)} |${fmt(build)} |${fmt(leaf.dt)} |${fmt(fcMap)} |${fmt(blossom.dt).padStart(13)} |${fmt(storm)}`);
  }

  // Identify the dominant phase at N=3000 (the production-scale row).
  const big = rows[rows.length - 1];
  const phases = {
    'computeLeafState aggregate': big.leafAgg,
    'fcMap build': big.fcMap,
    'blossom-write side-effect (in-loop persistence)': big.blossomWrite,
  };
  let dominant = null, dominantMs = -Infinity;
  for (const [name, v] of Object.entries(phases)) { if (v > dominantMs) { dominantMs = v; dominant = name; } }

  console.log('');
  console.log(`At N=${big.N}: full buildTrellisState = ${big.build.toFixed(2)} ms; event-storm (×8) = ${big.storm.toFixed(2)} ms`);
  console.log(`Phase split @N=${big.N}: leafAgg=${big.leafAgg.toFixed(2)} | fcMap=${big.fcMap.toFixed(2)} | blossomWrite=${big.blossomWrite.toFixed(2)} (${big.blossomWrites} writes)`);
  console.log(`DOMINANT: ${dominant} at N=${big.N} (${dominantMs.toFixed(2)} ms)`);
  console.log('=== end profiling ===\n');

  // No assertions on absolute timings (machine-dependent); this is a measurement
  // artifact. We only assert it produced a result so the harness reports success.
  if (rows.length !== Ns.length) throw new Error('profiling did not cover all N');
});

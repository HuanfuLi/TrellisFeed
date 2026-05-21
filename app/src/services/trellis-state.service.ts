import type { Question, ReviewSchedule } from '../types/index.ts';
import { buildAnchorReflectionTree } from './canonical-knowledge.service.ts';
import {
  getBlossomDates, replaceBlossomDates,
} from './trellis-blossom-dates.service.ts';
import { generateVinePath, getLeafPosition, getVineColor, hashStr, type VinePathSpec } from './trellis-layout.service.ts';
import { flashcardService } from './flashcard.service.ts';
import { today, nowMs } from '../lib/date.ts';

export type LeafState = 'bud' | 'green' | 'dying' | 'falling' | 'dead' | 'blossom' | 'fruit';

export interface TrellisAnchorNode {
  anchor: Question;
  qaChildren: Question[];
  leafState: LeafState;
  branchLabel: string;
  branchId: string;
  branchIndex: number;
  layoutPosition: { x: number; y: number };
  vineAttach: { x: number; y: number };
  tangentAngle: number; // vine direction at attachment (degrees)
  side: number;         // +1 or -1 (which side of vine)
  botanicalCategory: number; // 0-7, index into BOTANICAL_CATEGORIES
  blossomSinceDate?: string;
}

export interface TrellisLayout {
  nodes: TrellisAnchorNode[];
  vines: Array<{ branchId: string; branchLabel: string; branchIndex: number; spec: VinePathSpec; color: string }>;
}

function computeDaysOverdue(nextReviewDate: string): number {
  const todayDate = new Date(nowMs());
  const [y, m, d] = nextReviewDate.split('-').map(Number);
  if (!y || !m || !d) return 0;
  const reviewDate = new Date(y, m - 1, d);
  return Math.floor((todayDate.getTime() - reviewDate.getTime()) / 86400000);
}

// Resolve best review data: prefer FlashCard data (actually updated by review flow)
// over Question.reviewSchedule (often stale at initial values).
function resolveReview(q: Question, fcMap: Map<string, ReviewSchedule>): ReviewSchedule {
  return fcMap.get(q.id) ?? q.reviewSchedule ?? { nextReviewDate: '', reviewCount: 0, easeFactor: 2.5 };
}

export function computeLeafState(
  anchor: Question,
  qaChildren: Question[],
  blossomSinceDate?: string,
  fcMap?: Map<string, ReviewSchedule>,
): LeafState {
  const fm = fcMap ?? new Map();
  const anchorReview = resolveReview(anchor, fm);
  const childReviews = qaChildren.map((q) => resolveReview(q, fm));

  // Bud gate (UAT Bug 1 fix): bud means "truly fresh concept, hasn't entered
  // the review treadmill yet." The pre-fix gate fired whenever reviewCount
  // was zero everywhere — which is the normal state for a user who creates
  // Q&As but never opens the Flashcards flow. Those concepts then stayed
  // bud forever, even when their Q&A reviewSchedule.nextReviewDate was
  // weeks overdue. Phase 51's leaf-state badge made this visible and
  // surfaced the design flaw.
  //
  // New semantics: bud only when the anchor has NO Q&A children AND has
  // never been reviewed itself. Once a concept has children, the review
  // treadmill has effectively started — overdue aggregation below handles
  // dying/falling/dead/green/blossom transitions. Children with empty
  // nextReviewDate are skipped in the overdue loop and naturally fall
  // through to 'green' (no overdue signal → healthy by default).
  const anchorReviewCount = anchorReview.reviewCount ?? 0;
  const anchorEverReviewed = anchorReviewCount > 0 || (anchor.lastReviewedAt != null && anchor.lastReviewedAt > 0);
  if (qaChildren.length === 0 && !anchorEverReviewed) return 'bud';

  // Fruit check (D-09): 7+ consecutive days in blossom
  if (blossomSinceDate) {
    const [by, bm, bd] = blossomSinceDate.split('-').map(Number);
    if (by && bm && bd) {
      const blossomDate = new Date(by, bm - 1, bd);
      const daysSince = Math.floor((nowMs() - blossomDate.getTime()) / 86400000);
      if (daysSince >= 7) return 'fruit';
    }
  }

  // Blossom check (D-08): all children reviewed AND aggregate easeFactor > 2.5
  const allReviewed = childReviews.length > 0 && childReviews.every((r) => (r.reviewCount ?? 0) > 0);
  const aggregateEase = childReviews.length > 0
    ? childReviews.reduce((sum, r) => sum + (r.easeFactor ?? 2.5), 0) / childReviews.length
    : (anchorReview.easeFactor ?? 2.5);
  if (allReviewed && aggregateEase > 2.5) return 'blossom';

  // Overdue aggregation (worst-child-wins per D-07)
  const pool = childReviews.length > 0 ? childReviews : [anchorReview];
  let maxOverdue = -Infinity;
  for (const r of pool) {
    const nrd = r.nextReviewDate;
    if (!nrd) continue;
    const d = computeDaysOverdue(nrd);
    if (d > maxOverdue) maxOverdue = d;
  }
  if (maxOverdue >= 14 || aggregateEase < 1.5) return 'dead';
  if (maxOverdue >= 7) return 'falling';
  if (maxOverdue >= 1) return 'dying';
  return 'green';
}



// Dev mode: 10 vines with varying heights (1-15 nodes each),
// showing all 8 botanical categories across all leaf states.
// Mimics a realistic garden with sparse and dense branches.
function buildDevTrellisState(): TrellisLayout {
  const vineCount = 10;
  // Varying node counts → varying vine heights
  const nodesPerVine = [1, 2, 3, 4, 5, 7, 10, 12, 15, 20];
  const vineDefs = Array.from({ length: vineCount }, (_, i) => {
    const id = `dev::vine-${i}`;
    return { branchId: id, branchLabel: `Vine ${i + 1}`, branchIndex: i,
      spec: generateVinePath(id, i, vineCount, nodesPerVine[i]), color: getVineColor(id) };
  });

  // Build nodes: assign to vines round-robin, covering all states and categories
  const devEntries: Array<{ state: LeafState; cat: number; vineIdx: number }> = [
    // Each vine gets 1-3 nodes to keep it sparse and realistic
    // Vine 0 (1 node): single bud
    { state: 'bud', cat: 0, vineIdx: 0 },
    // Vine 1 (2 nodes): bud + green
    { state: 'bud', cat: 1, vineIdx: 1 }, { state: 'green', cat: 1, vineIdx: 1 },
    // Vine 2 (3 nodes): green leaves
    { state: 'green', cat: 2, vineIdx: 2 }, { state: 'green', cat: 3, vineIdx: 2 }, { state: 'dying', cat: 2, vineIdx: 2 },
    // Vine 3: mixed health
    { state: 'dying', cat: 4, vineIdx: 3 }, { state: 'falling', cat: 4, vineIdx: 3 }, { state: 'green', cat: 5, vineIdx: 3 },
    // Vine 4: decay
    { state: 'falling', cat: 6, vineIdx: 4 }, { state: 'dead', cat: 7, vineIdx: 4 }, { state: 'dying', cat: 6, vineIdx: 4 },
    // Vine 5: blossoms
    { state: 'blossom', cat: 0, vineIdx: 5 }, { state: 'blossom', cat: 1, vineIdx: 5 }, { state: 'green', cat: 0, vineIdx: 5 },
    // Vine 6: more blossoms
    { state: 'blossom', cat: 2, vineIdx: 6 }, { state: 'blossom', cat: 3, vineIdx: 6 }, { state: 'blossom', cat: 4, vineIdx: 6 },
    // Vine 7: fruits
    { state: 'fruit', cat: 0, vineIdx: 7 }, { state: 'fruit', cat: 1, vineIdx: 7 }, { state: 'fruit', cat: 2, vineIdx: 7 }, { state: 'green', cat: 3, vineIdx: 7 },
    // Vine 8: more fruits
    { state: 'fruit', cat: 3, vineIdx: 8 }, { state: 'fruit', cat: 4, vineIdx: 8 }, { state: 'fruit', cat: 5, vineIdx: 8 }, { state: 'blossom', cat: 5, vineIdx: 8 },
    // Vine 9 (tallest): mixed garden
    { state: 'fruit', cat: 6, vineIdx: 9 }, { state: 'fruit', cat: 7, vineIdx: 9 }, { state: 'blossom', cat: 6, vineIdx: 9 },
    { state: 'blossom', cat: 7, vineIdx: 9 }, { state: 'green', cat: 7, vineIdx: 9 },
  ];

  const nodes: TrellisAnchorNode[] = devEntries.map(({ state, cat, vineIdx }, i) => {
    const vine = vineDefs[vineIdx];
    const fakeId = `dev-${state}-cat${cat}-v${vineIdx}-${i}`;
    const leafPos = getLeafPosition(fakeId, vine.spec);
    return {
      anchor: { id: fakeId, content: state, answer: '', summary: '', date: new Date(0).toISOString(), timestamp: 0, title: `${state} (cat ${cat})`, keywords: [], relatedQuestionIds: [], categoryIds: [], reviewSchedule: { nextReviewDate: '', reviewCount: 0, easeFactor: 2.5 }, createdAt: 0 } as Question,
      qaChildren: [],
      leafState: state,
      branchLabel: vine.branchLabel,
      branchId: vine.branchId,
      branchIndex: vine.branchIndex,
      layoutPosition: { x: leafPos.x, y: leafPos.y },
      vineAttach: { x: leafPos.vineX, y: leafPos.vineY },
      tangentAngle: leafPos.tangentAngle,
      side: leafPos.side,
      botanicalCategory: cat,
    };
  });

  return { nodes, vines: vineDefs };
}

// Build full trellis state: returns layout for all branches + state-computed anchor nodes.
// Reads blossom dates from localStorage, writes new blossom dates for anchors that just reached blossom,
// and clears dates for anchors that dropped below blossom.
export function buildTrellisState(questions: Question[]): TrellisLayout {
  // Dev mode: show all 7 leaf states on dummy nodes for visual debugging
  if (typeof localStorage !== 'undefined' && localStorage.getItem('trellis_dev_mode') === 'true') {
    return buildDevTrellisState();
  }

  if (!questions || questions.length === 0) {
    return { nodes: [], vines: [] };
  }

  const tree = buildAnchorReflectionTree(questions);
  const blossomDates = getBlossomDates();
  // PERF (55.1-06 / BUGFIX-05): the per-node setBlossomDate/clearBlossomDate
  // calls below USED to each do a full getBlossomDates() (JSON.parse) +
  // setItem() (JSON.stringify) of the growing map — O(N^2) localStorage churn,
  // measured as the DOMINANT cost at production scale (54.24 ms of a 60.87 ms
  // build at N=3000; see app/scripts/profile-trellis.mjs). We now mutate the
  // in-memory `blossomDates` map during the loop and flush ONCE after the loop
  // via a single replaceBlossomDates() write. Leaf-state outputs are identical
  // — only the persistence is batched.
  let blossomDatesDirty = false;

  // Build FlashCard review lookup: nodeId → best ReviewSchedule
  // Reviews update FlashCards (not Questions), so this is the authoritative source.
  const fcMap = new Map<string, ReviewSchedule>();
  try {
    const allCards = flashcardService.getAll();
    for (const card of allCards) {
      if (!card.nodeId) continue;
      const existing = fcMap.get(card.nodeId);
      // Keep the card with the most reviews (best signal)
      if (!existing || (card.reviewSchedule.reviewCount > existing.reviewCount)) {
        fcMap.set(card.nodeId, card.reviewSchedule);
      }
    }
  } catch { /* flashcard service unavailable — fall back to question data */ }

  // Flat list of all (branchId, branchLabel, branchIndex, nodeCount) entries across all roots.
  const branches: Array<{ branchId: string; branchLabel: string; branchIndex: number; nodeCount: number }> = [];
  tree.forEach((root) => {
    root.branches.forEach((branch) => {
      const branchId = `${root.rootLabel}::${branch.branchLabel}`;
      let count = 0;
      branch.clusters.forEach((c) => { count += c.anchors.length + c.legacyNodes.length; });
      branches.push({ branchId, branchLabel: branch.branchLabel, branchIndex: branches.length, nodeCount: count });
    });
  });

  const totalBranches = Math.max(1, branches.length);
  const vines = branches.map((b) => ({
    branchId: b.branchId,
    branchLabel: b.branchLabel,
    branchIndex: b.branchIndex,
    spec: generateVinePath(b.branchId, b.branchIndex, totalBranches, b.nodeCount),
    color: getVineColor(b.branchId),
  }));

  const nodes: TrellisAnchorNode[] = [];
  tree.forEach((root) => {
    root.branches.forEach((branch) => {
      const branchId = `${root.rootLabel}::${branch.branchLabel}`;
      const vine = vines.find((v) => v.branchId === branchId)!;
      branch.clusters.forEach((cluster) => {
        // Process anchors with their children
        cluster.anchors.forEach(({ anchor, qaChildren }) => {
          const state = computeLeafState(anchor, qaChildren, blossomDates[anchor.id], fcMap);
          // Blossom date persistence (Pitfall 4) — batched: mutate in-memory map,
          // flush once after the loop (see blossomDatesDirty above).
          if (state === 'blossom' || state === 'fruit') {
            if (!blossomDates[anchor.id]) {
              blossomDates[anchor.id] = today();
              blossomDatesDirty = true;
            }
          } else if (blossomDates[anchor.id]) {
            delete blossomDates[anchor.id];
            blossomDatesDirty = true;
          }
          const leafPos = getLeafPosition(anchor.id, vine.spec);
          nodes.push({
            anchor,
            qaChildren,
            leafState: state,
            branchLabel: branch.branchLabel,
            branchId,
            branchIndex: vine.branchIndex,
            layoutPosition: { x: leafPos.x, y: leafPos.y },
            vineAttach: { x: leafPos.vineX, y: leafPos.vineY },
            tangentAngle: leafPos.tangentAngle,
            side: leafPos.side,
            botanicalCategory: hashStr(anchor.id) % 8,
            blossomSinceDate: blossomDates[anchor.id],
          });
        });
        // Legacy questions (not yet classified as anchors) show as standalone leaves
        cluster.legacyNodes.forEach((q) => {
          const state = computeLeafState(q, [], blossomDates[q.id], fcMap);
          if (state === 'blossom' || state === 'fruit') {
            if (!blossomDates[q.id]) {
              blossomDates[q.id] = today();
              blossomDatesDirty = true;
            }
          } else if (blossomDates[q.id]) {
            delete blossomDates[q.id];
            blossomDatesDirty = true;
          }
          const leafPos = getLeafPosition(q.id, vine.spec);
          nodes.push({
            anchor: q,
            qaChildren: [],
            leafState: state,
            branchLabel: branch.branchLabel,
            branchId,
            branchIndex: vine.branchIndex,
            layoutPosition: { x: leafPos.x, y: leafPos.y },
            vineAttach: { x: leafPos.vineX, y: leafPos.vineY },
            tangentAngle: leafPos.tangentAngle,
            side: leafPos.side,
            botanicalCategory: hashStr(q.id) % 8,
            blossomSinceDate: blossomDates[q.id],
          });
        });
      });
    });
  });

  // PERF (55.1-06): single flush of all blossom-date set/clear ops collected
  // during the loop, replacing the prior O(N^2) per-node persistence.
  if (blossomDatesDirty) {
    replaceBlossomDates(blossomDates);
  }

  return { nodes, vines };
}

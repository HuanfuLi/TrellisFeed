import type { FlashCard, Question, ReviewSchedule } from '../types/index.ts';
import { buildAnchorReflectionTree } from './canonical-knowledge.service.ts';
import {
  getBlossomDates, setBlossomDate, clearBlossomDate,
} from './trellis-blossom-dates.service.ts';
import { generateVinePath, getLeafPosition, getVineColor, type VinePathSpec } from './trellis-layout.service.ts';
import { flashcardService } from './flashcard.service.ts';

export type LeafState = 'bud' | 'green' | 'yellow' | 'falling' | 'fallen' | 'blossom' | 'fruit';

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
  shapeVariant: number; // 0-2, for blossom/fruit variety
  blossomSinceDate?: string;
}

export interface TrellisLayout {
  nodes: TrellisAnchorNode[];
  vines: Array<{ branchId: string; branchLabel: string; branchIndex: number; spec: VinePathSpec; color: string }>;
}

function computeDaysOverdue(nextReviewDate: string): number {
  const todayDate = new Date();
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

  // Bud gate: if no reviews happened anywhere, it's a bud.
  const anchorReviewCount = anchorReview.reviewCount ?? 0;
  const anyChildReviewed = childReviews.some((r) => (r.reviewCount ?? 0) > 0);
  // Also check lastReviewedAt as a fallback signal
  const anchorEverReviewed = anchorReviewCount > 0 || (anchor.lastReviewedAt != null && anchor.lastReviewedAt > 0);
  if (!anchorEverReviewed && !anyChildReviewed) return 'bud';

  // Fruit check (D-09): 7+ consecutive days in blossom
  if (blossomSinceDate) {
    const [by, bm, bd] = blossomSinceDate.split('-').map(Number);
    if (by && bm && bd) {
      const blossomDate = new Date(by, bm - 1, bd);
      const daysSince = Math.floor((Date.now() - blossomDate.getTime()) / 86400000);
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
  if (maxOverdue >= 14 || aggregateEase < 1.5) return 'fallen';
  if (maxOverdue >= 7) return 'falling';
  if (maxOverdue >= 1) return 'yellow';
  return 'green';
}

const ALL_LEAF_STATES: LeafState[] = ['bud', 'green', 'yellow', 'falling', 'fallen', 'blossom', 'fruit'];

// Dev mode: generate synthetic nodes showing all 7 leaf states on 2 vines
function buildDevTrellisState(): TrellisLayout {
  const branchA = { branchId: 'dev::branch-a', branchLabel: 'Branch A', branchIndex: 0 };
  const branchB = { branchId: 'dev::branch-b', branchLabel: 'Branch B', branchIndex: 1 };
  const vineA = { ...branchA, spec: generateVinePath(branchA.branchId, 0, 2), color: getVineColor(branchA.branchId) };
  const vineB = { ...branchB, spec: generateVinePath(branchB.branchId, 1, 2), color: getVineColor(branchB.branchId) };
  const vines = [vineA, vineB];

  const nodes: TrellisAnchorNode[] = ALL_LEAF_STATES.map((state, i) => {
    const vine = i < 4 ? vineA : vineB;
    const fakeId = `dev-${state}-${i}`;
    const leafPos = getLeafPosition(fakeId, vine.spec);
    return {
      anchor: { id: fakeId, content: state, title: state.charAt(0).toUpperCase() + state.slice(1), keywords: [], relatedQuestionIds: [], categoryIds: [], reviewSchedule: { nextReviewDate: '', reviewCount: 0, easeFactor: 2.5 }, createdAt: 0 } as Question,
      qaChildren: [],
      leafState: state,
      branchLabel: vine.branchLabel,
      branchId: vine.branchId,
      branchIndex: vine.branchIndex,
      layoutPosition: { x: leafPos.x, y: leafPos.y },
      vineAttach: { x: leafPos.vineX, y: leafPos.vineY },
      tangentAngle: leafPos.tangentAngle,
      side: leafPos.side,
      shapeVariant: i % 3,
    };
  });

  return { nodes, vines };
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

  // Flat list of all (branchId, branchLabel, branchIndex) entries across all roots.
  const branches: Array<{ branchId: string; branchLabel: string; branchIndex: number }> = [];
  tree.forEach((root) => {
    root.branches.forEach((branch) => {
      const branchId = `${root.rootLabel}::${branch.branchLabel}`;
      branches.push({ branchId, branchLabel: branch.branchLabel, branchIndex: branches.length });
    });
  });

  const totalBranches = Math.max(1, branches.length);
  const vines = branches.map((b) => ({
    branchId: b.branchId,
    branchLabel: b.branchLabel,
    branchIndex: b.branchIndex,
    spec: generateVinePath(b.branchId, b.branchIndex, totalBranches),
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
          // Blossom date persistence (Pitfall 4)
          if (state === 'blossom' || state === 'fruit') {
            if (!blossomDates[anchor.id]) {
              const isoToday = new Date().toISOString().split('T')[0];
              blossomDates[anchor.id] = isoToday;
              setBlossomDate(anchor.id, isoToday);
            }
          } else if (blossomDates[anchor.id]) {
            delete blossomDates[anchor.id];
            clearBlossomDate(anchor.id);
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
            shapeVariant: hashStr(anchor.id) % 3,
            blossomSinceDate: blossomDates[anchor.id],
          });
        });
        // Legacy questions (not yet classified as anchors) show as standalone leaves
        cluster.legacyNodes.forEach((q) => {
          const state = computeLeafState(q, [], blossomDates[q.id], fcMap);
          if (state === 'blossom' || state === 'fruit') {
            if (!blossomDates[q.id]) {
              const isoToday = new Date().toISOString().split('T')[0];
              blossomDates[q.id] = isoToday;
              setBlossomDate(q.id, isoToday);
            }
          } else if (blossomDates[q.id]) {
            delete blossomDates[q.id];
            clearBlossomDate(q.id);
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
            shapeVariant: hashStr(q.id) % 3,
            blossomSinceDate: blossomDates[q.id],
          });
        });
      });
    });
  });

  return { nodes, vines };
}

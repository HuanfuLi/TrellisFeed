import type {
  CandidateContextPack,
  DailyReviewMap,
  FlashCard,
  HierarchySummary,
  IngestionDecision,
  KnowledgeNode,
  Question,
  StructuralSignalType,
} from '../types/index.ts';
import { cosine } from '../providers/embedding/index.ts';

const ROOT_FALLBACK = 'Knowledge';
const BRANCH_FALLBACK = 'General concepts';
const CLUSTER_FALLBACK = 'Open questions';

// Labels that were stored as fallbacks in early data — treat them as unset
// so keyword-derived labels are used at display/context time instead.
const VAGUE_LABELS = new Set([ROOT_FALLBACK, BRANCH_FALLBACK, CLUSTER_FALLBACK]);

function titleFor(question: Question): string {
  return question.title?.trim() || question.content.trim();
}

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toKeywords(text: string): string[] {
  const tokens = normalizeText(text)
    .split(' ')
    .filter((token) => token.length > 2);
  return Array.from(new Set(tokens)).slice(0, 8);
}

function buildFallbackPlacement(question: Question): Pick<KnowledgeNode, 'rootLabel' | 'branchLabel' | 'clusterLabel' | 'nodeSummary' | 'placementReason'> {
  const primary = question.keywords[0] || toKeywords(titleFor(question))[0] || 'learning';
  const secondary = question.keywords[1] || primary;
  // Treat vague fallback labels stored in early data as unset — derive from keywords instead.
  const storedRoot = question.rootLabel?.trim();
  const storedBranch = question.branchLabel?.trim();
  const storedCluster = question.clusterLabel?.trim();
  const rootLabel = (storedRoot && !VAGUE_LABELS.has(storedRoot)) ? storedRoot : ROOT_FALLBACK;
  const branchLabel = (storedBranch && !VAGUE_LABELS.has(storedBranch)) ? storedBranch : `${primary.charAt(0).toUpperCase()}${primary.slice(1)} concepts`;
  const clusterLabel = (storedCluster && !VAGUE_LABELS.has(storedCluster)) ? storedCluster : `${secondary.charAt(0).toUpperCase()}${secondary.slice(1)} cluster`;
  return {
    rootLabel,
    branchLabel,
    clusterLabel,
    nodeSummary: question.nodeSummary?.trim() || question.summary || question.answer,
    placementReason: question.placementReason?.trim() || `Grouped with ${primary}-related knowledge.`,
  };
}

export function projectQuestionToKnowledgeNode(question: Question): KnowledgeNode | null {
  // Guard: skip flagged questions unless the user has overridden (flagged=false)
  if (question.flagged === true) {
    return null;
  }
  // Guard: anchor nodes are concept containers, not reviewable Q&A nodes
  if (question.isAnchorNode === true) {
    return null;
  }
  const placement = buildFallbackPlacement(question);
  return {
    id: question.id,
    title: titleFor(question),
    content: question.content,
    answer: question.answer,
    summary: question.summary,
    storyHook: question.storyHook,
    keywords: question.keywords,
    relatedQuestionIds: question.relatedQuestionIds,
    parentId: question.parentId,
    aliases: question.aliases ?? [],
    sourcePrompts: question.sourcePrompts ?? [question.content],
    sourceQuestionIds: question.sourceQuestionIds ?? [question.id],
    rootLabel: placement.rootLabel,
    branchLabel: placement.branchLabel,
    clusterLabel: placement.clusterLabel,
    nodeSummary: placement.nodeSummary,
    placementReason: placement.placementReason,
    reviewSchedule: question.reviewSchedule,
    createdAt: question.createdAt,
    date: question.date,
    timestamp: question.timestamp,
    lastReviewedAt: question.lastReviewedAt,
    pinned: question.pinned,
    coCreationSignals: question.coCreationSignals,
  };
}

export function projectQuestionsToKnowledgeNodes(questions: Question[]): KnowledgeNode[] {
  return questions
    .filter((q) => q.flagged !== true)
    .map(projectQuestionToKnowledgeNode)
    .filter((node): node is KnowledgeNode => node !== null);
}

function keywordOverlapScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  return intersection / Math.max(setA.size, setB.size);
}

function stringOverlapScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.92;
  return keywordOverlapScore(toKeywords(a), toKeywords(b));
}

function candidateScore(query: string, node: KnowledgeNode): number {
  const normalizedQuery = normalizeText(query);
  const normalizedTitle = normalizeText(node.title);
  const normalizedPrompts = node.sourcePrompts.slice(0, 4).map((prompt) => normalizeText(prompt));
  const normalizedAliases = node.aliases.map((alias) => normalizeText(alias));

  if (
    normalizedQuery === normalizedTitle ||
    normalizedPrompts.includes(normalizedQuery) ||
    normalizedAliases.includes(normalizedQuery)
  ) {
    return 1;
  }

  const titleScore = stringOverlapScore(normalizedQuery, normalizeText(node.title));
  const aliasScore = Math.max(
    0,
    ...node.aliases.map((alias) => stringOverlapScore(normalizedQuery, normalizeText(alias))),
  );
  const promptScore = Math.max(
    0,
    ...node.sourcePrompts.slice(0, 4).map((prompt) => stringOverlapScore(normalizedQuery, normalizeText(prompt))),
  );
  const summaryScore = Math.max(
    stringOverlapScore(normalizedQuery, normalizeText(node.summary)),
    stringOverlapScore(normalizedQuery, normalizeText(node.answer)),
  );
  const structureScore = Math.max(
    stringOverlapScore(normalizedQuery, normalizeText(node.rootLabel)),
    stringOverlapScore(normalizedQuery, normalizeText(node.branchLabel)),
    stringOverlapScore(normalizedQuery, normalizeText(node.clusterLabel)),
  );
  const keywordScore = keywordOverlapScore(toKeywords(query), node.keywords);
  return titleScore * 0.24 + aliasScore * 0.12 + promptScore * 0.22 + summaryScore * 0.14 + structureScore * 0.14 + keywordScore * 0.14;
}

function summarizeGroup(label: string, nodes: KnowledgeNode[], idPrefix: string): HierarchySummary {
  const representativeKeywords = Array.from(
    new Set(nodes.flatMap((node) => node.keywords)),
  ).slice(0, 6);
  const representativeNodeIds = nodes
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 4)
    .map((node) => node.id);
  const summary = nodes
    .slice(0, 3)
    .map((node) => node.summary || node.answer)
    .filter(Boolean)
    .join(' ')
    .slice(0, 240);

  return {
    id: `${idPrefix}:${normalizeText(label).replace(/\s+/g, '-') || 'general'}`,
    label,
    summary: summary || `Knowledge grouped under ${label}.`,
    representativeKeywords,
    representativeNodeIds,
    nodeCount: nodes.length,
  };
}

export function buildCandidateContextPack(query: string, questions: Question[], limit = 5, queryEmbedding?: number[]): CandidateContextPack {
  const nodes = projectQuestionsToKnowledgeNodes(questions);
  // Build a fast lookup from question ID → stored embedding vector for cosine re-ranking.
  const vectorById = new Map<string, number[]>();
  if (queryEmbedding && queryEmbedding.length > 0) {
    for (const q of questions) {
      if (q.embeddingVector && q.embeddingVector.length > 0) vectorById.set(q.id, q.embeddingVector);
    }
  }
  const ranked = nodes
    .map((node) => {
      const kwScore = candidateScore(query, node);
      const nodeVec = vectorById.get(node.id);
      // Blend 40% keyword + 60% cosine when both vectors are available.
      const score = nodeVec
        ? kwScore * 0.4 + cosine(queryEmbedding!, nodeVec) * 0.6
        : kwScore;
      return { node, score };
    })
    .filter(({ score }) => score > 0.03)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const candidates = ranked.map(({ node }) => node);
  const roots = new Map<string, KnowledgeNode[]>();
  const branches = new Map<string, KnowledgeNode[]>();
  const clusters = new Map<string, KnowledgeNode[]>();

  for (const node of candidates) {
    (roots.get(node.rootLabel) ?? roots.set(node.rootLabel, []).get(node.rootLabel)!).push(node);
    (branches.get(node.branchLabel) ?? branches.set(node.branchLabel, []).get(node.branchLabel)!).push(node);
    (clusters.get(node.clusterLabel) ?? clusters.set(node.clusterLabel, []).get(node.clusterLabel)!).push(node);
  }

  return {
    roots: Array.from(roots.entries()).map(([label, grouped]) => summarizeGroup(label, grouped, 'root')),
    branches: Array.from(branches.entries()).map(([label, grouped]) => summarizeGroup(label, grouped, 'branch')),
    clusters: Array.from(clusters.entries()).map(([label, grouped]) => summarizeGroup(label, grouped, 'cluster')),
    candidates,
  };
}

export function formatCandidateContextPack(pack: CandidateContextPack): string {
  if (pack.candidates.length === 0) return 'No close graph candidates found.';
  const lines: string[] = [];
  if (pack.roots.length > 0) {
    lines.push('Likely roots:');
    for (const root of pack.roots) {
      lines.push(`- ${root.label}: ${root.summary}`);
    }
  }
  if (pack.branches.length > 0) {
    lines.push('Likely branches:');
    for (const branch of pack.branches) {
      lines.push(`- ${branch.label}: ${branch.summary}`);
    }
  }
  if (pack.clusters.length > 0) {
    lines.push('Likely clusters:');
    for (const cluster of pack.clusters) {
      lines.push(`- ${cluster.label}: ${cluster.summary}`);
    }
  }
  lines.push('Candidate nodes:');
  for (const node of pack.candidates) {
    lines.push(`- ${node.id} | ${node.title} | ${node.nodeSummary}`);
  }
  return lines.join('\n');
}

export function decideIngestionOutcome(
  content: string,
  questions: Question[],
  llmDecision?: { outcome?: 'merge' | 'refine' | 'new'; targetNodeId?: string } | null,
): IngestionDecision {
  const pack = buildCandidateContextPack(content, questions);
  const hintedTarget = llmDecision?.targetNodeId
    ? pack.candidates.find((candidate) => candidate.id === llmDecision.targetNodeId)
    : null;

  if (llmDecision?.outcome && (llmDecision.outcome === 'merge' || llmDecision.outcome === 'refine') && hintedTarget) {
    return {
      outcome: llmDecision.outcome,
      targetNodeId: hintedTarget.id,
    };
  }

  const top = pack.candidates[0];
  if (!top) {
    return { outcome: 'new' };
  }

  const score = candidateScore(content, top);
  if (score >= 0.78) {
    return { outcome: 'merge', targetNodeId: top.id };
  }

  if (score >= 0.34) {
    return { outcome: 'refine', targetNodeId: top.id };
  }

  return { outcome: 'new' };
}

export function buildCanonicalQuestionPatch(
  content: string,
  question: Question,
  _decision: IngestionDecision,
): Partial<Question> {
  const aliasTitle = titleFor(question);
  const aliases = Array.from(new Set([...(question.aliases ?? []), aliasTitle, content.trim()])).filter(Boolean);
  const sourcePrompts = Array.from(new Set([...(question.sourcePrompts ?? [question.content]), content.trim()])).filter(Boolean);
  const sourceQuestionIds = Array.from(new Set(question.sourceQuestionIds ?? [question.id]));
  return {
    aliases,
    sourcePrompts,
    sourceQuestionIds,
    nodeSummary: question.nodeSummary || question.summary,
  };
}

export function buildProjectedFlashcard(node: KnowledgeNode): FlashCard {
  return {
    id: `node-${node.id}`,
    sessionId: `node:${node.id}`,
    front: node.title || node.content,
    back: (node.nodeSummary || node.answer || node.summary).slice(0, 240),
    createdAt: node.createdAt,
    pinned: node.pinned,
    reviewSchedule: node.reviewSchedule,
    nodeId: node.id,
    nodeTitle: node.title,
    rootLabel: node.rootLabel,
    branchLabel: node.branchLabel,
    clusterLabel: node.clusterLabel,
    placementReason: node.placementReason,
    sourceType: 'canonical',
  };
}

export function getProjectedFlashcards(questions: Question[]): FlashCard[] {
  return projectQuestionsToKnowledgeNodes(questions)
    .map(buildProjectedFlashcard)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getDueProjectedFlashcards(questions: Question[]): FlashCard[] {
  return getProjectedFlashcards(questions).filter((card) => card.pinned || card.reviewSchedule.nextReviewDate <= new Date().toISOString().slice(0, 10));
}

export function buildDailyReviewMap(
  cards: FlashCard[],
  questions: Question[],
  revealedNodeIds: string[],
  activeNodeId?: string,
): DailyReviewMap {
  const revealed = new Set(revealedNodeIds);
  const byId = new Map(projectQuestionsToKnowledgeNodes(questions).map((node) => [node.id, node]));
  const roots = new Map<string, Map<string, Map<string, Array<{ nodeId: string; label: string; state: 'hidden' | 'revealed' | 'active' }>>>>();

  for (const card of cards) {
    const nodeId = card.nodeId;
    if (!nodeId) continue;
    const node = byId.get(nodeId);
    if (!node) continue;
    const state = activeNodeId === nodeId ? 'active' : revealed.has(nodeId) ? 'revealed' : 'hidden';
    const rootMap = roots.get(node.rootLabel) ?? new Map();
    roots.set(node.rootLabel, rootMap);
    const branchMap = rootMap.get(node.branchLabel) ?? new Map();
    rootMap.set(node.branchLabel, branchMap);
    const clusterLeaves = branchMap.get(node.clusterLabel) ?? [];
    branchMap.set(node.clusterLabel, clusterLeaves);
    clusterLeaves.push({ nodeId, label: node.title, state });
  }

  return {
    roots: Array.from(roots.entries()).map(([rootLabel, branches]) => ({
      id: normalizeText(rootLabel),
      label: rootLabel,
      branches: Array.from(branches.entries()).map(([branchLabel, clusters]) => ({
        id: normalizeText(`${rootLabel}-${branchLabel}`),
        label: branchLabel,
        clusters: Array.from(clusters.entries()).map(([clusterLabel, leaves]) => ({
          id: normalizeText(`${rootLabel}-${branchLabel}-${clusterLabel}`),
          label: clusterLabel,
          leaves,
        })),
      })),
    })),
    totalDue: cards.length,
    revealedCount: revealed.size,
  };
}

export function recordStructuralSignalPatch(question: Question, signal: StructuralSignalType): Partial<Question> {
  const signals = question.coCreationSignals ?? {};
  return {
    coCreationSignals: {
      ...signals,
      [signal]: (signals[signal] ?? 0) + 1,
      lastSignalAt: Date.now(),
    },
  };
}

export function buildReflectionTree(questions: Question[]): Array<{
  rootLabel: string;
  branches: Array<{ branchLabel: string; clusters: Array<{ clusterLabel: string; nodes: KnowledgeNode[] }> }>;
}> {
  const grouped = new Map<string, Map<string, Map<string, KnowledgeNode[]>>>();
  for (const node of projectQuestionsToKnowledgeNodes(questions)) {
    const root = grouped.get(node.rootLabel) ?? new Map();
    grouped.set(node.rootLabel, root);
    const branch = root.get(node.branchLabel) ?? new Map();
    root.set(node.branchLabel, branch);
    const cluster = branch.get(node.clusterLabel) ?? [];
    branch.set(node.clusterLabel, cluster);
    cluster.push(node);
  }

  return Array.from(grouped.entries()).map(([rootLabel, branches]) => ({
    rootLabel,
    branches: Array.from(branches.entries()).map(([branchLabel, clusters]) => ({
      branchLabel,
      clusters: Array.from(clusters.entries()).map(([clusterLabel, nodes]) => ({
        clusterLabel,
        nodes,
      })),
    })),
  }));
}

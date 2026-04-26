import type {
  AppEvent,
  CandidateContextPack,
  ClassificationResult,
  DailyReviewMap,
  FlashCard,
  HierarchySummary,
  IngestionDecision,
  KnowledgeNode,
  LLMConfig,
  Question,
  ReorganizationResult,
  ServiceResult,
  StructuralSignalType,
} from '../types/index.ts';
import { cosine, embedText } from '../providers/embedding/index.ts';
import { chatCompletion } from '../providers/llm/index.ts';

const ROOT_FALLBACK = 'Knowledge';
const BRANCH_FALLBACK = 'General concepts';
const CLUSTER_FALLBACK = 'Open questions';

// Phase 33 UAT-4 classification fix (2026-04-20): embedding-based anchor pre-check.
//
// The by-layer classification design (step 1 branch → step 2 cluster → step 3 anchor)
// was an intentional token-saving pivot for large mindmaps. But it has a structural
// flaw: the LLM must commit to a branch at step 1 based on branch NAMES only, before
// it can see which anchors exist. For cross-cutting concepts (e.g. "Spaced Repetition"
// that plausibly fits Cognitive Science OR Educational Technology), the LLM guesses
// at step 1 — and once it picks a branch, it's locked into that subtree and can never
// reach a matching anchor living elsewhere. User evidence: twin "Spaced Repetition"
// anchors under two different branches (device screenshot, 2026-04-20).
//
// The fix is an O(N_anchors) cosine pre-check BEFORE the tree descent. If the new
// question's embedding is highly similar to an existing anchor, reuse it and adopt
// that anchor's branch/cluster labels — no LLM tokens spent. The tree descent is
// preserved as a fallback for genuinely novel concepts.
//
// Threshold tuned conservatively (0.82) to avoid false-positive merges. Compare to
// the 0.5 "related" threshold used for relatedQuestionIds — that's much looser.
// The pre-check represents "same concept", not "same topic area".
const ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD = 0.82;

// Opportunistic anchor-embedding backfill cap per classification. Anchors created
// before this feature have no embeddingVector. Rather than a one-shot migration
// (risky; blocks app startup), we embed up to N missing anchors during each
// classification. At typical 100-200 anchor graphs this converges in a few Q&As
// without perceptibly adding latency.
const ANCHOR_BACKFILL_PER_CLASSIFICATION = 8;

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
  // Guard: cluster nodes are aggregate containers, not reviewable Q&A nodes
  if (question.isClusterNode === true) {
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
  const seenNodeIds = new Set<string>();

  for (const card of cards) {
    const nodeId = card.nodeId;
    if (!nodeId) continue;
    if (seenNodeIds.has(nodeId)) continue;
    seenNodeIds.add(nodeId);
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

  const uniqueNodeCount = seenNodeIds.size;

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
    totalDue: uniqueNodeCount,
    revealedCount: revealed.size,
  };
}

export function buildTreeContext(questions: Question[]): string {
  const tree = buildReflectionTree(questions);
  if (tree.length === 0) return 'No existing branches or clusters yet.';
  const lines: string[] = [];
  for (const root of tree) {
    for (const branch of root.branches) {
      const clusterNames = branch.clusters.map(c => c.clusterLabel).join(', ');
      lines.push(`- ${branch.branchLabel}: [${clusterNames}]`);
      // List existing anchors under each cluster
      for (const cluster of branch.clusters) {
        const anchors = cluster.nodes.filter(n => {
          // Find the original question to check isAnchorNode
          const q = questions.find(qItem => qItem.id === n.id);
          return q?.isAnchorNode === true;
        });
        if (anchors.length > 0) {
          lines.push(`  Anchors: ${anchors.map(a => `${a.title} (id:${a.id})`).join(', ')}`);
        }
      }
    }
  }
  return lines.join('\n');
}

// ─── Incremental Pipeline Helpers ───────────────────────────────────────────

const PIPELINE_SYSTEM_PROMPT = [
  'You are a knowledge classification assistant. You organize questions into a hierarchical knowledge tree:',
  '  - BRANCH: a broad academic discipline (e.g. Psychology, Biology, Computer Science, Mathematics, Physics, Philosophy, Economics, History, Linguistics). NOT a sub-field ("Educational Psychology", "Cognitive Science" belong under Psychology, not as separate branches). NOT a methodology ("Learning Techniques", "Personal Development" are not disciplines).',
  '  - CLUSTER: a sub-field or recognized area WITHIN a branch (e.g. "Learning Theory" under Psychology, "Machine Learning" under Computer Science). Must be BROADER than the anchor it contains.',
  '  - ANCHOR: a specific concept noun phrase, 1-3 words (e.g. "Spaced Repetition", "Loss Aversion", "Bernoulli Principle"). NEVER a question, sentence, or topic-description.',
  '',
  'STRONGLY prefer REUSING existing branches/clusters/anchors over creating new ones. Similar phrasings of the same concept belong in the same anchor. Similar sub-fields belong in the same cluster. Similar disciplines belong in the same branch. Only create NEW if the concept truly does not fit any existing option, even loosely.',
  '',
  'Follow the response format instructions exactly.',
].join('\n');

interface StepDecision {
  isNew: boolean;
  selectedIndex?: number; // 0-based
  newName?: string;
}

export function parseStepResponse(raw: string, candidateCount: number): StepDecision {
  const trimmed = raw.trim();

  // Try JSON parse first
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && parsed.index === 'NEW' && typeof parsed.name === 'string') {
      return { isNew: true, newName: parsed.name.trim() };
    }
    if (parsed && typeof parsed.index === 'number') {
      if (parsed.index >= 0 && parsed.index < candidateCount) {
        return { isNew: false, selectedIndex: parsed.index };
      }
      throw new Error(`Invalid step response: "${raw}"`);
    }
  } catch (e) {
    if (e instanceof SyntaxError) {
      // Not JSON — try regex extraction below
    } else {
      throw e;
    }
  }

  // Try extracting embedded JSON object
  const jsonMatch = trimmed.match(/\{[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && parsed.index === 'NEW' && typeof parsed.name === 'string') {
        return { isNew: true, newName: parsed.name.trim() };
      }
      if (parsed && typeof parsed.index === 'number' && parsed.index >= 0 && parsed.index < candidateCount) {
        return { isNew: false, selectedIndex: parsed.index };
      }
    } catch { /* not valid JSON object */ }
  }

  // Try bare integer extraction (reject if preceded by minus sign)
  const intMatch = trimmed.match(/(?:^|[^-])\b(\d+)\b/);
  if (intMatch) {
    const num = parseInt(intMatch[1], 10);
    if (num >= 0 && num < candidateCount) {
      return { isNew: false, selectedIndex: num };
    }
  }

  throw new Error(`Invalid step response: "${raw}"`);
}

export function buildStepPrompt(
  level: 'branch' | 'cluster' | 'anchor',
  candidates: Array<string | { id: string; name: string }>,
): string {
  // Level-specific hints baked in at the prompt level so the LLM sees them
  // alongside the candidate list. Phase 33 UAT-4 fix: reuse bias + hierarchy
  // rule previously only appeared in the one-shot new-branch combined prompt
  // (buildNewBranchClusterAnchorPrompt); they now also guide the per-step path.
  let levelHint = '';
  if (level === 'branch') {
    levelHint = '\n\nBRANCH = a broad academic discipline (Psychology, Biology, Computer Science, Mathematics, Physics, Philosophy, Economics, History, Linguistics). Do NOT create narrow sub-fields like "Educational Psychology", "Cognitive Science", "Learning Techniques", "Educational Technology" as separate branches — those belong inside Psychology or Computer Science.';
  } else if (level === 'cluster') {
    levelHint = '\n\nCLUSTER = a recognized sub-field WITHIN the chosen branch. Must be BROADER than the anchor it will contain, and MUST NOT be identical to the anchor name. Examples: "Learning Theory", "Behavioral Economics", "Cryptography". Do NOT use generic words ("fundamentals", "basics", "introduction", "general", "concepts") — pick a real sub-field name.';
  } else if (level === 'anchor') {
    levelHint = '\n\nANCHOR = a 1-3 word concept noun phrase. NEVER a sentence, question, or question paraphrase.\nGOOD: "Spaced Repetition", "Transformer Attention", "Loss Aversion", "Entropy".\nBAD: "Spaced repetition and why does it work" (question, not concept noun).';
  }

  // Reuse bias applies to every level. Applied AFTER the levelHint so the
  // LLM reads "here is what a branch/cluster/anchor is" → "prefer reuse".
  const reuseBias = '\n\nSTRONGLY prefer selecting an existing option over creating a new one. Similar phrasings of the same concept belong together. Only pick NEW if the concept truly does not fit ANY existing option, even loosely.';

  if (candidates.length === 0) {
    return `Select or create a ${level}.\n\nNo existing ${level}s yet — create a new one.${levelHint}\n\nRespond with {"index":"NEW","name":"<${level} name>"}.`;
  }

  const numbered = candidates
    .map((c, i) => `${i}. ${typeof c === 'string' ? c : c.name}`)
    .join('\n');

  return `Select the best ${level} for this question, or create a new one if truly none fits.\n\nExisting ${level}s:\n${numbered}${levelHint}${reuseBias}\n\nRespond with the index number (0-${candidates.length - 1}) to select an existing ${level}, or {"index":"NEW","name":"<${level} name>"} to create a new one.`;
}

/**
 * Combined cluster + anchor naming prompt used when step 1 returns isNew (brand-new
 * branch, so no existing clusters/anchors to choose from). One LLM call replaces the
 * previous lazy `${branchName} fundamentals` + raw-question-text placeholders.
 *
 * Constraints baked in:
 *  - cluster: 2-4 word recognized sub-domain, NOT generic ("fundamentals", "basics", etc.)
 *  - anchor: 1-3 word concept noun phrase, NEVER a question
 *  - cluster MUST be broader than anchor and they must NOT be identical
 *    (mirrors the rule in classifyAndAnchor's legacy single-call prompt)
 */
export function buildNewBranchClusterAnchorPrompt(branchName: string): string {
  return [
    `You created a new branch: "${branchName}".`,
    '',
    'Now propose two names for this question:',
    `1. cluster — a 2-4 word sub-domain WITHIN ${branchName} that this question fits. Should be a recognized topic, theory, or sub-field. Examples: "Learning Theory", "Behavioral Economics", "Fluid Mechanics", "Cryptography". Do NOT use generic words like "fundamentals", "basics", "introduction", "general", or "concepts".`,
    '2. anchor — a 1-3 word concept noun phrase naming the SPECIFIC concept the question is about. Examples: "Spaced Repetition", "Loss Aversion", "Bernoulli Principle", "RSA Encryption". NEVER a question or sentence.',
    '',
    'cluster must be BROADER than anchor (cluster is the area of study, anchor is the specific concept inside it). They must NOT be identical.',
    '',
    'Respond ONLY with JSON: {"cluster":"<cluster name>","anchor":"<anchor name>"}',
  ].join('\n');
}

/**
 * Parse the combined cluster+anchor response. Tolerant of fenced code blocks and
 * extra prose around the JSON, mirroring parseStepResponse's resilience.
 */
export function parseClusterAnchorResponse(raw: string): { cluster?: string; anchor?: string } {
  const trimmed = raw.trim();

  const tryParse = (s: string): { cluster?: string; anchor?: string } | null => {
    try {
      const parsed = JSON.parse(s) as { cluster?: unknown; anchor?: unknown };
      const cluster = typeof parsed.cluster === 'string' ? parsed.cluster.trim() : '';
      const anchor = typeof parsed.anchor === 'string' ? parsed.anchor.trim() : '';
      if (!cluster || !anchor) return null;
      // Reject lazy placeholders so we fall back to legacy classification rather than ship them.
      const lazyPlaceholders = /^(fundamentals|basics|introduction|general|concepts|overview)$/i;
      if (lazyPlaceholders.test(cluster) || lazyPlaceholders.test(anchor)) return null;
      // Reject identical names (cluster must be broader than anchor).
      if (cluster.toLowerCase() === anchor.toLowerCase()) return null;
      return { cluster, anchor };
    } catch {
      return null;
    }
  };

  const direct = tryParse(trimmed);
  if (direct) return direct;

  const jsonMatch = trimmed.match(/\{[\s\S]*?\}/);
  if (jsonMatch) {
    const embedded = tryParse(jsonMatch[0]);
    if (embedded) return embedded;
  }
  return {};
}

export function extractUniqueBranches(allQuestions: Question[]): string[] {
  const seen = new Set<string>();
  for (const q of allQuestions) {
    if (q.flagged === true) continue;
    if (q.isClusterNode === true) continue;
    if (q.isAnchorNode === true) continue;
    const branch = q.branchLabel?.trim();
    if (branch && !VAGUE_LABELS.has(branch)) {
      seen.add(branch);
    }
  }
  return Array.from(seen);
}

export function extractClustersUnderBranch(allQuestions: Question[], branchLabel: string): string[] {
  const seen = new Set<string>();
  for (const q of allQuestions) {
    if (q.flagged === true) continue;
    if (q.isClusterNode === true) continue;
    if (q.isAnchorNode === true) continue;
    if (q.branchLabel !== branchLabel) continue;
    const cluster = q.clusterLabel?.trim();
    if (cluster && !VAGUE_LABELS.has(cluster)) {
      seen.add(cluster);
    }
  }
  return Array.from(seen);
}

export function extractAnchorsUnderCluster(
  allQuestions: Question[],
  branchLabel: string,
  clusterLabel: string,
): Array<{ id: string; name: string }> {
  const anchors: Array<{ id: string; name: string }> = [];
  for (const q of allQuestions) {
    if (q.isAnchorNode !== true) continue;
    if (q.branchLabel !== branchLabel) continue;
    if (q.clusterLabel !== clusterLabel) continue;
    anchors.push({ id: q.id, name: q.title || q.content.slice(0, 40) });
  }
  return anchors;
}

// ─── Embedding-based anchor pre-check (Phase 33 UAT-4 fix) ──────────────────

/**
 * Embed the anchor's title and persist the vector on the anchor node. Called
 * opportunistically during classification to backfill anchors that were
 * created before this feature shipped (they have no embeddingVector).
 * Returns the new vector, or undefined if embedding failed / not configured.
 */
async function backfillAnchorEmbedding(
  anchor: Question,
): Promise<number[] | undefined> {
  const { settingsService } = await import('./settings.service.ts');
  const embCfg = settingsService.getSync().embedding;
  if (!embCfg.isConfigured) return undefined;
  try {
    const text = (anchor.title || anchor.content || '').trim();
    if (!text) return undefined;
    const vec = await embedText(text, embCfg);
    if (!Array.isArray(vec) || vec.length === 0) return undefined;
    const { questionService } = await import('./question.service.ts');
    questionService.patchQuestion(anchor.id, { embeddingVector: vec });
    return vec;
  } catch (err) {
    console.warn('[Trellis] anchor embedding backfill failed:', err instanceof Error ? err.message : err);
    return undefined;
  }
}

/**
 * Pre-check: is the new question's concept already represented by an existing
 * anchor anywhere in the graph? If yes, skip the 3-step LLM descent and reuse
 * the matching anchor + adopt its branch/cluster labels.
 *
 * Returns:
 *   - { match: Question, similarity: number } — high-confidence match above threshold
 *   - null — no match, fall through to tree descent
 *
 * Uses the question's existing embeddingVector if present (set by
 * question.service.ts post-save); otherwise embeds the question content inline.
 * Backfills up to ANCHOR_BACKFILL_PER_CLASSIFICATION missing anchor embeddings
 * per call so the pre-check becomes progressively more useful over time.
 */
export async function preCheckAnchorMatch(
  question: Question,
  allQuestions: Question[],
): Promise<{ match: Question; similarity: number } | null> {
  const { settingsService } = await import('./settings.service.ts');
  const embCfg = settingsService.getSync().embedding;
  if (!embCfg.isConfigured) return null;

  const anchors = allQuestions.filter(q => q.isAnchorNode === true);
  if (anchors.length === 0) return null;

  // Resolve the query vector. Prefer the question's own embedding if already
  // populated (fire-and-forget from question.service.ts might have completed);
  // otherwise compute it inline so the pre-check works on the FIRST classification
  // after the question is saved.
  let queryVec = question.embeddingVector;
  if (!queryVec || queryVec.length === 0) {
    try {
      queryVec = await embedText(question.content.trim(), embCfg);
    } catch (err) {
      console.warn('[Trellis] pre-check query embedding failed:', err instanceof Error ? err.message : err);
      return null;
    }
  }

  // Opportunistic backfill: embed up to N missing anchors inline. Embedding
  // is async + network, so cap strictly to keep classification latency bounded.
  let backfilled = 0;
  for (const a of anchors) {
    if (backfilled >= ANCHOR_BACKFILL_PER_CLASSIFICATION) break;
    if (a.embeddingVector && a.embeddingVector.length > 0) continue;
    const vec = await backfillAnchorEmbedding(a);
    if (vec) {
      a.embeddingVector = vec; // mutate the local copy so the scan below sees it
      backfilled++;
    }
  }

  // Scan anchors for the top cosine match.
  let best: { match: Question; similarity: number } | null = null;
  for (const a of anchors) {
    if (!a.embeddingVector || a.embeddingVector.length === 0) continue;
    const sim = cosine(queryVec, a.embeddingVector);
    if (sim >= ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD && (!best || sim > best.similarity)) {
      best = { match: a, similarity: sim };
    }
  }

  if (best && import.meta.env?.DEV) {
    console.debug(
      `[classification] pre-check hit: anchor "${best.match.title}" similarity=${best.similarity.toFixed(3)} (threshold=${ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD})`,
    );
  }
  return best;
}

// ─── Shared node-creation logic ─────────────────────────────────────────────

/**
 * Normalize an LLM-supplied anchor name into a clean concept noun phrase.
 * The classification prompt instructs the LLM to return a 1-3 word noun phrase
 * (e.g. "Spaced Repetition") but models periodically ignore the constraint and
 * return question paraphrases (e.g. "Spaced repetition and why does it work").
 * This guard catches that disobedience and recovers a usable concept noun.
 *
 * Steps (applied in order):
 *  1. Strip trailing punctuation
 *  2. Strip leading question/intro phrases ("what is", "why does", "how do", ...)
 *  3. Strip "and (why|how|when|where|whether|...) ..." tails
 *  4. If still > 4 words, take the first 3
 *  5. Title-case (preserving all-caps acronyms like "LLM", "API")
 *
 * Examples:
 *   "Spaced repetition and why does it work" → "Spaced Repetition"
 *   "What is spaced repetition?"             → "Spaced Repetition"
 *   "How do transformers handle attention?"  → "Transformers Handle Attention"
 *   "LLM tokenization basics"                → "LLM Tokenization Basics"
 */
export function normalizeAnchorName(raw: string): string {
  let name = raw.trim();
  if (!name) return name;
  // 1. Strip trailing punctuation
  name = name.replace(/[?!.,;:]+$/, '').trim();
  // 2. Strip leading question/intro phrases
  name = name.replace(
    /^(what is|what are|what does|what do|why does|why is|why do|why are|how does|how do|how can|how to|when does|when is|where does|where is|is|are|does|do|can)\s+/i,
    '',
  ).trim();
  // 3. Strip trailing "and (question-word) ..." clauses
  name = name.replace(/\s+and\s+(why|how|when|where|whether|if|what|who)\s+.+$/i, '').trim();
  // 4. Truncate to first 3 words if still too long
  const words = name.split(/\s+/).filter(Boolean);
  const kept = words.length > 4 ? words.slice(0, 3) : words;
  // 5. Title-case, preserving acronyms
  return kept.map((w) => (/^[A-Z]{2,}$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(' ');
}

async function commitClassificationResult(
  question: Question,
  result: ClassificationResult,
  allQuestions: Question[],
): Promise<void> {
  // Import questionService lazily to avoid circular dependency
  const { questionService } = await import('./question.service.ts');

  // Normalize anchor name BEFORE any lookup or persistence — guards against LLM
  // disobedience to the buildStepPrompt naming constraint (commit 93162265).
  // All downstream uses (existing-by-name lookup, anchor creation) read the
  // normalized form so anchors are stored with clean concept-noun titles.
  result = { ...result, anchorName: normalizeAnchorName(result.anchorName) || result.anchorName };

  // Use a mutable reference to allQuestions so anchor resolution sees newly created cluster
  let freshQuestions: Question[] = allQuestions;

  // --- Resolve or create cluster node ---
  let clusterEntityId: string | undefined;

  const existingCluster = freshQuestions.find(
    q => q.isClusterNode === true &&
      q.branchLabel === result.branchLabel &&
      q.clusterLabel === result.clusterLabel
  );

  if (existingCluster) {
    clusterEntityId = existingCluster.id;
  } else {
    const clusterNode: Question = {
      id: `cluster-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      content: result.clusterLabel,
      answer: '',
      summary: result.clusterLabel,
      title: result.clusterLabel,
      keywords: [],
      relatedQuestionIds: [],
      categoryIds: [],
      reviewSchedule: { nextReviewDate: '9999-12-31', reviewCount: 0, easeFactor: 2.5 },
      createdAt: Date.now(),
      aliases: [],
      sourcePrompts: [],
      sourceQuestionIds: [],
      rootLabel: result.rootLabel,
      branchLabel: result.branchLabel,
      clusterLabel: result.clusterLabel,
      nodeSummary: '',
      isClusterNode: true,
      qaCount: 0,
    };
    const CLUSTER_STORAGE_KEY = 'echolearn_questions';
    try {
      const storedRaw = localStorage.getItem(CLUSTER_STORAGE_KEY);
      const store: Question[] = storedRaw ? JSON.parse(storedRaw) as Question[] : [];
      store.unshift(clusterNode);
      localStorage.setItem(CLUSTER_STORAGE_KEY, JSON.stringify(store));
    } catch { /* storage error */ }
    clusterEntityId = clusterNode.id;

    // Refresh freshQuestions snapshot so anchor resolution sees the new cluster
    freshQuestions = questionService.getAll();
  }

  // --- Resolve or create anchor node ---
  let anchorId: string | undefined;

  if (result.anchorId) {
    // Verify the referenced anchor actually exists
    const existingAnchor = freshQuestions.find(q => q.id === result.anchorId && q.isAnchorNode === true);
    if (existingAnchor) {
      anchorId = existingAnchor.id;
      // Patch existing anchor with clusterNodeId if it doesn't have one
      if (clusterEntityId && !existingAnchor.clusterNodeId) {
        questionService.patchQuestion(existingAnchor.id, { clusterNodeId: clusterEntityId });
      }
    }
  }

  if (!anchorId) {
    // Check if an anchor with the same name already exists under the same cluster.
    // Phase 33 UAT-4 fix: normalize BOTH sides of the comparison. Previously the
    // incoming result.anchorName was normalized (line ~740 above) but the stored
    // q.title was compared raw. Anchors created pre-b2061554 (or via manual edit /
    // import / older classification path) can have un-normalized titles like
    // "Spaced repetition and why does it work", which would never match the clean
    // "Spaced Repetition" the LLM produces post-normalization. Symmetric
    // normalization makes the lookup robust against both sides.
    const targetNormalized = result.anchorName.toLowerCase();
    const existingByName = freshQuestions.find(
      q => q.isAnchorNode === true &&
        (normalizeAnchorName(q.title || '') || (q.title || '')).toLowerCase() === targetNormalized &&
        q.clusterLabel === result.clusterLabel
    );

    if (existingByName) {
      anchorId = existingByName.id;
      // Patch existing anchor with clusterNodeId if it doesn't have one
      if (clusterEntityId && !existingByName.clusterNodeId) {
        questionService.patchQuestion(existingByName.id, { clusterNodeId: clusterEntityId });
      }
    } else {
      // Create a new anchor node
      const anchorNode: Question = {
        id: `anchor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        date: new Date().toISOString().slice(0, 10),
        content: result.anchorName,
        answer: '',
        summary: result.anchorName,
        title: result.anchorName,
        keywords: result.keyword ? [result.keyword] : [],
        relatedQuestionIds: [],
        categoryIds: [],
        reviewSchedule: { nextReviewDate: '9999-12-31', reviewCount: 0, easeFactor: 2.5 },
        createdAt: Date.now(),
        aliases: [],
        sourcePrompts: [],
        sourceQuestionIds: [],
        rootLabel: result.rootLabel,
        branchLabel: result.branchLabel,
        clusterLabel: result.clusterLabel,
        nodeSummary: '',
        isAnchorNode: true,
        qaCount: 0,
        clusterNodeId: clusterEntityId,
      };

      // Save anchor directly to localStorage (same storage key as questionService)
      const ANCHOR_STORAGE_KEY = 'echolearn_questions';
      try {
        const storedRaw = localStorage.getItem(ANCHOR_STORAGE_KEY);
        const store: Question[] = storedRaw ? JSON.parse(storedRaw) as Question[] : [];
        store.unshift(anchorNode);
        localStorage.setItem(ANCHOR_STORAGE_KEY, JSON.stringify(store));
      } catch { /* storage error — anchor won't be created */ }

      anchorId = anchorNode.id;
    }
  }

  // --- Patch Q&A with labels and anchor attachment ---
  const shortSummary = result.briefAnswer || question.shortSummary || question.summary || question.answer.slice(0, 200);
  const summaryEntry = `[${question.id}] ${shortSummary.slice(0, 200)}`;

  // Patch the Q&A node with classification labels and anchor parentId
  questionService.patchQuestion(question.id, {
    rootLabel: result.rootLabel,
    branchLabel: result.branchLabel,
    clusterLabel: result.clusterLabel,
    placementReason: `Classified under ${result.branchLabel} > ${result.clusterLabel} > ${result.anchorName}`,
    parentId: anchorId,
    clusterNodeId: clusterEntityId,
  });

  // Update anchor: increment qaCount and append to nodeSummary
  if (anchorId) {
    const freshStore = questionService.getAll();
    const anchor = freshStore.find(q => q.id === anchorId);
    if (anchor) {
      const currentSummary = anchor.nodeSummary || '';
      const newSummary = currentSummary ? `${currentSummary}\n${summaryEntry}` : summaryEntry;
      questionService.patchQuestion(anchorId, {
        qaCount: (anchor.qaCount || 0) + 1,
        nodeSummary: newSummary,
        // Ensure anchor has correct labels (in case it was just created)
        rootLabel: result.rootLabel,
        branchLabel: result.branchLabel,
        clusterLabel: result.clusterLabel,
      });
    }
  }

  // Update cluster entity: aggregate qaCount from all child anchors
  if (clusterEntityId) {
    const freshStore = questionService.getAll();
    const childAnchors = freshStore.filter(q => q.isAnchorNode === true && q.clusterNodeId === clusterEntityId);
    const totalQaCount = childAnchors.reduce((sum, a) => sum + (a.qaCount || 0), 0);
    questionService.patchQuestion(clusterEntityId, {
      qaCount: totalQaCount,
    });
  }

  // Notify subscribers that the knowledge graph has been updated
  const { eventBus } = await import('../lib/event-bus.ts');
  eventBus.emit({ type: 'GRAPH_UPDATED' });
}

// ─── Incremental Pipeline ───────────────────────────────────────────────────

interface PipelineMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function runStepWithRetry(
  messages: PipelineMessage[],
  candidateCount: number,
  llmConfig: LLMConfig,
  signal?: AbortSignal,
): Promise<{ decision: StepDecision; rawResponse: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await chatCompletion(
        messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
        llmConfig,
        { serviceName: 'classification', maxTokens: 100, signal },
      );
      const decision = parseStepResponse(raw, candidateCount);
      return { decision, rawResponse: raw };
    } catch (err) {
      if (attempt === 0) continue; // retry once (D-08)
      throw err; // second failure -> caller triggers fallback (D-09)
    }
  }
  throw new Error('unreachable');
}

export async function classifyAndAnchorIncremental(
  question: Question,
  allQuestions: Question[],
  llmConfig: LLMConfig,
  signal?: AbortSignal,
): Promise<void> {
  try {
    // 0. Embedding-based anchor pre-check (Phase 33 UAT-4 fix). If the new
    // question's concept matches an existing anchor above the similarity
    // threshold, reuse it and adopt its branch/cluster labels — skip the
    // LLM tree descent entirely. See the load-bearing comment at the top
    // of this file for rationale.
    if (!signal?.aborted) {
      const preCheck = await preCheckAnchorMatch(question, allQuestions);
      if (preCheck) {
        const existing = preCheck.match;
        const reusedResult: ClassificationResult = {
          briefAnswer: '',
          keyword: '',
          rootLabel: existing.rootLabel || 'Knowledge',
          branchLabel: existing.branchLabel || BRANCH_FALLBACK,
          clusterLabel: existing.clusterLabel || CLUSTER_FALLBACK,
          anchorName: existing.title || '',
          anchorId: existing.id,
        };
        await commitClassificationResult(question, reusedResult, allQuestions);
        return;
      }
    }

    // 1. Build candidate lists
    const branches = extractUniqueBranches(allQuestions);

    // 2. Initialize message array (stable system prompt for KV cache)
    const messages: PipelineMessage[] = [
      { role: 'system', content: PIPELINE_SYSTEM_PROMPT },
      { role: 'user', content: `Question to classify: "${question.content}"${question.title ? ` (titled: "${question.title}")` : ''}` },
    ];

    // 3. Step 1 — Branch selection
    messages.push({ role: 'user', content: buildStepPrompt('branch', branches) });

    let branchName: string;
    let clusterName: string;
    let anchorName: string;
    let anchorId: string | undefined;

    let step1: { decision: StepDecision; rawResponse: string };
    try {
      step1 = await runStepWithRetry(messages, branches.length, llmConfig, signal);
    } catch {
      // Fallback to old classifyAndAnchor on failure
      await classifyAndAnchor(question, allQuestions, llmConfig);
      return;
    }
    // Push assistant response for KV cache continuity
    messages.push({ role: 'assistant', content: step1.rawResponse });

    // Phase 33 UAT-4 fix: coerce LLM-NEW branch to an existing selection if the
    // proposed name is a case/whitespace variant of one that already exists.
    // Weaker models (Gemini Flash, Haiku) sometimes return {"index":"NEW","name":"psychology"}
    // when the user already has branch "Psychology". Without this guard we'd mint
    // a duplicate-except-for-casing branch and — because anchor lookup is scoped
    // to cluster+branch — every subsequent anchor would also be a duplicate.
    if (step1.decision.isNew) {
      const proposed = (step1.decision.newName ?? '').trim().toLowerCase();
      const matchIdx = branches.findIndex(b => b.trim().toLowerCase() === proposed);
      if (matchIdx !== -1) {
        step1 = { decision: { isNew: false, selectedIndex: matchIdx }, rawResponse: step1.rawResponse };
      }
    }

    if (step1.decision.isNew) {
      // New branch — must also create a cluster and an anchor. Previously this short-circuited
      // with `clusterName = "${branchName} fundamentals"` and `anchorName = question.title`,
      // both of which are lazy placeholders (D-06 original implementation, 2026-04-19 complaint).
      // Now: one combined LLM follow-up asks for both names in a single call. The KV cache
      // reuses the system prompt + question + branch step, so the marginal cost is small.
      branchName = step1.decision.newName!;

      messages.push({
        role: 'user',
        content: buildNewBranchClusterAnchorPrompt(branchName),
      });

      let combinedRaw: string;
      try {
        combinedRaw = await chatCompletion(
          messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
          llmConfig,
          { serviceName: 'classification', maxTokens: 120, signal },
        );
      } catch {
        await classifyAndAnchor(question, allQuestions, llmConfig);
        return;
      }

      const combined = parseClusterAnchorResponse(combinedRaw);
      if (!combined.cluster || !combined.anchor) {
        // Parse failed — fall back to the legacy single-call path so we don't ship the
        // "fundamentals" placeholder we just removed.
        await classifyAndAnchor(question, allQuestions, llmConfig);
        return;
      }
      clusterName = combined.cluster;
      anchorName = combined.anchor;
    } else {
      branchName = branches[step1.decision.selectedIndex!];

      // 4. Step 2 — Cluster selection
      const clusters = extractClustersUnderBranch(allQuestions, branchName);
      messages.push({ role: 'user', content: buildStepPrompt('cluster', clusters) });

      let step2: { decision: StepDecision; rawResponse: string };
      try {
        step2 = await runStepWithRetry(messages, clusters.length, llmConfig, signal);
      } catch {
        await classifyAndAnchor(question, allQuestions, llmConfig);
        return;
      }
      messages.push({ role: 'assistant', content: step2.rawResponse });

      // Phase 33 UAT-4 fix: same case/whitespace coercion for clusters as we do
      // for branches above. A LLM-NEW cluster name that matches an existing one
      // (case-insensitive) should be treated as selection of the existing one.
      if (step2.decision.isNew) {
        const proposedCluster = (step2.decision.newName ?? '').trim().toLowerCase();
        const matchIdx = clusters.findIndex(c => c.trim().toLowerCase() === proposedCluster);
        if (matchIdx !== -1) {
          step2 = { decision: { isNew: false, selectedIndex: matchIdx }, rawResponse: step2.rawResponse };
        }
      }

      // Resolve the cluster name. The previous `step2.decision.isNew` branch
      // short-circuited with `anchorName = question.title` (raw question text);
      // we now always continue to step 3 so the anchor is LLM-named like every
      // other create path. With 0 existing anchors under a brand-new cluster,
      // step 3's prompt becomes "no existing anchors — create one".
      clusterName = step2.decision.isNew
        ? step2.decision.newName!
        : clusters[step2.decision.selectedIndex!];

      // 5. Step 3 — Anchor selection (always runs)
      const anchors = step2.decision.isNew
        ? []
        : extractAnchorsUnderCluster(allQuestions, branchName, clusterName);
      messages.push({ role: 'user', content: buildStepPrompt('anchor', anchors.map(a => a.name)) });

      let step3: { decision: StepDecision; rawResponse: string };
      try {
        step3 = await runStepWithRetry(messages, anchors.length, llmConfig, signal);
      } catch {
        await classifyAndAnchor(question, allQuestions, llmConfig);
        return;
      }

      if (step3.decision.isNew) {
        anchorName = step3.decision.newName!;
        anchorId = undefined;
      } else {
        anchorName = anchors[step3.decision.selectedIndex!].name;
        anchorId = anchors[step3.decision.selectedIndex!].id;
      }
    }

    // 6. Commit all decisions (D-07) — no partial writes
    const result: ClassificationResult = {
      briefAnswer: '',
      keyword: '',
      rootLabel: 'Knowledge',
      branchLabel: branchName,
      clusterLabel: clusterName,
      anchorName: anchorName,
      anchorId: anchorId,
    };

    await commitClassificationResult(question, result, allQuestions);
  } catch (err) {
    console.warn('[Trellis] Incremental pipeline failed — falling back to single-call classification:', err instanceof Error ? err.message : err);
    try {
      await classifyAndAnchor(question, allQuestions, llmConfig);
    } catch (fallbackErr) {
      console.warn('[Trellis] Fallback classification also failed:', fallbackErr instanceof Error ? fallbackErr.message : fallbackErr);
    }
  }
}

export async function classifyAndAnchor(
  question: Question,
  allQuestions: Question[],
  llmConfig: LLMConfig,
): Promise<void> {
  const treeContext = buildTreeContext(allQuestions);

  const systemPrompt = [
    'You are a knowledge classification assistant. Your job is to place a question into an academic knowledge hierarchy.',
    'Given a question and the existing tree of branches and clusters, determine where this question belongs.',
    '',
    'Existing tree structure:',
    treeContext,
    '',
    'Instructions:',
    '- branchLabel: a TOP-LEVEL academic discipline (e.g., "Psychology", "Computer Science", "Physics", "Economics", "Biology", "Mathematics", "Philosophy"). This is the broadest category — always a recognized academic field.',
    '- clusterLabel: a domain, theory, or sub-field WITHIN that discipline (e.g., "Learning Theory", "Machine Learning", "Thermodynamics", "Behavioral Economics", "Cognitive Development"). Must be more specific than branchLabel but broader than the individual concept.',
    '- anchorName: a specific concept or phenomenon (e.g., "Spaced Repetition", "Transformer", "Entropy", "Loss Aversion"). This is the narrowest label — the concrete idea the question is about.',
    '- anchorName must NEVER duplicate clusterLabel. If they would be the same, make clusterLabel broader (e.g., clusterLabel="Memory & Retention", anchorName="Spaced Repetition").',
    '- anchorId: if an existing anchor matches this concept, provide its id; otherwise omit',
    '- Reuse existing branches and clusters when the question fits. Create new ones only when truly needed.',
    '',
    'Example: "Why does spaced repetition work?" → branchLabel:"Psychology", clusterLabel:"Learning Theory", anchorName:"Spaced Repetition"',
    '',
    'Respond ONLY with JSON:',
    '{"briefAnswer":"<=30 word answer for self-context","keyword":"single most descriptive keyword","rootLabel":"Knowledge","branchLabel":"...","clusterLabel":"...","anchorName":"...","anchorId":"optional-existing-anchor-id"}',
  ].join('\n');

  try {
    const raw = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question.content },
      ],
      llmConfig,
      { serviceName: 'classification' },
    );

    let result: ClassificationResult;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as Partial<ClassificationResult>;
      result = {
        briefAnswer: parsed.briefAnswer ?? '',
        keyword: parsed.keyword ?? '',
        rootLabel: parsed.rootLabel?.trim() || 'Knowledge',
        branchLabel: parsed.branchLabel?.trim() || 'General concepts',
        clusterLabel: parsed.clusterLabel?.trim() || 'Open questions',
        anchorName: parsed.anchorName?.trim() || question.title || question.content.slice(0, 40),
        anchorId: parsed.anchorId?.trim() || undefined,
      };
    } catch {
      // JSON parse failed — derive labels from keywords
      const kw = question.keywords[0] || 'learning';
      result = {
        briefAnswer: '',
        keyword: kw,
        rootLabel: 'Knowledge',
        branchLabel: `${kw.charAt(0).toUpperCase()}${kw.slice(1)} concepts`,
        clusterLabel: `${kw.charAt(0).toUpperCase()}${kw.slice(1)} cluster`,
        anchorName: question.title || question.content.slice(0, 40),
      };
    }

    await commitClassificationResult(question, result, allQuestions);
  } catch (err) {
    // Second call failed — Q&A keeps whatever labels it had (empty/undefined from first call).
    // Fallback: labels will be derived from keywords at display time via buildFallbackPlacement.
    console.warn('[Trellis] Second classification call failed — labels will use keyword fallback:', err instanceof Error ? err.message : err);
  }
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

/**
 * Build a reflection tree where leaf nodes are concept anchors (not individual Q&As).
 * Each anchor carries its attached Q&A children for expand/retract display.
 * Legacy Q&As (no anchor parent) are included as direct leaves for backward compatibility.
 */
export function buildAnchorReflectionTree(questions: Question[]): Array<{
  rootLabel: string;
  branches: Array<{
    branchLabel: string;
    clusters: Array<{
      clusterLabel: string;
      clusterEntity: Question | undefined;
      anchors: Array<{ anchor: Question; qaChildren: Question[] }>;
      legacyNodes: Question[];
    }>;
  }>;
}> {
  const anchorMap = new Map<string, Question>();
  const anchoredQAs = new Map<string, Question[]>();
  const legacyQAs: Question[] = [];

  for (const q of questions) {
    if (q.flagged === true) continue;
    if (q.isClusterNode === true) continue;
    if (q.isAnchorNode === true) {
      anchorMap.set(q.id, q);
      if (!anchoredQAs.has(q.id)) anchoredQAs.set(q.id, []);
    }
  }

  for (const q of questions) {
    if (q.flagged === true) continue;
    if (q.isClusterNode === true) continue;
    if (q.isAnchorNode === true) continue;
    if (q.parentId && anchorMap.has(q.parentId)) {
      anchoredQAs.get(q.parentId)!.push(q);
    } else {
      legacyQAs.push(q);
    }
  }

  const grouped = new Map<string, Map<string, Map<string, { anchors: Array<{ anchor: Question; qaChildren: Question[] }>; legacyNodes: Question[] }>>>();

  for (const [anchorId, anchor] of anchorMap) {
    const rootLabel = anchor.rootLabel || 'Knowledge';
    const branchLabel = anchor.branchLabel || 'General concepts';
    const clusterLabel = anchor.clusterLabel || 'Open questions';

    const root = grouped.get(rootLabel) ?? new Map();
    grouped.set(rootLabel, root);
    const branch = root.get(branchLabel) ?? new Map();
    root.set(branchLabel, branch);
    const cluster = branch.get(clusterLabel) ?? { anchors: [], legacyNodes: [] };
    branch.set(clusterLabel, cluster);

    cluster.anchors.push({ anchor, qaChildren: anchoredQAs.get(anchorId) || [] });
  }

  for (const q of legacyQAs) {
    const placement = {
      rootLabel: q.rootLabel || 'Knowledge',
      branchLabel: q.branchLabel || 'General concepts',
      clusterLabel: q.clusterLabel || 'Open questions',
    };
    const root = grouped.get(placement.rootLabel) ?? new Map();
    grouped.set(placement.rootLabel, root);
    const branch = root.get(placement.branchLabel) ?? new Map();
    root.set(placement.branchLabel, branch);
    const cluster = branch.get(placement.clusterLabel) ?? { anchors: [], legacyNodes: [] };
    branch.set(placement.clusterLabel, cluster);

    cluster.legacyNodes.push(q);
  }

  const clusterEntities = new Map<string, Question>();
  for (const q of questions) {
    if (q.isClusterNode === true) {
      const key = `${q.branchLabel || ''}::${q.clusterLabel || ''}`;
      clusterEntities.set(key, q);
    }
  }

  return Array.from(grouped.entries()).map(([rootLabel, branches]) => ({
    rootLabel,
    branches: Array.from(branches.entries()).map(([branchLabel, clusters]) => ({
      branchLabel,
      clusters: Array.from(clusters.entries()).map(([clusterLabel, data]) => ({
        clusterLabel,
        clusterEntity: clusterEntities.get(`${branchLabel}::${clusterLabel}`),
        anchors: data.anchors,
        legacyNodes: data.legacyNodes,
      })),
    })),
  }));
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

// ─── Mindmap Reorganization ──────────────────────────────────────────────────

const REORG_SNAPSHOT_KEY = 'echolearn_reorg_snapshot';
const STORAGE_KEY = 'echolearn_questions';

// Module-level state so reorganization status persists across navigation
let _reorgInProgress = false;

export function isReorgInProgress(): boolean {
  return _reorgInProgress;
}

/**
 * Third-tier parser: attempts to repair common LLM JSON mistakes.
 * Handles markdown fences, trailing commas, preamble, and truncated tails.
 * Returns a string that is (hopefully) valid JSON, or null if unrecoverable.
 */
export function repairJson(raw: string): string | null {
  let s = raw.trim();

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');

  // Trim preamble — find first '{'
  const start = s.indexOf('{');
  if (start === -1) return null;
  s = s.slice(start);

  // Walk the string tracking depth + string state; find a safe end position
  // that can be truncated to without cutting mid-string.
  let braceDepth = 0;
  let bracketDepth = 0;
  let inString = false;
  let escape = false;
  let lastSafeEnd = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braceDepth++;
    else if (ch === '}') braceDepth--;
    else if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth--;
    if (braceDepth >= 0 && bracketDepth >= 0) lastSafeEnd = i;
  }

  // If we ended mid-string or mid-escape, cut back to last safe position
  if (inString || escape) {
    if (lastSafeEnd === -1) return null;
    s = s.slice(0, lastSafeEnd + 1);
    // Re-scan to recompute depths after truncation
    braceDepth = 0; bracketDepth = 0;
    inString = false; escape = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') braceDepth++;
      else if (ch === '}') braceDepth--;
      else if (ch === '[') bracketDepth++;
      else if (ch === ']') bracketDepth--;
    }
  }

  // Trim trailing incomplete tokens: drop trailing `:` `,` or key-without-value
  s = s.replace(/\s*[,:]\s*$/, '');
  // Drop a trailing dangling key like `"foo"` or `"foo":`
  s = s.replace(/,\s*"[^"]*"\s*:?\s*$/, '');

  // Remove trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, '$1');

  // Append missing closers (brackets first since they close inner, then braces)
  while (bracketDepth > 0) { s += ']'; bracketDepth--; }
  while (braceDepth > 0) { s += '}'; braceDepth--; }

  return s;
}

/**
 * Three-tier reorg response parser: direct JSON.parse → balanced extraction →
 * structural repair. Returns null only when all three tiers fail.
 */
function parseReorgResponse(raw: string): ReorganizationResult | null {
  try { return JSON.parse(raw) as ReorganizationResult; } catch { /* fall through */ }
  const balanced = extractBalancedJson(raw);
  if (balanced) {
    try { return JSON.parse(balanced) as ReorganizationResult; } catch { /* fall through */ }
  }
  const repaired = repairJson(raw);
  if (repaired) {
    try { return JSON.parse(repaired) as ReorganizationResult; } catch { /* fall through */ }
  }
  return null;
}

/**
 * Extract the first balanced JSON object from a string.
 * Handles: extra trailing braces, markdown wrappers, leading text.
 * Respects braces inside JSON string literals (skips quoted content).
 */
function extractBalancedJson(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return raw.slice(start, i + 1); }
  }
  return null;
}

/**
 * Compact structural snapshot for revert — stores only structural nodes and
 * QA→hierarchy mappings, NOT full QA content. Avoids localStorage quota issues.
 */
interface ReorgSnapshot {
  structuralNodes: Question[];
  qaPatches: Record<string, {
    rootLabel?: string;
    branchLabel?: string;
    clusterLabel?: string;
    parentId?: string;
    clusterNodeId?: string;
    placementReason?: string;
  }>;
}

export function hasReorgBackup(): boolean {
  return localStorage.getItem(REORG_SNAPSHOT_KEY) !== null;
}

export function revertReorganization(): ServiceResult<void> {
  const snapshotRaw = localStorage.getItem(REORG_SNAPSHOT_KEY);
  if (!snapshotRaw) {
    return { success: false, error: { code: 'NO_BACKUP', message: 'No previous structure to revert to.', retryable: false } };
  }

  try {
    const snapshot = JSON.parse(snapshotRaw) as ReorgSnapshot;
    const storeRaw = localStorage.getItem(STORAGE_KEY);
    const store: Question[] = storeRaw ? JSON.parse(storeRaw) as Question[] : [];

    // Remove current anchor/cluster nodes (created by reorganization)
    const filtered = store.filter((q) => !q.isAnchorNode && !q.isClusterNode);

    // Revert QA structural fields to pre-reorg values
    for (const q of filtered) {
      const patch = snapshot.qaPatches[q.id];
      if (patch) {
        q.rootLabel = patch.rootLabel;
        q.branchLabel = patch.branchLabel;
        q.clusterLabel = patch.clusterLabel;
        q.parentId = patch.parentId;
        q.clusterNodeId = patch.clusterNodeId;
        q.placementReason = patch.placementReason;
      }
    }

    // Re-add old structural nodes
    const restored = [...snapshot.structuralNodes, ...filtered];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
    localStorage.removeItem(REORG_SNAPSHOT_KEY);
    return { success: true };
  } catch {
    return { success: false, error: { code: 'REVERT_ERROR', message: 'Failed to parse revert snapshot.', retryable: false } };
  }
}

export async function reorganizeMindmap(
  llmConfig: LLMConfig,
): Promise<ServiceResult<{ anchorCount: number; clusterCount: number }>> {
  if (_reorgInProgress) {
    return { success: false, error: { code: 'IN_PROGRESS', message: 'Reorganization already in progress.', retryable: false } };
  }

  _reorgInProgress = true;
  const { eventBus } = await import('../lib/event-bus.ts');
  eventBus.emit({ type: 'REORG_STARTED' });

  try {
    return await _doReorganize(llmConfig, eventBus);
  } finally {
    _reorgInProgress = false;
  }
}

async function _doReorganize(
  llmConfig: LLMConfig,
  eventBus: { emit: (event: AppEvent) => void },
): Promise<ServiceResult<{ anchorCount: number; clusterCount: number }>> {
  const { questionService } = await import('./question.service.ts');
  const allQuestions = questionService.getAll();

  // Collect only real QA nodes (not anchors, clusters, or flagged)
  const qaNodes = allQuestions.filter(
    (q) => !q.isAnchorNode && !q.isClusterNode && q.flagged !== true,
  );

  if (qaNodes.length < 2) {
    eventBus.emit({ type: 'REORG_FAILED', payload: { error: 'Need at least 2 Q&As to reorganize.' } });
    return { success: false, error: { code: 'TOO_FEW', message: 'Need at least 2 Q&As to reorganize.', retryable: false } };
  }

  // Build compact QA manifest for the LLM
  const qaManifest = qaNodes.map((q) => ({
    id: q.id,
    s: (q.shortSummary || q.summary || q.answer || '').slice(0, 200),
    k: q.keywords.slice(0, 3),
  }));

  const systemPrompt = [
    'You are a knowledge organization assistant. Given a list of Q&A items, organize them into a coherent academic knowledge hierarchy.',
    '',
    'Structure policy (strictly follow):',
    '- rootLabel: always "Knowledge"',
    '- branchLabel: a TOP-LEVEL academic discipline (e.g., "Psychology", "Computer Science", "Physics", "Economics", "Biology", "Mathematics", "Philosophy")',
    '- clusterLabel: a domain, theory, or sub-field WITHIN that discipline (e.g., "Learning Theory", "Machine Learning", "Thermodynamics")',
    '- anchorName: a specific concept or phenomenon (e.g., "Spaced Repetition", "Transformer Architecture", "Entropy"). Must NEVER duplicate clusterLabel.',
    '- keyword: a single most descriptive keyword for the anchor concept',
    '- qaIds: array of Q&A item IDs that belong under this anchor concept',
    '',
    'Rules:',
    '- Every Q&A ID from the input must appear in exactly ONE anchor\'s qaIds array. Do not omit or duplicate any ID.',
    '- Group related Q&As under the same anchor when they discuss the same concept.',
    '- Create separate anchors for distinct concepts, even if they share a cluster.',
    '- Prefer fewer, well-organized branches and clusters over many fragmented ones.',
    '- Each anchor must have at least 1 qaId.',
    '',
    'Respond ONLY with valid JSON (no markdown, no explanation, no trailing characters):',
    '{"hierarchy":[{"rootLabel":"Knowledge","branches":[{"branchLabel":"...","clusters":[{"clusterLabel":"...","anchors":[{"anchorName":"...","keyword":"...","qaIds":["id1","id2"]}]}]}]}]}',
  ].join('\n');

  const userMessage = JSON.stringify(qaManifest);

  try {
    const messagesForReorg: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    let raw = await chatCompletion(
      messagesForReorg,
      llmConfig,
      { maxTokens: 16384, serviceName: 'classification', jsonMode: true },
    );

    let result = parseReorgResponse(raw);

    // Auto-retry ONCE with error feedback on parse failure
    if (!result) {
      console.warn('[Trellis] Reorg: initial parse failed, retrying with feedback:', raw.slice(0, 300));
      const retryMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        ...messagesForReorg,
        { role: 'assistant', content: raw.slice(0, 2000) },
        { role: 'user', content: 'Your previous response was not valid JSON. Emit ONLY the JSON object matching the schema — no prose, no markdown fences, no trailing commas.' },
      ];
      raw = await chatCompletion(retryMessages, llmConfig, { maxTokens: 16384, serviceName: 'classification', jsonMode: true });
      result = parseReorgResponse(raw);
    }

    if (!result) {
      console.warn('[Trellis] Reorg: all parse tiers + retry failed:', raw.slice(0, 500));
      const msg = 'Could not parse LLM response as JSON after retry.';
      eventBus.emit({ type: 'REORG_FAILED', payload: { error: msg } });
      return { success: false, error: { code: 'PARSE_ERROR', message: msg, retryable: true } };
    }

    if (!result.hierarchy || !Array.isArray(result.hierarchy)) {
      const msg = 'LLM response missing hierarchy array.';
      eventBus.emit({ type: 'REORG_FAILED', payload: { error: msg } });
      return { success: false, error: { code: 'PARSE_ERROR', message: msg, retryable: true } };
    }

    // Schema validation — ensure the LLM covered enough of the input qaIds.
    const mentionedIds = new Set<string>();
    for (const root of result.hierarchy) {
      for (const branch of root.branches ?? []) {
        for (const cluster of branch.clusters ?? []) {
          for (const anchor of cluster.anchors ?? []) {
            for (const id of anchor.qaIds ?? []) mentionedIds.add(id);
          }
        }
      }
    }
    const coverage = qaNodes.length === 0 ? 1 : mentionedIds.size / qaNodes.length;
    if (coverage < 0.9) {
      const msg = `LLM omitted too many QA items (${mentionedIds.size}/${qaNodes.length} covered).`;
      console.warn('[Trellis] Reorg:', msg);
      eventBus.emit({ type: 'REORG_FAILED', payload: { error: msg } });
      return { success: false, error: { code: 'COVERAGE_ERROR', message: msg, retryable: true } };
    }

    // Validate: collect all qaIds from the response
    const assignedIds = new Set<string>();
    const qaIdSet = new Set(qaNodes.map((q) => q.id));

    for (const root of result.hierarchy) {
      for (const branch of root.branches ?? []) {
        for (const cluster of branch.clusters ?? []) {
          for (const anchor of cluster.anchors ?? []) {
            for (const qaId of anchor.qaIds ?? []) {
              if (qaIdSet.has(qaId) && !assignedIds.has(qaId)) {
                assignedIds.add(qaId);
              }
            }
          }
        }
      }
    }

    // Handle missing QA IDs — assign them to a fallback anchor
    const missingIds = qaNodes.filter((q) => !assignedIds.has(q.id)).map((q) => q.id);
    if (missingIds.length > 0) {
      if (result.hierarchy.length === 0) {
        result.hierarchy.push({ rootLabel: 'Knowledge', branches: [] });
      }
      const firstRoot = result.hierarchy[0];
      let generalBranch = firstRoot.branches.find((b) => b.branchLabel === 'General');
      if (!generalBranch) {
        generalBranch = { branchLabel: 'General', clusters: [] };
        firstRoot.branches.push(generalBranch);
      }
      let uncatCluster = generalBranch.clusters.find((c) => c.clusterLabel === 'Uncategorized');
      if (!uncatCluster) {
        uncatCluster = { clusterLabel: 'Uncategorized', anchors: [] };
        generalBranch.clusters.push(uncatCluster);
      }
      uncatCluster.anchors.push({
        anchorName: 'Unclassified Items',
        keyword: 'general',
        qaIds: missingIds,
      });
    }

    // Save compact structural snapshot BEFORE making changes (for revert)
    const oldStructuralNodes = allQuestions.filter((q) => q.isAnchorNode === true || q.isClusterNode === true);
    const qaPatches: ReorgSnapshot['qaPatches'] = {};
    for (const q of qaNodes) {
      qaPatches[q.id] = {
        rootLabel: q.rootLabel,
        branchLabel: q.branchLabel,
        clusterLabel: q.clusterLabel,
        parentId: q.parentId,
        clusterNodeId: q.clusterNodeId,
        placementReason: q.placementReason,
      };
    }
    const snapshot: ReorgSnapshot = { structuralNodes: oldStructuralNodes, qaPatches };
    try {
      localStorage.setItem(REORG_SNAPSHOT_KEY, JSON.stringify(snapshot));
    } catch {
      console.warn('[Trellis] Reorg: could not save revert snapshot (storage quota). Revert will not be available.');
    }

    // Build the new store
    const qaById = new Map(qaNodes.map((q) => [q.id, q]));
    const newStore: Question[] = [];
    let anchorCount = 0;
    let clusterCount = 0;
    const now = Date.now();

    // Keep flagged questions as-is (they're excluded from reorganization)
    const flaggedQuestions = allQuestions.filter((q) => q.flagged === true);
    newStore.push(...flaggedQuestions);

    for (const root of result.hierarchy) {
      const rootLabel = root.rootLabel || 'Knowledge';

      for (const branch of root.branches ?? []) {
        const branchLabel = branch.branchLabel || 'General concepts';

        for (const cluster of branch.clusters ?? []) {
          const clusterLabel = cluster.clusterLabel || 'Open questions';

          const clusterNodeId = `cluster-${now}-${clusterCount}-${Math.random().toString(36).slice(2, 7)}`;
          let clusterQaTotal = 0;
          const anchorNodes: Question[] = [];

          for (const anchor of cluster.anchors ?? []) {
            const anchorName = anchor.anchorName || clusterLabel;
            const anchorNodeId = `anchor-${now}-${anchorCount}-${Math.random().toString(36).slice(2, 7)}`;
            const anchorQaIds = (anchor.qaIds ?? []).filter((id) => qaById.has(id));

            const summaryEntries = anchorQaIds.map((id) => {
              const q = qaById.get(id)!;
              const shortSummary = q.shortSummary || q.summary || q.answer || '';
              return `[${id}] ${shortSummary.slice(0, 200)}`;
            });

            const anchorNode: Question = {
              id: anchorNodeId,
              timestamp: now,
              date: new Date().toISOString().slice(0, 10),
              content: anchorName,
              answer: '',
              summary: anchorName,
              title: anchorName,
              keywords: anchor.keyword ? [anchor.keyword] : [],
              relatedQuestionIds: [],
              categoryIds: [],
              reviewSchedule: { nextReviewDate: '9999-12-31', reviewCount: 0, easeFactor: 2.5 },
              createdAt: now,
              aliases: [],
              sourcePrompts: [],
              sourceQuestionIds: [],
              rootLabel,
              branchLabel,
              clusterLabel,
              nodeSummary: summaryEntries.join('\n'),
              isAnchorNode: true,
              qaCount: anchorQaIds.length,
              clusterNodeId,
            };

            anchorNodes.push(anchorNode);
            clusterQaTotal += anchorQaIds.length;

            for (const qaId of anchorQaIds) {
              const qa = qaById.get(qaId)!;
              newStore.push({
                ...qa,
                rootLabel,
                branchLabel,
                clusterLabel,
                parentId: anchorNodeId,
                clusterNodeId,
                placementReason: `Reorganized under ${branchLabel} > ${clusterLabel} > ${anchorName}`,
              });
              qaById.delete(qaId);
            }

            anchorCount++;
          }

          const clusterNode: Question = {
            id: clusterNodeId,
            timestamp: now,
            date: new Date().toISOString().slice(0, 10),
            content: clusterLabel,
            answer: '',
            summary: clusterLabel,
            title: clusterLabel,
            keywords: [],
            relatedQuestionIds: [],
            categoryIds: [],
            reviewSchedule: { nextReviewDate: '9999-12-31', reviewCount: 0, easeFactor: 2.5 },
            createdAt: now,
            aliases: [],
            sourcePrompts: [],
            sourceQuestionIds: [],
            rootLabel,
            branchLabel,
            clusterLabel,
            nodeSummary: '',
            isClusterNode: true,
            qaCount: clusterQaTotal,
          };

          newStore.push(clusterNode);
          newStore.push(...anchorNodes);
          clusterCount++;
        }
      }
    }

    // Reconcile with concurrent mutations (Phase 33 UAT-4 fix, 2026-04-21).
    // _doReorganize captured `allQuestions` at the start, then spent 10-30s in
    // LLM calls. The user may have deleted nodes OR asked a new question during
    // that window. Writing `newStore` verbatim would:
    //   - resurrect deleted QAs / flagged Qs (they're still in the stale snapshot
    //     that newStore was derived from) — the "deleted nodes get flushed back"
    //     regression
    //   - wipe out new QAs that landed after the snapshot was taken
    //
    // Read fresh localStorage, then:
    //   - drop any QA/flagged from newStore whose ID no longer exists in current
    //     storage (user deleted it mid-reorg)
    //   - append any QA/flagged present in current storage but NOT in the
    //     original snapshot (user asked a new question mid-reorg)
    //   - always keep newly-created cluster/anchor nodes (they're synthesized
    //     here, with new IDs not in any prior snapshot)
    const currentStoreRaw = localStorage.getItem(STORAGE_KEY);
    const currentStore: Question[] = currentStoreRaw
      ? (JSON.parse(currentStoreRaw) as Question[])
      : [];
    const currentIds = new Set(currentStore.map((q) => q.id));
    const originalIds = new Set(allQuestions.map((q) => q.id));

    const reconciled: Question[] = newStore.filter((q) => {
      // New structural nodes (cluster/anchor) always pass — synthesized fresh.
      if (q.isAnchorNode === true || q.isClusterNode === true) return true;
      // QAs/flagged: drop if the user deleted them during the LLM window.
      return currentIds.has(q.id);
    });
    const reconciledIds = new Set(reconciled.map((q) => q.id));
    // Append QAs/flagged that appeared in localStorage after the snapshot
    // (new questions asked during reorg). Exclude anchor/cluster nodes so we
    // don't carry forward any pre-reorg structural remnants.
    for (const q of currentStore) {
      if (q.isAnchorNode === true || q.isClusterNode === true) continue;
      if (reconciledIds.has(q.id)) continue;
      if (originalIds.has(q.id)) continue; // was in snapshot but got filtered out above → deleted
      reconciled.push(q);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(reconciled));

    eventBus.emit({ type: 'REORG_COMPLETED', payload: { anchorCount, clusterCount } });
    return { success: true, data: { anchorCount, clusterCount } };
  } catch (err) {
    // Remove snapshot on failure — nothing was changed
    localStorage.removeItem(REORG_SNAPSHOT_KEY);
    const message = err instanceof Error ? err.message : 'Reorganization failed unexpectedly.';
    eventBus.emit({ type: 'REORG_FAILED', payload: { error: message } });
    return { success: false, error: { code: 'LLM_ERROR', message, retryable: true } };
  }
}

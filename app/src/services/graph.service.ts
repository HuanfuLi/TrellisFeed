import type { Question, ServiceResult } from '../types';
import { questionService } from './question.service';
import { dbExecute, dbQuery } from './db.service';

// ─── Similarity helpers ───────────────────────────────────────────────────────

/**
 * Cosine similarity between two embedding vectors.
 * Returns a score in [-1, 1] (higher = more similar).
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Jaccard-style keyword overlap score in [0, 1].
 * Used as a fallback when embeddings are unavailable.
 */
function keywordSimilarity(a: Question, b: Question): number {
  if (a.keywords.length === 0 || b.keywords.length === 0) return 0;
  const setA = new Set(a.keywords);
  const setB = new Set(b.keywords);
  let intersection = 0;
  for (const k of setA) if (setB.has(k)) intersection++;
  return intersection / (setA.size + setB.size - intersection);
}

/**
 * Combined similarity: prefers cosine on embeddings when both nodes have them,
 * blends with keyword overlap otherwise.
 */
function similarity(a: Question, b: Question): number {
  const hasEmbeddings =
    Array.isArray(a.embedding) && a.embedding.length > 0 &&
    Array.isArray(b.embedding) && b.embedding.length > 0;

  if (hasEmbeddings) {
    // Blend 80% cosine + 20% keyword overlap for robustness
    return 0.8 * cosineSimilarity(a.embedding!, b.embedding!) + 0.2 * keywordSimilarity(a, b);
  }
  return keywordSimilarity(a, b);
}

// ─── Edge key (canonical order) ──────────────────────────────────────────────

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

// ─── Edge weight persistence (SQLite / localStorage via db.service) ───────────

async function initEdgeTable(): Promise<void> {
  await dbExecute(
    `CREATE TABLE IF NOT EXISTS edge_weights (
      edge_key TEXT PRIMARY KEY,
      weight INTEGER NOT NULL DEFAULT 0
    )`,
  );
}

async function loadEdgeWeights(): Promise<Record<string, number>> {
  await initEdgeTable();
  const rows = await dbQuery<{ edge_key: string; weight: number }>('SELECT * FROM edge_weights');
  const map: Record<string, number> = {};
  for (const row of rows) map[row.edge_key] = row.weight;
  return map;
}

async function incrementEdgeWeight(key: string): Promise<number> {
  await initEdgeTable();
  const existing = await dbQuery<{ edge_key: string; weight: number }>(
    'SELECT * FROM edge_weights WHERE edge_key = ?',
    [key],
  );
  const newWeight = (existing[0]?.weight ?? 0) + 1;
  await dbExecute(
    'INSERT OR REPLACE INTO edge_weights (edge_key, weight) VALUES (?, ?)',
    [key, newWeight],
  );
  return newWeight;
}

// ─── Graph Service ────────────────────────────────────────────────────────────

export const graphService = {
  /** Questions that have no outbound related links yet. */
  getUnlinkedNodes(): Question[] {
    return questionService.getAll().filter((q) => q.relatedQuestionIds.length === 0);
  },

  /**
   * Find questions most similar to the given source by cosine similarity
   * (embedding-based) when available, falling back to keyword Jaccard overlap.
   * Excludes the source and already-linked nodes.
   */
  getSimilarNodes(sourceId: string, limit = 4): Question[] {
    const all = questionService.getAll();
    const source = all.find((q) => q.id === sourceId);
    if (!source) return [];

    const alreadyLinked = new Set([sourceId, ...source.relatedQuestionIds]);

    return all
      .filter((q) => !alreadyLinked.has(q.id))
      .map((q) => ({ q, score: similarity(source, q) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ q }) => q);
  },

  /** Create a bidirectional edge between two nodes. */
  async linkNodes(sourceId: string, targetId: string): Promise<ServiceResult<void>> {
    const all = questionService.getAll();
    const sourceNode = all.find((q) => q.id === sourceId);
    const targetNode = all.find((q) => q.id === targetId);

    if (!sourceNode || !targetNode) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Node not found', retryable: false } };
    }

    if (!sourceNode.relatedQuestionIds.includes(targetId)) {
      questionService.updateRelatedIds(sourceId, [...sourceNode.relatedQuestionIds, targetId]);
    }
    if (!targetNode.relatedQuestionIds.includes(sourceId)) {
      questionService.updateRelatedIds(targetId, [...targetNode.relatedQuestionIds, sourceId]);
    }
    return { success: true };
  },

  /**
   * Increment the "aha!" reinforcement weight for the edge between two nodes.
   * Persisted via SQLite (native) or the localStorage-backed DB shim (web).
   */
  async reinforceEdge(idA: string, idB: string): Promise<number> {
    return incrementEdgeWeight(edgeKey(idA, idB));
  },

  async getEdgeWeight(idA: string, idB: string): Promise<number> {
    const weights = await loadEdgeWeights();
    return weights[edgeKey(idA, idB)] ?? 0;
  },

  /** Get all nodes and edges for the graph canvas. */
  async getGraph(): Promise<{ nodes: Question[]; edges: Array<{ source: string; target: string; weight: number }> }> {
    const nodes = questionService.getAll();
    const weights = await loadEdgeWeights();
    const edgeSet = new Set<string>();
    const edges: Array<{ source: string; target: string; weight: number }> = [];

    for (const node of nodes) {
      for (const targetId of node.relatedQuestionIds) {
        const key = edgeKey(node.id, targetId);
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({ source: node.id, target: targetId, weight: weights[key] ?? 0 });
        }
      }
    }

    return { nodes, edges };
  },
};

export interface DedupeCandidate {
  id: string;
  canonicalUrl: string;
  contentHash: string;
  fullText: string;
}

export type DedupeReason = 'canonical-url' | 'content-hash' | 'near-text';

export interface DedupeGroup {
  representativeId: string;
  candidateIds: string[];
  reasons: DedupeReason[];
  maximumSimilarity: number;
  requiresHumanReview: true;
}

export interface DedupeOptions {
  shingleSize?: number;
  nearThreshold?: number;
  maxCandidates?: number;
  maxTokensPerCandidate?: number;
}

const REASON_ORDER: DedupeReason[] = ['canonical-url', 'content-hash', 'near-text'];

function tokens(value: string, limit: number): string[] {
  return value.normalize('NFKC').toLocaleLowerCase('en-US').match(/[\p{L}\p{N}]+/gu)?.slice(0, limit) ?? [];
}

function shingles(value: string, size: number, tokenLimit: number): Set<string> {
  const words = tokens(value, tokenLimit);
  const result = new Set<string>();
  if (words.length < size) {
    if (words.length) result.add(words.join('\u0000'));
    return result;
  }
  for (let index = 0; index <= words.length - size; index += 1) result.add(words.slice(index, index + size).join('\u0000'));
  return result;
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (!left.size && !right.size) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

export function groupDuplicates(input: readonly DedupeCandidate[], options: DedupeOptions = {}): DedupeGroup[] {
  const shingleSize = options.shingleSize ?? 5;
  const nearThreshold = options.nearThreshold ?? 0.82;
  const maxCandidates = options.maxCandidates ?? 800;
  const maxTokens = options.maxTokensPerCandidate ?? 20_000;
  if (!Number.isInteger(shingleSize) || shingleSize < 1 || shingleSize > 12) throw new Error('shingle size must be an integer from 1 to 12');
  if (!Number.isFinite(nearThreshold) || nearThreshold <= 0 || nearThreshold > 1) throw new Error('near threshold must be in (0, 1]');
  if (input.length > maxCandidates) throw new Error(`candidate limit exceeded (${maxCandidates})`);
  if (!Number.isInteger(maxTokens) || maxTokens < 1) throw new Error('token limit must be a positive integer');

  const candidates = [...input].sort((left, right) => left.id.localeCompare(right.id));
  if (new Set(candidates.map((candidate) => candidate.id)).size !== candidates.length) throw new Error('candidate IDs must be unique');
  const parent = candidates.map((_, index) => index);
  const find = (index: number): number => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  };
  const union = (left: number, right: number): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[Math.max(leftRoot, rightRoot)] = Math.min(leftRoot, rightRoot);
  };
  const candidateShingles = candidates.map((candidate) => shingles(candidate.fullText, shingleSize, maxTokens));
  const edges: Array<{ left: number; right: number; reasons: Set<DedupeReason>; similarity: number }> = [];

  for (let left = 0; left < candidates.length; left += 1) {
    for (let right = left + 1; right < candidates.length; right += 1) {
      const reasons = new Set<DedupeReason>();
      if (candidates[left].canonicalUrl === candidates[right].canonicalUrl) reasons.add('canonical-url');
      if (candidates[left].contentHash === candidates[right].contentHash) reasons.add('content-hash');
      const similarity = jaccard(candidateShingles[left], candidateShingles[right]);
      if (similarity >= nearThreshold) reasons.add('near-text');
      if (reasons.size) {
        union(left, right);
        edges.push({ left, right, reasons, similarity });
      }
    }
  }

  const components = new Map<number, number[]>();
  candidates.forEach((_, index) => {
    const root = find(index);
    components.set(root, [...(components.get(root) ?? []), index]);
  });
  return [...components.values()].map((indexes) => {
    const indexSet = new Set(indexes);
    const componentEdges = edges.filter((edge) => indexSet.has(edge.left) && indexSet.has(edge.right));
    const observed = new Set(componentEdges.flatMap((edge) => [...edge.reasons]));
    const candidateIds = indexes.map((index) => candidates[index].id).sort((left, right) => left.localeCompare(right));
    return {
      representativeId: candidateIds[0], candidateIds,
      reasons: REASON_ORDER.filter((reason) => observed.has(reason)),
      maximumSimilarity: componentEdges.reduce((maximum, edge) => Math.max(maximum, edge.similarity), 0),
      requiresHumanReview: true as const,
    };
  }).sort((left, right) => left.representativeId.localeCompare(right.representativeId));
}

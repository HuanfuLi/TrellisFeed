import type {
  EmbeddingFingerprint,
  GlobalEdge,
  GlobalEdgeType,
  PostRankingFeatures,
  SourceRecord,
} from '../domain/graph.types.ts';
import type { ServiceResult } from '../types/index.ts';
import { dbQuery, type Row } from './db.service.ts';

interface MetaRow extends Row {
  version: string;
  status: string;
  data: string;
}

interface GraphRow extends Row {
  version: string;
  position: number;
  data: string;
}

interface GraphMetaPayload {
  embeddingFingerprint: EmbeddingFingerprint | null;
}

const cloneEdge = (edge: GlobalEdge): GlobalEdge => ({ ...edge });
const cloneFeatures = (features: PostRankingFeatures): PostRankingFeatures => ({
  ...features,
  ...(features.summaryVector ? { summaryVector: [...features.summaryVector] } : {}),
});

export class GlobalGraphRepository {
  private loaded = false;
  private edgesByTypeIndex = new Map<GlobalEdgeType, GlobalEdge[]>();
  private edgesFromIndex = new Map<string, GlobalEdge[]>();
  private edgesToIndex = new Map<string, GlobalEdge[]>();
  private sourcesById = new Map<string, SourceRecord>();
  private rankingByPostId = new Map<string, PostRankingFeatures>();
  private fingerprint: EmbeddingFingerprint | null = null;

  async load(): Promise<ServiceResult<void>> {
    this.reset();
    try {
      const metaRows = await dbQuery<MetaRow>('SELECT * FROM content_pool_meta');
      const readyRows = metaRows.filter((row) => row.status === 'ready');
      if (readyRows.length !== 1) throw new Error('content pool is not ready');
      const ready = readyRows[0];
      const [edgeRows, sourceRows, rankingRows] = await Promise.all([
        dbQuery<GraphRow>('SELECT * FROM content_pool_global_edges WHERE version = ?', [ready.version]),
        dbQuery<GraphRow>('SELECT * FROM content_pool_sources WHERE version = ?', [ready.version]),
        dbQuery<GraphRow>('SELECT * FROM content_pool_ranking_features WHERE version = ?', [ready.version]),
      ]);
      const byPosition = (left: GraphRow, right: GraphRow) => left.position - right.position;
      edgeRows.sort(byPosition);
      sourceRows.sort(byPosition);
      rankingRows.sort(byPosition);

      const payload = JSON.parse(ready.data) as GraphMetaPayload;
      if (!Object.hasOwn(payload, 'embeddingFingerprint')) throw new Error('graph metadata is missing');
      this.fingerprint = payload.embeddingFingerprint;

      for (const row of sourceRows) {
        const source = JSON.parse(row.data) as SourceRecord;
        if (this.sourcesById.has(source.id)) throw new Error('duplicate graph source');
        this.sourcesById.set(source.id, source);
      }
      for (const row of edgeRows) {
        const edge = JSON.parse(row.data) as GlobalEdge;
        this.addIndex(this.edgesByTypeIndex, edge.type, edge);
        this.addIndex(this.edgesFromIndex, edge.sourceId, edge);
        this.addIndex(this.edgesToIndex, edge.targetId, edge);
      }
      for (const row of rankingRows) {
        const features = JSON.parse(row.data) as PostRankingFeatures;
        if (this.rankingByPostId.has(features.postId) || !this.sourcesById.has(features.sourceId)) {
          throw new Error('invalid ranking features');
        }
        this.rankingByPostId.set(features.postId, features);
      }
      for (const index of [this.edgesByTypeIndex, this.edgesFromIndex, this.edgesToIndex]) {
        for (const edges of index.values()) edges.sort((left, right) => left.id.localeCompare(right.id));
      }
      this.loaded = true;
      return { success: true };
    } catch {
      this.reset();
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'The frozen global graph could not be loaded from a ready content pool.',
          retryable: true,
        },
      };
    }
  }

  edgesByType(type: GlobalEdgeType): GlobalEdge[] {
    this.requireLoaded();
    return (this.edgesByTypeIndex.get(type) ?? []).map(cloneEdge);
  }

  edgesFrom(nodeId: string): GlobalEdge[] {
    this.requireLoaded();
    return (this.edgesFromIndex.get(nodeId) ?? []).map(cloneEdge);
  }

  edgesTo(nodeId: string): GlobalEdge[] {
    this.requireLoaded();
    return (this.edgesToIndex.get(nodeId) ?? []).map(cloneEdge);
  }

  oneHopConcepts(conceptId: string): string[] {
    this.requireLoaded();
    const related = new Set<string>();
    for (const type of ['related_to', 'prerequisite_of'] as const) {
      for (const edge of this.edgesByTypeIndex.get(type) ?? []) {
        if (edge.sourceId === conceptId) related.add(edge.targetId);
        if (edge.targetId === conceptId) related.add(edge.sourceId);
      }
    }
    return [...related].sort();
  }

  opposingClaims(claimId: string): string[] {
    this.requireLoaded();
    const opposing = new Set<string>();
    for (const edge of this.edgesByTypeIndex.get('contrasts_with') ?? []) {
      if (edge.sourceId === claimId) opposing.add(edge.targetId);
      if (edge.targetId === claimId) opposing.add(edge.sourceId);
    }
    return [...opposing].sort();
  }

  rankingFeatures(postId: string): PostRankingFeatures | null {
    this.requireLoaded();
    const features = this.rankingByPostId.get(postId);
    return features ? cloneFeatures(features) : null;
  }

  embeddingFingerprint(): EmbeddingFingerprint | null {
    this.requireLoaded();
    return this.fingerprint ? { ...this.fingerprint } : null;
  }

  private addIndex<K>(index: Map<K, GlobalEdge[]>, key: K, edge: GlobalEdge): void {
    index.set(key, [...(index.get(key) ?? []), edge]);
  }

  private requireLoaded(): void {
    if (!this.loaded) throw new Error('Global graph repository is not loaded');
  }

  private reset(): void {
    this.loaded = false;
    this.edgesByTypeIndex.clear();
    this.edgesFromIndex.clear();
    this.edgesToIndex.clear();
    this.sourcesById.clear();
    this.rankingByPostId.clear();
    this.fingerprint = null;
  }
}

export const globalGraphRepository = new GlobalGraphRepository();

import type {
  Claim,
  Concept,
  FrozenPoolManifest,
  OriginalContentAsset,
  Post,
  SuggestedQuestion,
  Topic,
} from '../domain/content.types.ts';
import {
  ContentPoolBundleError,
  PACKAGED_CONTENT_POOL_VERSION,
  loadBundledContentPool,
  validateBundledContentPool,
  type FrozenGraphPoolBundle,
  type FrozenGraphPoolManifest,
  type ContentPoolErrorCode,
  type PackagedPoolReader,
} from '../data/content-pool-bundle.ts';
import type { EmbeddingFingerprint, GlobalEdge } from '../domain/graph.types.ts';
import { dbExecute, dbQuery, type Row } from './db.service.ts';

export type ContentPoolImportStatus = 'empty' | 'importing' | 'ready' | 'error';
export type ContentPoolRepositoryErrorCode = ContentPoolErrorCode
  | 'POOL_IMPORT_FAILED'
  | 'POOL_STORED_CORRUPT'
  | 'POOL_READY_IMMUTABLE';

export interface ContentPoolRepositorySnapshot {
  status: ContentPoolImportStatus;
  version: string | null;
  errorCode?: ContentPoolRepositoryErrorCode;
}

interface RepositoryDatabase {
  execute(sql: string, values?: (string | number | null)[]): Promise<void>;
  query<T extends Row>(sql: string, values?: (string | number | null)[]): Promise<T[]>;
}

interface ContentPoolRepositoryOptions {
  reader?: PackagedPoolReader;
  database?: RepositoryDatabase;
}

interface MetaPayload {
  manifest: FrozenGraphPoolManifest;
  storageHashes: FrozenGraphPoolManifest['artifactHashes'];
  embeddingFingerprint: EmbeddingFingerprint | null;
}

interface MetaRow extends Row {
  version: string;
  status: string;
  data: string;
}

interface DataRow extends Row {
  storage_id: string;
  version: string;
  record_id: string;
  position: number;
  data: string;
}

const tables = {
  topics: 'content_pool_topics',
  posts: 'content_pool_posts',
  concepts: 'content_pool_concepts',
  claims: 'content_pool_claims',
  suggestedQuestions: 'content_pool_suggestions',
  sourceAssets: 'content_pool_assets',
  sources: 'content_pool_sources',
  globalEdges: 'content_pool_global_edges',
  rankingFeatures: 'content_pool_ranking_features',
} as const;

const artifactNames = {
  topics: 'topics.json',
  posts: 'posts.json',
  concepts: 'concepts.json',
  claims: 'claims.json',
  suggestedQuestions: 'suggested_questions.json',
  sourceAssets: 'source_assets.json',
  sources: 'sources.json',
  globalEdges: 'global_edges.json',
  rankingFeatures: 'ranking_features.json',
} as const;

type CollectionName = keyof typeof tables;
type StoredRecord = { recordId: string; data: unknown };

type GlobalNodeKind = 'post' | 'concept' | 'claim' | 'suggested-question';
type GlobalNode = { topicId: string; kind: GlobalNodeKind };
const edgeEndpointKinds: Record<GlobalEdge['type'], { source: GlobalNodeKind[]; target: GlobalNodeKind[] }> = {
  explains: { source: ['post'], target: ['concept'] },
  mentions: { source: ['post'], target: ['concept'] },
  supports: { source: ['post'], target: ['claim'] },
  challenges: { source: ['post'], target: ['claim'] },
  about: { source: ['claim'], target: ['concept'] },
  contrasts_with: { source: ['claim'], target: ['claim'] },
  related_to: { source: ['concept'], target: ['concept'] },
  prerequisite_of: { source: ['concept'], target: ['concept'] },
  targets: { source: ['suggested-question'], target: ['concept', 'claim'] },
};

function recordsFor(bundle: FrozenGraphPoolBundle, name: CollectionName): StoredRecord[] {
  if (name === 'rankingFeatures') {
    return bundle.rankingFeatures.posts.map((record) => ({ recordId: record.postId, data: record }));
  }
  return (bundle[name] as Array<{ id?: string; postId?: string }>).map((record) => {
    const recordId = record.id ?? record.postId;
    if (!recordId) throw new ContentPoolBundleError('POOL_INVALID');
    return { recordId, data: record };
  });
}

function validateGlobalEdgeReferences(bundle: FrozenGraphPoolBundle): void {
  const nodes = new Map<string, GlobalNode>();
  const addNodes = (records: Array<{ id: string; topicId: string }>, kind: GlobalNodeKind) => {
    for (const record of records) {
      if (nodes.has(record.id)) throw new ContentPoolBundleError('POOL_INVALID');
      nodes.set(record.id, { topicId: record.topicId, kind });
    }
  };
  addNodes(bundle.posts, 'post');
  addNodes(bundle.concepts, 'concept');
  addNodes(bundle.claims, 'claim');
  addNodes(bundle.suggestedQuestions, 'suggested-question');

  const edgeIds = new Set<string>();
  for (const edge of bundle.globalEdges) {
    const source = nodes.get(edge.sourceId);
    const target = nodes.get(edge.targetId);
    const legal = edgeEndpointKinds[edge.type];
    if (edgeIds.has(edge.id) || edge.id !== `${edge.type}:${edge.sourceId}:${edge.targetId}`
      || !legal || !source || !target || !legal.source.includes(source.kind) || !legal.target.includes(target.kind)
      || source.topicId !== target.topicId || edge.topicId !== source.topicId || edge.topicId !== target.topicId) {
      throw new ContentPoolBundleError('POOL_INVALID');
    }
    edgeIds.add(edge.id);
  }
}

async function digest(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function canonicalHashes(bundle: FrozenGraphPoolBundle): Promise<FrozenGraphPoolManifest['artifactHashes']> {
  const entries = await Promise.all((Object.keys(tables) as CollectionName[]).map(async (name) => [
    artifactNames[name],
    await digest(JSON.stringify(bundle[name])),
  ] as const));
  return Object.fromEntries(entries) as FrozenGraphPoolManifest['artifactHashes'];
}

function errorSnapshot(code: ContentPoolRepositoryErrorCode, version: string | null = null): ContentPoolRepositorySnapshot {
  return { status: 'error', version, errorCode: code };
}

function bundleErrorCode(error: unknown): ContentPoolRepositoryErrorCode {
  return error instanceof ContentPoolBundleError ? error.code : 'POOL_IMPORT_FAILED';
}

export class ContentPoolRepository {
  private readonly reader?: PackagedPoolReader;
  private readonly database: RepositoryDatabase;
  private snapshot: ContentPoolRepositorySnapshot = { status: 'empty', version: null };
  private hydration: Promise<ContentPoolRepositorySnapshot> | null = null;
  private readyManifest: FrozenPoolManifest | null = null;
  private topics = new Map<string, Topic>();
  private posts = new Map<string, Post>();
  private concepts = new Map<string, Concept>();
  private claims = new Map<string, Claim>();
  private suggestions = new Map<string, SuggestedQuestion>();
  private assets = new Map<string, OriginalContentAsset>();

  constructor(options: ContentPoolRepositoryOptions = {}) {
    this.reader = options.reader;
    this.database = options.database ?? { execute: dbExecute, query: dbQuery };
  }

  hydrate(): Promise<ContentPoolRepositorySnapshot> {
    if (this.snapshot.status === 'error') this.hydration = null;
    if (!this.hydration) this.hydration = this.hydrateOnce();
    return this.hydration;
  }

  private async hydrateOnce(): Promise<ContentPoolRepositorySnapshot> {
    this.clearMirror();
    const expectedVersion = this.reader?.expectedVersion ?? PACKAGED_CONTENT_POOL_VERSION;
    try {
      const metaRows = await this.database.query<MetaRow>('SELECT * FROM content_pool_meta');
      const readyRows = metaRows.filter((row) => row.status === 'ready');
      const ready = readyRows.find((row) => row.version === expectedVersion);
      if (ready) {
        if (readyRows.length !== 1) return this.setError('POOL_STORED_CORRUPT', expectedVersion);
        return await this.exposeReadyRow(ready);
      }
      if (readyRows.length > 0) return this.setError('POOL_VERSION_MISMATCH');

      const bundle = await loadBundledContentPool(this.reader);
      return await this.importBundledVersion(bundle);
    } catch (error) {
      return this.setError(bundleErrorCode(error), expectedVersion);
    }
  }

  async importBundledVersion(bundle: FrozenGraphPoolBundle): Promise<ContentPoolRepositorySnapshot> {
    const version = bundle.manifest.contentPoolVersion;
    this.clearMirror();
    this.snapshot = { status: 'importing', version };
    try {
      const existingRows = await this.database.query<MetaRow>('SELECT * FROM content_pool_meta WHERE version = ?', [version]);
      const existingReady = existingRows.find((row) => row.status === 'ready');
      if (existingReady) {
        const payload = this.parseMeta(existingReady);
        if (JSON.stringify(payload.manifest.artifactHashes) !== JSON.stringify(bundle.manifest.artifactHashes)) {
          return this.setError('POOL_READY_IMMUTABLE', version);
        }
        return await this.exposeReadyRow(existingReady);
      }

      const storageHashes = await canonicalHashes(bundle);
      const payload: MetaPayload = {
        manifest: bundle.manifest,
        storageHashes,
        embeddingFingerprint: bundle.rankingFeatures.embeddingFingerprint,
      };
      await this.database.execute(
        'INSERT OR REPLACE INTO content_pool_meta (version, status, data) VALUES (?, ?, ?)',
        [version, 'importing', JSON.stringify(payload)],
      );
      for (const table of Object.values(tables)) {
        await this.database.execute(`DELETE FROM ${table} WHERE version = ?`, [version]);
      }
      for (const name of Object.keys(tables) as CollectionName[]) {
        const records = recordsFor(bundle, name);
        for (let position = 0; position < records.length; position += 1) {
          const record = records[position];
          await this.database.execute(
            `INSERT OR REPLACE INTO ${tables[name]} (storage_id, version, record_id, position, data) VALUES (?, ?, ?, ?, ?)`,
            [`${version}:${record.recordId}`, version, record.recordId, position, JSON.stringify(record.data)],
          );
        }
      }

      const staged = await this.readVersion(version, payload);
      await this.validateStoredBundle(staged, payload, version);
      await this.database.execute(
        'INSERT OR REPLACE INTO content_pool_meta (version, status, data) VALUES (?, ?, ?)',
        [version, 'ready', JSON.stringify(payload)],
      );
      this.installMirror(staged);
      this.snapshot = { status: 'ready', version };
      return this.getSnapshot();
    } catch (error) {
      return this.setError(bundleErrorCode(error), version);
    }
  }

  private async exposeReadyRow(row: MetaRow): Promise<ContentPoolRepositorySnapshot> {
    try {
      const payload = this.parseMeta(row);
      const bundle = await this.readVersion(row.version, payload);
      await this.validateStoredBundle(bundle, payload, row.version);
      this.installMirror(bundle);
      this.snapshot = { status: 'ready', version: row.version };
      return this.getSnapshot();
    } catch {
      return this.setError('POOL_STORED_CORRUPT', row.version);
    }
  }

  private parseMeta(row: MetaRow): MetaPayload {
    const parsed = JSON.parse(row.data) as MetaPayload;
    if (!parsed?.manifest || !parsed?.storageHashes || !Object.hasOwn(parsed, 'embeddingFingerprint')) {
      throw new Error('invalid pool metadata');
    }
    return parsed;
  }

  private async readVersion(version: string, payload: MetaPayload): Promise<FrozenGraphPoolBundle> {
    const loaded = {} as Record<Exclude<CollectionName, 'rankingFeatures'>, unknown[]>;
    for (const name of Object.keys(tables) as CollectionName[]) {
      const rows = await this.database.query<DataRow>(`SELECT * FROM ${tables[name]} WHERE version = ?`, [version]);
      rows.sort((left, right) => left.position - right.position);
      if (name === 'rankingFeatures') continue;
      loaded[name] = rows.map((row) => JSON.parse(row.data));
    }
    const rankingRows = await this.database.query<DataRow>('SELECT * FROM content_pool_ranking_features WHERE version = ?', [version]);
    rankingRows.sort((left, right) => left.position - right.position);
    return {
      manifest: payload.manifest,
      ...loaded,
      rankingFeatures: {
        embeddingFingerprint: payload.embeddingFingerprint,
        posts: rankingRows.map((row) => JSON.parse(row.data)),
      },
    } as FrozenGraphPoolBundle;
  }

  private async validateStoredBundle(bundle: FrozenGraphPoolBundle, payload: MetaPayload, version: string): Promise<void> {
    validateGlobalEdgeReferences(bundle);
    const storedManifest = { ...payload.manifest, artifactHashes: payload.storageHashes };
    const canonicalBundle = { ...bundle, manifest: storedManifest };
    const texts = Object.fromEntries((Object.keys(tables) as CollectionName[]).map((name) => [
      artifactNames[name],
      JSON.stringify(bundle[name]),
    ])) as Record<(typeof artifactNames)[CollectionName], string>;
    await validateBundledContentPool(canonicalBundle, texts, version);
  }

  private installMirror(bundle: FrozenGraphPoolBundle): void {
    this.readyManifest = structuredClone(bundle.manifest);
    this.topics = new Map(bundle.topics.map((record) => [record.id, record]));
    this.posts = new Map(bundle.posts.map((record) => [record.id, record]));
    this.concepts = new Map(bundle.concepts.map((record) => [record.id, record]));
    this.claims = new Map(bundle.claims.map((record) => [record.id, record]));
    this.suggestions = new Map(bundle.suggestedQuestions.map((record) => [record.id, record]));
    this.assets = new Map(bundle.sourceAssets.map((record) => [record.postId, record]));
  }

  private clearMirror(): void {
    this.readyManifest = null;
    this.topics.clear();
    this.posts.clear();
    this.concepts.clear();
    this.claims.clear();
    this.suggestions.clear();
    this.assets.clear();
  }

  private setError(code: ContentPoolRepositoryErrorCode, version: string | null = null): ContentPoolRepositorySnapshot {
    this.clearMirror();
    this.snapshot = errorSnapshot(code, version);
    return this.getSnapshot();
  }

  getSnapshot(): ContentPoolRepositorySnapshot { return { ...this.snapshot }; }
  getReadyVersion(): string | null { return this.snapshot.status === 'ready' ? this.snapshot.version : null; }
  getManifest(): FrozenPoolManifest | null {
    if (this.snapshot.status !== 'ready') return null;
    // Expose a detached value so facade consumers cannot mutate repository state.
    return this.readyManifest ? structuredClone(this.readyManifest) : null;
  }
  getPost(id: string): Post | null { return this.snapshot.status === 'ready' ? this.posts.get(id) ?? null : null; }
  getTopic(id: string): Topic | null { return this.snapshot.status === 'ready' ? this.topics.get(id) ?? null : null; }

  getConcepts(postId: string): Concept[] {
    const post = this.getPost(postId);
    return post ? post.conceptIds.map((id) => this.concepts.get(id)).filter((record): record is Concept => !!record) : [];
  }

  getClaims(postId: string): Claim[] {
    const post = this.getPost(postId);
    return post ? post.claimIds.map((id) => this.claims.get(id)).filter((record): record is Claim => !!record) : [];
  }

  getSuggestedQuestions(postId: string): SuggestedQuestion[] {
    const post = this.getPost(postId);
    return post ? post.suggestedQuestionIds.map((id) => this.suggestions.get(id)).filter((record): record is SuggestedQuestion => !!record) : [];
  }

  getOriginalContent(postId: string): OriginalContentAsset | null {
    return this.snapshot.status === 'ready' ? this.assets.get(postId) ?? null : null;
  }
}

export const contentPoolRepository = new ContentPoolRepository();

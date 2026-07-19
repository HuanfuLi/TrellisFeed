import type { ServiceResult } from '../types/index.ts';
import {
  contentPoolRepository,
  type ContentPoolRepositorySnapshot,
} from './content-pool.repository.ts';
import { globalGraphRepository } from './global-graph.repository.ts';

export interface ContentPoolHydrator {
  hydrate(): Promise<ContentPoolRepositorySnapshot>;
}

export interface GlobalGraphLoader {
  load(): Promise<ServiceResult<void>>;
}

export interface ContentPoolBootServiceOptions {
  contentPool?: ContentPoolHydrator;
  globalGraph?: GlobalGraphLoader;
}

/**
 * One fail-closed barrier for the immutable pool and its in-memory graph indexes.
 * Participant routes may consume only a `ready` result from this service.
 */
export class ContentPoolBootService {
  private readonly contentPool: ContentPoolHydrator;
  private readonly globalGraph: GlobalGraphLoader;

  constructor(options: ContentPoolBootServiceOptions = {}) {
    this.contentPool = options.contentPool ?? contentPoolRepository;
    this.globalGraph = options.globalGraph ?? globalGraphRepository;
  }

  async hydrate(): Promise<ContentPoolRepositorySnapshot> {
    const pool = await this.contentPool.hydrate();
    if (pool.status !== 'ready') return pool;

    try {
      const graph = await this.globalGraph.load();
      if (graph.success) return pool;
    } catch {
      // The graph repository already resets partial indexes before surfacing errors.
    }

    return {
      status: 'error',
      version: pool.version,
      errorCode: 'POOL_STORED_CORRUPT',
    };
  }
}

export const contentPoolBootService = new ContentPoolBootService();

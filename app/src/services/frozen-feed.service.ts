import type {
  Claim,
  Concept,
  FrozenPoolManifest,
  OriginalContentAsset,
  Post,
  SuggestedQuestion,
} from '../domain/content.types.ts';
import {
  contentPoolRepository,
  type ContentPoolRepositorySnapshot,
} from './content-pool.repository.ts';
import { engagementService } from './engagement.service.ts';

export type FrozenFeedItem = Readonly<Post>;

export interface FrozenFeedSnapshot {
  readonly contentPoolVersion: string;
  readonly posts: readonly FrozenFeedItem[];
}

interface FrozenFeedRepository {
  getSnapshot(): ContentPoolRepositorySnapshot;
  getManifest(): FrozenPoolManifest | null;
  getPost(id: string): Post | null;
  getConcepts(postId: string): Concept[];
  getClaims(postId: string): Claim[];
  getSuggestedQuestions(postId: string): SuggestedQuestion[];
  getOriginalContent(postId: string): OriginalContentAsset | null;
}

export class FrozenFeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FrozenFeedError';
  }
}

function freezeClone<T>(value: T): Readonly<T> {
  const clone = structuredClone(value);
  const freeze = (candidate: unknown): void => {
    if (!candidate || typeof candidate !== 'object' || Object.isFrozen(candidate)) return;
    for (const nested of Object.values(candidate)) freeze(nested);
    Object.freeze(candidate);
  };
  freeze(clone);
  return clone;
}

export class FrozenFeedService {
  private readonly repository: FrozenFeedRepository;
  private readonly dismissedPostIds: () => ReadonlySet<string>;

  constructor(
    repository: FrozenFeedRepository,
    dismissedPostIds: () => ReadonlySet<string>,
  ) {
    this.repository = repository;
    this.dismissedPostIds = dismissedPostIds;
  }

  private requireReady(): { snapshot: ContentPoolRepositorySnapshot; manifest: FrozenPoolManifest } {
    const snapshot = this.repository.getSnapshot();
    const manifest = this.repository.getManifest();
    if (snapshot.status !== 'ready' || !snapshot.version || !manifest ||
        manifest.contentPoolVersion !== snapshot.version) {
      throw new FrozenFeedError('Frozen content pool is not ready');
    }
    return { snapshot, manifest };
  }

  getFeed(): FrozenFeedItem[] {
    const { manifest } = this.requireReady();
    const dismissed = this.dismissedPostIds();
    return manifest.feedOrderPostIds.map((postId) => {
      const post = this.repository.getPost(postId);
      if (!post || post.id !== postId) {
        throw new FrozenFeedError(`Frozen feed references a missing post: ${postId}`);
      }
      return freezeClone(post);
    }).filter((post) => !dismissed.has(post.id));
  }

  getPostById(postId: string): FrozenFeedItem | null {
    this.requireReady();
    const post = this.repository.getPost(postId);
    return post ? freezeClone(post) : null;
  }

  getConcepts(postId: string): ReadonlyArray<Readonly<Concept>> {
    const post = this.getPostById(postId);
    if (!post) return [];
    const concepts = this.repository.getConcepts(postId);
    const byId = new Map(concepts.map((concept) => [concept.id, concept]));
    if (post.conceptIds.some((id) => !byId.has(id))) {
      throw new FrozenFeedError(`Frozen post has a dangling concept reference: ${postId}`);
    }
    return post.conceptIds.map((id) => freezeClone(byId.get(id)!));
  }

  getClaims(postId: string): ReadonlyArray<Readonly<Claim>> {
    const post = this.getPostById(postId);
    if (!post) return [];
    const claims = this.repository.getClaims(postId);
    const byId = new Map(claims.map((claim) => [claim.id, claim]));
    if (post.claimIds.some((id) => !byId.has(id))) {
      throw new FrozenFeedError(`Frozen post has a dangling claim reference: ${postId}`);
    }
    return post.claimIds.map((id) => freezeClone(byId.get(id)!));
  }

  getSuggestedQuestions(postId: string): ReadonlyArray<Readonly<SuggestedQuestion>> {
    const post = this.getPostById(postId);
    if (!post) return [];
    const conceptIds = new Set(this.getConcepts(postId).map((concept) => concept.id));
    const claimIds = new Set(this.getClaims(postId).map((claim) => claim.id));
    const suggestions = this.repository.getSuggestedQuestions(postId);
    const byId = new Map(suggestions.map((suggestion) => [suggestion.id, suggestion]));

    for (const suggestionId of post.suggestedQuestionIds) {
      const suggestion = byId.get(suggestionId);
      if (!suggestion || suggestion.postId !== post.id || suggestion.topicId !== post.topicId ||
          suggestion.targetConceptIds.some((id) => !conceptIds.has(id)) ||
          (suggestion.targetClaimIds ?? []).some((id) => !claimIds.has(id))) {
        throw new FrozenFeedError(`Frozen post has an invalid suggested question: ${suggestionId}`);
      }
    }
    return post.suggestedQuestionIds.map((id) => freezeClone(byId.get(id)!));
  }

  getOriginalContent(postId: string): Readonly<OriginalContentAsset> | null {
    const post = this.getPostById(postId);
    if (!post) return null;
    const asset = this.repository.getOriginalContent(postId);
    if (!asset || asset.postId !== post.id || asset.sourceUrl !== post.sourceUrl) {
      throw new FrozenFeedError(`Frozen post has invalid original content: ${postId}`);
    }
    return freezeClone(asset);
  }

  refresh(): FrozenFeedSnapshot {
    const { manifest } = this.requireReady();
    return freezeClone({
      contentPoolVersion: manifest.contentPoolVersion,
      posts: this.getFeed(),
    });
  }
}

export const frozenFeedService = new FrozenFeedService(
  contentPoolRepository,
  // The engagement store is ID-only; Plan 02-06's engagement migration renames
  // its legacy anchor-oriented accessor without changing this boundary.
  () => new Set(engagementService.getDismissedAnchorIds()),
);

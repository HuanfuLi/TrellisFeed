import type { Post } from '../domain/content.types';
import { FeedCard } from './FeedCard';

export interface MasonryFeedProps {
  posts: readonly Readonly<Post>[];
  conceptLabelsByPostId: ReadonlyMap<string, readonly string[]>;
  onOpenPost: (postId: string) => void;
}

export function MasonryFeed({ posts, conceptLabelsByPostId, onOpenPost }: MasonryFeedProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', width: '100%' }}>
      {posts.map((post) => (
        <FeedCard
          key={post.id}
          post={post}
          conceptLabels={conceptLabelsByPostId.get(post.id) ?? []}
          onOpen={onOpenPost}
        />
      ))}
    </div>
  );
}

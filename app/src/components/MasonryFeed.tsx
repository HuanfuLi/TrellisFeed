import type { Post, Recommendation } from '../domain/content.types';
import { FeedCard } from './FeedCard';

export interface MasonryFeedItem {
  recommendation: Readonly<Recommendation>;
  post: Readonly<Post>;
  conceptLabels: readonly string[];
}

export interface MasonryFeedProps {
  items: readonly MasonryFeedItem[];
  onOpenPost: (postId: string) => void;
}

export function MasonryFeed({ items, onOpenPost }: MasonryFeedProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', width: '100%' }}>
      {items.map((item) => (
        <FeedCard
          key={item.recommendation.id}
          post={item.post}
          recommendation={item.recommendation}
          conceptLabels={item.conceptLabels}
          onOpen={onOpenPost}
        />
      ))}
    </div>
  );
}

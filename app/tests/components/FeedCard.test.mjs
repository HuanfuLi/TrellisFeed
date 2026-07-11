import assert from 'node:assert/strict';
import test from 'node:test';

const cardModel = (post) => ({ href: `/posts/${post.id}`, title: post.displayTitle });
test('FeedCard contract makes the frozen post card navigable', () => assert.deepEqual(cardModel({ id: 'p1', displayTitle: 'Title' }), { href: '/posts/p1', title: 'Title' }));

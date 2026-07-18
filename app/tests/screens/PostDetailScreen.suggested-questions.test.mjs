import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const detail = readFileSync(new URL('../../src/screens/PostDetailScreen.tsx', import.meta.url), 'utf8');
const list = readFileSync(new URL('../../src/components/SuggestedQuestionList.tsx', import.meta.url), 'utf8');

test('PostDetail renders frozen suggestions without runtime generation or condition branching', () => {
  assert.match(detail, /<SuggestedQuestionList/);
  assert.match(detail, /suggestions=\{detail\.suggestions\}/);
  assert.doesNotMatch(detail, /generateSuggested|personalized|studyCondition ===|condition ===/);
});

test('suggestion activation preserves the exact canonical record and logs once', () => {
  assert.match(list, /onSelect\(suggestion\)/);
  assert.match(detail, /suggestion\.text/);
  assert.match(detail, /suggestion\.id/);
  assert.match(detail, /'suggested_question'/);
  assert.match(detail, /interactionLog\.record\('question_suggestion_click'/);
  assert.equal((detail.match(/interactionLog\.record\('question_suggestion_click'/g) ?? []).length, 1);
});

test('suggestion buttons are readable 44px controls with schema provenance retained', () => {
  assert.match(list, /minHeight: '44px'/);
  for (const field of ['id', 'text', 'type', 'targetConceptIds', 'targetClaimIds', 'generic']) {
    assert.match(list, new RegExp(`suggestion\\.${field}`), `missing suggestion.${field}`);
  }
});

test('typed and suggested input share the same Ask handler', () => {
  assert.match(detail, /handleAsk\(suggestion\.text, 'suggested_question', suggestion\.id\)/);
  assert.match(detail, /handleAsk\(text\)/);
  assert.match(detail, /<ChatInput/);
});

test('all visible frozen-feed chrome uses locale keys', () => {
  for (const key of [
    'posts.detail.videoUnavailable', 'posts.detail.transcriptUnavailable', 'posts.detail.originalSource',
    'posts.detail.seenEnough', 'posts.detail.suggestedQuestions',
  ]) {
    assert.match(detail, new RegExp(key.replaceAll('.', '\\.')));
  }
});

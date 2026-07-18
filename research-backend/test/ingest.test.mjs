import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../src/worker.ts';

async function hash(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function fakeD1(bindings) {
  const events = new Map();
  const questionAnswers = new Map();
  const tokens = new Map();
  for (const [token, account] of bindings) tokens.set(await hash(token), account);
  const statement = (sql, values = []) => ({
    bind(...next) { return statement(sql, next); },
    async all() {
      if (sql.includes('FROM research_installations i')) {
        const account = tokens.get(values[0]);
        return { results: account ? [{ user_id: account.userId, condition: account.condition, topic_id: account.topicId }] : [] };
      }
      if (sql.includes('FROM behavioral_events')) {
        const row = events.get(values[0]);
        return { results: row ? [{ user_id: row.userId }] : [] };
      }
      if (sql.includes('FROM question_answer_records')) {
        const row = questionAnswers.get(values[0]) ?? [...questionAnswers.values()].find((item) => item.questionId === values[1]);
        return { results: row ? [{ user_id: row.userId, question_id: row.questionId, revision: row.revision }] : [] };
      }
      throw new Error(`Unexpected all query: ${sql}`);
    },
    async run() {
      if (sql.includes('INSERT OR IGNORE INTO behavioral_events')) {
        const [id, userId, condition, topicId, timestamp, eventType, postId, questionId, recommendationId, durationMs, receivedAt] = values;
        if (!events.has(id)) events.set(id, { id, userId, condition, topicId, timestamp, eventType, postId, questionId, recommendationId, durationMs, receivedAt });
        return { success: true };
      }
      if (sql.includes('INSERT INTO question_answer_records')) {
        const [id, revision, userId, condition, topicId, postId, questionId, questionText, questionSource, submittedAt, answerText, answerViewedAt, receivedAt, answerId, suggestedQuestionId, questionCreatedAt, answerCreatedAt, modelName, citedPostIds, citedSourceUrls, conceptIds, claimIds, extractedConceptIds, extractedClaimIds, questionType, unresolved] = values;
        const existing = questionAnswers.get(id);
        if (!existing || revision > existing.revision) questionAnswers.set(id, { id, revision, userId, condition, topicId, postId, questionId, questionText, questionSource, submittedAt, answerText, answerViewedAt, receivedAt, answerId, suggestedQuestionId, questionCreatedAt, answerCreatedAt, modelName, citedPostIds, citedSourceUrls, conceptIds, claimIds, extractedConceptIds, extractedClaimIds, questionType, unresolved });
        return { success: true };
      }
      throw new Error(`Unexpected write: ${sql}`);
    },
  });
  return {
    events, questionAnswers,
    prepare(sql) { return statement(sql); },
    async batch(statements) { return Promise.all(statements.map((item) => item.run())); },
  };
}

function ingestRequest(records, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request('https://collector.invalid/v1/ingest', { method: 'POST', headers, body: JSON.stringify({ records }) });
}

const event = (overrides = {}) => ({ id: 'event-1', timestamp: '2026-07-11T12:00:00.000Z', eventType: 'post_open', postId: 'post-1', ...overrides });
const questionAnswer = (overrides = {}) => ({ id: 'qa-1', revision: 2, postId: 'post-1', questionId: 'question-1', answerId: 'answer-1', questionText: 'How does this work?', questionSource: 'typed', questionCreatedAt: '2026-07-11T12:00:00.000Z', answerText: 'A newer answer.', answerCreatedAt: '2026-07-11T12:00:01.000Z', modelName: 'fake-main', citedPostIds: ['post-1'], citedSourceUrls: ['https://example.test'], conceptIds: ['concept-1'], claimIds: ['claim-1'], extractedConceptIds: ['concept-1'], extractedClaimIds: ['claim-1'], questionType: 'evidence', unresolved: true, ...overrides });
const accountA = { userId: '1001', condition: 'control', topicId: 'server-topic-a' };
const accountB = { userId: '1002', condition: 'experimental', topicId: 'server-topic-b' };

test('ingest requires a valid bearer installation token', async () => {
  const db = await fakeD1([['token-a-0000000000000000000000000000', accountA]]);
  for (const token of [undefined, 'wrong-token-000000000000000000000000']) {
    const response = await worker.fetch(ingestRequest([event()], token), { DB: db });
    assert.equal(response.status, 401);
  }
  assert.equal(db.events.size, 0);
});

test('token-owned immutable events are idempotent and server-derived', async () => {
  const token = 'token-a-0000000000000000000000000000';
  const db = await fakeD1([[token, accountA]]);
  const first = await worker.fetch(ingestRequest([event()], token), { DB: db });
  const second = await worker.fetch(ingestRequest([event()], token), { DB: db });
  assert.deepEqual(await first.json(), { acknowledgedIds: ['event-1'] });
  assert.deepEqual(await second.json(), { acknowledgedIds: ['event-1'] });
  assert.deepEqual({ userId: db.events.get('event-1').userId, condition: db.events.get('event-1').condition, topicId: db.events.get('event-1').topicId }, accountA);
});

test('same-owner Q/A retries and higher revisions are idempotent', async () => {
  const token = 'token-a-0000000000000000000000000000';
  const db = await fakeD1([[token, accountA]]);
  await worker.fetch(ingestRequest([questionAnswer({ revision: 1, answerText: undefined })], token), { DB: db });
  await worker.fetch(ingestRequest([questionAnswer({ revision: 2 })], token), { DB: db });
  const stale = await worker.fetch(ingestRequest([questionAnswer({ revision: 1, answerText: 'stale' })], token), { DB: db });
  assert.equal(stale.status, 200);
  assert.equal(db.questionAnswers.get('qa-1').revision, 2);
  assert.equal(db.questionAnswers.get('qa-1').answerText, 'A newer answer.');
  assert.equal(db.questionAnswers.get('qa-1').extractedConceptIds, '["concept-1"]');
  assert.equal(db.questionAnswers.get('qa-1').extractedClaimIds, '["claim-1"]');
  assert.equal(db.questionAnswers.get('qa-1').questionType, 'evidence');
  assert.equal(db.questionAnswers.get('qa-1').unresolved, 1);
});

test('cross-account event and Q/A identifiers are rejected without ACK or overwrite', async () => {
  const tokenA = 'token-a-0000000000000000000000000000';
  const tokenB = 'token-b-0000000000000000000000000000';
  const db = await fakeD1([[tokenA, accountA], [tokenB, accountB]]);
  await worker.fetch(ingestRequest([event(), questionAnswer()], tokenA), { DB: db });
  const eventConflict = await worker.fetch(ingestRequest([event()], tokenB), { DB: db });
  const qaConflict = await worker.fetch(ingestRequest([questionAnswer({ revision: 3 })], tokenB), { DB: db });
  assert.equal(eventConflict.status, 409);
  assert.equal(qaConflict.status, 409);
  assert.equal(db.events.get('event-1').userId, accountA.userId);
  assert.equal(db.questionAnswers.get('qa-1').userId, accountA.userId);
});

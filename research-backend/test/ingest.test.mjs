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
  const recommendations = new Map();
  const tokens = new Map();
  for (const [token, account] of bindings) tokens.set(await hash(token), account);
  const statement = (sql, values = []) => ({
    bind(...next) { return statement(sql, next); },
    async all() {
      if (sql.includes('FROM research_installations i')) {
        const account = tokens.get(values[0]);
        return { results: account ? [{ user_id: account.userId, condition: account.condition, topic_id: account.topicId }] : [] };
      }
      if (sql.includes('COUNT(*) AS total FROM behavioral_events')) {
        return { results: [{ total: events.size }] };
      }
      if (sql.includes('COUNT(*) AS total FROM question_answer_records')) {
        return { results: [{ total: questionAnswers.size }] };
      }
      if (sql.includes('MAX(received_at) AS last_received_at')) {
        const received = [
          ...[...events.values()].map((row) => row.receivedAt),
          ...[...questionAnswers.values()].map((row) => row.receivedAt),
          ...[...recommendations.values()].map((row) => row.receivedAt),
        ].filter(Boolean).sort();
        return {
          results: [{
            last_received_at: received.at(-1) ?? null,
            recommendation_count: recommendations.size,
          }],
        };
      }
      if (sql.includes('FROM behavioral_events')) {
        const row = events.get(values[0]);
        return { results: row ? [{ user_id: row.userId }] : [] };
      }
      if (sql.includes('FROM question_answer_records')) {
        const row = questionAnswers.get(values[0]) ?? [...questionAnswers.values()].find((item) => item.questionId === values[1]);
        return { results: row ? [{ user_id: row.userId, question_id: row.questionId, revision: row.revision }] : [] };
      }
      if (sql.includes('FROM recommendations')) {
        const row = recommendations.get(values[0]);
        return { results: row ? [{ user_id: row.userId }] : [] };
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
      if (sql.includes('INSERT OR IGNORE INTO recommendations')) {
        const [id, userId, condition, topicId, sessionId, batchId, batchSeq, batchPosition,
          postId, generatedAt, strategy, score, reasonText, contributingQuestionIds,
          contributingConceptIds, contributingPostIds, componentScores, receivedAt] = values;
        if (!recommendations.has(id)) {
          recommendations.set(id, {
            id, userId, condition, topicId, sessionId, batchId, batchSeq, batchPosition,
            postId, generatedAt, strategy, score, reasonText, contributingQuestionIds,
            contributingConceptIds, contributingPostIds, componentScores, receivedAt,
          });
        }
        return { success: true };
      }
      throw new Error(`Unexpected write: ${sql}`);
    },
  });
  return {
    events, questionAnswers, recommendations,
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
const recommendation = (overrides = {}) => ({ kind: 'recommendation', id: 'recommendation-1', batchId: 'batch-1', sessionId: 'session-1', batchSeq: 1, batchPosition: 1, postId: 'post-1', generatedAt: '2026-07-11T12:00:00.000Z', strategy: 'topic_baseline', score: 0.75, reasonText: 'A control recommendation.', contributingQuestionIds: [], contributingConceptIds: [], contributingPostIds: [], ...overrides });
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

test('token-owned recommendations are idempotent, server-derived, and store control traces as empty arrays', async () => {
  const token = 'token-a-0000000000000000000000000000';
  const db = await fakeD1([[token, accountA]]);
  const first = await worker.fetch(ingestRequest([recommendation()], token), { DB: db });
  const original = structuredClone(db.recommendations.get('recommendation-1'));
  const second = await worker.fetch(ingestRequest([recommendation({ reasonText: 'A changed retry.' })], token), { DB: db });

  assert.deepEqual(await first.json(), { acknowledgedIds: ['recommendation-1'] });
  assert.deepEqual(await second.json(), { acknowledgedIds: ['recommendation-1'] });
  assert.equal(db.recommendations.size, 1);
  assert.deepEqual(db.recommendations.get('recommendation-1'), original);
  assert.deepEqual({
    userId: original.userId,
    condition: original.condition,
    topicId: original.topicId,
  }, accountA);
  assert.equal(original.contributingQuestionIds, '[]');
  assert.equal(original.contributingConceptIds, '[]');
  assert.equal(original.contributingPostIds, '[]');
});

test('cross-account recommendation identifiers return 409 without ACK or overwrite', async () => {
  const tokenA = 'token-a-0000000000000000000000000000';
  const tokenB = 'token-b-0000000000000000000000000000';
  const db = await fakeD1([[tokenA, accountA], [tokenB, accountB]]);
  await worker.fetch(ingestRequest([recommendation()], tokenA), { DB: db });
  const original = structuredClone(db.recommendations.get('recommendation-1'));

  const conflict = await worker.fetch(ingestRequest([recommendation({ reasonText: 'Overwrite attempt.' })], tokenB), { DB: db });
  const body = await conflict.json();

  assert.equal(conflict.status, 409);
  assert.deepEqual(body, { error: 'Record conflict.' });
  assert.equal(Object.hasOwn(body, 'acknowledgedIds'), false);
  assert.deepEqual(db.recommendations.get('recommendation-1'), original);
});

test('mixed event, Q/A, and recommendation records ingest in one request', async () => {
  const token = 'token-b-0000000000000000000000000000';
  const db = await fakeD1([[token, accountB]]);

  const response = await worker.fetch(
    ingestRequest([event(), questionAnswer(), recommendation({ strategy: 'continue' })], token),
    { DB: db },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    acknowledgedIds: ['event-1', 'qa-1', 'recommendation-1'],
  });
  assert.equal(db.events.size, 1);
  assert.equal(db.questionAnswers.size, 1);
  assert.equal(db.recommendations.size, 1);
});

test('admin status includes recommendation count and recommendation receipt time', async () => {
  const token = 'token-a-0000000000000000000000000000';
  const db = await fakeD1([[token, accountA]]);
  await worker.fetch(ingestRequest([event(), questionAnswer(), recommendation()], token), { DB: db });
  db.recommendations.get('recommendation-1').receivedAt = '2099-07-11T12:05:00.000Z';
  const authorization = `Basic ${Buffer.from('researcher:correct-password').toString('base64')}`;

  const response = await worker.fetch(
    new Request('https://collector.invalid/admin', { headers: { authorization } }),
    { DB: db, RESEARCH_ADMIN_PASSWORD: 'correct-password' },
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /Recommendations<\/dt>\s*<dd>1<\/dd>/);
  assert.match(html, /2099-07-11T12:05:00.000Z/);
});

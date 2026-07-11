import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../src/worker.ts';

function fakeD1(accounts) {
  const events = new Map();
  const questionAnswers = new Map();

  return {
    events,
    questionAnswers,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async all() {
              if (!sql.includes('FROM study_accounts')) throw new Error('Unexpected all() query.');
              const account = accounts.get(values[0]);
              return {
                results: account
                  ? [{ condition: account.condition, topic_id: account.topicId }]
                  : [],
              };
            },
            async run() {
              if (sql.includes('INSERT OR IGNORE INTO behavioral_events')) {
                const [id, userId, condition, topicId, timestamp, eventType, postId,
                  questionId, recommendationId, durationMs, receivedAt] = values;
                if (!events.has(id)) {
                  events.set(id, { id, userId, condition, topicId, timestamp, eventType, postId,
                    questionId, recommendationId, durationMs, receivedAt });
                }
                return { success: true };
              }

              if (sql.includes('INSERT INTO question_answer_records')) {
                const [id, revision, userId, condition, topicId, postId, questionId, questionText,
                  questionSource, submittedAt, answerText, answerViewedAt, receivedAt] = values;
                const existing = questionAnswers.get(id);
                if (!existing || revision > existing.revision) {
                  questionAnswers.set(id, { id, revision, userId, condition, topicId, postId, questionId,
                    questionText, questionSource, submittedAt, answerText, answerViewedAt, receivedAt });
                }
                return { success: true };
              }

              throw new Error('Unexpected D1 write.');
            },
          };
        },
      };
    },
    async batch(statements) {
      return Promise.all(statements.map((statement) => statement.run()));
    },
  };
}

function ingestRequest(records) {
  return new Request('https://collector.invalid/v1/ingest', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ records }),
  });
}

function event(overrides = {}) {
  return {
    id: 'event-1',
    timestamp: '2026-07-11T12:00:00.000Z',
    eventType: 'post_open',
    postId: 'post-1',
    ...overrides,
  };
}

function questionAnswer(overrides = {}) {
  return {
    id: 'qa-1',
    revision: 2,
    postId: 'post-1',
    questionId: 'question-1',
    questionText: 'How does this work?',
    questionSource: 'typed',
    submittedAt: '2026-07-11T12:00:00.000Z',
    answerText: 'A newer answer.',
    ...overrides,
  };
}

test('ingest requires a bearer install token before database work', async () => {
  const db = fakeD1(new Map());
  const response = await worker.fetch(ingestRequest([event()]), { DB: db });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Unauthorized.' });
  assert.equal(db.events.size, 0);
});

test('re-ingesting an immutable event stores it once and acknowledges both deliveries', async () => {
  const db = fakeD1(new Map([['1001', { condition: 'control', topicId: 'server-topic' }]]));

  const first = await worker.fetch(ingestRequest([event()]), { DB: db });
  const second = await worker.fetch(ingestRequest([event()]), { DB: db });

  assert.deepEqual(await first.json(), { acknowledgedIds: ['event-1'] });
  assert.deepEqual(await second.json(), { acknowledgedIds: ['event-1'] });
  assert.equal(db.events.size, 1);
});

test('a stale question/answer revision is acknowledged but cannot overwrite a newer answer', async () => {
  const db = fakeD1(new Map([['1001', { condition: 'experimental', topicId: 'server-topic' }]]));

  const current = await worker.fetch(ingestRequest([questionAnswer({ revision: 2 })]), { DB: db });
  const stale = await worker.fetch(ingestRequest([questionAnswer({ revision: 1, answerText: 'Old answer.' })]), { DB: db });

  assert.deepEqual(await current.json(), { acknowledgedIds: ['qa-1'] });
  assert.deepEqual(await stale.json(), { acknowledgedIds: ['qa-1'] });
  assert.equal(db.questionAnswers.get('qa-1').revision, 2);
  assert.equal(db.questionAnswers.get('qa-1').answerText, 'A newer answer.');
});

test('the ingest worker replaces client condition and topic with the server account mapping', async () => {
  const db = fakeD1(new Map([['1001', { condition: 'control', topicId: 'server-topic' }]]));

  const response = await worker.fetch(ingestRequest([event()]), { DB: db });

  assert.equal(response.status, 200);
  assert.equal(db.events.get('event-1').condition, 'control');
  assert.equal(db.events.get('event-1').topicId, 'server-topic');
});

test('a batch containing an unknown account is rejected before any records are stored', async () => {
  const db = fakeD1(new Map([['1001', { condition: 'control', topicId: 'server-topic' }]]));

  const response = await worker.fetch(ingestRequest([
    event({ id: 'known-event' }),
    event({ id: 'unknown-event', userId: '9999' }),
  ]), { DB: db });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Unknown account.' });
  assert.equal(db.events.size, 0);
});

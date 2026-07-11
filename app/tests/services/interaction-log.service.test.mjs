import assert from 'node:assert/strict';
import test from 'node:test';

const store = new Map();
globalThis.localStorage = {
  get length() { return store.size; },
  key(index) { return Array.from(store.keys())[index] ?? null; },
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  setItem(key, value) { store.set(key, String(value)); },
  removeItem(key) { store.delete(key); },
  clear() { store.clear(); },
};

const { dbExecute, dbQuery } = await import('../../src/services/db.service.ts');
const { studyContextService } = await import('../../src/services/study-context.service.ts');
const { createInteractionLog } = await import('../../src/services/interaction-log.service.ts');

const identity = {
  userId: '1042',
  condition: 'experimental',
  topicId: 'topic-opaque-1',
  boundAt: '2026-07-11T00:00:00.000Z',
};

await dbExecute('DELETE FROM research_metadata');
await studyContextService.hydrate();
await studyContextService.bindOnce(identity, 'test-install-token-00000000000000000001');

let idSequence = 0;
function makeHarness() {
  const enqueued = [];
  const logger = createInteractionLog({
    enqueue: async (record) => { enqueued.push(structuredClone(record)); },
    now: () => '2026-07-11T12:00:00.000Z',
    createId: () => `generated-${++idSequence}`,
  });
  return { enqueued, logger };
}

async function resetRecords() {
  await dbExecute('DELETE FROM research_records');
  await dbExecute('DELETE FROM research_upload_queue');
}

async function recordRows() {
  return dbQuery('SELECT * FROM research_records');
}

function setConsent(aiConsentGiven) {
  localStorage.setItem('questiontrace_settings', JSON.stringify({
    preferences: {
      theme: 'system', locale: 'en', language: 'en',
      onboardingCompleted: true, aiConsentGiven,
    },
  }));
}

test('bound but unconsented installations cannot persist or enqueue research records', async () => {
  await resetRecords();
  setConsent(false);
  const { enqueued, logger } = makeHarness();

  await logger.record('app_open');
  await logger.record('post_open', { postId: 'post-before-consent' });

  assert.equal((await dbQuery('SELECT * FROM research_records')).length, 0);
  assert.equal((await dbQuery('SELECT * FROM research_upload_queue')).length, 0);
  assert.equal(enqueued.length, 0);
  setConsent(true);
});

test('record snapshots immutable study identity rather than accepting caller identity', async () => {
  await resetRecords();
  const { enqueued, logger } = makeHarness();

  const event = await logger.record('post_open', { postId: 'post-1' });

  assert.deepEqual(
    { userId: event.userId, condition: event.condition, topicId: event.topicId },
    { userId: '1042', condition: 'experimental', topicId: 'topic-opaque-1' },
  );
  const rows = await recordRows();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'event');
  assert.equal(rows[0].revision, 1);
  assert.deepEqual(JSON.parse(rows[0].data), event);
  assert.deepEqual(enqueued, [event]);

  await assert.rejects(
    () => logger.record('post_open', { postId: 'post-2', condition: 'control' }),
    /disallowed field: condition/i,
  );
  assert.equal((await recordRows()).length, 1);
});

test('accepts exactly the 16 event types with their event-specific optional fields', async () => {
  await resetRecords();
  const { enqueued, logger } = makeHarness();
  const cases = [
    ['app_open', {}],
    ['feed_impression', {}],
    ['post_open', { postId: 'post-1' }],
    ['post_close', { postId: 'post-1', durationMs: 1250 }],
    ['source_click', { postId: 'post-1' }],
    ['video_play', { postId: 'post-1' }],
    ['video_progress', { postId: 'post-1', durationMs: 5000 }],
    ['question_suggestion_click', { postId: 'post-1', questionId: 'question-1' }],
    ['question_submit', { postId: 'post-1', questionId: 'question-2' }],
    ['ai_answer_view', { postId: 'post-1', questionId: 'question-2' }],
    ['save_post', { postId: 'post-1' }],
    ['not_interested', { postId: 'post-1' }],
    ['recommendation_reason_view', { postId: 'post-1', recommendationId: 'recommendation-1' }],
    ['notification_received', { postId: 'post-1', recommendationId: 'recommendation-1' }],
    ['notification_open', { postId: 'post-1', recommendationId: 'recommendation-1' }],
    ['session_end', { durationMs: 60_000 }],
  ];

  for (const [eventType, fields] of cases) {
    await logger.record(eventType, fields);
  }

  const rows = await recordRows();
  assert.equal(rows.length, 16);
  assert.equal(enqueued.length, 16);
  assert.deepEqual(new Set(rows.map((row) => JSON.parse(row.data).eventType)), new Set(cases.map(([type]) => type)));
  assert.equal(rows.some((row) => JSON.parse(row.data).eventType === 'time_on_post'), false);

  await assert.rejects(() => logger.record('time_on_post', { durationMs: 1 }), /event type is not allowed/i);
  await assert.rejects(() => logger.record('unknown_event', {}), /event type is not allowed/i);
  await assert.rejects(
    () => logger.record('app_open', { postId: 'post-not-permitted-for-app-open' }),
    /disallowed field: postId/i,
  );
  assert.equal((await recordRows()).length, 16);
});

test('rejects prohibited and arbitrary context before any persistence or enqueue', async () => {
  for (const prohibited of [
    { sourceUrl: 'https://example.invalid/private' },
    { feedPosition: 3 },
    { route: '/post/post-1' },
    { device: { model: 'private' } },
    { payload: { pageContext: { sourceUrl: 'https://example.invalid/buried' } } },
    { keystrokeTiming: [10, 20] },
  ]) {
    await resetRecords();
    const { enqueued, logger } = makeHarness();
    await assert.rejects(
      () => logger.record('post_open', { postId: 'post-1', ...prohibited }),
      /disallowed field/i,
    );
    assert.equal((await recordRows()).length, 0);
    assert.equal(enqueued.length, 0);
  }
});

test('validates allowed field values before persistence', async () => {
  await resetRecords();
  const { enqueued, logger } = makeHarness();

  await assert.rejects(() => logger.record('post_open', { postId: '' }), /postId/i);
  await assert.rejects(() => logger.record('post_close', { postId: 'post-1', durationMs: -1 }), /durationMs/i);
  await assert.rejects(() => logger.record('post_close', { postId: 'post-1', durationMs: 1.5 }), /durationMs/i);
  assert.equal((await recordRows()).length, 0);
  assert.equal(enqueued.length, 0);
});

test('stores question and answer text only in a revisioned Q/A record', async () => {
  await resetRecords();
  const { enqueued, logger } = makeHarness();

  const submitted = await logger.recordQuestionSubmit({
    postId: 'post-1',
    questionId: 'question-1',
    questionText: 'Why does this happen?',
    questionSource: 'typed',
  });
  assert.equal(submitted.revision, 1);
  assert.equal(submitted.questionText, 'Why does this happen?');

  let rows = await recordRows();
  assert.equal(rows.length, 2);
  const submittedQaRow = rows.find((row) => row.kind === 'qa');
  const submitEvent = JSON.parse(rows.find((row) => row.kind === 'event').data);
  assert.equal(submittedQaRow.revision, 1);
  assert.deepEqual(JSON.parse(submittedQaRow.data), submitted);
  assert.equal(submitEvent.eventType, 'question_submit');
  assert.equal(submitEvent.questionId, 'question-1');
  assert.equal(Object.hasOwn(submitEvent, 'questionText'), false);
  assert.equal(enqueued.length, 2);

  const answered = await logger.recordAnswerViewed({
    questionId: 'question-1',
    answerText: 'Because the mechanism is deterministic.',
  });
  assert.equal(answered.id, submitted.id);
  assert.equal(answered.revision, 2);
  assert.equal(answered.answerText, 'Because the mechanism is deterministic.');
  assert.equal(answered.answerViewedAt, '2026-07-11T12:00:00.000Z');

  rows = await recordRows();
  assert.equal(rows.length, 3);
  const answeredQaRow = rows.find((row) => row.kind === 'qa');
  assert.equal(answeredQaRow.revision, 2);
  assert.deepEqual(JSON.parse(answeredQaRow.data), answered);
  const events = rows.filter((row) => row.kind === 'event').map((row) => JSON.parse(row.data));
  assert.deepEqual(new Set(events.map((event) => event.eventType)), new Set(['question_submit', 'ai_answer_view']));
  assert.ok(events.every((event) => !Object.hasOwn(event, 'questionText') && !Object.hasOwn(event, 'answerText')));
  assert.equal(enqueued.length, 4);
  assert.deepEqual(enqueued.map((record) => 'revision' in record ? `qa-${record.revision}` : record.eventType), [
    'qa-1', 'question_submit', 'qa-2', 'ai_answer_view',
  ]);
});

test('suggested questions emit only the suggestion click event and reject extra Q/A context', async () => {
  await resetRecords();
  const { enqueued, logger } = makeHarness();

  await logger.recordQuestionSubmit({
    postId: 'post-2',
    questionId: 'question-suggested',
    questionText: 'A curated suggested question?',
    questionSource: 'suggested_question',
  });
  const event = enqueued.find((record) => 'eventType' in record);
  assert.equal(event.eventType, 'question_suggestion_click');

  const before = (await recordRows()).length;
  await assert.rejects(
    () => logger.recordQuestionSubmit({
      postId: 'post-3',
      questionId: 'question-private',
      questionText: 'Question?',
      questionSource: 'typed',
      sourceUrl: 'https://example.invalid/private',
    }),
    /disallowed field: sourceUrl/i,
  );
  assert.equal((await recordRows()).length, before);
});

test('answer attachment fails closed when no submitted Q/A record exists', async () => {
  await resetRecords();
  const { enqueued, logger } = makeHarness();

  await assert.rejects(
    () => logger.recordAnswerViewed({ questionId: 'missing-question', answerText: 'Orphan answer' }),
    /submitted question.*not found/i,
  );
  assert.equal((await recordRows()).length, 0);
  assert.equal(enqueued.length, 0);
});

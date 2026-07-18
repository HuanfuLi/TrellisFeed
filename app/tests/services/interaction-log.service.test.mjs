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
const { toResearchWireRecord } = await import('../../src/services/research-wire-contract.ts');

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

test('a record persisted before enqueue failure is recovered by outbox reconciliation', async () => {
  await resetRecords();
  setConsent(true);
  const logger = createInteractionLog({
    enqueue: async () => { throw new Error('injected enqueue crash'); },
    now: () => '2026-07-11T12:00:00.000Z',
    createId: () => 'reconcile-after-enqueue-crash',
  });

  await assert.rejects(() => logger.record('post_open', { postId: 'post-crash' }), /injected enqueue crash/);
  assert.equal((await dbQuery('SELECT * FROM research_records')).length, 1);
  assert.equal((await dbQuery('SELECT * FROM research_upload_queue')).length, 0);

  const { reconcileResearchOutbox } = await import('../../src/services/upload-queue.service.ts');
  await reconcileResearchOutbox();
  const queued = await dbQuery('SELECT * FROM research_upload_queue');
  assert.equal(queued.length, 1);
  assert.equal(JSON.parse(queued[0].data).record.id, 'reconcile-after-enqueue-crash');
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

test('projects canonical question and answer only after local canonical persistence', async () => {
  await resetRecords();
  const { enqueued, logger } = makeHarness();
  await dbExecute('INSERT OR REPLACE INTO user_questions (id, user_id, post_id, created_at, data) VALUES (?, ?, ?, ?, ?)', ['question-1', '1042', 'post-1', '2026-07-11T11:59:00.000Z', '{}']);
  await dbExecute('INSERT OR REPLACE INTO ai_answers (id, user_question_id, post_id, created_at, data) VALUES (?, ?, ?, ?, ?)', ['answer-1', 'question-1', 'post-1', '2026-07-11T12:00:00.000Z', '{}']);
  const projected = await logger.recordQuestionSubmit({
    question: {
      id: 'question-1', userId: '1042', condition: 'experimental', topicId: 'topic-opaque-1', postId: 'post-1',
      text: 'Why does this happen?', source: 'suggested_question', suggestedQuestionId: 'suggestion-1',
      createdAt: '2026-07-11T11:59:00.000Z', extractedConceptIds: ['concept-1'], extractedClaimIds: ['claim-1'], aiAnswerId: 'answer-1',
    },
    answer: {
      id: 'answer-1', userQuestionId: 'question-1', postId: 'post-1', answerText: 'Because the mechanism is deterministic.',
      citedPostIds: ['post-1'], citedSourceUrls: ['https://example.test'], conceptIds: ['concept-1'], claimIds: ['claim-1'],
      createdAt: '2026-07-11T12:00:00.000Z', modelName: 'fake-main',
    },
  });
  assert.equal(projected.revision, 1);
  assert.equal(projected.answerId, 'answer-1');
  assert.equal(projected.suggestedQuestionId, 'suggestion-1');

  await logger.recordAnswerViewed({ postId: 'post-1', questionId: 'question-1' });
  const rows = await recordRows();
  const qaRow = rows.find((row) => row.kind === 'qa');
  assert.deepEqual(JSON.parse(qaRow.data), projected);
  const events = rows.filter((row) => row.kind === 'event').map((row) => JSON.parse(row.data));
  assert.deepEqual(events.map((event) => event.eventType), ['question_submit', 'ai_answer_view']);
  assert.ok(events.every((event) => !Object.hasOwn(event, 'questionText') && !Object.hasOwn(event, 'answerText')));
  assert.deepEqual(enqueued.map((record) => 'revision' in record ? 'qa' : record.eventType), ['qa', 'question_submit', 'ai_answer_view']);
});

test('canonical projection rejects identity conflicts and arbitrary extra context', async () => {
  await resetRecords();
  const { logger } = makeHarness();
  const canonical = {
    question: { id: 'q', userId: 'wrong', condition: 'control', topicId: 'wrong', postId: 'p', text: 'Q?', source: 'typed', createdAt: '2026-07-11T00:00:00.000Z', extractedConceptIds: [], aiAnswerId: 'a' },
    answer: { id: 'a', userQuestionId: 'q', postId: 'p', answerText: 'A.', citedPostIds: ['p'], conceptIds: [], createdAt: '2026-07-11T00:00:01.000Z', modelName: 'm' },
  };
  await assert.rejects(
    () => logger.recordQuestionSubmit(canonical),
    /identity does not match/i,
  );
  await assert.rejects(
    () => logger.recordQuestionSubmit({ ...canonical, payload: { secret: true } }),
    /disallowed field: payload/i,
  );
  assert.equal((await recordRows()).length, 0);
});

test('extraction re-projection persists revision 2 with the exact RQ-02 wire fields', async () => {
  await resetRecords();
  setConsent(true);
  const { logger } = makeHarness();
  const answer = {
    id: 'answer-rq2', userQuestionId: 'question-rq2', postId: 'post-rq2', answerText: 'Bounded answer.',
    citedPostIds: ['post-rq2'], conceptIds: ['answer-concept'], createdAt: '2026-07-11T12:00:00.000Z',
    modelName: 'fake-main',
  };
  const initialQuestion = {
    id: 'question-rq2', userId: '1042', condition: 'experimental', topicId: 'topic-opaque-1', postId: 'post-rq2',
    text: 'What evidence supports this?', source: 'typed', createdAt: '2026-07-11T11:59:00.000Z',
    extractedConceptIds: [], aiAnswerId: 'answer-rq2',
  };
  await dbExecute(
    'INSERT OR REPLACE INTO user_questions (id, user_id, post_id, created_at, data) VALUES (?, ?, ?, ?, ?)',
    [initialQuestion.id, initialQuestion.userId, initialQuestion.postId, initialQuestion.createdAt, JSON.stringify(initialQuestion)],
  );
  await dbExecute(
    'INSERT OR REPLACE INTO ai_answers (id, user_question_id, post_id, created_at, data) VALUES (?, ?, ?, ?, ?)',
    [answer.id, answer.userQuestionId, answer.postId, answer.createdAt, JSON.stringify(answer)],
  );

  const first = await logger.recordQuestionSubmit({ question: initialQuestion, answer });
  assert.equal(first.revision, 1);

  const extractedQuestion = {
    ...initialQuestion,
    extractedConceptIds: ['concept-alpha'],
    extractedClaimIds: ['claim-main'],
    questionType: 'evidence',
    unresolved: true,
  };
  await dbExecute(
    'INSERT OR REPLACE INTO user_questions (id, user_id, post_id, created_at, data) VALUES (?, ?, ?, ?, ?)',
    [extractedQuestion.id, extractedQuestion.userId, extractedQuestion.postId, extractedQuestion.createdAt, JSON.stringify(extractedQuestion)],
  );
  const revised = await logger.recordQuestionAnswer({ question: extractedQuestion, answer });

  assert.equal(revised.revision, 2);
  assert.deepEqual(
    {
      extractedConceptIds: revised.extractedConceptIds,
      extractedClaimIds: revised.extractedClaimIds,
      questionType: revised.questionType,
      unresolved: revised.unresolved,
    },
    {
      extractedConceptIds: ['concept-alpha'],
      extractedClaimIds: ['claim-main'],
      questionType: 'evidence',
      unresolved: true,
    },
  );
  assert.doesNotThrow(() => toResearchWireRecord(revised));
  const rows = await dbQuery('SELECT * FROM research_records WHERE id = ?', ['qa:question-rq2']);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].revision, 2);
  assert.deepEqual(JSON.parse(rows[0].data), revised);
});

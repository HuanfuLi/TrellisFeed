import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';

function makeLocalStorage() {
  return {
    _store: new Map(),
    getItem(key) { return this._store.get(key) ?? null; },
    setItem(key, value) { this._store.set(key, String(value)); },
    removeItem(key) { this._store.delete(key); },
    clear() { this._store.clear(); },
  };
}

globalThis.localStorage = makeLocalStorage();
globalThis.indexedDB = fakeIndexedDB;

const db = await import('../../src/services/db.service.ts?post-qa-indexeddb');
const qa = await import('../../src/services/post-qa.service.ts');

const question = {
  id: 'question-1', userId: 'user-1', condition: 'control', topicId: 'topic-1', postId: 'post-1',
  text: 'What evidence does the post give?', source: 'typed', createdAt: '2026-07-11T12:00:00.000Z',
  extractedConceptIds: ['concept-1'], extractedClaimIds: ['claim-1'], aiAnswerId: 'answer-1',
};
const answer = {
  id: 'answer-1', userQuestionId: 'question-1', postId: 'post-1', answerText: 'It cites a controlled comparison.',
  citedPostIds: ['post-1'], citedSourceUrls: ['https://example.test/source'], conceptIds: ['concept-1'],
  claimIds: ['claim-1'], createdAt: '2026-07-11T12:00:01.000Z', modelName: 'fake-model',
};

beforeEach(async () => {
  await db.clearAllTables();
});

test('canonical persistence survives hydrate through the dbQuery seam', async () => {
  const repository = new qa.PostQaRepository({ execute: db.dbExecute, query: db.dbQuery });
  await repository.persistCompletedAnswer(question, answer);

  assert.deepEqual(JSON.parse((await db.dbQuery('SELECT * FROM user_questions'))[0].data), question);
  assert.deepEqual(JSON.parse((await db.dbQuery('SELECT * FROM ai_answers'))[0].data), answer);

  const restarted = new qa.PostQaRepository({ execute: db.dbExecute, query: db.dbQuery });
  await restarted.hydratePostQa();
  assert.deepEqual(await restarted.loadSamePostThread('user-1', 'post-1'), [{ question, answer }]);
});

test('thread hydration rejects cross-user, cross-post, dangling, and partial rows', async () => {
  const repository = new qa.PostQaRepository({ execute: db.dbExecute, query: db.dbQuery });
  await repository.persistCompletedAnswer(question, answer);
  await repository.persistCompletedAnswer(
    { ...question, id: 'question-other-user', userId: 'user-2', aiAnswerId: 'answer-other-user' },
    { ...answer, id: 'answer-other-user', userQuestionId: 'question-other-user' },
  );
  await repository.persistCompletedAnswer(
    { ...question, id: 'question-other-post', postId: 'post-2', aiAnswerId: 'answer-other-post' },
    { ...answer, id: 'answer-other-post', userQuestionId: 'question-other-post', postId: 'post-2', citedPostIds: ['post-2'] },
  );
  await db.dbExecute('INSERT OR REPLACE INTO user_questions (id, user_id, post_id, created_at, data) VALUES (?, ?, ?, ?, ?)', [
    'question-dangling', 'user-1', 'post-1', '2026-07-11T12:00:02.000Z', JSON.stringify({ ...question, id: 'question-dangling', aiAnswerId: 'missing' }),
  ]);
  await db.dbExecute('INSERT OR REPLACE INTO ai_answers (id, user_question_id, post_id, created_at, data) VALUES (?, ?, ?, ?, ?)', [
    'answer-mismatch', 'question-1', 'post-2', '2026-07-11T12:00:03.000Z', JSON.stringify({ ...answer, id: 'answer-mismatch', postId: 'post-2' }),
  ]);

  const thread = await repository.loadSamePostThread('user-1', 'post-1');
  assert.deepEqual(thread.map((turn) => turn.question.id), ['question-1']);
});

test('canonical Q&A tables exist, clear on reset, and work in fallback mode', async () => {
  await db.getDB();
  const request = fakeIndexedDB.open('questiontrace');
  const indexed = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  assert.equal(indexed.objectStoreNames.contains('user_questions'), true);
  assert.equal(indexed.objectStoreNames.contains('ai_answers'), true);
  indexed.close();

  const repository = new qa.PostQaRepository({ execute: db.dbExecute, query: db.dbQuery });
  await repository.persistCompletedAnswer(question, answer);
  await db.clearAllTables();
  assert.equal((await db.dbQuery('SELECT * FROM user_questions')).length, 0);
  assert.equal((await db.dbQuery('SELECT * FROM ai_answers')).length, 0);

  const savedIndexedDB = globalThis.indexedDB;
  delete globalThis.indexedDB;
  globalThis.localStorage = makeLocalStorage();
  try {
    const fallback = await import('../../src/services/db.service.ts?post-qa-fallback');
    const fallbackRepository = new qa.PostQaRepository({ execute: fallback.dbExecute, query: fallback.dbQuery });
    await fallbackRepository.persistCompletedAnswer(question, answer);
    assert.equal((await fallback.dbQuery('SELECT * FROM user_questions WHERE user_id = ?', ['user-1'])).length, 1);
    assert.equal((await fallback.dbQuery('SELECT * FROM ai_answers WHERE post_id = ?', ['post-1'])).length, 1);
  } finally {
    globalThis.indexedDB = savedIndexedDB;
  }
});

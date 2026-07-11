import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const forbiddenFields = new Set([
  'sourceUrl', 'route', 'device', 'position', 'feedPosition', 'payload', 'keystrokeTiming',
]);

const event = (id, sessionId, timestamp, eventType, fields = {}) => ({
  id,
  sessionId,
  userId: '1001',
  condition: 'control',
  topicId: 'fixture-topic',
  timestamp,
  eventType,
  ...fields,
});

const timeline = [
  event('e1', 's1', '2026-07-01T10:00:00.000Z', 'app_open'),
  event('e2', 's1', '2026-07-01T10:00:05.000Z', 'feed_impression'),
  event('e3', 's1', '2026-07-01T10:01:00.000Z', 'post_open', { postId: 'p1' }),
  event('e4', 's1', '2026-07-01T10:03:00.000Z', 'post_close', { postId: 'p1', durationMs: 120_000 }),
  event('e5', 's1', '2026-07-01T10:03:05.000Z', 'question_suggestion_click', { postId: 'p1', questionId: 'q1' }),
  {
    id: 'qa1',
    revision: 1,
    userId: '1001',
    condition: 'control',
    topicId: 'fixture-topic',
    postId: 'p1',
    questionId: 'q1',
    questionText: 'Why?',
    questionSource: 'suggested_question',
    submittedAt: '2026-07-01T10:03:05.000Z',
  },
  event('e6', 's1', '2026-07-01T10:04:00.000Z', 'notification_received', { recommendationId: 'r1' }),
  event('e7', 's1', '2026-07-01T10:04:10.000Z', 'notification_open', { recommendationId: 'r1' }),
  event('e8', 's1', '2026-07-01T10:05:00.000Z', 'session_end', { durationMs: 300_000 }),
  event('e9', 's2', '2026-07-03T11:00:00.000Z', 'app_open'),
  event('e10', 's2', '2026-07-03T11:01:00.000Z', 'post_open', { postId: 'p1' }),
  event('e11', 's2', '2026-07-03T11:02:00.000Z', 'post_open', { postId: 'p2' }),
  event('e12', 's2', '2026-07-03T11:03:00.000Z', 'question_submit', { postId: 'p2', questionId: 'q2' }),
  {
    id: 'qa2',
    revision: 1,
    userId: '1001',
    condition: 'control',
    topicId: 'fixture-topic',
    postId: 'p2',
    questionId: 'q2',
    questionText: 'How?',
    questionSource: 'typed',
    submittedAt: '2026-07-03T11:03:00.000Z',
  },
  event('e13', 's2', '2026-07-03T11:04:00.000Z', 'notification_received', { recommendationId: 'r2' }),
  event('e14', 's2', '2026-07-03T11:05:00.000Z', 'session_end', { durationMs: 300_000 }),
];

const events = timeline.filter((record) => 'eventType' in record);
const qaRecords = timeline.filter((record) => 'revision' in record);

function deriveRq1Measures(records, questionAnswers) {
  const appOpens = records.filter((record) => record.eventType === 'app_open');
  const postOpens = records.filter((record) => record.eventType === 'post_open');
  const firstSessionByPost = new Map();
  let voluntaryRevisits = 0;
  for (const open of postOpens) {
    const firstSession = firstSessionByPost.get(open.postId);
    if (firstSession && firstSession !== open.sessionId) voluntaryRevisits += 1;
    else if (!firstSession) firstSessionByPost.set(open.postId, open.sessionId);
  }
  const received = records.filter((record) => record.eventType === 'notification_received').length;
  const opened = records.filter((record) => record.eventType === 'notification_open').length;

  return {
    sessions: appOpens.length,
    returnDays: new Set(appOpens.map((record) => record.timestamp.slice(0, 10))).size - 1,
    sessionLengthMs: records
      .filter((record) => record.eventType === 'session_end')
      .map((record) => record.durationMs),
    postsOpened: postOpens.length,
    timeOnPostMs: records
      .filter((record) => record.eventType === 'post_close')
      .reduce((sum, record) => sum + record.durationMs, 0),
    questionsAsked: questionAnswers.filter((record) => record.revision === 1).length,
    suggestionClicks: records.filter((record) => record.eventType === 'question_suggestion_click').length,
    notificationOpenRate: received === 0 ? null : opened / received,
    voluntaryRevisits,
  };
}

test('fixture timeline derives every RQ-01 re-engagement measure', () => {
  assert.deepEqual(deriveRq1Measures(events, qaRecords), {
    sessions: 2,
    returnDays: 1,
    sessionLengthMs: [300_000, 300_000],
    postsOpened: 3,
    timeOnPostMs: 120_000,
    questionsAsked: 2,
    suggestionClicks: 1,
    notificationOpenRate: 0.5,
    voluntaryRevisits: 1,
  });
});

test('fixture uses only the research allowlist and never requires prohibited context', () => {
  for (const record of timeline) {
    for (const field of forbiddenFields) assert.equal(Object.hasOwn(record, field), false, field);
  }
});

test('live participant call sites are connected to the privacy-bounded logger', () => {
  const app = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
  const home = readFileSync(new URL('../../src/screens/HomeScreen.tsx', import.meta.url), 'utf8');
  const detail = readFileSync(new URL('../../src/screens/PostDetailScreen.tsx', import.meta.url), 'utf8');
  const engagement = readFileSync(new URL('../../src/services/engagement.service.ts', import.meta.url), 'utf8');

  for (const eventType of ['app_open', 'session_end']) assert.match(app, new RegExp(`['"]${eventType}['"]`));
  assert.match(home, /['"]feed_impression['"]/);
  for (const eventType of ['post_open', 'post_close', 'source_click']) {
    assert.match(detail, new RegExp(`['"]${eventType}['"]`));
  }
  assert.match(detail, /recordQuestionSubmit/);
  assert.match(detail, /recordAnswerViewed/);
  assert.match(engagement, /['"]save_post['"]/);
  assert.match(home, /['"]not_interested['"]/);
  assert.doesNotMatch(`${app}\n${home}\n${detail}\n${engagement}`, /interactionLog\.record\([^\n]*(sourceUrl|route|device|position|payload|keystroke)/);
});

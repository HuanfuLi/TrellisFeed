import assert from 'node:assert/strict';
import test from 'node:test';

import { strFromU8, unzipSync } from 'fflate';

import { buildExportZip, escapeCsvCell, toCsv } from '../src/export.ts';
import worker from '../src/worker.ts';

const RECOMMENDATION_COLUMNS = [
  'id', 'user_id', 'condition', 'topic_id', 'session_id', 'batch_id', 'batch_seq',
  'batch_position', 'post_id', 'generated_at', 'served_at', 'strategy', 'score',
  'reason_text', 'contributing_question_ids', 'contributing_concept_ids',
  'contributing_post_ids', 'component_scores', 'received_at',
];
const PARTICIPANT_COLUMNS = [
  'user_id', 'condition', 'topic_id', 'enrolled_at', 'first_activity_at',
  'last_activity_at', 'last_received_at',
];

test('escapeCsvCell neutralizes formula-leading values', () => {
  for (const formula of ['=cmd()', '+SUM(A1:A2)', '-1+2', '@SUM(A1:A2)']) {
    assert.equal(escapeCsvCell(formula), `'${formula}`);
  }
});

test('escapeCsvCell neutralizes whitespace and control-prefixed formulas without trimming', () => {
  for (const formula of [' =cmd()', '\t+SUM(A1:A2)', '\r-1+2', '\n@SUM(A1:A2)', ' \t\r\n=1+1']) {
    const escaped = escapeCsvCell(formula);
    assert.equal(escaped.startsWith(formula.includes('\r') || formula.includes('\n') ? '"\'' : "'"), true);
    assert.equal(escaped.includes(formula.replaceAll('"', '""')), true);
  }
});

test('toCsv quotes comma, quote, and newline values', () => {
  const csv = toCsv(
    [{ text: 'first, "quoted"\nsecond' }],
    ['text'],
  );

  assert.equal(csv, 'text\r\n"first, ""quoted""\nsecond"\r\n');
});

const recommendationRow = {
  id: 'recommendation-1',
  user_id: '0012',
  condition: 'control',
  topic_id: 'topic-a',
  session_id: 'session-1',
  batch_id: 'batch-1',
  batch_seq: 1,
  batch_position: 1,
  post_id: 'post-1',
  generated_at: '2026-07-11T12:00:00.000Z',
  served_at: null,
  strategy: 'topic_baseline',
  score: 0.75,
  reason_text: '=HYPERLINK("https://attacker.invalid")',
  contributing_question_ids: '[]',
  contributing_concept_ids: '[]',
  contributing_post_ids: '[]',
  component_scores: null,
  received_at: '2026-07-11T12:00:01.000Z',
};

test('buildExportZip produces exactly four aggregate CSV files with closed headers and escaped values', () => {
  const bytes = buildExportZip(
    [{
      id: 'event-1',
      user_id: '1001',
      condition: 'control',
      topic_id: 'topic-a',
      timestamp: '2026-07-11T12:00:00.000Z',
      event_type: 'post_open',
      post_id: 'post-1',
      question_id: null,
      recommendation_id: null,
      duration_ms: null,
      received_at: '2026-07-11T12:00:01.000Z',
    }],
    [{
      id: 'qa-1',
      revision: 1,
      user_id: '1001',
      condition: 'control',
      topic_id: 'topic-a',
      post_id: 'post-1',
      question_id: 'question-1',
      answer_id: 'answer-1',
      question_text: 'How does this work?',
      question_source: 'typed',
      suggested_question_id: null,
      question_created_at: '2026-07-11T12:00:00.000Z',
      answer_text: 'Like this.',
      answer_created_at: '2026-07-11T12:00:01.000Z',
      model_name: 'fake-main',
      cited_post_ids: '["post-1"]',
      cited_source_urls: '[]',
      concept_ids: '[]',
      claim_ids: '[]',
      extracted_concept_ids: '["concept-1"]',
      extracted_claim_ids: '["claim-1"]',
      question_type: 'evidence',
      unresolved: 1,
      received_at: '2026-07-11T12:00:01.000Z',
    }],
    [recommendationRow],
    [{
      user_id: '0012',
      condition: 'control',
      topic_id: 'topic-a',
      enrolled_at: '2026-07-10T09:00:00.000Z',
      first_activity_at: '2026-07-11T12:00:00.000Z',
      last_activity_at: '2026-07-11T12:00:00.000Z',
      last_received_at: '2026-07-11T12:00:01.000Z',
    }],
  );
  const files = unzipSync(bytes);

  assert.deepEqual(Object.keys(files).sort(), [
    'behavioral-events.csv',
    'participants.csv',
    'question-answer-records.csv',
    'recommendations.csv',
  ]);
  assert.match(strFromU8(files['behavioral-events.csv']), /^id,user_id,condition,topic_id,timestamp,event_type,post_id,question_id,recommendation_id,duration_ms,received_at\r?\n/);
  assert.match(strFromU8(files['question-answer-records.csv']), /^id,revision,user_id,condition,topic_id,post_id,question_id,answer_id,question_text,question_source,suggested_question_id,question_created_at,answer_text,answer_created_at,model_name,cited_post_ids,cited_source_urls,concept_ids,claim_ids,extracted_concept_ids,extracted_claim_ids,question_type,unresolved,received_at\r?\n/);
  const recommendations = strFromU8(files['recommendations.csv']);
  const participants = strFromU8(files['participants.csv']);
  assert.equal(recommendations.split(/\r?\n/)[0], RECOMMENDATION_COLUMNS.join(','));
  assert.equal(participants.split(/\r?\n/)[0], PARTICIPANT_COLUMNS.join(','));
  assert.equal(
    recommendations.includes(",\"'=HYPERLINK(\"\"https://attacker.invalid\"\")\",[],[],[],,"),
    true,
  );
  assert.match(participants, /^0012,control,topic-a,/m);
});

function basicAuth(password) {
  return `Basic ${Buffer.from(`researcher:${password}`).toString('base64')}`;
}

function fakeExportD1() {
  const accounts = [
    { user_id: '0007', condition: 'experimental', topic_id: 'topic-b' },
    { user_id: '0012', condition: 'control', topic_id: 'topic-a' },
  ];
  const installations = [
    { user_id: '0012', created_at: '2026-07-10T10:00:00.000Z' },
    { user_id: '0012', created_at: '2026-07-10T09:00:00.000Z' },
  ];
  const events = [
    { id: 'event-1', user_id: '0012', condition: 'control', topic_id: 'topic-a', timestamp: '2026-07-11T12:03:00.000Z', event_type: 'feed_impression', post_id: 'post-1', question_id: null, recommendation_id: 'recommendation-1', duration_ms: null, received_at: '2026-07-11T12:03:01.000Z' },
    { id: 'event-2', user_id: '0012', condition: 'control', topic_id: 'topic-a', timestamp: '2026-07-11T12:01:00.000Z', event_type: 'feed_impression', post_id: 'post-1', question_id: null, recommendation_id: 'recommendation-1', duration_ms: null, received_at: '2026-07-11T12:04:01.000Z' },
    { id: 'event-3', user_id: '0012', condition: 'control', topic_id: 'topic-a', timestamp: '2026-07-11T12:05:00.000Z', event_type: 'post_close', post_id: 'post-1', question_id: null, recommendation_id: null, duration_ms: 120000, received_at: '2026-07-11T12:06:00.000Z' },
  ];
  const recommendations = [
    { ...recommendationRow, served_at: undefined },
    { ...recommendationRow, id: 'recommendation-never-seen', batch_position: 2, post_id: 'post-2', reason_text: 'Never impressed.', served_at: undefined },
  ];
  const queries = [];

  return {
    queries,
    prepare(sql) {
      queries.push(sql);
      return {
        async all() {
          if (sql.includes('FROM recommendations r')) {
            return {
              results: recommendations.map((row) => {
                const servedAt = events
                  .filter((event) => event.event_type === 'feed_impression' && event.recommendation_id === row.id)
                  .map((event) => event.timestamp)
                  .sort()[0] ?? null;
                return { ...row, served_at: servedAt };
              }),
            };
          }
          if (sql.includes('FROM study_accounts a')) {
            return {
              results: accounts.map((account) => {
                const accountInstalls = installations.filter((row) => row.user_id === account.user_id);
                const accountEvents = events.filter((row) => row.user_id === account.user_id);
                const timestamps = accountEvents.map((row) => row.timestamp).sort();
                const received = accountEvents.map((row) => row.received_at).sort();
                return {
                  ...account,
                  enrolled_at: accountInstalls.map((row) => row.created_at).sort()[0] ?? null,
                  first_activity_at: timestamps[0] ?? null,
                  last_activity_at: timestamps.at(-1) ?? null,
                  last_received_at: received.at(-1) ?? null,
                };
              }),
            };
          }
          if (sql.includes('FROM behavioral_events')) return { results: events };
          if (sql.includes('FROM question_answer_records')) return { results: [] };
          throw new Error(`Unexpected export query: ${sql}`);
        },
      };
    },
  };
}

test('admin export derives first impression and one participant row per seeded account', async () => {
  const db = fakeExportD1();
  const response = await worker.fetch(new Request('https://collector.invalid/admin/export.zip', {
    headers: { authorization: basicAuth('correct-password') },
  }), { DB: db, RESEARCH_ADMIN_PASSWORD: 'correct-password' });
  const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
  const recommendations = strFromU8(files['recommendations.csv']);
  const participants = strFromU8(files['participants.csv']);

  assert.equal(response.status, 200);
  assert.match(recommendations, /^recommendation-1,0012,control,topic-a,session-1,batch-1,1,1,post-1,2026-07-11T12:00:00.000Z,2026-07-11T12:01:00.000Z,/m);
  assert.match(recommendations, /^recommendation-never-seen,0012,control,topic-a,session-1,batch-1,1,2,post-2,2026-07-11T12:00:00.000Z,,/m);
  assert.equal(
    recommendations.includes(",topic_baseline,0.75,\"'=HYPERLINK(\"\"https://attacker.invalid\"\")\",[],[],[],,"),
    true,
  );
  assert.match(participants, /^0007,experimental,topic-b,,,,\r?$/m);
  assert.match(participants, /^0012,control,topic-a,2026-07-10T09:00:00.000Z,2026-07-11T12:01:00.000Z,2026-07-11T12:05:00.000Z,2026-07-11T12:06:00.000Z\r?$/m);
  assert.equal(participants.match(/^0012,/gm)?.length, 1);

  const servedQuery = db.queries.find((sql) => sql.includes('FROM recommendations r')) ?? '';
  const participantsQuery = db.queries.find((sql) => sql.includes('FROM study_accounts a')) ?? '';
  assert.match(servedQuery, /MIN\(timestamp\) AS served_at/);
  assert.match(servedQuery, /GROUP BY recommendation_id/);
  assert.match(participantsQuery, /MIN\(created_at\) AS enrolled_at[\s\S]*GROUP BY user_id/);
  assert.match(participantsQuery, /MIN\(timestamp\) AS first_activity_at[\s\S]*MAX\(received_at\) AS last_received_at[\s\S]*GROUP BY user_id/);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { strFromU8, unzipSync } from 'fflate';

import { buildExportZip, escapeCsvCell, toCsv } from '../src/export.ts';

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

test('buildExportZip produces exactly the two aggregate CSV files', () => {
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
      received_at: '2026-07-11T12:00:01.000Z',
    }],
  );
  const files = unzipSync(bytes);

  assert.deepEqual(Object.keys(files).sort(), [
    'behavioral-events.csv',
    'question-answer-records.csv',
  ]);
  assert.match(strFromU8(files['behavioral-events.csv']), /^id,user_id,condition,topic_id,timestamp,event_type,post_id,question_id,recommendation_id,duration_ms,received_at\r?\n/);
  assert.match(strFromU8(files['question-answer-records.csv']), /^id,revision,user_id,condition,topic_id,post_id,question_id,answer_id,question_text,question_source,suggested_question_id,question_created_at,answer_text,answer_created_at,model_name,cited_post_ids,cited_source_urls,concept_ids,claim_ids,received_at\r?\n/);
});

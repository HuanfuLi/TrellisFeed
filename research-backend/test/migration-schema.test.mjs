import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('../migrations/0004_recommendations.sql', import.meta.url);
const contractUrl = new URL('../../shared/research-wire-contract.v1.json', import.meta.url);

const expectedColumns = [
  'id',
  'user_id',
  'condition',
  'topic_id',
  'session_id',
  'batch_id',
  'batch_seq',
  'batch_position',
  'post_id',
  'generated_at',
  'strategy',
  'score',
  'reason_text',
  'contributing_question_ids',
  'contributing_concept_ids',
  'contributing_post_ids',
  'component_scores',
  'received_at',
];

const expectedStrategies = [
  'topic_baseline',
  'quality_baseline',
  'diversity_baseline',
  'continue',
  'deepen',
  'contrast',
  'bridge',
  'echo',
];

async function loadSchema() {
  return readFile(migrationUrl, 'utf8');
}

test('recommendations migration defines the exact analysis schema and ordering index', async () => {
  const schema = await loadSchema();
  const tableMatch = schema.match(/CREATE TABLE IF NOT EXISTS recommendations\s*\(([\s\S]*?)\);/i);

  assert.ok(tableMatch, 'recommendations table is missing');
  const tableBody = tableMatch[1];

  for (const column of expectedColumns) {
    assert.match(tableBody, new RegExp(`^\\s*${column}\\s+`, 'm'), `missing ${column} column`);
  }

  const declaredColumns = [...tableBody.matchAll(/^\s*([a-z_]+)\s+(?:TEXT|INTEGER|REAL)\b/gm)]
    .map((match) => match[1]);
  assert.deepEqual(declaredColumns, expectedColumns);
  assert.match(tableBody, /^\s*id\s+TEXT\s+PRIMARY KEY\s*,?$/mi);
  assert.match(tableBody, /condition\s+TEXT\s+NOT NULL\s+CHECK\s*\(condition IN\s*\('control',\s*'experimental'\)\)/i);
  assert.match(tableBody, /batch_seq\s+INTEGER\s+NOT NULL\s+CHECK\s*\(batch_seq\s*>\s*0\)/i);
  assert.match(tableBody, /batch_position\s+INTEGER\s+NOT NULL\s+CHECK\s*\(batch_position\s*>\s*0\)/i);
  assert.match(
    schema,
    /CREATE INDEX IF NOT EXISTS recommendations_session_order\s+ON recommendations\s*\(user_id,\s*session_id,\s*batch_seq,\s*batch_position\)/i,
  );

  const timestampColumns = declaredColumns.filter((column) => column.endsWith('_at'));
  assert.deepEqual(timestampColumns, ['generated_at', 'received_at']);
  assert.doesNotMatch(schema, /served_at|serving_(?:time|timestamp)|served_(?:time|timestamp)/i);
});

test('recommendation strategies stay identical across migration and shared contract', async () => {
  const [schema, contractText] = await Promise.all([
    loadSchema(),
    readFile(contractUrl, 'utf8'),
  ]);
  const strategyCheck = schema.match(/CHECK\s*\(strategy IN\s*\(([^)]*)\)\)/i);

  assert.ok(strategyCheck, 'strategy CHECK is missing');
  const migrationStrategies = [...strategyCheck[1].matchAll(/'([^']+)'/g)]
    .map((match) => match[1]);
  const contract = JSON.parse(contractText);

  assert.deepEqual(migrationStrategies, expectedStrategies);
  assert.deepEqual(contract.recommendation.strategies, expectedStrategies);
  assert.deepEqual(contract.recommendation.strategies, migrationStrategies);
});

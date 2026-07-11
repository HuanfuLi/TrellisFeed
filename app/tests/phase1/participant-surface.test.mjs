import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '../..');
const sourceRoot = resolve(appRoot, 'src');

const readSource = (...segments) => readFileSync(resolve(sourceRoot, ...segments), 'utf8');
const withoutComments = (source) => source
  .split('\n')
  .filter((line) => !/^\s*(?:\/\/|\*)/.test(line))
  .join('\n');

test('retired participant settings sub-screens stay absent', () => {
  for (const file of [
    'SettingsAIScreen.tsx',
    'SettingsContentScreen.tsx',
    'SettingsFeaturesScreen.tsx',
    'SettingsDataScreen.tsx',
  ]) {
    assert.equal(existsSync(resolve(sourceRoot, 'screens/settings', file)), false, `${file} must remain deleted`);
  }
});

test('participant settings exposes only numeric account identity and language', () => {
  const source = withoutComments(readSource('screens', 'SettingsScreen.tsx'));

  assert.match(source, /studyContextService\.getRequired\(\)\.userId/);
  assert.match(source, /settings\.fields\.accountId/);
  assert.match(source, /settings\.fields\.language/);
  assert.match(source, /<option value="en">English<\/option>/);
  assert.match(source, /<option value="zh">简体中文<\/option>/);
  assert.match(source, /<option value="es">Español<\/option>/);
  assert.match(source, /<option value="ja">日本語<\/option>/);

  for (const forbidden of [
    'useNavigate', 'MenuRow', 'theme', 'handleReset', 'settings.menu.',
    '/settings/ai', '/settings/content', '/settings/features', '/settings/data',
    'viewLicenses', 'reset',
  ]) {
    assert.equal(source.includes(forbidden), false, `participant settings must not expose ${forbidden}`);
  }
});

test('participant onboarding never asks for a provider or credential', () => {
  const source = withoutComments(readSource('screens', 'OnboardingScreen.tsx'));

  for (const forbidden of [
    "'llm'", 'LLMConfig', 'apiKey', 'setProvider', 'onboarding.llm.',
    'apiKeyLabel', 'providerLabel',
  ]) {
    assert.equal(source.includes(forbidden), false, `participant onboarding must not expose ${forbidden}`);
  }
});

test('research diagnostics is PIN-gated and non-destructive', () => {
  const source = withoutComments(readSource('screens', 'ResearchDiagnosticsScreen.tsx'));

  assert.match(source, /crypto\.subtle\.digest\(['"]SHA-256['"]/);
  assert.match(source, /researchConfig\.pinSha256/);
  assert.match(source, /getPendingCount/);
  assert.match(source, /getLastSuccessfulUploadAt/);
  assert.match(source, /UPLOAD_STATUS_CHANGED/);
  assert.match(source, /exportLocalRecoveryBlob/);

  for (const forbidden of [
    'clearAllTables', 'settingsService.reset', 'bindOnce', 'account edit',
    'condition edit', 'API key', 'apiKey', 'VITE_',
  ]) {
    assert.equal(source.includes(forbidden), false, `diagnostics must not expose ${forbidden}`);
  }
});

test('local recovery export contains only durable records for the bound participant', async () => {
  const store = new Map();
  globalThis.localStorage = {
    get length() { return store.size; },
    key(index) { return Array.from(store.keys())[index] ?? null; },
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
    clear() { store.clear(); },
  };

  const { dbExecute } = await import('../../src/services/db.service.ts');
  const { studyContextService } = await import('../../src/services/study-context.service.ts');
  const { exportLocalRecoveryBlob } = await import('../../src/services/research-export.service.ts');

  await dbExecute('DELETE FROM research_metadata');
  await dbExecute('DELETE FROM research_records');
  await dbExecute('DELETE FROM research_upload_quarantine');
  await studyContextService.hydrate();
  await studyContextService.bindOnce({
    userId: '0017',
    condition: 'control',
    topicId: 'topic-1',
    boundAt: '2026-07-11T00:00:00.000Z',
  }, 'test-install-token-00000000000000000017');

  const ownRecord = { id: 'event-own', userId: '0017', eventType: 'app_open' };
  const otherRecord = { id: 'event-other', userId: '0024', eventType: 'app_open' };
  await dbExecute(
    'INSERT OR REPLACE INTO research_records (id, kind, revision, data) VALUES (?, ?, ?, ?)',
    [ownRecord.id, 'event', 1, JSON.stringify(ownRecord)],
  );
  await dbExecute(
    'INSERT OR REPLACE INTO research_records (id, kind, revision, data) VALUES (?, ?, ?, ?)',
    [otherRecord.id, 'event', 1, JSON.stringify(otherRecord)],
  );
  await dbExecute(
    'INSERT OR REPLACE INTO research_upload_quarantine (id, data) VALUES (?, ?)',
    ['event-own', JSON.stringify({
      id: 'event-own',
      reason: 'invalid_record',
      quarantinedAt: '2026-07-11T00:00:00.000Z',
      envelope: { id: 'event-own', record: ownRecord },
    })],
  );

  const blob = await exportLocalRecoveryBlob();
  const payload = JSON.parse(await blob.text());
  assert.equal(payload.userId, '0017');
  assert.deepEqual(payload.records, [ownRecord]);
  assert.equal(payload.format, 'questiontrace-local-recovery-v2');
  assert.equal(payload.quarantine.length, 1);
  assert.equal(payload.quarantine[0].reason, 'invalid_record');
  assert.equal(JSON.stringify(payload).includes('test-install-token'), false);
  assert.equal(JSON.stringify(payload).includes('0024'), false);
});

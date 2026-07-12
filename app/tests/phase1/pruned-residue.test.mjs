import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '../..');
const srcRoot = resolve(appRoot, 'src');

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return ['.ts', '.tsx', '.css', '.json'].includes(extname(entry.name)) ? [path] : [];
  });
}

function nonCommentSource(path) {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:\/\/|\/\*|\*)/.test(line))
    .join('\n');
}

test('pruned reorganization, gamification, locale, and style residue stays out of app/src', () => {
  const forbidden = [
    'reorganizeMindmap',
    'revertReorganization',
    'isReorgInProgress',
    'hasReorgBackup',
    'REORG_SNAPSHOT_KEY',
    'REORG_STARTED',
    'REORG_COMPLETED',
    'REORG_FAILED',
    'ReorganizationResult',
    'creditAwarded',
    'reorganizeButton',
    'reorganizingButton',
    'reorganizeModal',
    'reorgInProgress',
    'reorgPaused',
    'trellisDevMode',
    '--news-card-',
    '--trellis-empty-bg',
  ];

  for (const path of sourceFiles(srcRoot)) {
    const source = nonCommentSource(path);
    for (const token of forbidden) {
      assert.equal(source.includes(token), false, `${token} must not appear in ${path}`);
    }
  }
});

test('load-bearing graph, question input, and exploration infrastructure survives the sweep', () => {
  const types = readFileSync(resolve(srcRoot, 'types/index.ts'), 'utf8');
  const canonical = readFileSync(resolve(srcRoot, 'services/canonical-knowledge.service.ts'), 'utf8');
  const chatInput = readFileSync(resolve(srcRoot, 'components/ChatInput.tsx'), 'utf8');
  const dailyRead = readFileSync(resolve(srcRoot, 'services/daily-read.service.ts'), 'utf8');

  assert.match(types, /GRAPH_UPDATED/);
  assert.match(canonical, /commitClassificationResult/);
  assert.match(canonical, /classifyAndAnchorIncremental/);
  assert.match(chatInput, /export function ChatInput/);
  assert.match(dailyRead, /exploredAnchors/);
});

test('stale profiler and unreferenced mock-loader family stay deleted', () => {
  const deletedPaths = [
    'src/lib/cold-start-profiler.ts',
    'scripts/profile-trellis.mjs',
    'tests/reorg-json-parser.test.mjs',
    'tests/services/_actions-mock-db.mjs',
    'tests/services/_actions-mock-embedding.mjs',
    'tests/services/_actions-mock-hooks.mjs',
    'tests/services/_actions-mock-llm.mjs',
    'tests/services/_actions-mock-loader.mjs',
    'tests/services/_actions-mock-podcast.mjs',
    'tests/services/_actions-mock-qfilter.mjs',
    'tests/services/_actions-mock-question.mjs',
    'tests/services/_actions-mock-settings.mjs',
    'tests/services/_actions-mock-tts.mjs',
    'tests/services/_trellis-mock-canonical.mjs',
    'tests/services/_trellis-mock-hooks.mjs',
    'tests/services/_trellis-mock-loader.mjs',
  ];

  for (const relativePath of deletedPaths) {
    assert.equal(existsSync(resolve(appRoot, relativePath)), false, `${relativePath} must stay deleted`);
  }

  const liveFilterMock = readFileSync(resolve(appRoot, 'tests/services/_filter-mock-embedding.mjs'), 'utf8');
  assert.doesNotMatch(liveFilterMock, /_actions-mock-embedding/);
});

test('retired participant settings and feedback locale families stay deleted', () => {
  for (const locale of ['en', 'zh', 'es', 'ja']) {
    const bundle = JSON.parse(readFileSync(resolve(srcRoot, `locales/${locale}.json`), 'utf8'));
    assert.deepEqual(
      Object.keys(bundle.settings).sort(),
      ['fields', 'title'],
      `${locale} settings locale must expose only the retained participant account/language surface`,
    );
    assert.deepEqual(Object.keys(bundle.settings.fields).sort(), ['accountId', 'language']);
    assert.equal(bundle.home.feed.feedbackPrompt, undefined);
  }
});

test('retired voice and notification capabilities stay absent from native shells', () => {
  const manifest = readFileSync(resolve(appRoot, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  const mainActivity = readFileSync(
    resolve(appRoot, 'android/app/src/main/java/com/trellis/app/MainActivity.java'),
    'utf8',
  );
  const podfileLock = readFileSync(resolve(appRoot, 'ios/App/Podfile.lock'), 'utf8');

  assert.doesNotMatch(manifest, /RECORD_AUDIO|POST_NOTIFICATIONS|SCHEDULE_EXACT_ALARM/);
  assert.doesNotMatch(mainActivity, /MIC_PERMISSION_REQUEST|RECORD_AUDIO|requestPermissions/);
  assert.doesNotMatch(podfileLock, /CapacitorDevice|CapacitorLocalNotifications|CapacitorVoiceRecorder/);

  for (const locale of ['en', 'zh', 'es', 'ja']) {
    const bundle = JSON.parse(readFileSync(resolve(srcRoot, `locales/${locale}.json`), 'utf8'));
    assert.equal(bundle.common.toast.micPermissionDenied, undefined);
    assert.equal(bundle.common.toast.micInUse, undefined);
    assert.equal(bundle.common.toast.micUnsupported, undefined);
    assert.equal(bundle.common.toast.micGenericError, undefined);
  }
});

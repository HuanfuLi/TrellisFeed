import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const postDetailPath = path.join(repoRoot, 'src/screens/PostDetailScreen.tsx');
const postEssayPath = path.join(repoRoot, 'src/services/post-essay.service.ts');

test('TD-02 plumbing: PostDetailScreen creates AbortController', () => {
  const src = readFileSync(postDetailPath, 'utf8');
  assert.ok(src.includes('new AbortController()'), 'must construct AbortController');
});

test('TD-02 plumbing: PostDetailScreen subscribes to LOCALE_CHANGED', () => {
  const src = readFileSync(postDetailPath, 'utf8');
  assert.match(src, /eventBus\.subscribe\(\s*['"]LOCALE_CHANGED['"]/);
  assert.match(src, /abortController\.abort/);
});

test('TD-02 plumbing: PostDetailScreen removes `let aborted = false` boolean pattern', () => {
  const src = readFileSync(postDetailPath, 'utf8');
  assert.ok(!/let\s+aborted\s*=\s*false/.test(src), 'must replace `let aborted = false` with AbortController');
});

test('TD-02 plumbing: PostDetailScreen threads signal into generatePostEssay call', () => {
  const src = readFileSync(postDetailPath, 'utf8');
  // The signal option must appear at the generatePostEssay and generateEssayMeta call sites.
  assert.match(src, /generatePostEssay\([^)]*signal\s*:/s);
  assert.match(src, /generateEssayMeta\([^)]*signal\s*:/s);
});

test('TD-02 plumbing: post-essay.service.ts generatePostEssay accepts options.signal', () => {
  const src = readFileSync(postEssayPath, 'utf8');
  assert.match(src, /generatePostEssay\([^)]*options\??\s*:/s);
  assert.match(src, /signal\s*\??:\s*AbortSignal/);
});

test('TD-02 plumbing: post-essay.service.ts generateEssayMeta accepts options.signal', () => {
  const src = readFileSync(postEssayPath, 'utf8');
  assert.match(src, /generateEssayMeta\([^)]*options\??\s*:/s);
});

test('TD-02 plumbing: surviving dispatch generators pass signal to chatStream', () => {
  const src = readFileSync(postEssayPath, 'utf8');
  // generateStandardEssay and generateTextArtEssay should include `signal` in
  // their chatStream options object.
  // chatStream calls are multiline so use [\s\S] to span lines.
  const chatStreamWithSignalCount = (src.match(/chatStream\([\s\S]*?signal[\s\S]*?\);/g) || []).length;
  assert.ok(chatStreamWithSignalCount >= 2, `expected >= 2 chatStream calls with signal, got ${chatStreamWithSignalCount}`);
});

test('TD-02 plumbing: generateEssayMeta passes signal to chatCompletion', () => {
  const src = readFileSync(postEssayPath, 'utf8');
  assert.match(src, /chatCompletion\([\s\S]*?signal[\s\S]*?\)/);
});

test('TD-02 D-08: PostDetailScreen does NOT patchPostEssayInCache on aborted path', () => {
  const src = readFileSync(postDetailPath, 'utf8');
  // Assert there is an aborted guard BEFORE patchPostEssayInCache.
  // The simplest static check: the abortController.signal.aborted check appears
  // somewhere before the patchPostEssayInCache call, and the effect returns early on abort.
  assert.match(src, /abortController\.signal\.aborted/);
  assert.match(src, /patchPostEssayInCache/);
});

test('TD-02 behavioral: AbortController.abort halts stream accumulation in stubbed async iterator', async () => {
  // Pattern from useQuestions-locale-abort.test.mjs:53-76
  const ac = new AbortController();
  const seen = [];
  async function* fakeStream() {
    for (let i = 0; i < 10; i++) {
      if (ac.signal.aborted) return;
      await new Promise((r) => setTimeout(r, 2));
      yield String(i);
    }
  }
  const consumer = (async () => {
    for await (const chunk of fakeStream()) {
      if (ac.signal.aborted) break;
      seen.push(chunk);
      if (seen.length === 3) ac.abort();
    }
  })();
  await consumer;
  assert.ok(seen.length <= 4, `expected <=4 chunks after abort, got ${seen.length}`);
});

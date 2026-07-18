import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const repoRoot = resolve(appRoot, '..');
const poolRoot = join(repoRoot, 'data', 'content_pool_v1');
const runtimeFiles = [
  'manifest.json',
  'topics.json',
  'posts.json',
  'concepts.json',
  'claims.json',
  'suggested_questions.json',
  'source_assets.json',
];
const retiredSourceFiles = [
  'src/components/InfoFlow.tsx',
  'src/components/SuggestionCard.tsx',
  'src/services/concept-feed.service.ts',
  'src/services/post-queue.service.ts',
  'src/services/infiniteScroll.service.ts',
  'src/services/style-assignment.ts',
  'src/services/feed-spread.ts',
  'src/services/session.service.ts',
  'src/services/post-context-qa.service.ts',
];

function walk(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

test('deterministic package command binds the immutable pilot pool', () => {
  const pkg = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['package:content-pool'], 'node scripts/package-content-pool.mjs');
  assert.match(pkg.scripts.prebuild, /package:content-pool/);

  const result = spawnSync(process.execPath, ['scripts/package-content-pool.mjs', '--check'], {
    cwd: appRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /pilot-v1-20260717/);

  const index = readFileSync(join(appRoot, 'src/generated/content-pool-v1/index.ts'), 'utf8');
  assert.match(index, /pilot-v1-20260717/);
  for (const filename of runtimeFiles) assert.match(index, new RegExp(filename.replace('.', '\\.')));
});

test('generated-feed shell is absent and participant content has no acquisition path', () => {
  for (const filename of retiredSourceFiles) {
    assert.equal(existsSync(join(appRoot, filename)), false, `${filename} must be retired`);
  }

  const sourceFiles = walk(join(appRoot, 'src')).filter((path) => /\.(?:ts|tsx)$/.test(path));
  const joined = sourceFiles.map((path) => readFileSync(path, 'utf8')).join('\n');
  assert.doesNotMatch(joined, /tools[\\/]content_pipeline/);
  assert.doesNotMatch(joined, /\b(?:DailyPost|PostSnapshot|FEED_REFILL_COMPLETED|generateMorePosts|generatePostEssay)\b/);

  const contentBoundary = [
    'src/data/content-pool-bundle.ts',
    'src/services/content-pool.repository.ts',
    'src/services/frozen-feed.service.ts',
    'src/components/FeedCard.tsx',
    'src/components/OriginalContent.tsx',
    'src/screens/HomeScreen.tsx',
    'src/screens/PostDetailScreen.tsx',
  ].map((filename) => readFileSync(join(appRoot, filename), 'utf8')).join('\n');
  assert.doesNotMatch(contentBoundary, /\bfetch\s*\(|XMLHttpRequest|EventSource|WebSocket/);
  assert.doesNotMatch(contentBoundary, /thumbnailUrl\s*\?\?|live article|content endpoint/i);
});

test('production and native web assets contain only the verified runtime projection', { timeout: 240_000 }, () => {
  const build = spawnSync('npm.cmd', ['run', 'build'], { cwd: appRoot, encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr || build.stdout);
  const sync = spawnSync('npx.cmd', ['cap', 'sync'], { cwd: appRoot, encoding: 'utf8' });
  assert.equal(sync.status, 0, sync.stderr || sync.stdout);

  const roots = [
    join(appRoot, 'dist', 'content-pool-v1'),
    join(appRoot, 'android', 'app', 'src', 'main', 'assets', 'public', 'content-pool-v1'),
    join(appRoot, 'ios', 'App', 'App', 'public', 'content-pool-v1'),
  ];
  for (const root of roots) {
    assert.deepEqual(walk(root).map((path) => relative(root, path).replaceAll('\\', '/')).sort(), [...runtimeFiles].sort());
    for (const filename of runtimeFiles) {
      assert.equal(sha256(readFileSync(join(root, filename))), sha256(readFileSync(join(poolRoot, filename))), `${root}/${filename}`);
    }
  }

  const forbiddenPath = /(?:^|\/)(?:\.env(?:\.|$)|runs?|review_logs?|source_files?|content_pipeline|credentials?)(?:\/|$)/i;
  const secret = /(?:AIza[0-9A-Za-z_-]{30,}|sk-[0-9A-Za-z_-]{20,})/;
  for (const root of [join(appRoot, 'dist'), join(appRoot, 'android', 'app', 'src', 'main', 'assets', 'public'), join(appRoot, 'ios', 'App', 'App', 'public')]) {
    for (const path of walk(root)) {
      const rel = relative(root, path).replaceAll('\\', '/');
      assert.doesNotMatch(rel, forbiddenPath);
      const bytes = readFileSync(path);
      if (bytes.includes(0)) continue;
      assert.doesNotMatch(bytes.toString('utf8'), secret, `secret-like value in ${rel}`);
    }
  }
});

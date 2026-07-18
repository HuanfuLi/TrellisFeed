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

test('D-01 through D-12 and all Phase 2 requirements have shipped artifact evidence', () => {
  const manifest = JSON.parse(readFileSync(join(poolRoot, 'manifest.json'), 'utf8'));
  const topics = JSON.parse(readFileSync(join(poolRoot, 'topics.json'), 'utf8'));
  const posts = JSON.parse(readFileSync(join(poolRoot, 'posts.json'), 'utf8'));
  const assets = JSON.parse(readFileSync(join(poolRoot, 'source_assets.json'), 'utf8'));
  const index = readFileSync(join(appRoot, 'src/generated/content-pool-v1/index.ts'), 'utf8');

  // D-01–D-04: pilot topic, real-source mix, evergreen freeze, and the
  // operator-authorized 82-candidate/77-approved calibration are explicit.
  assert.deepEqual(topics.map((topic) => topic.id), ['ai-agents-future-work']);
  assert.equal(posts.some((post) => post.sourcePlatform === 'youtube'), true);
  assert.equal(posts.some((post) => post.sourcePlatform !== 'youtube'), true);
  assert.equal(posts.every((post) => post.status === 'frozen'), true);
  assert.deepEqual([manifest.rawCandidateCount, manifest.approvedCount], [82, 77]);

  // D-05–D-08: every canonical post has an embedded reviewed original; text is
  // complete stored body, video is fixed URL/ID + digest only, and the exact
  // pool version is compiled and copied into install-time assets.
  assert.equal(assets.length, posts.length);
  assert.equal(assets.filter((asset) => asset.kind === 'article').every((asset) => asset.body?.length >= 150), true);
  assert.equal(assets.filter((asset) => asset.kind === 'video').every((asset) => asset.videoId && asset.digest && !('body' in asset)), true);
  assert.equal(assets.every((asset) => !('transcript' in asset) && !('audio' in asset)), true);
  assert.match(index, /pilot-v1-20260717/);

  // D-09–D-12: immutable collector/preprocessor provenance and both review
  // gates are auditable, while the local review implementation stays outside
  // the participant bundle.
  assert.equal(manifest.collectorVersions.length > 0, true);
  assert.equal(manifest.preprocessingModelVersions.some((value) => value.includes('gemini-3.1-flash-lite')), true);
  assert.match(manifest.reviewProcedureSummary, /Codex advisory.*operator decision/i);
  assert.equal(existsSync(join(repoRoot, 'tools/content_pipeline/src/review/ui/review.ts')), true);

  // CONT-01/02/03, FEED-01/02, and ASK-01 plus the UI/AI contracts retain
  // executable/source artifacts at the final release boundary.
  for (const filename of [
    'src/domain/content.types.ts',
    'src/services/frozen-feed.service.ts',
    'src/components/FeedCard.tsx',
    'src/components/OriginalContent.tsx',
    'src/components/SuggestedQuestionList.tsx',
    'src/services/post-qa.service.ts',
  ]) assert.equal(existsSync(join(appRoot, filename)), true, filename);
  assert.match(readFileSync(join(repoRoot, '.planning/phases/02-content-pool-feed-post-ui-on-frozen-data/02-UI-SPEC.md'), 'utf8'), /frozen/i);
  assert.match(readFileSync(join(repoRoot, '.planning/phases/02-content-pool-feed-post-ui-on-frozen-data/02-AI-SPEC.md'), 'utf8'), /condition-neutral/i);
});

test('production and native web assets contain only the verified runtime projection', { timeout: 240_000 }, () => {
  const build = spawnSync('npm', ['run', 'build'], { cwd: appRoot, encoding: 'utf8', shell: true });
  assert.equal(build.status, 0, build.stderr || build.stdout);
  const sync = spawnSync('npx', ['cap', 'sync'], { cwd: appRoot, encoding: 'utf8', shell: true });
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
  const secret = /(?:AIza[0-9A-Za-z_-]{30,}|sk-proj-[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z]{20,})/;
  for (const root of [join(appRoot, 'dist'), join(appRoot, 'android', 'app', 'src', 'main', 'assets', 'public'), join(appRoot, 'ios', 'App', 'App', 'public')]) {
    for (const path of walk(root)) {
      const rel = relative(root, path).replaceAll('\\', '/');
      assert.doesNotMatch(rel, forbiddenPath);
      const bytes = readFileSync(path);
      if (bytes.includes(0)) continue;
      assert.equal(secret.test(bytes.toString('utf8')), false, `secret-like value in ${rel}`);
    }
  }
});

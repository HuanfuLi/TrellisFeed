import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { collectSeeds, dispatchCli, normalizeRunDirectory, parseCollectArgs, parseNormalizeArgs, resolveOutputPath } from '../src/cli.ts';
import { fetchCandidate } from '../src/collect/fetch-candidate.ts';
import { assertPublicHttpUrl } from '../src/collect/url-policy.ts';
import { extractArticle } from '../src/extract/article.ts';
import { extractYouTubeTranscript, parseYouTubeVideoId } from '../src/extract/youtube.ts';
import { normalizeCandidate } from '../src/normalize/candidate.ts';

const publicDns = async () => ['93.184.216.34'];
const privateDns = async () => ['10.0.0.9'];

test('URL policy rejects local, alternate numeric, credential, and non-HTTP destinations', async () => {
  for (const url of [
    'http://127.0.0.1/a', 'http://127.1/a', 'http://2130706433/a',
    'http://0x7f000001/a', 'http://[::1]/a', 'http://[fe80::1]/a', 'http://[::ffff:7f00:1]/a',
    'http://user:pass@example.com/a', 'file:///etc/passwd',
  ]) await assert.rejects(() => assertPublicHttpUrl(url, publicDns), /public HTTP|credentials|non-public/);
  await assert.rejects(() => assertPublicHttpUrl('https://private.test', privateDns), /non-public/);
});

test('collector revalidates redirects and fails closed on private targets', async () => {
  let calls = 0;
  const transport = async (url) => {
    calls += 1;
    return url.hostname === 'public.test'
      ? { status: 302, headers: { location: 'http://private.test/secret' }, body: '' }
      : { status: 200, headers: { 'content-type': 'text/html' }, body: '<p>secret</p>' };
  };
  const lookup = async (host) => host === 'private.test' ? ['192.168.1.4'] : ['93.184.216.34'];
  await assert.rejects(() => fetchCandidate('https://public.test/a', { transport, lookup }), /non-public/);
  assert.equal(calls, 1);
});

test('collector enforces MIME, byte, and timeout bounds without live network', async () => {
  const base = { lookup: publicDns };
  await assert.rejects(() => fetchCandidate('https://example.com/a', {
    ...base, maxBytes: 3,
    transport: async () => ({ status: 200, headers: { 'content-type': 'text/html' }, body: 'large' }),
  }), /maximum byte/);
  await assert.rejects(() => fetchCandidate('https://example.com/a', {
    ...base,
    transport: async () => ({ status: 200, headers: { 'content-type': 'application/octet-stream' }, body: 'x' }),
  }), /MIME/);
  await assert.rejects(() => fetchCandidate('https://example.com/a', {
    ...base, timeoutMs: 5,
    transport: async () => new Promise(() => {}),
  }), /timed out/);
});

test('public fixture collection records bounded metadata and redacts query secrets', async () => {
  const logs = [];
  const result = await fetchCandidate('https://example.com/a?token=super-secret&view=1', {
    lookup: publicDns,
    logger: (line) => logs.push(line),
    now: () => new Date('2026-07-11T00:00:00.000Z'),
    transport: async () => ({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body: '<p>safe</p>' }),
  });
  assert.equal(result.status, 'collected');
  assert.equal(result.rawBody, '<p>safe</p>');
  assert.match(result.sourceHash, /^[a-f0-9]{64}$/);
  assert.equal(logs.join(' ').includes('super-secret'), false);
  assert.equal(logs.join(' ').includes('<p>safe</p>'), false);
});

test('CLI constrains output paths and dry-run performs no network or process calls', async () => {
  const runDir = await mkdtemp(join(tmpdir(), 'qt-collect-'));
  const seeds = join(runDir, 'seeds.json');
  await writeFile(seeds, JSON.stringify([
    { url: 'https://youtube.com/watch?v=dQw4w9WgXcQ', evergreen: true },
    { url: 'https://example.com/article', publicationDate: '2025-01-01' },
  ]));
  assert.throws(() => resolveOutputPath(runDir, '../escape.json'), /outside run directory/);
  let fetchCalls = 0;
  const report = await collectSeeds(parseCollectArgs(['collect', '--seeds', seeds, '--run-dir', runDir, '--dry-run']), {
    fetchCandidate: async () => { fetchCalls += 1; throw new Error('must not run'); },
  });
  assert.equal(fetchCalls, 0);
  assert.deepEqual(report.mix, { text: 1, video: 1, textRatio: 0.5, videoRatio: 0.5 });
  assert.equal(report.topic, 'ai-agents-future-work');
});

test('pilot stays capped at 150 while an explicit later topic accepts 800 in stable order', async () => {
  const runDir = await mkdtemp(join(tmpdir(), 'qt-collect-scale-'));
  const seeds = join(runDir, 'seeds.json');
  const records = Array.from({ length: 800 }, (_, i) => ({ url: `https://example.com/${String(799 - i).padStart(3, '0')}` }));
  await writeFile(seeds, JSON.stringify(records));
  await assert.rejects(() => collectSeeds(parseCollectArgs(['collect', '--seeds', seeds, '--run-dir', runDir, '--max-candidates', '800', '--dry-run'])), /pilot profile.*150/);
  const report = await collectSeeds(parseCollectArgs(['collect', '--topic', 'later-topic', '--seeds', seeds, '--run-dir', runDir, '--max-candidates', '800', '--dry-run']));
  assert.equal(report.candidateCount, 800);
  assert.equal(report.urls[0], 'https://example.com/000');
  assert.equal(report.urls.at(-1), 'https://example.com/799');
});

test('resume writes safe failure artifacts without response bodies or URL secrets', async () => {
  const runDir = await mkdtemp(join(tmpdir(), 'qt-collect-resume-'));
  const seeds = join(runDir, 'seeds.csv');
  await writeFile(seeds, 'url,evergreen\nhttps://example.com/a?api_key=hidden,true\n');
  const options = parseCollectArgs(['collect', '--seeds', seeds, '--run-dir', runDir, '--resume']);
  let calls = 0;
  await collectSeeds(options, { fetchCandidate: async (url) => {
    calls += 1;
    return { sourceUrl: url, canonicalUrl: url, sourceHash: 'a'.repeat(64), status: 'failed', safeFailureReason: 'timeout', collectedAt: '2026-07-11T00:00:00Z', collectorVersion: '0.1.0' };
  } });
  await collectSeeds(options, { fetchCandidate: async () => { calls += 1; throw new Error('resume should skip'); } });
  assert.equal(calls, 1);
  const artifact = await readFile(join(runDir, 'raw', '0000.json'), 'utf8');
  assert.equal(artifact.includes('hidden'), false);
  assert.equal(artifact.includes('rawBody'), false);
});

test('extract dependencies are exact, importable, and have no lifecycle install scripts', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
  const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url)));
  assert.equal(pkg.dependencies['@mozilla/readability'], '0.6.0');
  assert.equal(pkg.dependencies.jsdom, '29.1.1');
  assert.equal(lock.packages['node_modules/@mozilla/readability'].version, '0.6.0');
  assert.equal(lock.packages['node_modules/jsdom'].version, '29.1.1');
  assert.equal(Object.values(lock.packages).some((entry) => entry?.hasInstallScript === true), false);
  assert.equal(typeof (await import('@mozilla/readability')).Readability, 'function');
  assert.equal(typeof (await import('jsdom')).JSDOM, 'function');
});

test('article extraction makes hostile XSS HTML inert and produces stable normalized blocks', async () => {
  globalThis.__questionTraceXss = 0;
  const html = await readFile(new URL('./fixtures/hostile-page.html', import.meta.url), 'utf8');
  const extracted = extractArticle(html, 'https://example.com/articles/agents');
  const normalized = normalizeCandidate({
    id: 'candidate-a', kind: 'article', sourceUrl: 'https://example.com/articles/agents#tracking',
    sourceName: 'Example Research', collectedAt: '2026-07-11T00:00:00Z', collectorVersion: '0.1.0',
    ...extracted,
  });
  assert.equal(globalThis.__questionTraceXss, 0);
  assert.equal(normalized.title, 'AI Agents and Work');
  assert.equal(normalized.author, 'Ada Researcher');
  assert.equal(normalized.publicationDate, '2026-02-03');
  assert.ok(normalized.fullText.includes('Agents can reshape tasks'));
  assert.equal(/[<>]|javascript:|onclick|iframe|script/i.test(JSON.stringify(normalized.blocks)), false);
  assert.deepEqual(normalized.blocks.map((block) => block.id), normalizeCandidate({
    id: 'candidate-a', kind: 'article', sourceUrl: 'https://example.com/articles/agents', sourceName: 'Example Research',
    collectedAt: '2026-07-11T00:00:00Z', collectorVersion: '0.1.0', ...extracted,
  }).blocks.map((block) => block.id));
  assert.match(normalized.contentHash, /^[a-f0-9]{64}$/);
});

test('YouTube extraction accepts canonical IDs and only invokes an injected transcript adapter', async () => {
  assert.equal(parseYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(parseYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.throws(() => parseYouTubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ'), /canonical YouTube/);
  assert.throws(() => parseYouTubeVideoId('https://youtube.com/shorts/dQw4w9WgXcQ'), /canonical YouTube/);
  const calls = [];
  const extracted = await extractYouTubeTranscript('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
    adapter: async (videoId) => { calls.push(videoId); return { transcript: 'First line.\n\nSecond line.', title: 'Video title', channel: 'Research Lab', language: 'EN', durationSeconds: 125.4 }; },
  });
  assert.deepEqual(calls, ['dQw4w9WgXcQ']);
  const normalized = normalizeCandidate({ id: 'video-a', kind: 'video', sourceUrl: 'https://youtu.be/dQw4w9WgXcQ', collectedAt: '2026-07-11T00:00:00Z', collectorVersion: '0.1.0', ...extracted });
  assert.equal(normalized.language, 'en');
  assert.equal(normalized.durationSeconds, 125);
  assert.equal(normalized.sourceName, 'Research Lab');
  assert.equal(normalized.blocks.length, 2);
});

test('YouTube transcript failure is explicit/resumable and operator transcript text works without a subprocess', async () => {
  await assert.rejects(() => extractYouTubeTranscript('https://youtu.be/dQw4w9WgXcQ'), /transcript adapter or operator transcript file/);
  const extracted = await extractYouTubeTranscript('https://youtu.be/dQw4w9WgXcQ', { transcriptText: 'Operator supplied transcript.' });
  assert.equal(extracted.fullText, 'Operator supplied transcript.');
  assert.equal(extracted.extractionMethod, 'operator-transcript-file');
});

test('normalize CLI turns collected articles into stable candidates and keeps videos resumable until an operator transcript exists', async () => {
  const runDir = await mkdtemp(join(tmpdir(), 'qt-normalize-'));
  const seeds = join(runDir, 'seeds.json');
  const transcripts = join(runDir, 'operator-transcripts');
  await mkdir(join(runDir, 'raw'), { recursive: true });
  await mkdir(transcripts, { recursive: true });
  await writeFile(seeds, JSON.stringify([
    { url: 'https://example.com/article' },
    { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  ]));
  await writeFile(join(runDir, 'raw', '0000.json'), JSON.stringify({
    sourceUrl: 'https://example.com/article', canonicalUrl: 'https://example.com/article',
    collectedAt: '2026-07-11T00:00:00Z', collectorVersion: '0.1.0', sourceHash: 'a'.repeat(64),
    status: 'collected', mimeType: 'text/html', rawBody: '<html lang="en"><head><title>Agents at Work</title></head><body><article><h1>Agents at Work</h1><p>AI agents can support bounded workplace tasks while people retain oversight and accountability.</p></article></body></html>',
  }));
  await writeFile(join(runDir, 'raw', '0001.json'), JSON.stringify({
    sourceUrl: 'https://www.youtube.com/watch?v=%5BREDACTED%5D', canonicalUrl: 'https://www.youtube.com/watch?v=%5BREDACTED%5D',
    collectedAt: '2026-07-11T00:00:00Z', collectorVersion: '0.1.0', sourceHash: 'b'.repeat(64),
    status: 'collected', mimeType: 'text/html', rawBody: '<html><title>Video</title></html>',
  }));

  const parsed = parseNormalizeArgs(['normalize', '--run-dir', runDir, '--seeds', seeds, '--transcripts-dir', transcripts, '--resume']);
  assert.equal(parsed.runDir, runDir);
  assert.equal(parsed.resume, true);
  const first = await normalizeRunDirectory(parsed);
  assert.deepEqual(first, { candidates: 2, normalized: 1, failed: 1, operatorTranscriptsUsed: 0 });
  const article = JSON.parse(await readFile(join(runDir, 'normalized', '0000.json'), 'utf8'));
  assert.equal(article.kind, 'article');
  assert.equal(article.title, 'Agents at Work');
  assert.ok(article.fullText.includes('retain oversight'));
  const videoFailure = JSON.parse(await readFile(join(runDir, 'normalize-failures', '0001.json'), 'utf8'));
  assert.equal(videoFailure.reasonCode, 'operator_transcript_required');
  assert.equal(JSON.stringify(videoFailure).includes('rawBody'), false);

  await writeFile(join(transcripts, 'dQw4w9WgXcQ.txt'), 'Verified operator transcript about agents and the future of work.');
  const resumed = await normalizeRunDirectory(parsed);
  assert.deepEqual(resumed, { candidates: 2, normalized: 2, failed: 0, operatorTranscriptsUsed: 1 });
  const video = JSON.parse(await readFile(join(runDir, 'normalized', '0001.json'), 'utf8'));
  assert.equal(video.kind, 'video');
  assert.equal(video.videoId, 'dQw4w9WgXcQ');
  assert.equal(video.extractionMethod, 'operator-transcript-file');
  await assert.rejects(readFile(join(runDir, 'normalize-failures', '0001.json')), /ENOENT/);
});

test('normalize CLI dispatcher forwards only the parsed run, seed, transcript, and resume options', async () => {
  let captured;
  const result = await dispatchCli([
    'normalize', '--run-dir', 'runs/pilot', '--seeds', 'seeds/pilot.json',
    '--transcripts-dir', 'operator/transcripts', '--resume',
  ], { normalize: async (options) => { captured = options; return { ok: true }; } });
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(captured, {
    command: 'normalize', runDir: 'runs/pilot', seeds: 'seeds/pilot.json',
    transcriptsDir: 'operator/transcripts', resume: true,
  });
  await assert.rejects(() => dispatchCli(['normalize', '--run-dir', 'runs/pilot', '--seeds', 'seeds/pilot.json', '--unexpected', 'x']), /unsupported normalize option/);
});

test('normalize rejects secret-bearing source URLs instead of persisting query credentials', async () => {
  const runDir = await mkdtemp(join(tmpdir(), 'qt-normalize-secret-'));
  const seeds = join(runDir, 'seeds.json');
  await mkdir(join(runDir, 'raw'), { recursive: true });
  await writeFile(seeds, JSON.stringify([{ url: 'https://example.com/article?api_key=do-not-store' }]));
  await writeFile(join(runDir, 'raw', '0000.json'), JSON.stringify({
    sourceUrl: 'https://example.com/article?api_key=%5BREDACTED%5D', canonicalUrl: 'https://example.com/article?api_key=%5BREDACTED%5D',
    collectedAt: '2026-07-11T00:00:00Z', collectorVersion: '0.1.0', sourceHash: 'c'.repeat(64),
    status: 'collected', mimeType: 'text/html', rawBody: '<article><p>Enough safe article text for deterministic normalization.</p></article>',
  }));
  const report = await normalizeRunDirectory(parseNormalizeArgs(['normalize', '--run-dir', runDir, '--seeds', seeds]));
  assert.deepEqual(report, { candidates: 1, normalized: 0, failed: 1, operatorTranscriptsUsed: 0 });
  const failure = await readFile(join(runDir, 'normalize-failures', '0000.json'), 'utf8');
  assert.match(failure, /sensitive_query_parameter/);
  assert.equal(failure.includes('do-not-store'), false);
});

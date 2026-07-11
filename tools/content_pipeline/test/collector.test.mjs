import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { collectSeeds, parseCollectArgs, resolveOutputPath } from '../src/cli.ts';
import { fetchCandidate } from '../src/collect/fetch-candidate.ts';
import { assertPublicHttpUrl } from '../src/collect/url-policy.ts';

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

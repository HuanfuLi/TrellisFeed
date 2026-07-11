import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fetchCandidate as collectOne, redactUrl, type FetchCandidateOptions, type RawCandidate } from './collect/fetch-candidate.ts';

const PILOT_TOPIC = 'ai-agents-future-work';

export interface CollectOptions {
  command: 'collect'; topic: string; seeds: string; runDir: string;
  maxCandidates: number; maxBytes: number; timeoutMs: number;
  resume: boolean; dryRun: boolean;
}

type Seed = { url: string; evergreen?: boolean; publicationDate?: string };
type CollectDeps = { fetchCandidate?: (url: string, options: FetchCandidateOptions) => Promise<RawCandidate> };

export function parseCollectArgs(argv: string[]): CollectOptions {
  if (argv[0] !== 'collect') throw new Error('only the collect command is supported');
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (['--resume', '--dry-run'].includes(arg)) flags.add(arg);
    else if (arg.startsWith('--')) {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`missing value for ${arg}`);
      values.set(arg, value);
    } else throw new Error(`unexpected argument ${arg}`);
  }
  const seeds = values.get('--seeds');
  const runDir = values.get('--run-dir');
  if (!seeds || !runDir) throw new Error('--seeds and --run-dir are required');
  const maxCandidates = Number(values.get('--max-candidates') ?? '150');
  const maxBytes = Number(values.get('--max-bytes') ?? '5000000');
  const timeoutMs = Number(values.get('--timeout-ms') ?? '15000');
  if (!Number.isInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > 800) throw new Error('--max-candidates must be 1..800');
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error('byte and timeout limits must be positive integers');
  return { command: 'collect', topic: values.get('--topic') ?? PILOT_TOPIC, seeds, runDir, maxCandidates, maxBytes, timeoutMs, resume: flags.has('--resume'), dryRun: flags.has('--dry-run') };
}

export function resolveOutputPath(runDir: string, child: string): string {
  const root = resolve(runDir);
  const output = resolve(root, child);
  const rel = relative(root, output);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('output path is outside run directory');
  return output;
}

function parseCsv(source: string): Seed[] {
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const headers = lines.shift()?.split(',').map((value) => value.trim()) ?? [];
  if (!headers.includes('url')) throw new Error('CSV seed list requires url column');
  return lines.map((line) => {
    const row = line.split(',').map((value) => value.trim());
    const value = Object.fromEntries(headers.map((key, i) => [key, row[i] ?? '']));
    return { url: value.url, evergreen: value.evergreen === 'true', publicationDate: value.publicationDate || undefined };
  });
}

async function readSeeds(path: string): Promise<Seed[]> {
  const source = await readFile(path, 'utf8');
  const parsed = path.toLowerCase().endsWith('.json') ? JSON.parse(source) : parseCsv(source);
  if (!Array.isArray(parsed) || parsed.some((seed) => typeof seed?.url !== 'string')) throw new Error('seed file must be a JSON/CSV URL list');
  return parsed;
}

function isVideo(url: string): boolean {
  const hostname = new URL(url).hostname.toLowerCase();
  return hostname === 'youtu.be' || hostname === 'youtube.com' || hostname.endsWith('.youtube.com');
}

function artifactCandidate(candidate: RawCandidate): RawCandidate {
  const safe = { ...candidate, sourceUrl: redactUrl(candidate.sourceUrl), canonicalUrl: redactUrl(candidate.canonicalUrl) };
  if (safe.status !== 'collected') delete safe.rawBody;
  return safe;
}

export async function collectSeeds(options: CollectOptions, deps: CollectDeps = {}) {
  const seeds = (await readSeeds(options.seeds)).sort((a, b) => a.url.localeCompare(b.url));
  if (options.topic === PILOT_TOPIC && (options.maxCandidates > 150 || seeds.length > 150)) throw new Error('pilot profile is capped at 150 candidates');
  if (seeds.length > options.maxCandidates) throw new Error(`seed list exceeds --max-candidates ${options.maxCandidates}`);
  const videos = seeds.filter((seed) => isVideo(seed.url)).length;
  const report = {
    topic: options.topic, candidateCount: seeds.length, urls: seeds.map((seed) => redactUrl(seed.url)),
    mix: { text: seeds.length - videos, video: videos, textRatio: seeds.length ? (seeds.length - videos) / seeds.length : 0, videoRatio: seeds.length ? videos / seeds.length : 0 },
    evergreenCount: seeds.filter((seed) => seed.evergreen).length,
    datedCount: seeds.filter((seed) => seed.publicationDate).length,
  };
  if (options.dryRun) return report;
  const fetcher = deps.fetchCandidate ?? collectOne;
  const rawDir = resolveOutputPath(options.runDir, 'raw');
  await mkdir(rawDir, { recursive: true });
  for (let index = 0; index < seeds.length; index += 1) {
    const output = resolveOutputPath(options.runDir, `raw/${String(index).padStart(4, '0')}.json`);
    if (options.resume) {
      try { await readFile(output); continue; } catch { /* collect missing artifact */ }
    }
    let candidate: RawCandidate;
    try { candidate = await fetcher(seeds[index].url, { maxBytes: options.maxBytes, timeoutMs: options.timeoutMs }); }
    catch (error) {
      const safeFailureReason = error instanceof Error ? error.message.replace(/https?:\/\/\S+/g, '[REDACTED_URL]').slice(0, 200) : 'collection failed';
      candidate = { sourceUrl: seeds[index].url, canonicalUrl: seeds[index].url, collectedAt: new Date().toISOString(), collectorVersion: '0.1.0', sourceHash: createHash('sha256').update(seeds[index].url).digest('hex'), status: 'failed', safeFailureReason };
    }
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(artifactCandidate(candidate), null, 2)}\n`, { flag: 'wx' });
  }
  await writeFile(resolveOutputPath(options.runDir, 'collection-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const report = await collectSeeds(parseCollectArgs(argv));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });

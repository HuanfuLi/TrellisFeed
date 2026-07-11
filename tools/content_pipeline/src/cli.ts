import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fetchCandidate as collectOne, redactUrl, type FetchCandidateOptions, type RawCandidate } from './collect/fetch-candidate.ts';
import { createAnthropicProvider } from './ai/anthropic.ts';
import { createGeminiProvider } from './ai/gemini.ts';
import { createOpenAiProvider } from './ai/openai.ts';
import type { StructuredProvider } from './ai/provider.ts';
import type { NormalizedCandidate } from './normalize/candidate.ts';
import { runStructuredPreprocess } from './preprocess/run.ts';
import { runCodexGate } from './codex-gate/run.ts';

const PILOT_TOPIC = 'ai-agents-future-work';

export interface CollectOptions {
  command: 'collect'; topic: string; seeds: string; runDir: string;
  maxCandidates: number; maxBytes: number; timeoutMs: number;
  resume: boolean; dryRun: boolean;
}

export interface PreprocessOptions {
  command: 'preprocess'; runDir: string; provider: 'anthropic' | 'openai' | 'gemini' | 'local';
  model: string; promptVersion: string; schemaVersion: string;
  maxConcurrency: number; spendLimit: number; resume: boolean;
}

export interface CodexReviewCliOptions {
  command: 'codex-review'; runDir: string; codexCommand: string; timeoutMs: number;
}

export interface CliHandlers {
  collect?: (options: CollectOptions) => Promise<unknown>;
  preprocess?: (options: PreprocessOptions) => Promise<unknown>;
  codexReview?: (options: CodexReviewCliOptions) => Promise<unknown>;
}

type Seed = { url: string; evergreen?: boolean; publicationDate?: string };
type CollectDeps = { fetchCandidate?: (url: string, options: FetchCandidateOptions) => Promise<RawCandidate> };

export function parseCollectArgs(argv: string[]): CollectOptions {
  if (argv[0] !== 'collect') throw new Error('expected collect command');
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

function parseValues(argv: string[], booleanFlags: string[]): { values: Map<string, string>; flags: Set<string> } {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (booleanFlags.includes(argument)) flags.add(argument);
    else if (argument.startsWith('--')) {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`missing value for ${argument}`);
      values.set(argument, value);
    } else throw new Error(`unexpected argument ${argument}`);
  }
  return { values, flags };
}

export function parsePreprocessArgs(argv: string[]): PreprocessOptions {
  if (argv[0] !== 'preprocess') throw new Error('expected preprocess command');
  const { values, flags } = parseValues(argv, ['--resume']);
  const allowed = new Set(['--run-dir', '--provider', '--model', '--prompt-version', '--schema-version', '--max-concurrency', '--spend-limit']);
  for (const key of values.keys()) if (!allowed.has(key)) throw new Error(`unsupported preprocess option ${key}`);
  const runDir = values.get('--run-dir');
  const provider = values.get('--provider');
  const model = values.get('--model');
  const promptVersion = values.get('--prompt-version');
  const schemaVersion = values.get('--schema-version');
  if (!runDir || !provider || !model || !promptVersion || !schemaVersion) throw new Error('preprocess requires --run-dir, --provider, --model, --prompt-version, and --schema-version');
  if (!['anthropic', 'openai', 'gemini', 'local'].includes(provider)) throw new Error('unsupported preprocessing provider');
  const maxConcurrency = Number(values.get('--max-concurrency') ?? '1');
  const spendLimit = Number(values.get('--spend-limit') ?? '0');
  if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1 || maxConcurrency > 32) throw new Error('--max-concurrency must be 1..32');
  if (!Number.isFinite(spendLimit) || spendLimit < 0) throw new Error('--spend-limit must be a non-negative number');
  return { command: 'preprocess', runDir, provider: provider as PreprocessOptions['provider'], model, promptVersion, schemaVersion, maxConcurrency, spendLimit, resume: flags.has('--resume') };
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

function configuredProvider(options: PreprocessOptions): StructuredProvider {
  if (options.provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required');
    return createAnthropicProvider({ model: options.model, apiKey });
  }
  if (options.provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is required');
    return createGeminiProvider({ model: options.model, apiKey });
  }
  if (options.provider === 'local') {
    const endpoint = process.env.QUESTIONTRACE_LOCAL_OPENAI_ENDPOINT;
    if (!endpoint) throw new Error('QUESTIONTRACE_LOCAL_OPENAI_ENDPOINT is required');
    return createOpenAiProvider({ model: options.model, apiKey: process.env.QUESTIONTRACE_LOCAL_OPENAI_KEY ?? 'local', endpoint, nativeStructuredOutput: false, name: 'local' });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required');
  return createOpenAiProvider({ model: options.model, apiKey });
}

async function preprocessRunDirectory(options: PreprocessOptions): Promise<unknown> {
  const normalizedDir = resolveOutputPath(options.runDir, 'normalized');
  const filenames = (await readdir(normalizedDir)).filter((name) => /^\d+.*\.json$/i.test(name)).sort();
  const candidates: NormalizedCandidate[] = [];
  for (const filename of filenames) candidates.push(JSON.parse(await readFile(resolveOutputPath(options.runDir, `normalized/${filename}`), 'utf8')));
  const results = await runStructuredPreprocess({
    candidates, topic: PILOT_TOPIC, provider: configuredProvider(options), promptVersion: options.promptVersion,
    schemaVersion: options.schemaVersion, runDir: options.runDir, maxConcurrency: options.maxConcurrency,
    spendLimit: options.spendLimit, resume: options.resume,
  });
  return { processed: results.filter((result) => result.status === 'preprocessed').length, failed: results.filter((result) => result.status === 'failed').length };
}

function parseCodexReviewArgs(argv: string[]): CodexReviewCliOptions {
  const { values } = parseValues(argv, []);
  const allowed = new Set(['--run-dir', '--codex-command', '--timeout-ms']);
  for (const key of values.keys()) if (!allowed.has(key)) throw new Error(`unsupported codex-review option ${key}`);
  const runDir = values.get('--run-dir');
  if (!runDir) throw new Error('codex-review requires --run-dir');
  const timeoutMs = Number(values.get('--timeout-ms') ?? '120000');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error('--timeout-ms must be a positive integer');
  return { command: 'codex-review', runDir, codexCommand: values.get('--codex-command') ?? 'codex', timeoutMs };
}

async function codexReviewRunDirectory(options: CodexReviewCliOptions): Promise<unknown> {
  const normalizedDir = resolveOutputPath(options.runDir, 'normalized');
  const normalizedFiles = (await readdir(normalizedDir)).filter((name) => name.endsWith('.json')).sort();
  const normalized = new Map<string, NormalizedCandidate>();
  for (const filename of normalizedFiles) {
    const value: NormalizedCandidate = JSON.parse(await readFile(resolveOutputPath(options.runDir, `normalized/${filename}`), 'utf8'));
    normalized.set(value.id, value);
  }
  const preprocessedDir = resolveOutputPath(options.runDir, 'preprocessed');
  const filenames = (await readdir(preprocessedDir)).filter((name) => name.endsWith('.json')).sort();
  const reviewDir = resolveOutputPath(options.runDir, 'codex-review');
  await mkdir(reviewDir, { recursive: true });
  let advanced = 0;
  let blocked = 0;
  for (const filename of filenames) {
    const candidate = JSON.parse(await readFile(resolveOutputPath(options.runDir, `preprocessed/${filename}`), 'utf8'));
    const source = normalized.get(candidate.candidateId);
    const result = source ? await runCodexGate({ candidate, sourceText: source.fullText, codexCommand: options.codexCommand, timeoutMs: options.timeoutMs, maxOutputBytes: 64 * 1024, cwd: resolve(options.runDir) }) : { status: 'blocked', reasonCode: 'missing_source', canAdvanceToHuman: false, requiresHumanApproval: true };
    await writeFile(resolveOutputPath(options.runDir, `codex-review/${candidate.cacheKey}.json`), `${JSON.stringify(result, null, 2)}\n`);
    if (result.canAdvanceToHuman) advanced += 1; else blocked += 1;
  }
  return { reviewed: filenames.length, advancedToHumanReview: advanced, blocked, operatorApprovalRequired: true };
}

export async function dispatchCli(argv: string[], handlers: CliHandlers = {}): Promise<unknown> {
  if (argv[0] === 'collect') return (handlers.collect ?? ((options) => collectSeeds(options)))(parseCollectArgs(argv));
  if (argv[0] === 'preprocess') return (handlers.preprocess ?? preprocessRunDirectory)(parsePreprocessArgs(argv));
  if (argv[0] === 'codex-review') {
    return (handlers.codexReview ?? codexReviewRunDirectory)(parseCodexReviewArgs(argv));
  }
  throw new Error(`unsupported command ${argv[0] ?? ''}`);
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const report = await dispatchCli(argv);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });

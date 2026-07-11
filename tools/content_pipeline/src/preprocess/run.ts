import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { NormalizedCandidate } from '../normalize/candidate.ts';
import { deriveProviderSchema, type StructuredProvider } from '../ai/provider.ts';
import { parseAndValidateDraft, validateCompletedResult, validateDraftReferences, type StructuredFailure } from '../ai/validate.ts';
import { buildPreprocessPrompt } from './prompt.ts';
import { disabledPipelineTracer, type PipelineTracer } from '../observability/trace.ts';

export interface PreprocessRunKey {
  normalizedContentSha256: string;
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
}

export interface PreprocessLogEntry {
  stage: 'preprocess';
  candidateHash: string;
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  attempt: number;
  stopReason?: string;
  inputTokens?: number;
  outputTokens?: number;
  validationPaths?: string[];
  outcome: 'success' | 'retry' | 'failed' | 'cached' | 'spend_limit';
}

export interface PreprocessSuccess {
  status: 'preprocessed';
  candidateId: string;
  candidateContentHash: string;
  cacheKey: string;
  attempts: number;
  draft: any;
  provenance: { provider: string; model: string; promptVersion: string; schemaVersion: string };
  providerRequestId: string;
  stopReason: string;
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
}

export interface PreprocessFailure {
  status: 'failed';
  candidateId: string;
  candidateContentHash: string;
  cacheKey: string;
  attempts: number;
  failure: StructuredFailure;
}

export type PreprocessOutcome = PreprocessSuccess | PreprocessFailure;

export interface RunStructuredPreprocessOptions {
  candidates: NormalizedCandidate[];
  topic: string;
  provider: StructuredProvider;
  promptVersion: string;
  schemaVersion: string;
  runDir: string;
  maxConcurrency: number;
  spendLimit: number;
  resume?: boolean;
  estimateRequestCostUsd?: (candidate: NormalizedCandidate) => number;
  logger?: (entry: PreprocessLogEntry) => void;
  environment?: Record<string, string | undefined>;
  sleep?: (milliseconds: number) => Promise<void>;
  tracer?: PipelineTracer;
}

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

export function createPreprocessRunKey(candidate: NormalizedCandidate, provider: StructuredProvider, promptVersion: string, schemaVersion: string): PreprocessRunKey {
  return { normalizedContentSha256: candidate.contentHash, provider: provider.name, model: provider.model, promptVersion, schemaVersion };
}

export function serializePreprocessRunKey(key: PreprocessRunKey): string {
  return sha256(JSON.stringify(key));
}

async function readCached(path: string): Promise<PreprocessSuccess | undefined> {
  try {
    const value = JSON.parse(await readFile(path, 'utf8'));
    return value?.status === 'preprocessed' ? value : undefined;
  } catch { return undefined; }
}

async function writeAtomic(path: string, value: unknown): Promise<void> {
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  await rename(temporary, path);
}

export async function runStructuredPreprocess(options: RunStructuredPreprocessOptions): Promise<PreprocessOutcome[]> {
  if (!Number.isInteger(options.maxConcurrency) || options.maxConcurrency < 1 || options.maxConcurrency > 32) throw new Error('maxConcurrency must be an integer from 1 to 32');
  if (!Number.isFinite(options.spendLimit) || options.spendLimit < 0) throw new Error('spendLimit must be a non-negative number');
  const outputDir = join(options.runDir, 'preprocessed');
  await mkdir(outputDir, { recursive: true });
  const outcomes = new Array<PreprocessOutcome>(options.candidates.length);
  // Reserve a conservative per-candidate envelope (including possible repairs)
  // when the operator has not supplied provider-specific pricing.
  const estimate = options.estimateRequestCostUsd ?? (() => 0.25);
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const tracer = options.tracer ?? disabledPipelineTracer;
  let nextIndex = 0;
  let committedSpend = 0;
  let reservedSpend = 0;

  const worker = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= options.candidates.length) return;
      const candidate = options.candidates[index];
      const runKey = createPreprocessRunKey(candidate, options.provider, options.promptVersion, options.schemaVersion);
      const cacheKey = serializePreprocessRunKey(runKey);
      const cachePath = join(outputDir, `${cacheKey}.json`);
      if (options.resume) {
        const cached = await readCached(cachePath);
        if (cached) {
          outcomes[index] = cached;
          options.logger?.({ stage: 'preprocess', candidateHash: candidate.contentHash, provider: options.provider.name, model: options.provider.model, promptVersion: options.promptVersion, schemaVersion: options.schemaVersion, attempt: cached.attempts, outcome: 'cached' });
          continue;
        }
      }

      const reservation = Math.max(0, estimate(candidate));
      if (committedSpend + reservedSpend + reservation > options.spendLimit) {
        const failure = { code: 'spend_limit', retryable: false };
        outcomes[index] = { status: 'failed', candidateId: candidate.id, candidateContentHash: candidate.contentHash, cacheKey, attempts: 0, failure };
        options.logger?.({ stage: 'preprocess', candidateHash: candidate.contentHash, provider: options.provider.name, model: options.provider.model, promptVersion: options.promptVersion, schemaVersion: options.schemaVersion, attempt: 0, outcome: 'spend_limit' });
        continue;
      }
      reservedSpend += reservation;
      let lastFailure: StructuredFailure = { code: 'unknown', retryable: false };
      let actualCost = 0;
      let attempts = 0;
      try {
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          attempts = attempt;
          const prompt = buildPreprocessPrompt(candidate, options.topic);
          const startedAt = Date.now();
          tracer.record('preprocess.request', {
            candidateHash: candidate.contentHash, promptVersion: options.promptVersion,
            schemaVersion: options.schemaVersion, modelVersion: options.provider.model,
          });
          const result = await options.provider.call({
            model: options.provider.model, prompt, schema: deriveProviderSchema('preprocessed-post-v1'),
            maxTokens: 4096, attempt, validationPaths: lastFailure.paths,
          });
          actualCost += Math.max(0, result.costUsd ?? 0);
          tracer.record('preprocess.response', {
            requestId: result.requestId, candidateHash: candidate.contentHash,
            promptVersion: options.promptVersion, schemaVersion: options.schemaVersion,
            modelVersion: result.model || options.provider.model, stopReason: result.stopReason,
            inputTokens: result.inputTokens, outputTokens: result.outputTokens,
            latencyMs: Math.max(0, Date.now() - startedAt), persistenceOutcome: 'pending_validation',
          });
          const completed = validateCompletedResult(result);
          if (!completed.ok) {
            lastFailure = completed.error;
          } else {
            const parsed = parseAndValidateDraft(result.text);
            if (!parsed.ok) lastFailure = parsed.error;
            else {
              const referenceFailure = validateDraftReferences(parsed.value, new Set(candidate.blocks.map((block) => block.id)));
              if (referenceFailure) lastFailure = referenceFailure;
              else {
                const success: PreprocessSuccess = {
                  status: 'preprocessed', candidateId: candidate.id, candidateContentHash: candidate.contentHash,
                  cacheKey, attempts: attempt, draft: parsed.value,
                  provenance: { provider: options.provider.name, model: result.model || options.provider.model, promptVersion: options.promptVersion, schemaVersion: options.schemaVersion },
                  providerRequestId: result.requestId, stopReason: result.stopReason,
                  usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens, costUsd: actualCost },
                };
                await writeAtomic(cachePath, success);
                tracer.record('preprocess.persist', {
                  requestId: result.requestId, candidateHash: candidate.contentHash,
                  promptVersion: options.promptVersion, schemaVersion: options.schemaVersion,
                  modelVersion: result.model || options.provider.model, stopReason: result.stopReason,
                  inputTokens: result.inputTokens, outputTokens: result.outputTokens,
                  persistenceOutcome: 'preprocessed_cache_written',
                });
                outcomes[index] = success;
                options.logger?.({ stage: 'preprocess', candidateHash: candidate.contentHash, provider: options.provider.name, model: result.model || options.provider.model, promptVersion: options.promptVersion, schemaVersion: options.schemaVersion, attempt, stopReason: result.stopReason, inputTokens: result.inputTokens, outputTokens: result.outputTokens, outcome: 'success' });
                break;
              }
            }
          }
          options.logger?.({ stage: 'preprocess', candidateHash: candidate.contentHash, provider: options.provider.name, model: options.provider.model, promptVersion: options.promptVersion, schemaVersion: options.schemaVersion, attempt, stopReason: result.stopReason, inputTokens: result.inputTokens, outputTokens: result.outputTokens, validationPaths: lastFailure.paths, outcome: lastFailure.retryable && attempt < 3 ? 'retry' : 'failed' });
          if (!lastFailure.retryable || attempt === 3) break;
          if (result.retryAfterMs && result.retryAfterMs > 0) await sleep(result.retryAfterMs);
        }
      } catch {
        lastFailure = { code: 'provider_transport', retryable: false };
        options.logger?.({ stage: 'preprocess', candidateHash: candidate.contentHash, provider: options.provider.name, model: options.provider.model, promptVersion: options.promptVersion, schemaVersion: options.schemaVersion, attempt: attempts, outcome: 'failed' });
      } finally {
        reservedSpend -= reservation;
        committedSpend += actualCost;
      }
      outcomes[index] ??= { status: 'failed', candidateId: candidate.id, candidateContentHash: candidate.contentHash, cacheKey, attempts, failure: lastFailure };
    }
  };

  await Promise.all(Array.from({ length: Math.min(options.maxConcurrency, Math.max(1, options.candidates.length)) }, () => worker()));
  return outcomes;
}

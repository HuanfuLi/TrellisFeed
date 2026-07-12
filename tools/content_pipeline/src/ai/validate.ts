import { createRequire } from 'node:module';
import type { ErrorObject, ValidateFunction } from 'ajv';
import { deriveProviderSchema, type StructuredResult } from './provider.ts';

const require = createRequire(import.meta.url);
const Ajv2020 = require('ajv/dist/2020.js').default;
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateDraft: ValidateFunction = ajv.compile(deriveProviderSchema('preprocessed-post-v1'));

export interface StructuredFailure { code: string; retryable: boolean; paths?: string[] }
export type CompletionCheck = { ok: true; result: StructuredResult } | { ok: false; error: StructuredFailure };

const normalStops = new Set(['end_turn', 'stop', 'STOP', 'completed']);
const paths = (errors: ErrorObject[] | null | undefined) => (errors ?? []).map((error) => `${error.instancePath || '/'}${error.keyword === 'required' ? `/${String(error.params.missingProperty)}` : ''}`);

export function validateCompletedResult(result: StructuredResult): CompletionCheck {
  if (result.schemaError) return { ok: false, error: { code: 'schema_compilation', retryable: false } };
  if (result.httpStatus === 401 || result.httpStatus === 403) return { ok: false, error: { code: 'authentication', retryable: false } };
  if (result.httpStatus < 200 || result.httpStatus >= 300) return { ok: false, error: { code: `provider_http_${result.httpStatus}`, retryable: result.httpStatus === 429 || result.httpStatus >= 500 } };
  if (result.refusal) return { ok: false, error: { code: 'provider_refusal', retryable: false } };
  if (!result.text.trim()) return { ok: false, error: { code: 'empty_output', retryable: false } };
  if (!normalStops.has(result.stopReason)) return { ok: false, error: { code: result.stopReason === 'max_tokens' || result.stopReason === 'MAX_TOKENS' ? 'truncated' : 'abnormal_stop', retryable: result.stopReason === 'max_tokens' || result.stopReason === 'MAX_TOKENS' } };
  return { ok: true, result };
}

export function parseAndValidateDraft(text: string): { ok: true; value: any } | { ok: false; error: StructuredFailure } {
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { return { ok: false, error: { code: 'malformed_json', retryable: true, paths: ['/'] } }; }
  if (!validateDraft(value)) return { ok: false, error: { code: 'local_validation', retryable: true, paths: paths(validateDraft.errors) } };
  return { ok: true, value };
}

export function validateDraftReferences(value: any, blockIds: Set<string>): StructuredFailure | undefined {
  const labels = new Set(value.concepts.map((concept: any) => concept.label));
  const invalid = new Set<string>();
  value.claims.forEach((claim: any, claimIndex: number) => {
    claim.conceptLabels.forEach((label: string) => { if (!labels.has(label)) invalid.add(`/claims/${claimIndex}/conceptLabels`); });
    claim.sourceBlockIds.forEach((id: string) => { if (!blockIds.has(id)) invalid.add(`/claims/${claimIndex}/sourceBlockIds`); });
  });
  value.concepts.forEach((concept: any, index: number) => {
    for (const label of [...concept.relatedConceptLabels, ...concept.prerequisiteConceptLabels]) if (!labels.has(label)) invalid.add(`/concepts/${index}`);
  });
  value.suggestedQuestions.forEach((question: any, index: number) => {
    question.targetConceptLabels.forEach((label: string) => { if (!labels.has(label)) invalid.add(`/suggestedQuestions/${index}/targetConceptLabels`); });
    question.targetClaimIndexes.forEach((claimIndex: number) => { if (claimIndex >= value.claims.length) invalid.add(`/suggestedQuestions/${index}/targetClaimIndexes`); });
  });
  return invalid.size ? { code: 'local_validation', retryable: true, paths: [...invalid].sort() } : undefined;
}

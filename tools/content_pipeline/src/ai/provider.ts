export type ProviderName = 'anthropic' | 'openai' | 'gemini' | 'local' | 'fixture';

export interface StructuredPrompt {
  system: string;
  user: string;
}

export interface StructuredRequest {
  model: string;
  prompt: StructuredPrompt;
  schema: Record<string, unknown>;
  maxTokens: 4096;
  attempt?: number;
  validationPaths?: string[];
  media?: { kind: 'youtube'; url: string; videoId?: string };
}

export interface StructuredResult {
  text: string;
  model: string;
  stopReason: string;
  inputTokens: number;
  outputTokens: number;
  requestId: string;
  httpStatus: number;
  refusal?: string;
  schemaError?: string;
  retryAfterMs?: number;
  costUsd?: number;
}

export interface StructuredProvider {
  name: ProviderName | string;
  model: string;
  call(request: StructuredRequest): Promise<StructuredResult>;
}

const stringArray = { type: 'array', items: { type: 'string', minLength: 1, maxLength: 500 }, uniqueItems: true, maxItems: 100 } as const;
const score = { type: 'number', minimum: 0, maximum: 1 } as const;

const PREPROCESSED_POST_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'QuestionTracePreprocessedPostV1',
  type: 'object',
  additionalProperties: false,
  required: [
    'displayTitle', 'hook', 'shortSummary', 'longSummary', 'difficulty', 'qualityScore',
    'interestingnessScore', 'educationalValueScore', 'viewpoint', 'topicRelevance',
    'concepts', 'claims', 'suggestedQuestions', 'potentialCounterpoints',
    'reliabilityConcerns', 'safetyConcerns', 'contentWarnings', 'rejectRecommended',
    'rejectionReasons',
  ],
  properties: {
    displayTitle: { type: 'string', minLength: 1, maxLength: 500 },
    hook: { type: 'string', minLength: 1, maxLength: 240 },
    shortSummary: { type: 'string', minLength: 1, maxLength: 800 },
    longSummary: { type: 'string', minLength: 1, maxLength: 2400 },
    difficulty: score,
    qualityScore: score,
    interestingnessScore: score,
    educationalValueScore: score,
    viewpoint: { enum: ['supportive', 'critical', 'neutral', 'mixed'] },
    topicRelevance: score,
    concepts: {
      type: 'array', minItems: 5, maxItems: 8,
      items: {
        type: 'object', additionalProperties: false,
        required: ['label', 'description', 'aliases', 'relatedConceptLabels', 'prerequisiteConceptLabels'],
        properties: {
          label: { type: 'string', minLength: 1, maxLength: 120 },
          description: { type: 'string', minLength: 1, maxLength: 800 },
          aliases: { ...stringArray, items: { type: 'string', minLength: 1, maxLength: 120 } },
          relatedConceptLabels: { ...stringArray, items: { type: 'string', minLength: 1, maxLength: 120 } },
          prerequisiteConceptLabels: { ...stringArray, items: { type: 'string', minLength: 1, maxLength: 120 } },
        },
      },
    },
    claims: {
      type: 'array', minItems: 1, maxItems: 3,
      items: {
        type: 'object', additionalProperties: false,
        required: ['text', 'stance', 'conceptLabels', 'sourceBlockIds'],
        properties: {
          text: { type: 'string', minLength: 1, maxLength: 800 },
          stance: { enum: ['pro', 'con', 'neutral', 'mixed'] },
          conceptLabels: { ...stringArray, items: { type: 'string', minLength: 1, maxLength: 120 } },
          sourceBlockIds: { ...stringArray, items: { type: 'string', minLength: 1, maxLength: 128 }, minItems: 1 },
        },
      },
    },
    suggestedQuestions: {
      type: 'array', minItems: 5, maxItems: 5,
      items: {
        type: 'object', additionalProperties: false,
        required: ['text', 'type', 'targetConceptLabels', 'targetClaimIndexes', 'generic'],
        properties: {
          text: { type: 'string', minLength: 1, maxLength: 240 },
          type: { enum: ['clarification', 'evidence', 'counterpoint', 'connection', 'implication', 'example', 'reliability'] },
          targetConceptLabels: { ...stringArray, items: { type: 'string', minLength: 1, maxLength: 120 } },
          targetClaimIndexes: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 2 }, uniqueItems: true, maxItems: 3 },
          generic: { type: 'boolean' },
        },
      },
    },
    potentialCounterpoints: stringArray,
    reliabilityConcerns: stringArray,
    safetyConcerns: stringArray,
    contentWarnings: stringArray,
    rejectRecommended: { type: 'boolean' },
    rejectionReasons: stringArray,
  },
} as const;

export type PreprocessSchemaVersion = 'preprocessed-post-v1';

export function deriveProviderSchema(version: PreprocessSchemaVersion): Record<string, unknown> {
  if (version !== 'preprocessed-post-v1') throw new Error(`unsupported preprocessing schema ${version}`);
  return structuredClone(PREPROCESSED_POST_SCHEMA) as unknown as Record<string, unknown>;
}

export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

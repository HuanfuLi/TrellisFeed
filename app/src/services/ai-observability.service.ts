export type AiFilterOutcome = 'on-topic' | 'off-topic';
export type AiPersistenceOutcome = 'persisted' | 'not-persisted';

export interface AiOperationMetadata {
  requestId: string;
  postId: string;
  poolVersion?: string;
  promptVersion?: string;
  schemaVersion?: string;
  modelVersion?: string;
  filterOutcome?: AiFilterOutcome;
  selectedBlockIds?: string[];
  stopReason?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  persistenceOutcome?: AiPersistenceOutcome;
}

export type AiOperationSink = (metadata: Readonly<AiOperationMetadata>) => void | Promise<void>;

const ALLOWED_KEYS = new Set<keyof AiOperationMetadata>([
  'requestId', 'postId', 'poolVersion', 'promptVersion', 'schemaVersion', 'modelVersion',
  'filterOutcome', 'selectedBlockIds', 'stopReason', 'inputTokens', 'outputTokens',
  'latencyMs', 'persistenceOutcome',
]);

function boundedString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 200) {
    throw new Error(`AI operation metadata ${field} is invalid`);
  }
  return value;
}

export async function recordAiOperationMetadata(
  candidate: AiOperationMetadata,
  sink?: AiOperationSink,
): Promise<void> {
  for (const key of Object.keys(candidate)) {
    if (!ALLOWED_KEYS.has(key as keyof AiOperationMetadata)) {
      throw new Error(`AI operation metadata field is not allowlisted: ${key}`);
    }
  }
  const safe: AiOperationMetadata = {
    requestId: boundedString(candidate.requestId, 'requestId'),
    postId: boundedString(candidate.postId, 'postId'),
  };
  for (const key of ['poolVersion', 'promptVersion', 'schemaVersion', 'modelVersion', 'stopReason'] as const) {
    if (candidate[key] !== undefined) safe[key] = boundedString(candidate[key], key);
  }
  if (candidate.filterOutcome !== undefined) {
    if (candidate.filterOutcome !== 'on-topic' && candidate.filterOutcome !== 'off-topic') throw new Error('AI operation metadata filterOutcome is invalid');
    safe.filterOutcome = candidate.filterOutcome;
  }
  if (candidate.persistenceOutcome !== undefined) {
    if (candidate.persistenceOutcome !== 'persisted' && candidate.persistenceOutcome !== 'not-persisted') throw new Error('AI operation metadata persistenceOutcome is invalid');
    safe.persistenceOutcome = candidate.persistenceOutcome;
  }
  if (candidate.selectedBlockIds !== undefined) {
    if (!Array.isArray(candidate.selectedBlockIds) || candidate.selectedBlockIds.length > 256) throw new Error('AI operation metadata selectedBlockIds is invalid');
    safe.selectedBlockIds = candidate.selectedBlockIds.map((id) => boundedString(id, 'selectedBlockIds'));
  }
  for (const key of ['inputTokens', 'outputTokens', 'latencyMs'] as const) {
    const value = candidate[key];
    if (value !== undefined) {
      if (!Number.isInteger(value) || value < 0) throw new Error(`AI operation metadata ${key} is invalid`);
      safe[key] = value;
    }
  }
  if (sink) await sink(Object.freeze(safe));
}

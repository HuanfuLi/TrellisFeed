export const TRACE_METADATA_KEYS = [
  'runId', 'requestId', 'candidateHash', 'postId', 'poolVersion', 'promptVersion',
  'schemaVersion', 'modelVersion', 'filterOutcome', 'selectedBlockIds', 'stopReason',
  'inputTokens', 'outputTokens', 'latencyMs', 'validationPaths', 'persistenceOutcome',
] as const;

export type TraceMetadataKey = typeof TRACE_METADATA_KEYS[number];

export interface TraceMetadata {
  runId?: string;
  requestId?: string;
  candidateHash?: string;
  postId?: string;
  poolVersion?: string;
  promptVersion?: string;
  schemaVersion?: string;
  modelVersion?: string;
  filterOutcome?: string;
  selectedBlockIds?: string[];
  stopReason?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  validationPaths?: string[];
  persistenceOutcome?: string;
}

export interface TraceEvent {
  stage: string;
  metadata: Readonly<TraceMetadata>;
}

export interface PipelineTracer {
  readonly enabled: boolean;
  record(stage: string, metadata: TraceMetadata): void;
}

export function allowlistedTraceMetadata(metadata: TraceMetadata): Readonly<TraceMetadata> {
  const clean: Record<string, unknown> = {};
  const input = metadata as Record<string, unknown>;
  for (const key of TRACE_METADATA_KEYS) {
    const value = input[key];
    if (value !== undefined) clean[key] = Array.isArray(value) ? [...value] : value;
  }
  return Object.freeze(clean) as Readonly<TraceMetadata>;
}

export function createPipelineTracer(options: {
  enabled?: boolean;
  sink?: (event: TraceEvent) => void;
} = {}): PipelineTracer {
  const enabled = options.enabled === true;
  if (enabled && !options.sink) throw new Error('An injected local trace sink is required when tracing is enabled');
  return {
    enabled,
    record(stage, metadata) {
      if (!enabled) return;
      options.sink?.({ stage, metadata: allowlistedTraceMetadata(metadata) });
    },
  };
}

export const disabledPipelineTracer = createPipelineTracer();

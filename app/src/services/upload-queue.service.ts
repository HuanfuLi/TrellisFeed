import { dbExecute, dbQuery } from './db.service.ts';
import {
  getPendingCount as getMetadataPendingCount,
  hydrateResearchMetadata,
  setLastSuccessfulUploadAt,
  setPendingCount,
} from './research-metadata.service.ts';
import { studyContextService } from './study-context.service.ts';
import {
  RESEARCH_AUTHORIZATION_HEADER,
  RESEARCH_INGEST_ROUTE,
  RESEARCH_WIRE_LIMITS,
  ResearchWireValidationError,
  researchWireByteLength,
  toResearchWireRecord,
  type ResearchWireRecord,
} from './research-wire-contract.ts';
import type { QuestionAnswerRecord, UserInteractionEvent } from '../types/index.ts';

type UploadRecord = UserInteractionEvent | QuestionAnswerRecord;
type QuarantineReason = 'malformed_envelope' | 'invalid_record' | 'oversized_record' | 'server_rejected';

interface QueueEnvelope {
  id: string;
  queuedAt: string;
  record: UploadRecord;
}

interface QueueRow extends Record<string, string | number | null> {
  id: string;
  data: string;
}

interface FlushOptions {
  apiBaseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

interface EnqueueOptions extends FlushOptions {
  triggerFlush?: boolean;
}

interface RetryWindowTarget {
  addEventListener(type: 'online', listener: () => void): void;
  removeEventListener(type: 'online', listener: () => void): void;
}

interface AppStateListenerHandle {
  remove(): void | Promise<void>;
}

interface RetryTriggerOptions {
  windowTarget?: RetryWindowTarget;
  addAppStateListener?: (
    listener: (state: { isActive: boolean }) => void,
  ) => Promise<AppStateListenerHandle>;
  flush?: () => Promise<unknown>;
}

interface PreparedEnvelope {
  envelope: QueueEnvelope;
  wireRecord: ResearchWireRecord;
}

type SendResult = 'progress' | 'stop';

let flushPromise: Promise<void> | null = null;
let quarantineCount = 0;
let workGeneration = 0;

function parseEnvelope(row: QueueRow): QueueEnvelope | null {
  try {
    const envelope = JSON.parse(row.data) as Partial<QueueEnvelope>;
    if (envelope.id !== row.id || typeof envelope.queuedAt !== 'string' ||
        !envelope.record || typeof envelope.record !== 'object') return null;
    return envelope as QueueEnvelope;
  } catch {
    return null;
  }
}

async function readQueueRows(): Promise<QueueRow[]> {
  return dbQuery<QueueRow>('SELECT * FROM research_upload_queue');
}

async function countQuarantine(): Promise<number> {
  quarantineCount = (await dbQuery<QueueRow>('SELECT * FROM research_upload_quarantine')).length;
  return quarantineCount;
}

async function updatePendingStatus(): Promise<void> {
  await setPendingCount((await readQueueRows()).length + await countQuarantine());
}

/** Preserve an undeliverable row locally using only a bounded reason code. */
export async function quarantineEnvelope(
  id: string,
  reason: QuarantineReason,
  recoverable: { envelope?: QueueEnvelope; raw?: string },
): Promise<void> {
  const entry = {
    id,
    reason,
    quarantinedAt: new Date().toISOString(),
    ...(recoverable.envelope ? { envelope: recoverable.envelope } : {}),
    ...(recoverable.raw ? { raw: recoverable.raw } : {}),
  };
  await dbExecute(
    'INSERT OR REPLACE INTO research_upload_quarantine (id, data) VALUES (?, ?)',
    [id, JSON.stringify(entry)],
  );
  await dbExecute('DELETE FROM research_upload_queue WHERE id = ?', [id]);
  await updatePendingStatus();
}

async function prepareQueue(): Promise<PreparedEnvelope[]> {
  const prepared: PreparedEnvelope[] = [];
  const rows = await readQueueRows();
  for (const row of rows) {
    const envelope = parseEnvelope(row);
    if (!envelope) {
      await quarantineEnvelope(row.id, 'malformed_envelope', { raw: row.data });
      continue;
    }
    try {
      prepared.push({ envelope, wireRecord: toResearchWireRecord(envelope.record) });
    } catch (error) {
      const reason = error instanceof ResearchWireValidationError ? error.reason : 'invalid_record';
      await quarantineEnvelope(envelope.id, reason, { envelope });
    }
  }
  return prepared.sort((left, right) =>
    left.envelope.queuedAt.localeCompare(right.envelope.queuedAt) ||
    left.envelope.id.localeCompare(right.envelope.id));
}

function selectBoundedBatch(envelopes: PreparedEnvelope[]): PreparedEnvelope[] {
  const selected: PreparedEnvelope[] = [];
  for (const envelope of envelopes) {
    if (selected.length >= RESEARCH_WIRE_LIMITS.maxRecords) break;
    const candidate = [...selected, envelope];
    const body = JSON.stringify({ records: candidate.map((item) => item.wireRecord) });
    if (researchWireByteLength(body) > RESEARCH_WIRE_LIMITS.maxRequestBytes) break;
    selected.push(envelope);
  }
  return selected;
}

async function resolveApiBaseUrl(explicit?: string): Promise<string> {
  if (explicit) return explicit.replace(/\/$/, '');
  const { researchConfig } = await import('./research-config.ts');
  return researchConfig.apiBaseUrl;
}

/** Persist a record before scheduling any best-effort network work. */
export async function enqueue(record: UploadRecord, options: EnqueueOptions = {}): Promise<void> {
  const envelope: QueueEnvelope = {
    id: record.id,
    queuedAt: new Date().toISOString(),
    record,
  };
  await dbExecute(
    'INSERT OR REPLACE INTO research_upload_queue (id, data) VALUES (?, ?)',
    [envelope.id, JSON.stringify(envelope)],
  );
  workGeneration += 1;
  await updatePendingStatus();

  if (options.triggerFlush !== false) {
    void flushPendingUploads(options).catch(() => {
      // Queue retention is the failure path; later enqueue/online/resume retries.
    });
  }
}

async function deleteAcknowledged(sent: PreparedEnvelope[], acknowledgedIds: Set<string>): Promise<number> {
  let deleted = 0;
  for (const id of acknowledgedIds) {
    const sentEnvelope = sent.find((item) => item.envelope.id === id)?.envelope;
    const currentRows = await dbQuery<QueueRow>(
      'SELECT * FROM research_upload_queue WHERE id = ?',
      [id],
    );
    const current = currentRows[0] ? parseEnvelope(currentRows[0]) : null;
    if (sentEnvelope && current && JSON.stringify(current) === JSON.stringify(sentEnvelope)) {
      await dbExecute('DELETE FROM research_upload_queue WHERE id = ?', [id]);
      deleted += 1;
    }
  }
  return deleted;
}

async function sendBatch(
  batch: PreparedEnvelope[],
  apiBaseUrl: string,
  fetchImpl: typeof globalThis.fetch,
  installToken: string,
): Promise<SendResult> {
  const response = await fetchImpl(`${apiBaseUrl}${RESEARCH_INGEST_ROUTE}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [RESEARCH_AUTHORIZATION_HEADER]: `Bearer ${installToken}`,
    },
    body: JSON.stringify({ records: batch.map((item) => item.wireRecord) }),
  });

  if (!response.ok) {
    if (![400, 409, 413, 422].includes(response.status)) return 'stop';
    if (batch.length === 1) {
      await quarantineEnvelope(batch[0].envelope.id, 'server_rejected', {
        envelope: batch[0].envelope,
      });
      return 'progress';
    }
    const midpoint = Math.floor(batch.length / 2);
    const left = await sendBatch(batch.slice(0, midpoint), apiBaseUrl, fetchImpl, installToken);
    if (left === 'stop') return 'stop';
    return sendBatch(batch.slice(midpoint), apiBaseUrl, fetchImpl, installToken);
  }

  let payload: { acknowledgedIds?: unknown };
  try {
    payload = await response.json() as { acknowledgedIds?: unknown };
  } catch {
    return 'stop';
  }
  if (!Array.isArray(payload.acknowledgedIds)) return 'stop';
  const batchIds = new Set(batch.map((item) => item.envelope.id));
  const acknowledgedIds = new Set(
    payload.acknowledgedIds.filter(
      (id): id is string => typeof id === 'string' && batchIds.has(id),
    ),
  );
  if (acknowledgedIds.size === 0) return 'stop';
  const deleted = await deleteAcknowledged(batch, acknowledgedIds);
  await updatePendingStatus();
  await setLastSuccessfulUploadAt(new Date().toISOString(), getMetadataPendingCount());
  // A newer revision may have replaced this exact queue key while the request
  // was in flight. Its ACK still proves network progress even though exact-
  // envelope deletion intentionally retained the replacement for the next pass.
  return deleted > 0 || acknowledgedIds.size > 0 ? 'progress' : 'stop';
}

async function runFlush(options: FlushOptions): Promise<void> {
  await hydrateResearchMetadata();
  try {
    const apiBaseUrl = await resolveApiBaseUrl(options.apiBaseUrl);
    const fetchImpl = options.fetch ?? globalThis.fetch;
    const installToken = studyContextService.getInstallToken();
    while (true) {
      const generationAtRead = workGeneration;
      const pending = await prepareQueue();
      await updatePendingStatus();
      const batch = selectBoundedBatch(pending);
      if (batch.length === 0) {
        if (generationAtRead !== workGeneration) continue;
        return;
      }
      const result = await sendBatch(batch, apiBaseUrl, fetchImpl, installToken);
      if (result === 'stop') return;
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  } catch {
    await updatePendingStatus();
    // Network/abort/config/token failures retain all active rows.
  }
}

/** Serialize upload attempts so concurrent triggers share one drain. */
export function flushPendingUploads(options: FlushOptions = {}): Promise<void> {
  if (flushPromise) return flushPromise;
  flushPromise = runFlush(options).finally(() => {
    flushPromise = null;
  });
  return flushPromise;
}

export function getPendingCount(): number {
  return getMetadataPendingCount();
}

export function getQuarantineCount(): number {
  return quarantineCount;
}

/** Register connectivity and native-resume retry signals. Returns an idempotent cleanup. */
export function registerRetryTriggers(options: RetryTriggerOptions = {}): () => void {
  const target = options.windowTarget ?? (typeof window !== 'undefined' ? window : undefined);
  const retry = () => {
    void (options.flush ?? flushPendingUploads)();
  };
  target?.addEventListener('online', retry);

  let disposed = false;
  let appHandle: AppStateListenerHandle | null = null;
  const onAppState = ({ isActive }: { isActive: boolean }) => {
    if (isActive) retry();
  };
  const listenerPromise = options.addAppStateListener
    ? options.addAppStateListener(onAppState)
    : import('@capacitor/app').then(({ App }) => App.addListener('appStateChange', onAppState));

  void listenerPromise.then((handle) => {
    appHandle = handle;
    if (disposed) void appHandle.remove();
  }).catch(() => {
    // Browser-only operation and unavailable native bridges still keep online retries.
  });

  return () => {
    if (disposed) return;
    disposed = true;
    target?.removeEventListener('online', retry);
    if (appHandle) void appHandle.remove();
  };
}

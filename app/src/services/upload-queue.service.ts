import { dbExecute, dbQuery } from './db.service.ts';
import {
  getPendingCount as getMetadataPendingCount,
  hydrateResearchMetadata,
  setLastSuccessfulUploadAt,
  setPendingCount,
} from './research-metadata.service.ts';
import type { QuestionAnswerRecord, UserInteractionEvent } from '../types/index.ts';

const MAX_BATCH_RECORDS = 100;
const MAX_BATCH_BYTES = 256 * 1024;

type UploadRecord = UserInteractionEvent | QuestionAnswerRecord;

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

let flushPromise: Promise<void> | null = null;

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function toIngestRecord(record: UploadRecord): UploadRecord | Omit<QuestionAnswerRecord, 'condition'> {
  if ('revision' in record) {
    // The durable research record retains its fixed condition. The deployed
    // ingest contract deliberately derives Q/A condition from study_accounts
    // and rejects that client field, so omit it only from the wire payload.
    const { condition: _condition, ...serverOwnedCondition } = record;
    return serverOwnedCondition;
  }
  return record;
}

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

async function readQueue(): Promise<QueueEnvelope[]> {
  const rows = await dbQuery<QueueRow>('SELECT * FROM research_upload_queue');
  return rows
    .map(parseEnvelope)
    .filter((value): value is QueueEnvelope => value !== null)
    .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt) || left.id.localeCompare(right.id));
}

function selectBoundedBatch(envelopes: QueueEnvelope[]): QueueEnvelope[] {
  const selected: QueueEnvelope[] = [];
  for (const envelope of envelopes) {
    if (selected.length >= MAX_BATCH_RECORDS) break;
    const candidate = [...selected, envelope];
    const body = JSON.stringify({ records: candidate.map((item) => toIngestRecord(item.record)) });
    if (byteLength(body) > MAX_BATCH_BYTES) break;
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
  const pending = (await readQueue()).length;
  await setPendingCount(pending);

  if (options.triggerFlush !== false) {
    void flushPendingUploads(options).catch(() => {
      // Queue retention is the failure path; later enqueue/online/resume retries.
    });
  }
}

async function runFlush(options: FlushOptions): Promise<void> {
  await hydrateResearchMetadata();
  const pending = await readQueue();
  await setPendingCount(pending.length);
  const batch = selectBoundedBatch(pending);
  if (batch.length === 0) return;

  try {
    const apiBaseUrl = await resolveApiBaseUrl(options.apiBaseUrl);
    const fetchImpl = options.fetch ?? globalThis.fetch;
    const response = await fetchImpl(`${apiBaseUrl}/v1/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ records: batch.map((item) => toIngestRecord(item.record)) }),
    });
    if (!response.ok) return;

    const payload = await response.json() as { acknowledgedIds?: unknown };
    if (!Array.isArray(payload.acknowledgedIds)) return;
    const batchIds = new Set(batch.map((item) => item.id));
    const acknowledgedIds = new Set(
      payload.acknowledgedIds.filter((id): id is string => typeof id === 'string' && batchIds.has(id)),
    );
    for (const id of acknowledgedIds) {
      // A Q/A revision may replace the same queue key while this request is in
      // flight. Only remove the exact envelope that was sent; a later revision
      // must remain queued for its own ACK.
      const sent = batch.find((item) => item.id === id);
      const currentRows = await dbQuery<QueueRow>(
        'SELECT * FROM research_upload_queue WHERE id = ?',
        [id],
      );
      const current = currentRows[0] ? parseEnvelope(currentRows[0]) : null;
      if (sent && current && JSON.stringify(current) === JSON.stringify(sent)) {
        await dbExecute('DELETE FROM research_upload_queue WHERE id = ?', [id]);
      }
    }

    const remaining = (await readQueue()).length;
    await setLastSuccessfulUploadAt(new Date().toISOString(), remaining);
  } catch {
    // At-least-once contract: network/abort/parse/config failures retain all rows.
  }
}

/** Serialize bounded upload attempts so concurrent triggers share one POST. */
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

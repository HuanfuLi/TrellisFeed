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
import type {
  QuestionAnswerRecord,
  RecommendationResearchRecord,
  UserInteractionEvent,
} from '../types/index.ts';

type UploadRecord = UserInteractionEvent | QuestionAnswerRecord | RecommendationResearchRecord;
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
  persistence?: FlushPersistence;
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
  setInterval?: typeof globalThis.setInterval;
  clearInterval?: typeof globalThis.clearInterval;
  retryIntervalMs?: number;
}

const DEFAULT_RETRY_INTERVAL_MS = 15_000;

interface PreparedEnvelope {
  envelope: QueueEnvelope;
  wireRecord: ResearchWireRecord;
}

interface DeliveryReceipt {
  revision: number;
  deliveredAt: string;
}

interface FlushPersistence {
  writeDeliveryReceipt?: (envelope: QueueEnvelope) => Promise<void>;
  deleteQueueEnvelope?: (id: string) => Promise<void>;
}

interface ResearchRecordRow extends Record<string, string | number | null> {
  id: string;
  kind: string;
  revision: number;
  data: string;
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

function recordRevision(record: UploadRecord): number {
  return 'revision' in record ? record.revision : 1;
}

function parseDeliveryReceipt(raw: string): DeliveryReceipt | null {
  try {
    const value = JSON.parse(raw) as Partial<DeliveryReceipt>;
    if (!Number.isSafeInteger(value.revision) || (value.revision ?? 0) < 1 ||
        typeof value.deliveredAt !== 'string' || Number.isNaN(Date.parse(value.deliveredAt))) {
      return null;
    }
    return value as DeliveryReceipt;
  } catch {
    return null;
  }
}

async function writeDeliveryReceipt(envelope: QueueEnvelope): Promise<void> {
  const id = `delivery:${envelope.id}`;
  const revision = recordRevision(envelope.record);
  const rows = await dbQuery<{ id: string; data: string }>(
    'SELECT * FROM research_metadata WHERE id = ?',
    [id],
  );
  const current = rows[0] ? parseDeliveryReceipt(rows[0].data) : null;
  if (current && current.revision >= revision) return;
  const receipt: DeliveryReceipt = { revision, deliveredAt: new Date().toISOString() };
  await dbExecute(
    'INSERT OR REPLACE INTO research_metadata (id, data) VALUES (?, ?)',
    [id, JSON.stringify(receipt)],
  );
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

async function deleteAcknowledged(
  sent: PreparedEnvelope[],
  acknowledgedIds: Set<string>,
  persistence: FlushPersistence,
): Promise<number> {
  let deleted = 0;
  for (const id of acknowledgedIds) {
    const sentEnvelope = sent.find((item) => item.envelope.id === id)?.envelope;
    if (!sentEnvelope) continue;
    // A trustworthy ACK becomes durable before any destructive queue change.
    await (persistence.writeDeliveryReceipt ?? writeDeliveryReceipt)(sentEnvelope);
    const currentRows = await dbQuery<QueueRow>(
      'SELECT * FROM research_upload_queue WHERE id = ?',
      [id],
    );
    const current = currentRows[0] ? parseEnvelope(currentRows[0]) : null;
    if (sentEnvelope && current && JSON.stringify(current) === JSON.stringify(sentEnvelope)) {
      await (persistence.deleteQueueEnvelope ?? ((queueId: string) =>
        dbExecute('DELETE FROM research_upload_queue WHERE id = ?', [queueId])))(id);
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
  persistence: FlushPersistence,
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
    const left = await sendBatch(batch.slice(0, midpoint), apiBaseUrl, fetchImpl, installToken, persistence);
    if (left === 'stop') return 'stop';
    return sendBatch(batch.slice(midpoint), apiBaseUrl, fetchImpl, installToken, persistence);
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
  const deleted = await deleteAcknowledged(batch, acknowledgedIds, persistence);
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
      const result = await sendBatch(
        batch,
        apiBaseUrl,
        fetchImpl,
        installToken,
        options.persistence ?? {},
      );
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

function parseResearchRecord(row: ResearchRecordRow): UploadRecord | null {
  try {
    const record = JSON.parse(row.data) as Partial<UploadRecord>;
    if (record.id !== row.id || row.revision !== recordRevision(record as UploadRecord)) return null;
    return record as UploadRecord;
  } catch {
    return null;
  }
}

function quarantineRevision(row: QueueRow | undefined): number | null {
  if (!row) return null;
  try {
    const value = JSON.parse(row.data) as { envelope?: { record?: UploadRecord } };
    return value.envelope?.record ? recordRevision(value.envelope.record) : null;
  } catch {
    return null;
  }
}

/**
 * Heal every cross-store crash window using durable records as source of truth.
 * Equal delivered/quarantined revisions stay terminal; newer durable revisions
 * replace stale queue/quarantine state and remain eligible for upload.
 */
export async function reconcileResearchOutbox(): Promise<void> {
  const [recordRows, queueRows, quarantineRows, metadataRows] = await Promise.all([
    dbQuery<ResearchRecordRow>('SELECT * FROM research_records'),
    readQueueRows(),
    dbQuery<QueueRow>('SELECT * FROM research_upload_quarantine'),
    dbQuery<{ id: string; data: string }>('SELECT * FROM research_metadata'),
  ]);
  const activeById = new Map(queueRows.map((row) => [row.id, parseEnvelope(row)]));
  const quarantineById = new Map(quarantineRows.map((row) => [row.id, row]));
  const receipts = new Map<string, DeliveryReceipt>();
  for (const row of metadataRows) {
    if (!row.id.startsWith('delivery:')) continue;
    const receipt = parseDeliveryReceipt(row.data);
    if (receipt) receipts.set(row.id.slice('delivery:'.length), receipt);
  }

  for (const row of recordRows) {
    const record = parseResearchRecord(row);
    if (!record) continue;
    const revision = recordRevision(record);
    const receipt = receipts.get(row.id);
    const active = activeById.get(row.id);
    const activeRevision = active ? recordRevision(active.record) : null;
    const quarantinedRevision = quarantineRevision(quarantineById.get(row.id));

    if (receipt && receipt.revision >= revision) {
      if (activeRevision !== null && activeRevision <= receipt.revision) {
        await dbExecute('DELETE FROM research_upload_queue WHERE id = ?', [row.id]);
      }
      continue;
    }
    if (quarantinedRevision !== null && quarantinedRevision >= revision) continue;
    if (activeRevision !== null && activeRevision >= revision) continue;
    if (quarantinedRevision !== null && quarantinedRevision < revision) {
      await dbExecute('DELETE FROM research_upload_quarantine WHERE id = ?', [row.id]);
    }
    await enqueue(record, { triggerFlush: false });
  }
  await updatePendingStatus();
}

/** Register connectivity and native-resume retry signals. Returns an idempotent cleanup. */
export function registerRetryTriggers(options: RetryTriggerOptions = {}): () => void {
  const target = options.windowTarget ?? (typeof window !== 'undefined' ? window : undefined);
  const retry = () => {
    if (options.flush) {
      void options.flush();
      return;
    }
    void reconcileResearchOutbox()
      .then(() => flushPendingUploads())
      .catch(() => { /* durable rows remain recoverable for the next trigger */ });
  };
  target?.addEventListener('online', retry);
  // Android WebView can keep navigator.onLine=true when a cellular interface is
  // enabled but has no usable route. In that state restoring Wi-Fi emits no
  // `online` event, so a low-frequency timer is the final automatic retry signal.
  // Empty queues return locally without a network request, and flushes are
  // serialized, so the fallback is cheap and cannot create parallel uploads.
  const intervalHandle = (options.setInterval ?? globalThis.setInterval)(
    retry,
    options.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS,
  );

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
    (options.clearInterval ?? globalThis.clearInterval)(intervalHandle);
    if (appHandle) void appHandle.remove();
  };
}

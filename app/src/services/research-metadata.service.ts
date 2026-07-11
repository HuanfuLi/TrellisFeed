import { eventBus } from '../lib/event-bus.ts';
import { dbExecute, dbQuery } from './db.service.ts';

const UPLOAD_METADATA_ID = 'upload';

interface UploadMetadata {
  pending: number;
  lastSuccessfulUploadAt: string | null;
}

let metadata: UploadMetadata = {
  pending: 0,
  lastSuccessfulUploadAt: null,
};
let hydrationPromise: Promise<void> | null = null;
let hydrated = false;

function parseMetadata(raw: string): UploadMetadata | null {
  try {
    const value = JSON.parse(raw) as Partial<UploadMetadata>;
    if (!Number.isSafeInteger(value.pending) || (value.pending ?? -1) < 0) return null;
    if (value.lastSuccessfulUploadAt !== null &&
        (typeof value.lastSuccessfulUploadAt !== 'string' ||
          Number.isNaN(Date.parse(value.lastSuccessfulUploadAt)))) return null;
    return {
      pending: value.pending as number,
      lastSuccessfulUploadAt: value.lastSuccessfulUploadAt,
    };
  } catch {
    return null;
  }
}

/** Populate the synchronous upload-health mirror from its durable row once. */
export async function hydrateResearchMetadata(): Promise<void> {
  if (hydrated) return;
  if (hydrationPromise) return hydrationPromise;

  hydrationPromise = (async () => {
    const rows = await dbQuery<{ id: string; data: string }>(
      'SELECT * FROM research_metadata WHERE id = ?',
      [UPLOAD_METADATA_ID],
    );
    const durable = rows.length > 0 ? parseMetadata(rows[0].data) : null;
    if (durable) metadata = durable;
    hydrated = true;
  })();

  try {
    await hydrationPromise;
  } finally {
    hydrationPromise = null;
  }
}

async function persist(next: UploadMetadata): Promise<void> {
  metadata = next;
  await dbExecute(
    'INSERT OR REPLACE INTO research_metadata (id, data) VALUES (?, ?)',
    [UPLOAD_METADATA_ID, JSON.stringify(next)],
  );
  eventBus.emit({
    type: 'UPLOAD_STATUS_CHANGED',
    payload: { pending: next.pending, lastSuccessAt: next.lastSuccessfulUploadAt },
  });
}

/** Update the durable pending count without changing the last ACK time. */
export async function setPendingCount(pending: number): Promise<void> {
  await hydrateResearchMetadata();
  await persist({ ...metadata, pending: Math.max(0, Math.trunc(pending)) });
}

/** Record a server ACK while atomically publishing the resulting pending count. */
export async function setLastSuccessfulUploadAt(
  lastSuccessfulUploadAt: string,
  pending = metadata.pending,
): Promise<void> {
  await hydrateResearchMetadata();
  await persist({ pending: Math.max(0, Math.trunc(pending)), lastSuccessfulUploadAt });
}

/** Synchronous read for always-mounted diagnostics after boot hydration/update. */
export function getLastSuccessfulUploadAt(): string | null {
  return metadata.lastSuccessfulUploadAt;
}

/** Synchronous read for always-mounted diagnostics after boot hydration/update. */
export function getPendingCount(): number {
  return metadata.pending;
}


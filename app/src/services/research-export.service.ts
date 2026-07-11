import { dbQuery } from './db.service.ts';
import type { Row } from './db.service.ts';
import { studyContextService } from './study-context.service.ts';

interface ResearchRecordRow extends Row {
  id: string;
  kind: string;
  revision: number;
  data: string;
}

interface LocalRecoveryExport {
  format: 'questiontrace-local-recovery-v1';
  exportedAt: string;
  userId: string;
  records: unknown[];
}

/** Build a recovery copy from this installation's bound participant records. */
export async function exportLocalRecoveryBlob(): Promise<Blob> {
  const { userId } = studyContextService.getRequired();
  const rows = await dbQuery<ResearchRecordRow>('SELECT * FROM research_records');
  const records = rows.flatMap((row) => {
    try {
      const record = JSON.parse(row.data) as { userId?: unknown };
      return record.userId === userId ? [record] : [];
    } catch {
      return [];
    }
  });

  const recovery: LocalRecoveryExport = {
    format: 'questiontrace-local-recovery-v1',
    exportedAt: new Date().toISOString(),
    userId,
    records,
  };

  return new Blob([JSON.stringify(recovery, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
}

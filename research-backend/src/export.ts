import { strToU8, zipSync } from 'fflate';

export const EVENT_COLUMNS = [
  'id',
  'user_id',
  'condition',
  'topic_id',
  'timestamp',
  'event_type',
  'post_id',
  'question_id',
  'recommendation_id',
  'duration_ms',
  'received_at',
];

export const QUESTION_ANSWER_COLUMNS = [
  'id',
  'revision',
  'user_id',
  'condition',
  'topic_id',
  'post_id',
  'question_id',
  'question_text',
  'question_source',
  'submitted_at',
  'answer_text',
  'answer_viewed_at',
  'received_at',
];

/** Escape a value for a spreadsheet-safe RFC 4180-style CSV cell. */
export function escapeCsvCell(value: unknown) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[\x00-\x20]*[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]) {
  const lines = [columns.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => escapeCsvCell(row[column])).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

export function buildExportZip(
  events: Record<string, unknown>[],
  questionAnswers: Record<string, unknown>[],
) {
  return zipSync({
    'behavioral-events.csv': strToU8(toCsv(events, EVENT_COLUMNS)),
    'question-answer-records.csv': strToU8(toCsv(questionAnswers, QUESTION_ANSWER_COLUMNS)),
  });
}

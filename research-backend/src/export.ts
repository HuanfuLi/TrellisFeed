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
  'answer_id',
  'question_text',
  'question_source',
  'suggested_question_id',
  'question_created_at',
  'answer_text',
  'answer_created_at',
  'model_name',
  'cited_post_ids',
  'cited_source_urls',
  'concept_ids',
  'claim_ids',
  'extracted_concept_ids',
  'extracted_claim_ids',
  'question_type',
  'unresolved',
  'received_at',
];

export const RECOMMENDATION_COLUMNS = [
  'id',
  'user_id',
  'condition',
  'topic_id',
  'session_id',
  'batch_id',
  'batch_seq',
  'batch_position',
  'post_id',
  'generated_at',
  'served_at',
  'strategy',
  'score',
  'reason_text',
  'contributing_question_ids',
  'contributing_concept_ids',
  'contributing_post_ids',
  'component_scores',
  'received_at',
];

export const PARTICIPANT_COLUMNS = [
  'user_id',
  'condition',
  'topic_id',
  'enrolled_at',
  'first_activity_at',
  'last_activity_at',
  'last_received_at',
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
  recommendations: Record<string, unknown>[],
  participants: Record<string, unknown>[],
) {
  return zipSync({
    'behavioral-events.csv': strToU8(toCsv(events, EVENT_COLUMNS)),
    'question-answer-records.csv': strToU8(toCsv(questionAnswers, QUESTION_ANSWER_COLUMNS)),
    'recommendations.csv': strToU8(toCsv(recommendations, RECOMMENDATION_COLUMNS)),
    'participants.csv': strToU8(toCsv(participants, PARTICIPANT_COLUMNS)),
  });
}

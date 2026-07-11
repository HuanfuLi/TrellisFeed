ALTER TABLE question_answer_records ADD COLUMN answer_id TEXT;
ALTER TABLE question_answer_records ADD COLUMN suggested_question_id TEXT;
ALTER TABLE question_answer_records ADD COLUMN question_created_at TEXT;
ALTER TABLE question_answer_records ADD COLUMN answer_created_at TEXT;
ALTER TABLE question_answer_records ADD COLUMN model_name TEXT;
ALTER TABLE question_answer_records ADD COLUMN cited_post_ids TEXT;
ALTER TABLE question_answer_records ADD COLUMN cited_source_urls TEXT;
ALTER TABLE question_answer_records ADD COLUMN concept_ids TEXT;
ALTER TABLE question_answer_records ADD COLUMN claim_ids TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_question_answer_records_question_id
  ON question_answer_records(question_id);

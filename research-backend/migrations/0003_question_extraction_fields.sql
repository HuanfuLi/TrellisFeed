ALTER TABLE question_answer_records ADD COLUMN extracted_concept_ids TEXT;
ALTER TABLE question_answer_records ADD COLUMN extracted_claim_ids TEXT;
ALTER TABLE question_answer_records ADD COLUMN question_type TEXT;
ALTER TABLE question_answer_records ADD COLUMN unresolved INTEGER;

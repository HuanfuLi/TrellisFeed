CREATE TABLE IF NOT EXISTS study_accounts (
  user_id TEXT PRIMARY KEY,
  condition TEXT NOT NULL CHECK (condition IN ('control', 'experimental')),
  topic_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS behavioral_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('control', 'experimental')),
  topic_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  event_type TEXT NOT NULL,
  post_id TEXT,
  question_id TEXT,
  recommendation_id TEXT,
  duration_ms INTEGER,
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS question_answer_records (
  id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('control', 'experimental')),
  topic_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  question_text TEXT NOT NULL,
  question_source TEXT NOT NULL CHECK (question_source IN ('typed', 'suggested_question')),
  submitted_at TEXT NOT NULL,
  answer_text TEXT,
  answer_viewed_at TEXT,
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS upload_receipts (
  envelope_id TEXT PRIMARY KEY,
  received_at TEXT NOT NULL
);

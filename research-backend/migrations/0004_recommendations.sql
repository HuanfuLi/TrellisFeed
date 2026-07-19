CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('control', 'experimental')),
  topic_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  batch_seq INTEGER NOT NULL CHECK (batch_seq > 0),
  batch_position INTEGER NOT NULL CHECK (batch_position > 0),
  post_id TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  strategy TEXT NOT NULL CHECK (strategy IN ('topic_baseline', 'quality_baseline', 'diversity_baseline', 'continue', 'deepen', 'contrast', 'bridge', 'echo')),
  score REAL NOT NULL,
  reason_text TEXT NOT NULL,
  contributing_question_ids TEXT,
  contributing_concept_ids TEXT,
  contributing_post_ids TEXT,
  component_scores TEXT,
  received_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS recommendations_session_order
  ON recommendations(user_id, session_id, batch_seq, batch_position);

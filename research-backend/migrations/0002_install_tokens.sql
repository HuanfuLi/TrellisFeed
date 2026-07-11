CREATE TABLE IF NOT EXISTS research_installations (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES study_accounts(user_id),
  created_at TEXT NOT NULL,
  rotated_at TEXT,
  revoked_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_installation_per_account
  ON research_installations(user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS research_installations_account
  ON research_installations(user_id);

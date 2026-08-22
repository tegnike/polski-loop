ALTER TABLE pl_study_sessions ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pl_sessions_idempotency
  ON pl_study_sessions(profile_id, idempotency_key);

ALTER TABLE pl_voice_attempts ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'self_report';
ALTER TABLE pl_voice_attempts ADD COLUMN external_result_id TEXT;
ALTER TABLE pl_voice_attempts ADD COLUMN schema_version TEXT;
ALTER TABLE pl_voice_attempts ADD COLUMN evaluated_at TEXT;
ALTER TABLE pl_voice_attempts ADD COLUMN overall_score REAL;
ALTER TABLE pl_voice_attempts ADD COLUMN scores_json TEXT;
ALTER TABLE pl_voice_attempts ADD COLUMN feedback_json TEXT;
ALTER TABLE pl_voice_attempts ADD COLUMN raw_result_json TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pl_voice_attempts_profile_external_result
  ON pl_voice_attempts(profile_id, external_result_id)
  WHERE external_result_id IS NOT NULL;

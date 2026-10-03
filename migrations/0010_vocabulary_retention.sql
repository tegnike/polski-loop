PRAGMA foreign_keys = ON;

-- Objective recall is separate from card self-assessment and legacy lesson accuracy.
CREATE TABLE pl_vocabulary_retention_states (
  profile_id TEXT NOT NULL REFERENCES pl_profiles(id),
  item_id TEXT NOT NULL REFERENCES pl_vocabulary_details(item_id),
  stage INTEGER NOT NULL CHECK (stage BETWEEN 0 AND 3),
  next_test_at TEXT NOT NULL,
  last_test_at TEXT NOT NULL,
  last_correct INTEGER NOT NULL CHECK (last_correct IN (0, 1)),
  last_gap_days REAL NOT NULL CHECK (last_gap_days >= 0),
  total_attempts INTEGER NOT NULL CHECK (total_attempts > 0),
  revision INTEGER NOT NULL CHECK (revision > 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, item_id)
);

CREATE TABLE pl_vocabulary_test_starts (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES pl_profiles(id),
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('due', 'practice')),
  created_at TEXT NOT NULL,
  UNIQUE (profile_id, idempotency_key)
);

CREATE TABLE pl_vocabulary_test_challenges (
  id TEXT PRIMARY KEY,
  start_id TEXT NOT NULL REFERENCES pl_vocabulary_test_starts(id),
  profile_id TEXT NOT NULL REFERENCES pl_profiles(id),
  item_id TEXT NOT NULL REFERENCES pl_vocabulary_details(item_id),
  position INTEGER NOT NULL,
  prompt_ja TEXT NOT NULL,
  correct_polish TEXT NOT NULL,
  accepted_answers_json TEXT NOT NULL,
  stage_before INTEGER NOT NULL CHECK (stage_before BETWEEN 0 AND 3),
  required_days INTEGER NOT NULL,
  due_at TEXT NOT NULL,
  baseline_at TEXT NOT NULL,
  self_review_updated_at TEXT NOT NULL,
  retention_revision INTEGER NOT NULL,
  eligible_for_retention INTEGER NOT NULL CHECK (eligible_for_retention IN (0, 1)),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  UNIQUE (start_id, item_id)
);

CREATE TABLE pl_vocabulary_test_attempts (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES pl_profiles(id),
  item_id TEXT NOT NULL REFERENCES pl_vocabulary_details(item_id),
  question_id TEXT NOT NULL UNIQUE REFERENCES pl_vocabulary_test_challenges(id),
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  answer TEXT NOT NULL,
  correct_polish TEXT NOT NULL,
  prompt_ja TEXT NOT NULL,
  accepted_answers_json TEXT NOT NULL,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  elapsed_ms INTEGER NOT NULL CHECK (elapsed_ms >= 0),
  tested_at TEXT NOT NULL,
  baseline_at TEXT NOT NULL,
  gap_days REAL NOT NULL CHECK (gap_days >= 0),
  required_days INTEGER NOT NULL,
  counts_for_retention INTEGER NOT NULL CHECK (counts_for_retention IN (0, 1)),
  stage_before INTEGER NOT NULL CHECK (stage_before BETWEEN 0 AND 3),
  stage_after INTEGER NOT NULL CHECK (stage_after BETWEEN 0 AND 3),
  next_test_at TEXT NOT NULL,
  UNIQUE (profile_id, idempotency_key)
);

CREATE INDEX idx_pl_vocabulary_retention_due ON pl_vocabulary_retention_states(profile_id, next_test_at);
CREATE INDEX idx_pl_vocabulary_test_challenges_profile ON pl_vocabulary_test_challenges(profile_id, start_id);
CREATE INDEX idx_pl_vocabulary_test_attempts_word ON pl_vocabulary_test_attempts(profile_id, item_id, tested_at DESC);

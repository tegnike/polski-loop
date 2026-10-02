PRAGMA foreign_keys = ON;

CREATE TABLE pl_vocabulary_details (
  item_id TEXT PRIMARY KEY REFERENCES pl_learning_items(id),
  example_pl TEXT NOT NULL DEFAULT '',
  example_ja TEXT NOT NULL DEFAULT '',
  owner_profile_id TEXT REFERENCES pl_profiles(id),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE pl_vocabulary_states (
  profile_id TEXT NOT NULL REFERENCES pl_profiles(id),
  item_id TEXT NOT NULL REFERENCES pl_vocabulary_details(item_id),
  due_at TEXT NOT NULL,
  interval_days REAL NOT NULL CHECK (interval_days >= 0),
  repetitions INTEGER NOT NULL DEFAULT 0 CHECK (repetitions >= 0),
  lapses INTEGER NOT NULL DEFAULT 0 CHECK (lapses >= 0),
  last_rating TEXT NOT NULL CHECK (last_rating IN ('again', 'known')),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, item_id)
);

CREATE TABLE pl_vocabulary_reviews (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES pl_profiles(id),
  item_id TEXT NOT NULL REFERENCES pl_vocabulary_details(item_id),
  idempotency_key TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('again', 'known')),
  elapsed_ms INTEGER NOT NULL DEFAULT 0 CHECK (elapsed_ms >= 0),
  created_at TEXT NOT NULL,
  due_at TEXT NOT NULL,
  UNIQUE (profile_id, idempotency_key)
);

-- Addition retries must still resolve to the same word after duplicate detection.
CREATE TABLE pl_vocabulary_word_requests (
  profile_id TEXT NOT NULL REFERENCES pl_profiles(id),
  idempotency_key TEXT NOT NULL,
  item_id TEXT NOT NULL REFERENCES pl_vocabulary_details(item_id),
  request_fingerprint TEXT NOT NULL,
  PRIMARY KEY (profile_id, idempotency_key)
);

CREATE INDEX idx_pl_vocabulary_order ON pl_vocabulary_details(owner_profile_id, sort_order, item_id);
CREATE INDEX idx_pl_vocabulary_due ON pl_vocabulary_states(profile_id, due_at);
CREATE INDEX idx_pl_vocabulary_reviews_created ON pl_vocabulary_reviews(profile_id, created_at DESC);

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS pl_profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  ui_language TEXT NOT NULL DEFAULT 'ja',
  study_timezone TEXT NOT NULL DEFAULT 'Europe/Warsaw',
  daily_new_limit INTEGER NOT NULL DEFAULT 5,
  daily_review_limit INTEGER NOT NULL DEFAULT 15,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pl_tracks (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  cefr TEXT NOT NULL,
  content_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'retired')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pl_units (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES pl_tracks(id),
  unit_number INTEGER NOT NULL,
  title_ja TEXT NOT NULL,
  title_pl TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'retired')),
  UNIQUE(track_id, unit_number)
);

CREATE TABLE IF NOT EXISTS pl_lessons (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES pl_units(id),
  lesson_number INTEGER NOT NULL,
  title_ja TEXT NOT NULL,
  title_pl TEXT NOT NULL,
  description TEXT NOT NULL,
  estimated_minutes INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'retired')),
  UNIQUE(unit_id, lesson_number)
);

CREATE TABLE IF NOT EXISTS pl_learning_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('word', 'phrase', 'sentence', 'grammar')),
  polish TEXT NOT NULL,
  meaning_ja TEXT NOT NULL,
  meaning_en TEXT NOT NULL,
  grammar_note TEXT NOT NULL,
  topic TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  accepted_answers_json TEXT NOT NULL,
  content_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'validated', 'published', 'retired')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pl_lesson_steps (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES pl_lessons(id),
  step_number INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('input', 'choice')),
  item_id TEXT NOT NULL REFERENCES pl_learning_items(id),
  prompt_ja TEXT NOT NULL,
  explanation TEXT NOT NULL,
  options_json TEXT,
  UNIQUE(lesson_id, step_number)
);

CREATE TABLE IF NOT EXISTS pl_study_sessions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES pl_profiles(id),
  lesson_id TEXT REFERENCES pl_lessons(id),
  mode TEXT NOT NULL CHECK (mode IN ('lesson', 'review')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pl_attempts (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  profile_id TEXT NOT NULL REFERENCES pl_profiles(id),
  session_id TEXT REFERENCES pl_study_sessions(id),
  lesson_id TEXT REFERENCES pl_lessons(id),
  item_id TEXT NOT NULL REFERENCES pl_learning_items(id),
  answer TEXT NOT NULL,
  expected_answer TEXT NOT NULL,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  verdict TEXT NOT NULL CHECK (verdict IN ('correct', 'diacritic_missing', 'incorrect')),
  rating TEXT CHECK (rating IN ('again', 'hard', 'good', 'easy')),
  elapsed_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pl_review_states (
  profile_id TEXT NOT NULL REFERENCES pl_profiles(id),
  item_id TEXT NOT NULL REFERENCES pl_learning_items(id),
  due_at TEXT NOT NULL,
  interval_days REAL NOT NULL DEFAULT 0,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  repetitions INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  last_rating TEXT CHECK (last_rating IN ('again', 'hard', 'good', 'easy')),
  last_attempt_at TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'learning', 'mastered', 'difficult')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, item_id)
);

CREATE TABLE IF NOT EXISTS pl_content_versions (
  version TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES pl_tracks(id),
  status TEXT NOT NULL CHECK (status IN ('draft', 'validated', 'published', 'retired')),
  notes TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pl_chatgpt_prompts (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES pl_profiles(id),
  topic TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  copied_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pl_lessons_unit_order ON pl_lessons(unit_id, lesson_number);
CREATE INDEX IF NOT EXISTS idx_pl_steps_lesson_order ON pl_lesson_steps(lesson_id, step_number);
CREATE INDEX IF NOT EXISTS idx_pl_attempts_profile_created ON pl_attempts(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pl_attempts_item ON pl_attempts(profile_id, item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pl_reviews_due ON pl_review_states(profile_id, due_at);
CREATE INDEX IF NOT EXISTS idx_pl_items_topic ON pl_learning_items(topic);

INSERT OR IGNORE INTO pl_profiles (id, display_name, ui_language, study_timezone, daily_new_limit, daily_review_limit, created_at, updated_at)
VALUES ('master', 'マスター', 'ja', 'Europe/Warsaw', 5, 15, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT OR IGNORE INTO pl_tracks (id, code, title, cefr, content_version, status, created_at)
VALUES ('track-a1', 'A1', 'Polski Loop A1', 'A1', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT OR IGNORE INTO pl_content_versions (version, track_id, status, notes, created_at)
VALUES ('a1-2026.1', 'track-a1', 'published', '独自作成のA1 Unit 1教材。公開前の基本チェック済み。', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT OR IGNORE INTO pl_units (id, track_id, unit_number, title_ja, title_pl, description, status)
VALUES ('a1-unit-1', 'track-a1', 1, '最初の会話', 'Pierwsza rozmowa', '挨拶、自己紹介、聞き返し、綴りを使って、短い会話の入口を作ります。', 'published');

INSERT OR IGNORE INTO pl_lessons (id, unit_id, lesson_number, title_ja, title_pl, description, estimated_minutes, status) VALUES
('a1-u1-l1', 'a1-unit-1', 1, 'まずは挨拶', 'Powitania', '場面に合った挨拶と、はじめましての一言を練習します。', 5, 'published'),
('a1-u1-l2', 'a1-unit-1', 2, '名前と出身', 'Imię i pochodzenie', '名前、出身、住んでいる場所を伝えます。', 5, 'published'),
('a1-u1-l3', 'a1-unit-1', 3, '聞き返す', 'Prośba o powtórzenie', '分からないときに、会話を止めずに聞き返します。', 5, 'published'),
('a1-u1-l4', 'a1-unit-1', 4, '綴りを確認する', 'Literowanie', '名前や単語の綴りを確認する表現を練習します。', 5, 'published'),
('a1-u1-l5', 'a1-unit-1', 5, '自分のことを話す', 'Kilka słów o sobie', '年齢、学習、言語について短く話します。', 5, 'published'),
('a1-u1-l6', 'a1-unit-1', 6, 'Unit 1 総復習', 'Powtórka', 'Unit 1で出会った表現を場面横断で復習します。', 6, 'published');

INSERT OR IGNORE INTO pl_learning_items (id, type, polish, meaning_ja, meaning_en, grammar_note, topic, tags_json, accepted_answers_json, content_version, status, created_at) VALUES
('a1-u1-i01', 'phrase', 'Cześć!', 'こんにちは／やあ！', 'Hi!', '親しい相手へのカジュアルな挨拶。', 'greeting', '["cefr:a1","topic:greeting","grammar:phrase"]', '["Cześć","Cześć!"]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('a1-u1-i02', 'phrase', 'Dzień dobry.', 'こんにちは（丁寧）', 'Good morning / good afternoon.', '時間帯を問わず、丁寧な挨拶に使える。', 'greeting', '["cefr:a1","topic:greeting","grammar:phrase"]', '["Dzień dobry","Dzień dobry."]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('a1-u1-i03', 'phrase', 'Mam na imię Anna.', '私の名前はアンナです。', 'My name is Anna.', 'mam na imię + 名前。自己紹介の定型表現。', 'introduction', '["cefr:a1","topic:introduction","grammar:phrase"]', '["Mam na imię Anna","Mam na imię Anna."]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('a1-u1-i04', 'sentence', 'Jestem z Japonii.', '私は日本出身です。', 'I am from Japan.', 'jestem z + 生まれた場所・国。zの後ろは属格。', 'introduction', '["cefr:a1","topic:introduction","grammar:genitive"]', '["Jestem z Japonii","Jestem z Japonii."]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('a1-u1-i05', 'phrase', 'Miło mi.', 'はじめまして／お会いできてうれしいです。', 'Nice to meet you.', '直訳は「私にとってうれしい」。短い定型表現。', 'introduction', '["cefr:a1","topic:introduction","grammar:phrase"]', '["Miło mi","Miło mi."]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('a1-u1-i06', 'sentence', 'Jak masz na imię?', 'お名前は何ですか？', 'What is your name?', '親しい相手への質問。丁寧形はJak ma Pan/Pani na imię?。', 'introduction', '["cefr:a1","topic:introduction","grammar:question"]', '["Jak masz na imię","Jak masz na imię?"]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('a1-u1-i07', 'sentence', 'Skąd jesteś?', 'どこの出身ですか？', 'Where are you from?', 'skąd = どこから。jesteśはbyćの2人称単数。', 'introduction', '["cefr:a1","topic:introduction","grammar:question"]', '["Skąd jesteś","Skąd jesteś?"]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('a1-u1-i08', 'sentence', 'Jestem z Polski.', '私はポーランド出身です。', 'I am from Poland.', '国名Polskaの属格がPolskiになる。', 'introduction', '["cefr:a1","topic:introduction","grammar:genitive"]', '["Jestem z Polski","Jestem z Polski."]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('a1-u1-i09', 'phrase', 'A ty?', 'あなたは？', 'And you?', '相手にも同じ質問を返す短い表現。', 'introduction', '["cefr:a1","topic:introduction","grammar:phrase"]', '["A ty","A ty?"]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('a1-u1-i10', 'sentence', 'Nie rozumiem.', '分かりません。', 'I do not understand.', 'nie + 動詞で否定。会話を安全に続ける重要表現。', 'clarification', '["cefr:a1","topic:clarification","grammar:negation"]', '["Nie rozumiem","Nie rozumiem."]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('a1-u1-i11', 'sentence', 'Czy możesz powtórzyć?', 'もう一度言ってもらえますか？', 'Can you repeat?', 'czyで疑問文を作る。możeszは「できる」の2人称単数。', 'clarification', '["cefr:a1","topic:clarification","grammar:question"]', '["Czy możesz powtórzyć","Czy możesz powtórzyć?"]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('a1-u1-i12', 'sentence', 'Proszę mówić wolniej.', 'もう少しゆっくり話してください。', 'Please speak more slowly.', 'proszę + 不定形。丁寧な依頼に使う。', 'clarification', '["cefr:a1","topic:clarification","grammar:imperative"]', '["Proszę mówić wolniej","Proszę mówić wolniej."]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('a1-u1-i13', 'sentence', 'Co to znaczy?', 'これはどういう意味ですか？', 'What does this mean?', 'co to znaczy = これは何を意味するか。', 'clarification', '["cefr:a1","topic:clarification","grammar:question"]', '["Co to znaczy","Co to znaczy?"]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('a1-u1-i14', 'sentence', 'Jak to się pisze?', 'これはどう綴りますか？', 'How do you spell this?', 'jak się pisze = どのように書くか。再帰構文の入口。', 'spelling', '["cefr:a1","topic:spelling","grammar:question"]', '["Jak to się pisze","Jak to się pisze?"]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('a1-u1-i15', 'sentence', 'Czy możesz przeliterować?', '綴ってもらえますか？', 'Can you spell it?', 'przeliterować = 綴る。możesz + 不定形。', 'spelling', '["cefr:a1","topic:spelling","grammar:question"]', '["Czy możesz przeliterować","Czy możesz przeliterować?"]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('a1-u1-i16', 'phrase', 'Rozumiem.', '分かりました。', 'I understand.', 'rozumiećの1人称単数。', 'clarification', '["cefr:a1","topic:clarification","grammar:verb"]', '["Rozumiem","Rozumiem."]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('a1-u1-i17', 'sentence', 'Mam trzydzieści lat.', '私は30歳です。', 'I am thirty years old.', '年齢はmam + 数字 + latで表す。', 'about-me', '["cefr:a1","topic:about-me","grammar:accusative"]', '["Mam trzydzieści lat","Mam trzydzieści lat."]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('a1-u1-i18', 'sentence', 'Uczę się polskiego.', '私はポーランド語を勉強しています。', 'I am learning Polish.', 'uczyć się + 属格。polskiの属格がpolskiego。', 'about-me', '["cefr:a1","topic:about-me","grammar:genitive"]', '["Uczę się polskiego","Uczę się polskiego."]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('a1-u1-i19', 'sentence', 'Mówię trochę po polsku.', '私は少しポーランド語を話します。', 'I speak a little Polish.', 'mówić po + 言語で「〜語で話す」。', 'about-me', '["cefr:a1","topic:about-me","grammar:verb"]', '["Mówię trochę po polsku","Mówię trochę po polsku."]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('a1-u1-i20', 'sentence', 'Mieszkam w Polsce.', '私はポーランドに住んでいます。', 'I live in Poland.', 'mieszkać w + 場所。Polskaの前置詞格がPolsce。', 'about-me', '["cefr:a1","topic:about-me","grammar:locative"]', '["Mieszkam w Polsce","Mieszkam w Polsce."]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('a1-u1-i21', 'phrase', 'Miło cię poznać.', 'お会いできてうれしいです。', 'Nice to meet you.', 'poznaćは「知り合う」。cięは相手を示す代名詞。', 'introduction', '["cefr:a1","topic:introduction","grammar:phrase"]', '["Miło cię poznać","Miło cię poznać."]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('a1-u1-i22', 'phrase', 'Do widzenia!', 'さようなら！', 'Goodbye!', '丁寧な別れの挨拶。', 'farewell', '["cefr:a1","topic:farewell","grammar:phrase"]', '["Do widzenia","Do widzenia!"]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('a1-u1-i23', 'phrase', 'Dziękuję.', 'ありがとう。', 'Thank you.', '丁寧な感謝。', 'politeness', '["cefr:a1","topic:politeness","grammar:phrase"]', '["Dziękuję","Dziękuję."]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('a1-u1-i24', 'phrase', 'Przepraszam.', 'すみません／ごめんなさい。', 'Excuse me / I am sorry.', '呼びかけにも謝罪にも使える。', 'politeness', '["cefr:a1","topic:politeness","grammar:phrase"]', '["Przepraszam","Przepraszam."]', 'a1-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now'));

INSERT OR IGNORE INTO pl_lesson_steps (id, lesson_id, step_number, kind, item_id, prompt_ja, explanation, options_json) VALUES
('a1-u1-l1-s1', 'a1-u1-l1', 1, 'input', 'a1-u1-i01', '親しい人に「こんにちは！」と言ってみましょう。', 'Cześćは友人や親しい相手に使う、距離の近い挨拶です。', NULL),
('a1-u1-l1-s2', 'a1-u1-l1', 2, 'input', 'a1-u1-i02', '丁寧に「こんにちは」と挨拶しましょう。', 'Dzień dobryは店員、初対面、職場など幅広く使えます。', NULL),
('a1-u1-l1-s3', 'a1-u1-l1', 3, 'input', 'a1-u1-i03', '「私の名前はアンナです」と言ってみましょう。', 'Mam na imięの後ろに名前を置きます。', NULL),
('a1-u1-l1-s4', 'a1-u1-l1', 4, 'input', 'a1-u1-i04', '「私は日本出身です」と言ってみましょう。', '国名Japanではなく、ポーランド語のJaponiaを使います。zの後ろはJaponiiになります。', NULL),
('a1-u1-l1-s5', 'a1-u1-l1', 5, 'input', 'a1-u1-i05', '「はじめまして」と伝えましょう。', 'Miło miは短く自然な、自己紹介の締めの一言です。', NULL),
('a1-u1-l2-s1', 'a1-u1-l2', 1, 'input', 'a1-u1-i06', '相手に「お名前は何ですか？」と聞きましょう。', '親しい相手にはJak masz na imię?を使います。', NULL),
('a1-u1-l2-s2', 'a1-u1-l2', 2, 'input', 'a1-u1-i07', '「どこの出身ですか？」と聞きましょう。', 'Skądは「どこから」を表します。', NULL),
('a1-u1-l2-s3', 'a1-u1-l2', 3, 'input', 'a1-u1-i08', '「私はポーランド出身です」と答えましょう。', 'Polskaはzの後ろでPolskiになります。', NULL),
('a1-u1-l2-s4', 'a1-u1-l2', 4, 'input', 'a1-u1-i09', '相手にも「あなたは？」と聞き返しましょう。', 'A ty?は短く、会話を相手へ返す表現です。', NULL),
('a1-u1-l2-s5', 'a1-u1-l2', 5, 'input', 'a1-u1-i21', '「お会いできてうれしいです」と言いましょう。', 'Miło cię poznaćは初対面でよく使う一言です。', NULL),
('a1-u1-l3-s1', 'a1-u1-l3', 1, 'input', 'a1-u1-i10', '分からないことを「分かりません」と伝えましょう。', 'Nieを前に置くと否定になります。', NULL),
('a1-u1-l3-s2', 'a1-u1-l3', 2, 'input', 'a1-u1-i11', '「もう一度言ってもらえますか？」と聞きましょう。', 'Czyで質問を始め、powtórzyćで「繰り返す」を表します。', NULL),
('a1-u1-l3-s3', 'a1-u1-l3', 3, 'input', 'a1-u1-i12', '「もう少しゆっくり話してください」と頼みましょう。', 'Proszę + 不定形で、丁寧な依頼になります。', NULL),
('a1-u1-l3-s4', 'a1-u1-l3', 4, 'input', 'a1-u1-i13', '「これはどういう意味ですか？」と聞きましょう。', 'Co to znaczy?は単語の意味を確認する定番表現です。', NULL),
('a1-u1-l3-s5', 'a1-u1-l3', 5, 'input', 'a1-u1-i16', '理解できたら「分かりました」と言いましょう。', 'Rozumiemはrozumieć（理解する）の1人称単数です。', NULL),
('a1-u1-l4-s1', 'a1-u1-l4', 1, 'input', 'a1-u1-i14', '「これはどう綴りますか？」と聞きましょう。', 'Jak to się pisze?は名前や住所を確認するときにも便利です。', NULL),
('a1-u1-l4-s2', 'a1-u1-l4', 2, 'input', 'a1-u1-i15', '「綴ってもらえますか？」と頼みましょう。', 'przeliterowaćはアルファベットを一文字ずつ言うことです。', NULL),
('a1-u1-l4-s3', 'a1-u1-l4', 3, 'input', 'a1-u1-i16', '確認できたら「分かりました」と返しましょう。', '短い返答でも、会話の確認として十分に自然です。', NULL),
('a1-u1-l4-s4', 'a1-u1-l4', 4, 'input', 'a1-u1-i03', '名前をもう一度自己紹介しましょう。', '同じ表現を別の場面で使うことで思い出しやすくします。', NULL),
('a1-u1-l4-s5', 'a1-u1-l4', 5, 'input', 'a1-u1-i09', '相手に聞き返して会話を続けましょう。', 'A ty?は短いですが、次の発話を生み出す大切な表現です。', NULL),
('a1-u1-l5-s1', 'a1-u1-l5', 1, 'input', 'a1-u1-i17', '「私は30歳です」と言いましょう。', 'ポーランド語では年齢をmam（持っている）で表します。', NULL),
('a1-u1-l5-s2', 'a1-u1-l5', 2, 'input', 'a1-u1-i18', '「私はポーランド語を勉強しています」と言いましょう。', 'uczyć sięの後ろはpolskiegoになります。', NULL),
('a1-u1-l5-s3', 'a1-u1-l5', 3, 'input', 'a1-u1-i19', '「私は少しポーランド語を話します」と言いましょう。', 'po polskuは「ポーランド語で」という意味です。', NULL),
('a1-u1-l5-s4', 'a1-u1-l5', 4, 'input', 'a1-u1-i20', '「私はポーランドに住んでいます」と言いましょう。', 'wの後ろでPolskaはPolsceになります。', NULL),
('a1-u1-l5-s5', 'a1-u1-l5', 5, 'input', 'a1-u1-i21', '自己紹介の最後に「お会いできてうれしいです」と言いましょう。', '知っている表現を組み合わせると、短い自己紹介が完成します。', NULL),
('a1-u1-l6-s1', 'a1-u1-l6', 1, 'input', 'a1-u1-i22', '別れ際に「さようなら！」と言いましょう。', 'Do widzeniaは丁寧な別れの挨拶です。', NULL),
('a1-u1-l6-s2', 'a1-u1-l6', 2, 'input', 'a1-u1-i23', '感謝を「ありがとう」と伝えましょう。', 'Dziękujęは丁寧な「ありがとう」です。', NULL),
('a1-u1-l6-s3', 'a1-u1-l6', 3, 'input', 'a1-u1-i24', '人にぶつかったときなどに「すみません」と言いましょう。', 'Przepraszamは呼びかけと謝罪のどちらにも使えます。', NULL),
('a1-u1-l6-s4', 'a1-u1-l6', 4, 'input', 'a1-u1-i10', '困ったときの「分かりません」を思い出しましょう。', '分からないことを伝えるのも、会話を続けるための力です。', NULL),
('a1-u1-l6-s5', 'a1-u1-l6', 5, 'input', 'a1-u1-i02', '最後に丁寧な挨拶をもう一度言いましょう。', '最初と最後の挨拶を使い分けられれば、会話の入口と出口ができます。', NULL);

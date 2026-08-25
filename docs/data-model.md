# データモデル

## 教材

- `pl_tracks` / `pl_content_versions` — A1とA2のtrack・版・公開状態。
- `pl_units` / `pl_lessons` / `pl_lesson_steps` — Unit、lesson、段階問題。既存A1のIDは変更しない。
- `pl_learning_items` — `polish`、日本語、英語、accepted answers、grammar note、tags、CEFR、skills、situation（`scene`）、register、speaker gender、dialogue roleを保持。
- `pl_voice_missions` — lessonごとの場面、役割、必須item、相手表現、相手の振る舞い、終了条件、フィードバック形式。
- `pl_cando_items` — Unitごとに3つのCan-do。skillはlistening、spoken interaction、spoken production。

A2のlearner itemは男性話者想定、partner itemは典型的な質問・返答を表す。registerはformal/informal/neutralで、grammar noteにも同じ前提を明示する。

## 利用者履歴

- `pl_profiles` — 既存profileをforward migrationで保持。
- `pl_study_sessions` — lesson/reviewの開始・完了・所要時間。`idempotency_key`で開始の再送を吸収。
- `pl_attempts` — item、step、形式、方向、入力、正誤、verdict、所要時間、難易度前後。
- `pl_review_states` / `pl_review_events` — 次回日時、間隔、評価、難易度、評価イベント。
- `pl_voice_attempts` — missionに対する自己評価またはChatGPT採点結果。`source_kind`で`self_report`/`chatgpt_file`を分離し、外部`resultId`、schema version、5軸点、総合点、総評・長所・修正・次の練習、原本JSONを保存する。`idempotency_key`と`(profile_id, external_result_id)`で重複を防ぐ。
- `pl_cando_progress` — profileごとのCan-do状態、自己評価、証拠メモ。
- `pl_chatgpt_prompts` — ChatGPT Voice用promptファイルの保存履歴と任意のmission参照。

アプリ内AI会話にはtableを追加しない。画面コンテキストと会話履歴はブラウザ内の一時状態で、画面移動、次の問題、会話終了、再読み込み時に破棄する。各リクエストは同一セッションの全会話をWorkerへ送り、WorkerもD1へ保存しない。

全履歴画面では新しい保存用tableを増やさず、`pl_attempts`、`pl_study_sessions`、`pl_voice_attempts`をprofileで絞り、日時とIDをcursorにして読み取り専用の統合タイムラインへ変換する。元データの修正・削除は行わない。

## Migration境界

`0001`〜`0004`は既存A1の正本であり編集・削除しない。`0005_a2_missions_content.sql`がA2教材とmission/Can-do/Voice結果のschema・seedを追加し、`0006_fix_a2_item_situation.sql`がA2の`scene`値だけを補正する。どのmigrationも既存ID、session、attempt、reviewを削除しない。

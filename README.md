# Polski Loop

スマートフォン優先の個人用ポーランド語学習PWAです。既存A1をID・履歴ごと保持したまま、ポーランド在住者が軽い日常会話を目指す生活特化A2を追加しています。教材・回答・誤答・復習予定はローカルD1へ保存します。

会話、音声認識、発音採点、読み上げはアプリ内に実装しません。Polski LoopはChatGPT Voiceへ渡すrole-play missionを作り、ChatGPTが返す採点ファイルを記録します。

## 実装範囲

- 既存A1: 10 Units・60 lessons・132 published items・300 steps。既存ID、プロフィール、回答、復習、sessionをforward migrationで保持
- A2: 10 Units・60 lessons・360新規published items。合計20 Units・120 lessons・492 published items・1,140 steps
- A2各lessonは6つの新規表現を、双方向4択、cloze、unscramble、free_inputの認識→足場付き想起→自由想起へ配置。6表現すべてにstep参照あり
- 範囲: 自己紹介、家族、人間関係、趣味、天気、日付・時刻、日課、予定、過去、未来、希望、理由、好み、比較、買い物、飲食、交通、道案内、旅行、住居、近隣、仕事、電話、予約、荷物、銀行、支払い、役所、医療、薬局、故障、トラブル、緊急時
- 現在・過去・未来、否定、疑問、依頼・命令、modal、主格・対格・生格・造格・前置格・与格を会話表現で再利用。formal/informal、男性話者想定、learner/partnerをmetadataと注記に保存
- `again / hard / good / easy` と難易度0〜3の昇降。既存仕様どおり`again`/`hard`は1段階戻す
- 各lessonに役割、場面、必須表現、相手側表現、相手の振る舞い、難易度、終了条件、フィードバック形式を含むChatGPT Voice mission
- ChatGPT Voice共有は詳細版missionのUTF-8 `.txt`に統一。ホームとlessonで同じ内容・ファイル名を使い、冒頭でポーランド語学習者であることを明示
- mission末尾に5軸1〜5点の採点基準と`polski-loop.voice-result.v1` JSON仕様を含める。ChatGPTが生成した採点JSONはレッスン完了画面またはホームから読み込み、mission照合・入力検証・重複排除後にD1へ同期
- レッスン完了後は「ChatGPT採点ファイルを同期」「あとで同期」の2択。手動のVoice自己評価フォームは表示しない
- Unit単位のCan-do checklist。教材完了率、想起成績、ChatGPT Voice採点を分けて表示
- 今日、復習、辞書、進捗、A1/A2 Units、Can-do、mission、結果、履歴、検索、exportを375px幅のPWAで到達可能
- Cloudflare Worker + D1、ローカルAccessバイパス、設定時のAccess JWT検証境界、キーボード操作・focus・`aria-live`

調査根拠と採用理由は [docs/learning-method-research.md](docs/learning-method-research.md) に残しています。教材の版・Unit・lesson・問題形式・正答の整合性は `npm run content:validate` で自動検査します。

## 起動

Node.js 22以上を想定します。

```bash
cd /Users/user/WorkSpace/polish-learning-app
npm install
npm run db:migrate
npm run content:validate
npm run dev
```

ブラウザで [http://127.0.0.1:5173](http://127.0.0.1:5173) を開きます。`npm run dev` はVite（5173）とWrangler Worker + D1（8787）を同時に起動し、Viteの`/api`プロキシがWorkerへ接続します。

既存のローカルD1へmigrationを適用するだけで、既存のプロフィール、回答、復習状態、セッションを削除しません。`0001`〜`0006`はすべてforward migrationです。履歴を残したまま`.wrangler/state`を削除・リセットしないでください。

## 検証

```bash
npm test
npm run typecheck
npm run build
npm run content:validate
npm run api:smoke
```

`npm run content:validate` は教材JSON、A1/A2 step、4択正答、cloze/token、ID/参照、mission/Can-do参照、CEFR/register/situation、重複、published件数、ローカルD1実測を検査します。`npm run api:smoke` はA1回帰、A2 lesson/mission、session/attempt/Voice結果のidempotency、Can-do、JSON/CSV exportを検査します。

`master`へのpushはCloudflare Workers Buildsを起動し、`npm test`、typecheck、production buildが成功した場合だけ本番Workerを更新します。

## Cloudflare本番

本番は`production` environmentを使用し、EU jurisdictionの`polski-loop-prod` D1へ接続します。`https://polski-loop.o3nike-teg-14.workers.dev/`はCloudflare Accessで保護され、許可メールだけがログインできます。Worker APIも`REQUIRE_ACCESS_AUTH=true`でAccess JWTを検証します。

Cloudflare Workers BuildsはGitHubの`tegnike/polski-loop`と接続済みです。production branchは`master`、preview branch buildは無効です。

```text
Build command:  npm test && npm run typecheck && npm run build
Deploy command: npx wrangler deploy --env production
```

D1 migrationはpush時に自動適用しません。migrationを追加した場合は、既存データへの影響を確認してから`npm run db:migrate:remote`を明示的に実行します。手元から緊急デプロイする場合のみ`npm run deploy:production`を使用します。

Access applicationは`Polski Loop`、許可ポリシーは`Master only`です。未認証アクセスはAccessログインへリダイレクトされます。

## API

単語・表現の再生ボタンは、初回クリック時にPWA内のeSpeak NG（ポーランド語音声）でWAVを合成します。生成音声はブラウザのCache Storageへ保存され、同じ端末・ブラウザの次回再生では再合成せずに使い回します。音声モデルは初回利用時のみ遅延読み込みされます。ブラウザのサイトデータを消去すると、保存音声も削除されます。

| Method | Path | 用途 |
| --- | --- | --- |
| GET | `/api/v1/status?track=A1\|A2` | 選択trackのUnit別進捗、A1+A2総数、次のlesson、復習件数、おすすめ |
| GET | `/api/v1/lessons/:id` | lessonの段階stepとChatGPT Voice mission |
| GET | `/api/v1/missions?lessonId=:id` | `.txt`保存可能なVoice role-play mission |
| GET | `/api/v1/cando?unitId=:id` | Unit Can-do、教材完了、想起、Voice集計 |
| GET | `/api/v1/items` | ポーランド語・日本語・英語・タグ検索と状態表示 |
| GET | `/api/v1/reviews/due` | 期限到来項目と現在難易度に応じた問題形式 |
| GET | `/api/v1/mistakes` | 誤答の多い文法タグ・技能タグ |
| GET | `/api/v1/history` | 回答履歴、形式、方向、評価、難易度 |
| GET | `/api/v1/voice-results` | ChatGPT Voice採点履歴（旧自己評価データも読取可能） |
| GET | `/api/v1/sessions` | 学習セッション履歴 |
| GET | `/api/v1/export?format=json\|csv` | 利用者データの出力 |
| POST | `/api/v1/sessions` | idempotency key付きセッション開始 |
| POST | `/api/v1/attempts` | 問題形式を検証した回答判定・保存 |
| POST | `/api/v1/reviews/rate` | 復習評価、次回日時、難易度の更新 |
| POST | `/api/v1/voice-results` | 旧自己評価クライアント互換用（UIでは未使用） |
| POST | `/api/v1/cando` | Can-do状態・自己評価・証拠メモの保存 |
| POST | `/api/v1/prompts` | ChatGPT用プロンプトファイルの保存履歴 |
| POST | `/api/v1/voice-results/import` | ChatGPT採点JSONを検証して冪等同期 |
| POST | `/api/v1/items` | `draft`教材候補の登録 |
| POST | `/api/v1/content/import` | 版付き`draft`教材候補の投入 |

詳細は [docs/api.md](docs/api.md) を参照してください。

## データとmigration

```text
content/a1-curriculum.json          既存A1の構成と問題形式の正本
content/a1-a2-curriculum.json       A1+A2の公開構成、6表現、step、mission/Can-do参照
migrations/0001_initial.sql         初期schemaとUnit 1教材
migrations/0002_session_idempotency.sql
migrations/0003_staged_retrieval_a1_full.sql
migrations/0004_fix_u1_staged_step_metadata.sql
migrations/0005_a2_missions_content.sql  A2教材・mission・Can-do・結果schema
migrations/0006_fix_a2_item_situation.sql A2 situation metadata補正
worker/index.ts                     Worker API、判定、復習計算、Access境界
src/lib/learning.ts                 正規化、採点、難易度、間隔反復
src/                                React UI、API client、PWA表示
scripts/generate-a2-content.mjs    A2の版付きJSON/0005生成
scripts/validate-content.mjs        教材JSON・migration・ローカルD1検査
tests/                              学習ロジック・教材整合性テスト
docs/learning-method-research.md    調査根拠と採用理由
docs/api.md                         API契約とidempotency
docs/data-model.md                  D1の教材・履歴・Voice・Can-doモデル
docs/content-editing.md             教材編集・生成・検証手順
```

利用者データは`profile_id`へ紐づき、教材版は`content_version`で追跡します。回答・セッション・Voice結果の再送はidempotency keyで同じ記録へ戻し、`pl_review_events`に復習評価と難易度遷移を残します。会話と音声はChatGPT Voice、Polski Loopは教材と採点結果の同期を担当します。

## 外部に残る範囲

- Service Token、独自ドメイン
- ポーランド語話者による教材の追加スポットチェック

「完全」は公的CEFR認定ではなく、このリポジトリのローカル受入範囲を指します。

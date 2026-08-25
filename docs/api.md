# Polski Loop API

Base pathは`/api/v1`です。ローカルではWorkerが`127.0.0.1:8787`で応答し、Viteが同じpathをproxyします。利用者データは現在の`PROFILE_ID`（未設定時はローカルfallback）に紐づきます。

## Pronunciation

- `POST /pronunciations`
  - bodyは`{ text, speakerGender: "male"|"female"|"any" }`、本文は300文字以下。
  - Google Cloud Text-to-Speechの`pl-PL-Chirp3-HD-*`でMP3を合成する。
  - `male`または`female`では同じ性別の音声だけを使う。`any`では強い一人称語尾を補助判定し、それ以外は全音声へ分散する。
  - 同じ文字列と選択音声はCloudflare Cache APIとクライアントのCache Storageへ保存する。
  - responseは`audio/mpeg`。`x-polski-loop-voice`、`x-polski-loop-gender`、`x-polski-loop-cache`で選択音声とキャッシュ状態を返す。
  - APIキーはWorker Secretの`GOOGLE_TTS_API_KEY`だけに保存し、クライアントへ公開しない。

## Curriculum

- `GET /status?track=A1|A2`
  - 選択trackの`units`、`unit`、`nextLesson`、`nextMission`、学習進捗を返す。
  - `progress.dailyActivity`はprofileの学習timezoneで揃えた直近28日分。各日は完了セッション、lesson/review内訳、学習分数、回答・正答、Voice結果を持つ。
  - ホーム画面も`nextMission.promptText`を使い、lesson画面と同じ詳細版`.txt`だけを生成する。
  - `allUnits`、`tracks`、`curriculum`にはA1+A2の集計を返す。
  - `recommendations`は復習、次lesson、Voice mission、Can-doの次候補を返す。
- `GET /lessons/:lessonId`
  - `steps`をstep番号順に返す。各stepは問題形式、方向、options、tokens、cloze、item metadataを含む。
  - `mission`にはVoice role-playの全情報と`promptText`を含む。
- `GET /missions?lessonId=:lessonId` または `GET /missions?missionId=:missionId`
  - `.txt`ファイルとして保存可能なVoice missionと、各表現の読み上げ用話者性別を返す。音声会話・音声認識・発音採点はアプリ内では行わない。
- `GET /cando?unitId=:unitId`
  - Unitの3 Can-do、状態、自己評価、証拠メモ、教材完了、想起正答率、Voice自信度を返す。

## Learning and history

- `POST /sessions` — `{ mode, lessonId?, idempotencyKey }`
- `POST /attempts` — 問題形式に応じた回答を採点し、`attemptId`と難易度遷移を返す。
- `PATCH /sessions/:sessionId` — `{ completed: true, durationMs }`
- `POST /reviews/rate` — `again|hard|good|easy`を保存する。`again`と`hard`は難易度を1段階戻す。
- `POST /voice-results/import`
  - `polski-loop.voice-result.v1` JSONを受け取る。
  - `missionId`と`lessonId`、5つの1〜5点、会話証拠、総評、最大3件の長所、最大5件の修正、次の練習を検証する。
  - `resultId`を外部冪等キーとして同じファイルの再読込を重複保存しない。総合点はWorkerが5軸の平均から再計算する。
- `GET /timeline?type=attempt|session|voice&limit=25&cursor=...`
  - 回答、学習セッション、Voice結果を共通の`occurredAt`で新しい順に返す。`type`省略時は3種類を統合する。
  - responseは`{ items, nextCursor }`。`nextCursor`がある間だけ同じ`type`で続きを取得する。`limit`は1〜50。
  - 履歴画面は読み取り専用で、このAPIによる修正・削除は行わない。
- `GET /history`、`GET /mistakes`、`GET /reviews/due`、`GET /sessions` — 既存画面・クライアント互換の学習履歴と復習キュー。`/mistakes`はgrammar/skillタグを集計する。

## In-app AI conversation

- `POST /ai/chat` — `{ context: { key, label, content }, messages: [{ role, content }] }`
  - `context`は最初の質問時点の画面・問題情報。1セッション中は固定する。
  - `messages`は利用者から始まり、user/assistantが交互に並ぶセッション内の全会話。D1へ保存しない。
  - GPT-5.6 LunaのResponses APIを`reasoning.effort=medium`、`store=false`でWorkerから呼び出す。APIキーをブラウザへ返さない。
  - 最大40メッセージ、1メッセージ8,000文字、会話合計60,000文字。上限時は切り捨てず、新しい会話を案内する。

同じprofileで同じidempotency keyを再送した場合、sessionとattemptは既存IDを返します。ChatGPT採点ファイルは`resultId`の再送時に既存結果を返します。

## Voice result and Can-do

`POST /voice-results`は旧自己評価クライアントとの互換性のために残しており、現在のUIからは使用しません。body:

```json
{
  "missionId": "a2-u1-l1-mission",
  "sessionId": "optional-session-id",
  "idempotencyKey": "voice-unique-key",
  "heard": true,
  "replied": true,
  "askedBack": false,
  "needsRestatement": true,
  "confidence": 4,
  "notes": "一度言い換えてもらった"
}
```

`confidence`は1〜5、`notes`は2,000文字以内です。`GET /voice-results`で新しい順に取得できます。

`POST /cando`のbodyは`{ candoId, status, selfRating?, evidenceNotes? }`です。`status`は`not_started`、`practicing`、`self_assessed`、`evidenced`のいずれかです。

## Export

`GET /export?format=json|csv`はprofileに属するprofile、session、attempt、review、prompt、Voice結果、Can-do進捗を出力します。CSVには`record_type`、`mission_id`、`heard`、`replied`、`asked_back`、`needs_restatement`、`confidence`、`notes`を含みます。

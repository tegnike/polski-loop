# Polski Loop API

Base pathは`/api/v1`です。ローカルではWorkerが`127.0.0.1:8787`で応答し、Viteが同じpathをproxyします。利用者データは現在の`PROFILE_ID`（未設定時はローカルfallback）に紐づきます。

## Curriculum

- `GET /status?track=A1|A2`
  - 選択trackの`units`、`unit`、`nextLesson`、`nextMission`、学習進捗を返す。
  - ホーム画面も`nextMission.promptText`を使い、lesson画面と同じ詳細版`.txt`だけを生成する。
  - `allUnits`、`tracks`、`curriculum`にはA1+A2の集計を返す。
  - `recommendations`は復習、次lesson、Voice mission、Can-doの次候補を返す。
- `GET /lessons/:lessonId`
  - `steps`をstep番号順に返す。各stepは問題形式、方向、options、tokens、cloze、item metadataを含む。
  - `mission`にはVoice role-playの全情報と`promptText`を含む。
- `GET /missions?lessonId=:lessonId` または `GET /missions?missionId=:missionId`
  - `.txt`ファイルとして保存可能なVoice missionを返す。missionはアプリ内の音声処理を意味しない。
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
- `GET /history`、`GET /mistakes`、`GET /reviews/due`、`GET /sessions` — 学習履歴と復習キュー。`/mistakes`はgrammar/skillタグを集計する。

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

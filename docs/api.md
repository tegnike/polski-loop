# Polski Loop API

Base pathは`/api/v1`です。ローカルではWorkerが`127.0.0.1:8787`で応答し、Viteが同じpathをproxyします。利用者データは現在の`PROFILE_ID`（未設定時はローカルfallback）に紐づきます。

## Vocabulary

- `GET /vocabulary` — 全語数、学習済み・覚えた・期限到来の語数、今日の学習語数、場面別の進捗、今日と最近の自己評価、`progress`を返す。
- `GET /vocabulary/words?search=...&topic=...&state=new|learning|remembered&personal=true` — 共有の600語と現在のprofileの個人単語を絞り込む。
- `GET /vocabulary/queue?mode=learn|review&topic=...&wordId=...&limit=5` — 新規単語または期限到来の単語を返す。指定した単語からの練習も可能。
- `POST /vocabulary/reviews` — `{ wordId, rating: "again"|"known", idempotencyKey, elapsedMs }` を保存し、`{ eventId, word }` を返す。同じprofile・keyの再送は同じ結果を返し、異なる内容では409となる。
- `POST /vocabulary/words` — `{ polish, meaningJa, topic, examplePl?, exampleJa?, idempotencyKey }` から個人単語を作成する。同じkeyの再送と同じprofileの同一単語は重複登録しない。

カードの評価は正誤判定とは別の自己評価として保存する。`again`は15分後、`known`は初回1日後、以降は間隔を2.5倍（最大365日）にする。今日の集計はEurope/Warsaw基準。個人単語とその履歴は他のprofileへ公開しない。既存のlesson進捗・正答率・復習キューには単語カードの評価を加算しない。

`progress`は保存済みの単語カード履歴をEurope/Warsawの日付で集計する。`totalPoints`は全期間の「単語×日」の数で、同日の同じ単語の再評価には重複加点せず、翌日の復習には加点する。`level`は1から始まり、10ポイントごとに1上がる。`dailyGoal`は5語。`pointsIntoLevel`と`pointsToNextLevel`は次のレベルまでの進捗を示す。これらは学習量の指標で、自己評価による`remembered`とは別に返す。

`activity`は今日を含む28日分の`{ date, words, newWords, reviews }`を古い順で返し、学習しなかった日も0で埋める。`words`は同日に取り組んだ異なる単語数、`newWords`は全履歴で初めて学習した単語数、`reviews`はカード自己評価と入力テストの保存イベント数。テストも今日の目標と連続学習に含め、同じ単語は同日に重複して数えない。`currentStreak`は今日または昨日からの連続学習日数、`longestStreak`と`totalStudyDays`は全履歴から求める。未来のイベントは加算しない。

画面の主指標は`started / total`の重複しない学習済み単語数。週の新しい単語は7日分の`newWords`を合計し、グラフは日ごとに新規`newWords`と復習`words - newWords`を表示する。日をまたぐ復習を含む`words`の合計は延べ語数として表示する。レベル・ポイントのフィールドはAPI互換性のため保持するが、画面やAIの画面コンテキストには表示しない。

### 日を空けた確認テスト

- `POST /vocabulary/tests/start` — `{ mode: "due"|"practice", wordId?, limit?, idempotencyKey }` からサーバー発行の問題を返す。問題には日本語の意味と必要な間隔だけを含み、ポーランド語の正答・例文・許容解答は返さない。学習済みの、現在のprofileが閲覧できる単語だけが対象。
- `POST /vocabulary/tests/answer` — `{ questionId, answer, idempotencyKey, elapsedMs }` を保存してサーバーで採点する。空回答も不正解として記録し、採点後にのみ正答・許容解答を返す。同じ操作の再送は重複保存しない。
- `GET /vocabulary/tests/history?wordId=...` — 指定単語のテスト回答・正誤・実間隔・確認段階・次の予定を返す。他のprofileの個人単語は閲覧できない。

`GET /vocabulary` の `retention` は、期限到来数、テストを受けた語数、1日・3日・7日後の正答確認数、再確認の語数、単語別の現状、直近のテスト履歴を返す。`confirmed1/3/7`はそれぞれ対応する段階以上の語数で、3日後の確認済み語は1日後の確認数にも含む。既存の`remembered`はカードの自己評価のままで、テストによる確認とは区別する。

`retention.mastery` は「定着した単語」の累積記録。`total`はこれまでに7日後の確認段階へ達した異なる語数、`verified`は登録語のうち現在も段階3の語数、`recheck`は現在の段階が戻って再確認が必要な登録語数。`words`は単語別の確認状況に、最初に達成した時刻`firstMasteredAt`と`needsRecheck`を加えて返す。保存済みテスト履歴の`counts_for_retention = 1 AND stage_after = 3`を証拠に集計し、同じ語の再達成・30日後の再正解で重複登録しない。後の不正解でも初回登録日と累計には残る。現在のprofileが閲覧できる学習済み単語だけを対象にし、未来の履歴・自己評価・早い練習の正解は登録に使わない。追加のテーブルや履歴の書き換えは行わない。

確認段階は0（未確認）、1（1日後も正解）、2（3日後も正解）、3（7日後も正解）。前回の学習またはテストの正答表示から、次に必要な1日・3日・7日の間隔を空け、`due`モードの期限到来時の正答だけで段階が1つ進む。段階3の後は30日間隔で確認を続ける。1日は24時間としてサーバー時刻で判定する。不正解は段階0に戻り、翌日が次回の確認日になる。`practice`モードの正答では期限を問わず段階を進めず、正答を表示した時点から必要な間隔を取り直す。カードを直前に学習し直した場合も、そこから必要間隔を確保する。

問題の有効期限は60分。採点は単語帳のポーランド語と許容解答に照合し、NFKC、前後・連続空白、大小文字だけを正規化する。`ą`・`ł`などの文字差や綴りの誤りは正答にしない。確認段階や正誤、経過時間をクライアントの申告で変更できない。テスト履歴は専用テーブルに保存し、既存レッスンの正答率には加算せず、JSON/CSVエクスポートに含める。過去の自己評価をテストで確認済みに変換しない。

確認テストのUIはブラウザのポーランド語音声認識を主導線にし、手入力へも切り替えられる。音声認識の確定結果を表示し、利用者が確認ボタンを押した時点で従来の`answer` APIに保存する。録音停止後の確定結果を待ち、認識途中・聞き取り失敗・マイク権限エラーでは自動保存しない。音声認識が付加した末尾の句点・感嘆符・疑問符だけは入力側で除き、綴り・アクセント・語順の曖昧照合は行わない。

採点後の「何度でも発音練習」は、返却済みの`acceptedAnswers`と認識結果を画面内で比べる。テスト開始・回答・自己評価のAPIは呼ばず、確認段階・保存済み履歴・次の予定・日々の集計を変えない。練習回数は画面を離れると消える。音声認識による単語の一致は発音の精密な採点を意味しない。ブラウザの対応状況や認識サービスに依存し、音声入力はオフライン動作を保証しない。

## Pronunciation

- `POST /pronunciations`
  - bodyは`{ text, speakerGender: "male"|"female"|"any" }`、本文は300文字以下。
  - Google Cloud Text-to-Speechの`pl-PL-Chirp3-HD-*`でMP3を合成する。
  - `male`または`female`では同じ性別の音声だけを使う。`any`では強い一人称語尾を補助判定し、それ以外は全音声へ分散する。
  - 同じ文字列と選択音声はCloudflare Cache APIとクライアントのCache Storageへ保存する。
  - responseは`audio/mpeg`。`x-polski-loop-voice`、`x-polski-loop-gender`、`x-polski-loop-cache`で選択音声とキャッシュ状態を返す。
  - APIキーはWorker Secretの`GOOGLE_TTS_API_KEY`だけに保存し、クライアントへ公開しない。
  - macOSのVite開発環境でGoogleキー未設定の場合だけ、ローカルのZosia音声を`audio/wav`で返す。本番のWorker経路は変更しない。

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
  - GPT-5.6 LunaのResponses APIを`reasoning.effort=low`、`store=false`でWorkerから呼び出す。APIキーをブラウザへ返さない。
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

単語の共有教材・詳細、現在のprofileの個人単語・復習状態・自己評価履歴・登録の冪等記録も含めます。他のprofileの個人単語と履歴は含みません。

# 教材編集手順

## 生活単語を追加する場合

- 最初の80語は`content/vocabulary.json`、追加の520語は`content/vocabulary-expansion.json`に定義する。合計600語・8場面各75語。全てに日本語・英語の意味、品詞・文法注記、独自のポーランド語例文と日本語訳を付ける。
- 見出しは単独の語とし、動詞は不定形、形容詞は男性基本形を使う。既存IDや見出しを変更して学習記録との対応を切らない。名詞・動詞・形容詞・代名詞・数詞・疑問詞などを、日常の場面に合わせて選ぶ。公式の頻度上位600語リストや、全ての日常会話を網羅する語彙表ではない。
- `node scripts/generate-vocabulary.mjs --check`で全版をまたぐID・見出しの重複、空欄、許容解答、生成SQLとの一致を確認する。生成する場合は`node scripts/generate-vocabulary.mjs`。0009は元の80語のまま、追加分だけを0011に出力し、表示順も81番以降にする。
- 本番に適用済みのmigrationは書き換えない。追加分は新しい版とforward migrationで反映する。INSERT OR IGNOREだけを使い、旧単語、個人単語、自己評価、テスト・定着履歴を更新しない。
- 不確かな語形・意味・文法は[WSJP PAN](https://wsjp.pl/)で確認し、確認した語のURLをJSONの`references`に残す。場面の選定では[WSJPのテーマ別分類](https://wsjp.pl/slownik_tematyczny)も参照した。例文と日本語訳は独自に作成する。

## 版付きA2教材を更新する場合

1. `scripts/generate-a2-content.mjs`のA2 lesson定義を編集する。各lessonは6つの独立した表現を持たせ、単なる人名・語尾差し替えで増やさない。
2. 各表現にポーランド語、日本語、英語、accepted answer、grammar note、scene、register、CEFR、skill、dialogue roleを揃える。男性話者想定はmetadataと注記に残す。
3. `node scripts/generate-a2-content.mjs`を実行する。`content/a1-a2-curriculum.json`と`migrations/0005_a2_missions_content.sql`が同じ版から再生成される。
4. 各lessonのquestionTypesは、双方向4択、cloze、unscramble、free_inputを含む14段階にする。6 item IDすべてがstepから参照されることを確認する。
5. 既に0005を適用済みのD1へ変更を反映する場合は、新しい番号のforward migrationを追加する。適用済みmigrationを編集して履歴を巻き戻さない。

## 必須検証

```bash
npm run typecheck
npm test
npm run content:validate
npm run build
npm run db:migrate
npm run api:smoke
```

validatorは件数、ID、参照、空欄、重複、4択正答、cloze/token、CEFR/register/situation、mission/Can-do参照、A1/A2のstep形式、published item数を検査する。API smokeは既存A1のsession/attempt/reviewとA2のmission、Voice結果、Can-do、exportを検査する。

## 内容レビュー

`CEFR`は教材設計上の目標であり、公的な語学認定ではない。公開前にポーランド語話者が、自然さ、格支配、活用、formal/informalの使い分け、男性話者の形、生活場面の妥当性をspot checkする。ローカルアプリに音声認識や会話実行を追加せず、会話は保存したChatGPT Voice missionの`.txt`ファイルを共有して実施する。

# 教材編集手順

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

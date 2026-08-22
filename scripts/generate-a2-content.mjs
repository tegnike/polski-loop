import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const version = "a1-a2-2026.1";
const oldCurriculum = JSON.parse(readFileSync(resolve(root, "content/a1-curriculum.json"), "utf8"));

const lesson = (titleJa, titlePl, scene, grammarTag, grammarNote, items) => ({ titleJa, titlePl, scene, grammarTag, grammarNote, items });
const unit = (unitNumber, titleJa, titlePl, description, lessons) => ({ unitNumber, titleJa, titlePl, description, lessons });

// Each A2 lesson has six authored expressions: three learner turns and three
// typical partner turns. The first two receive the complete five-form loop;
// all six are required in the Voice mission and are searchable in the library.
const a2Units = [
  unit(11, "自分と人間関係", "Ja i relacje", "自己紹介を広げ、家族・性格・誘い・気持ちを短いやり取りで伝えます。", [
    lesson("仕事まで含めて自己紹介", "Przedstawiam się szerzej", "introduction", "present-tense", "現在形、z + 生格、zajmować się + 造格を使って、出身・居住・仕事を一続きで話します。", [
      ["Mam na imię Marek, ale możesz mówić do mnie Marek.", "私の名前はマレクです。マレクと呼んでください。", "My name is Marek, but you can call me Marek."],
      ["Skąd dokładnie jesteś?", "具体的にはどこの出身ですか？", "Where exactly are you from?"],
      ["Pochodzę z Japonii, ale od dwóch lat mieszkam w Polsce.", "日本出身ですが、2年前からポーランドに住んでいます。", "I come from Japan, but I have lived in Poland for two years."],
      ["A czym zajmujesz się na co dzień?", "普段は何をしていますか？", "And what do you do day to day?"],
      ["Pracuję zdalnie jako projektant.", "リモートでデザイナーとして働いています。", "I work remotely as a designer."],
      ["To musi być ciekawe. Co lubisz robić po pracy?", "それは面白そうですね。仕事の後は何をするのが好きですか？", "That must be interesting. What do you like doing after work?"],
    ]),
    lesson("家族について話す", "Moja rodzina", "family", "accusative-genitive", "人数の表現、mieć、dzwonić do + 生格を使って、家族構成と連絡の頻度を話します。", [
      ["Mam starszą siostrę i młodszego brata.", "姉と弟がいます。", "I have an older sister and a younger brother."],
      ["Ile osób liczy twoja rodzina?", "あなたの家族は何人ですか？", "How many people are in your family?"],
      ["Moja siostra mieszka w Gdańsku, a brat studiuje w Krakowie.", "姉はグダニスクに、弟はクラクフで勉強しています。", "My sister lives in Gdańsk, and my brother studies in Kraków."],
      ["Czy często odwiedzasz rodzinę?", "家族をよく訪ねますか？", "Do you often visit your family?"],
      ["W weekendy dzwonię do rodziców.", "週末には両親に電話します。", "At weekends I call my parents."],
      ["Rozumiem, rodzina jest dla ciebie ważna.", "なるほど、家族はあなたにとって大切なのですね。", "I see, family is important to you."],
    ]),
    lesson("人柄と外見を説明する", "Jaki on jest?", "relationships", "adjective-agreement", "形容詞の性・数の一致と、bardziej ... niż ... の比較を使って人を説明します。", [
      ["Mój partner jest spokojny i cierpliwy.", "私のパートナーは穏やかで我慢強いです。", "My partner is calm and patient."],
      ["Jaki jest twój najlepszy przyjaciel?", "あなたの親友はどんな人ですか？", "What is your best friend like?"],
      ["Ma krótkie włosy i zawsze nosi okulary.", "その人は短い髪で、いつも眼鏡をかけています。", "He has short hair and always wears glasses."],
      ["Czy twoja przyjaciółka jest bardziej podobna do ciebie czy do siostry?", "あなたの女友達はあなたと姉妹のどちらに似ていますか？", "Is your female friend more like you or your sister?"],
      ["Jestem raczej nieśmiały, ale łatwo nawiązuję rozmowę.", "私はどちらかというと内気ですが、すぐ会話を始められます。", "I am rather shy, but I easily start a conversation."],
      ["To brzmi bardzo sympatycznie.", "それはとても感じがよさそうですね。", "That sounds very nice."],
    ]),
    lesson("誘いと予定を調整する", "Umawiamy się", "social-life", "conditional-politeness", "masz ochotę + 不定詞、może、条件の受け答えで、誘いを受けたり断ったりします。", [
      ["Masz ochotę pójść ze mną na kawę?", "私とコーヒーを飲みに行きませんか？", "Would you like to go for coffee with me?"],
      ["Chętnie, ale o której?", "ぜひ、何時ですか？", "Gladly, but at what time?"],
      ["Może spotkamy się w sobotę po południu?", "土曜日の午後に会いませんか？", "Shall we meet on Saturday afternoon?"],
      ["Niestety nie mogę, bo mam już plany.", "残念ですが、もう予定があります。", "Unfortunately I cannot, because I already have plans."],
      ["W takim razie zaproponuję niedzielę.", "それなら日曜日を提案します。", "In that case I will suggest Sunday."],
      ["Świetnie, wpiszmy to do kalendarza.", "いいですね、カレンダーに入れましょう。", "Great, let us put it in the calendar."],
    ]),
    lesson("気持ちと困りごとを共有する", "Jak się czuję", "feelings", "reflexive-verbs", "martwić się、czuć się、potrzebowaćとbo/żebyを使って、状態と必要な時間を伝えます。", [
      ["Trochę się martwię, bo nie znam jeszcze wielu osób.", "まだ多くの人を知らないので、少し心配です。", "I am a little worried because I do not know many people yet."],
      ["Co się stało? Chcesz o tym porozmawiać?", "どうしたのですか？そのことを話したいですか？", "What happened? Do you want to talk about it?"],
      ["Jestem zmęczony, ale ogólnie czuję się dobrze.", "疲れていますが、全体的には元気です。", "I am tired, but generally I feel well."],
      ["Rozumiem, że to może być trudne.", "それは難しいことかもしれませんね。", "I understand that it may be difficult."],
      ["Potrzebuję chwili, żeby spokojnie pomyśleć.", "落ち着いて考えるために少し時間が必要です。", "I need a moment to think calmly."],
      ["Nie przejmuj się, spróbujemy razem znaleźć rozwiązanie.", "心配しないで、一緒に解決策を探しましょう。", "Do not worry, we will try to find a solution together."],
    ]),
    lesson("一週間の出来事を雑談する", "Krótka rozmowa o tygodniu", "small-talk", "past-tense", "男性話者の過去形 minął、miałem、odwiedziłem と、podobać się を使って感想を話します。", [
      ["Jak ci minął tydzień?", "今週はどうでしたか？", "How was your week?"],
      ["Całkiem dobrze, tylko miałem dużo pracy.", "まあまあでした、ただ仕事が多かったです。", "Quite well, I just had a lot of work."],
      ["Wczoraj odwiedziłem ciekawą wystawę.", "昨日、面白い展覧会に行きました。", "Yesterday I visited an interesting exhibition."],
      ["Naprawdę? Co najbardziej ci się podobało?", "本当ですか？何が一番気に入りましたか？", "Really? What did you like most?"],
      ["Najbardziej podobała mi się część o historii miasta.", "街の歴史についての部分が一番気に入りました。", "I liked the part about the city's history most."],
      ["Chętnie zobaczę ją następnym razem.", "次回ぜひ見てみたいです。", "I would gladly see it next time."],
    ]),
  ]),
  unit(12, "日課・時間・天気", "Codzienność, czas i pogoda", "日課、予定、天気、日付と健康習慣を、質問と返答でつなぎます。", [
    lesson("朝のルーティン", "Poranek", "daily-routine", "time-expressions", "zwykle、około、najpierw potem を使って、時刻と順序のある日課を説明します。", [
      ["Zwykle wstaję około siódmej.", "普段は7時ごろ起きます。", "I usually get up around seven."],
      ["O której zwykle zaczynasz dzień?", "普段は何時に一日を始めますか？", "What time do you usually start your day?"],
      ["Najpierw robię sobie herbatę, a potem sprawdzam wiadomości.", "まずお茶を入れ、そのあとニュースを確認します。", "First I make tea, then I check the news."],
      ["Czy rano masz dużo czasu?", "朝は時間がありますか？", "Do you have much time in the morning?"],
      ["Wychodzę z domu przed ósmą.", "8時前に家を出ます。", "I leave home before eight."],
      ["U mnie poranki zaczynają się bardzo wcześnie.", "私のところでは朝がとても早く始まります。", "Mornings start very early where I live."],
    ]),
    lesson("曜日ごとの予定", "Plan tygodnia", "schedule", "days-and-prepositions", "w poniedziałki、od ... do ...、przełożyć na を使って、曜日と予定変更を話します。", [
      ["W poniedziałki pracuję z biura.", "月曜日はオフィスで働きます。", "On Mondays I work from the office."],
      ["W które dni pracujesz z domu?", "何曜日に家で働きますか？", "On which days do you work from home?"],
      ["We wtorek mam spotkanie od dziewiątej do jedenastej.", "火曜日は9時から11時まで会議があります。", "On Tuesday I have a meeting from nine to eleven."],
      ["Czy możemy przełożyć je na czwartek?", "それを木曜日に変更できますか？", "Can we move it to Thursday?"],
      ["W piątek kończę wcześniej.", "金曜日は早く終わります。", "On Friday I finish earlier."],
      ["W takim razie pasuje mi piątek wieczorem.", "それなら金曜日の夜が都合いいです。", "In that case Friday evening works for me."],
    ]),
    lesson("天気と持ち物", "Jaka będzie pogoda?", "weather", "impersonal-weather", "jest、padać、ma być、zrobić się を使い、予報を聞いて持ち物を判断します。", [
      ["Dzisiaj jest pochmurno, ale nie pada.", "今日は曇っていますが、雨は降っていません。", "It is cloudy today, but it is not raining."],
      ["Jaka jest dziś pogoda w twoim mieście?", "今日あなたの街の天気はどうですか？", "What is the weather like in your city today?"],
      ["Jutro ma być cieplej i słonecznie.", "明日はもっと暖かく晴れるそうです。", "Tomorrow it is supposed to be warmer and sunny."],
      ["Czy potrzebuję parasola?", "傘は必要ですか？", "Do I need an umbrella?"],
      ["Lepiej weź kurtkę, bo wieczorem zrobi się chłodno.", "上着を持ったほうがいいです、夜は涼しくなるので。", "You had better take a jacket because it will get cool in the evening."],
      ["Dzięki, sprawdzę jeszcze prognozę.", "ありがとう、もう一度予報を確認します。", "Thanks, I will check the forecast once more."],
    ]),
    lesson("日付と時刻を合わせる", "Data i godzina", "calendar", "ordinal-dates", "序数の生格・前置格と、o + 時刻を使って、日付と約束を確認します。", [
      ["Urodziny mam dwudziestego trzeciego maja.", "誕生日は5月23日です。", "My birthday is on the twenty-third of May."],
      ["Kiedy masz urodziny?", "誕生日はいつですか？", "When is your birthday?"],
      ["W przyszłym tygodniu wypada święto.", "来週は祝日があります。", "There is a holiday next week."],
      ["Czy sklep będzie wtedy otwarty?", "そのとき店は開いていますか？", "Will the shop be open then?"],
      ["Spotkajmy się pierwszego czerwca o siedemnastej.", "6月1日の17時に会いましょう。", "Let us meet on the first of June at five p.m."],
      ["Zapisuję: pierwszy czerwca, godzina siedemnasta.", "メモします。6月1日、17時ですね。", "I am writing it down: the first of June, five p.m."],
    ]),
    lesson("家事を分担する", "Obowiązki domowe", "chores", "imperative-and-modal", "wynosić、odkurzać、zajmę się tym と、czy możesz を使って家事の依頼と承諾をします。", [
      ["Po pracy robię zakupy i gotuję kolację.", "仕事の後に買い物をして夕食を作ります。", "After work I shop and cook dinner."],
      ["Kto dzisiaj wynosi śmieci?", "今日は誰がごみを出しますか？", "Who is taking out the rubbish today?"],
      ["W soboty sprzątam mieszkanie.", "土曜日はアパートを掃除します。", "On Saturdays I clean the flat."],
      ["Czy możesz odkurzyć przed wizytą gości?", "お客さんが来る前に掃除機をかけてもらえますか？", "Can you vacuum before the guests visit?"],
      ["Jasne, zajmę się tym po obiedzie.", "もちろん、昼食後にそれをやります。", "Sure, I will take care of it after lunch."],
      ["Dziękuję, to bardzo mi pomoże.", "ありがとう、とても助かります。", "Thank you, that will help me a lot."],
    ]),
    lesson("健康的な習慣", "Zdrowe nawyki", "health-routine", "reflexive-and-frequency", "starać się、dbać o、częstotliwo数詞を使って、健康習慣と頻度を説明します。", [
      ["Staram się codziennie spacerować.", "毎日散歩するようにしています。", "I try to go for a walk every day."],
      ["Jak dbasz o zdrowie?", "健康のために何をしていますか？", "How do you take care of your health?"],
      ["Nie palę i piję dużo wody.", "たばこを吸わず、水をたくさん飲みます。", "I do not smoke and I drink a lot of water."],
      ["Czy regularnie uprawiasz sport?", "定期的にスポーツをしますか？", "Do you exercise regularly?"],
      ["Dwa razy w tygodniu jeżdżę na rowerze.", "週に2回、自転車に乗ります。", "I cycle twice a week."],
      ["To dobry sposób, żeby mieć więcej energii.", "それはもっと元気を持つためのよい方法ですね。", "That is a good way to have more energy."],
    ]),
  ]),
  unit(13, "予定・過去・未来", "Plany, przeszłość i przyszłość", "昨日の出来事、週末、希望、理由を過去・未来の文で説明します。", [
    lesson("昨日の出来事", "Wczoraj", "past-events", "past-masculine", "男性話者の過去形 wróciłem、ugotowałem、obejrzałem と、最初に/そのあとを使います。", [
      ["Wczoraj wróciłem późno do domu.", "昨日、遅く家に帰りました。", "Yesterday I came home late."],
      ["Co robiłeś wczoraj wieczorem?", "昨日の夜は何をしましたか？", "What did you do yesterday evening?"],
      ["Najpierw ugotowałem kolację, a potem obejrzałem film.", "まず夕食を作り、そのあと映画を見ました。", "First I cooked dinner, then I watched a film."],
      ["Jaki film oglądałeś?", "どんな映画を見たのですか？", "What film did you watch?"],
      ["To była komedia, więc dużo się śmiałem.", "コメディーだったので、たくさん笑いました。", "It was a comedy, so I laughed a lot."],
      ["Brzmi jak udany wieczór.", "楽しい夜だったようですね。", "It sounds like a successful evening."],
    ]),
    lesson("週末の外出", "Miniony weekend", "weekend", "past-plural", "pojechałem、spędziliśmy、robiliśmyを使い、過去の移動と共同活動を順序立てて話します。", [
      ["W zeszły weekend pojechałem nad jezioro.", "先週末、湖へ行きました。", "Last weekend I went to a lake."],
      ["Z kim tam pojechałeś?", "誰とそこへ行ったのですか？", "Who did you go there with?"],
      ["Pojechałem z przyjaciółmi i spędziliśmy tam cały dzień.", "友達と行き、そこで一日過ごしました。", "I went with friends and we spent the whole day there."],
      ["Co robiliście na miejscu?", "現地では何をしましたか？", "What did you do there?"],
      ["Spacerowaliśmy, rozmawialiśmy i zrobiliśmy zdjęcia.", "散歩し、話し、写真を撮りました。", "We walked, talked and took photos."],
      ["Szkoda, że nie mogłem dołączyć.", "参加できなくて残念です。", "It is a pity I could not join you."],
    ]),
    lesson("土曜日の計画", "Plan na sobotę", "plans", "future-intention", "zamierzać、chciałbym、jeśli を使い、予定と条件付きの代案を話します。", [
      ["W sobotę zamierzam odwiedzić muzeum.", "土曜日は博物館を訪れるつもりです。", "On Saturday I intend to visit a museum."],
      ["Masz już jakiś plan na sobotę?", "土曜日の予定はもうありますか？", "Do you already have a plan for Saturday?"],
      ["Chciałbym też zjeść obiad w centrum.", "中心部で昼食も食べたいです。", "I would also like to have lunch in the centre."],
      ["O której planujesz wyjść?", "何時に出発する予定ですか？", "What time are you planning to leave?"],
      ["Wyjdę około południa, jeśli nie będzie padać.", "雨が降らなければ、正午ごろ出ます。", "I will leave around noon if it does not rain."],
      ["Jeśli chcesz, możemy spotkać się później.", "よければ、あとで会えます。", "If you want, we can meet later."],
    ]),
    lesson("未来の希望と目標", "Moje cele", "goals", "future-and-wishes", "chciałbym、będę ćwiczył、żebyを使い、希望・具体的な行動・目的を結びつけます。", [
      ["W przyszłym roku chciałbym lepiej mówić po polsku.", "来年はもっと上手にポーランド語を話したいです。", "Next year I would like to speak Polish better."],
      ["Czego chciałbyś nauczyć się w tym roku?", "今年は何を学びたいですか？", "What would you like to learn this year?"],
      ["Będę codziennie ćwiczył krótkie rozmowy.", "毎日短い会話を練習します。", "I will practise short conversations every day."],
      ["Czy masz jakiś konkretny cel?", "具体的な目標はありますか？", "Do you have a specific goal?"],
      ["Chcę swobodnie załatwiać sprawy w urzędzie.", "役所の用事を気軽に済ませられるようになりたいです。", "I want to handle matters at an office confidently."],
      ["To praktyczny i bardzo konkretny plan.", "実用的で、とても具体的な計画ですね。", "That is a practical and very concrete plan."],
    ]),
    lesson("理由を説明する", "Dlaczego zostałem w domu", "reasons", "because-and-infinitive", "ponieważ、bo、musieć、po odpoczynkuを使って、理由と状態の変化を説明します。", [
      ["Nie poszedłem na spacer, ponieważ bolała mnie głowa.", "頭が痛かったので、散歩に行きませんでした。", "I did not go for a walk because I had a headache."],
      ["Dlaczego zostałeś dziś w domu?", "今日はなぜ家にいたのですか？", "Why did you stay home today?"],
      ["Zostałem w domu, bo musiałem odpocząć.", "休まなければならなかったので、家にいました。", "I stayed home because I had to rest."],
      ["Czy czujesz się już lepiej?", "もう気分はよくなりましたか？", "Do you feel better now?"],
      ["Tak, po odpoczynku jest mi znacznie lepiej.", "はい、休んだらずっとよくなりました。", "Yes, I feel much better after resting."],
      ["Dobrze, nie przemęczaj się dzisiaj.", "よかった、今日は無理をしないでください。", "Good, do not overwork yourself today."],
    ]),
    lesson("用事を順番に報告する", "Co załatwiłem", "errands", "past-perfective", "najpierw potem、wpłacić、zapytać、udać sięを使い、複数の用事の完了を報告します。", [
      ["Najpierw pojechałem do banku, a potem zrobiłem zakupy.", "まず銀行へ行き、そのあと買い物をしました。", "First I went to the bank, then I went shopping."],
      ["Co załatwiłeś w banku?", "銀行で何を済ませたのですか？", "What did you take care of at the bank?"],
      ["Wpłaciłem pieniądze i zapytałem o nową kartę.", "お金を入金し、新しいカードについて尋ねました。", "I deposited money and asked about a new card."],
      ["Czy długo czekałeś?", "長く待ちましたか？", "Did you wait long?"],
      ["Nie, pracownik szybko mi pomógł.", "いいえ、職員がすぐに助けてくれました。", "No, an employee helped me quickly."],
      ["To dobrze, że udało ci się wszystko załatwić.", "全部済ませられてよかったですね。", "It is good that you managed to take care of everything."],
    ]),
  ]),
  unit(14, "好み・比較・余暇", "Zainteresowania i czas wolny", "趣味、比較、文化、スポーツ、祝日、ポーランド語メディアについて意見を交換します。", [
    lesson("趣味を詳しく話す", "Moje zainteresowania", "hobbies", "instrumental-case", "interesować się + 造格、lubić + 対格を使い、趣味と好きな対象を説明します。", [
      ["Interesuję się fotografią uliczną.", "ストリート写真に興味があります。", "I am interested in street photography."],
      ["Czym interesujesz się poza pracą?", "仕事以外では何に興味がありますか？", "What are you interested in besides work?"],
      ["Lubię robić zdjęcia starych kamienic.", "古い建物の写真を撮るのが好きです。", "I like taking photos of old townhouses."],
      ["Wolisz fotografować ludzi czy budynki?", "人と建物のどちらを撮るのが好きですか？", "Do you prefer photographing people or buildings?"],
      ["Najbardziej lubię spokojne poranki bez tłumu.", "人混みのない静かな朝が一番好きです。", "I like quiet mornings without crowds most."],
      ["Rozumiem, cisza pomaga zauważyć szczegóły.", "なるほど、静けさは細部に気づく助けになりますね。", "I see, silence helps you notice details."],
    ]),
    lesson("値段と品質を比較する", "Co jest lepsze?", "shopping-comparison", "comparative-adjectives", "tańszy、lepszy、droższy niż と wartoを使い、価格と品質を比較して選びます。", [
      ["Ten sklep jest tańszy niż tamten.", "この店はあの店より安いです。", "This shop is cheaper than that one."],
      ["Który produkt jest według ciebie lepszy?", "あなたの考えでは、どの商品がよいですか？", "Which product is better in your opinion?"],
      ["Ten ma lepszy skład, ale jest trochę droższy.", "こちらは成分がよいですが、少し高いです。", "This one has better ingredients, but it is a little more expensive."],
      ["Czy różnica w cenie jest duża?", "価格差は大きいですか？", "Is the difference in price large?"],
      ["Nie, za lepszą jakość warto dopłacić.", "いいえ、品質がよいなら追加で払う価値があります。", "No, it is worth paying extra for better quality."],
      ["W takim razie wybierzmy ten produkt.", "それならこの商品を選びましょう。", "In that case let us choose this product."],
    ]),
    lesson("映画と劇場に誘う", "Kino czy teatr?", "culture", "accusative-and-prepositions", "iść do kina/teatru、na film、zarezerwowaćを使い、文化イベントの好みと予約を話します。", [
      ["W piątek idę do kina na polski film.", "金曜日にポーランド映画を見に映画館へ行きます。", "On Friday I am going to the cinema for a Polish film."],
      ["Na jaki film chcesz iść?", "どの映画を見に行きたいですか？", "What film do you want to see?"],
      ["Na nową komedię, bo lubię lekkie historie.", "新しいコメディーです。軽い物語が好きなので。", "A new comedy, because I like light stories."],
      ["Wolisz kino czy teatr?", "映画館と劇場のどちらが好きですか？", "Do you prefer the cinema or the theatre?"],
      ["Zwykle wybieram teatr, ale dziś mam ochotę na kino.", "普段は劇場を選びますが、今日は映画館に行きたいです。", "I usually choose the theatre, but today I feel like going to the cinema."],
      ["Mogę zarezerwować dla nas dwa miejsca.", "私たちの席を2つ予約できます。", "I can reserve two seats for us."],
    ]),
    lesson("スポーツの頻度と好み", "Sport razem", "sport", "frequency-and-instrumental", "uprawiać sport、raz w tygodniu、w grupieを使い、運動の頻度と一人/集団の好みを話します。", [
      ["W weekend gram w siatkówkę z sąsiadami.", "週末は近所の人とバレーボールをします。", "At the weekend I play volleyball with neighbours."],
      ["Jak często uprawiasz sport?", "どのくらいの頻度で運動しますか？", "How often do you exercise?"],
      ["Raz w tygodniu chodzę na basen.", "週に1回プールへ行きます。", "I go to the swimming pool once a week."],
      ["Wolisz ćwiczyć sam czy w grupie?", "一人とグループのどちらで運動したいですか？", "Do you prefer exercising alone or in a group?"],
      ["W grupie łatwiej mi zachować regularność.", "グループのほうが定期的に続けやすいです。", "It is easier for me to stay regular in a group."],
      ["To prawda, razem jest bardziej motywująco.", "確かに、一緒のほうがやる気が出ますね。", "That is true, it is more motivating together."],
    ]),
    lesson("祝日と文化の違い", "Święta i zwyczaje", "holidays", "impersonal-and-genitive", "w moim kraju、spędzać święta、zwyczajを使い、自国とポーランドの習慣を比較します。", [
      ["W moim kraju święta spędza się inaczej.", "私の国では祝日の過ごし方が違います。", "In my country holidays are spent differently."],
      ["Jakie zwyczaje są ważne w twojej rodzinie?", "あなたの家族ではどんな習慣が大切ですか？", "What customs are important in your family?"],
      ["W Wigilię spotykamy się przy wspólnym stole.", "クリスマスイブには同じ食卓を囲みます。", "On Christmas Eve we meet around a shared table."],
      ["Czy masz jakieś ulubione polskie święto?", "好きなポーランドの祝日はありますか？", "Do you have a favourite Polish holiday?"],
      ["Lubię pierwszy dzień wiosny, bo wszyscy wychodzą na spacer.", "春の初日が好きです。みんな散歩に出るからです。", "I like the first day of spring because everyone goes for a walk."],
      ["Ciekawe, chętnie poznam więcej takich zwyczajów.", "面白いですね、そうした習慣をもっと知りたいです。", "Interesting, I would gladly learn more such customs."],
    ]),
    lesson("ポーランド語メディアを使う", "Uczę się z mediów", "media", "object-pronouns", "słuchać podcastu、rozumieć temat、potrzebować powtórkiを使い、聞き取りと学習戦略を話します。", [
      ["Ostatnio słucham podcastu po polsku.", "最近ポーランド語のポッドキャストを聞いています。", "Recently I have been listening to a podcast in Polish."],
      ["Czy rozumiesz już większość takich nagrań?", "もうそのような録音の大部分を理解できますか？", "Do you already understand most of such recordings?"],
      ["Rozumiem główny temat, ale czasem potrzebuję powtórki.", "大意は分かりますが、ときどき繰り返しが必要です。", "I understand the main topic, but sometimes I need a repeat."],
      ["Co robisz, kiedy nie znasz słowa?", "知らない単語があるときはどうしますか？", "What do you do when you do not know a word?"],
      ["Zapisuję je i sprawdzam znaczenie po rozmowie.", "それを書き留め、会話のあとで意味を調べます。", "I write it down and check the meaning after the conversation."],
      ["To dobra strategia do samodzielnej nauki.", "自分で学ぶためのよい方法ですね。", "That is a good strategy for independent learning."],
    ]),
  ]),
  unit(15, "市内・交通・旅行", "Miasto, transport i podróże", "道案内、切符、遅延、ホテル、観光、荷物のトラブルを実用会話で処理します。", [
    lesson("道を尋ねる", "Jak dojść do poczty?", "directions", "imperative-and-locative", "dojść do + 生格、idź、skręć、przyを使い、道を尋ねて案内を理解します。", [
      ["Czy możesz mi powiedzieć, jak dojść do poczty?", "郵便局への行き方を教えてもらえますか？", "Can you tell me how to get to the post office?"],
      ["Czego szukasz?", "何を探していますか？", "What are you looking for?"],
      ["Szukam poczty przy głównej ulicy.", "大通りにある郵便局を探しています。", "I am looking for the post office on the main street."],
      ["Idź prosto, a potem skręć w lewo przy aptece.", "まっすぐ行き、薬局のところで左に曲がってください。", "Go straight, then turn left by the pharmacy."],
      ["Czy to daleko stąd?", "ここから遠いですか？", "Is it far from here?"],
      ["Nie, dojście zajmie około dziesięciu minut.", "いいえ、歩いて10分ほどです。", "No, walking there will take about ten minutes."],
    ]),
    lesson("切符を買う", "Bilet do Poznania", "transport-ticket", "genitive-and-ordinal", "bilet w jedną stronę、na kiedy、z peronuを使い、行き先・時刻・ホームを確認します。", [
      ["Poproszę bilet w jedną stronę do Poznania.", "ポズナンまでの片道切符をお願いします。", "A one-way ticket to Poznań, please."],
      ["Na kiedy potrzebuje pan biletu?", "いつの切符が必要ですか？", "For when do you need the ticket?"],
      ["Na dzisiaj, najlepiej na pociąg o osiemnastej.", "今日の、できれば18時の列車がいいです。", "For today, preferably the train at six p.m."],
      ["Ten pociąg odjeżdża z peronu trzeciego.", "この列車は3番ホームから出ます。", "This train leaves from platform three."],
      ["Czy muszę kupić miejscówkę?", "座席指定券を買う必要がありますか？", "Do I have to buy a seat reservation?"],
      ["Nie, ale warto zająć miejsce wcześniej.", "いいえ、でも早めに席を取る価値があります。", "No, but it is worth taking a seat early."],
    ]),
    lesson("遅延と乗り換え", "Opóźniony pociąg", "travel-delay", "modal-and-future", "mieć opóźnienie、powinien、zdążyć na、jeśli を使い、遅延と代案を確認します。", [
      ["Pociąg ma opóźnienie czterdziestu minut.", "列車は40分遅れています。", "The train is delayed by forty minutes."],
      ["Czy wiadomo, kiedy przyjedzie następny pociąg?", "次の列車がいつ来るか分かりますか？", "Do you know when the next train will arrive?"],
      ["Według tablicy powinien przyjechać o piętnastej.", "掲示板によると15時に来るはずです。", "According to the board it should arrive at three p.m."],
      ["Czy zdążę na przesiadkę?", "乗り換えに間に合いますか？", "Will I make the connection?"],
      ["Jeśli nie, poproszę pracownika o pomoc.", "間に合わなければ、職員に助けを求めます。", "If not, I will ask an employee for help."],
      ["Proszę sprawdzić połączenie do Wrocławia.", "ヴロツワフへの接続を確認してください。", "Please check the connection to Wrocław."],
    ]),
    lesson("ホテルに泊まる", "W hotelu", "hotel", "formal-questions", "rezerwacja、na ile nocy、w cenie、przechowaćを使い、ホテルの予約と荷物預けを行います。", [
      ["Mam rezerwację na nazwisko Kowalski.", "コワルスキの名前で予約しています。", "I have a reservation under the name Kowalski."],
      ["Na ile nocy państwo zostają?", "何泊お泊まりですか？", "How many nights are you staying?"],
      ["Zostaję na trzy noce, od piątku do poniedziałku.", "金曜日から月曜日まで3泊します。", "I am staying for three nights, from Friday to Monday."],
      ["Śniadanie jest w cenie i podajemy je od siódmej.", "朝食は料金に含まれ、7時から提供します。", "Breakfast is included and we serve it from seven."],
      ["Czy mogę zostawić bagaż przed zameldowaniem?", "チェックイン前に荷物を預けられますか？", "Can I leave my luggage before check-in?"],
      ["Oczywiście, przechowamy go bez problemu.", "もちろん、問題なく預かります。", "Of course, we will store it without a problem."],
    ]),
    lesson("観光の計画", "Zwiedzam Kraków", "sightseeing", "future-sequence", "chciałbym、najpierw potem、chętnie posłuchamを使い、観光順序と助言を交換します。", [
      ["Chciałbym zwiedzić stare miasto i zobaczyć zamek.", "旧市街を観光して城を見たいです。", "I would like to visit the old town and see the castle."],
      ["Co planuje pan zobaczyć w Krakowie?", "クラクフで何を見る予定ですか？", "What do you plan to see in Kraków?"],
      ["Najpierw pójdę na rynek, a potem do muzeum.", "まず広場へ行き、そのあと博物館へ行きます。", "First I will go to the market square, then to the museum."],
      ["Czy ma pan mapę albo aplikację?", "地図かアプリを持っていますか？", "Do you have a map or an app?"],
      ["Mam mapę w telefonie, ale chętnie posłucham rady.", "携帯に地図がありますが、ぜひ助言を聞きたいです。", "I have a map on my phone, but I would gladly hear your advice."],
      ["Warto też przejść się nad rzekę wieczorem.", "夕方には川沿いも歩く価値があります。", "It is also worth walking to the river in the evening."],
    ]),
    lesson("荷物が届かない", "Zaginiony bagaż", "lost-luggage", "descriptive-genitive", "nie przyjechał、jak wygląda、z + 造格、numer zgłoszeniaを使い、荷物の特徴と申告番号を伝えます。", [
      ["Mój bagaż nie przyjechał na taśmie.", "私の荷物がターンテーブルに出てきませんでした。", "My luggage did not arrive on the belt."],
      ["Jak wygląda pański bagaż?", "荷物はどんな見た目ですか？", "What does your luggage look like?"],
      ["To czarna walizka z czerwoną etykietą.", "赤いタグの付いた黒いスーツケースです。", "It is a black suitcase with a red label."],
      ["Czy ma pan przy sobie dowód nadania?", "預け入れ証明を持っていますか？", "Do you have the baggage receipt with you?"],
      ["Tak, tutaj jest numer zgłoszenia.", "はい、ここに申告番号があります。", "Yes, here is the report number."],
      ["Proszę poczekać, sprawdzę to w systemie.", "お待ちください、システムで確認します。", "Please wait, I will check it in the system."],
    ]),
  ]),
  unit(16, "住居・近隣・トラブル", "Mieszkanie i okolica", "住まい探し、設備故障、近所、契約、引っ越し、鍵のトラブルを説明します。", [
    lesson("住まいの条件を伝える", "Szukam mieszkania", "housing-search", "genitive-and-locative", "szukać + 生格、dla + 生格、z balkonemを使い、希望する住居条件を伝えます。", [
      ["Szukam małego mieszkania blisko centrum.", "中心部に近い小さなアパートを探しています。", "I am looking for a small flat near the centre."],
      ["Dla ilu osób szuka pan mieszkania?", "何人用の住居を探していますか？", "For how many people are you looking for a flat?"],
      ["Dla jednej osoby, najlepiej z balkonem.", "一人用で、できればバルコニー付きがいいです。", "For one person, preferably with a balcony."],
      ["Czy zwierzęta są dozwolone?", "ペットは許可されていますか？", "Are pets allowed?"],
      ["Nie mam zwierząt, ale chciałbym mieć dużo światła.", "ペットはいませんが、明るい部屋がいいです。", "I do not have pets, but I would like plenty of light."],
      ["To mieszkanie ma duże okna od południa.", "この部屋には南向きの大きな窓があります。", "This flat has large south-facing windows."],
    ]),
    lesson("設備の故障を報告する", "Awaria w kuchni", "maintenance", "negation-and-aspect", "nie działa、od kiedy、nadal występujeを使い、故障の開始時点と継続を説明します。", [
      ["W kuchni nie działa kran.", "キッチンの蛇口が動きません。", "The tap in the kitchen does not work."],
      ["Od kiedy jest ten problem?", "この問題はいつからですか？", "Since when has this problem existed?"],
      ["Od wczoraj wieczorem woda tylko kapie.", "昨日の夜から、水が滴るだけです。", "Since yesterday evening the water only drips."],
      ["Czy próbował pan zakręcić główny zawór?", "元栓を閉めてみましたか？", "Have you tried turning off the main valve?"],
      ["Tak, ale problem nadal występuje.", "はい、でも問題はまだ続いています。", "Yes, but the problem is still there."],
      ["Wyślę hydraulika jutro rano.", "明日の朝に配管工を送ります。", "I will send a plumber tomorrow morning."],
    ]),
    lesson("近所について尋ねる", "W okolicy", "neighborhood", "locative-and-impersonal", "w tej okolicy、obok、na rogu、bywaを使い、近所の施設と環境を説明します。", [
      ["Czy w tej okolicy jest spokojnie?", "この地域は静かですか？", "Is this neighbourhood quiet?"],
      ["Tak, zwykle jest cicho, ale w weekendy bywa głośno.", "はい、普段は静かですが、週末は騒がしいことがあります。", "Yes, it is usually quiet, but it can be noisy at weekends."],
      ["Gdzie jest najbliższy sklep spożywczy?", "一番近い食料品店はどこですか？", "Where is the nearest grocery shop?"],
      ["Jest na rogu, obok przystanku autobusowego.", "角の、バス停の隣にあります。", "It is on the corner, next to the bus stop."],
      ["Czy sąsiedzi organizują czasem wspólne spotkania?", "近所の人はときどき集まりを企画しますか？", "Do the neighbours sometimes organise gatherings?"],
      ["Latem spotykamy się w ogrodzie za budynkiem.", "夏には建物の裏の庭に集まります。", "In summer we meet in the garden behind the building."],
    ]),
    lesson("家賃と契約を確認する", "Czynsz i umowa", "rental-contract", "genitive-and-passive", "wynosić、media、osobno、przed podpisaniemを使い、家賃と契約条件を確認します。", [
      ["Chciałbym zapytać o wysokość czynszu.", "家賃の金額について尋ねたいです。", "I would like to ask about the amount of rent."],
      ["Czynsz wynosi trzy tysiące złotych miesięcznie.", "家賃は月3000ズウォティです。", "The rent is three thousand zlotys per month."],
      ["Czy w tej kwocie są już media?", "この金額に光熱費は含まれていますか？", "Are utilities already included in this amount?"],
      ["Prąd i ogrzewanie płaci się osobno.", "電気と暖房は別に支払います。", "Electricity and heating are paid separately."],
      ["Czy mogę zobaczyć umowę przed podpisaniem?", "署名前に契約書を見られますか？", "Can I see the contract before signing?"],
      ["Oczywiście, prześlę ją panu e-mailem.", "もちろん、メールでお送りします。", "Of course, I will send it to you by email."],
    ]),
    lesson("引っ越しを調整する", "Przeprowadzka", "moving", "future-and-dative", "wprowadzać się、przydać się、firma przyjedzieを使い、引っ越しの希望と必要な助けを調整します。", [
      ["Wprowadzam się do nowego mieszkania w przyszłym tygodniu.", "来週、新しいアパートに引っ越します。", "I am moving into a new flat next week."],
      ["Czy potrzebuje pan pomocy z przeprowadzką?", "引っ越しの手伝いが必要ですか？", "Do you need help with the move?"],
      ["Tak, szczególnie z ciężkimi pudełkami.", "はい、特に重い箱について助けが必要です。", "Yes, especially with the heavy boxes."],
      ["Kiedy przyjedzie firma transportowa?", "運送会社はいつ来ますか？", "When will the transport company arrive?"],
      ["Przyjedzie w środę rano.", "水曜日の朝に来ます。", "It will arrive on Wednesday morning."],
      ["W takim razie przygotuję wejście i windę.", "それなら入口とエレベーターを準備します。", "In that case I will prepare the entrance and lift."],
    ]),
    lesson("鍵をなくしたとき", "Zgubione klucze", "home-trouble", "genitive-and-if", "zgubić、u właściciela、proszę zadzwonić、jeśli trzebaを使い、鍵の紛失と解決策を伝えます。", [
      ["Zgubiłem klucze i nie mogę wejść do domu.", "鍵をなくして家に入れません。", "I lost my keys and cannot enter the house."],
      ["Czy ma pan zapasowy komplet?", "予備の鍵を持っていますか？", "Do you have a spare set?"],
      ["Nie, zapasowe klucze są u właściciela.", "いいえ、予備の鍵は大家が持っています。", "No, the spare keys are with the landlord."],
      ["Proszę zadzwonić do niego i wyjaśnić sytuację.", "大家に電話して状況を説明してください。", "Please call him and explain the situation."],
      ["Już dzwonię, mam jego numer.", "今電話します、番号を持っています。", "I am calling now, I have his number."],
      ["Jeśli trzeba, możemy otworzyć drzwi ślusarzem.", "必要なら鍵屋でドアを開けられます。", "If necessary, we can open the door with a locksmith."],
    ]),
  ]),
  unit(17, "仕事・電話・予約", "Praca, telefon i rezerwacje", "仕事の説明、期限調整、電話、綴り、メール、医療予約を扱います。", [
    lesson("仕事を説明する", "Moja praca", "work", "instrumental-and-relative", "pracować jako、zajmować się、kontaktować się zを使い、職種と業務を説明します。", [
      ["Pracuję w małej firmie zajmującej się oprogramowaniem.", "ソフトウェアを扱う小さな会社で働いています。", "I work in a small software company."],
      ["Czym zajmuje się pańska firma?", "あなたの会社は何を扱っていますか？", "What does your company do?"],
      ["Tworzę dokumentację i kontaktuję się z klientami.", "文書を作り、顧客と連絡を取ります。", "I create documentation and contact clients."],
      ["Czy pracuje pan w biurze czy zdalnie?", "オフィス勤務ですか、リモートですか？", "Do you work in an office or remotely?"],
      ["Pracuję hybrydowo, trzy dni w biurze.", "ハイブリッドで、週3日はオフィスで働きます。", "I work hybrid, three days in the office."],
      ["To wygodne rozwiązanie przy takiej pracy.", "そのような仕事には便利な方法ですね。", "That is a convenient arrangement for such work."],
    ]),
    lesson("仕事の期限を調整する", "Termin raportu", "work-tasks", "modal-and-dative", "musieć、przesunąć termin、dodatkowego czasuを使い、仕事の依頼と期限変更を行います。", [
      ["Dzisiaj muszę przygotować raport dla zespołu.", "今日はチームのために報告書を準備しなければなりません。", "Today I have to prepare a report for the team."],
      ["Co musi pani zrobić przed spotkaniem?", "会議の前に何をしなければなりませんか？", "What do you have to do before the meeting?"],
      ["Muszę sprawdzić dane i wysłać podsumowanie.", "データを確認して、まとめを送らなければなりません。", "I have to check the data and send a summary."],
      ["Czy potrzebuje pani dodatkowego czasu?", "追加の時間が必要ですか？", "Do you need extra time?"],
      ["Tak, czy możemy przesunąć termin do jutra?", "はい、期限を明日まで延ばせますか？", "Yes, can we move the deadline to tomorrow?"],
      ["Oczywiście, ustalmy nowy termin.", "もちろん、新しい期限を決めましょう。", "Of course, let us set a new deadline."],
    ]),
    lesson("電話で予約を変更する", "Zmiana wizyty", "phone-appointment", "formal-phone", "dzwonić w sprawie、przełożyć na、pasowaćを使い、電話で予約の変更を丁寧に行います。", [
      ["Dzień dobry, dzwonię w sprawie wizyty.", "こんにちは、予約の件で電話しています。", "Good morning, I am calling about an appointment."],
      ["W czym mogę pomóc?", "どうお手伝いできますか？", "How can I help?"],
      ["Chciałbym przełożyć wizytę na przyszły tydzień.", "予約を来週に変更したいです。", "I would like to move the appointment to next week."],
      ["Na który dzień chciałby pan ją przełożyć?", "何日に変更したいですか？", "Which day would you like to move it to?"],
      ["Czy pasuje środa po południu?", "水曜の午後は都合がよいですか？", "Would Wednesday afternoon suit you?"],
      ["Tak, mam wolny termin w środę o piętnastej.", "はい、水曜日の15時に空きがあります。", "Yes, I have an available slot on Wednesday at three."],
    ]),
    lesson("聞き返しと綴り", "Rozmowa telefoniczna", "phone-clarification", "imperative-and-spelling", "nie słyszę、powtórzyć、przeliterowaćを使い、電話で聞き返し、名前を綴ります。", [
      ["Nie słyszę pana dobrze, czy może pan powtórzyć?", "よく聞こえません、もう一度言っていただけますか？", "I cannot hear you well, could you repeat?"],
      ["Oczywiście, mówię trochę wolniej.", "もちろん、少しゆっくり話します。", "Of course, I will speak a little more slowly."],
      ["Czy może pan przeliterować swoje nazwisko?", "名字を綴っていただけますか？", "Could you spell your surname?"],
      ["Kowalski: K-O-W-A-L-S-K-I.", "コワルスキ、K-O-W-A-L-S-K-Iです。", "Kowalski: K-O-W-A-L-S-K-I."],
      ["Dziękuję, oddzwonię po sprawdzeniu danych.", "ありがとう、情報を確認したら折り返します。", "Thank you, I will call back after checking the data."],
      ["W porządku, czekam na telefon.", "分かりました、電話をお待ちしています。", "All right, I will wait for the call."],
    ]),
    lesson("仕事の予定をメールで確認する", "Potwierdzenie spotkania", "work-email", "conditional-formal", "żeby potwierdzić、moglibyśmy、dogodna godzinaを使い、丁寧に会議の詳細を確認します。", [
      ["Piszę, żeby potwierdzić nasze spotkanie.", "打ち合わせを確認するために書いています。", "I am writing to confirm our meeting."],
      ["Dziękuję za wiadomość i potwierdzam termin.", "ご連絡ありがとうございます、予定を確認します。", "Thank you for the message; I confirm the date."],
      ["Czy moglibyśmy omówić szczegóły przez telefon?", "詳細を電話で話せますか？", "Could we discuss the details by phone?"],
      ["Tak, proszę zaproponować dogodną godzinę.", "はい、都合のよい時間を提案してください。", "Yes, please suggest a convenient time."],
      ["W czwartek po szesnastej mam czas.", "木曜日の16時以降なら時間があります。", "I have time on Thursday after four."],
      ["W takim razie zadzwonię w czwartek wieczorem.", "それなら木曜日の夜に電話します。", "In that case I will call on Thursday evening."],
    ]),
    lesson("歯科の予約を取る", "Wizyta u dentysty", "medical-appointment", "dative-and-body", "umówić wizytę、boleć、po lewej stronieを使い、症状と予約可能な時間を伝えます。", [
      ["Chciałbym umówić wizytę u dentysty.", "歯医者の予約を取りたいです。", "I would like to make a dentist appointment."],
      ["Czy to pierwsza wizyta w naszej przychodni?", "当院は初めてですか？", "Is this your first visit to our clinic?"],
      ["Tak, boli mnie ząb po lewej stronie.", "はい、左側の歯が痛いです。", "Yes, a tooth on my left side hurts."],
      ["Mamy wolny termin jutro rano.", "明日の朝に空きがあります。", "We have an available appointment tomorrow morning."],
      ["Czy mogę przyjść o dziewiątej trzydzieści?", "9時半に来てもよいですか？", "Can I come at nine thirty?"],
      ["Tak, proszę przyjść dziesięć minut wcześniej.", "はい、10分早く来てください。", "Yes, please come ten minutes early."],
    ]),
  ]),
  unit(18, "買い物・飲食・銀行", "Zakupy, jedzenie i pieniądze", "市場、服の交換、返品、アレルギー、銀行、郵便の生活サービスを処理します。", [
    lesson("市場で量を買う", "Na targu", "market", "accusative-measures", "半量・単位名詞、対格、życzyć sobieを使い、量と追加注文を伝えます。", [
      ["Poproszę pół kilo pomidorów i bochenek chleba.", "トマトを半キロとパンを1斤ください。", "Half a kilo of tomatoes and a loaf of bread, please."],
      ["Czy życzy pan sobie coś jeszcze?", "ほかにも何かいかがですか？", "Would you like anything else?"],
      ["Tak, proszę dodać sześć jajek.", "はい、卵を6個追加してください。", "Yes, please add six eggs."],
      ["Ile kosztuje ten ser?", "このチーズはいくらですか？", "How much does this cheese cost?"],
      ["Ten ser kosztuje trzydzieści złotych za kilogram.", "このチーズは1キロ30ズウォティです。", "This cheese costs thirty zlotys per kilogram."],
      ["Dziękuję, to wszystko.", "ありがとう、以上です。", "Thank you, that is all."],
    ]),
    lesson("服のサイズと交換", "Kurtka w innym rozmiarze", "clothing", "comparative-and-case", "rozmiar、dostępny、za krótki、zamówićを使い、試着とサイズ変更を依頼します。", [
      ["Szukam kurtki w rozmiarze M.", "Mサイズのジャケットを探しています。", "I am looking for a jacket in size M."],
      ["Jaki kolor pana interesuje?", "何色がお好みですか？", "What colour are you interested in?"],
      ["Najchętniej granatowy, jeśli jest dostępny.", "あれば、紺色が一番いいです。", "Preferably navy, if it is available."],
      ["Czy może pan przymierzyć ten model?", "このモデルを試着できますか？", "Can you try on this model?"],
      ["Tak, ale rękawy są trochę za krótkie.", "はい、でも袖が少し短すぎます。", "Yes, but the sleeves are a little too short."],
      ["Możemy zamówić większy rozmiar.", "もっと大きいサイズを注文できます。", "We can order a larger size."],
    ]),
    lesson("故障品を返品する", "Reklamacja czajnika", "complaint", "despite-and-perfective", "zwrócić、mimo że、paragon、wymienić albo zwrócićを使い、故障と希望する対応を説明します。", [
      ["Chciałbym zwrócić ten uszkodzony czajnik.", "この壊れた電気ケトルを返品したいです。", "I would like to return this damaged kettle."],
      ["Co dokładnie jest z nim nie tak?", "具体的にどこが問題ですか？", "What exactly is wrong with it?"],
      ["Nie grzeje wody, mimo że jest podłączony.", "電源につないでいるのに水を温めません。", "It does not heat water even though it is plugged in."],
      ["Czy ma pan paragon?", "レシートをお持ちですか？", "Do you have the receipt?"],
      ["Tak, tutaj jest paragon i karta gwarancyjna.", "はい、ここにレシートと保証書があります。", "Yes, here are the receipt and warranty card."],
      ["Wymienimy urządzenie albo zwrócimy pieniądze.", "製品を交換するか、返金します。", "We will replace the device or refund the money."],
    ]),
    lesson("アレルギーを伝えて注文する", "Bez orzechów", "restaurant-allergy", "genitive-and-negation", "zawierać、bez + 生格、polecaćを使い、アレルギーと代替料理を確認します。", [
      ["Czy w tej zupie są orzechy?", "このスープにナッツは入っていますか？", "Does this soup contain nuts?"],
      ["Nie, ale sos zawiera mleko.", "いいえ、でもソースには牛乳が入っています。", "No, but the sauce contains milk."],
      ["Mam alergię na orzechy, więc poproszę coś bez nich.", "ナッツアレルギーがあるので、ナッツなしのものをお願いします。", "I am allergic to nuts, so I would like something without them."],
      ["Co może pani polecić bez mleka?", "牛乳なしで何をおすすめできますか？", "What can you recommend without milk?"],
      ["Polecamy grillowane warzywa z ryżem.", "焼き野菜とご飯をおすすめします。", "We recommend grilled vegetables with rice."],
      ["Poproszę warzywa i wodę gazowaną.", "野菜と炭酸水をお願いします。", "Vegetables and sparkling water, please."],
    ]),
    lesson("銀行で現金を扱う", "W banku", "bank", "genitive-and-modal", "wypłacić z konta、dokument tożsamości、zapomnieć kodu、resetowaćを使います。", [
      ["Chciałbym wypłacić pieniądze z konta.", "口座からお金を引き出したいです。", "I would like to withdraw money from my account."],
      ["Czy ma pan kartę i dokument tożsamości?", "カードと身分証明書をお持ちですか？", "Do you have your card and identity document?"],
      ["Mam kartę, ale zapomniałem kodu PIN.", "カードはありますが、PINを忘れました。", "I have the card, but I forgot the PIN."],
      ["Możemy zresetować kod po sprawdzeniu dokumentu.", "書類を確認したら暗証番号をリセットできます。", "We can reset the code after checking the document."],
      ["Czy mogę zapłacić telefonem?", "携帯電話で支払えますか？", "Can I pay with my phone?"],
      ["Tak, terminal obsługuje płatności zbliżeniowe.", "はい、端末は非接触決済に対応しています。", "Yes, the terminal supports contactless payments."],
    ]),
    lesson("郵便で荷物を送る", "Paczka do Niemiec", "post", "address-and-passive", "wysłać do、adres odbiorcy、zabezpieczyć、kosztowaćを使い、宛先・梱包・料金を確認します。", [
      ["Chciałbym wysłać paczkę do Niemiec.", "ドイツへ荷物を送りたいです。", "I would like to send a parcel to Germany."],
      ["Jaki jest adres odbiorcy?", "受取人の住所は何ですか？", "What is the recipient's address?"],
      ["To ulica Lindenstraße 12, kod 10115 Berlin.", "住所はLindenstraße 12、郵便番号10115 Berlinです。", "It is Lindenstraße 12, postcode 10115 Berlin."],
      ["Czy paczka jest dobrze zapakowana?", "荷物はきちんと梱包されていますか？", "Is the parcel packed well?"],
      ["Tak, zabezpieczyłem ją folią bąbelkową.", "はい、エアキャップで保護しました。", "Yes, I secured it with bubble wrap."],
      ["Nadanie kosztuje czterdzieści złotych.", "発送料金は40ズウォティです。", "Sending it costs forty zlotys."],
    ]),
  ]),
  unit(19, "健康・薬局・緊急", "Zdrowie i bezpieczeństwo", "症状、診察、薬局、服薬指示、緊急時、心身の状態を安全に伝えます。", [
    lesson("症状を伝える", "Objawy", "health", "body-and-genitive", "boleć mnie、mieć gorączkę、lekki kaszel、uczulony naを使い、症状と服薬情報を伝えます。", [
      ["Od dwóch dni boli mnie gardło i mam gorączkę.", "2日前から喉が痛く、熱があります。", "My throat has hurt and I have had a fever for two days."],
      ["Czy ma pan także kaszel albo katar?", "咳や鼻水もありますか？", "Do you also have a cough or a runny nose?"],
      ["Mam lekki kaszel, ale nie mam kataru.", "軽い咳はありますが、鼻水はありません。", "I have a slight cough, but no runny nose."],
      ["Czy jest pan uczulony na jakieś leki?", "薬にアレルギーがありますか？", "Are you allergic to any medicines?"],
      ["Nie jestem uczulony, ale przyjmuję lekarstwo na ciśnienie.", "アレルギーはありませんが、血圧の薬を飲んでいます。", "I am not allergic, but I take medicine for blood pressure."],
      ["W takim razie proszę powiedzieć o tym lekarzowi.", "それなら医師にそのことを伝えてください。", "In that case, please tell the doctor about it."],
    ]),
    lesson("診察の予約をする", "W przychodni", "doctor", "reflexive-and-time", "umówić wizytę、źle się czuć、najlepiej po、co dolegaを使い、予約から症状説明へ進みます。", [
      ["Chciałbym umówić wizytę, bo źle się czuję.", "具合が悪いので診察の予約を取りたいです。", "I would like to make an appointment because I feel unwell."],
      ["Czy może pan przyjść dzisiaj po południu?", "今日の午後に来られますか？", "Can you come this afternoon?"],
      ["Tak, najlepiej po siedemnastej.", "はい、17時以降が一番よいです。", "Yes, preferably after five."],
      ["Proszę opisać, co panu dolega.", "どんな症状があるか説明してください。", "Please describe what is wrong."],
      ["Boli mnie brzuch i od rana mam nudności.", "お腹が痛く、朝から吐き気があります。", "My stomach hurts and I have felt nauseous since morning."],
      ["Zbadamy pana i zdecydujemy o leczeniu.", "診察して治療を決めます。", "We will examine you and decide on treatment."],
    ]),
    lesson("薬局で薬を買う", "W aptece", "pharmacy", "modal-and-dosage", "na ból、bez recepty、należy przyjmować、łączyć zを使い、薬の種類と用法を確認します。", [
      ["Poproszę coś na ból głowy.", "頭痛に効くものをください。", "Something for a headache, please."],
      ["Czy woli pan tabletki czy syrop?", "錠剤とシロップのどちらがよいですか？", "Do you prefer tablets or syrup?"],
      ["Poproszę tabletki, ale bez recepty.", "錠剤を、処方箋なしでお願いします。", "Tablets, please, but without a prescription."],
      ["Jak często należy je przyjmować?", "どのくらいの頻度で服用すべきですか？", "How often should they be taken?"],
      ["Proszę przyjmować jedną tabletkę po jedzeniu.", "食後に1錠飲んでください。", "Please take one tablet after eating."],
      ["Czy mogę łączyć ten lek z innymi?", "この薬を他の薬と一緒に飲めますか？", "Can I combine this medicine with others?"],
    ]),
    lesson("医師の指示を理解する", "Zalecenia lekarza", "medical-advice", "imperative-and-condition", "powinienem、proszę unikać、jeśli nadalを使い、指示・条件・経過観察を確認します。", [
      ["Jak długo powinienem odpoczywać?", "どのくらい休むべきですか？", "How long should I rest?"],
      ["Przez kilka dni proszę unikać wysiłku.", "数日間は運動を避けてください。", "Please avoid exertion for a few days."],
      ["Czy mogę jutro iść do pracy?", "明日仕事へ行ってもよいですか？", "Can I go to work tomorrow?"],
      ["Jeśli nadal będzie gorączka, proszę zostać w domu.", "まだ熱があれば、家にいてください。", "If you still have a fever, please stay home."],
      ["Rozumiem, będę obserwować objawy.", "分かりました、症状を観察します。", "I understand, I will observe the symptoms."],
      ["Proszę skontaktować się z lekarzem, jeśli się pogorszą.", "悪化したら医師に連絡してください。", "Please contact a doctor if they get worse."],
    ]),
    lesson("緊急時に助けを求める", "Nagła sytuacja", "emergency", "imperative-and-perfective", "wezwać、stracić przytomność、oddychać、nie ruszaćを使い、緊急状況を短く正確に伝えます。", [
      ["Proszę wezwać karetkę, ktoś zasłabł.", "救急車を呼んでください、誰かが気を失いました。", "Please call an ambulance, someone fainted."],
      ["Co się stało i gdzie państwo jesteście?", "何が起きて、どこにいますか？", "What happened and where are you?"],
      ["Mężczyzna stracił przytomność przy wejściu do stacji.", "男性が駅の入口で意識を失いました。", "A man lost consciousness by the station entrance."],
      ["Czy oddycha?", "呼吸していますか？", "Is he breathing?"],
      ["Tak, oddycha, ale nie reaguje.", "はい、呼吸していますが、反応がありません。", "Yes, he is breathing, but he is not responding."],
      ["Proszę nie ruszać go i czekać na pomoc.", "動かさず、助けを待ってください。", "Please do not move him and wait for help."],
    ]),
    lesson("心身の状態を相談する", "Gorszy sen", "wellbeing", "reflexive-and-duration", "trudno mi、od kilku tygodni、ograniczać、porozmawiaćを使い、長く続く不調と対策を話します。", [
      ["Ostatnio trudno mi się skupić i źle sypiam.", "最近、集中しづらく、よく眠れません。", "Recently I find it hard to concentrate and I sleep badly."],
      ["Od jak dawna ma pan takie problemy?", "どのくらい前からその問題がありますか？", "How long have you had these problems?"],
      ["Od kilku tygodni, szczególnie kiedy mam dużo pracy.", "数週間前からで、特に仕事が多いときです。", "For several weeks, especially when I have a lot of work."],
      ["Czy próbował pan odpoczywać przed snem?", "寝る前に休もうとしてみましたか？", "Have you tried resting before sleep?"],
      ["Ograniczam telefon wieczorem i chodzę na spacery.", "夜は携帯を減らし、散歩しています。", "I limit my phone in the evening and go for walks."],
      ["To dobry początek, porozmawiajmy o dalszej pomocy.", "よい始まりです、今後の助けについて話しましょう。", "That is a good start; let us talk about further help."],
    ]),
  ]),
  unit(20, "役所・生活統合", "Sprawy urzędowe i życie w Polsce", "滞在、銀行、住所変更、修理、近所の行事、A2生活会話の統合を行います。", [
    lesson("滞在カードの申請", "Wniosek o kartę pobytu", "residence-office", "genitive-and-documents", "złożyć wniosek o、wymagany、brakuje、naprzeciwkoを使い、役所で書類を確認します。", [
      ["Chciałbym złożyć wniosek o kartę pobytu.", "滞在カードの申請をしたいです。", "I would like to submit an application for a residence card."],
      ["Czy ma pan wszystkie wymagane dokumenty?", "必要な書類はすべてありますか？", "Do you have all the required documents?"],
      ["Mam paszport, umowę najmu i potwierdzenie ubezpieczenia.", "パスポート、賃貸契約書、保険の証明があります。", "I have my passport, rental contract and proof of insurance."],
      ["Brakuje jeszcze aktualnego zdjęcia.", "最新の写真がまだ足りません。", "A current photo is still missing."],
      ["Gdzie mogę zrobić takie zdjęcie?", "そのような写真はどこで撮れますか？", "Where can I have such a photo taken?"],
      ["Fotograf jest naprzeciwko urzędu.", "写真店は役所の向かいにあります。", "The photographer is opposite the office."],
    ]),
    lesson("銀行口座を開く", "Otwieram konto", "bank-formal", "dative-and-formal", "otworzyć konto、formularz、rubryka、wyciąg elektronicznyを使い、銀行のフォームを確認します。", [
      ["Chciałbym otworzyć konto bankowe.", "銀行口座を開きたいです。", "I would like to open a bank account."],
      ["Czy ma pan numer PESEL i dokument tożsamości?", "PESEL番号と身分証明書をお持ちですか？", "Do you have a PESEL number and identity document?"],
      ["Mam PESEL, ale potrzebuję pomocy z formularzem.", "PESELはありますが、フォームの助けが必要です。", "I have a PESEL, but I need help with the form."],
      ["Proszę wpisać adres zamieszkania w tej rubryce.", "この欄に居住住所を記入してください。", "Please enter your home address in this field."],
      ["Czy mogę otrzymywać wyciągi elektronicznie?", "電子明細を受け取れますか？", "Can I receive electronic statements?"],
      ["Tak, włączymy tę usługę od razu.", "はい、このサービスをすぐに有効にします。", "Yes, we will activate this service right away."],
    ]),
    lesson("住所変更を届け出る", "Zmiana adresu", "official-address", "locative-and-date", "zgłosić zmianę、od kiedy、adres korespondencyjny、wysyłaćを使い、住所と郵便の変更を届け出ます。", [
      ["Chciałbym zgłosić zmianę adresu.", "住所変更を届け出たいです。", "I would like to report a change of address."],
      ["Od kiedy mieszka pan pod nowym adresem?", "いつから新住所に住んでいますか？", "Since when have you lived at the new address?"],
      ["Od pierwszego marca mieszkam przy ulicy Lipowej.", "3月1日からリポワ通りに住んでいます。", "Since the first of March I have lived on Lipowa Street."],
      ["Czy chce pan także zmienić adres korespondencyjny?", "郵送先住所も変更しますか？", "Do you also want to change the correspondence address?"],
      ["Tak, proszę wysyłać listy na nowy adres.", "はい、手紙を新住所に送ってください。", "Yes, please send letters to the new address."],
      ["Zapisaliśmy zmianę i wyślemy potwierdzenie.", "変更を記録し、確認を送ります。", "We recorded the change and will send confirmation."],
    ]),
    lesson("家電の修理を依頼する", "Naprawa pralki", "repair", "past-and-relative", "zgłosić problem、gwarancja、usterka、umówić technikaを使い、故障の内容と保証を説明します。", [
      ["Chciałbym zgłosić problem z pralką.", "洗濯機の問題を報告したいです。", "I would like to report a problem with the washing machine."],
      ["Czy urządzenie jest jeszcze na gwarancji?", "機器はまだ保証期間内ですか？", "Is the device still under warranty?"],
      ["Tak, kupiłem je sześć miesięcy temu.", "はい、6か月前に買いました。", "Yes, I bought it six months ago."],
      ["Proszę opisać usterkę.", "故障を説明してください。", "Please describe the fault."],
      ["Pralka zatrzymuje się podczas wirowania.", "洗濯機が脱水中に止まります。", "The washing machine stops during spinning."],
      ["Umówimy technika na najbliższy wolny termin.", "最も早い空き時間に技術者を手配します。", "We will arrange a technician for the nearest available slot."],
    ]),
    lesson("近所の集まりを準備する", "Spotkanie sąsiadów", "community", "conditional-and-dative", "organizować、przydałoby się、żeby、przygotowaćを使い、近所の役割分担を相談します。", [
      ["W sobotę organizujemy spotkanie dla sąsiadów.", "土曜日に近所の人の集まりを企画しています。", "On Saturday we are organising a gathering for the neighbours."],
      ["Czy potrzebują państwo pomocy?", "皆さんは助けが必要ですか？", "Do you need any help?"],
      ["Przydałoby się, żeby ktoś przyniósł napoje.", "誰かが飲み物を持ってきてくれると助かります。", "It would be useful if someone brought drinks."],
      ["Mogę kupić wodę i sok.", "水とジュースを買えます。", "I can buy water and juice."],
      ["Świetnie, a my przygotujemy jedzenie.", "すばらしい、私たちは食べ物を準備します。", "Great, and we will prepare the food."],
      ["O której zaczynamy przygotowania?", "何時に準備を始めますか？", "What time do we start preparing?"],
    ]),
    lesson("A2の会話を振り返る", "Potrafię rozmawiać", "integration", "reported-and-rephrase", "potrafić、najtrudniejsze było、powtórzyć i powiedzieć prościejを使い、会話方略と自己評価を言語化します。", [
      ["Potrafię już załatwić prostą sprawę po polsku.", "もうポーランド語で簡単な用事を済ませられます。", "I can now handle a simple matter in Polish."],
      ["Co było dla pana najtrudniejsze?", "何が一番難しかったですか？", "What was the most difficult thing for you?"],
      ["Najtrudniejsze było zrozumienie szybkiej odpowiedzi.", "速い返答を理解するのが一番難しかったです。", "Understanding a fast reply was the most difficult."],
      ["Jak poprosił pan o wyjaśnienie?", "どうやって説明を求めましたか？", "How did you ask for an explanation?"],
      ["Powiedziałem: Czy może pan powtórzyć i powiedzieć to prościej?", "「もう一度言って、もっと簡単に言えますか」と言いました。", "I said: Could you repeat and say it more simply?"],
      ["To ważna umiejętność, proszę używać jej także poza lekcją.", "それは大切な技能です、授業以外でも使ってください。", "That is an important skill; please use it outside the lesson too."],
    ]),
  ]),
];

const a1CanDo = [
  ["挨拶と簡単な自己紹介ができる", "相手の名前・出身を聞き取れる", "分からないときゆっくり話してもらえる"],
  ["数字・値段・時刻を言える", "曜日と日付を確認できる", "電話番号を聞き返せる"],
  ["店で商品と数量を言える", "値段と支払い方法を尋ねられる", "簡単な買い物の返答を理解できる"],
  ["飲み物や料理を注文できる", "好みと避けたい物を言える", "会計の短い返答を理解できる"],
  ["切符を買える", "行き先と方向を尋ねられる", "交通の短い案内を理解できる"],
  ["部屋と設備を簡単に説明できる", "場所を前置詞で言える", "住居の短い説明を理解できる"],
  ["仕事と日課を簡単に言える", "予定について質問できる", "職業の短い返答を理解できる"],
  ["症状を一言で伝えられる", "薬局で基本的な物を頼める", "医療の簡単な指示を理解できる"],
  ["郵便や役所で目的を言える", "簡単な本人確認に答えられる", "窓口の短い案内を理解できる"],
  ["A1の表現を場面で組み合わせられる", "短い質問と返答を続けられる", "聞き返しを使って会話を維持できる"],
];
const a2CanDo = [
  ["仕事・出身・家族をつないで自己紹介できる", "相手の家族や仕事の説明の要点を聞き取れる", "相手に一つ質問を返して会話を続けられる"],
  ["日課と予定を時刻・曜日付きで説明できる", "天気予報の要点を聞き取れる", "予定を変更し理由を短く言える"],
  ["昨日の出来事を順序立てて話せる", "相手の過去の質問を理解できる", "未来の希望と理由を一文ずつ言える"],
  ["趣味や好みを理由付きで説明できる", "比較と意見の返答を理解できる", "文化・スポーツの話題で質問し返せる"],
  ["道案内を尋ねて要点を確認できる", "切符・ホテル・荷物の問題を説明できる", "旅行相手の案内や代案を聞き取れる"],
  ["住居の条件と故障を具体的に伝えられる", "家賃・契約・修理の説明を理解できる", "近所の人に依頼と感謝を伝えられる"],
  ["仕事の業務と期限を説明できる", "電話で聞き返しと綴り確認ができる", "予約変更の相手の返答を理解できる"],
  ["数量・返品・アレルギーを説明できる", "銀行・郵便の確認質問を理解できる", "店員へ希望を言い換えて伝えられる"],
  ["症状・服薬・緊急状況を短く正確に伝えられる", "医師・薬剤師の基本指示を聞き取れる", "体調の変化と助けの必要を言える"],
  ["役所・銀行・修理の目的を説明できる", "書類・住所・保証の質問に答えられる", "分からない返答を言い換えてもらえる"],
];

function sql(value) { return "'" + String(value).replaceAll("'", "''") + "'"; }
function sqlJson(value) { return sql(JSON.stringify(value)); }
function stripFinal(value) { return value.replace(/[.!?。！？]+$/u, ""); }
function tokensFor(value) { return value.trim().split(/\s+/u); }
function clozeFor(value) {
  const tokens = tokensFor(value);
  const index = Math.min(tokens.length - 1, Math.max(0, Math.floor(tokens.length / 2)));
  return { answer: tokens[index] ?? value.trim(), prefix: tokens.slice(0, index).join(" "), suffix: tokens.slice(index + 1).join(" ") };
}
function inferRegister(polish) {
  if (/(?:pan|pani|państwo|proszę|urzęd|rezerwację|przychodni)/u.test(polish)) return "formal";
  if (/(?:ty|cię|ci|masz|chcesz|możesz|twoj|twoją|wolisz|jesteś)/u.test(polish)) return "informal";
  return "neutral";
}
function inferGender(polish, role) {
  if (role === "learner") return "male";
  if (/(?:pani|kobiet)/u.test(polish)) return "female";
  if (/(?:pan|mężczyzna)/u.test(polish)) return "male";
  return "any";
}
function skillsFor(role) { return role === "learner" ? ["spoken_production", "spoken_interaction"] : ["listening", "spoken_interaction"]; }
function itemRecord(unitNumber, lessonNumber, lessonMeta, item, index) {
  const [polish, meaningJa, meaningEn] = item;
  const role = index % 2 === 0 ? "learner" : "partner";
  const register = inferRegister(polish);
  const gender = inferGender(polish, role);
  const id = `a2-u${unitNumber - 10}-l${lessonNumber}-i${String(index + 1).padStart(2, "0")}`;
  const tags = ["cefr:a2", `scene:${lessonMeta.scene}`, `grammar:${lessonMeta.grammarTag}`, `register:${register}`, `role:${role}`, "speaker:male", ...skillsFor(role).map((skill) => `skill:${skill}`)];
  const roleNote = role === "learner" ? "自分の発話として、男性話者の形を基準に練習する。" : "相手の典型的な質問・返答として聞き取り、必要なら言い換えを求める。";
  return { id, type: "sentence", polish, meaningJa, meaningEn, grammarNote: `${lessonMeta.grammarNote}${roleNote} レジスターは${register}、教材内の学習者は男性話者を想定する。`, topic: lessonMeta.scene, scene: lessonMeta.scene, tags, acceptedAnswers: [stripFinal(polish), polish], contentVersion: version, cefrLevel: "A2", skills: skillsFor(role), register, speakerGender: "male", dialogueRole: role, sourceKind: "independent" };
}

const items = [];
const lessons = [];
const missions = [];
const cando = [];
for (const [unitIndex, unitMeta] of a2Units.entries()) {
  const unitId = `a2-unit-${unitIndex + 1}`;
  const unitCandoIds = [];
  for (let i = 0; i < 3; i += 1) {
    const id = `a2-u${unitIndex + 1}-c${i + 1}`;
    unitCandoIds.push(id);
    cando.push({ id, unitId, code: `A2-U${unitIndex + 1}-C${i + 1}`, cefrLevel: "A2", skill: ["spoken_production", "listening", "spoken_interaction"][i], statementJa: a2CanDo[unitIndex][i], statementPl: ["Potrafię mówić o sobie i zadawać pytania.", "Potrafię zrozumieć główny sens krótkiej wypowiedzi.", "Potrafię podtrzymać prostą rozmowę."][i], evidenceRule: "教材の想起成績とVoice mission自己評価を別々に確認する。", sortOrder: i + 1 });
  }
  for (const [lessonIndex, lessonMeta] of unitMeta.lessons.entries()) {
    const lessonNumber = lessonIndex + 1;
    const lessonId = `a2-u${unitIndex + 1}-l${lessonNumber}`;
    const lessonItems = lessonMeta.items.map((item, index) => itemRecord(unitMeta.unitNumber, lessonNumber, lessonMeta, item, index));
    items.push(...lessonItems);
    lessons.push({ id: lessonId, unitId, unitNumber: unitIndex + 1, lessonNumber, titleJa: lessonMeta.titleJa, titlePl: lessonMeta.titlePl, description: `${lessonMeta.grammarNote} 代表的な相手の返答も含めて、短い往復を練習します。`, estimatedMinutes: 9, itemIds: lessonItems.map((item) => item.id), coreItemIds: lessonItems.slice(0, 2).map((item) => item.id), questionTypes: ["multiple_choice", "multiple_choice", "cloze", "unscramble", "free_input", "multiple_choice", "multiple_choice", "cloze", "unscramble", "free_input", "free_input", "free_input", "free_input", "free_input"], missionId: `${lessonId}-mission`, candoIds: unitCandoIds });
    const learnerItems = lessonItems.filter((item) => item.dialogueRole === "learner");
    const partnerItems = lessonItems.filter((item) => item.dialogueRole === "partner");
    missions.push({ id: `${lessonId}-mission`, unitId, lessonId, title: `${lessonMeta.titleJa} Voice mission`, scenario: `${unitMeta.titleJa}の場面で、ポーランド在住者として相手と短い会話を成立させる。`, learnerRole: "ポーランド在住の成人学習者（男性話者想定）", partnerRole: "場面に応じた店員・同僚・近所の人・医療者・友人", objective: "必須表現を3つ以上使い、相手の返答を1つ聞き取り、質問を1つ返す。", learnerItemIds: learnerItems.map((item) => item.id), partnerItemIds: partnerItems.map((item) => item.id), requiredItemIds: lessonItems.map((item) => item.id), partnerBehavior: "相手は最初の返答を通常速度で行い、聞き返されたら一度だけ短く言い換える。", difficultyLevel: "A2", endingCondition: "最低3往復し、相手への質問または確認を1回入れて、用件を終える。", feedbackFormat: "聞き取れた表現、返答できた内容、質問し返せたか、言い換えが必要だった箇所を最後に2点だけ振り返る。" });
  }
}

const existingA1Units = oldCurriculum.units.map((oldUnit) => ({
  id: `a1-unit-${oldUnit.n}`,
  unitNumber: oldUnit.n,
  level: "A1",
  titleJa: oldUnit.titleJa,
  titlePl: oldUnit.titlePl,
  description: "A1教材を段階的に復習し、生活場面の入口を作ります。",
  lessons: oldUnit.lessons.map((oldLesson) => ({ ...oldLesson, level: "A1", stepCount: 5, coreItemIds: oldLesson.itemIds.slice(0, 2), missionId: `a1-u${oldUnit.n}-l${oldLesson.lessonNumber}-mission`, candoIds: [`a1-u${oldUnit.n}-c1`, `a1-u${oldUnit.n}-c2`, `a1-u${oldUnit.n}-c3`] })),
}));
for (const [index, oldUnit] of existingA1Units.entries()) {
  const unitId = oldUnit.id;
  for (let i = 0; i < 3; i += 1) {
    const id = `a1-u${oldUnit.unitNumber}-c${i + 1}`;
    cando.push({ id, unitId, code: `A1-U${oldUnit.unitNumber}-C${i + 1}`, cefrLevel: "A1", skill: ["spoken_production", "listening", "spoken_interaction"][i], statementJa: a1CanDo[index][i], statementPl: ["Potrafię przedstawić się.", "Potrafię zrozumieć krótkie pytanie.", "Potrafię poprosić o powtórzenie."][i], evidenceRule: "教材の想起成績とVoice mission自己評価を別々に確認する。", sortOrder: i + 1 });
  }
  for (const oldLesson of oldUnit.lessons) missions.push({ id: oldLesson.missionId, unitId, lessonId: oldLesson.id, title: `${oldLesson.id} Voice mission`, scenario: `${oldUnit.titleJa}の基本場面で短いやり取りをする。`, learnerRole: "ポーランド在住の成人学習者（男性話者想定）", partnerRole: "親しい相手または生活場面の相手", objective: "A1の必須表現を2つ以上使い、相手の短い返答を一つ理解する。", learnerItemIds: oldLesson.itemIds.filter((_, i) => i % 2 === 0), partnerItemIds: oldLesson.itemIds.filter((_, i) => i % 2 === 1), requiredItemIds: oldLesson.itemIds, partnerBehavior: "相手は短く明瞭に返答し、聞き返されたらゆっくり言い直す。", difficultyLevel: "A1", endingCondition: "2往復して、挨拶・質問・依頼のいずれかで会話を終える。", feedbackFormat: "聞き取れたか、返答できたか、言い直しが必要だったかを記録する。" });
}

const allUnits = [...existingA1Units, ...a2Units.map((meta, index) => ({ id: `a2-unit-${index + 1}`, unitNumber: index + 1, level: "A2", titleJa: meta.titleJa, titlePl: meta.titlePl, description: meta.description, lessons: lessons.filter((item) => item.unitNumber === index + 1) }))];
const curriculum = { version, track: "A1+A2", units: allUnits, exerciseTypes: ["multiple_choice", "cloze", "unscramble", "free_input"] };

const sqlLines = [
  "PRAGMA foreign_keys = ON;",
  "ALTER TABLE pl_units ADD COLUMN cefr_level TEXT NOT NULL DEFAULT 'A1';",
  "ALTER TABLE pl_learning_items ADD COLUMN cefr_level TEXT NOT NULL DEFAULT 'A1';",
  "ALTER TABLE pl_learning_items ADD COLUMN skills_json TEXT NOT NULL DEFAULT '[\"spoken_interaction\"]';",
  "ALTER TABLE pl_learning_items ADD COLUMN scene TEXT NOT NULL DEFAULT 'general';",
  "ALTER TABLE pl_learning_items ADD COLUMN register TEXT NOT NULL DEFAULT 'neutral';",
  "ALTER TABLE pl_learning_items ADD COLUMN speaker_gender TEXT NOT NULL DEFAULT 'any';",
  "ALTER TABLE pl_learning_items ADD COLUMN dialogue_role TEXT NOT NULL DEFAULT 'learner';",
  "ALTER TABLE pl_learning_items ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'independent';",
  "UPDATE pl_units SET cefr_level = 'A1' WHERE cefr_level = 'A1';",
  "UPDATE pl_learning_items SET cefr_level = 'A1', skills_json = '[\"spoken_production\",\"spoken_interaction\"]', scene = topic, register = 'neutral', speaker_gender = 'any', dialogue_role = 'learner', source_kind = 'independent' WHERE content_version LIKE 'a1-%';",
  "INSERT OR IGNORE INTO pl_tracks (id, code, title, cefr, content_version, status, created_at) VALUES ('track-a2', 'A2', 'Polski Loop A2', 'A2', 'a2-2026.1', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now'));",
  "INSERT OR IGNORE INTO pl_content_versions (version, track_id, status, notes, created_at) VALUES ('a2-2026.1', 'track-a2', 'published', 'A2生活特化教材。独自作成、各lesson 6表現・14段階step。', strftime('%Y-%m-%dT%H:%M:%fZ','now'));",
  "CREATE TABLE IF NOT EXISTS pl_voice_missions (id TEXT PRIMARY KEY, unit_id TEXT NOT NULL REFERENCES pl_units(id), lesson_id TEXT NOT NULL UNIQUE REFERENCES pl_lessons(id), title TEXT NOT NULL, scenario TEXT NOT NULL, learner_role TEXT NOT NULL, partner_role TEXT NOT NULL, objective TEXT NOT NULL, learner_item_ids_json TEXT NOT NULL, partner_item_ids_json TEXT NOT NULL, required_item_ids_json TEXT NOT NULL, partner_behavior TEXT NOT NULL, difficulty_level TEXT NOT NULL CHECK (difficulty_level IN ('A1','A2')), ending_condition TEXT NOT NULL, feedback_format TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','retired')), created_at TEXT NOT NULL);",
  "CREATE TABLE IF NOT EXISTS pl_voice_attempts (id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, profile_id TEXT NOT NULL REFERENCES pl_profiles(id), mission_id TEXT NOT NULL REFERENCES pl_voice_missions(id), session_id TEXT REFERENCES pl_study_sessions(id), heard INTEGER NOT NULL CHECK (heard IN (0,1)), replied INTEGER NOT NULL CHECK (replied IN (0,1)), asked_back INTEGER NOT NULL CHECK (asked_back IN (0,1)), rephrased INTEGER NOT NULL CHECK (rephrased IN (0,1)), confidence INTEGER NOT NULL CHECK (confidence BETWEEN 1 AND 5), notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);",
  "CREATE TABLE IF NOT EXISTS pl_cando_items (id TEXT PRIMARY KEY, unit_id TEXT NOT NULL REFERENCES pl_units(id), code TEXT NOT NULL UNIQUE, cefr_level TEXT NOT NULL CHECK (cefr_level IN ('A1','A2')), skill TEXT NOT NULL CHECK (skill IN ('listening','spoken_interaction','spoken_production')), statement_ja TEXT NOT NULL, statement_pl TEXT NOT NULL, evidence_rule TEXT NOT NULL, sort_order INTEGER NOT NULL, created_at TEXT NOT NULL);",
  "CREATE TABLE IF NOT EXISTS pl_cando_progress (profile_id TEXT NOT NULL REFERENCES pl_profiles(id), cando_id TEXT NOT NULL REFERENCES pl_cando_items(id), status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','practicing','self_assessed','evidenced')), self_rating INTEGER CHECK (self_rating BETWEEN 1 AND 5), evidence_notes TEXT NOT NULL DEFAULT '', last_mission_attempt_id TEXT REFERENCES pl_voice_attempts(id), updated_at TEXT NOT NULL, PRIMARY KEY (profile_id, cando_id));",
  "ALTER TABLE pl_chatgpt_prompts ADD COLUMN mission_id TEXT REFERENCES pl_voice_missions(id);",
  "CREATE INDEX IF NOT EXISTS idx_pl_voice_attempts_profile_created ON pl_voice_attempts(profile_id, created_at DESC);",
  "CREATE INDEX IF NOT EXISTS idx_pl_cando_unit_order ON pl_cando_items(unit_id, sort_order);",
];

for (const meta of a2Units) {
  const unitIndex = meta.unitNumber - 10;
  const unitId = `a2-unit-${unitIndex}`;
  sqlLines.push(`INSERT OR IGNORE INTO pl_units (id, track_id, unit_number, title_ja, title_pl, description, status, cefr_level) VALUES (${sql(unitId)}, 'track-a2', ${unitIndex}, ${sql(meta.titleJa)}, ${sql(meta.titlePl)}, ${sql(meta.description)}, 'published', 'A2');`);
  for (const [lessonIndex, lessonMeta] of meta.lessons.entries()) {
    const lessonNumber = lessonIndex + 1;
    const lessonId = `a2-u${unitIndex}-l${lessonNumber}`;
    sqlLines.push(`INSERT OR IGNORE INTO pl_lessons (id, unit_id, lesson_number, title_ja, title_pl, description, estimated_minutes, status) VALUES (${sql(lessonId)}, ${sql(unitId)}, ${lessonNumber}, ${sql(lessonMeta.titleJa)}, ${sql(lessonMeta.titlePl)}, ${sql(lessonMeta.grammarNote + " 代表的な相手の返答も含めて、短い往復を練習します。")}, 9, 'published');`);
    const lessonItems = lessonMeta.items.map((item, index) => itemRecord(meta.unitNumber, lessonNumber, lessonMeta, item, index));
    for (const item of lessonItems) sqlLines.push(`INSERT OR IGNORE INTO pl_learning_items (id, type, polish, meaning_ja, meaning_en, grammar_note, topic, tags_json, accepted_answers_json, content_version, status, created_at, cefr_level, skills_json, scene, register, speaker_gender, dialogue_role, source_kind) VALUES (${sql(item.id)}, ${sql(item.type)}, ${sql(item.polish)}, ${sql(item.meaningJa)}, ${sql(item.meaningEn)}, ${sql(item.grammarNote)}, ${sql(item.topic)}, ${sqlJson(item.tags)}, ${sqlJson(item.acceptedAnswers)}, ${sql(item.contentVersion)}, 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now'), ${sql(item.cefrLevel)}, ${sqlJson(item.skills)}, ${sql(item.scene)}, ${sql(item.register)}, ${sql(item.speakerGender)}, ${sql(item.dialogueRole)}, ${sql(item.sourceKind)});`);
    const stepItems = [lessonItems[0], lessonItems[1]];
    for (const [coreIndex, item] of stepItems.entries()) {
      const distractors = coreIndex === 0 ? [lessonItems[2], lessonItems[4], lessonItems[5]] : [lessonItems[3], lessonItems[5], lessonItems[0]];
      const optionsMeaning = [item, ...distractors].map((candidate) => ({ value: candidate.polish, label: candidate.polish }));
      const optionsReverse = [item, ...distractors].map((candidate) => ({ value: candidate.meaningJa, label: candidate.meaningJa }));
      const cloze = clozeFor(item.polish);
      const prefix = coreIndex * 5;
      const stepRows = [
        { number: prefix + 1, kind: "choice", type: "multiple_choice", direction: "meaning_to_polish", answer: item.polish, prompt: `「${item.meaningJa}」に合うポーランド語を選びましょう。`, options: optionsMeaning, scaffold: 0, hint: "意味から形を認識する" },
        { number: prefix + 2, kind: "choice", type: "multiple_choice", direction: "polish_to_meaning", answer: item.meaningJa, prompt: `「${item.polish}」の意味を選びましょう。`, options: optionsReverse, scaffold: 0, hint: "形から意味を認識する" },
        { number: prefix + 3, kind: "input", type: "cloze", direction: "meaning_to_polish", answer: cloze.answer, prompt: `「${item.meaningJa}」の文を完成させましょう。`, options: null, scaffold: 1, hint: "文の一部を手がかりにする" },
        { number: prefix + 4, kind: "input", type: "unscramble", direction: "meaning_to_polish", answer: item.polish, prompt: `「${item.meaningJa}」になるように語順を並べ替えましょう。`, options: null, scaffold: 1, hint: "語順を組み立てる" },
        { number: prefix + 5, kind: "input", type: "free_input", direction: "meaning_to_polish", answer: item.polish, prompt: `「${item.meaningJa}」をポーランド語で言いましょう。`, options: [], scaffold: 2, hint: "手がかりなしで思い出す" },
      ];
      for (const row of stepRows) sqlLines.push(`INSERT OR IGNORE INTO pl_lesson_steps (id, lesson_id, step_number, kind, item_id, prompt_ja, explanation, options_json, question_type, direction, answer_text, cloze_prefix, cloze_suffix, cloze_answer, tokens_json, scaffold_level, hint_text) VALUES (${sql(`${lessonId}-s${row.number}`)}, ${sql(lessonId)}, ${row.number}, ${sql(row.kind)}, ${sql(item.id)}, ${sql(row.prompt)}, ${sql(lessonMeta.grammarNote)}, ${row.options === null ? "NULL" : sqlJson(row.options)}, ${sql(row.type)}, ${sql(row.direction)}, ${sql(row.answer)}, ${sql(row.type === "cloze" ? cloze.prefix : "")}, ${sql(row.type === "cloze" ? cloze.suffix : "")}, ${sql(row.type === "cloze" ? cloze.answer : "")}, ${sqlJson(row.type === "unscramble" ? tokensFor(item.polish) : [])}, ${row.scaffold}, ${sql(row.hint)});`);
    }
    for (const [extraIndex, extraItem] of lessonItems.slice(2).entries()) {
      const number = 11 + extraIndex;
      sqlLines.push(`INSERT OR IGNORE INTO pl_lesson_steps (id, lesson_id, step_number, kind, item_id, prompt_ja, explanation, options_json, question_type, direction, answer_text, cloze_prefix, cloze_suffix, cloze_answer, tokens_json, scaffold_level, hint_text) VALUES (${sql(`${lessonId}-s${number}`)}, ${sql(lessonId)}, ${number}, 'input', ${sql(extraItem.id)}, ${sql(`「${extraItem.meaningJa}」をポーランド語で言いましょう。`)}, ${sql(lessonMeta.grammarNote)}, ${sqlJson([])}, 'free_input', 'meaning_to_polish', ${sql(extraItem.polish)}, '', '', '', ${sqlJson([])}, 2, '手がかりなしで思い出す');`);
    }
  }
}

for (const mission of missions) sqlLines.push(`INSERT OR IGNORE INTO pl_voice_missions (id, unit_id, lesson_id, title, scenario, learner_role, partner_role, objective, learner_item_ids_json, partner_item_ids_json, required_item_ids_json, partner_behavior, difficulty_level, ending_condition, feedback_format, status, created_at) VALUES (${sql(mission.id)}, ${sql(mission.unitId)}, ${sql(mission.lessonId)}, ${sql(mission.title)}, ${sql(mission.scenario)}, ${sql(mission.learnerRole)}, ${sql(mission.partnerRole)}, ${sql(mission.objective)}, ${sqlJson(mission.learnerItemIds)}, ${sqlJson(mission.partnerItemIds)}, ${sqlJson(mission.requiredItemIds)}, ${sql(mission.partnerBehavior)}, ${sql(mission.difficultyLevel)}, ${sql(mission.endingCondition)}, ${sql(mission.feedbackFormat)}, 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now'));`);
for (const entry of cando) sqlLines.push(`INSERT OR IGNORE INTO pl_cando_items (id, unit_id, code, cefr_level, skill, statement_ja, statement_pl, evidence_rule, sort_order, created_at) VALUES (${sql(entry.id)}, ${sql(entry.unitId)}, ${sql(entry.code)}, ${sql(entry.cefrLevel)}, ${sql(entry.skill)}, ${sql(entry.statementJa)}, ${sql(entry.statementPl)}, ${sql(entry.evidenceRule)}, ${entry.sortOrder}, strftime('%Y-%m-%dT%H:%M:%fZ','now'));`);

writeFileSync(resolve(root, "migrations/0005_a2_missions_content.sql"), sqlLines.join("\n") + "\n");
writeFileSync(resolve(root, "content/a1-a2-curriculum.json"), JSON.stringify(curriculum, null, 2) + "\n");
console.log(`generated ${items.length} A2 items, ${lessons.length} A2 lessons, ${missions.length} missions, ${cando.length} can-do rows`);

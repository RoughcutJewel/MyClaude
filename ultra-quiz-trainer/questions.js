// ウルトラクイズ特訓 問題バンク
// スキーマ:
//   id:          永続一意の文字列。一度発行したら変更・再利用しない (localStorage の成績がこのキーに紐づくため)
//   type:        "ox" (○×) | "choice" (三択) | "hayaoshi" (早押し)
//   genre:       ジャンル名 (日本語)
//   question:    問題文
//   answer:      ox: true=○ / false=× | choice: choices のインデックス | hayaoshi: 正解文字列
//   choices:     choice のみ。選択肢の配列
//   explanation: 解説 (正解表示時に出す)
//   note:        出典メモ (作問根拠。verified 判定の材料)
//   source_url:  裏取りに使った URL (無ければ空文字)
//   verified:    ユーザーの目視レビューを通過したら true。AI が生成した直後は必ず false
//
// 運用ルール: AI 生成問題は小バッチで追加し「一覧」画面でレビュー → 承認されたものだけ verified: true に更新する。

const QUESTION_BANK_VERSION = 1;

const QUESTIONS = [
  // --- smoke バッチ (誰でも即座に正誤判定できる基礎問題。動作確認用) ---
  {
    id: "ox-smoke-001", type: "ox", genre: "基礎確認",
    question: "富士山は日本で最も高い山である。",
    answer: true,
    explanation: "富士山の標高は3776mで日本一。2位は南アルプスの北岳 (3193m)。",
    note: "基礎事実", source_url: "", verified: false
  },
  {
    id: "ox-smoke-002", type: "ox", genre: "基礎確認",
    question: "太陽は西から昇る。",
    answer: false,
    explanation: "太陽は東から昇り西に沈む。地球の自転の向きによる。",
    note: "基礎事実", source_url: "", verified: false
  },
  {
    id: "ox-smoke-003", type: "ox", genre: "基礎確認",
    question: "水は1気圧のもとで0℃で沸騰する。",
    answer: false,
    explanation: "1気圧での沸点は100℃。0℃は氷になる温度 (凝固点)。",
    note: "基礎事実", source_url: "", verified: false
  },
  {
    id: "ox-smoke-004", type: "ox", genre: "基礎確認",
    question: "日本の都道府県の数は47である。",
    answer: true,
    explanation: "1都1道2府43県で合計47。",
    note: "基礎事実", source_url: "", verified: false
  },
  {
    id: "ox-smoke-005", type: "ox", genre: "基礎確認",
    question: "光の速さは音の速さより速い。",
    answer: true,
    explanation: "光は約30万km/秒、音は空気中で約340m/秒。雷が光ってから音が遅れて届くのはこのため。",
    note: "基礎事実", source_url: "", verified: false
  },
  {
    id: "ox-smoke-006", type: "ox", genre: "基礎確認",
    question: "アメリカ合衆国の首都はニューヨークである。",
    answer: false,
    explanation: "首都はワシントンD.C.。ニューヨークは最大都市だが首都ではない。",
    note: "基礎事実", source_url: "", verified: false
  },
  {
    id: "ox-smoke-007", type: "ox", genre: "基礎確認",
    question: "1年は必ず365日である。",
    answer: false,
    explanation: "うるう年は366日ある。「必ず」が誤り。○×クイズの典型的な断定語ひっかけ。",
    note: "基礎事実", source_url: "", verified: false
  },
  {
    id: "ox-smoke-008", type: "ox", genre: "基礎確認",
    question: "サッカーは1チーム11人で行う競技である。",
    answer: true,
    explanation: "フィールドプレーヤー10人+ゴールキーパー1人の11人。",
    note: "基礎事実", source_url: "", verified: false
  },
  {
    id: "ox-smoke-009", type: "ox", genre: "基礎確認",
    question: "地球は太陽の周りを公転している。",
    answer: true,
    explanation: "公転周期が約365日で、これが1年の長さのもとになっている。",
    note: "基礎事実", source_url: "", verified: false
  },
  {
    id: "ox-smoke-010", type: "ox", genre: "基礎確認",
    question: "漢数字の「一」の画数は2画である。",
    answer: false,
    explanation: "「一」は1画。",
    note: "基礎事実", source_url: "", verified: false
  },

  // --- 自由の女神バッチ (2026-07-20生成。research-notes/quiz-content/statue-of-liberty.md 参照) ---
  {
    id: "ox-sol-001", type: "ox", genre: "自由の女神",
    question: "自由の女神は、右手にたいまつを掲げている。",
    answer: true,
    explanation: "右手にたいまつ、左手に独立宣言の日付を刻んだ銘板を持つ。「左手」との言い換えは定番のひっかけ。",
    note: "NPS公式・Wikipedia日本語版の2ソースで確認",
    source_url: "https://www.nps.gov/stli/learn/statue-of-liberty-facts.htm", verified: false
  },
  {
    id: "ox-sol-002", type: "ox", genre: "自由の女神",
    question: "自由の女神が左手に持つ銘板には、独立記念日の日付がアラビア数字で刻まれている。",
    answer: false,
    explanation: "「JULY IV MDCCLXXVI」とローマ数字で刻まれている。アラビア数字ではない。",
    note: "NPS公式・Wikipedia日本語版の2ソースで確認",
    source_url: "https://www.nps.gov/stli/learn/statue-of-liberty-facts.htm", verified: false
  },
  {
    id: "ox-sol-003", type: "ox", genre: "自由の女神",
    question: "自由の女神の王冠には7本のとげがあり、7つの大陸と7つの海を象徴しているとされる。",
    answer: true,
    explanation: "王冠の7本のとげは七大陸・七つの海への自由の広がりを象徴すると説明される。",
    note: "Wikipedia日本語版で確認",
    source_url: "https://ja.wikipedia.org/wiki/自由の女神像_(ニューヨーク)", verified: false
  },
  {
    id: "ox-sol-004", type: "ox", genre: "自由の女神",
    question: "自由の女神は、アメリカ独立100周年にあたる1876年に完成し、除幕式が行われた。",
    answer: false,
    explanation: "独立100周年を記念する構想だったが、実際の完成・除幕式は1886年10月28日で、10年遅れた。",
    note: "NPS公式・Wikipedia日本語版の2ソースで確認",
    source_url: "https://www.nps.gov/stli/learn/statue-of-liberty-facts.htm", verified: false
  },
  {
    id: "ox-sol-005", type: "ox", genre: "自由の女神",
    question: "自由の女神を贈ったのはフランスである。",
    answer: true,
    explanation: "米仏の友好の証として、フランスからアメリカへ贈られた。",
    note: "NPS公式・Wikipedia日本語版の2ソースで確認",
    source_url: "https://www.nps.gov/stli/learn/statue-of-liberty-facts.htm", verified: false
  },
  {
    id: "ox-sol-006", type: "ox", genre: "自由の女神",
    question: "自由の女神の彫刻を設計したのはフレデリック=オーギュスト・バルトルディである。",
    answer: true,
    explanation: "彫刻家バルトルディが設計。台座はリチャード・モリス・ハントが設計した。",
    note: "NPS公式・Wikipedia日本語版の2ソースで確認",
    source_url: "https://www.nps.gov/stli/learn/statue-of-liberty-facts.htm", verified: false
  },
  {
    id: "ox-sol-007", type: "ox", genre: "自由の女神",
    question: "自由の女神の構造設計に携わったギュスターヴ・エッフェルは、パリのエッフェル塔を設計したのと同一人物である。",
    answer: true,
    explanation: "エッフェル塔の設計で知られるギュスターヴ・エッフェルが、自由の女神の内部構造(鉄骨フレーム)の設計に関わった。",
    note: "NPS公式・Wikipedia日本語版の2ソースで確認",
    source_url: "https://www.nps.gov/stli/learn/statue-of-liberty-facts.htm", verified: false
  },
  {
    id: "ox-sol-008", type: "ox", genre: "自由の女神",
    question: "自由の女神の台座建設費用は、アメリカ連邦政府の予算でまかなわれた。",
    answer: false,
    explanation: "台座の建設資金は、新聞「ニューヨーク・ワールド」紙社主ジョーゼフ・ピューリッツァーの寄付キャンペーンによる、アメリカ国民からの寄付でまかなわれた。",
    note: "Wikipedia日本語版で確認",
    source_url: "https://ja.wikipedia.org/wiki/自由の女神像_(ニューヨーク)", verified: false
  },
  {
    id: "ox-sol-009", type: "ox", genre: "自由の女神",
    question: "自由の女神は、1886年から1902年まで、アメリカの公式灯台として運用されていた。",
    answer: true,
    explanation: "1886年11月にクリーブランド大統領の命令で公式灯台として運用開始、1902年3月に運用終了した。",
    note: "米国灯台史の資料(Hudson River Lighthouses)で独立に確認",
    source_url: "https://www.hudsonriverlighthouses.org/statue-of-liberty.html", verified: false
  },
  {
    id: "ox-sol-010", type: "ox", genre: "自由の女神",
    question: "「自由の女神」という日本語の訳語は、第二次世界大戦後に定着した。",
    answer: false,
    explanation: "明治19年(1886年)の郵便報知新聞が最初に「女神」と訳し、その後の表記ゆれを経て1920年代〜1930年頃に「自由の女神」表記が定着したとされる。戦後の定着ではない。",
    note: "単一ソース(Yahoo!知恵袋の回答、当時の新聞資料を引用)のみ。要追加裏取り",
    source_url: "https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q10206763070", verified: false
  },

  // --- 自由の女神バッチ2「意外性重視」(2026-07-20生成。research-notes/quiz-content/statue-of-liberty.md 参照) ---
  // ユーザーフィードバック「バッチ1は基礎データ偏重で意外性に乏しい」を受け、
  // 「思い込みを覆す系」「純粋な意外性・ローカルネタ系」を中心に再構成。○×比率5:5。
  {
    id: "ox-sol-011", type: "ox", genre: "自由の女神",
    question: "自由の女神が現在掲げているたいまつは、1986年に一新されたもので、1886年当初のたいまつは現在、現地の博物館に展示されている。",
    answer: true,
    explanation: "オリジナルのたいまつは内部照明を琥珀色の窓越しに見せる設計だったが、窓の隙間から雨水が浸入し腕の支持構造を腐食させたため、建立100周年の1986年に現行の金箔張りたいまつへ完全交換された。",
    note: "ナショナルジオグラフィック日本版で確認",
    source_url: "https://natgeo.nikkeibp.co.jp/nng/article/news/14/1412/", verified: false
  },
  {
    id: "ox-sol-012", type: "ox", genre: "自由の女神",
    question: "自由の女神像がユネスコ世界遺産に登録されたのは、建立からちょうど100年後の1986年である。",
    answer: false,
    explanation: "世界遺産登録は1984年で、建立100周年(1986年)より2年早い。",
    note: "複数の世界遺産解説サイトで一致",
    source_url: "https://ja.wikipedia.org/wiki/自由の女神像_(ニューヨーク)", verified: false
  },
  {
    id: "ox-sol-013", type: "ox", genre: "自由の女神",
    question: "コロンビア映画のオープニングロゴに描かれた、たいまつを持つ女性像は、自由の女神をモデルにしている。",
    answer: false,
    explanation: "正式には「コロンビアレディ」と呼ばれる、自由の女神とは別の伝統に基づく人物像。実在のモデルが複数(1928〜40年代イヴリン・ヴェナブル、1936〜1993年ジェーン・チェスター・バーソロミュー、1992年〜ジェニー・ジョセフ)存在する。",
    note: "複数の映画関連メディア記事で一致",
    source_url: "https://news.tv.rakuten.co.jp/2024/04/k-columbia.html", verified: false
  },
  {
    id: "ox-sol-014", type: "ox", genre: "自由の女神",
    question: "東京・お台場にある自由の女神のレプリカは、ニューヨークの像から型を取って作られたものである。",
    answer: false,
    explanation: "1998年の「日本におけるフランス年」記念でパリの実物を借用したのが最初で、2000年に恒久設置されたレプリカは、ニューヨークではなくパリのリュクサンブール公園の像から型を取ったもの。",
    note: "単一ソース(Wikipedia、出典不足警告付きページ)、追加裏取り推奨",
    source_url: "https://ja.wikipedia.org/wiki/自由の女神像", verified: false
  },
  {
    id: "ox-sol-015", type: "ox", genre: "自由の女神",
    question: "台座に刻まれた移民を歓迎する詩「新しい巨像」は、除幕式(1886年)の17年後に追加設置された。",
    answer: true,
    explanation: "詩自体はエマ・ラザラスが1883年に執筆したが、台座への銅板設置は1903年。当初は募金活動用の一詩に過ぎず、ラザラス没後(1887年)に設置された。",
    note: "複数ソースで一致",
    source_url: "https://crd.ndl.go.jp/reference/detail?page=ref_view&id=1000210841", verified: false
  },
  {
    id: "ox-sol-016", type: "ox", genre: "自由の女神",
    question: "1989年の天安門事件で、自由の女神を模した「民主の女神像」が設置されたが、5日後に破壊された。",
    answer: true,
    explanation: "北京の美術学生たちがニューヨークの自由の女神を模して高さ約9mの「自由と民主の女神」像を制作・設置したが、戒厳令下、人民解放軍の戦車によって5日後に押し倒された。",
    note: "共同通信で確認。政治的に機微な話題のため、実際のテレビ番組では出題されにくい可能性が高い(一般教養として収録)",
    source_url: "https://nordot.app/508105053662037089", verified: false
  },
  {
    id: "ox-sol-017", type: "ox", genre: "自由の女神",
    question: "「破壊された自由の女神」という表現は、第一次世界大戦期の戦時国債ポスターにまで遡る伝統である。",
    answer: true,
    explanation: "首を切断され頭部が地に転がる自由の女神とドイツ軍機を描いたWWI期の戦時国債プロパガンダポスターが存在する。『猿の惑星』『クローバーフィールド』等の演出は、この100年以上続く視覚的伝統の延長と考えられる。",
    note: "検索結果からの推定。ポスター原資料の直接照合は未達、追加裏取り推奨",
    source_url: "", verified: false
  },
  {
    id: "ox-sol-018", type: "ox", genre: "自由の女神",
    question: "2018年のアメリカ独立記念日、抗議者が自由の女神の台座によじ登り拘束される事件があった。",
    answer: true,
    explanation: "2018年7月4日、移民家族分離政策に抗議する女性が台座によじ登り、約2時間の対峙の末に拘束された。リバティ島観光客約3,000人が影響を受けた。",
    note: "CNN.co.jp・AFPBBの2ソースで一致",
    source_url: "https://www.cnn.co.jp/usa/35121964.html", verified: false
  },
  {
    id: "ox-sol-019", type: "ox", genre: "自由の女神",
    question: "2026年のアメリカ建国250周年を記念して、フランスから自由の女神に新しいたいまつが贈られた。",
    answer: false,
    explanation: "贈られたのはたいまつではなく、「Liberty Lights」という新しいライトアップ演出。たいまつの交換は1986年に既に完了している(ox-sol-011参照)。",
    note: "ABC7 New Yorkで確認",
    source_url: "https://abc7ny.com/post/special-celebration-marks-americas-250th-birthday-liberty-island/19432262/", verified: false
  },
  {
    id: "ox-sol-020", type: "ox", genre: "自由の女神",
    question: "アメリカの硬貨「スタンディング・リバティ・クォーター」に描かれた女神像は、自由の女神をモデルにしている。",
    answer: false,
    explanation: "彫刻家ハーマン・アトキンス・マクニールが実在の女性(ドリス・ドッシャー説とアイリーン・マクダウェル説が対立)をモデルに作った、ニューヨークの自由の女神とは別の「リバティ」像。",
    note: "英語版Wikipedia・複数の貨幣専門サイトで一致",
    source_url: "https://en.wikipedia.org/wiki/Standing_Liberty_quarter", verified: false
  }
];

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
  }
];

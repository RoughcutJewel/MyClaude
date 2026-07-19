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
  }
];

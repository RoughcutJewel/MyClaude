# MyClaude

Claude Codeと一緒に作ったプロジェクトを置くリポジトリです。

## generative-art

ブラウザで動くジェネラティブアート。クリックまたはドラッグでキャンバスに描けます。

**機能**
- 5つの描画モード: バースト / スパイラル / ウェブ / リップル / ギャラクシー
- 密度・サイズのスライダー調整
- 5種類のカラーパレット
- 軌跡モード (ON/OFF)
- PNG保存

**使い方**

`generative-art/index.html` をブラウザで開くだけで動きます。インストール不要。

## clipboard-ocr

クリップボード上の画像(スクリーンショット)に含まれる日本語テキストをOCRでテキスト化する、Windows専用の常駐ツール。

**機能**
- グローバルホットキー(Win+Shift+X)でどこからでも実行
- クリップボードの画像を日本語OCRし、結果テキストでクリップボードを上書き
- `-Once` オプションで1回だけ実行して終了(動作確認用)
- `Start-Hidden.vbs` 経由でWindowsログイン時にウィンドウ非表示で自動起動可能

**使い方**

日本語OCR言語パックのインストールが必要です(設定 > 時刻と言語 > 言語と地域)。Windows PowerShell (`powershell.exe`) 専用、PowerShell 7 (`pwsh.exe`) では動作しません。詳細は [clipboard-ocr/README.md](clipboard-ocr/README.md) 参照。

```
powershell.exe -ExecutionPolicy Bypass -File clipboard-ocr\Watch-ClipboardOcr.ps1
```

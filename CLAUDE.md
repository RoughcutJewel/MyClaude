# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

Claude Code と共に作ったプロジェクトを置くリポジトリ。現在は `generative-art` と `clipboard-ocr` の2つ。

## generative-art

`generative-art/index.html` を直接ブラウザで開くだけで動く、ビルド不要のシングルファイルアプリ。

**アーキテクチャ**

- HTML / CSS / vanilla JS をすべて `index.html` 1 ファイルに収めている。
- 描画ロジックは `draw(x, y)` が各モード関数（`drawBurst` / `drawSpiral` / `drawWeb` / `drawRipple` / `drawGalaxy`）に振り分ける形。
- パラメーター（モード・密度・サイズ・パレット）は `getParams()` で DOM から毎回読み取る。
- 軌跡モード OFF 時は `draw()` 内で半透明の矩形を重ねることでフェード効果を出している。
- タッチ操作は `touchstart` / `touchmove` / `touchend` で処理。`e.preventDefault()` でスクロールを抑制しており、`passive: false` が必須。

**確認方法**

```
# ファイルをブラウザで開く（ビルド・サーバー不要）
start generative-art/index.html   # Windows
open generative-art/index.html    # macOS
```

## clipboard-ocr

クリップボード上の画像を日本語OCRでテキスト化し、クリップボードを上書きするWindows専用ツール。本体は `clipboard-ocr/Watch-ClipboardOcr.ps1`、ウィンドウ非表示自動起動用に `clipboard-ocr/Start-Hidden.vbs` を同梱。

**アーキテクチャ**

- **OCRエンジン**: `Windows.Media.Ocr.OcrEngine` をWinRT型アクセラレータ(`[Type, Assembly, ContentType=WindowsRuntime]`)経由でPowerShellから呼ぶ。この構文は **Windows PowerShell 5.1 (`powershell.exe`) 専用**で、PowerShell 7 (`pwsh.exe`) では型が見つからずエラーになる（`#Requires -PSEdition Desktop` で起動時に弾く）。非同期WinRT呼び出し（`GetFileFromPathAsync` / `OpenAsync` / `BitmapDecoder.CreateAsync` / `GetSoftwareBitmapAsync` / `RecognizeAsync`）は reflection ベースの `Wait-WinRTAsync`（`GetAwaiter`/`GetResult`パターン）で待つ。
- **単語間スペースの罠**: `OcrResult.Text` は単語をスペースで連結するため、単語分割の概念が無い日本語では文字ごとにスペースが入ってしまう。`Get-TextFromImageFile` は `OcrLine.Words` を直接スペース無しで連結して回避している。
- **クリップボード連携**: `Clipboard.GetImage()` で取得した `Bitmap` を `[System.IO.Path]::GetTempFileName()` の一時ファイルにPNG保存し、`StorageFile` 経由のWinRTパイプラインに渡す（`finally` で一時ファイル削除）。
- **グローバルホットキー(Win+Shift+X)の実装で踏んだ罠**: `Add-Type` で `Form` を継承したC#クラス `HotkeyForm` を定義し、`RegisterHotKey`/`WndProc`(`WM_HOTKEY`)でOS全体のホットキーを検知する。**`Register-ObjectEvent -Action` は `[System.Windows.Forms.Application]::Run()` のメッセージループ中は実行されないことを実機検証で確認した**（PowerShellのイベントキュー処理はエンジンがアイドルになったタイミングでしか進まないため、ネイティブの `Application.Run()` に入ったきり戻ってこないループでは永久に発火しない）。そのため .NET イベントではなく、`HotkeyForm` の公開フィールド `HotkeyFired`（`volatile bool`）をPowerShell側の `while` ループで `Application.DoEvents()` の合間にポーリングする方式にした。結果として全処理が単一(STA)スレッドで完結し、Clipboard APIのSTA要件も自然に満たされる。
- **ウィンドウを表示しない**: `SetVisibleCore(bool value)` をオーバーライドして常に `false` を渡すことで、`Application.Run()` が内部で `Show()` を呼んでも一切表示させない。
- **スコープ**: OCR関連の関数・状態は当初「別スレッドから呼ばれる可能性」を警戒して `global:` スコープに置いたが、上記のポーリング方式に変更した結果すべて同一スレッド実行になったため厳密には不要になった。実害はないためそのままにしている。
- **実行ポリシー**: 既定の実行ポリシーではスクリプト実行がブロックされる。システム設定は変更せず、`-ExecutionPolicy Bypass` を都度付けて実行する運用にしている。
- **文字エンコーディング**: スクリプト内に日本語コメント/文字列があるため、ファイルは **UTF-8 with BOM** で保存する必要がある(Windows PowerShell 5.1はBOM無しUTF-8のスクリプトを正しくパースできない)。
- **終了コードの制御**: スクリプト冒頭で `$ErrorActionPreference = 'Stop'` を設定しているため、`Write-Error` は terminating error 化し、意図した `exit <code>` に届く前にスクリプトが落ちる(実際に踏んだバグ)。そのため失敗時の終了は `Exit-WithError`(`[Console]::Error.WriteLine` + `exit`)に集約しており、`Write-Error` は使わない。
- **OCR精度は完璧ではない**: `System.Drawing.Graphics.DrawString` で生成した合成画像では完全一致するが、実際のスクリーンショット(ダークテーマ・小さいフォントなど)では濁点・半濁点や「ー」/「-」の誤認識、キー名(SHIFT等)の一部文字化けが実測で発生した。これはWindows OCRエンジン自体の精度限界であり、本ツールの不具合ではない。
- **小さい画像は拡大してからOCRする**: `Get-UpscaledBitmapForOcr` は画像の短辺が200px未満のときだけ`Graphics.DrawImage`(`InterpolationMode.HighQualityBicubic`)で拡大する。倍率は実測で比較して2倍に決めた: 1倍だと小さいバッジ画像(32px程度)は文字を全く拾えず(exit 5)、または「ー」を「-」と誤認識したが、2倍拡大でどちらも解消した。閾値200px以上の画像は拡大せずそのまま渡す。
- **キー名の文字化けをあいまい一致で補正する**: 実際のスクリーンショットでは「SHIFT」が「s印FT」のように一部の英字が別の漢字っぽい文字に化けることが実測で確認された(Windows OCRエンジン自体の限界で、拡大では解消しない)。`Try-CorrectKeyName`(Levenshtein距離)でCTRL/SHIFT/ALT/WIN/TAB/ESC/ENTER/F1〜F12等の既知キー名の語彙とあいまい一致させ、`Repair-KeyNameWords`が行内の隣接する単語を最大3つまで連結してから照合する(OCRが1つのキー名を複数単語に分裂させて認識することがあるため)。
  - **踏んだバグ1**: 連結窓が記号(`+`など)をまたいでしまうと、"CTRL"+"+" のような窓が"CTRL"に丸められて`+`が消えた。`Test-IsBoundaryToken`で記号・句読点だけの単語を境界とし、窓が絶対にまたがないようにして解決した。
  - **踏んだバグ2**: ひらがな1文字("か"等)が隣接する"CTRL"に巻き込まれ、"かCTRL"が"CTRL"へ丸められて"か"が消えた。ひらがな・カタカナも境界に含めた上で、さらに「窓の文字数が辞書語の文字数を超える候補は却下する」という制約を`Try-CorrectKeyName`に追加した(OCRの壊れ方は文字が消える/化けるパターンのみで、文字が増えるパターンは無いという実測に基づく)。
  - **既知の限界**: 複数文字が完全に脱落するほど激しく壊れた場合(例: "SHIFT"が"s"1文字だけになる)は、あいまい一致の許容範囲を超えるため補正できない。
- **全角記号への正規化**: 日本語の文の末尾で全角の「！」「？」がWindows OCRにより半角の"!"/"?"として認識されることが実測で確認された。`Convert-TrailingPunctuationToFullWidth`が、直前の文字がひらがな・カタカナ・漢字(または既に変換済みの全角記号、"!!"等の連続に対応するため)の場合のみ全角に変換する。英単語直後などの半角文脈では変換しない。
- **ログイン時自動起動とウィンドウ非表示**: `powershell.exe -File ...` を直接スタートアップ登録するとコンソールウィンドウが必ず一瞬〜継続的に見えてしまう。そこで `Start-Hidden.vbs`(`WScript.Shell.Run(cmd, 0, False)` でウィンドウスタイル0=非表示指定)を挟み、スタートアップフォルダ(`shell:startup`)のショートカットは `wscript.exe "...\Start-Hidden.vbs"` を起動先にする。vbsは自分自身の場所(`WScript.ScriptFullName`)から `Watch-ClipboardOcr.ps1` の絶対パスを動的に解決するため、フォルダごと移動しても動く。ショートカットは `WScript.Shell` COMオブジェクトの `CreateShortcut` で作成できる(管理者権限不要)。

**確認方法**

```powershell
# 前提: 設定 > 時刻と言語 > 言語と地域 で日本語の「光学式文字認識」機能を追加済みであること

# 1. 現在のクリップボードの画像を1回だけOCR(動作確認に最適)
powershell.exe -ExecutionPolicy Bypass -File clipboard-ocr\Watch-ClipboardOcr.ps1 -Once

# 2. 待受モード（Win+Shift+X で発火、Ctrl+Vで結果を確認）
powershell.exe -ExecutionPolicy Bypass -File clipboard-ocr\Watch-ClipboardOcr.ps1
```

ログは `%LOCALAPPDATA%\clipboard-ocr\clipboard-ocr.log` に出力される（成功時は無出力、失敗時のみ記録）。

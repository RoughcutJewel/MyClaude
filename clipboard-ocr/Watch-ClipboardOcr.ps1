#Requires -Version 5.1
#Requires -PSEdition Desktop

<#
クリップボード上の画像(スクリーンショット)を日本語OCRでテキスト化し、
クリップボードをそのテキストで上書きするツール。

使い方:
  powershell.exe -File Watch-ClipboardOcr.ps1 -Once   # 現在のクリップボードを1回だけOCRして終了
  powershell.exe -File Watch-ClipboardOcr.ps1          # Win+Shift+X のグローバルホットキーで待受

注意: Windows PowerShell (powershell.exe) でのみ動作。PowerShell 7 (pwsh.exe) 不可。
#>

[CmdletBinding()]
param(
    [switch]$Once
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# --- 定数 ---
$script:HotkeyId = 9000
$script:MOD_WIN = 0x0008
$script:MOD_SHIFT = 0x0004
$script:VK_X = 0x58
$global:OcrLanguageTag = 'ja'
$global:LogDir = Join-Path $env:LOCALAPPDATA 'clipboard-ocr'
$global:LogPath = Join-Path $global:LogDir 'clipboard-ocr.log'
$global:OcrEngineInstance = $null
$global:WinRTGetAwaiterMethod = $null

# --- 終了コード(ホットキーアクションからも参照するため global) ---
# 1 (エディション不正) はここに変数を持たない: #Requires -PSEdition Desktop が
# スクリプト本体の実行前にpwshを弾き、その時点でexit 1になるため出番がない。
$global:ExitSuccess = 0
$global:ExitOcrEngineUnavailable = 2
$global:ExitNoImage = 3
$global:ExitHotkeyConflict = 4
$global:ExitNoTextRecognized = 5
$global:ExitUnexpectedError = 6

function global:Write-Log {
    param([string]$Message)
    try {
        if (-not (Test-Path $global:LogDir)) {
            New-Item -ItemType Directory -Path $global:LogDir -Force | Out-Null
        }
        $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
        Add-Content -Path $global:LogPath -Value $line -Encoding UTF8
    } catch {
        # ログ失敗はツール本体の動作に影響させない
    }
}

function Initialize-WinRT {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
    $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Foundation.IAsyncOperation`1, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Storage.Streams.RandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
    $null = [Windows.Globalization.Language, Windows.Foundation, ContentType = WindowsRuntime]

    $global:WinRTGetAwaiterMethod = [System.WindowsRuntimeSystemExtensions].GetMember('GetAwaiter') |
        Where-Object { $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } |
        Select-Object -First 1
}

function global:Wait-WinRTAsync {
    param($AsyncOperation, [type]$ResultType)
    $awaiter = $global:WinRTGetAwaiterMethod.MakeGenericMethod($ResultType).Invoke($null, @($AsyncOperation))
    return $awaiter.GetResult()
}

function global:Get-OcrEngine {
    if (-not $global:OcrEngineInstance) {
        $lang = New-Object Windows.Globalization.Language($global:OcrLanguageTag)
        $global:OcrEngineInstance = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
        if (-not $global:OcrEngineInstance) {
            throw "日本語OCR言語パックが見つかりません。設定 > 時刻と言語 > 言語と地域 で日本語の「光学式文字認識」機能を追加してください。"
        }
    }
    return $global:OcrEngineInstance
}

$global:KeyNameDictionary = @(
    'CTRL', 'SHIFT', 'ALT', 'WIN', 'TAB', 'ESC', 'ENTER', 'SPACE', 'DELETE', 'BACKSPACE',
    'HOME', 'END', 'INSERT', 'CAPSLOCK', 'NUMLOCK', 'SCROLLLOCK', 'PRINTSCREEN',
    'PAGEUP', 'PAGEDOWN', 'UP', 'DOWN', 'LEFT', 'RIGHT',
    'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
)

function global:Get-LevenshteinDistance {
    param([string]$A, [string]$B)
    $lenA = $A.Length
    $lenB = $B.Length
    # 多次元配列 $d[$i,$j] は入れ子の式の中でコンマがパースエラーになったため、
    # ジャグ配列 $d[$i][$j] で実装する。
    $d = New-Object 'object[]' ($lenA + 1)
    for ($i = 0; $i -le $lenA; $i++) { $d[$i] = New-Object 'int[]' ($lenB + 1) }
    for ($i = 0; $i -le $lenA; $i++) { $d[$i][0] = $i }
    for ($j = 0; $j -le $lenB; $j++) { $d[0][$j] = $j }
    for ($i = 1; $i -le $lenA; $i++) {
        for ($j = 1; $j -le $lenB; $j++) {
            $cost = if ($A[$i - 1] -eq $B[$j - 1]) { 0 } else { 1 }
            $deleteCost = $d[$i - 1][$j] + 1
            $insertCost = $d[$i][$j - 1] + 1
            $substituteCost = $d[$i - 1][$j - 1] + $cost
            $d[$i][$j] = [Math]::Min([Math]::Min($deleteCost, $insertCost), $substituteCost)
        }
    }
    return $d[$lenA][$lenB]
}

function global:Try-CorrectKeyName {
    <#
    実際のスクリーンショットで「SHIFT」が「s印FT」のように壊れて認識される
    (濁点・半濁点だけでなく、キー名の英字が丸ごと別の文字化けになるケース)
    ことを実測で確認した。CTRL/SHIFT/ALT等の既知キー名の語彙とあいまい一致させ、
    近ければ正しいキー名に補正する。日本語の単語を誤って壊さないよう、
    英字を1文字も含まない・2文字未満の文字列は対象外にする。
    #>
    param([string]$Text)
    if ($Text.Length -lt 2 -or $Text -notmatch '[A-Za-z]') {
        return $null
    }
    $upper = $Text.ToUpper()
    if ($global:KeyNameDictionary -contains $upper) {
        return $upper
    }
    $bestCandidate = $null
    $bestDistance = [int]::MaxValue
    foreach ($candidate in $global:KeyNameDictionary) {
        # OCRの壊れ方は「文字が消える/別の文字に化ける」パターンのみで実測されており、
        # 「余計な文字が増える」パターンは見られなかった。窓が辞書語より長い候補は
        # 隣の単語を巻き込んでいる可能性が高いので候補から外す
        # ("か"+"CTRL"が"CTRL"に丸められて"か"が消えるバグを実測で踏んだ)。
        if ($upper.Length -gt $candidate.Length) {
            continue
        }
        $distance = Get-LevenshteinDistance $upper $candidate
        if ($distance -lt $bestDistance) {
            $bestDistance = $distance
            $bestCandidate = $candidate
        }
    }
    if (-not $bestCandidate) {
        return $null
    }
    $threshold = [Math]::Max(1, [Math]::Floor($bestCandidate.Length * 0.4))
    if ($bestDistance -le $threshold) {
        return $bestCandidate
    }
    return $null
}

function global:Test-IsBoundaryToken {
    <#
    連結窓に含めてはいけない単語(境界)を判定する。
    - "+" や "、" のような記号・句読点だけの単語("CTRL"+"+" を窓としてまとめて
      試すと "CTRL" に丸められ "+" が消えるバグを実測で踏んだ)。
    - ひらがな・カタカナの単語。実測ではキー名の壊れた読み取りの代役に出てくる
      文字は常に漢字(印・矼・幵など)で、ひらがな・カタカナが出てくることは
      無かった。含めてしまうと"か"のような普通のかな1文字が隣接する"CTRL"に
      巻き込まれて消えるバグを実測で踏んだため、安全側に倒して境界にする。
    英字・数字・漢字を1つも含まない、またはかな1文字のみの単語を境界とみなす。
    #>
    param([string]$Word)
    if ($Word -match '^[぀-ヿ]+$') {
        return $true
    }
    return ($Word -notmatch '[A-Za-z0-9一-鿿]')
}

function global:Repair-KeyNameWords {
    <#
    OCRが1つのキー名を複数の単語に分裂させて認識すること(例: "SHIFT"が
    "s" / (文字化け1文字) / "FT" の3単語に割れる)を実測で確認したため、
    隣接する単語を最大3つまで連結してから辞書と照合する(長い窓を優先)。
    ただし記号・句読点(Test-IsBoundaryToken)をまたいでは連結しない。
    一致しなければ元の単語をそのまま出力する。
    #>
    param([string[]]$Words)
    $out = New-Object System.Collections.Generic.List[string]
    $i = 0
    while ($i -lt $Words.Count) {
        if (Test-IsBoundaryToken $Words[$i]) {
            $out.Add($Words[$i])
            $i += 1
            continue
        }
        $maxSize = 1
        while ($maxSize -lt 3 -and ($i + $maxSize) -lt $Words.Count -and -not (Test-IsBoundaryToken $Words[$i + $maxSize])) {
            $maxSize += 1
        }
        $applied = $false
        for ($size = $maxSize; $size -ge 1; $size--) {
            $joined = ($Words[$i..($i + $size - 1)] -join '')
            $corrected = Try-CorrectKeyName $joined
            if ($corrected) {
                $out.Add($corrected)
                $i += $size
                $applied = $true
                break
            }
        }
        if (-not $applied) {
            $out.Add($Words[$i])
            $i += 1
        }
    }
    return ($out -join '')
}

function global:Convert-TrailingPunctuationToFullWidth {
    <#
    「ご視聴ありがとうございました!」のように、全角の日本語文に半角の「!」「?」が
    続くと違和感があるとの実測フィードバックにより、直前の文字が日本語
    (ひらがな・カタカナ・漢字)、または直前が既に変換済みの全角記号の場合は
    全角(！/？)に変換する("!!"のような連続にも対応するため後者の条件がある)。
    #>
    param([string]$Text)
    $fullWidthMap = @{ '!' = [char]0xFF01; '?' = [char]0xFF1F }
    $chars = $Text.ToCharArray()
    for ($i = 1; $i -lt $chars.Length; $i++) {
        $key = [string]$chars[$i]
        if (-not $fullWidthMap.ContainsKey($key)) {
            continue
        }
        $prev = $chars[$i - 1]
        $prevIsJapaneseOrConverted = ($prev -match '[぀-ヿ一-鿿]') -or ($prev -eq [char]0xFF01) -or ($prev -eq [char]0xFF1F)
        if ($prevIsJapaneseOrConverted) {
            $chars[$i] = $fullWidthMap[$key]
        }
    }
    return -join $chars
}

function global:Get-TextFromImageFile {
    param([Parameter(Mandatory)][string]$Path)
    $storageFile = Wait-WinRTAsync ([Windows.Storage.StorageFile]::GetFileFromPathAsync($Path)) ([Windows.Storage.StorageFile])
    $stream = Wait-WinRTAsync ($storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Wait-WinRTAsync ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $softwareBitmap = Wait-WinRTAsync ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $engine = Get-OcrEngine
    $result = Wait-WinRTAsync ($engine.RecognizeAsync($softwareBitmap)) ([Windows.Media.Ocr.OcrResult])

    # OcrResult.Text は単語をスペース区切りで連結するため、日本語では文字ごとに
    # スペースが入ってしまう(単語分割の区切りが無いため)。行内は単語を詰めて連結する。
    $lines = foreach ($line in $result.Lines) {
        Repair-KeyNameWords -Words @($line.Words | ForEach-Object { $_.Text })
    }
    return Convert-TrailingPunctuationToFullWidth -Text ($lines -join "`n")
}

function global:Get-UpscaledBitmapForOcr {
    <#
    小さい画像(バッジ・アイコン付きラベルなど)はWindows OCRが文字を全く拾えない、
    または「ー」と「-」を取り違えるなど精度が落ちることを実測で確認した。
    画像の短辺が閾値未満のときだけ高品質補間で拡大し、認識精度を上げる。
    倍率は2倍が実測で最も安定していた: 1倍では小さいバッジ画像で文字を全く拾えず、
    3倍まで上げると逆に実スクリーンショット(アンチエイリアス済み)で文字が潰れて
    誤認識が悪化した。
    #>
    param([System.Drawing.Bitmap]$Source)

    $shortSide = [Math]::Min($Source.Width, $Source.Height)
    if ($shortSide -ge 200) {
        return $Source
    }
    $scale = 2
    $newWidth = $Source.Width * $scale
    $newHeight = $Source.Height * $scale
    $scaled = New-Object System.Drawing.Bitmap $newWidth, $newHeight
    $g = [System.Drawing.Graphics]::FromImage($scaled)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($Source, 0, 0, $newWidth, $newHeight)
    $g.Dispose()
    return $scaled
}

function global:Invoke-OcrAndSetClipboard {
    <#
    クリップボードの画像をOCRしてテキストで上書きする。
    戻り値は @{ Code = <終了コード>; Message = <ログ/表示用メッセージ> } で、
    -Once とホットキーアクションの両方から同じ結果を使って分岐する。
    #>
    try {
        if (-not [System.Windows.Forms.Clipboard]::ContainsImage()) {
            return @{ Code = $global:ExitNoImage; Message = 'クリップボードに画像がありません。' }
        }

        $bitmap = [System.Windows.Forms.Clipboard]::GetImage()
        $ocrBitmap = Get-UpscaledBitmapForOcr -Source $bitmap
        $tempPath = [System.IO.Path]::GetTempFileName()
        try {
            $ocrBitmap.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
            $text = Get-TextFromImageFile -Path $tempPath
        } finally {
            Remove-Item -Path $tempPath -Force -ErrorAction SilentlyContinue
            if (-not [object]::ReferenceEquals($ocrBitmap, $bitmap)) { $ocrBitmap.Dispose() }
            $bitmap.Dispose()
        }

        if ([string]::IsNullOrWhiteSpace($text)) {
            return @{ Code = $global:ExitNoTextRecognized; Message = '画像からテキストを認識できませんでした。' }
        }

        [System.Windows.Forms.Clipboard]::SetText($text)
        return @{ Code = $global:ExitSuccess; Message = 'クリップボードにテキストをコピーしました。' }
    } catch {
        return @{ Code = $global:ExitUnexpectedError; Message = $_.Exception.Message }
    }
}

function Exit-WithError {
    <#
    $ErrorActionPreference = 'Stop' の下では Write-Error が terminating error 化し、
    意図した終了コードに届く前にスクリプトが落ちてしまう(実際に踏んだバグ)。
    [Console]::Error はその設定に一切影響されないため、失敗時の終了はここに集約する。

    Start-Hidden.vbs 経由の自動起動時はコンソール自体が非表示なため、
    [Console]::Error だけでは致命的エラーが完全に無音・無痕跡になってしまう
    (実際にこの状態で自動起動時の不具合の原因調査ができなかった)。
    そのため終了コードに関わらず必ずログにも残す。
    #>
    param([string]$Message, [int]$Code)
    Write-Log "Fatal error (exit $Code): $Message"
    [Console]::Error.WriteLine($Message)
    exit $Code
}

# --- main ---
# PowerShell 7 (pwsh.exe) はこの #Requires 自体でスクリプト実行前に弾かれる
# (WinRTの型アクセラレータがpwshには存在しないため)。
Initialize-WinRT

try {
    $null = Get-OcrEngine
} catch {
    Exit-WithError $_.Exception.Message $global:ExitOcrEngineUnavailable
}

if ($Once) {
    $result = Invoke-OcrAndSetClipboard
    if ($result.Code -eq $global:ExitSuccess -or $result.Code -eq $global:ExitNoTextRecognized) {
        Write-Host $result.Message
        exit $result.Code
    }
    Exit-WithError $result.Message $result.Code
}

# --- リスナーモード: グローバルホットキー(Win+Shift+X) ---
$hotkeyFormSource = @'
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public class HotkeyForm : Form
{
    [DllImport("user32.dll")]
    private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);
    [DllImport("user32.dll")]
    private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    private const int WM_HOTKEY = 0x0312;
    private int _hotkeyId;
    private uint _modifiers;
    private uint _vk;

    public bool HotkeyRegistered { get; private set; }

    // Register-ObjectEvent の -Action は Application.Run() のメッセージループ中は
    // 実行されない(PowerShellのイベントキュー処理はエンジンのアイドル時にしか動かない
    // ため、実測で確認した)。そのためイベントではなく、この公開フラグを
    // PowerShell 側から Application.DoEvents() の合間にポーリングする方式にする。
    public volatile bool HotkeyFired;

    public HotkeyForm(int hotkeyId, uint modifiers, uint vk)
    {
        _hotkeyId = hotkeyId;
        _modifiers = modifiers;
        _vk = vk;
        ShowInTaskbar = false;
        FormBorderStyle = FormBorderStyle.FixedToolWindow;
        StartPosition = FormStartPosition.Manual;
        Location = new System.Drawing.Point(-2000, -2000);
        Width = 1;
        Height = 1;
    }

    protected override void SetVisibleCore(bool value)
    {
        // Application.Run が内部で Show() を呼んでもウィンドウを一切表示させない
        base.SetVisibleCore(false);
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        HotkeyRegistered = RegisterHotKey(Handle, _hotkeyId, _modifiers, _vk);
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WM_HOTKEY && m.WParam.ToInt32() == _hotkeyId)
        {
            HotkeyFired = true;
        }
        base.WndProc(ref m);
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        UnregisterHotKey(Handle, _hotkeyId);
        base.OnFormClosing(e);
    }
}
'@

Add-Type -TypeDefinition $hotkeyFormSource -ReferencedAssemblies System.Windows.Forms, System.Drawing

$hotkeyForm = New-Object HotkeyForm($script:HotkeyId, [uint32]($script:MOD_WIN -bor $script:MOD_SHIFT), [uint32]$script:VK_X)
$null = $hotkeyForm.Handle  # OnHandleCreated を強制発火させ、Application.Run前に登録成否を判定する

if (-not $hotkeyForm.HotkeyRegistered) {
    Exit-WithError "グローバルホットキー (Win+Shift+X) の登録に失敗しました。既に別のインスタンスが起動しているか、他のアプリと競合しています。" $global:ExitHotkeyConflict
}

Write-Log "Listener started. Press Win+Shift+X to run OCR on the clipboard image."

# Register-ObjectEvent の -Action は Application.Run() 中は発火しないため使わず、
# DoEvents() でメッセージを処理しつつ HotkeyFired フラグをポーリングする。
# すべて同一(STA)スレッドで完結するため、Clipboard アクセスのスレッド問題も発生しない。
try {
    while ($true) {
        [System.Windows.Forms.Application]::DoEvents()
        if ($hotkeyForm.HotkeyFired) {
            $hotkeyForm.HotkeyFired = $false
            $result = Invoke-OcrAndSetClipboard
            if ($result.Code -ne $global:ExitSuccess) {
                Write-Log "OCR result: code=$($result.Code) message=$($result.Message)"
            }
        }
        if ($hotkeyForm.IsDisposed) { break }
        Start-Sleep -Milliseconds 100
    }
} finally {
    if (-not $hotkeyForm.IsDisposed) { $hotkeyForm.Dispose() }
}

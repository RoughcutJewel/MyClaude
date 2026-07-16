' Watch-ClipboardOcr.ps1 をコンソールウィンドウ無しで起動するためのランチャー。
' スタートアップフォルダに置くショートカットの起動先はこのファイルにする。
Dim fso, scriptDir, psPath, shell, cmd

Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
psPath = scriptDir & "\Watch-ClipboardOcr.ps1"

Set shell = CreateObject("WScript.Shell")
cmd = "powershell.exe -ExecutionPolicy Bypass -File """ & psPath & """"
shell.Run cmd, 0, False

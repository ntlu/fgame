$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\Start CauCa Server.lnk")
$Shortcut.TargetPath = "d:\CODE\cauca\start_server.bat"
$Shortcut.WorkingDirectory = "d:\CODE\cauca"
$Shortcut.IconLocation = "cmd.exe"
$Shortcut.Save()

# --- UNRAID MASTER DEPLOYMENT & CLEANUP TOOL V8 ---
$ErrorActionPreference = "SilentlyContinue"

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "   UNRAID SMART-TRAY: MASTER CONTROL V8       " -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

Write-Host " [1] Install / Update / Add New Drive"
Write-Host " [2] RESET & UNINSTALL EVERYTHING (Nuclear Option)"
Write-Host ""
$mode = Read-Host "Select an option (1 or 2)"

# ==============================================
# OPTION 2: THE NUCLEAR UNINSTALL
# ==============================================
if ($mode -eq "2") {
    Write-Host "`n[!] STARTING FULL UNINSTALL..." -ForegroundColor Red
    
    # 1. Kill all processes
    Write-Host " - Stopping Rclone and Tray instances..."
    Get-Process rclone | Stop-Process -Force
    Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like "*UnraidTray*" } | ForEach-Object { Stop-Process $_.ProcessId -Force }

    # 2. Remove Startup Shortcuts
    Write-Host " - Removing Startup shortcuts..."
    $startupFolder = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
    Remove-Item -Path "$startupFolder\UnraidTray_*.url" -Force

    # 3. Remove App Data Folders
    Write-Host " - Deleting Tray App data..."
    Remove-Item -Path "$env:APPDATA\UnraidTray_*" -Recurse -Force

    # 4. Uninstall Software
    $uninst = Read-Host "Uninstall Rclone and WinFsp drivers too? (Y/N)"
    if ($uninst -eq "Y") {
        Write-Host " - Uninstalling Rclone..."
        winget uninstall -e --id Rclone.Rclone --accept-source-agreements
        Write-Host " - Uninstalling WinFsp..."
        winget uninstall -e --id WinFsp.WinFsp --accept-source-agreements
    }

    # 5. Clear Rclone Config
    $unconf = Read-Host "Delete your Rclone config file (Passwords/Remotes)? (Y/N)"
    if ($unconf -eq "Y") {
        Write-Host " - Deleting Rclone config folder..."
        Remove-Item -Path "$env:APPDATA\rclone" -Recurse -Force
    }

    Write-Host "`n[SUCCESS] All traces removed (except this script)." -ForegroundColor Green
    Read-Host "Press Enter to exit..."
    exit
}

# ==============================================
# OPTION 1: INSTALL / UPDATE
# ==============================================

# 1. Drivers
Write-Host "`n[1/5] Checking Drivers..." -ForegroundColor Yellow
winget install -e --id Rclone.Rclone --accept-source-agreements --accept-package-agreements
winget install -e --id WinFsp.WinFsp --accept-source-agreements --accept-package-agreements
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","User") + ";" + [System.Environment]::GetEnvironmentVariable("Path","Machine")

# 2. Config Manager
$existingRemotes = rclone listremotes
$remoteName = Read-Host "Enter a name for this remote (e.g. HomeNAS, MediaServer) [Default: MyNAS]"
if ($remoteName -eq "") { $remoteName = "MyNAS" }
$skipConfig = $false

Write-Host "`n--- CONFIGURATION MANAGER ---" -ForegroundColor Cyan
if ($existingRemotes -match "$remoteName`:") {
    Write-Host "Found existing config for '$remoteName'." -ForegroundColor Green
    $choice = Read-Host "[K]eep existing, [O]verwrite it, or enter a [N]ew name? (K/O/N)"
    if ($choice -eq "K" -or $choice -eq "") { $skipConfig = $true }
    elseif ($choice -eq "N") { $remoteName = Read-Host "Enter new unique name" }
}

# 3. Network Details
$localIP  = Read-Host "Enter Local IP address (e.g. 192.168.1.100)"
if ($localIP -eq "") { Write-Host "Local IP is required." -ForegroundColor Red; exit }
$remoteIP = Read-Host "Enter Tailscale IP address (e.g. 100.x.x.x) — leave blank to skip"
$port     = Read-Host "Enter Port [Default: 80]"
if ($port -eq "") { $port = "80" }
$inputD   = Read-Host "Enter Drive Letter (A-Z) [Default: Z]"
if ($inputD -eq "") { $inputD = "Z" }
$drive    = $inputD.Replace(":", "").ToUpper() + ":"

# 4. Save Config
if (-not $skipConfig) {
    Write-Host "`n[3/5] Saving configuration to Rclone..." -ForegroundColor Yellow
    $user = Read-Host "Enter WebDAV Username"
    $pass = Read-Host "Enter WebDAV Password" -AsSecureString
    $plainPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($pass))
    & rclone config create ${remoteName} webdav url "http://${localIP}:${port}" vendor other user ${user} pass ${plainPass}
}

# 5. Generate Tray App (PowerShell Script)
# FIX: Now generating the script with ${} wrappers to prevent parser errors in the target file
$appDir = "$env:APPDATA\UnraidTray_${remoteName}"
if (!(Test-Path $appDir)) { New-Item -ItemType Directory -Path $appDir }
$trayScriptPath = "$appDir\UnraidTray.ps1"

$trayScriptContent = @"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

`$remoteName = "${remoteName}"
`$localIP    = "${localIP}"
`$remoteIP   = "${remoteIP}"
`$port       = "${port}"
`$drive      = "${drive}"

if (Test-Connection -ComputerName `$localIP -Count 1 -Quiet) {
    # PARSER FIX: Wrapped vars in {}
    `$url = "http://`${localIP}:`${port}"
    `$mode = "HOME (LAN)"
} else {
    # PARSER FIX: Wrapped vars in {}
    `$url = "http://`${remoteIP}:`${port}"
    `$mode = "REMOTE (Tailscale)"
}

`$existing = Get-Process rclone | Where-Object { `$_.CommandLine -like "*`$remoteName*" }
if (`$existing) { `$existing | Stop-Process -Force }

# PARSER FIX: Wrapped remoteName in {} for the mount command
Start-Process rclone -ArgumentList "mount `${remoteName}: `$drive --webdav-url `$url --vfs-cache-mode full --vfs-cache-max-size 50G --vfs-read-ahead 512M --buffer-size 512M --transfers 16 --multi-thread-streams 16 --ignore-checksum --no-modtime --network-mode=false --volname `$remoteName" -WindowStyle Hidden

`$notify = New-Object System.Windows.Forms.NotifyIcon
`$notify.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon((Get-Process -id `$PID).Path)

# PARSER FIX: Wrapped remoteName in {} for the tooltip
`$notify.Text = "`${remoteName}: `$mode"
`$notify.Visible = `$true
`$notify.ShowBalloonTip(5000, "Unraid Connected", "Drive `$drive is mounted in `$mode mode.", "Info")

`$menu = New-Object System.Windows.Forms.ContextMenu
`$notify.ContextMenu = `$menu
`$menu.MenuItems.Add("Status: `$mode").Enabled = `$false
`$menu.MenuItems.Add("-")
`$menu.MenuItems.Add("Open Web UI (RCD)", { Start-Process powershell -ArgumentList "-NoExit", "-Command", "rclone rcd --rc-web-gui" })
`$menu.MenuItems.Add("Open Config File", { 
    `$configPath = rclone config file | Select-String "rclone.conf"
    if (`$configPath) { Start-Process notepad.exe (`$configPath.ToString().Split("'")[1]) }
})
`$menu.MenuItems.Add("-")
`$menu.MenuItems.Add("Exit & Unmount", {
    `$proc = Get-Process rclone | Where-Object { `$_.CommandLine -like "*`$remoteName*" }
    if (`$proc) { `$proc | Stop-Process -Force }
    `$notify.Visible = `$false
    exit
})

[void][System.Windows.Forms.Application]::Run()
"@
$trayScriptContent | Out-File -FilePath $trayScriptPath -Encoding UTF8

# 6. Generate VBS Launcher
# Using the safe variable method to handle paths with spaces/quotes
$vbsPath = "$appDir\LaunchTray.vbs"
$vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
strPath = "${trayScriptPath}"
strCmd = "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File " & Chr(34) & strPath & Chr(34)
WshShell.Run strCmd, 0
"@
$vbsContent | Out-File -FilePath $vbsPath -Encoding ASCII

# 7. Startup Link
$shortcutPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\UnraidTray_${remoteName}.url"
"[InternetShortcut]`nURL=file:///$vbsPath" | Out-File $shortcutPath

Write-Host "`n[5/5] SUCCESS!" -ForegroundColor Green
Write-Host "Opening folder now. Double-click 'LaunchTray.vbs' to start." -ForegroundColor Cyan
Start-Process explorer.exe $appDir
Read-Host "`nPress Enter to exit..."
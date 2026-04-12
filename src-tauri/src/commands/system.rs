// System utility commands

use tauri::command;
use tauri_plugin_shell::ShellExt;
use serde::{Serialize, Deserialize};

#[command]
pub async fn write_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| format!("Failed to write file: {}", e))
}

#[command]
pub async fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriverVersions {
    pub rclone_installed: bool,
    pub rclone_version: Option<String>,
    pub winfsp_installed: bool,
    pub winfsp_version: Option<String>,
}

// Helper to check if scoop is available, and install it if not
#[cfg(target_os = "windows")]
async fn ensure_scoop_installed(app: &tauri::AppHandle) -> Result<(), String> {
    // Check if scoop is already installed
    let check_output = app
        .shell()
        .command("powershell")
        .args(["-Command", "scoop --version"])
        .output()
        .await;

    if let Ok(output) = check_output {
        if output.status.success() {
            // Scoop is installed, update it
            let _ = app
                .shell()
                .command("powershell")
                .args(["-Command", "scoop update"])
                .output()
                .await;
            return Ok(());
        }
    }

    // Scoop not installed, install it
    let install_output = app
        .shell()
        .command("powershell")
        .args([
            "-ExecutionPolicy",
            "RemoteSigned",
            "-Command",
            "iwr -useb get.scoop.sh | iex"
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to install Scoop: {}", e))?;

    if !install_output.status.success() {
        let stderr = String::from_utf8_lossy(&install_output.stderr);
        return Err(format!("Scoop installation failed: {}", stderr));
    }

    // Update scoop after installation
    let _ = app
        .shell()
        .command("powershell")
        .args(["-Command", "scoop update"])
        .output()
        .await;

    Ok(())
}

#[command]
pub async fn enable_autostart(_app: tauri::AppHandle, minimized: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("Failed to get exe path: {}", e))?;
        let exe_path_str = exe_path.to_string_lossy();

        let value = if minimized {
            format!("\"{}\" --minimized", exe_path_str)
        } else {
            format!("\"{}\"", exe_path_str)
        };

        let output = crate::util::cmd("reg")
            .args([
                "add",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                "RcloneMountHub",
                "/t",
                "REG_SZ",
                "/d",
                &value,
                "/f",
            ])
            .output()
            .map_err(|e| format!("Failed to add registry key: {}", e))?;

        if !output.status.success() {
            return Err("Failed to enable autostart".to_string());
        }

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Autostart is only supported on Windows currently.".to_string())
    }
}

#[command]
pub async fn disable_autostart(_app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let _output = crate::util::cmd("reg")
            .args([
                "delete",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                "RcloneMountHub",
                "/f",
            ])
            .output()
            .map_err(|e| format!("Failed to delete registry key: {}", e))?;

        // Don't error if the key doesn't exist
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Autostart is only supported on Windows currently.".to_string())
    }
}

#[command]
pub async fn is_autostart_enabled(_app: tauri::AppHandle) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let output = crate::util::cmd("reg")
            .args([
                "query",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                "RcloneMountHub",
            ])
            .output()
            .map_err(|e| format!("Failed to query registry: {}", e))?;

        Ok(output.status.success())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

#[command]
pub async fn install_rclone(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // Ensure scoop is installed and updated
        ensure_scoop_installed(&app).await?;

        let output = app
            .shell()
            .command("powershell")
            .args(["-Command", "scoop install rclone"])
            .output()
            .await
            .map_err(|e| format!("Failed to execute scoop: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);

            // Combine stderr and stdout for better error messages
            let error_msg = if !stderr.is_empty() {
                stderr.to_string()
            } else if !stdout.is_empty() {
                stdout.to_string()
            } else {
                "Unknown error occurred".to_string()
            };

            return Err(format!("Rclone installation failed: {}", error_msg.trim()));
        }

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Auto-install is only supported on Windows. Please install rclone manually.".to_string())
    }
}

#[command]
pub async fn install_winfsp(_app: tauri::AppHandle) -> Result<(), String> {
    // This is kept for API compatibility but WinFsp is now installed via download_and_launch_winfsp_installer
    Err("Use download_and_launch_winfsp_installer instead".to_string())
}

#[command]
pub async fn download_and_launch_winfsp_installer(app: tauri::AppHandle) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        // Fetch latest release info from GitHub API
        let api_output = app
            .shell()
            .command("powershell")
            .args([
                "-Command",
                r#"
                $response = Invoke-RestMethod -Uri 'https://api.github.com/repos/winfsp/winfsp/releases/latest' -UseBasicParsing;
                $asset = $response.assets | Where-Object { $_.name -like '*.msi' -and $_.name -notlike '*arm*' } | Select-Object -First 1;
                Write-Output "$($asset.browser_download_url)|$($asset.name)|$($response.tag_name)"
                "#,
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to fetch release info: {}", e))?;

        let stdout = String::from_utf8_lossy(&api_output.stdout);
        let trimmed = stdout.trim();

        if trimmed.is_empty() || !trimmed.contains('|') {
            return Err("Failed to get WinFsp download URL from GitHub".to_string());
        }

        let parts: Vec<&str> = trimmed.split('|').collect();
        let download_url = parts[0];
        let file_name = if parts.len() > 1 { parts[1] } else { "winfsp.msi" };
        let version = if parts.len() > 2 { parts[2] } else { "unknown" };

        // Download to temp directory
        let temp_path = format!("{}\\{}", std::env::temp_dir().to_string_lossy(), file_name);

        let download_output = app
            .shell()
            .command("powershell")
            .args([
                "-Command",
                &format!(
                    "Invoke-WebRequest -Uri '{}' -OutFile '{}' -UseBasicParsing",
                    download_url, temp_path
                ),
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to download installer: {}", e))?;

        if !download_output.status.success() {
            let stderr = String::from_utf8_lossy(&download_output.stderr);
            return Err(format!("Download failed: {}", stderr.trim()));
        }

        // Launch the installer (user goes through wizard)
        crate::util::cmd("msiexec")
            .args(["/i", &temp_path])
            .spawn()
            .map_err(|e| format!("Failed to launch installer: {}", e))?;

        Ok(version.to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("WinFsp is Windows-only. On macOS/Linux, use FUSE instead.".to_string())
    }
}

#[command]
pub async fn refresh_path() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // On Windows, we need to reload the PATH from the registry
        // This doesn't actually update the current process, but we can notify the user
        // The PATH will be updated on next app restart
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}

/// Creates a Start Menu shortcut and registers the AppUserModelID so Windows
/// attributes toast notifications to "Rclone Mount Hub" instead of "Windows PowerShell".
#[command]
pub async fn add_to_start_menu() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("Failed to get exe path: {}", e))?;
        let exe_str = exe_path.to_string_lossy().replace('\'', "''");

        // PowerShell script:
        // 1. Create the .lnk in %APPDATA%\Microsoft\Windows\Start Menu\Programs\
        // 2. Set the AppUserModelID on the shortcut via IPropertyStore (Windows Shell COM)
        //    This is what tells Windows which "app" is sending notifications.
        let script = format!(r#"
$ExePath = '{exe}'
$AppName = 'Rclone Mount Hub'
$Aumid   = 'com.cbuzi.rclone-mount-hub'
$StartMenuDir = [Environment]::GetFolderPath('Programs')
$LnkPath = Join-Path $StartMenuDir "$AppName.lnk"

# Create the shortcut
$WshShell = New-Object -ComObject WScript.Shell
$sc = $WshShell.CreateShortcut($LnkPath)
$sc.TargetPath      = $ExePath
$sc.WorkingDirectory = Split-Path -Parent $ExePath
$sc.IconLocation    = "$ExePath,0"
$sc.Description     = 'Manage rclone drive mounts'
$sc.Save()

# Set AppUserModelID on the .lnk via IPropertyStore so Windows uses our
# app name/icon for toast notifications instead of "Windows PowerShell"
$sig = @'
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
public static class Lnk {{
    [DllImport("shell32.dll")] static extern int SHGetPropertyStoreFromParsingName(
        [MarshalAs(UnmanagedType.LPWStr)] string path, IntPtr pbc,
        int flags, ref Guid riid, out IPropertyStore ppv);
    [ComImport][Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IPropertyStore {{
        int GetCount(out uint c); int GetAt(uint i, out PROPERTYKEY k);
        int GetValue(ref PROPERTYKEY k, out PROPVARIANT v);
        int SetValue(ref PROPERTYKEY k, ref PROPVARIANT v);
        int Commit();
    }}
    [StructLayout(LayoutKind.Sequential)] public struct PROPERTYKEY {{
        public Guid fmtid; public uint pid;
    }}
    [StructLayout(LayoutKind.Explicit)] public struct PROPVARIANT {{
        [FieldOffset(0)] public ushort vt;
        [FieldOffset(8)] public IntPtr pwszVal;
    }}
    public static void SetAumid(string lnkPath, string aumid) {{
        var riid = new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99");
        IPropertyStore ps;
        SHGetPropertyStoreFromParsingName(lnkPath, IntPtr.Zero, 1, ref riid, out ps);
        var key = new PROPERTYKEY {{
            fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), pid = 5
        }};
        var pv = new PROPVARIANT();
        pv.vt = 31; // VT_LPWSTR
        pv.pwszVal = Marshal.StringToCoTaskMemUni(aumid);
        ps.SetValue(ref key, ref pv);
        ps.Commit();
        Marshal.ReleaseComObject(ps);
        Marshal.FreeCoTaskMem(pv.pwszVal);
    }}
}}
'@
Add-Type -TypeDefinition $sig -Language CSharp
[Lnk]::SetAumid($LnkPath, $Aumid)
Write-Output "OK: $LnkPath"
"#, exe = exe_str);

        let output = crate::util::cmd("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
            .output()
            .map_err(|e| format!("Failed to run PowerShell: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to create Start Menu shortcut:\n{}", stderr.trim()));
        }

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Start Menu is Windows-only.".to_string())
    }
}

#[command]
pub async fn remove_from_start_menu() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let start_menu_dir = std::env::var("APPDATA")
            .map_err(|e| format!("Failed to get APPDATA: {}", e))?;
        let lnk_path = format!(
            "{}\\Microsoft\\Windows\\Start Menu\\Programs\\Rclone Mount Hub.lnk",
            start_menu_dir
        );

        if std::path::Path::new(&lnk_path).exists() {
            std::fs::remove_file(&lnk_path)
                .map_err(|e| format!("Failed to remove shortcut: {}", e))?;
        }

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Start Menu is Windows-only.".to_string())
    }
}

#[command]
pub async fn open_rclone_web_ui(app: tauri::AppHandle) -> Result<(), String> {
    // Spawn rclone rcd --rc-web-gui in a new terminal window
    #[cfg(target_os = "windows")]
    {
        app.shell()
            .command("cmd")
            .args(["/c", "start", "cmd", "/k", "rclone", "rcd", "--rc-web-gui"])
            .spawn()
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        app.shell()
            .command("open")
            .args(["-a", "Terminal", "rclone", "rcd", "--rc-web-gui"])
            .spawn()
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    #[cfg(target_os = "linux")]
    {
        app.shell()
            .command("x-terminal-emulator")
            .args(["-e", "rclone", "rcd", "--rc-web-gui"])
            .spawn()
            .map_err(|e| e.to_string())?;

        Ok(())
    }
}

#[command]
pub async fn get_driver_versions(app: tauri::AppHandle) -> Result<DriverVersions, String> {
    // Check Rclone version
    let (rclone_installed, rclone_version) = match app
        .shell()
        .command("rclone")
        .args(["version"])
        .output()
        .await
    {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // Extract version from first line (e.g., "rclone v1.65.0")
            let version = stdout
                .lines()
                .next()
                .and_then(|line| line.split_whitespace().nth(1))
                .map(|v| v.to_string());
            (true, version)
        }
        _ => (false, None),
    };

    // Check WinFsp installation
    let (winfsp_installed, winfsp_version) = {
        #[cfg(target_os = "windows")]
        {
            // Check if WinFsp registry key exists (means it's installed)
            let reg_check = crate::util::cmd("reg")
                .args([
                    "query",
                    "HKLM\\SOFTWARE\\WOW6432Node\\WinFsp",
                ])
                .output();

            if let Ok(output) = reg_check {
                if output.status.success() {
                    // WinFsp is installed, try to get install dir for version
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    // Just report as "ready" since version extraction is complex
                    let _ = stdout; // suppress unused warning
                    (true, Some("ready".to_string()))
                } else {
                    (false, None)
                }
            } else {
                (false, None)
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            (false, None)
        }
    };

    Ok(DriverVersions {
        rclone_installed,
        rclone_version,
        winfsp_installed,
        winfsp_version,
    })
}

#[command]
pub async fn uninstall_rclone(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let output = app
            .shell()
            .command("powershell")
            .args(["-Command", "scoop uninstall rclone"])
            .output()
            .await
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to uninstall rclone: {}", stderr));
        }

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Uninstall is only supported on Windows via scoop.".to_string())
    }
}

#[command]
pub async fn uninstall_winfsp(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let output = app
            .shell()
            .command("powershell")
            .args(["-Command", "scoop uninstall winfsp-np"])
            .output()
            .await
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to uninstall WinFsp: {}", stderr));
        }

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("WinFsp is Windows-only.".to_string())
    }
}

#[command]
pub async fn check_driver_updates(app: tauri::AppHandle) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        // Update scoop first
        let _ = app
            .shell()
            .command("powershell")
            .args(["-Command", "scoop update"])
            .output()
            .await;

        // Check for updates
        let output = app
            .shell()
            .command("powershell")
            .args(["-Command", "scoop status"])
            .output()
            .await
            .map_err(|e| e.to_string())?;

        let stdout = String::from_utf8_lossy(&output.stdout);

        if stdout.contains("Latest versions") || stdout.contains("up to date") {
            Ok("All drivers are up to date".to_string())
        } else if stdout.contains("rclone") || stdout.contains("winfsp") {
            Ok("Updates available. Click Install/Update Drivers to update.".to_string())
        } else {
            Ok("All drivers are up to date".to_string())
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok("Update checking is only supported on Windows.".to_string())
    }
}

// ── App self-update (Velopack) ────────────────────────────────────────────────

/// Change this to your GitHub releases URL once you publish releases, e.g.:
/// "https://github.com/YOUR_USERNAME/YOUR_REPO/releases/latest/download"
const UPDATE_FEED_URL: &str = "https://github.com/Bristopher/Rclone-Mount-Hub/releases/latest/download";

#[derive(serde::Serialize)]
pub struct AppUpdateInfo {
    pub available: bool,
    pub version: Option<String>,
    pub release_notes: Option<String>,
    pub download_size: Option<u64>,
}

const GITHUB_API_URL: &str = "https://api.github.com/repos/Bristopher/Rclone-Mount-Hub/releases/latest";

#[command]
pub async fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[command]
pub async fn check_app_update() -> Result<AppUpdateInfo, String> {
    // Check Velopack for available updates
    let velopack_result: Option<String> = tokio::task::spawn_blocking(|| -> Result<Option<String>, String> {
        let source = velopack::sources::AutoSource::new(UPDATE_FEED_URL);
        let um = velopack::UpdateManager::new(source, None, None)
            .map_err(|e| e.to_string())?;
        match um.check_for_updates().map_err(|e| e.to_string())? {
            velopack::UpdateCheck::UpdateAvailable(info) => Ok(Some(info.TargetFullRelease.Version.clone())),
            _ => Ok(None),
        }
    })
    .await
    .map_err(|e| e.to_string())??;

    if let Some(version) = velopack_result {
        // Fetch release notes and size from GitHub API
        let (notes, size) = fetch_github_release_info().await;
        Ok(AppUpdateInfo {
            available: true,
            version: Some(version),
            release_notes: notes,
            download_size: size,
        })
    } else {
        Ok(AppUpdateInfo { available: false, version: None, release_notes: None, download_size: None })
    }
}

/// Fetch release notes and total asset size from GitHub releases API
async fn fetch_github_release_info() -> (Option<String>, Option<u64>) {
    let client = match reqwest::Client::builder()
        .user_agent("RcloneMountHub")
        .build()
    {
        Ok(c) => c,
        Err(_) => return (None, None),
    };

    let resp = match client.get(GITHUB_API_URL).send().await {
        Ok(r) => r,
        Err(_) => return (None, None),
    };

    let json: serde_json::Value = match resp.json().await {
        Ok(j) => j,
        Err(_) => return (None, None),
    };

    let notes = json.get("body")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Sum all asset sizes for the download size estimate
    let size = json.get("assets")
        .and_then(|a| a.as_array())
        .map(|assets| {
            assets.iter()
                .filter_map(|a| a.get("size").and_then(|s| s.as_u64()))
                .sum()
        });

    (notes, size)
}

#[command]
pub async fn apply_app_update(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Emitter;

    // Kill all rclone mount processes before the update replaces files
    crate::commands::rclone::kill_all_mounts();

    // Set up a channel to forward download progress to the frontend
    let (tx, rx) = std::sync::mpsc::channel::<i16>();
    let handle = app.clone();

    // Spawn a task to forward progress events from the channel to Tauri
    tauri::async_runtime::spawn(async move {
        loop {
            match rx.recv() {
                Ok(progress) => {
                    let _ = handle.emit("update-download-progress", progress);
                }
                Err(_) => break, // channel closed
            }
        }
    });

    tokio::task::spawn_blocking(move || {
        let source = velopack::sources::AutoSource::new(UPDATE_FEED_URL);
        let um = velopack::UpdateManager::new(source, None, None)
            .map_err(|e| e.to_string())?;
        if let velopack::UpdateCheck::UpdateAvailable(updates) =
            um.check_for_updates().map_err(|e| e.to_string())?
        {
            um.download_updates(&updates, Some(tx)).map_err(|e| e.to_string())?;
            um.apply_updates_and_restart(&updates).map_err(|e| e.to_string())?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

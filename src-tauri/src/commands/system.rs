// System utility commands

use tauri::command;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_autostart::ManagerExt;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriverVersions {
    pub rclone_installed: bool,
    pub rclone_version: Option<String>,
    pub winfsp_installed: bool,
    pub winfsp_version: Option<String>,
}

#[command]
pub async fn enable_autostart(app: tauri::AppHandle) -> Result<(), String> {
    let autostart_manager = app.autostart();
    autostart_manager
        .enable()
        .map_err(|e| format!("Failed to enable autostart: {}", e))?;

    Ok(())
}

#[command]
pub async fn disable_autostart(app: tauri::AppHandle) -> Result<(), String> {
    let autostart_manager = app.autostart();
    autostart_manager
        .disable()
        .map_err(|e| format!("Failed to disable autostart: {}", e))?;

    Ok(())
}

#[command]
pub async fn is_autostart_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    let autostart_manager = app.autostart();
    autostart_manager
        .is_enabled()
        .map_err(|e| format!("Failed to check autostart status: {}", e))
}

#[command]
pub async fn install_rclone(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let output = app
            .shell()
            .command("winget")
            .args([
                "install",
                "-e",
                "--id",
                "Rclone.Rclone",
                "--accept-source-agreements",
                "--accept-package-agreements",
            ])
            .output()
            .await
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to install rclone: {}", stderr));
        }

        // Refresh PATH
        refresh_path().await?;

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Auto-install is only supported on Windows. Please install rclone manually.".to_string())
    }
}

#[command]
pub async fn install_winfsp(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let output = app
            .shell()
            .command("winget")
            .args([
                "install",
                "-e",
                "--id",
                "WinFsp.WinFsp",
                "--accept-source-agreements",
                "--accept-package-agreements",
            ])
            .output()
            .await
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to install WinFsp: {}", stderr));
        }

        Ok(())
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

    // Check WinFsp version
    let (winfsp_installed, winfsp_version) = {
        #[cfg(target_os = "windows")]
        {
            use std::process::Command;
            match Command::new("reg")
                .args([
                    "query",
                    "HKLM\\SOFTWARE\\WOW6432Node\\WinFsp",
                    "/v",
                    "Version",
                ])
                .output()
            {
                Ok(output) if output.status.success() => {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    // Extract version from registry output
                    let version = stdout
                        .lines()
                        .find(|line| line.contains("Version"))
                        .and_then(|line| line.split_whitespace().last())
                        .map(|v| v.trim_start_matches("0x"))
                        .map(|v| format_winfsp_version(v));
                    (true, version)
                }
                _ => (false, None),
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
            .command("winget")
            .args([
                "uninstall",
                "-e",
                "--id",
                "Rclone.Rclone",
                "--accept-source-agreements",
            ])
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
        Err("Uninstall is only supported on Windows via winget.".to_string())
    }
}

#[command]
pub async fn uninstall_winfsp(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let output = app
            .shell()
            .command("winget")
            .args([
                "uninstall",
                "-e",
                "--id",
                "WinFsp.WinFsp",
                "--accept-source-agreements",
            ])
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
        let output = app
            .shell()
            .command("winget")
            .args(["upgrade", "--id", "Rclone.Rclone"])
            .output()
            .await
            .map_err(|e| e.to_string())?;

        let stdout = String::from_utf8_lossy(&output.stdout);

        if stdout.contains("No applicable update found") {
            Ok("All drivers are up to date".to_string())
        } else if stdout.contains("available") {
            Ok("Updates available. Click Install/Update Drivers to update.".to_string())
        } else {
            Ok("Unable to check for updates".to_string())
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok("Update checking is only supported on Windows.".to_string())
    }
}

// Helper function to format WinFsp hex version to readable format
fn format_winfsp_version(hex_str: &str) -> String {
    if let Ok(num) = u32::from_str_radix(hex_str, 16) {
        let major = (num >> 16) & 0xFF;
        let minor = (num >> 8) & 0xFF;
        let patch = num & 0xFF;
        format!("v{}.{}.{}", major, minor, patch)
    } else {
        hex_str.to_string()
    }
}

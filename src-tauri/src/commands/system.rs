// System utility commands

use tauri::command;
use tauri_plugin_shell::ShellExt;

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

// Rclone command handlers

use tauri::command;
use tauri_plugin_shell::ShellExt;

#[command]
pub async fn check_rclone_installed(app: tauri::AppHandle) -> Result<bool, String> {
    let output = app
        .shell()
        .command("rclone")
        .args(["version"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    Ok(output.status.success())
}

#[command]
pub async fn check_winfsp_installed() -> Result<bool, String> {
    // Check Windows registry for WinFsp
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("reg")
            .args([
                "query",
                "HKLM\\SOFTWARE\\WOW6432Node\\WinFsp",
                "/v",
                "InstallDir",
            ])
            .output()
            .map_err(|e| e.to_string())?;

        Ok(output.status.success())
    }

    #[cfg(not(target_os = "windows"))]
    {
        // On non-Windows, just check if rclone mount works
        Ok(true)
    }
}

#[command]
pub async fn list_remotes(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let output = app
        .shell()
        .command("rclone")
        .args(["listremotes"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err("Failed to list rclone remotes".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let remotes: Vec<String> = stdout
        .lines()
        .filter(|line| !line.is_empty())
        .map(|line| line.trim_end_matches(':').to_string())
        .collect();

    Ok(remotes)
}

#[command]
pub async fn create_remote(
    app: tauri::AppHandle,
    name: String,
    url: String,
    vendor: String,
    user: String,
    pass: String,
) -> Result<(), String> {
    let output = app
        .shell()
        .command("rclone")
        .args([
            "config",
            "create",
            &name,
            "webdav",
            "url",
            &url,
            "vendor",
            &vendor,
            "user",
            &user,
            "pass",
            &pass,
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to create remote: {}", stderr));
    }

    Ok(())
}

#[command]
pub async fn delete_remote(app: tauri::AppHandle, name: String) -> Result<(), String> {
    let output = app
        .shell()
        .command("rclone")
        .args(["config", "delete", &name])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to delete remote: {}", stderr));
    }

    Ok(())
}

#[command]
pub async fn get_available_drives() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        // Get list of used drives
        let output = Command::new("wmic")
            .args(["logicaldisk", "get", "name"])
            .output()
            .map_err(|e| e.to_string())?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let used_drives: Vec<String> = stdout
            .lines()
            .skip(1) // Skip header
            .filter_map(|line| {
                let trimmed = line.trim();
                if trimmed.len() >= 2 && trimmed.ends_with(':') {
                    Some(trimmed.chars().next().unwrap().to_string())
                } else {
                    None
                }
            })
            .collect();

        // Generate list of available drives (D-Z, excluding used ones)
        let all_drives: Vec<String> = ('D'..='Z').map(|c| c.to_string()).collect();
        let available: Vec<String> = all_drives
            .into_iter()
            .filter(|drive| !used_drives.contains(drive))
            .collect();

        Ok(available)
    }

    #[cfg(not(target_os = "windows"))]
    {
        // On non-Windows, mount points are handled differently
        Ok(vec![])
    }
}

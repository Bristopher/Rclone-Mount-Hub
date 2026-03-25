// Rclone command handlers

use tauri::command;
use tauri_plugin_shell::ShellExt;
use std::sync::Mutex;
use std::collections::HashMap;
use crate::config::{Connection, MountStatus, MountState, NetworkMode};
use serde_json;

// Global state to track active mounts
static ACTIVE_MOUNTS: Mutex<Option<HashMap<String, MountInfo>>> = Mutex::new(None);

// Custom rclone config path (None = use rclone's own default)
static RCLONE_CONFIG_PATH: Mutex<Option<String>> = Mutex::new(None);

/// Returns `["--config", "<path>"]` args to prepend when a custom path is set.
fn config_args() -> Vec<String> {
    let lock = RCLONE_CONFIG_PATH.lock().unwrap();
    match lock.as_ref() {
        Some(p) if !p.is_empty() => vec!["--config".to_string(), p.clone()],
        _ => vec![],
    }
}

#[command]
pub async fn set_rclone_config_path(path: String) -> Result<(), String> {
    let mut lock = RCLONE_CONFIG_PATH.lock().unwrap();
    *lock = if path.is_empty() { None } else { Some(path) };
    Ok(())
}

#[command]
pub async fn get_rclone_config_path() -> String {
    let lock = RCLONE_CONFIG_PATH.lock().unwrap();
    lock.clone().unwrap_or_default()
}

#[command]
pub async fn get_default_rclone_config_path() -> String {
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            return format!("{}\\rclone\\rclone.conf", appdata);
        }
    }
    // macOS / Linux fallback
    if let Ok(home) = std::env::var("HOME") {
        return format!("{}/.config/rclone/rclone.conf", home);
    }
    String::new()
}

#[derive(Debug, Clone)]
struct MountInfo {
    _connection_id: String,
    pid: u32,
    _drive_letter: String,
    active_mode: String,
    active_url: String,
}

fn get_mounts_map() -> HashMap<String, MountInfo> {
    let mut lock = ACTIVE_MOUNTS.lock().unwrap();
    if lock.is_none() {
        *lock = Some(HashMap::new());
    }
    lock.as_ref().unwrap().clone()
}

fn insert_mount(connection_id: String, info: MountInfo) {
    let mut lock = ACTIVE_MOUNTS.lock().unwrap();
    if lock.is_none() {
        *lock = Some(HashMap::new());
    }
    lock.as_mut().unwrap().insert(connection_id, info);
}

fn remove_mount(connection_id: &str) {
    let mut lock = ACTIVE_MOUNTS.lock().unwrap();
    if let Some(ref mut map) = *lock {
        map.remove(connection_id);
    }
}

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
        let output = crate::util::cmd("reg")
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
    let mut args = config_args();
    args.push("listremotes".to_string());
    let output = app
        .shell()
        .command("rclone")
        .args(&args)
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
    remote_type: String,
    params: std::collections::HashMap<String, String>,
) -> Result<(), String> {
    // Build: rclone [--config path] config create <name> <type> key1 val1 key2 val2 ...
    let mut args = config_args();
    args.extend(["config".to_string(), "create".to_string(), name, remote_type]);

    // Append each param as a key-value pair
    for (key, value) in &params {
        args.push(key.clone());
        args.push(value.clone());
    }

    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    let output = app
        .shell()
        .command("rclone")
        .args(&args_ref)
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
    let mut args = config_args();
    args.extend(["config".to_string(), "delete".to_string(), name.clone()]);
    let output = app
        .shell()
        .command("rclone")
        .args(&args)
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
        // Get list of used drives
        let output = crate::util::cmd("wmic")
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

#[command]
pub async fn mount_drive(
    app: tauri::AppHandle,
    connection_json: String,
) -> Result<MountStatus, String> {
    let connection: Connection = serde_json::from_str(&connection_json)
        .map_err(|e| format!("Invalid connection data: {}", e))?;

    // Detect which network to use
    let (url, active_mode) = match connection.network_mode {
        NetworkMode::Auto => {
            // Try local first, fall back to tailscale
            let local_ip = &connection.local_ip;
            let port = connection.port;

            use crate::commands::network::ping_port;
            let is_local_reachable = ping_port(local_ip.clone(), port, 1000).await?;

            if is_local_reachable {
                (format!("http://{}:{}", local_ip, port), "local".to_string())
            } else {
                (format!("http://{}:{}", connection.tailscale_ip, port), "tailscale".to_string())
            }
        },
        NetworkMode::Local => {
            (format!("http://{}:{}", connection.local_ip, connection.port), "local".to_string())
        },
        NetworkMode::Tailscale => {
            (format!("http://{}:{}", connection.tailscale_ip, connection.port), "tailscale".to_string())
        },
    };

    // Get speed profile configuration
    let profile_config = connection.speed_profile.get_config();

    // Apply per-connection overrides
    let overrides = connection.cache_overrides.as_ref();
    let vfs_cache_mode = overrides.and_then(|o| o.vfs_cache_mode.clone()).unwrap_or(profile_config.vfs_cache_mode);
    let vfs_cache_max_size = overrides.and_then(|o| o.vfs_cache_max_size.clone()).unwrap_or(profile_config.vfs_cache_max_size);
    let vfs_read_ahead = overrides.and_then(|o| o.vfs_read_ahead.clone()).unwrap_or(profile_config.vfs_read_ahead);
    let buffer_size = overrides.and_then(|o| o.buffer_size.clone()).unwrap_or(profile_config.buffer_size);
    let transfers = overrides.and_then(|o| o.transfers).unwrap_or(profile_config.transfers);
    let multi_thread_streams = overrides.and_then(|o| o.multi_thread_streams).unwrap_or(profile_config.multi_thread_streams);
    let dir_cache_time = overrides.and_then(|o| o.dir_cache_time.clone()).unwrap_or(profile_config.dir_cache_time);
    let poll_interval = overrides.and_then(|o| o.poll_interval.clone()).unwrap_or(profile_config.poll_interval);

    // Build rclone mount command
    let drive = format!("{}:", connection.drive_letter);
    let remote = format!("{}:", connection.name);

    let mut args = config_args();
    args.extend([
        "mount".to_string(),
        remote,
        drive.clone(),
        "--webdav-url".to_string(),
        url.clone(),
        "--vfs-cache-mode".to_string(),
        vfs_cache_mode,
        "--vfs-cache-max-size".to_string(),
        vfs_cache_max_size,
        "--vfs-read-ahead".to_string(),
        vfs_read_ahead,
        "--buffer-size".to_string(),
        buffer_size,
        "--transfers".to_string(),
        transfers.to_string(),
        "--multi-thread-streams".to_string(),
        multi_thread_streams.to_string(),
        "--dir-cache-time".to_string(),
        dir_cache_time,
        "--poll-interval".to_string(),
        poll_interval,
        format!("--volname={}", connection.name),
    ]);

    if profile_config.ignore_checksum {
        args.push("--ignore-checksum".to_string());
    }
    if profile_config.no_modtime {
        args.push("--no-modtime".to_string());
    }
    if !profile_config.network_mode {
        args.push("--network-mode=false".to_string());
    }

    // Check if drive letter is already in use before spawning
    #[cfg(target_os = "windows")]
    {
        let drive_path = format!("{}:\\", connection.drive_letter.to_uppercase());
        if std::path::Path::new(&drive_path).exists() {
            return Err(format!(
                "Drive {}:\\ is already in use. Unmount it first or choose a different drive letter.",
                connection.drive_letter.to_uppercase()
            ));
        }
    }

    // Spawn rclone process
    let (_rx, child) = app
        .shell()
        .command("rclone")
        .args(&args)
        .spawn()
        .map_err(|e| format!("Failed to spawn rclone: {}", e))?;

    let pid = child.pid();

    // Wait briefly and verify the process survived (catches immediate failures like drive-in-use)
    std::thread::sleep(std::time::Duration::from_millis(800));
    if !is_process_alive(pid) {
        return Err(format!(
            "rclone exited immediately — drive {}:\\ may be in use, or check your connection settings.",
            connection.drive_letter.to_uppercase()
        ));
    }

    // Store mount info
    insert_mount(connection.id.clone(), MountInfo {
        _connection_id: connection.id.clone(),
        pid,
        _drive_letter: connection.drive_letter.clone(),
        active_mode: active_mode.clone(),
        active_url: url.clone(),
    });

    Ok(MountStatus {
        connection_id: connection.id,
        state: MountState::Mounted,
        active_mode: Some(active_mode),
        active_url: Some(url),
        pid: Some(pid),
        error: None,
    })
}

#[command]
pub async fn unmount_drive(connection_id: String) -> Result<(), String> {
    let mounts = get_mounts_map();

    if let Some(mount_info) = mounts.get(&connection_id) {
        let pid = mount_info.pid;

        #[cfg(target_os = "windows")]
        {
            // Kill the rclone process by PID
            crate::util::cmd("taskkill")
                .args(["/F", "/PID", &pid.to_string()])
                .output()
                .map_err(|e| format!("Failed to kill process: {}", e))?;
        }

        #[cfg(not(target_os = "windows"))]
        {
            use std::process::Command;
            Command::new("kill")
                .args(["-9", &pid.to_string()])
                .output()
                .map_err(|e| format!("Failed to kill process: {}", e))?;
        }

        // Remove from tracking
        remove_mount(&connection_id);

        Ok(())
    } else {
        Err("Mount not found".to_string())
    }
}

#[command]
pub async fn get_mount_status(connection_id: String) -> Result<MountStatus, String> {
    let mounts = get_mounts_map();

    if let Some(mount_info) = mounts.get(&connection_id) {
        // Check if process is still alive
        let is_alive = is_process_alive(mount_info.pid);

        if is_alive {
            Ok(MountStatus {
                connection_id: connection_id.clone(),
                state: MountState::Mounted,
                active_mode: Some(mount_info.active_mode.clone()),
                active_url: Some(mount_info.active_url.clone()),
                pid: Some(mount_info.pid),
                error: None,
            })
        } else {
            // Process died, remove from tracking
            remove_mount(&connection_id);
            Ok(MountStatus {
                connection_id: connection_id.clone(),
                state: MountState::Unmounted,
                active_mode: None,
                active_url: None,
                pid: None,
                error: Some("Process terminated unexpectedly".to_string()),
            })
        }
    } else {
        Ok(MountStatus {
            connection_id: connection_id.clone(),
            state: MountState::Unmounted,
            active_mode: None,
            active_url: None,
            pid: None,
            error: None,
        })
    }
}

#[command]
pub async fn get_all_mount_statuses() -> Result<Vec<MountStatus>, String> {
    let mounts = get_mounts_map();
    let mut statuses = Vec::new();

    for (connection_id, mount_info) in mounts.iter() {
        let is_alive = is_process_alive(mount_info.pid);

        if is_alive {
            statuses.push(MountStatus {
                connection_id: connection_id.clone(),
                state: MountState::Mounted,
                active_mode: Some(mount_info.active_mode.clone()),
                active_url: Some(mount_info.active_url.clone()),
                pid: Some(mount_info.pid),
                error: None,
            });
        }
    }

    Ok(statuses)
}

#[command]
pub async fn unmount_external_mount(pid: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let output = crate::util::cmd("taskkill")
            .args(["/F", "/PID", &pid.to_string()])
            .output()
            .map_err(|e| format!("Failed to kill process: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to unmount: {}", stderr));
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;
        let output = Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output()
            .map_err(|e| format!("Failed to kill process: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to unmount: {}", stderr));
        }
    }

    Ok(())
}

fn is_process_alive(pid: u32) -> bool {
    #[cfg(target_os = "windows")]
    {
        let output = crate::util::cmd("tasklist")
            .args(["/FI", &format!("PID eq {}", pid), "/NH"])
            .output();

        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            stdout.contains(&pid.to_string())
        } else {
            false
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;
        let output = Command::new("ps")
            .args(["-p", &pid.to_string()])
            .output();

        if let Ok(output) = output {
            output.status.success()
        } else {
            false
        }
    }
}

// New commands for viewing rclone config and detecting external mounts

#[derive(Debug, serde::Serialize)]
pub struct RcloneRemote {
    pub name: String,
    pub remote_type: String,
}

#[derive(Debug, serde::Serialize)]
pub struct ExternalMount {
    pub pid: u32,
    pub remote_name: String,
    pub mount_point: String,
    pub command_line: String,
}

#[command]
pub async fn list_rclone_remotes(app: tauri::AppHandle) -> Result<Vec<RcloneRemote>, String> {
    // Get full config dump once (contains all remotes with their settings)
    let mut args = config_args();
    args.extend(["config".to_string(), "dump".to_string()]);
    let dump_output = app
        .shell()
        .command("rclone")
        .args(&args)
        .output()
        .await
        .map_err(|e| format!("Failed to dump config: {}", e))?;

    if !dump_output.status.success() {
        return Err("Failed to get rclone config".to_string());
    }

    let dump_str = String::from_utf8_lossy(&dump_output.stdout);
    let config: serde_json::Value = serde_json::from_str(&dump_str)
        .unwrap_or(serde_json::Value::Object(serde_json::Map::new()));

    let mut remotes = Vec::new();

    if let Some(obj) = config.as_object() {
        for (name, settings) in obj {
            let remote_type = settings
                .get("type")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string();

            remotes.push(RcloneRemote {
                name: name.clone(),
                remote_type,
            });
        }
    }

    Ok(remotes)
}

#[command]
pub async fn get_rclone_config_dump(app: tauri::AppHandle) -> Result<String, String> {
    let mut args = config_args();
    args.extend(["config".to_string(), "dump".to_string()]);
    let output = app
        .shell()
        .command("rclone")
        .args(&args)
        .output()
        .await
        .map_err(|e| format!("Failed to dump config: {}", e))?;

    if !output.status.success() {
        return Err("Failed to get rclone config".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.to_string())
}

#[command]
pub async fn list_external_rclone_mounts() -> Result<Vec<ExternalMount>, String> {
    #[cfg(target_os = "windows")]
    {
        // WMIC is deprecated/removed in Windows 11 - use PowerShell Get-CimInstance instead
        let ps_script = r#"
            $procs = Get-CimInstance Win32_Process -Filter "Name='rclone.exe'" |
                     Select-Object ProcessId, CommandLine
            $procs | ConvertTo-Json -Compress
        "#;

        let output = crate::util::cmd("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", ps_script])
            .output()
            .map_err(|e| format!("Failed to list processes: {}", e))?;

        if !output.status.success() {
            return Ok(Vec::new());
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stdout = stdout.trim();
        if stdout.is_empty() {
            return Ok(Vec::new());
        }

        // PowerShell returns an object or array depending on count - normalize to array
        let json_str = if stdout.starts_with('[') {
            stdout.to_string()
        } else {
            format!("[{}]", stdout)
        };

        let processes: Vec<serde_json::Value> = serde_json::from_str(&json_str)
            .unwrap_or_default();

        let tracked_pids: Vec<u32> = get_mounts_map().values().map(|m| m.pid).collect();
        let mut mounts = Vec::new();
        // Track which (remote, mount_point) pairs we've already added to deduplicate shim processes
        let mut seen_mounts: std::collections::HashSet<String> = std::collections::HashSet::new();

        for proc in &processes {
            let pid = proc.get("ProcessId")
                .and_then(|v| v.as_u64())
                .map(|v| v as u32)
                .unwrap_or(0);

            let command_line = proc.get("CommandLine")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            if pid == 0 || command_line.is_empty() {
                continue;
            }

            if !command_line.contains("mount") {
                continue;
            }

            if tracked_pids.contains(&pid) {
                continue;
            }

            // Parse remote name and mount point from command line
            let mut remote_name = String::new();
            let mut mount_point = String::new();

            let args: Vec<&str> = command_line.split_whitespace().collect();
            for (i, arg) in args.iter().enumerate() {
                if *arg == "mount" && i + 2 < args.len() {
                    remote_name = args[i + 1].trim_matches('"').to_string();
                    mount_point = args[i + 2].trim_matches('"').to_string();
                    break;
                }
            }

            // Deduplicate by (remote, mount_point) - Scoop shim + real binary both appear
            let key = format!("{}:{}", remote_name, mount_point);
            if seen_mounts.contains(&key) {
                continue;
            }
            seen_mounts.insert(key);

            mounts.push(ExternalMount {
                pid,
                remote_name,
                mount_point,
                command_line,
            });
        }

        Ok(mounts)
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;

        let output = Command::new("ps")
            .args(["aux"])
            .output()
            .map_err(|e| format!("Failed to list processes: {}", e))?;

        if !output.status.success() {
            return Ok(Vec::new());
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut mounts = Vec::new();
        let tracked_pids: Vec<u32> = get_mounts_map().values().map(|m| m.pid).collect();

        for line in stdout.lines() {
            if !line.contains("rclone") || !line.contains("mount") {
                continue;
            }

            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 2 {
                continue;
            }

            if let Ok(pid) = parts[1].parse::<u32>() {
                if tracked_pids.contains(&pid) {
                    continue;
                }

                let command_line = parts[10..].join(" ");

                mounts.push(ExternalMount {
                    pid,
                    remote_name: String::new(),
                    mount_point: String::new(),
                    command_line,
                });
            }
        }

        Ok(mounts)
    }
}

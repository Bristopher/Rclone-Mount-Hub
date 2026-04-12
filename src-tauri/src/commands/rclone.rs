// Rclone command handlers

use tauri::command;
use tauri::Emitter;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
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
    cache_dir: Option<String>,
) -> Result<MountStatus, String> {
    let connection: Connection = serde_json::from_str(&connection_json)
        .map_err(|e| format!("Invalid connection data: {}", e))?;

    // Detect which network to use
    use crate::commands::network::ping_port;
    let local_ip = &connection.local_ip;
    let tailscale_ip = &connection.tailscale_ip;
    let port = connection.port;

    let (url, active_mode, mount_log) = match connection.network_mode {
        NetworkMode::Auto => {
            let local_reachable = if !local_ip.is_empty() {
                ping_port(local_ip.clone(), port, 1500).await.unwrap_or(false)
            } else {
                false
            };
            let tailscale_reachable = if !tailscale_ip.is_empty() {
                ping_port(tailscale_ip.clone(), port, 1500).await.unwrap_or(false)
            } else {
                false
            };

            if local_reachable {
                let log = if !tailscale_ip.is_empty() && !tailscale_reachable {
                    format!("Local {}:{} reachable. Tailscale {}:{} unreachable.", local_ip, port, tailscale_ip, port)
                } else {
                    format!("Local {}:{} reachable.", local_ip, port)
                };
                (format!("http://{}:{}", local_ip, port), "local".to_string(), log)
            } else if tailscale_reachable {
                let log = format!("Local {}:{} unreachable, connected via Tailscale ({}:{}).", local_ip, port, tailscale_ip, port);
                (format!("http://{}:{}", tailscale_ip, port), "tailscale".to_string(), log)
            } else {
                let mut msg = format!("Neither local ({}:{}) nor Tailscale ({}:{}) is reachable.", local_ip, port, tailscale_ip, port);
                if local_ip.is_empty() && tailscale_ip.is_empty() {
                    msg = "No local or Tailscale IP configured.".to_string();
                }
                return Err(format!("{} Check that your server is running and accessible.", msg));
            }
        },
        NetworkMode::Local => {
            if local_ip.is_empty() {
                return Err("No local IP configured for this connection.".to_string());
            }
            let reachable = ping_port(local_ip.clone(), port, 2000).await.unwrap_or(false);
            if !reachable {
                return Err(format!("Local IP {}:{} is not reachable. Check that your server is running.", local_ip, port));
            }
            let log = format!("Local {}:{} reachable.", local_ip, port);
            (format!("http://{}:{}", local_ip, port), "local".to_string(), log)
        },
        NetworkMode::Tailscale => {
            if tailscale_ip.is_empty() {
                return Err("No Tailscale IP configured for this connection.".to_string());
            }
            let reachable = ping_port(tailscale_ip.clone(), port, 2000).await.unwrap_or(false);
            if !reachable {
                return Err(format!("Tailscale IP {}:{} is not reachable. Check that Tailscale is connected.", tailscale_ip, port));
            }
            let log = format!("Tailscale {}:{} reachable.", tailscale_ip, port);
            (format!("http://{}:{}", tailscale_ip, port), "tailscale".to_string(), log)
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
        // Reserve 10G free on the cache drive so a large write can't fill
        // the OS drive. rclone will evict or block before hitting this floor.
        "--vfs-cache-min-free-space".to_string(),
        "10G".to_string(),
        // Start uploading immediately when the file handle closes instead
        // of waiting the default 5s. Reduces the window where a crash could
        // lose data sitting in the local cache.
        "--vfs-write-back".to_string(),
        "0s".to_string(),
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
    if let Some(ref dir) = cache_dir {
        if !dir.is_empty() {
            args.push("--cache-dir".to_string());
            args.push(dir.clone());
        }
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

    // Verify the drive letter actually appeared in the filesystem
    #[cfg(target_os = "windows")]
    {
        let drive_path = format!("{}:\\", connection.drive_letter.to_uppercase());
        let mut visible = false;
        for _attempt in 0..5 {
            if std::path::Path::new(&drive_path).exists() {
                visible = true;
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(500));
        }

        if !visible {
            // Store mount info so user can still unmount it
            insert_mount(connection.id.clone(), MountInfo {
                _connection_id: connection.id.clone(),
                pid,
                _drive_letter: connection.drive_letter.clone(),
                active_mode: active_mode.clone(),
                active_url: url.clone(),
            });

            return Ok(MountStatus {
                connection_id: connection.id,
                state: MountState::Mounted,
                active_mode: Some(active_mode),
                active_url: Some(url),
                pid: Some(pid),
                archive_pid: None,
                error: Some(format!(
                    "Drive {}:\\ not visible in Explorer. rclone running (PID {}). Possible causes: WinFsp issue, drive letter conflict, or auth failure.",
                    connection.drive_letter.to_uppercase(), pid
                )),
                log: Some(mount_log),
            });
        }
    }

    // Store main mount info
    insert_mount(connection.id.clone(), MountInfo {
        _connection_id: connection.id.clone(),
        pid,
        _drive_letter: connection.drive_letter.clone(),
        active_mode: active_mode.clone(),
        active_url: url.clone(),
    });

    // Spawn archive mount if dual_mount is enabled
    let mut archive_pid: Option<u32> = None;
    if connection.dual_mount {
        if let Some(ref archive_letter) = connection.archive_drive_letter {
            if !archive_letter.is_empty() {
                // Check archive drive letter is not already in use
                #[cfg(target_os = "windows")]
                let letter_free = !std::path::Path::new(&format!("{}:\\", archive_letter.to_uppercase())).exists();
                #[cfg(not(target_os = "windows"))]
                let letter_free = true;

                if letter_free {
                    let archive_drive = format!("{}:", archive_letter);
                    let archive_remote = format!("{}:", connection.name);
                    let mut archive_args = config_args();
                    archive_args.extend([
                        "mount".to_string(),
                        archive_remote,
                        archive_drive,
                        "--webdav-url".to_string(),
                        url.clone(),
                        "--vfs-cache-mode".to_string(),
                        "full".to_string(),
                        "--vfs-cache-max-size".to_string(),
                        "500G".to_string(),
                        "--vfs-cache-min-free-space".to_string(),
                        "10G".to_string(),
                        "--vfs-read-ahead".to_string(),
                        "1G".to_string(),
                        "--buffer-size".to_string(),
                        "512M".to_string(),
                        "--transfers".to_string(),
                        "8".to_string(),
                        "--multi-thread-streams".to_string(),
                        "8".to_string(),
                        "--dir-cache-time".to_string(),
                        "24h".to_string(),
                        "--poll-interval".to_string(),
                        "1h".to_string(),
                        "--ignore-checksum".to_string(),
                        "--no-modtime".to_string(),
                        "--read-only".to_string(),
                        "--network-mode=false".to_string(),
                        format!("--volname={} (Archive)", connection.name),
                    ]);
                    if let Some(ref dir) = cache_dir {
                        if !dir.is_empty() {
                            archive_args.push("--cache-dir".to_string());
                            archive_args.push(dir.clone());
                        }
                    }

                    if let Ok((_rx, archive_child)) = app.shell().command("rclone").args(&archive_args).spawn() {
                        let apid = archive_child.pid();
                        std::thread::sleep(std::time::Duration::from_millis(600));
                        if is_process_alive(apid) {
                            insert_mount(format!("{}-archive", connection.id), MountInfo {
                                _connection_id: connection.id.clone(),
                                pid: apid,
                                _drive_letter: archive_letter.clone(),
                                active_mode: active_mode.clone(),
                                active_url: url.clone(),
                            });
                            archive_pid = Some(apid);
                        }
                    }
                }
            }
        }
    }

    Ok(MountStatus {
        connection_id: connection.id,
        state: MountState::Mounted,
        active_mode: Some(active_mode),
        active_url: Some(url),
        pid: Some(pid),
        archive_pid,
        error: None,
        log: Some(mount_log),
    })
}

#[command]
pub async fn unmount_drive(connection_id: String) -> Result<(), String> {
    let mounts = get_mounts_map();

    if let Some(mount_info) = mounts.get(&connection_id) {
        let pid = mount_info.pid;

        #[cfg(target_os = "windows")]
        {
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

        remove_mount(&connection_id);

        // Also kill archive mount if present
        let archive_key = format!("{}-archive", connection_id);
        if let Some(archive_info) = mounts.get(&archive_key) {
            let apid = archive_info.pid;
            #[cfg(target_os = "windows")]
            {
                let _ = crate::util::cmd("taskkill")
                    .args(["/F", "/PID", &apid.to_string()])
                    .output();
            }
            #[cfg(not(target_os = "windows"))]
            {
                use std::process::Command;
                let _ = Command::new("kill").args(["-9", &apid.to_string()]).output();
            }
            remove_mount(&archive_key);
        }

        Ok(())
    } else {
        Err("Mount not found".to_string())
    }
}

#[command]
pub async fn get_mount_status(connection_id: String) -> Result<MountStatus, String> {
    let mounts = get_mounts_map();

    // Look up archive PID (may or may not exist)
    let archive_key = format!("{}-archive", connection_id);
    let archive_pid = mounts.get(&archive_key).and_then(|info| {
        if is_process_alive(info.pid) { Some(info.pid) } else { None }
    });

    if let Some(mount_info) = mounts.get(&connection_id) {
        let is_alive = is_process_alive(mount_info.pid);

        if is_alive {
            Ok(MountStatus {
                connection_id: connection_id.clone(),
                state: MountState::Mounted,
                active_mode: Some(mount_info.active_mode.clone()),
                active_url: Some(mount_info.active_url.clone()),
                pid: Some(mount_info.pid),
                archive_pid,
                error: None,
                log: None,
            })
        } else {
            remove_mount(&connection_id);
            Ok(MountStatus {
                connection_id: connection_id.clone(),
                state: MountState::Unmounted,
                active_mode: None,
                active_url: None,
                pid: None,
                archive_pid: None,
                error: Some("Process terminated unexpectedly".to_string()),
                log: None,
            })
        }
    } else {
        Ok(MountStatus {
            connection_id: connection_id.clone(),
            state: MountState::Unmounted,
            active_mode: None,
            active_url: None,
            pid: None,
            archive_pid: None,
            error: None,
            log: None,
        })
    }
}

#[command]
pub async fn get_all_mount_statuses() -> Result<Vec<MountStatus>, String> {
    let mounts = get_mounts_map();
    let mut statuses = Vec::new();

    for (connection_id, mount_info) in mounts.iter() {
        // Skip archive entries — they're rolled up into the primary connection status
        if connection_id.ends_with("-archive") {
            continue;
        }

        let is_alive = is_process_alive(mount_info.pid);
        if is_alive {
            // Look up archive PID for this connection
            let archive_key = format!("{}-archive", connection_id);
            let archive_pid = mounts.get(&archive_key).and_then(|info| {
                if is_process_alive(info.pid) { Some(info.pid) } else { None }
            });

            statuses.push(MountStatus {
                connection_id: connection_id.clone(),
                state: MountState::Mounted,
                active_mode: Some(mount_info.active_mode.clone()),
                active_url: Some(mount_info.active_url.clone()),
                pid: Some(mount_info.pid),
                archive_pid,
                error: None,
                log: None,
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

// ---------------------------------------------------------------------------
// Direct Upload — streams files to a remote via `rclone copy`, bypassing VFS
// ---------------------------------------------------------------------------

#[command]
pub async fn direct_upload(
    app: tauri::AppHandle,
    source_path: String,
    remote_name: String,
    dest_path: String,
    transfers: u32,
    webdav_url: Option<String>,
    cache_dir: Option<String>,
) -> Result<u32, String> {
    let remote_dest = if dest_path.is_empty() || dest_path == "/" {
        format!("{}:", remote_name)
    } else {
        format!("{}:{}", remote_name, dest_path)
    };

    let mut args = config_args();
    args.extend([
        "copy".to_string(),
        source_path,
        remote_dest,
        "-P".to_string(),
        "--transfers".to_string(),
        transfers.to_string(),
    ]);
    if let Some(ref url) = webdav_url {
        if !url.is_empty() {
            args.push("--webdav-url".to_string());
            args.push(url.clone());
        }
    }
    if let Some(ref dir) = cache_dir {
        if !dir.is_empty() {
            args.push("--cache-dir".to_string());
            args.push(dir.clone());
        }
    }

    let (mut rx, child) = app
        .shell()
        .command("rclone")
        .args(&args)
        .spawn()
        .map_err(|e| format!("Failed to spawn rclone copy: {}", e))?;

    let pid = child.pid();
    let handle = app.clone();

    // Stream rclone -P output to the frontend as events
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    let text = String::from_utf8_lossy(&bytes);
                    let _ = handle.emit("upload-progress", serde_json::json!({
                        "pid": pid,
                        "line": text.to_string(),
                    }));
                }
                CommandEvent::Stderr(bytes) => {
                    let text = String::from_utf8_lossy(&bytes);
                    let _ = handle.emit("upload-progress", serde_json::json!({
                        "pid": pid,
                        "line": text.to_string(),
                    }));
                }
                CommandEvent::Terminated(status) => {
                    let _ = handle.emit("upload-complete", serde_json::json!({
                        "pid": pid,
                        "code": status.code.unwrap_or(-1),
                    }));
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(pid)
}

#[command]
pub async fn cancel_upload(pid: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("taskkill")
            .args(["/F", "/PID", &pid.to_string()])
            .output()
            .map_err(|e| format!("Failed to kill upload process: {}", e))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output()
            .map_err(|e| format!("Failed to kill upload process: {}", e))?;
    }
    Ok(())
}

# Connection & Mount Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Created:** 2026_03-25
**Last Updated:** 2026_03-25
**Spec:** `Docs/specs/Connection-Mount-Reliability-Design.md`

**Goal:** Fix 7 reliability issues in Rclone Mount Hub: stale file cache, blind tailscale fallback, generic logging, invisible mounts, wrong IP display, no active-connection testing, and no network change detection.

**Architecture:** Backend changes in Rust (config.rs, rclone.rs, network.rs, lib.rs) for cache flags, IP validation, mount verification, network monitoring. Frontend changes in React (Dashboard, AddConnection, EditConnection, Settings, App) for test buttons, advanced cache UI, warning states, and network change handling.

**Tech Stack:** Rust/Tauri 2, React 19, TypeScript, Zustand, `windows` crate for `NotifyAddrChange`

---

## File Map

### Rust Backend
| File | Action | Responsibility |
|------|--------|---------------|
| `src-tauri/src/config.rs` | Modify | Add `dir_cache_time`, `poll_interval` to SpeedProfileConfig; add `CacheOverrides` struct; add `NetworkChangeMode` enum |
| `src-tauri/src/commands/network.rs` | Modify | Add `test_connection` command; add `start_network_monitor` function |
| `src-tauri/src/commands/rclone.rs` | Modify | Validate both IPs; verify drive visible; apply cache flags + overrides; structured logging |
| `src-tauri/src/lib.rs` | Modify | Register new commands; start network monitor in setup |
| `src-tauri/Cargo.toml` | Modify | Add `windows` crate dependency |

### Frontend
| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/types.ts` | Modify | Add `CacheOverrides` interface; add `network_change_mode` to AppSettings |
| `src/lib/store.ts` | Modify | Add default for `network_change_mode` |
| `src/pages/Dashboard.tsx` | Modify | Test button; active URL display; warning badge; network change handler |
| `src/pages/AddConnection.tsx` | Modify | Test both IPs; advanced cache settings section |
| `src/pages/EditConnection.tsx` | Modify | Test both IPs; advanced cache settings section |
| `src/pages/Settings.tsx` | Modify | Network change behavior section |
| `src/App.tsx` | Modify | Listen for `network-changed` Tauri event |

---

## Task 1: Fix Stale File Cache — Backend

**Files:**
- Modify: `src-tauri/src/config.rs:43-93`
- Modify: `src-tauri/src/commands/rclone.rs:276-314`

- [ ] **Step 1: Add cache fields to SpeedProfileConfig**

In `src-tauri/src/config.rs`, add two fields to the `SpeedProfileConfig` struct after `network_mode`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeedProfileConfig {
    pub vfs_cache_mode: String,
    pub vfs_cache_max_size: String,
    pub vfs_read_ahead: String,
    pub buffer_size: String,
    pub transfers: u32,
    pub multi_thread_streams: u32,
    pub ignore_checksum: bool,
    pub no_modtime: bool,
    pub network_mode: bool, // false = mount as local disk
    pub dir_cache_time: String,
    pub poll_interval: String,
}
```

- [ ] **Step 2: Set defaults per profile**

Update each match arm in `SpeedProfile::get_config()`:

```rust
impl SpeedProfile {
    pub fn get_config(&self) -> SpeedProfileConfig {
        match self {
            SpeedProfile::Max => SpeedProfileConfig {
                vfs_cache_mode: "full".to_string(),
                vfs_cache_max_size: "50G".to_string(),
                vfs_read_ahead: "512M".to_string(),
                buffer_size: "512M".to_string(),
                transfers: 16,
                multi_thread_streams: 16,
                ignore_checksum: true,
                no_modtime: false,
                network_mode: false,
                dir_cache_time: "0".to_string(),
                poll_interval: "5m".to_string(),
            },
            SpeedProfile::Balanced => SpeedProfileConfig {
                vfs_cache_mode: "full".to_string(),
                vfs_cache_max_size: "10G".to_string(),
                vfs_read_ahead: "128M".to_string(),
                buffer_size: "256M".to_string(),
                transfers: 8,
                multi_thread_streams: 8,
                ignore_checksum: true,
                no_modtime: false,
                network_mode: false,
                dir_cache_time: "0".to_string(),
                poll_interval: "5m".to_string(),
            },
            SpeedProfile::Low => SpeedProfileConfig {
                vfs_cache_mode: "full".to_string(),
                vfs_cache_max_size: "2G".to_string(),
                vfs_read_ahead: "32M".to_string(),
                buffer_size: "64M".to_string(),
                transfers: 4,
                multi_thread_streams: 4,
                ignore_checksum: true,
                no_modtime: false,
                network_mode: false,
                dir_cache_time: "30s".to_string(),
                poll_interval: "10m".to_string(),
            },
        }
    }
}
```

- [ ] **Step 3: Add CacheOverrides struct**

Add at the bottom of `config.rs`, before the `AppSettings` struct:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CacheOverrides {
    pub dir_cache_time: Option<String>,
    pub poll_interval: Option<String>,
    pub vfs_cache_mode: Option<String>,
    pub vfs_cache_max_size: Option<String>,
    pub vfs_read_ahead: Option<String>,
    pub buffer_size: Option<String>,
    pub transfers: Option<u32>,
    pub multi_thread_streams: Option<u32>,
}
```

- [ ] **Step 4: Add cache_overrides field to Connection struct**

In `config.rs`, add to the `Connection` struct after `created_at`:

```rust
    #[serde(default)]
    pub cache_overrides: Option<CacheOverrides>,
```

- [ ] **Step 5: Apply cache flags in mount_drive**

In `src-tauri/src/commands/rclone.rs`, in the `mount_drive` function, after the existing args are built (after `format!("--volname={}", connection.name)`), apply cache overrides and add the new flags. Replace the section that builds args (lines ~284-314) with:

```rust
    // Get speed profile configuration
    let profile_config = connection.speed_profile.get_config();

    // Apply per-connection overrides if set
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
```

- [ ] **Step 6: Build and verify compilation**

Run: `cd src-tauri && cargo check`
Expected: Compiles with no errors.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/config.rs src-tauri/src/commands/rclone.rs
git commit -m "feat: add dir-cache-time and poll-interval to speed profiles with per-connection overrides"
```

---

## Task 2: Validate Tailscale Fallback + Granular Logging — Backend

**Files:**
- Modify: `src-tauri/src/commands/rclone.rs:246-275`

- [ ] **Step 1: Rewrite network detection in mount_drive**

Replace the entire `match connection.network_mode { ... }` block (lines 254-275) in `mount_drive` with:

```rust
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
```

Note: `mount_log` is returned to the frontend via a new field. We'll add it in the next step.

- [ ] **Step 2: Add mount_log field to MountStatus**

In `src-tauri/src/config.rs`, add to the `MountStatus` struct:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MountStatus {
    pub connection_id: String,
    pub state: MountState,
    pub active_mode: Option<String>,
    pub active_url: Option<String>,
    pub pid: Option<u32>,
    pub error: Option<String>,
    pub log: Option<String>,
}
```

- [ ] **Step 3: Update all MountStatus constructions in rclone.rs**

Every place that constructs a `MountStatus` needs the new `log` field. Search for `MountStatus {` in `rclone.rs` and add `log: None,` (or `log: Some(mount_log.clone()),` for the success path).

In `mount_drive` success return (around line 356):
```rust
    Ok(MountStatus {
        connection_id: connection.id,
        state: MountState::Mounted,
        active_mode: Some(active_mode),
        active_url: Some(url),
        pid: Some(pid),
        error: None,
        log: Some(mount_log),
    })
```

In `get_mount_status` — both the alive and dead branches, and in `get_all_mount_statuses`, add `log: None,` to each `MountStatus` construction.

- [ ] **Step 4: Build and verify**

Run: `cd src-tauri && cargo check`
Expected: Compiles with no errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/config.rs src-tauri/src/commands/rclone.rs
git commit -m "feat: validate both IPs before mount, return structured log messages"
```

---

## Task 3: Verify Mount Visibility + Drive Letter Pre-Check — Backend

**Files:**
- Modify: `src-tauri/src/commands/rclone.rs` (mount_drive function, after process spawn)

- [ ] **Step 1: Add post-mount drive visibility check**

In `mount_drive`, after the existing 800ms sleep + `is_process_alive` check, and before `insert_mount`, add:

```rust
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
                error: Some(format!(
                    "Drive {}:\\ not visible in Explorer. rclone running (PID {}). Possible causes: WinFsp issue, drive letter conflict, or auth failure.",
                    connection.drive_letter.to_uppercase(), pid
                )),
                log: Some(mount_log),
            });
        }
    }
```

- [ ] **Step 2: Build and verify**

Run: `cd src-tauri && cargo check`
Expected: Compiles with no errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/rclone.rs
git commit -m "feat: verify drive letter visible in Explorer after mount, warn if not"
```

---

## Task 4: Frontend Type Updates

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/store.ts`

- [ ] **Step 1: Add CacheOverrides and update types**

In `src/lib/types.ts`, add the `CacheOverrides` interface after `MountState`, and add the `log` field to `MountStatus`, `cache_overrides` to `Connection`, and `network_change_mode` to `AppSettings`:

```typescript
// TypeScript types matching Rust backend models

export interface Connection {
  id: string;
  name: string;
  description: string;
  remote_type: string;
  local_ip: string;
  tailscale_ip: string;
  port: number;
  drive_letter: string;
  protocol: "webdav";
  username: string;
  network_mode: NetworkMode;
  speed_profile: SpeedProfile;
  auto_mount: boolean;
  sort_order: number;
  created_at: string;
  cache_overrides?: CacheOverrides;
}

export type NetworkMode = "auto" | "local" | "tailscale";
export type SpeedProfile = "max" | "balanced" | "low";
export type NetworkChangeMode = "notify" | "auto_reconnect";

export interface MountStatus {
  connection_id: string;
  state: MountState;
  active_mode: "local" | "tailscale" | null;
  active_url: string | null;
  pid: number | null;
  error: string | null;
  log: string | null;
}

export type MountState = "mounted" | "mounting" | "unmounted" | "error";

export interface CacheOverrides {
  dir_cache_time?: string;
  poll_interval?: string;
  vfs_cache_mode?: string;
  vfs_cache_max_size?: string;
  vfs_read_ahead?: string;
  buffer_size?: string;
  transfers?: number;
  multi_thread_streams?: number;
}

export interface AppSettings {
  start_with_windows: boolean;
  start_minimized: boolean;
  close_to_tray: boolean;
  theme: "dark";
  default_speed_profile: SpeedProfile;
  default_network_mode: NetworkMode;
  show_notifications: boolean;
  rclone_config_path: string;
  network_change_mode: NetworkChangeMode;
}

export interface SpeedProfileInfo {
  id: SpeedProfile;
  label: string;
  description: string;
  icon: string;
  cache: string;
  buffer: string;
  transfers: number;
}

export const SPEED_PROFILES: Record<SpeedProfile, SpeedProfileInfo> = {
  max: {
    id: "max",
    label: "Max Speed",
    description: "10Gbps LAN, Fiber remote",
    icon: "⚡",
    cache: "50 GB",
    buffer: "512 MB",
    transfers: 16,
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    description: "General daily use",
    icon: "⚖️",
    cache: "10 GB",
    buffer: "256 MB",
    transfers: 8,
  },
  low: {
    id: "low",
    label: "Low Resource",
    description: "Battery, slow WiFi",
    icon: "🔋",
    cache: "2 GB",
    buffer: "64 MB",
    transfers: 4,
  },
};
```

- [ ] **Step 2: Update store defaults**

In `src/lib/store.ts`, add `network_change_mode` to `DEFAULT_SETTINGS`:

```typescript
const DEFAULT_SETTINGS: AppSettings = {
  start_with_windows: false,
  start_minimized: true,
  close_to_tray: true,
  theme: "dark",
  default_speed_profile: "balanced",
  default_network_mode: "auto",
  show_notifications: true,
  rclone_config_path: "",
  network_change_mode: "notify",
};
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts src/lib/store.ts
git commit -m "feat: add CacheOverrides, NetworkChangeMode types and MountStatus.log field"
```

---

## Task 5: Dashboard — Active URL Display + Warning Badge + Enhanced Logging

**Files:**
- Modify: `src/pages/Dashboard.tsx:194-222,427-460`

- [ ] **Step 1: Update handleMount to use structured log**

In `Dashboard.tsx`, replace the `handleMount` function (lines 194-222):

```typescript
  const handleMount = async (conn: Connection) => {
    setLoading({ ...loading, [conn.id]: true });
    addLog("info", `Mounting ${conn.name} to drive ${conn.drive_letter}:...`, "mounts");

    try {
      const status = await invoke<MountStatus>("mount_drive", {
        connectionJson: JSON.stringify(conn),
      });
      setMountStatuses({ ...mountStatuses, [conn.id]: status });

      // Log the detailed mount info from backend
      if (status.log) {
        addLog("info", status.log, "network");
      }

      const mode = status.active_mode === "local" ? "LAN" : "Tailscale";
      const url = status.active_url?.replace("http://", "") || "";

      if (status.error) {
        // Mounted but with warning (e.g., drive not visible)
        addLog("warning", status.error, "mounts");
        toast.warning(`${conn.name} mounted via ${mode} (${url}) with warning: ${status.error}`);
      } else {
        addLog("success", `${conn.name} mounted to ${conn.drive_letter}: via ${mode} (${url})`, "mounts");
        toast.success(`Mounted ${conn.name} to drive ${conn.drive_letter}: via ${mode}`);
      }

      try {
        await invoke("send_notification", {
          title: "Drive Mounted",
          body: `${conn.name} connected via ${mode}`,
        });
      } catch (err) {
        console.error("Failed to send notification:", err);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : (typeof err === "string" ? err : `Failed to mount ${conn.name}`);
      addLog("error", `Mount failed: ${errorMsg}`, "mounts");
      toast.error(errorMsg);
    } finally {
      setLoading({ ...loading, [conn.id]: false });
    }
  };
```

- [ ] **Step 2: Update connection card to show active URL and warning badge**

In the connection card JSX (around line 435-460), replace the badges and subtitle section. Find the existing badge block:

```tsx
                        {isMounted ? (
                          <Badge variant="connected" dot>
                            Mounted
                          </Badge>
                        ) : (
                          <Badge variant="disconnected">Unmounted</Badge>
                        )}
```

Replace with:

```tsx
                        {isMounted ? (
                          status?.error ? (
                            <Badge variant="default" dot>
                              Mounted (Warning)
                            </Badge>
                          ) : (
                            <Badge variant="connected" dot>
                              Mounted
                            </Badge>
                          )
                        ) : (
                          <Badge variant="disconnected">Unmounted</Badge>
                        )}
```

- [ ] **Step 3: Update the subtitle to show active URL when mounted**

Find the line (around line 458):

```tsx
                      <div className="text-[13px] text-text-secondary">
                        {conn.remote_type?.toUpperCase() || "WEBDAV"} &bull; Drive {conn.drive_letter}: &bull; {conn.local_ip}:{conn.port} &bull;{" "}
                        {conn.speed_profile} profile
                      </div>
```

Replace with:

```tsx
                      <div className="text-[13px] text-text-secondary">
                        {conn.remote_type?.toUpperCase() || "WEBDAV"} &bull; Drive {conn.drive_letter}: &bull;{" "}
                        {isMounted && status?.active_url
                          ? status.active_url.replace("http://", "")
                          : `${conn.local_ip}:${conn.port}`} &bull;{" "}
                        {conn.speed_profile} profile
                      </div>
```

- [ ] **Step 4: Show warning message below card if mounted with error**

After the subtitle `<div>`, add:

```tsx
                      {isMounted && status?.error && (
                        <div className="text-[11px] text-accent-amber mt-1">
                          {status.error}
                        </div>
                      )}
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: show active URL, warning badge for invisible mounts, structured mount logs"
```

---

## Task 6: Test Connection Command — Backend

**Files:**
- Modify: `src-tauri/src/commands/network.rs`
- Modify: `src-tauri/src/lib.rs:26-78`

- [ ] **Step 1: Add ConnectionTestResult struct and test_connection command**

In `src-tauri/src/commands/network.rs`, add at the bottom of the file:

```rust
#[derive(Debug, serde::Serialize)]
pub struct ConnectionTestResult {
    pub local_reachable: Option<bool>,
    pub local_ip: String,
    pub tailscale_reachable: Option<bool>,
    pub tailscale_ip: String,
    pub active_url_reachable: Option<bool>,
    pub active_url: String,
    pub local_error: Option<String>,
    pub tailscale_error: Option<String>,
}

#[command]
pub async fn test_connection(
    connection_json: String,
    active_url: Option<String>,
) -> Result<ConnectionTestResult, String> {
    let connection: crate::config::Connection = serde_json::from_str(&connection_json)
        .map_err(|e| format!("Invalid connection data: {}", e))?;

    let port = connection.port;
    let local_ip = connection.local_ip.clone();
    let tailscale_ip = connection.tailscale_ip.clone();

    // Test local IP
    let (local_reachable, local_error) = if !local_ip.is_empty() {
        match ping_port(local_ip.clone(), port, 3000).await {
            Ok(true) => (Some(true), None),
            Ok(false) => (Some(false), Some(format!("{}:{} did not respond within 3s", local_ip, port))),
            Err(e) => (Some(false), Some(e)),
        }
    } else {
        (None, None)
    };

    // Test tailscale IP
    let (tailscale_reachable, tailscale_error) = if !tailscale_ip.is_empty() {
        match ping_port(tailscale_ip.clone(), port, 3000).await {
            Ok(true) => (Some(true), None),
            Ok(false) => (Some(false), Some(format!("{}:{} did not respond within 3s", tailscale_ip, port))),
            Err(e) => (Some(false), Some(e)),
        }
    } else {
        (None, None)
    };

    // Test active URL if mount is active
    let (active_url_reachable, active_url_str) = if let Some(ref url) = active_url {
        // Parse host:port from URL like "http://192.168.1.x:80"
        let stripped = url.replace("http://", "").replace("https://", "");
        let parts: Vec<&str> = stripped.split(':').collect();
        if parts.len() == 2 {
            let ip = parts[0].to_string();
            let p: u16 = parts[1].parse().unwrap_or(80);
            let reachable = ping_port(ip, p, 3000).await.unwrap_or(false);
            (Some(reachable), url.clone())
        } else {
            (None, url.clone())
        }
    } else {
        (None, String::new())
    };

    Ok(ConnectionTestResult {
        local_reachable,
        local_ip,
        tailscale_reachable,
        tailscale_ip,
        active_url_reachable,
        active_url: active_url_str,
        local_error,
        tailscale_error,
    })
}
```

- [ ] **Step 2: Register the new command in lib.rs**

In `src-tauri/src/lib.rs`, add `commands::test_connection,` after the existing network commands line (`commands::detect_network_mode,`):

```rust
            // Network commands
            commands::ping_host,
            commands::ping_port,
            commands::detect_network_mode,
            commands::test_connection,
```

- [ ] **Step 3: Add serde_json import to network.rs if needed**

At the top of `network.rs`, the `serde_json` crate is already in Cargo.toml dependencies. No import needed since we use the full path `serde_json::from_str`.

Actually, add at the top of `network.rs`:

```rust
use serde_json;
```

(Or it may already be available via the crate root. If `cargo check` fails on this, add `use serde_json;` at the top.)

- [ ] **Step 4: Build and verify**

Run: `cd src-tauri && cargo check`
Expected: Compiles with no errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/network.rs src-tauri/src/lib.rs
git commit -m "feat: add test_connection command that tests both local and tailscale IPs"
```

---

## Task 7: Dashboard — Test Button

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Add test handler function**

In `Dashboard.tsx`, add this function after `handleUnmountExternal`:

```typescript
  const handleTestConnection = async (conn: Connection) => {
    const key = `test-${conn.id}`;
    setLoading({ ...loading, [key]: true });
    addLog("info", `Testing connection for ${conn.name}...`, "network");

    try {
      const status = mountStatuses[conn.id];
      const activeUrl = status?.state === "mounted" ? status.active_url : null;

      const result = await invoke<{
        local_reachable: boolean | null;
        local_ip: string;
        tailscale_reachable: boolean | null;
        tailscale_ip: string;
        active_url_reachable: boolean | null;
        active_url: string;
        local_error: string | null;
        tailscale_error: string | null;
      }>("test_connection", {
        connectionJson: JSON.stringify(conn),
        activeUrl,
      });

      // Log local result
      if (result.local_reachable !== null) {
        if (result.local_reachable) {
          addLog("success", `Local (${result.local_ip}:${conn.port}): reachable`, "network");
        } else {
          addLog("error", `Local (${result.local_ip}:${conn.port}): unreachable${result.local_error ? ` — ${result.local_error}` : ""}`, "network");
        }
      }

      // Log tailscale result
      if (result.tailscale_reachable !== null) {
        if (result.tailscale_reachable) {
          addLog("success", `Tailscale (${result.tailscale_ip}:${conn.port}): reachable`, "network");
        } else {
          addLog("error", `Tailscale (${result.tailscale_ip}:${conn.port}): unreachable${result.tailscale_error ? ` — ${result.tailscale_error}` : ""}`, "network");
        }
      }

      // Log active URL result if mounted
      if (result.active_url_reachable !== null) {
        if (result.active_url_reachable) {
          addLog("success", `Active mount (${result.active_url}): reachable`, "network");
        } else {
          addLog("error", `Active mount (${result.active_url}): unreachable`, "network");
        }
      }

      // Toast summary
      const localStatus = result.local_reachable === null ? "" : result.local_reachable ? "Local: OK" : "Local: Failed";
      const tsStatus = result.tailscale_reachable === null ? "" : result.tailscale_reachable ? "Tailscale: OK" : "Tailscale: Failed";
      const parts = [localStatus, tsStatus].filter(Boolean).join(", ");
      const anySuccess = result.local_reachable || result.tailscale_reachable;

      if (anySuccess) {
        toast.success(parts);
      } else {
        toast.error(parts || "No IPs configured to test");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog("error", `Test failed: ${msg}`, "network");
      toast.error(msg);
    } finally {
      setLoading({ ...loading, [key]: false });
    }
  };
```

- [ ] **Step 2: Add Test button to connection card**

In the connection card button group, add a test button. Find the edit button:

```tsx
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onNavigate?.("edit", conn.id)}
                        title="Edit connection"
                      >
                        <PencilSimple size={14} weight="bold" />
                      </Button>
```

Add the test button BEFORE it:

```tsx
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTestConnection(conn)}
                        disabled={loading[`test-${conn.id}`]}
                        title="Test connection"
                      >
                        {loading[`test-${conn.id}`] ? (
                          <div className="w-3.5 h-3.5 border-2 border-text-primary/30 border-t-text-primary rounded-full animate-spin" />
                        ) : (
                          <WifiHigh size={14} weight="bold" />
                        )}
                      </Button>
```

Note: `WifiHigh` is already imported at the top of Dashboard.tsx.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: add Test Connection button to dashboard cards, tests both IPs"
```

---

## Task 8: Test Both IPs in AddConnection + EditConnection

**Files:**
- Modify: `src/pages/AddConnection.tsx:214-257`
- Modify: `src/pages/EditConnection.tsx:109-137`

- [ ] **Step 1: Update AddConnection handleTestConnection**

Replace the `handleTestConnection` function in `AddConnection.tsx` (lines 214-257):

```typescript
  const handleTestConnection = async () => {
    if (!validateForm()) return;

    setTesting(true);
    setTestResult(null);

    try {
      if (remoteType === "s3") {
        toast.success("S3 config looks valid (start mount to verify credentials)");
        setTestResult("success");
        setTesting(false);
        return;
      }

      const testHost = getTestHost();
      const testPort = getTestPort();
      let anySuccess = false;

      // Test local IP
      addLog("info", `Testing local ${testHost}:${testPort}...`, "network");
      const localReachable = await invoke<boolean>("ping_port", {
        ip: testHost,
        port: testPort,
        timeoutMs: 3000,
      });
      if (localReachable) {
        addLog("success", `Local (${testHost}:${testPort}): reachable`, "network");
        anySuccess = true;
      } else {
        addLog("error", `Local (${testHost}:${testPort}): unreachable`, "network");
      }

      // Test tailscale IP if provided
      let tailscaleReachable = false;
      if (tailscaleIp.trim()) {
        addLog("info", `Testing Tailscale ${tailscaleIp}:${testPort}...`, "network");
        tailscaleReachable = await invoke<boolean>("ping_port", {
          ip: tailscaleIp,
          port: testPort,
          timeoutMs: 3000,
        });
        if (tailscaleReachable) {
          addLog("success", `Tailscale (${tailscaleIp}:${testPort}): reachable`, "network");
          anySuccess = true;
        } else {
          addLog("error", `Tailscale (${tailscaleIp}:${testPort}): unreachable`, "network");
        }
      }

      // Summary
      const localLabel = localReachable ? "Local: OK" : "Local: Failed";
      const tsLabel = tailscaleIp.trim() ? (tailscaleReachable ? "Tailscale: OK" : "Tailscale: Failed") : "";
      const summary = [localLabel, tsLabel].filter(Boolean).join(", ");

      if (anySuccess) {
        setTestResult("success");
        toast.success(summary);
      } else {
        setTestResult("error");
        toast.error(summary);
      }
    } catch (err) {
      setTestResult("error");
      const msg = err instanceof Error ? err.message : String(err);
      addLog("error", `Test failed: ${msg}`, "network");
      toast.error(`Test failed: ${msg}`);
    } finally {
      setTesting(false);
    }
  };
```

- [ ] **Step 2: Update EditConnection handleTest**

Replace the `handleTest` function in `EditConnection.tsx` (lines 109-137):

```typescript
  const handleTest = async () => {
    if (!validateForm()) return;
    setTesting(true);
    setTestResult(null);

    try {
      let anySuccess = false;
      const testPort = parseInt(port) || 0;

      // Test local IP
      addLog("info", `Testing local ${host}:${testPort}...`, "network");
      const localReachable = await invoke<boolean>("ping_port", {
        ip: host,
        port: testPort,
        timeoutMs: 3000,
      });
      if (localReachable) {
        addLog("success", `Local (${host}:${testPort}): reachable`, "network");
        anySuccess = true;
      } else {
        addLog("error", `Local (${host}:${testPort}): unreachable`, "network");
      }

      // Test tailscale IP if provided
      let tailscaleReachable = false;
      if (tailscaleIp.trim()) {
        addLog("info", `Testing Tailscale ${tailscaleIp}:${testPort}...`, "network");
        tailscaleReachable = await invoke<boolean>("ping_port", {
          ip: tailscaleIp,
          port: testPort,
          timeoutMs: 3000,
        });
        if (tailscaleReachable) {
          addLog("success", `Tailscale (${tailscaleIp}:${testPort}): reachable`, "network");
          anySuccess = true;
        } else {
          addLog("error", `Tailscale (${tailscaleIp}:${testPort}): unreachable`, "network");
        }
      }

      // Summary
      const localLabel = localReachable ? "Local: OK" : "Local: Failed";
      const tsLabel = tailscaleIp.trim() ? (tailscaleReachable ? "Tailscale: OK" : "Tailscale: Failed") : "";
      const summary = [localLabel, tsLabel].filter(Boolean).join(", ");

      if (anySuccess) {
        setTestResult("success");
        toast.success(summary);
      } else {
        setTestResult("error");
        toast.error(summary);
      }
    } catch (err) {
      setTestResult("error");
      const msg = err instanceof Error ? err.message : (typeof err === "string" ? err : "Test failed");
      addLog("error", msg, "network");
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/AddConnection.tsx src/pages/EditConnection.tsx
git commit -m "feat: test both local and tailscale IPs in Add/Edit connection forms"
```

---

## Task 9: Advanced Cache Settings UI — AddConnection + EditConnection

**Files:**
- Modify: `src/pages/AddConnection.tsx`
- Modify: `src/pages/EditConnection.tsx`

- [ ] **Step 1: Add cache override state to AddConnection**

In `AddConnection.tsx`, after the existing state declarations (around line 96), add:

```typescript
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cacheOverrides, setCacheOverrides] = useState<Partial<CacheOverrides>>({});
```

And add the import at the top:

```typescript
import type { Connection, CacheOverrides } from "../lib/types";
```

Also import `CaretDown` from phosphor-react:

```typescript
import {
  HardDrive,
  Globe,
  Lock,
  User,
  Lightning,
  Check,
  ArrowLeft,
  CircleNotch,
  Cloud,
  Desktop,
  Database,
  CaretLeft,
  CaretRight,
  CaretDown,
} from "phosphor-react";
```

- [ ] **Step 2: Add Advanced Cache Settings card to AddConnection**

After the Speed Profile card (after the `</Card>` that closes the speed profile section, around line 699) and before the Auto-mount card, add:

```tsx
          {/* Advanced Cache Settings */}
          <Card className="p-6">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between"
            >
              <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <Gear size={18} weight="duotone" className="text-text-tertiary" />
                Advanced Cache Settings
              </h2>
              <div className="flex items-center gap-2">
                {!showAdvanced && (
                  <span className="text-[11px] text-text-tertiary">
                    Using {speedProfile} profile defaults
                  </span>
                )}
                <CaretDown
                  size={14}
                  weight="bold"
                  className={`text-text-tertiary transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                />
              </div>
            </button>
            {showAdvanced && (
              <div className="mt-4 space-y-4">
                <p className="text-[11px] text-text-tertiary">
                  Leave blank to use the speed profile defaults. Dir Cache Time: how long directory listings are cached (0 = always fresh). Poll Interval: how often rclone checks for remote changes.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Dir Cache Time"
                    placeholder={speedProfile === "low" ? "30s" : "0"}
                    value={cacheOverrides.dir_cache_time || ""}
                    onChange={(e) => setCacheOverrides({ ...cacheOverrides, dir_cache_time: e.target.value || undefined })}
                    hint="0 = always fresh on navigate"
                  />
                  <Input
                    label="Poll Interval"
                    placeholder={speedProfile === "low" ? "10m" : "5m"}
                    value={cacheOverrides.poll_interval || ""}
                    onChange={(e) => setCacheOverrides({ ...cacheOverrides, poll_interval: e.target.value || undefined })}
                    hint="Background check interval"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-medium text-text-secondary mb-2">
                      VFS Cache Mode
                    </label>
                    <select
                      value={cacheOverrides.vfs_cache_mode || ""}
                      onChange={(e) => setCacheOverrides({ ...cacheOverrides, vfs_cache_mode: e.target.value || undefined })}
                      className="w-full bg-bg-overlay border border-border-default rounded-lg px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-accent-blue/60"
                    >
                      <option value="">Default (full)</option>
                      <option value="full">Full</option>
                      <option value="writes">Writes</option>
                      <option value="minimal">Minimal</option>
                      <option value="off">Off</option>
                    </select>
                  </div>
                  <Input
                    label="VFS Cache Size"
                    placeholder={speedProfile === "max" ? "50G" : speedProfile === "balanced" ? "10G" : "2G"}
                    value={cacheOverrides.vfs_cache_max_size || ""}
                    onChange={(e) => setCacheOverrides({ ...cacheOverrides, vfs_cache_max_size: e.target.value || undefined })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Read Ahead"
                    placeholder={speedProfile === "max" ? "512M" : speedProfile === "balanced" ? "128M" : "32M"}
                    value={cacheOverrides.vfs_read_ahead || ""}
                    onChange={(e) => setCacheOverrides({ ...cacheOverrides, vfs_read_ahead: e.target.value || undefined })}
                  />
                  <Input
                    label="Buffer Size"
                    placeholder={speedProfile === "max" ? "512M" : speedProfile === "balanced" ? "256M" : "64M"}
                    value={cacheOverrides.buffer_size || ""}
                    onChange={(e) => setCacheOverrides({ ...cacheOverrides, buffer_size: e.target.value || undefined })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Transfers"
                    type="number"
                    placeholder={speedProfile === "max" ? "16" : speedProfile === "balanced" ? "8" : "4"}
                    value={cacheOverrides.transfers?.toString() || ""}
                    onChange={(e) => setCacheOverrides({ ...cacheOverrides, transfers: e.target.value ? parseInt(e.target.value) : undefined })}
                  />
                  <Input
                    label="Multi-thread Streams"
                    type="number"
                    placeholder={speedProfile === "max" ? "16" : speedProfile === "balanced" ? "8" : "4"}
                    value={cacheOverrides.multi_thread_streams?.toString() || ""}
                    onChange={(e) => setCacheOverrides({ ...cacheOverrides, multi_thread_streams: e.target.value ? parseInt(e.target.value) : undefined })}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCacheOverrides({})}
                  className="text-text-tertiary"
                >
                  Reset to Profile Defaults
                </Button>
              </div>
            )}
          </Card>
```

Also add `Gear` to the phosphor-react imports at the top.

- [ ] **Step 3: Include cache_overrides in the Connection object on create**

In `handleCreate`, when building the `connection` object, add `cache_overrides`:

```typescript
      const hasOverrides = Object.values(cacheOverrides).some(v => v !== undefined);
      const connection: Connection = {
        id: crypto.randomUUID(),
        name,
        description,
        remote_type: remoteType,
        local_ip: remoteType === "s3" ? "" : host,
        tailscale_ip: tailscaleIp,
        port: parseInt(port) || 0,
        drive_letter: driveLetter,
        protocol: "webdav",
        username,
        network_mode: networkMode,
        speed_profile: speedProfile,
        auto_mount: autoMount,
        sort_order: Date.now(),
        created_at: new Date().toISOString(),
        cache_overrides: hasOverrides ? cacheOverrides as CacheOverrides : undefined,
      };
```

- [ ] **Step 4: Add same Advanced Cache Settings to EditConnection**

In `EditConnection.tsx`, add the same state, imports, and UI card. The state initialization should read from the existing connection:

```typescript
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cacheOverrides, setCacheOverrides] = useState<Partial<CacheOverrides>>(
    connection.cache_overrides || {}
  );
```

Import `CacheOverrides` from types, `Gear` and `CaretDown` from phosphor-react.

Add the same Advanced Cache Settings card after the Speed Profile card.

In `handleSave`, include `cache_overrides` in the updates:

```typescript
      const hasOverrides = Object.values(cacheOverrides).some(v => v !== undefined);
      const updates: Partial<Connection> = {
        name,
        description,
        drive_letter: driveLetter,
        local_ip: host,
        tailscale_ip: tailscaleIp,
        port: parseInt(port) || connection.port,
        username,
        network_mode: networkMode,
        speed_profile: speedProfile,
        auto_mount: autoMount,
        cache_overrides: hasOverrides ? cacheOverrides as CacheOverrides : undefined,
      };
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/AddConnection.tsx src/pages/EditConnection.tsx
git commit -m "feat: add collapsible Advanced Cache Settings UI with per-connection overrides"
```

---

## Task 10: Network Change Detection — Backend

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/commands/network.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add windows crate dependency**

In `src-tauri/Cargo.toml`, add to `[dependencies]`:

```toml
[target.'cfg(windows)'.dependencies]
windows = { version = "0.58", features = ["Win32_NetworkManagement_IpHelper", "Win32_Foundation", "Win32_System_IO"] }
```

- [ ] **Step 2: Add start_network_monitor function**

In `src-tauri/src/commands/network.rs`, add at the bottom:

```rust
#[cfg(target_os = "windows")]
pub fn start_network_monitor(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        use windows::Win32::NetworkManagement::IpHelper::NotifyAddrChange;
        use windows::Win32::System::IO::OVERLAPPED;

        loop {
            // NotifyAddrChange with null handle + null overlapped = synchronous blocking call
            // Blocks until a network address change occurs — zero CPU while waiting
            unsafe {
                let mut handle = windows::Win32::Foundation::HANDLE::default();
                let result = NotifyAddrChange(
                    Some(&mut handle),
                    None,
                );
                if result.is_err() {
                    // If the API fails, fall back to polling every 30s
                    std::thread::sleep(std::time::Duration::from_secs(30));
                    app.emit("network-changed", ()).ok();
                    continue;
                }
            }

            // Debounce — network changes often fire multiple rapid events
            std::thread::sleep(std::time::Duration::from_secs(2));

            // Emit event to frontend
            app.emit("network-changed", ()).ok();
        }
    });
}

#[cfg(not(target_os = "windows"))]
pub fn start_network_monitor(_app: tauri::AppHandle) {
    // Network change detection not supported on non-Windows platforms
}
```

- [ ] **Step 3: Start network monitor in lib.rs setup**

In `src-tauri/src/lib.rs`, inside the `.setup(|app| { ... })` closure, after the tray icon setup and before `Ok(())`, add:

```rust
            // Start background network change monitor
            commands::network::start_network_monitor(app.handle().clone());
```

- [ ] **Step 4: Build and verify**

Run: `cd src-tauri && cargo check`
Expected: Compiles with no errors. The `windows` crate download may take a moment on first build.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/commands/network.rs src-tauri/src/lib.rs
git commit -m "feat: add network change monitor using Windows NotifyAddrChange API"
```

---

## Task 11: Network Change Detection — Frontend

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Add network change listener in App.tsx**

In `src/App.tsx`, add a new useEffect after the close-to-tray effect (after line 53). Import `listen` from Tauri events:

```typescript
import { listen } from "@tauri-apps/api/event";
```

Add the effect:

```typescript
  // Listen for network change events from Rust backend
  useEffect(() => {
    const unlisten = listen("network-changed", () => {
      // Dispatch a custom DOM event that Dashboard can listen for
      window.dispatchEvent(new CustomEvent("network-changed"));
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);
```

- [ ] **Step 2: Handle network changes in Dashboard**

In `Dashboard.tsx`, add a useEffect after the existing ones (after line 86):

```typescript
  // Handle network change events
  useEffect(() => {
    const handler = async () => {
      addLog("info", "Network change detected, checking connections...", "network");

      for (const conn of connections) {
        const status = mountStatuses[conn.id];
        if (status?.state !== "mounted" || conn.network_mode !== "auto") continue;

        const activeMode = status.active_mode;
        const localIp = conn.local_ip;
        const tailscaleIp = conn.tailscale_ip;
        const port = conn.port;

        // Check which IPs are now reachable
        let localReachable = false;
        let tailscaleReachable = false;

        try {
          if (localIp) {
            localReachable = await invoke<boolean>("ping_port", { ip: localIp, port, timeoutMs: 2000 });
          }
          if (tailscaleIp) {
            tailscaleReachable = await invoke<boolean>("ping_port", { ip: tailscaleIp, port, timeoutMs: 2000 });
          }
        } catch {
          continue;
        }

        // Determine if a switch is needed
        const shouldBeLocal = localReachable;
        const shouldBeTailscale = !localReachable && tailscaleReachable;
        const needsSwitch =
          (activeMode === "local" && !localReachable && tailscaleReachable) ||
          (activeMode === "tailscale" && localReachable);

        if (!needsSwitch) continue;

        const newMode = shouldBeLocal ? "LAN" : "Tailscale";

        if (settings.network_change_mode === "auto_reconnect") {
          addLog("info", `Network changed: remounting ${conn.name} to ${newMode}...`, "network");
          try {
            await invoke("unmount_drive", { connectionId: conn.id });
            const newStatus = await invoke<MountStatus>("mount_drive", {
              connectionJson: JSON.stringify(conn),
            });
            setMountStatuses(prev => ({ ...prev, [conn.id]: newStatus }));
            addLog("success", `${conn.name} reconnected via ${newMode}`, "network");
            toast.info(`${conn.name} switched to ${newMode}`);
            await invoke("send_notification", {
              title: "Network Changed",
              body: `${conn.name} reconnected via ${newMode}`,
            }).catch(() => {});
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            addLog("error", `Failed to reconnect ${conn.name}: ${msg}`, "network");
          }
        } else {
          // Notify mode
          addLog("warning", `Network changed: ${conn.name} is on ${activeMode === "local" ? "LAN" : "Tailscale"} but ${newMode} is now available. Consider reconnecting.`, "network");
          toast.warning(`${conn.name}: switch to ${newMode} available`, { duration: 10000 });
          await invoke("send_notification", {
            title: "Network Changed",
            body: `${conn.name} may need to switch to ${newMode}`,
          }).catch(() => {});
        }
      }
    };

    window.addEventListener("network-changed", handler);
    return () => window.removeEventListener("network-changed", handler);
  }, [connections, mountStatuses, settings.network_change_mode]); // eslint-disable-line react-hooks/exhaustive-deps
```

Also import `MountStatus` from types (it should already be imported) and `settings` from the store. Add at the top of the component:

```typescript
  const { settings } = useSettingsStore();
```

And add the import:

```typescript
import { useConnectionStore, useMountSummaryStore, useSettingsStore } from "../lib/store";
```

- [ ] **Step 3: Add Network Change Behavior to Settings**

In `Settings.tsx`, after the Notifications card and before the Rclone Config File card, add:

```tsx
          {/* Section D2 - Network Change Behavior */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Globe size={18} weight="duotone" className="text-accent-green" />
              Network Change Behavior
            </h2>
            <p className="text-[11px] text-text-tertiary mb-4">
              When your network changes (e.g., moving between home WiFi and mobile), the app detects it using Windows network events (zero polling, no battery impact).
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  value: "notify" as const,
                  label: "Notify Only",
                  desc: "Shows a notification when a mounted drive should switch between LAN and Tailscale. You control when to reconnect.",
                },
                {
                  value: "auto_reconnect" as const,
                  label: "Auto-Reconnect",
                  desc: "Automatically remounts drives on the correct IP. Brief ~2-3s interruption during switch.",
                },
              ].map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => update({ network_change_mode: mode.value })}
                  className={`p-3 rounded-lg border transition-all duration-150 text-left ${
                    settings.network_change_mode === mode.value
                      ? "bg-accent-green/10 border-accent-green/40 shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                      : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[13px] font-medium ${
                        settings.network_change_mode === mode.value
                          ? "text-accent-green"
                          : "text-text-primary"
                      }`}
                    >
                      {mode.label}
                    </span>
                    {settings.network_change_mode === mode.value && (
                      <Check size={14} weight="bold" className="text-accent-green" />
                    )}
                  </div>
                  <span className="text-[11px] text-text-tertiary">{mode.desc}</span>
                </button>
              ))}
            </div>
          </Card>
```

Import `Globe` if not already imported (it is already imported in Settings.tsx).

- [ ] **Step 4: Add Rust AppSettings field for network_change_mode**

In `src-tauri/src/config.rs`, add the `NetworkChangeMode` enum and update `AppSettings`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NetworkChangeMode {
    Notify,
    AutoReconnect,
}

impl Default for NetworkChangeMode {
    fn default() -> Self {
        NetworkChangeMode::Notify
    }
}
```

And add to `AppSettings`:

```rust
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub start_with_windows: bool,
    pub start_minimized: bool,
    pub close_to_tray: bool,
    pub theme: String,
    pub default_speed_profile: SpeedProfile,
    pub default_network_mode: NetworkMode,
    pub show_notifications: bool,
    #[serde(default)]
    pub network_change_mode: NetworkChangeMode,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            start_with_windows: false,
            start_minimized: false,
            close_to_tray: true,
            theme: "dark".to_string(),
            default_speed_profile: SpeedProfile::Balanced,
            default_network_mode: NetworkMode::Auto,
            show_notifications: true,
            network_change_mode: NetworkChangeMode::default(),
        }
    }
}
```

- [ ] **Step 5: Build and verify everything compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/pages/Dashboard.tsx src/pages/Settings.tsx src-tauri/src/config.rs
git commit -m "feat: network change detection with notify/auto-reconnect modes"
```

---

## Task 12: Final Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run cargo check**

Run: `cd src-tauri && cargo check`
Expected: No errors.

- [ ] **Step 2: Run pnpm build (frontend typecheck)**

Run: `pnpm build`
Expected: No TypeScript errors. (The Tauri build step may fail if rclone/WinFsp aren't installed on the build machine, but the frontend compilation should succeed.)

- [ ] **Step 3: Fix any type errors**

If there are TypeScript errors from the `log` field being missing in places that create `MountStatus` objects on the frontend, add `log: null` to those places.

- [ ] **Step 4: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build errors from reliability changes"
```

---

## Summary

| Task | What it does | Files |
|------|-------------|-------|
| 1 | Stale cache fix — backend | config.rs, rclone.rs |
| 2 | Validate tailscale fallback + structured logging | config.rs, rclone.rs |
| 3 | Verify mount drive visible in Explorer | rclone.rs |
| 4 | Frontend type updates | types.ts, store.ts |
| 5 | Dashboard: active URL, warning badge, enhanced logs | Dashboard.tsx |
| 6 | Test connection command — backend | network.rs, lib.rs |
| 7 | Dashboard: Test button | Dashboard.tsx |
| 8 | Test both IPs in Add/Edit forms | AddConnection.tsx, EditConnection.tsx |
| 9 | Advanced Cache Settings UI | AddConnection.tsx, EditConnection.tsx |
| 10 | Network change detection — backend | Cargo.toml, network.rs, lib.rs |
| 11 | Network change detection — frontend + settings | App.tsx, Dashboard.tsx, Settings.tsx, config.rs |
| 12 | Final build verification | All |

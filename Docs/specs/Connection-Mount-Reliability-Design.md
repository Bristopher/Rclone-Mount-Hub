# Connection & Mount Reliability Fixes

**Created:** 2026_03-25
**Last Updated:** 2026_03-25
**Scope:** 7 fixes across Rust backend and React frontend

---

## 1. Test Connection Tests the Active Mount URL

**Problem:** Dashboard "Test Connection" doesn't exist on the Dashboard today. The only test lives in AddConnection/EditConnection, and it always tests the saved `local_ip` form field, not the URL the mount is actually using.

**Fix:**

### Backend (`network.rs`)
Add a new command `test_connection` that:
1. Accepts a `connection_id` and checks if it's mounted
2. If mounted: pings the `active_url` (from `MountInfo`) to verify the active connection works
3. Always tests BOTH the local IP and tailscale IP (if configured), returning status of each
4. Returns a `ConnectionTestResult` struct:

```rust
#[derive(Serialize)]
pub struct ConnectionTestResult {
    pub local_reachable: Option<bool>,     // None if no local_ip configured
    pub local_ip: String,
    pub tailscale_reachable: Option<bool>, // None if no tailscale_ip configured
    pub tailscale_ip: String,
    pub active_url_reachable: Option<bool>, // None if not mounted
    pub active_url: String,
    pub local_error: Option<String>,
    pub tailscale_error: Option<String>,
}
```

### Frontend (`Dashboard.tsx`)
- Add a "Test" button on each connection card (next to Mount/Unmount)
- On click, calls `test_connection` with connection JSON
- Logs both IP results: "Local (192.168.1.x:80): reachable" / "Tailscale (100.x.x.x:80): unreachable - connection timed out"
- Toast shows summary: "Local: OK, Tailscale: Failed" or similar

### Frontend (`AddConnection.tsx` / `EditConnection.tsx`)
- Update `handleTestConnection` to also test tailscale IP if provided
- Show results for both in the log and toast

---

## 2. Validate Tailscale Fallback Before Using It

**Problem:** In `mount_drive()`, when auto mode detects local IP is unreachable, it blindly falls back to tailscale IP without verifying it works.

**Fix (`rclone.rs` - `mount_drive`):**

```
NetworkMode::Auto => {
    1. Ping local_ip:port (1000ms timeout)
    2. Ping tailscale_ip:port (1000ms timeout)  // NEW - always test both
    3. If local reachable -> use local
    4. Else if tailscale reachable -> use tailscale
    5. Else -> return error with both failure reasons
}
```

The error message for step 5:
```
"Neither local ({local_ip}:{port}) nor Tailscale ({tailscale_ip}:{port}) is reachable.
Check that your server is running and accessible."
```

For `NetworkMode::Local` and `NetworkMode::Tailscale`, also verify the chosen IP is reachable before attempting to mount, and return a clear error if not.

---

## 3. Verify Mount Actually Works + Drive Letter Available

**Problem:** After spawning rclone, the app waits 800ms and checks if the process is alive. This doesn't verify the drive letter actually appears in Windows Explorer.

**Fix (`rclone.rs` - `mount_drive`):**

### Pre-mount: Drive letter check (already partially exists)
The existing `Path::exists()` check is good. Keep it.

### Post-mount: Verify drive is visible
After the 800ms wait + process alive check, add:

```rust
// Verify the drive letter actually appeared in the filesystem
let drive_path = format!("{}:\\", connection.drive_letter.to_uppercase());
let mut visible = false;
for attempt in 0..5 {
    if std::path::Path::new(&drive_path).exists() {
        visible = true;
        break;
    }
    std::thread::sleep(std::time::Duration::from_millis(500));
}

if !visible {
    // Process is alive but drive isn't visible - this is a warning state
    // Return mounted but with a warning in the error field
    return Ok(MountStatus {
        connection_id: connection.id,
        state: MountState::Mounted,  // process IS running
        active_mode: Some(active_mode),
        active_url: Some(url),
        pid: Some(pid),
        error: Some(format!(
            "Drive {}:\\ is not visible in Explorer. rclone process is running (PID {}). \
             Possible causes: WinFsp not functioning, drive letter conflict, or auth failure.",
            connection.drive_letter.to_uppercase(), pid
        )),
    });
}
```

### Frontend handling
- If `status.state === "mounted" && status.error`, show an amber warning badge "Mounted (Warning)" instead of green
- Log the warning message
- Toast with warning level

---

## 4. Accurate Active Mode Reporting in Logs/UI

**Problem:** User concern that rclone reports local IP when using tailscale.

**Analysis:** Rclone itself doesn't report which IP mode it uses - the app's `active_mode` field already tracks this correctly in `MountInfo`. The issue is that the Dashboard connection card always shows `conn.local_ip:conn.port` in the subtitle, regardless of which IP is actually in use.

**Fix (`Dashboard.tsx`):**
Change the connection card subtitle to show the active URL when mounted:

```tsx
// Current (always shows local_ip):
{conn.local_ip}:{conn.port}

// Fixed (shows active URL when mounted):
{isMounted && status?.active_url
  ? status.active_url.replace("http://", "")
  : `${conn.local_ip}:${conn.port}`}
```

This makes it immediately visible whether the mount is using local or tailscale.

---

## 5. Granular Mount Failure Logging

**Problem:** Logs currently show generic "mounted successfully" or "mount failed" without specifics.

**Fix:** Add detailed log messages at each failure/success point:

### Backend: Return structured errors from `mount_drive`
Instead of generic error strings, return specific messages:

| Scenario | Log Message |
|----------|-------------|
| Local unreachable, tailscale used | `"Local IP 192.168.1.x:80 unreachable, connected via Tailscale (100.x.x.x:80)"` |
| Both IPs unreachable | `"Mount failed: Local (192.168.1.x:80) and Tailscale (100.x.x.x:80) both unreachable"` |
| Drive letter taken | `"Mount failed: Drive Z:\\ is already in use"` |
| Process died immediately | `"Mount failed: rclone exited immediately (drive in use or auth failure)"` |
| Drive not visible | `"Warning: rclone running but drive Z:\\ not visible in Explorer"` |
| Success via local | `"Mounted MyServer to Z: via LAN (192.168.1.x:80)"` |
| Success via tailscale | `"Mounted MyServer to Z: via Tailscale (100.x.x.x:80)"` |

### Frontend: Enhanced `handleMount` logging
- Log which IP was attempted first and the result
- Log the fallback attempt and result
- Log the final mount status including URL

---

## 6. Network Change Detection

**Problem:** No monitoring of network changes. When user moves between home/away, mounts may silently break.

**Architecture:**

### Backend: Network monitor thread (`network.rs`)

```rust
// New: Start a background thread that monitors network changes
// Uses Windows NotifyAddrChange API (blocks until change, zero CPU)

pub fn start_network_monitor(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        loop {
            // This blocks until a network address change occurs
            // Zero CPU usage while waiting
            unsafe {
                let mut overlap: OVERLAPPED = std::mem::zeroed();
                let mut handle: HANDLE = std::ptr::null_mut();
                NotifyAddrChange(&mut handle, &mut overlap);
                WaitForSingleObject(handle, INFINITE);
            }

            // Small debounce - network changes often fire multiple events
            std::thread::sleep(Duration::from_secs(2));

            // Emit event to frontend
            app.emit("network-changed", ()).ok();
        }
    });
}
```

### Frontend: Network change handler (`App.tsx` or `Dashboard.tsx`)

Two modes, stored in settings as `network_change_mode: "notify" | "auto_reconnect"`:

**Notify mode (default):**
1. Listen for `network-changed` event
2. For each mounted connection with `network_mode: "auto"`:
   - Ping both local and tailscale IPs
   - If the active IP changed (was local, now only tailscale reachable, or vice versa):
     - Send notification: "Network changed: {name} connected via LAN, but you're now on Tailscale. Click Reconnect to switch."
     - Show a banner/badge on the connection card
3. User manually clicks "Reconnect" to unmount and remount with correct IP

**Auto-reconnect mode:**
1. Same detection as above
2. If active IP changed: automatically unmount and remount with the newly-reachable IP
3. Log: "Network change detected: remounting {name} from LAN to Tailscale"
4. Send notification of the switch

### Settings UI (`Settings.tsx`)
Add a new section "Network Change Behavior":
- **Notify only (default):** "When your network changes, you'll be notified if a mounted drive should switch between LAN and Tailscale. You control when to reconnect. Low resource usage."
- **Auto-reconnect:** "Automatically remounts drives when a network change is detected. Causes a brief interruption (~2-3 seconds) while the drive reconnects. Uses Windows network change events (not polling) so resource usage is minimal."

### New AppSettings fields:
```typescript
network_change_mode: "notify" | "auto_reconnect";  // default: "notify"
```

---

## 7. Fix Stale File Cache

**Problem:** After adding files remotely, navigating in Explorer doesn't show them. Must remount.

**Root cause:** Rclone's `--dir-cache-time` defaults to 5 minutes. Explorer's F5/navigation serves from this cache.

**Fix:**

### Add cache flags to speed profiles (`config.rs`)

Add two new fields to `SpeedProfileConfig`:

```rust
pub struct SpeedProfileConfig {
    // ... existing fields ...
    pub dir_cache_time: String,   // NEW
    pub poll_interval: String,    // NEW
}
```

Default values per profile:
| Profile | dir_cache_time | poll_interval |
|---------|---------------|---------------|
| Max | 0 (always fresh) | 5m |
| Balanced | 0 (always fresh) | 5m |
| Low | 30s | 10m |

Setting `dir_cache_time` to `0` means every directory listing is fetched fresh from the remote. On a LAN this adds negligible latency. On Tailscale it's slightly slower but still acceptable for the user's use case.

### Apply flags in `mount_drive` (`rclone.rs`)
Add to the args list:
```rust
args.extend([
    "--dir-cache-time".to_string(),
    profile_config.dir_cache_time.clone(),
    "--poll-interval".to_string(),
    profile_config.poll_interval.clone(),
]);
```

### User-configurable overrides

#### Data model changes

**Connection type** - add optional per-connection overrides:
```typescript
// types.ts - Connection interface
export interface Connection {
    // ... existing fields ...
    cache_overrides?: CacheOverrides;  // NEW - optional per-connection overrides
}

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
```

**Rust Connection struct** - add matching field:
```rust
pub struct Connection {
    // ... existing fields ...
    #[serde(default)]
    pub cache_overrides: Option<CacheOverrides>,
}

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

**Mount command** - in `mount_drive()`, after getting profile defaults, apply overrides:
```rust
let profile_config = connection.speed_profile.get_config();
// Apply per-connection overrides if set
let dir_cache_time = connection.cache_overrides
    .as_ref()
    .and_then(|o| o.dir_cache_time.clone())
    .unwrap_or(profile_config.dir_cache_time);
// ... same pattern for other fields
```

#### UI for overrides

**AddConnection / EditConnection** - Add a collapsible "Advanced Cache Settings" section below the Speed Profile card:

```
[Advanced Cache Settings]  (collapsed by default, expand with chevron)

When collapsed: "Using [Balanced] profile defaults"
When expanded:

  Dir Cache Time    [________] (placeholder: "0" from profile)
  Poll Interval     [________] (placeholder: "5m" from profile)
  VFS Cache Mode    [dropdown: full/minimal/writes/off]
  VFS Cache Size    [________] (placeholder: "10G" from profile)
  Read Ahead        [________] (placeholder: "128M" from profile)
  Buffer Size       [________] (placeholder: "256M" from profile)
  Transfers         [________] (placeholder: "8" from profile)
  Threads           [________] (placeholder: "8" from profile)

  [Reset to Profile Defaults]

  Info text: "Leave blank to use the speed profile defaults.
  Dir Cache Time: How long directory listings are cached. 0 = always fresh.
  Poll Interval: How often rclone checks for remote changes in the background."
```

Empty fields use profile defaults. Filled fields override them.

---

## Implementation Order

1. **Fix 7 (stale cache)** - Highest user impact, simplest change (add flags to config.rs + rclone.rs)
2. **Fix 2 (validate tailscale fallback)** - Critical reliability, backend-only
3. **Fix 5 (granular logging)** - Improves debuggability for all other fixes
4. **Fix 3 (verify mount visible)** - Backend change + minor frontend
5. **Fix 4 (active URL display)** - One-line frontend fix
6. **Fix 1 (test active connection)** - New command + UI button
7. **Fix 6 (network change detection)** - Most complex, new background thread + settings UI
8. **Fix 7 UI (cache overrides)** - Advanced settings UI, can ship after core fixes

---

## Files Modified

### Rust Backend
- `src-tauri/src/config.rs` - Add `dir_cache_time`, `poll_interval` to SpeedProfileConfig; add `CacheOverrides` struct; add `network_change_mode` to AppSettings
- `src-tauri/src/commands/network.rs` - Add `test_connection` command; add `start_network_monitor` with `NotifyAddrChange`
- `src-tauri/src/commands/rclone.rs` - Validate both IPs in auto mode; verify drive visible post-mount; apply cache flags; apply cache overrides
- `src-tauri/src/lib.rs` - Register new commands; start network monitor on app launch
- `src-tauri/Cargo.toml` - Add `windows` crate dependency for `NotifyAddrChange`

### Frontend
- `src/lib/types.ts` - Add `CacheOverrides` interface; add `network_change_mode` to AppSettings
- `src/lib/store.ts` - Add default for `network_change_mode`
- `src/pages/Dashboard.tsx` - Add Test button; show active URL; handle network change events; warning state for invisible drives
- `src/pages/AddConnection.tsx` - Test both IPs; add Advanced Cache Settings section
- `src/pages/EditConnection.tsx` - Same as AddConnection changes
- `src/pages/Settings.tsx` - Add Network Change Behavior section
- `src/App.tsx` - Listen for `network-changed` events

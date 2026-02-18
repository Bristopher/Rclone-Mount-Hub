# Rclone Mount Hub — Architecture & Design

> A polished Windows 11 desktop app for managing rclone mounts — Tauri 2 + React 19 + Rust.

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Goals & Non-Goals](#2-goals--non-goals)
- [3. Tech Stack](#3-tech-stack)
- [4. Project Structure](#4-project-structure)
- [5. Data Models](#5-data-models)
- [6. Rust Backend](#6-rust-backend)
- [7. Frontend Architecture](#7-frontend-architecture)
- [8. UI/UX Design System](#8-uiux-design-system)
- [9. System Integration](#9-system-integration)
- [10. Features](#10-features)

---

## 1. Overview

**Rclone Mount Hub** replaces the `scripts/Smart_Mount.ps1` PowerShell script with a proper desktop application. The original script:

- Installed rclone + WinFsp via winget
- Configured WebDAV remotes and auto-detected LAN vs Tailscale via ping
- Mounted drives with high-performance flags
- Created a system tray icon and set up autostart

The app wraps all of this in a polished GUI — no terminal, no scripts, just click and connect. It evolved beyond the original WebDAV/Unraid use case to support multiple protocols (WebDAV, SFTP, SMB, S3, FTP) and any remote server.

---

## 2. Goals & Non-Goals

### Goals
- **Multiple protocols** — WebDAV, SFTP, SMB, S3, FTP, any rclone-compatible remote
- **Multiple mounts** — Manage several connections simultaneously
- **Smart networking** — Auto-switch between LAN and Tailscale per-connection
- **Speed optimized** — Preset performance profiles (Max / Balanced / Low Resource)
- **Portable config** — Export/import JSON, generate standalone PS1 installer
- **System tray** — Lives in the tray, mounts on startup, shows live status
- **Auto-update** — Built-in update check and one-click install via Velopack
- **Beautiful** — Spacedrive-inspired dark UI with glassmorphism, Windows 11 feel

### Non-Goals
- Multi-PC dashboard — each PC manages its own mounts
- File browsing — use Windows Explorer via the mounted drive
- Mobile app — Windows 11 x64 only
- macOS / Linux — WinFsp is a Windows kernel driver; no cross-platform path

---

## 3. Tech Stack

### Desktop Shell
| Technology | Purpose |
|------------|---------|
| **Tauri 2** | Desktop shell. Rust backend, WebView2 frontend. ~5 MB binary |
| **Rust** | Backend: spawns rclone, network detection, config, tray, system integration |
| **Velopack** | Installer + in-app auto-update framework |

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19 | UI framework |
| **TypeScript** | 5 | Type safety |
| **Vite** | 7 | Build tooling with HMR (dev server: `localhost:1820`) |
| **Tailwind CSS** | v4 | Utility-first styling, custom dark theme tokens (no config file — v4 CSS-native) |
| **Zustand** | 5 | Client state (connections, settings, mount status, logs) |
| **Radix UI** | 2 | Accessible headless component primitives |
| **Framer Motion** | 12 | Page transitions, mount animations |
| **dnd-kit** | — | Drag-and-drop reordering of connections |
| **class-variance-authority + clsx** | — | Component variant system |
| **Phosphor Icons** | — | Icon library |
| **sonner** | — | Toast notifications |

> **Note:** `react-hook-form` and `zod` are installed but not used — forms use plain React `useState`.

### Tauri Plugins
| Plugin | Purpose |
|--------|---------|
| `tauri-plugin-shell` | Spawn rclone, PowerShell, taskkill |
| `tauri-plugin-store` | Persist connection configs and settings as JSON |
| `tauri-plugin-autostart` | Windows startup registration |
| `tauri-plugin-notification` | OS-native toast notifications (uses AUMID) |
| `tauri-plugin-dialog` | File/folder picker dialogs |
| `tauri-plugin-mcp-bridge` | **Dev only** — MCP bridge for Tauri devtools |

---

## 4. Project Structure

```
RcloneMountHub/
│
├── src-tauri/                          # ── Rust Backend ──
│   ├── Cargo.toml                      # Rust dependencies (tauri, velopack, tokio, serde, uuid)
│   ├── tauri.conf.json                 # Tauri config (window, bundle, plugins)
│   ├── build.rs                        # Build script
│   ├── capabilities/
│   │   └── default.json                # Plugin permission grants
│   ├── icons/                          # App icons
│   └── src/
│       ├── main.rs                     # Entry point — Velopack bootstrap, then Tauri run
│       ├── lib.rs                      # Tauri builder, 48 commands registered, tray setup
│       ├── config.rs                   # Serde structs: Connection, SpeedProfile, AppSettings
│       ├── state.rs                    # App-wide state (active mounts, PIDs)
│       └── commands/
│           ├── mod.rs                  # Re-exports all command modules
│           ├── rclone.rs               # Mount/unmount, remote config, drive detection (17 cmds)
│           ├── network.rs              # Ping, port check, LAN/Tailscale detection (3 cmds)
│           ├── system.rs               # Driver install/uninstall, autostart, updates (13+ cmds)
│           ├── speedtest.rs            # Speed test, network path analysis, disk benchmark (3 cmds)
│           └── window.rs               # Show/hide window, tray menu update, notifications (4 cmds)
│
├── src/                                # ── React Frontend ──
│   ├── main.tsx                        # React entry point
│   ├── App.tsx                         # Root component + hash-based routing
│   ├── App.css                         # Global styles + Tailwind imports
│   │
│   ├── lib/
│   │   ├── types.ts                    # TypeScript interfaces (mirrors Rust structs)
│   │   ├── store.ts                    # Zustand: ConnectionStore, SettingsStore, MountSummaryStore
│   │   ├── logStore.ts                 # Zustand: LogStore with category filtering
│   │   └── tauri.ts                    # Typed invoke() wrappers for all Rust commands
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx           # Sidebar + TitleBar + LogPanel + StatusBar shell
│   │   │   ├── Sidebar.tsx             # Navigation sidebar with route links
│   │   │   ├── TitleBar.tsx            # Custom draggable titlebar (startDragging API)
│   │   │   ├── StatusBar.tsx           # Bottom bar (mount count, network, rclone version)
│   │   │   └── LogPanel.tsx            # Collapsible log viewer, filterable by category
│   │   └── ui/
│   │       ├── Button.tsx              # Variants: default, primary, danger, ghost, success
│   │       ├── Input.tsx               # Text input with label + error
│   │       ├── Card.tsx                # Glassmorphism card container
│   │       ├── Badge.tsx               # Status badges (connected, disconnected, local, tailscale)
│   │       ├── Separator.tsx           # Horizontal divider
│   │       └── Skeleton.tsx            # Loading skeletons for cards and stats
│   │
│   └── pages/
│       ├── Dashboard.tsx               # All connections with live mount status + auto-mount
│       ├── AddConnection.tsx           # New connection form (WebDAV/SFTP/SMB/S3/FTP) + drive picker
│       ├── EditConnection.tsx          # Edit existing connection + drive picker
│       ├── Settings.tsx                # Preferences, driver management, rclone config path, updates
│       ├── SpeedTest.tsx               # Speed test, network path analysis, disk benchmark
│       └── Export.tsx                  # Export/import JSON (credentials excluded)
│
├── scripts/
│   └── Smart_Mount.ps1                 # Original reference script (generic, no personal defaults)
│
├── docs/
│   ├── ARCHITECTURE.md                 # This file
│   └── building.md                     # Build, bundle, distribute, version bumping
│
├── package.json                        # JS dependencies (version: 0.1.1)
├── vite.config.ts                      # Vite config
├── tsconfig.json
└── .gitignore
```

---

## 5. Data Models

### Connection
Represents a single rclone mount configuration (persisted via `tauri-plugin-store`).

```typescript
interface Connection {
  id: string;                                          // UUID v4
  name: string;                                        // Display name
  description: string;                                 // Optional description
  remote_type: string;                                 // "webdav" | "sftp" | "smb" | "s3" | "ftp"
  local_ip: string;                                    // LAN IP
  tailscale_ip: string;                                // Tailscale IP (optional)
  port: number;                                        // Service port
  drive_letter: string;                                // Mount target (e.g. "Z")
  username: string;                                    // Auth username
  // Password lives in rclone's own config (obscured), NOT in our JSON
  network_mode: "auto" | "local" | "tailscale";        // IP selection strategy
  speed_profile: "max" | "balanced" | "low";           // Rclone performance preset
  auto_mount: boolean;                                 // Mount when app starts
  sort_order: number;                                  // Drag-and-drop position
  created_at: string;                                  // ISO timestamp
}
```

### MountStatus (runtime, not persisted)
```typescript
interface MountStatus {
  connection_id: string;
  state: "mounted" | "mounting" | "unmounted" | "error";
  active_mode: "local" | "tailscale" | null;           // Which IP is in use
  active_url: string | null;                            // Current rclone URL
  pid: number | null;                                   // Rclone process PID
  error: string | null;
}
```

### Speed Profiles
Pre-configured rclone flag sets, selectable per connection.

| | Max Speed | Balanced | Low Resource |
|---|---|---|---|
| **VFS Cache** | 50 GB | 10 GB | 2 GB |
| **Buffer** | 512 MB | 256 MB | 64 MB |
| **Read-Ahead** | 512 MB | 128 MB | 32 MB |
| **Transfers** | 16 | 8 | 4 |
| **Streams** | 16 | 8 | 4 |
| **Best For** | 10Gbps LAN / Fiber | Daily use | Battery / slow WiFi |

All profiles include: `--vfs-cache-mode full`, `--ignore-checksum`, `--no-modtime`, `--network-mode=false`.

### AppSettings
```typescript
interface AppSettings {
  start_with_windows: boolean;
  start_minimized: boolean;
  close_to_tray: boolean;
  default_speed_profile: "max" | "balanced" | "low";
  default_network_mode: "auto" | "local" | "tailscale";
  show_notifications: boolean;
  rclone_config_path: string | null;                   // Custom config file path
}
```

### LogEntry
```typescript
interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  category: "system" | "drivers" | "mounts" | "network" | "speedtest";
}
```

---

## 6. Rust Backend

### Entry Point (`main.rs`)

```rust
fn main() {
    velopack::VelopackApp::build().run(); // Must run first — handles installer lifecycle
    rclone_mount_hub_lib::run()
}
```

Velopack intercepts `--velopack-*` CLI args during install/update/uninstall events and exits early. Normal launches fall through to `run()`.

### Command Module: `commands/rclone.rs` — 17 commands

| Command | Description |
|---------|-------------|
| `check_rclone_installed` | Check `rclone` in PATH |
| `check_winfsp_installed` | Check Windows registry for WinFsp |
| `list_remotes` | `rclone listremotes` |
| `list_rclone_remotes` | Detailed remote list with type info |
| `get_rclone_config_dump` | Full `rclone config dump` output |
| `create_remote` | `rclone config create` (password auto-obscured) |
| `delete_remote` | `rclone config delete` |
| `get_available_drives` | Unused drive letters D–Z |
| `mount_drive` | Spawn `rclone mount` as child process, return PID |
| `unmount_drive` | Kill rclone process by PID |
| `get_mount_status` | Check if a drive letter is currently mounted |
| `get_all_mount_statuses` | Batch status check for all connections |
| `list_external_rclone_mounts` | Find rclone mounts not managed by this app |
| `unmount_external_mount` | Kill an unmanaged rclone process |
| `set_rclone_config_path` | Override default config file path |
| `get_rclone_config_path` | Get current config path |
| `get_default_rclone_config_path` | Get default `%APPDATA%\rclone\rclone.conf` |

**Mount command constructed by Rust:**
```
rclone mount {remote}: {letter}: \
  --webdav-url {url}           (for WebDAV; other protocols use native rclone remote)
  --vfs-cache-mode full
  --vfs-cache-max-size {profile.cache}
  --vfs-read-ahead {profile.read_ahead}
  --buffer-size {profile.buffer}
  --transfers {profile.transfers}
  --multi-thread-streams {profile.streams}
  --ignore-checksum
  --no-modtime
  --network-mode=false
  --volname {name}
```

### Command Module: `commands/network.rs` — 3 commands

| Command | Description |
|---------|-------------|
| `ping_host` | TCP connect test (port 80/443) |
| `ping_port` | TCP connect test on specific port |
| `detect_network_mode` | Returns `"local"` or `"tailscale"` based on reachability |

### Command Module: `commands/system.rs` — 13+ commands

| Command | Description |
|---------|-------------|
| `install_rclone` | Install via Scoop package manager |
| `uninstall_rclone` | Remove via Scoop |
| `install_winfsp` | Download + launch WinFsp installer from GitHub releases |
| `uninstall_winfsp` | Remove WinFsp |
| `download_and_launch_winfsp_installer` | Fetch + run the WinFsp `.msi` |
| `get_driver_versions` | Returns `{ rclone, winfsp }` version strings |
| `check_driver_updates` | Check if newer versions are available |
| `enable_autostart` | Register app in `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` |
| `disable_autostart` | Remove autostart registry entry |
| `is_autostart_enabled` | Check current autostart status |
| `add_to_start_menu` | Register AUMID so Windows notifications show app name |
| `refresh_path` | Reload PATH env vars from registry after install |
| `open_rclone_web_ui` | Launch `rclone rcd --rc-web-gui` |
| `get_app_version` | Returns `CARGO_PKG_VERSION` |
| `check_app_update` | Check Velopack update feed for new version |
| `apply_app_update` | Download + apply Velopack update, restart app |

**Velopack update feed URL** is a constant in `system.rs`:
```rust
const UPDATE_FEED_URL: &str = "https://github.com/OWNER/REPO/releases/latest/download";
```
Update this before the first public release.

### Command Module: `commands/speedtest.rs` — 3 commands

| Command | Description |
|---------|-------------|
| `run_speed_test` | Write/read test file on mounted drive, returns upload + download MB/s, latency, bottleneck |
| `analyze_network_path` | Detect LAN vs Tailscale (100.x range), returns hop info |
| `test_local_disk_speed` | Benchmark local disk I/O, returns MB/s |

### Command Module: `commands/window.rs` — 4 commands

| Command | Description |
|---------|-------------|
| `show_window` | Un-hide and focus the main window |
| `hide_window` | Hide to tray |
| `update_tray_menu` | Rebuild tray menu with current mount list |
| `send_notification` | Show Windows toast with correct app name |

### System Tray (`lib.rs`)

Built via Tauri's native tray API:

- **Icon**: Switches between states based on mount activity
- **Tooltip**: "Rclone Mount Hub"
- **Menu**:
  - Per-mounted-drive items: "Open X:" (opens in Explorer)
  - Separator
  - "Show" → `show_window`
  - "Quit" → exit
- Left-click shows the main window
- App continues running when window is closed (close-to-tray setting)

---

## 7. Frontend Architecture

### State Management (Zustand — 4 stores)

```typescript
// store.ts

// 1. Connection Store (persisted via tauri-plugin-store)
interface ConnectionStore {
  connections: Connection[];
  addConnection: (conn: Connection) => void;
  updateConnection: (id: string, updates: Partial<Connection>) => void;
  removeConnection: (id: string) => void;
  reorderConnections: (ids: string[]) => void;
  loadFromDisk: () => Promise<void>;
  saveToDisk: () => Promise<void>;
}

// 2. Settings Store (persisted)
interface SettingsStore {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
}

// 3. Mount Summary Store (runtime, not persisted)
interface MountSummaryStore {
  mountedCount: number;
  networkMode: "local" | "tailscale" | null;
  setMountedCount: (n: number) => void;
  setNetworkMode: (mode: string | null) => void;
}
```

```typescript
// logStore.ts

// 4. Log Store (runtime, not persisted)
interface LogStore {
  entries: LogEntry[];
  isOpen: boolean;
  filter: LogCategory | "all";
  addLog: (level, message, category) => void;
  clearLogs: () => void;
  toggleOpen: () => void;
  setFilter: (category) => void;
}
```

### Routing

Hash-based routing in `App.tsx` (no react-router — 6 pages don't warrant the dependency):

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | All connection cards with live mount status |
| `/add` | AddConnection | New connection form (protocol picker, drive stepper) |
| `/edit/:id` | EditConnection | Edit existing connection |
| `/settings` | Settings | Preferences, driver management, updates |
| `/speedtest` | SpeedTest | Speed test, network analysis, disk benchmark |
| `/export` | Export | Config export/import (credentials excluded) |

### Tauri Bridge (`lib/tauri.ts`)

Typed wrappers around `invoke()`:

```typescript
export const rclone = {
  isInstalled: () => invoke<boolean>('check_rclone_installed'),
  isWinfspInstalled: () => invoke<boolean>('check_winfsp_installed'),
  listRemotes: () => invoke<string[]>('list_remotes'),
  createRemote: (name, url, user, pass) => invoke('create_remote', { name, url, user, pass }),
  deleteRemote: (name) => invoke('delete_remote', { name }),
  getAvailableDrives: () => invoke<string[]>('get_available_drives'),
};

export const network = {
  pingHost: (ip) => invoke<boolean>('ping_host', { ip }),
  pingPort: (ip, port) => invoke<boolean>('ping_port', { ip, port }),
  detectNetworkMode: (localIp, tailscaleIp) =>
    invoke<string>('detect_network_mode', { localIp, tailscaleIp }),
};

export const system = {
  installRclone: () => invoke('install_rclone'),
  installWinfsp: () => invoke('install_winfsp'),
  getDriverVersions: () => invoke<DriverVersions>('get_driver_versions'),
  getAvailableDrives: () => invoke<string[]>('get_available_drives'),
  openRcloneWebUi: () => invoke('open_rclone_web_ui'),
};

export const speedtest = {
  runSpeedTest: (driveLetter, fileSizeMb) =>
    invoke<SpeedTestResult>('run_speed_test', { driveLetter, fileSizeMb }),
  analyzeNetworkPath: (targetIp) =>
    invoke<NetworkPathInfo>('analyze_network_path', { targetIp }),
  testLocalDiskSpeed: () => invoke<number>('test_local_disk_speed'),
};
```

---

## 8. UI/UX Design System

### Design Philosophy

Modeled after **Spacedrive** — a premium dark interface that feels native to Windows 11 while being visually distinctive.

1. **Dark-first**: Deep backgrounds, subtle borders, glassmorphism panels
2. **Information density**: Everything visible on the dashboard, no unnecessary navigation
3. **Obvious actions**: Large mount/unmount buttons, clear status indicators
4. **Minimal clicks**: Any common action reachable in ≤ 2 clicks

### Color Palette

```css
/* Backgrounds (darkest → lightest) */
--bg-base:    #09090b;   /* zinc-950 — app background */
--bg-surface: #18181b;   /* zinc-900 — card/panel */
--bg-overlay: #27272a;   /* zinc-800 — elevated elements */

/* Borders */
--border-default: rgba(63, 63, 70, 0.5);   /* zinc-700/50 */
--border-hover:   rgba(82, 82, 91, 0.8);   /* zinc-600/80 */

/* Text */
--text-primary:   #fafafa;   /* zinc-50 */
--text-secondary: #a1a1aa;   /* zinc-400 */
--text-tertiary:  #71717a;   /* zinc-500 */

/* Accent */
--accent-blue:   #3b82f6;   /* Primary actions */
--accent-green:  #22c55e;   /* Mounted / success */
--accent-amber:  #f59e0b;   /* Connecting / warning */
--accent-red:    #ef4444;   /* Error / disconnected */
--accent-purple: #a855f7;   /* Tailscale / VPN indicator */
```

### Layout

```
┌──────────────────────────────────────────────────────┐
│  [●] Rclone Mount Hub              [—] [□] [×]      │  ← Custom TitleBar (startDragging API)
├─────────┬────────────────────────────────────────────┤
│         │                                            │
│  Drives │  Dashboard                                 │
│  ══════ │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  ● NAS  │  │ NAS      │ │ Media    │ │  + Add   │  │
│  ● Media│  │ Z: ● LAN │ │ Y: ● TS │ │  New     │  │
│         │  │ [Unmount] │ │ [Mount] │ │          │  │
│ ─────── │  └──────────┘ └──────────┘ └──────────┘  │
│ Settings│                                            │
│ Speed   │                                            │
│ Export  │                                            │
├─────────┴────────────────────────────────────────────┤
│  2 mounts active  •  LAN  •  rclone v1.68.2          │  ← StatusBar
└──────────────────────────────────────────────────────┘
         ▼ (collapsible)
┌──────────────────────────────────────────────────────┐
│  Logs  [system] [drivers] [mounts] [network] [all]   │  ← LogPanel
│  12:34 [mounts] Z: mounted via LAN (192.168.1.x:80) │
└──────────────────────────────────────────────────────┘
```

### Connection Card

```
┌─────────────────────────────┐
│  ● NAS                  ⋮  │  ← Green dot = mounted, kebab menu
│                             │
│  Z:  •  HOME (LAN)         │  ← Drive letter + active network
│  192.168.1.x:80            │  ← Active URL (muted)
│                             │
│  ⚡ Max Speed               │  ← Speed profile badge
│                             │
│  [  Unmount  ]  [ Settings ]│
└─────────────────────────────┘
```

### Drive Letter Picker (AddConnection / EditConnection)

```
  Drive Letter
  [←]  [ Z ]  [→]   3 free
```

Arrows cycle through available free letters loaded from `get_available_drives`. The letter box is also directly editable. EditConnection includes the connection's own current letter in the available list.

### Animations (Framer Motion)
- **Page transitions**: Slide + fade between routes (200 ms)
- **Mount/unmount**: Scale 0.95 → 1.0 with opacity
- **Status changes**: Color transition on badge/dot (300 ms spring)
- **Sidebar**: Subtle hover highlight (150 ms)
- **Log panel**: Slide-up expand/collapse

---

## 9. System Integration

### Window Dragging
Uses `appWindow.startDragging()` via the Tauri `core:window:allow-start-dragging` capability (listed in `capabilities/default.json`). The draggable region is the TitleBar component; window control buttons call `stopPropagation` to prevent drag interference.

### System Tray
Always visible while the app is running. Dynamically rebuilt via `update_tray_menu` whenever mount states change, showing "Open X:" items for each mounted drive.

### Windows Startup
`tauri-plugin-autostart` manages the registry entry. When "Start Minimized" is also enabled, the app launches hidden (via `--minimized` CLI flag) and auto-mounts connections with `auto_mount: true`.

### Notifications
`send_notification` uses the registered AppUserModelID (set by `add_to_start_menu`) so Windows shows "Rclone Mount Hub" as the notification source instead of "Windows PowerShell".

### Driver Installation
- **rclone**: Installed/removed via Scoop (`scoop install rclone`)
- **WinFsp**: Downloaded as `.msi` from GitHub releases and launched; requires elevation (WinFsp is a kernel driver)
- PATH is refreshed from the registry after install so the new binary is usable immediately

### Network Detection
On mount, Rust TCPs the connection's `local_ip:port`. If reachable → LAN URL. If not → Tailscale URL. Per-connection manual override (force LAN, force Tailscale, or auto) available.

### Config Persistence
All connection data is stored via `tauri-plugin-store` at `%APPDATA%/com.cbuzi.rclone-mount-hub/`. Credentials are NOT in our config — they live in rclone's own config file (obscured by rclone). A custom rclone config path can be set in Settings.

### Auto-update (Velopack)
`check_app_update` polls the GitHub releases feed via `velopack::sources::AutoSource`. If an update is available, the Settings page shows a version badge and "Update & Restart" button. `apply_app_update` downloads the update and calls `apply_updates_and_restart`.

---

## 10. Features

### Dashboard
- Grid of connection cards with live mount status (mounted / mounting / error)
- Per-card mount/unmount with spinner during transition
- "Mount All" / "Unmount All" global actions
- External mounts section: shows rclone processes not managed by this app, with unmount option
- Auto-mounts connections with `auto_mount: true` on startup
- Driver status cards (rclone + WinFsp version, update badges)
- Drag-and-drop reorder (dnd-kit)
- Collapsible log panel at the bottom

### Add / Edit Connection
- Protocol picker: WebDAV, SFTP, SMB, S3, FTP (with vendor presets for S3)
- Drive letter stepper `[←][Z][→]` showing only free letters + manual input
- Network mode selector: Auto (recommended) / Force LAN / Force Tailscale
- Speed profile selector with visual descriptions
- Auto-mount on startup toggle
- "Test Connection" button pings the IP + port before saving

### Speed Test & Diagnostics
- **Speed Test**: Write/read test file (10 MB / 100 MB / 1 GB) to a mounted drive, reports upload + download MB/s, latency, and bottleneck (`network` / `disk` / `rclone`)
- **Network Path Analysis**: Enter target IP, get LAN vs VPN detection + hop breakdown
- **Local Disk Benchmark**: Baseline your client disk speed to compare against mount speeds

### Settings
- Start with Windows toggle (registry autostart)
- Start minimized to tray toggle
- Close to tray toggle
- Driver management: install / uninstall rclone and WinFsp with version display
- Custom rclone config file path
- Add to Start Menu (registers AUMID for notifications)
- About & Updates: app version, check for updates, update + restart

### Export / Import
- **Export JSON**: All connections serialized to a portable `.json` file (credentials excluded — rclone stores those separately)
- **Import JSON**: Load connections from a `.json` file, merge into existing list
- **Generate PS1**: Produce a standalone `Smart_Mount.ps1` for any connection

### Log Panel
- Collapsible panel at the bottom of the app
- Filterable by category: `system`, `drivers`, `mounts`, `network`, `speedtest`
- Real-time entries from Rust commands via frontend log calls

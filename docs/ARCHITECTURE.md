# Rclone Mount Hub — Architecture & Design Document

> A beautiful, dad-friendly desktop app for managing rclone mounts to Unraid servers.
> Built with Tauri 2 + React 19. Styled after [Spacedrive](https://spacedrive.com).

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
- [11. Implementation Phases](#11-implementation-phases)

---

## 1. Overview

**Rclone Mount Hub** replaces the `Smart_Mount.ps1` PowerShell script with a proper desktop application. The original script:

- Installs rclone + WinFsp via winget
- Configures WebDAV remotes to an Unraid/Copyparty server
- Auto-detects LAN vs Tailscale via ping
- Mounts drives with high-speed flags (`--vfs-cache-mode full`, `--transfers 16`, `--network-mode=false`)
- Creates a system tray icon for status/management
- Sets up auto-start on Windows boot

The new app wraps all of this in a polished GUI that anyone can use — no terminal, no scripts, just click and connect.

---

## 2. Goals & Non-Goals

### Goals
- **Dead simple** — Dad can install and connect in under 2 minutes
- **Multiple mounts** — Manage several connections simultaneously
- **Smart networking** — Auto-switch between LAN and Tailscale
- **Speed optimized** — Preset profiles for different use cases
- **Portable config** — Export/import JSON + generate standalone PS1 installer
- **System tray** — Lives in the tray, always connected
- **Beautiful** — Spacedrive-inspired dark UI with glassmorphism

### Non-Goals
- Cloud storage management (Google Drive, S3, etc.) — this is for Unraid/local servers
- Multi-PC dashboard — each PC manages its own mounts
- File browsing — use Windows Explorer, we just mount the drive
- Mobile app — desktop only (Windows first, macOS/Linux later)

---

## 3. Tech Stack

### Desktop Shell
| Technology | Purpose |
|------------|---------|
| **Tauri 2** | Cross-platform desktop shell. Rust backend, web frontend. ~5MB app size. |
| **Rust** | Backend: spawns rclone, network detection, config management, system tray |

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework |
| **TypeScript** | Type safety |
| **Vite** | Build tooling (fast HMR, Tauri-native support) |
| **Zustand** | Client state management (connections, UI state) |
| **Radix UI** | Accessible headless component primitives |
| **Tailwind CSS v4** | Utility-first styling with custom dark theme |
| **Framer Motion** | Animations & transitions |
| **React Hook Form + Zod** | Form management & validation |
| **dnd-kit** | Drag-and-drop reordering of mounts |
| **clsx + class-variance-authority** | Conditional class merging (Spacedrive pattern) |
| **Phosphor Icons** | Icon library (matches Spacedrive aesthetic) |
| **sonner** | Toast notifications |
| **Inter** | Primary typeface (clean, modern) |

### Tauri Plugins
| Plugin | Purpose |
|--------|---------|
| `tauri-plugin-shell` | Spawn rclone processes, run winget |
| `tauri-plugin-store` | Persist connection configs as JSON |
| `tauri-plugin-autostart` | Register app for Windows startup |
| `tauri-plugin-notification` | OS-native toast notifications |
| `tauri-plugin-dialog` | File/folder picker dialogs |

### Why NOT Next.js?
Tauri wraps a webview — there's no server. Next.js's value (SSR, API routes, server components) doesn't apply. Vite is lighter, faster, and officially recommended for Tauri 2. Spacedrive uses Vite for the same reason.

---

## 4. Project Structure

```
RcloneMountHub/
│
├── src-tauri/                          # ── Rust Backend ──
│   ├── Cargo.toml                      # Rust dependencies
│   ├── tauri.conf.json                 # Tauri config (window, bundle, plugins)
│   ├── build.rs                        # Build script
│   ├── capabilities/
│   │   └── default.json                # Plugin permission grants
│   ├── icons/                          # App icons (auto-generated)
│   └── src/
│       ├── main.rs                     # Entry point (Windows subsystem)
│       ├── lib.rs                      # Tauri builder setup, command registration
│       ├── commands/
│       │   ├── mod.rs                  # Re-exports
│       │   ├── rclone.rs               # Mount, unmount, config, remote management
│       │   ├── network.rs              # Ping, LAN/Tailscale detection
│       │   ├── system.rs               # Dependency checks, winget install
│       │   └── export.rs               # JSON/PS1 export, JSON import
│       ├── state.rs                    # App-wide state (active processes, mount status)
│       ├── config.rs                   # Serde structs for connections/settings
│       └── tray.rs                     # System tray icon, menu, events
│
├── src/                                # ── React Frontend ──
│   ├── main.tsx                        # React entry point
│   ├── App.tsx                         # Root component + routing
│   ├── app.css                         # Tailwind imports + global styles
│   │
│   ├── lib/                            # ── Core Logic ──
│   │   ├── store.ts                    # Zustand stores (connections, settings, UI)
│   │   ├── types.ts                    # TypeScript types (mirrors Rust structs)
│   │   ├── schemas.ts                  # Zod validation schemas
│   │   ├── tauri.ts                    # Typed wrappers for Tauri invoke() calls
│   │   └── constants.ts               # Speed profiles, default values
│   │
│   ├── components/                     # ── UI Components ──
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx           # Sidebar + content + titlebar shell
│   │   │   ├── Sidebar.tsx             # Navigation sidebar
│   │   │   ├── TitleBar.tsx            # Custom draggable titlebar
│   │   │   └── StatusBar.tsx           # Bottom bar (connection summary)
│   │   │
│   │   ├── connections/
│   │   │   ├── ConnectionCard.tsx      # Mount card (status, controls, speed)
│   │   │   ├── ConnectionList.tsx      # Sortable grid of cards (dnd-kit)
│   │   │   ├── ConnectionForm.tsx      # Add/edit form (React Hook Form)
│   │   │   ├── SpeedProfileSelect.tsx  # Visual speed preset picker
│   │   │   ├── NetworkModeToggle.tsx   # Auto/LAN/Tailscale segmented control
│   │   │   └── DriveLetterPicker.tsx   # Available drive letter selector
│   │   │
│   │   ├── setup/
│   │   │   ├── SetupWizard.tsx         # First-run multi-step wizard
│   │   │   ├── DependencyCheck.tsx     # Rclone/WinFsp install status
│   │   │   └── WelcomeScreen.tsx       # Initial greeting + "Get Started"
│   │   │
│   │   └── ui/                         # ── Design System Primitives ──
│   │       ├── tw.ts                   # Tailwind component factory (Spacedrive pattern)
│   │       ├── Button.tsx              # Variants: default, primary, danger, ghost
│   │       ├── Input.tsx               # Text input with label + error
│   │       ├── Card.tsx                # Glassmorphism card container
│   │       ├── Badge.tsx               # Status badges (connected, disconnected, etc.)
│   │       ├── Dialog.tsx              # Modal dialog (Radix)
│   │       ├── Select.tsx              # Dropdown select (Radix)
│   │       ├── Switch.tsx              # Toggle switch (Radix)
│   │       ├── Tooltip.tsx             # Tooltip (Radix)
│   │       ├── DropdownMenu.tsx        # Context/dropdown menu (Radix)
│   │       ├── Toast.tsx               # Toast notification (sonner)
│   │       └── Separator.tsx           # Horizontal divider
│   │
│   └── pages/                          # ── Route Pages ──
│       ├── Dashboard.tsx               # Main view: all mounts with live status
│       ├── AddConnection.tsx           # New connection form page
│       ├── EditConnection.tsx          # Edit existing connection
│       ├── Settings.tsx                # App settings (startup, theme, defaults)
│       └── Export.tsx                  # Export/import config + PS1 generator
│
├── docs/                               # ── Documentation ──
│   ├── ARCHITECTURE.md                 # This file
│   └── RaiDrive_Speed_Issues_Explained_2026-02-15_09-30.md
│
├── Smart_Mount.ps1                     # Original script (reference)
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts                  # Custom dark theme tokens
├── index.html
└── .gitignore
```

---

## 5. Data Models

### Connection
Represents a single rclone mount configuration.

```typescript
interface Connection {
  id: string;                                    // UUID v4
  name: string;                                  // Display name (e.g. "MyNAS")
  localIp: string;                               // LAN IP (e.g. "192.168.1.x")
  tailscaleIp: string;                           // Tailscale IP (e.g. "100.x.x.x")
  port: number;                                  // WebDAV port (e.g. 80)
  driveLetter: string;                           // Mount letter (e.g. "Z")
  protocol: "webdav";                            // Protocol type (extensible)
  username: string;                              // WebDAV username
  // Password is stored in rclone's own config (obscured), NOT in our JSON
  networkMode: "auto" | "local" | "tailscale";   // How to pick the IP
  speedProfile: "max" | "balanced" | "low";      // Performance preset
  autoMount: boolean;                            // Mount when app starts
  sortOrder: number;                             // For drag-and-drop reorder
  createdAt: string;                             // ISO timestamp
}
```

### MountStatus (runtime, not persisted)
```typescript
interface MountStatus {
  connectionId: string;
  state: "mounted" | "mounting" | "unmounted" | "error";
  activeMode: "local" | "tailscale" | null;      // Which IP is in use
  activeUrl: string | null;                       // Current WebDAV URL
  pid: number | null;                             // Rclone process ID
  error: string | null;                           // Last error message
}
```

### Speed Profiles
Pre-configured rclone flag sets optimized for different scenarios.

```typescript
interface SpeedProfile {
  id: "max" | "balanced" | "low";
  label: string;
  description: string;
  flags: {
    vfsCacheMode: "full";
    vfsCacheMaxSize: string;    // e.g. "50G"
    vfsReadAhead: string;       // e.g. "512M"
    bufferSize: string;         // e.g. "512M"
    transfers: number;          // e.g. 16
    multiThreadStreams: number;  // e.g. 16
    ignoreChecksum: boolean;
    noModtime: boolean;
    networkMode: boolean;       // false = mount as local disk
  };
}
```

| Profile | Cache Size | Buffer | Read-Ahead | Transfers | Streams | Use Case |
|---------|-----------|--------|------------|-----------|---------|----------|
| **Max Speed** | 50G | 512M | 512M | 16 | 16 | 10Gbps LAN, Fiber remote |
| **Balanced** | 10G | 256M | 128M | 8 | 8 | General daily use |
| **Low Resource** | 2G | 64M | 32M | 4 | 4 | Laptop on battery, slow connection |

### AppSettings
```typescript
interface AppSettings {
  startWithWindows: boolean;       // Auto-start on boot
  startMinimized: boolean;         // Start to tray
  closeToTray: boolean;            // Close button → minimize to tray
  theme: "dark";                   // Dark only (Spacedrive style)
  defaultSpeedProfile: "max" | "balanced" | "low";
  defaultNetworkMode: "auto" | "local" | "tailscale";
  showNotifications: boolean;      // Toast on mount/unmount
}
```

---

## 6. Rust Backend

### Command Module: `commands/rclone.rs`

| Command | Signature | Description |
|---------|-----------|-------------|
| `check_rclone_installed` | `() → bool` | Check if `rclone` exists in PATH |
| `check_winfsp_installed` | `() → bool` | Check Windows registry for WinFsp driver |
| `list_remotes` | `() → Vec<String>` | Run `rclone listremotes` |
| `create_remote` | `(name, url, user, pass) → Result` | Run `rclone config create` (password auto-obscured) |
| `delete_remote` | `(name) → Result` | Run `rclone config delete` |
| `mount_drive` | `(connection: Connection, profile: SpeedProfile, url: String) → Result<u32>` | Spawn `rclone mount` as child process, return PID |
| `unmount_drive` | `(pid: u32) → Result` | Kill rclone process by PID |
| `get_mount_status` | `(drive_letter: String) → bool` | Check if drive letter is currently mounted |

**Mount command constructed by Rust:**
```
rclone mount {name}: {letter}: \
  --webdav-url {url} \
  --vfs-cache-mode full \
  --vfs-cache-max-size {profile.cache} \
  --vfs-read-ahead {profile.readAhead} \
  --buffer-size {profile.buffer} \
  --transfers {profile.transfers} \
  --multi-thread-streams {profile.streams} \
  --ignore-checksum \
  --no-modtime \
  --network-mode=false \
  --volname {name}
```

### Command Module: `commands/network.rs`

| Command | Signature | Description |
|---------|-----------|-------------|
| `ping_host` | `(ip: String, timeout_ms: u32) → bool` | TCP connect or ICMP ping |
| `detect_network` | `(local_ip: String) → "local" \| "tailscale"` | Ping local IP, return which network to use |

### Command Module: `commands/system.rs`

| Command | Signature | Description |
|---------|-----------|-------------|
| `install_rclone` | `() → Result` | Run `winget install -e --id Rclone.Rclone` |
| `install_winfsp` | `() → Result` | Run `winget install -e --id WinFsp.WinFsp` |
| `get_available_drives` | `() → Vec<String>` | Return unused drive letters (A-Z) |
| `refresh_path` | `() → ()` | Reload PATH env vars after install |

### Command Module: `commands/export.rs`

| Command | Signature | Description |
|---------|-----------|-------------|
| `export_json` | `(connections: Vec<Connection>) → String` | Serialize all connections to JSON |
| `import_json` | `(json: String) → Vec<Connection>` | Parse JSON back to connections |
| `generate_ps1` | `(connection: Connection, profile: SpeedProfile) → String` | Generate standalone Smart_Mount.ps1 for a connection |

### System Tray: `tray.rs`

The tray icon is always visible when the app is running. It provides:

- **Icon**: Green circle when any mount is active, gray when all disconnected
- **Tooltip**: "Rclone Mount Hub — 2 drives mounted"
- **Left-click**: Open/focus the main window
- **Right-click menu**:
  - Per-connection status (e.g. "MyNAS — Z: — LAN ✓")
  - Separator
  - "Mount All" / "Unmount All"
  - "Open Dashboard"
  - Separator
  - "Quit"

---

## 7. Frontend Architecture

### State Management (Zustand)

```typescript
// store.ts — Three focused stores

// 1. Connection Store
interface ConnectionStore {
  connections: Connection[];
  addConnection: (conn: Connection) => void;
  updateConnection: (id: string, updates: Partial<Connection>) => void;
  removeConnection: (id: string) => void;
  reorderConnections: (ids: string[]) => void;
  loadFromDisk: () => Promise<void>;
  saveToDisk: () => Promise<void>;
}

// 2. Mount Status Store (runtime only, not persisted)
interface MountStore {
  statuses: Record<string, MountStatus>;
  setStatus: (id: string, status: MountStatus) => void;
  mountConnection: (id: string) => Promise<void>;
  unmountConnection: (id: string) => Promise<void>;
  mountAll: () => Promise<void>;
  unmountAll: () => Promise<void>;
}

// 3. Settings Store
interface SettingsStore {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
}
```

### Routing

Simple hash-based routing (no react-router needed for 5 pages):

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Main view with all connection cards |
| `/add` | AddConnection | New connection form |
| `/edit/:id` | EditConnection | Edit existing connection |
| `/settings` | Settings | App preferences |
| `/export` | Export | Config export/import |

### Tauri Bridge (`lib/tauri.ts`)

Typed wrapper functions that call Rust commands via `invoke()`:

```typescript
import { invoke } from '@tauri-apps/api/core';

export const rclone = {
  isInstalled: () => invoke<boolean>('check_rclone_installed'),
  listRemotes: () => invoke<string[]>('list_remotes'),
  createRemote: (name: string, url: string, user: string, pass: string) =>
    invoke('create_remote', { name, url, user, pass }),
  mount: (connectionId: string) => invoke<number>('mount_drive', { connectionId }),
  unmount: (pid: number) => invoke('unmount_drive', { pid }),
};

export const network = {
  ping: (ip: string) => invoke<boolean>('ping_host', { ip, timeoutMs: 1000 }),
  detect: (localIp: string) => invoke<string>('detect_network', { localIp }),
};

export const system = {
  installRclone: () => invoke('install_rclone'),
  installWinfsp: () => invoke('install_winfsp'),
  getAvailableDrives: () => invoke<string[]>('get_available_drives'),
};
```

---

## 8. UI/UX Design System

### Design Philosophy
Modeled after **Spacedrive** — a premium dark interface that feels native to Windows 11 while being visually distinctive. The key principles:

1. **Dark-first**: Deep backgrounds, subtle borders, glassmorphism panels
2. **Information density**: Show everything on the dashboard — no unnecessary navigation
3. **Obvious actions**: Big mount/unmount buttons, clear status indicators
4. **Minimal interaction**: Dad should never need more than 2 clicks for any action

### Color Palette

```css
/* Background layers (darkest → lightest) */
--bg-base:       #09090b;    /* App background (zinc-950) */
--bg-surface:    #18181b;    /* Card/panel background (zinc-900) */
--bg-overlay:    #27272a;    /* Elevated elements (zinc-800) */
--bg-glass:      rgba(24, 24, 27, 0.7);  /* Glassmorphism panels */

/* Borders */
--border-default: rgba(63, 63, 70, 0.5);  /* Subtle (zinc-700/50) */
--border-hover:   rgba(82, 82, 91, 0.8);  /* On hover (zinc-600/80) */

/* Text */
--text-primary:   #fafafa;   /* Main text (zinc-50) */
--text-secondary: #a1a1aa;   /* Muted text (zinc-400) */
--text-tertiary:  #71717a;   /* Disabled/hint (zinc-500) */

/* Accent (mount status, primary actions) */
--accent-blue:    #3b82f6;   /* Primary action blue */
--accent-green:   #22c55e;   /* Connected/mounted */
--accent-amber:   #f59e0b;   /* Connecting/warning */
--accent-red:     #ef4444;   /* Error/disconnected */
--accent-purple:  #a855f7;   /* Tailscale mode indicator */

/* Glassmorphism */
--glass-blur:     12px;
--glass-bg:       rgba(24, 24, 27, 0.6);
--glass-border:   rgba(63, 63, 70, 0.3);
```

### Typography

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

/* Scale */
--text-xs:   0.75rem;   /* 12px — badges, labels */
--text-sm:   0.875rem;  /* 14px — secondary text */
--text-base: 1rem;      /* 16px — body */
--text-lg:   1.125rem;  /* 18px — card titles */
--text-xl:   1.25rem;   /* 20px — page headers */
--text-2xl:  1.5rem;    /* 24px — dashboard title */
```

### Component Styling Patterns

**Glassmorphism Card** (connection cards, panels):
```css
.card {
  background: rgba(24, 24, 27, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(63, 63, 70, 0.3);
  border-radius: 12px;
  transition: all 150ms ease;
}
.card:hover {
  border-color: rgba(82, 82, 91, 0.6);
  background: rgba(24, 24, 27, 0.8);
}
```

**Status Badge**:
```css
.badge-connected {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}
```

**Primary Button**:
```css
.btn-primary {
  background: #3b82f6;
  color: white;
  border-radius: 8px;
  font-weight: 500;
  transition: all 150ms ease;
}
.btn-primary:hover {
  background: #2563eb;
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
}
```

**Sidebar**:
```css
.sidebar {
  width: 220px;
  background: rgba(9, 9, 11, 0.8);
  backdrop-filter: blur(20px);
  border-right: 1px solid rgba(63, 63, 70, 0.3);
}
```

### Layout Structure

```
┌──────────────────────────────────────────────────────┐
│  [●] Rclone Mount Hub              [—] [□] [×]      │  ← Custom TitleBar (draggable)
├─────────┬────────────────────────────────────────────┤
│         │                                            │
│  Drives │  Dashboard                                 │
│  ══════ │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│         │  │ MyNAS   │ │ Media    │ │  + Add   │  │
│  ● Home │  │ Z: ● LAN │ │ Y: ● TS │ │  New     │  │
│  ● Media│  │ [Unmount] │ │ [Mount] │ │          │  │
│         │  └──────────┘ └──────────┘ └──────────┘  │
│ ─────── │                                            │
│         │                                            │
│ Settings│                                            │
│ Export  │                                            │
│         │                                            │
├─────────┴────────────────────────────────────────────┤
│  2 mounts active  •  LAN detected  •  rclone v1.68  │  ← StatusBar
└──────────────────────────────────────────────────────┘
```

### Connection Card Design

```
┌─────────────────────────────┐
│  ● MyNAS              ⋮  │  ← Green dot = mounted, kebab menu
│                             │
│  Z:  •  HOME (LAN)         │  ← Drive letter + network mode
│  192.168.1.x:80         │  ← Active URL (muted text)
│                             │
│  ⚡ Max Speed               │  ← Speed profile badge
│                             │
│  ┌─────────┐ ┌───────────┐ │
│  │ Unmount │ │  Settings  │ │  ← Action buttons
│  └─────────┘ └───────────┘ │
└─────────────────────────────┘
```

### Animations (Framer Motion)

- **Page transitions**: Slide + fade between routes (200ms)
- **Card mount/unmount**: Scale from 0.95 → 1.0 with opacity
- **Status changes**: Color transitions on badge/dot (300ms spring)
- **Sidebar hover**: Subtle background highlight (150ms)
- **Mount button**: Pulse animation while connecting
- **Card reorder**: Smooth drag with scale-up on grab (dnd-kit + Framer)

---

## 9. System Integration

### System Tray
- Built via Tauri's native tray API (Rust-side)
- Icon changes based on mount status (green/gray/amber)
- Right-click menu mirrors key app actions
- Left-click opens/focuses the main window
- App continues running when window is closed (if "Close to Tray" enabled)

### Windows Startup
- Managed via `tauri-plugin-autostart`
- Toggle in Settings page
- When enabled + "Start Minimized": app boots silently to tray and auto-mounts

### Dependency Management
- First-run checks for rclone + WinFsp
- Offers one-click install via winget (spawned from Rust)
- PATH refresh after install (reload env vars from registry)
- Graceful fallback if winget unavailable (link to download pages)

### Network Detection
- On mount, Rust pings the local IP with 1-second timeout
- If reachable → use LAN URL, badge shows "HOME (LAN)"
- If unreachable → use Tailscale URL, badge shows "REMOTE (Tailscale)"
- Manual override available per-connection (force LAN or force Tailscale)

### Config Persistence
- All connection data stored via `tauri-plugin-store` as JSON
- File location: `%APPDATA%/com.rclone-mount-hub/config.json`
- Passwords are NOT stored in our config — they live in rclone's own config (obscured)
- Export generates a portable JSON that can be imported on another PC

---

## 10. Features

### 10.1 Dashboard
- Grid of connection cards with live status
- One-click mount/unmount per connection
- "Mount All" / "Unmount All" global actions
- Drag-and-drop reorder (dnd-kit)
- Search/filter (when many connections)
- Empty state with "Add Your First Connection" CTA

### 10.2 Add/Edit Connection
- Form fields: Name, Local IP, Tailscale IP, Port, Drive Letter, Username, Password
- Smart defaults (192.168.1.x, port 80, drive Z:)
- Drive letter picker (shows only available letters)
- Network mode selector: Auto (recommended) / Force LAN / Force Tailscale
- Speed profile selector with visual descriptions
- Auto-mount toggle
- "Test Connection" button (pings IP + tests rclone config)

### 10.3 Speed Profiles
Three presets, selectable per-connection:

| | Max Speed | Balanced | Low Resource |
|---|---|---|---|
| **Icon** | ⚡ | ⚖️ | 🔋 |
| **Cache** | 50 GB | 10 GB | 2 GB |
| **Buffer** | 512 MB | 256 MB | 64 MB |
| **Read-Ahead** | 512 MB | 128 MB | 32 MB |
| **Transfers** | 16 | 8 | 4 |
| **Streams** | 16 | 8 | 4 |
| **Best For** | 10Gbps LAN, Fiber | Daily use | Battery, slow WiFi |

All profiles include: `--vfs-cache-mode full`, `--ignore-checksum`, `--no-modtime`, `--network-mode=false`

### 10.4 Export / Import
- **Export JSON**: Save all connection configs to a `.json` file
- **Import JSON**: Load connections from a `.json` file (merges or replaces)
- **Generate PS1**: Create a standalone `Smart_Mount.ps1` script for any connection
  - Includes winget install, rclone config create, smart IP switching, tray app generation
  - Can be emailed to Dad and run on a fresh PC

### 10.5 Settings
- Start with Windows (toggle)
- Start minimized to tray (toggle)
- Close to tray instead of quitting (toggle)
- Default speed profile for new connections
- Default network mode for new connections
- Show notifications on mount/unmount (toggle)

### 10.6 First-Run Wizard
Shown only when no connections exist:

1. **Welcome** — "Let's get your Unraid drive connected"
2. **Dependencies** — Check rclone + WinFsp, offer install buttons
3. **First Connection** — Simplified form with smart defaults
4. **Test & Mount** — Verify connection, mount the drive
5. **Done** — "Your Z: drive is ready! Find it in File Explorer"

### 10.7 Uninstall / Reset
- "Reset All" in Settings — removes all connections, rclone configs, app data
- Mirrors the "Nuclear Option" from Smart_Mount.ps1
- Requires confirmation dialog with typed confirmation

---

## 11. Implementation Phases

### Phase 1: Foundation
- Scaffold Tauri 2 + Vite + React + TypeScript
- Install all dependencies
- Configure Tailwind with dark theme tokens
- Build design system primitives (Button, Card, Input, Badge, etc.)
- Create app layout (Sidebar + TitleBar + content area)

### Phase 2: Core Backend
- Implement all Rust commands (rclone, network, system)
- Set up tauri-plugin-store for config persistence
- Wire up Tauri invoke() bridge in frontend
- Test mount/unmount from Rust directly

### Phase 3: Dashboard & Connection Management
- Zustand stores (connections, mount status, settings)
- Dashboard page with ConnectionCards
- Add/Edit connection form with validation
- Mount/unmount wired to backend
- Network auto-detection on mount

### Phase 4: System Integration
- System tray (icon, menu, events)
- Auto-start on Windows boot
- Close-to-tray behavior
- Notifications on mount/unmount

### Phase 5: Export & Polish
- JSON export/import
- PS1 script generator
- First-run wizard
- Animations (Framer Motion)
- Error handling & edge cases
- Drag-and-drop reorder

### Phase 6: Testing & Release
- Test on fresh Windows install (Dad's PC simulation)
- Test LAN → Tailscale auto-switching
- Test startup behavior across reboots
- Build release binary via `cargo tauri build`
- Generate Windows installer (.msi or .exe)

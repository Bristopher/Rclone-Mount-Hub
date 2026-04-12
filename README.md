# Rclone Mount Hub

> A polished Windows 11 desktop app for managing rclone mounts — born from a PowerShell script, grown into a full GUI.

[![Platform](https://img.shields.io/badge/platform-Windows%2011%20x64-0078d4?logo=windows11&logoColor=white)](https://www.microsoft.com/windows/windows-11)
[![Tauri](https://img.shields.io/badge/built%20with-Tauri%202-ffc131?logo=tauri&logoColor=white)](https://tauri.app)
[![React](https://img.shields.io/badge/frontend-React%2019-61dafb?logo=react&logoColor=black)](https://react.dev)
[![Rust](https://img.shields.io/badge/backend-Rust-ce422b?logo=rust&logoColor=white)](https://www.rust-lang.org)
[![Version](https://img.shields.io/badge/version-0.1.9-22c55e)](https://github.com/Bristopher/Rclone-Mount-Hub/releases)
[![License](https://img.shields.io/badge/license-AGPL--3.0-a855f7)](LICENSE)

---

## Purpose

Rclone Mount Hub lets you mount remote storage — NAS, Unraid, Nextcloud, SFTP, SMB, S3, FTP — as real Windows drive letters with a single click. No terminal, no scripts, no fuss. It wraps [rclone](https://rclone.org) in a clean, modern interface and handles connection management, smart network switching (LAN ↔ Tailscale), driver installation, performance tuning, and auto-update — all from one place.

> **Originally this was a simple PowerShell script** that I used to deploy rclone mounts on my own machine and for family— automatically installing rclone and WinFsp, configuring WebDAV remotes, and setting up Windows autostart. As the setup grew more complex and needed to work for non-technical household members, that script evolved into this full desktop application.

**Windows 11 (x64) only.** Rclone mounts as a Windows drive letter via [WinFsp](https://winfsp.dev), which is a Windows kernel driver — no macOS or Linux support.

---

## Table of Contents

- [Rclone Mount Hub](#rclone-mount-hub)
  - [Purpose](#purpose)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
    - [Mounting](#mounting)
    - [Smart Networking](#smart-networking)
    - [Performance Profiles](#performance-profiles)
    - [Protocol Support](#protocol-support)
    - [Diagnostics](#diagnostics)
    - [Management](#management)
    - [Windows Integration](#windows-integration)
  - [Platform \& Requirements](#platform--requirements)
  - [Getting Started](#getting-started)
    - [Install](#install)
    - [Updating](#updating)
  - [Tech Stack](#tech-stack)
    - [Desktop Shell](#desktop-shell)
    - [Frontend](#frontend)
    - [Tauri Plugins](#tauri-plugins)
  - [Building from Source](#building-from-source)
  - [Documentation](#documentation)
  - [The Story](#the-story)
    - [The Solution](#the-solution)
  - [Contributing](#contributing)
  - [License](#license)

---

## Features

### Mounting
- One-click mount / unmount any remote as a drive letter (D: – Z:)
- Manage multiple connections simultaneously
- Auto-mount on Windows startup
- Drive letter picker shows only available (free) letters
- System tray with live mount status and "Open in Explorer" shortcuts

### Smart Networking
- **Auto LAN / Tailscale switching** — uses local IP when home, falls back to Tailscale IP when away
- Per-connection manual override (force LAN-only or Tailscale-only)
- Ping-based connection testing before saving

### Performance Profiles
Three tuned rclone flag presets selectable per connection:

|           | Max Speed          | Balanced  | Low Resource        |
| --------- | ------------------ | --------- | ------------------- |
| VFS Cache | 50 GB              | 10 GB     | 2 GB                |
| Buffer    | 512 MB             | 256 MB    | 64 MB               |
| Transfers | 16                 | 8         | 4                   |
| Best for  | 10Gbps LAN / Fiber | Daily use | Battery / slow WiFi |

### Protocol Support
- **WebDAV** — Unraid (Copyparty), Nextcloud, ownCloud, SharePoint
- **SFTP** — any SSH server
- **SMB / Samba** — Windows shares, NAS devices
- **S3** — AWS, MinIO, Backblaze B2, Wasabi
- **FTP** — classic FTP servers

### Diagnostics
- Upload / download speed test to any mounted drive
- Bottleneck detection (network vs. client disk vs. rclone overhead)
- Network path analysis with latency breakdown
- Rclone Web UI launcher

### Management
- Export / import all connection configs as JSON
- Generate a standalone PowerShell script for any connection
- Install, update, or remove rclone and WinFsp from within the app
- Configurable rclone config file path
- Built-in update checker — downloads and applies app updates in one click (Velopack)

### Windows Integration
- Installs to `%LocalAppData%` — **no admin rights required**
- Start with Windows, start minimized, close to tray
- Windows toast notifications on mount / unmount (correct app name shown)
- Add to Start Menu / register AUMID for proper notification attribution

---

## Platform & Requirements

|                      |                                                                    |
| -------------------- | ------------------------------------------------------------------ |
| **OS**               | Windows 11 x64                                                     |
| **Required drivers** | rclone + WinFsp — the app installs both automatically on first run |
| **macOS / Linux**    | Not supported                                                      |

---

## Getting Started

### Install

Download the latest `Rclone Mount Hub_x.x.x_x64-setup.exe` from [Releases](https://github.com/Bristopher/Rclone-Mount-Hub/releases) and run it. No admin rights needed.

On first launch the app checks for rclone and WinFsp and offers to install them for you.

### Updating

Re-run the installer over your existing installation (updates in place), or use **Settings → About & Updates → Check for Updates** inside the app.

---

## Tech Stack

### Desktop Shell
|                                   |                                                                     |
| --------------------------------- | ------------------------------------------------------------------- |
| [Tauri 2](https://tauri.app)      | Desktop shell — Rust backend, web frontend, ~5 MB binary            |
| [Rust](https://www.rust-lang.org) | Backend: spawns rclone, network detection, tray, system integration |
| [Velopack](https://velopack.io)   | Installer and auto-update framework                                 |

### Frontend
|                                                 |                                                |
| ----------------------------------------------- | ---------------------------------------------- |
| [React 19](https://react.dev)                   | UI framework                                   |
| [TypeScript](https://www.typescriptlang.org)    | Type safety                                    |
| [Vite 7](https://vitejs.dev)                    | Build tooling                                  |
| [Tailwind CSS v4](https://tailwindcss.com)      | Utility styling with custom dark design tokens |
| [Zustand](https://zustand-demo.pmnd.rs)         | Persisted client state                         |
| [Radix UI](https://www.radix-ui.com)            | Accessible headless primitives                 |
| [Framer Motion](https://www.framer.com/motion/) | Animations                                     |
| [dnd-kit](https://dndkit.com)                   | Drag-and-drop reordering                       |
| [Phosphor Icons](https://phosphoricons.com)     | Icon library                                   |
| [sonner](https://sonner.emilkowal.ski)          | Toast notifications                            |

### Tauri Plugins
|                             |                               |
| --------------------------- | ----------------------------- |
| `tauri-plugin-shell`        | Spawn rclone processes        |
| `tauri-plugin-store`        | Persist configs as JSON       |
| `tauri-plugin-autostart`    | Windows startup registration  |
| `tauri-plugin-notification` | OS-native toast notifications |
| `tauri-plugin-dialog`       | File / folder picker          |

---

## Building from Source

See **[docs/Building-Src.md](docs/Building-Src.md)** for the full guide.

```bash
# Prerequisites: Rust (stable), Node.js 18+, pnpm
pnpm install
pnpm tauri dev          # development with hot reload
pnpm tauri build --bundles nsis   # production NSIS installer
```

---

## Documentation

|                                              |                                               |
| -------------------------------------------- | --------------------------------------------- |
| [docs/Building-Src.md](docs/Building-Src.md)         | Build, bundle, distribute, version bumping    |
| [docs/Architecture.md](docs/Architecture.md) | Full architecture, data models, design system |

---

## The Story

This all started when I got my first NAS and I started learning about how cool SMB network shares are (Spoiler: they're the furthest thing possible from that). But little Bristopher began having weird credentials issues...

> **Warning:** Skip this next paragraph if you don't want to read a rant, or continue reading if Windows SMB is also the bane of your existence (if that's the case, open a discussion on this repo on how much you hate it and tell me about it!).

...where I was logged in but actually... I wasn't? And if I tried my username and password it would say "wrong," but then I force change it on my NAS to something new and it was still wrong. Cleared Windows credentials? Still doesn't work. Speeds capped at 15MB/s even though my network was WiFi 6E (AND my NAS was hard-wired) and speed testing to my NAS gave me the normal 150+MB/s that spinning rust delivers.

Let's not forget about opening a network share that temporarily loses connection and crashes your whole Windows Explorer process!! (Yippie, I love having all my VSCode instances and browser windows reorganized in random orders and all my file explorer windows zapped out of existence when I'm in the middle of transferring files!!! My favorite pastime!). Also, just stating these are long-standing bugs well known and I'm not an isolated case experiencing "skill issue." Long story short, not only was it a nightmare for me, using it was a nightmare for anyone in my household also using it who aren't tech demons like myself and just normal Joes.

### The Solution

Fast forward 3 years of hell with SMB and I add an x8 NVMe SSD PCIe card (recommend, tons of fun, spinning rust is for geeks :P) and still can't achieve speeds above 30MB/s... until I finally try out something I've been eyeing that integrates well with Windows: **WebDAV** (Copyparty specifically).

Wait, wait, wait, I know what you're thinking: *"But Bristopher, WebDAV adds tons of unnecessary overhead and is actually slow, wah wah."* Yes, you're right, but hey, this is easy and "actually works," so yeah... I really liked the idea of **RaiDrive** (have to pay for "physical drive" addon so it's not 30MB/s, but even then my speeds didn't change so I gave up on it) and **CloudMounter** (great program but a little unstable when working with the mount).

So, I created **Rclone Mount Hub** so I can easily manage my NAS mounts and even other PCs on local network mounts (like to my laptop). Currently struggling with syncing solutions, so I think this is the way for me now because Syncthing and Resilio Sync have only been slow, glitchy nightmares. If you have any better solutions that have worked for you please share in the discussions tab thanks!!

---

## Contributing

Issues, feature requests, and pull requests are welcome. If Windows SMB has also ruined your life, open a discussion — misery loves company.

---

## License

Rclone Mount Hub is open source under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

**What this means:**
- You can use, modify, and distribute this software freely
- If you distribute a modified version or offer it as a hosted service, you must open source your changes under the same license
- You cannot take this code, close it up, and sell it as a proprietary product without releasing your changes

**Commercial licensing:** If your organization needs to use or build on Rclone Mount Hub without the AGPL obligations (e.g. in a proprietary product), a commercial license is available — open an issue or reach out directly.

Copyright © 2025 Bristopher. All rights reserved.

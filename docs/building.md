# Building & Distributing Rclone Mount Hub

## Prerequisites

| Tool | Install |
|------|---------|
| **Rust** (stable) | https://rustup.rs |
| **Node.js** (v18+) | https://nodejs.org |
| **pnpm** | `npm i -g pnpm` |
| **WebView2 Runtime** | Pre-installed on Windows 10/11. If missing: https://developer.microsoft.com/en-us/microsoft-edge/webview2/ |

> **NSIS installer** is built automatically. If you also want the MSI target you'll need the [WiX Toolset v3](https://wixtoolset.org/releases/) on your PATH — but NSIS is recommended for distribution so you can skip it.

---

## Dev mode

```bash
pnpm install          # install JS dependencies
pnpm tauri dev        # starts Vite + Tauri hot-reload
```

The app opens at `http://localhost:1820`. Rust changes rebuild automatically; frontend changes hot-reload.

---

## Production build

```bash
pnpm tauri build
```

This runs:
1. `pnpm build` — Vite bundles the frontend into `dist/`
2. `cargo build --release` — compiles the Rust backend
3. Tauri bundles everything into installers

### Output

```
src-tauri/target/release/bundle/
├── nsis/
│   └── Rclone Mount Hub_0.1.0_x64-setup.exe   ← distribute this
├── msi/
│   └── Rclone Mount Hub_0.1.0_x64_en-US.msi
└── Rclone Mount Hub.exe                         ← portable (no installer)
```

### Build only the NSIS installer (faster, recommended)

```bash
pnpm tauri build -- --bundles nsis
```

Skips MSI generation. First build takes several minutes while Rust compiles from scratch; subsequent builds are much faster.

---

## What the NSIS installer does

- Installs to `%LocalAppData%\Rclone Mount Hub\` — **no admin rights required** (`installMode: currentUser`)
- Creates a Start Menu shortcut under **Rclone Mount Hub/**
- Registers the app with Windows so toast notifications show **"Rclone Mount Hub"** (not "Windows PowerShell")
- Creates an uninstaller entry in Add/Remove Programs
- The app's autostart registry entry (`HKCU\...\Run`) points to the installed `.exe`, so **Start with Windows** works correctly after install

---

## Bumping the version

Edit **two** files:

```
src-tauri/tauri.conf.json   →  "version": "x.y.z"
src-tauri/Cargo.toml        →  version = "x.y.z"
```

---

## Portable / zip distribution

If you want a portable build with no installer, copy the standalone exe from:

```
src-tauri/target/release/Rclone Mount Hub.exe
```

> **Note:** With the portable exe, Windows won't know the app's identity, so toast notifications will show "Windows PowerShell". Users can fix this by going to **Settings → Startup → Add to Start Menu**, which registers the AUMID and creates a shortcut.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `cargo: command not found` | Install Rust via https://rustup.rs and restart your terminal |
| `error: linker 'link.exe' not found` | Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the "Desktop development with C++" workload |
| WebView2 missing at runtime | Install the [WebView2 Evergreen Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) — already present on Windows 10 (1803+) / 11 |
| NSIS not found | Tauri bundles its own NSIS copy — if it fails, run `cargo install tauri-cli` to update the CLI |
| Build succeeds but app crashes on start | Check `src-tauri/target/release/` for a `.log` file, or run the exe from a terminal to see stderr |

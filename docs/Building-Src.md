# Building & Distributing Rclone Mount Hub

## Prerequisites

| Tool                             | Install                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Rust** (stable)                | https://rustup.rs                                                                                          |
| **Node.js** (v18+)               | https://nodejs.org                                                                                         |
| **pnpm**                         | `npm i -g pnpm`                                                                                            |
| **WebView2 Runtime**             | Pre-installed on Windows 10/11. If missing: https://developer.microsoft.com/en-us/microsoft-edge/webview2/ |
| **.NET 8 SDK** *(Velopack only)* | https://dotnet.microsoft.com/download — required to install the `vpk` CLI                                  |

---

## Dev mode

```bash
pnpm install          # install JS dependencies
pnpm tauri dev        # starts Vite + Tauri hot-reload
```

The app opens at `http://localhost:1820`. Rust changes rebuild automatically; frontend changes hot-reload.

---

## Distribution methods

There are two ways to package Rclone Mount Hub for distribution:

| Method                       | Installer look      | Auto-update        | Delta updates | Extra tooling          |
| ---------------------------- | ------------------- | ------------------ | ------------- | ---------------------- |
| **Velopack** *(recommended)* | Clean, fast, silent | Built-in           | Yes           | .NET 8 SDK + `vpk` CLI |
| **NSIS** *(Tauri built-in)*  | Classic wizard      | Manual re-download | No            | None                   |

---

## Recommended: Velopack

Velopack replaces the NSIS installer with a much cleaner experience and adds proper in-app auto-update. This is the recommended way to distribute.

### One-time setup

Install the `vpk` CLI (requires .NET 8 SDK):

```bash
dotnet tool install -g vpk
```

Verify it works:

```bash
vpk --version
```

### Build + package workflow

**Step 1 — Compile the app:**

```bash
cd src-tauri && pnpm tauri build
```

> **Important:** Do NOT use `cargo build --release` directly — Tauri won't embed the frontend and the installed app will show a "localhost refused to connect" error.

The compiled exe lands at:
```
src-tauri/target/release/Rclone Mount Hub.exe
```

**Step 2 — Package with Velopack:**

```bash
cd src-tauri && vpk pack --packId com.cbuzi.rclone-mount-hub --packTitle "Rclone Mount Hub" --packVersion 0.1.2 --packDir "target/release" --mainExe "rclone-mount-hub.exe" --outputDir "Releases/v0.1.2"
```

**Step 3 — Output:**

```
src-tauri\Releases
├── RcloneMountHub-0.1.1-win-Setup.exe    ← distribute this
├── RcloneMountHub-0.1.1-full.nupkg       ← full update package
├── RcloneMountHub-0.1.0-delta.nupkg      ← delta (if prior version exists)
└── RELEASES                               ← update feed index


**Safe to Rename:**
*   ✅ `com.cbuzi.rclone-mount-hub-win-Setup.exe` -> `Rclone Mount Hub-Setup_v0.1.1.exe`
*   ✅ `com.cbuzi.rclone-mount-hub-win-Portable.zip` -> `Rclone Mount Hub-Portable_v0.1.1.zip`

**DO NOT Rename (Updates will break):**
*   ❌ `com.cbuzi...-full.nupkg`
*   ❌ `RELEASES`
*   ❌ `assets.win.json` / `releases.win.json`
```

**Step 4 — Publish to GitHub Releases:**

Upload the entire `src-tauri\Releases` folder contents as assets on a new GitHub Release tagged `0.1.1`. The in-app updater reads from this release automatically.

### Releasing a new version

1. Bump the version in **two** files:
   ```
   src-tauri/tauri.conf.json   →  "version": "x.y.z"
   src-tauri/Cargo.toml        →  version = "x.y.z"
   src-tauri/Cargo.lock        →  (auto-updated on next build)
   ```

2. Build + package:
   ```bash
   cd src-tauri && pnpm tauri build
   cd src-tauri && vpk pack --packId com.cbuzi.rclone-mount-hub --packTitle "Rclone Mount Hub" --packVersion x.y.z --packDir "target/release" --mainExe "rclone-mount-hub.exe" --outputDir "Releases/vx.y.z"
   ```

3. Create a GitHub Release tagged `vx.y.z` and upload all files from `releases/`

4. Users already running the app will see "Update available" in **Settings → About & Updates** and can update in one click. Users on the old version installing fresh download the new `Setup.exe`.

### Update feed URL

The in-app updater points to a constant in `src-tauri/src/commands/system.rs`:

```rust
const UPDATE_FEED_URL: &str = "https://github.com/Bristopher/Rclone-Mount-Hub/releases/latest/download";
```

Replace `Bristopher/Rclone-Mount-Hub` with your actual GitHub username and repository name before your first release.

---

## Alternative: NSIS (Tauri built-in)

No extra tooling required. Use this if you don't want to set up Velopack or don't need auto-update.

### Build

```bash
# Full build (NSIS + MSI)
pnpm tauri build

# NSIS only (faster, skip MSI)
pnpm tauri build --bundles nsis
```

First build takes several minutes while Rust compiles from scratch; subsequent builds are much faster.

### Output

```
src-tauri/target/release/bundle/
├── nsis/
│   └── Rclone Mount Hub_0.1.1_x64-setup.exe   ← distribute this
├── msi/
│   └── Rclone Mount Hub_0.1.1_x64_en-US.msi
└── Rclone Mount Hub.exe                         ← portable (no installer)
```

### What the NSIS installer does

- Installs to `%LocalAppData%\Rclone Mount Hub\` — **no admin rights required**
- Creates a Start Menu shortcut under **Rclone Mount Hub/**
- Registers the app so toast notifications show **"Rclone Mount Hub"**
- Creates an uninstaller entry in Add/Remove Programs
- The app's autostart registry entry points to the installed `.exe`, so **Start with Windows** works correctly after install

### Updating via NSIS

Re-running the installer over an existing install updates in place — users don't need to uninstall first. There is no in-app auto-update; users must manually download and re-run the new installer.

---

## Portable / no-installer

Copy the standalone exe directly:

```
src-tauri/target/release/Rclone Mount Hub.exe
```

> **Note:** With the portable exe, toast notifications will show "Windows PowerShell" since Windows doesn't know the app's identity. Users can fix this via **Settings → Startup → Add to Start Menu**.

---

## Bumping the version

Always update **both** files — they must stay in sync:

```
src-tauri/tauri.conf.json   →  "version": "x.y.z"
src-tauri/Cargo.toml        →  version = "x.y.z"
```

---

## Troubleshooting

| Problem                                 | Fix                                                                                                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cargo: command not found`              | Install Rust via https://rustup.rs and restart your terminal                                                                                          |
| `error: linker 'link.exe' not found`    | Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the "Desktop development with C++" workload      |
| WebView2 missing at runtime             | Install the [WebView2 Evergreen Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) — already present on Windows 10 (1803+) / 11 |
| NSIS not found                          | Tauri bundles its own NSIS copy — if it fails, run `cargo install tauri-cli` to update the CLI                                                        |
| `vpk: command not found`                | Run `dotnet tool install -g vpk` and ensure `~/.dotnet/tools` is on your PATH                                                                         |
| `vpk pack` fails with missing exe       | Make sure you ran `pnpm tauri build --bundles none` first so the exe exists                                                                           |
| Build succeeds but app crashes on start | Check `src-tauri/target/release/` for a `.log` file, or run the exe from a terminal to see stderr                                                     |
| In-app updater finds no updates         | Check that `UPDATE_FEED_URL` in `system.rs` matches your actual GitHub repo and that release assets were uploaded correctly                           |

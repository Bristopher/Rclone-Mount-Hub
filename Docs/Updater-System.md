# Updater System

## How It Works

Rclone Mount Hub uses [Velopack](https://velopack.io/) for auto-updates, pulling releases from the GitHub repository at `https://github.com/Bristopher/Rclone-Mount-Hub`.

### User Experience

1. **Auto-check on startup**: 3 seconds after the app launches, it silently checks for updates via the GitHub releases feed.
2. **Persistent banner**: If an update is available, a blue banner appears at the top of the window showing:
   - New version number
   - Download size
   - First line of the GitHub release notes
3. **One-click update**: Clicking "Update & Restart" triggers the download with a live progress bar, then automatically restarts the app.
4. **Dismiss**: Users can close the banner with the X button. It stays dismissed for the session but reappears next launch.
5. **Manual check**: Users can also check for updates in Settings > About & Updates.

### What Happens During an Update

1. All active rclone mount processes are killed (`kill_all_mounts()`)
2. Velopack downloads the update delta package from GitHub releases
3. Progress is streamed to the frontend via `update-download-progress` Tauri events
4. Velopack applies the update and restarts the app
5. On restart, connections with `auto_mount: true` reconnect automatically

### Safety: Installer Lock Prevention

The old "Failed to remove existing application directory" error is prevented at multiple levels:

| Exit Path | Cleanup |
|---|---|
| Tray > Quit | `RunEvent::Exit` -> `kill_all_mounts()` |
| Ctrl+Close | `full_quit()` -> `kill_all_mounts()` |
| In-app update | `apply_app_update()` -> `kill_all_mounts()` before download |
| Manual installer | Velopack `on_before_update_fast_callback` -> `taskkill /F /IM rclone.exe` |
| Uninstall | Velopack `on_before_uninstall_fast_callback` -> `taskkill /F /IM rclone.exe` |

---

## Developer: Publishing an Update

### Prerequisites

- [Velopack CLI (`vpk`)](https://velopack.io/) installed
- GitHub repo with releases enabled

### Steps

1. **Bump version** and build:
   ```powershell
   .\build-release.ps1
   # Enter the new version when prompted (e.g., 0.2.0)
   ```

2. **Create a GitHub release**:
   - Tag: `v0.2.0`
   - Title: `v0.2.0`
   - Body: release notes (first line shows in the app's update banner)
   - Attach ALL files from `src-tauri\Releases\v0.2.0\`:
     - `com.cbuzi.rclone-mount-hub-win-Setup.exe` (or renamed version)
     - `RELEASES` (required by Velopack)
     - Any `.nupkg` delta files

3. The `RELEASES` file is critical — Velopack reads it to determine what's available. Without it, auto-update won't find anything.

### How Velopack Finds Updates

The update feed URL is configured in `src-tauri/src/commands/system.rs`:

```rust
const UPDATE_FEED_URL: &str =
    "https://github.com/Bristopher/Rclone-Mount-Hub/releases/latest/download";
```

Velopack's `AutoSource` fetches the `RELEASES` file from this URL, compares versions, and downloads delta packages if available (falls back to full package).

### Release Notes in the App

The app fetches release notes from the GitHub API endpoint:
```
https://api.github.com/repos/Bristopher/Rclone-Mount-Hub/releases/latest
```

It extracts:
- `body` field -> release notes (first line shown in banner)
- `assets[].size` -> total download size shown to user

### Key Files

| File | Purpose |
|---|---|
| `src-tauri/src/main.rs` | Velopack hooks (before-update, before-uninstall) |
| `src-tauri/src/commands/system.rs` | `check_app_update`, `apply_app_update`, GitHub API fetch |
| `src/App.tsx` | Update banner UI, auto-check on startup, progress bar |
| `src/pages/Settings.tsx` | Manual "Check for Updates" button |
| `build-release.ps1` | Version bumping + Tauri build + Velopack packaging |

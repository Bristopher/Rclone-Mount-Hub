// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Must be called before anything else — handles install/update/uninstall hooks
    velopack::VelopackApp::build()
        .on_app_uninstall(|_version| {
            // Clean up Tauri plugin store data left in %AppData%
            if let Ok(app_data) = std::env::var("APPDATA") {
                let _ = std::fs::remove_dir_all(
                    format!("{}\\com.cbuzi.rclone-mount-hub", app_data)
                );
            }
            // Remove Start Menu shortcut if it exists
            if let Ok(app_data) = std::env::var("APPDATA") {
                let lnk = format!(
                    "{}\\Microsoft\\Windows\\Start Menu\\Programs\\Rclone Mount Hub.lnk",
                    app_data
                );
                let _ = std::fs::remove_file(lnk);
            }
        })
        .run();
    rclone_mount_hub_lib::run()
}

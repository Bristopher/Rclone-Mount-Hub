mod commands;
mod config;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .invoke_handler(tauri::generate_handler![
            // Rclone commands
            commands::check_rclone_installed,
            commands::check_winfsp_installed,
            commands::list_remotes,
            commands::create_remote,
            commands::delete_remote,
            commands::get_available_drives,
            // Network commands
            commands::ping_host,
            commands::ping_port,
            commands::detect_network_mode,
            // System commands
            commands::install_rclone,
            commands::install_winfsp,
            commands::refresh_path,
            commands::open_rclone_web_ui,
            // Speed test commands
            commands::run_speed_test,
            commands::analyze_network_path,
            commands::test_local_disk_speed,
        ])
        .setup(|_app| {
            // System tray setup will go here
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

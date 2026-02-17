mod commands;
mod config;

use tauri::Manager;
use tauri::{menu::*, tray::*};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
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
            commands::mount_drive,
            commands::unmount_drive,
            commands::get_mount_status,
            commands::get_all_mount_statuses,
            // Network commands
            commands::ping_host,
            commands::ping_port,
            commands::detect_network_mode,
            // System commands
            commands::install_rclone,
            commands::install_winfsp,
            commands::uninstall_rclone,
            commands::uninstall_winfsp,
            commands::get_driver_versions,
            commands::check_driver_updates,
            commands::enable_autostart,
            commands::disable_autostart,
            commands::is_autostart_enabled,
            commands::refresh_path,
            commands::open_rclone_web_ui,
            // Speed test commands
            commands::run_speed_test,
            commands::analyze_network_path,
            commands::test_local_disk_speed,
            // Window commands
            commands::show_window,
            commands::hide_window,
            commands::send_notification,
        ])
        .setup(|app| {
            // Create system tray menu
            let show_item = MenuItemBuilder::with_id("show", "Show Window").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .separator()
                .item(&quit_item)
                .build()?;

            // Create system tray
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Rclone Mount Hub")
                .on_menu_event(move |app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        });

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

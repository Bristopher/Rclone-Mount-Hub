// Window management commands

use tauri::command;
use tauri::Manager;
use tauri::menu::*;

#[command]
pub async fn show_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[command]
pub async fn hide_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Rebuilds the system tray right-click menu with an "Open X:" item for each active mount.
/// mount_entries: list of (display_name, drive_letter) for each mounted drive.
#[command]
pub async fn update_tray_menu(
    app: tauri::AppHandle,
    mount_entries: Vec<(String, String)>,
) -> Result<(), String> {
    let mut builder = MenuBuilder::new(&app);

    // Dynamic "Open X:" entries at the top
    if !mount_entries.is_empty() {
        for (name, letter) in &mount_entries {
            let id = format!("open-{}", letter.to_uppercase());
            let label = format!("Open {} ({}:)", name, letter.to_uppercase());
            let item = MenuItemBuilder::with_id(id, label)
                .build(&app)
                .map_err(|e| e.to_string())?;
            builder = builder.item(&item);
        }
        builder = builder.separator();
    }

    let show_item = MenuItemBuilder::with_id("show", "Show Window")
        .build(&app)
        .map_err(|e| e.to_string())?;
    let quit_item = MenuItemBuilder::with_id("quit", "Quit")
        .build(&app)
        .map_err(|e| e.to_string())?;

    let menu = builder
        .item(&show_item)
        .separator()
        .item(&quit_item)
        .build()
        .map_err(|e| e.to_string())?;

    if let Some(tray) = app.tray_by_id("main") {
        tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[command]
pub async fn send_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;

    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())?;

    Ok(())
}

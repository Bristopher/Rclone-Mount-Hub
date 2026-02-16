// Commands module - Tauri command handlers

#[tauri::command]
pub fn test_command() -> String {
    "Rclone Mount Hub backend is running!".to_string()
}

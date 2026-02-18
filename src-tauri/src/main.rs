// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Must be called before anything else — handles install/update/uninstall hooks
    velopack::VelopackApp::build().run();
    rclone_mount_hub_lib::run()
}

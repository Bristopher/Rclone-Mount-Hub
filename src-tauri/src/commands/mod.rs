// Commands module - Tauri command handlers

pub mod rclone;
pub mod network;
pub mod system;
pub mod speedtest;
pub mod window;

// Re-export all commands for easy registration
pub use rclone::*;
pub use network::*;
pub use system::*;
pub use speedtest::*;
pub use window::*;

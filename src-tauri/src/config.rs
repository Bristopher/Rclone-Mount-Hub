// Data models that match the frontend TypeScript types

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connection {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub remote_type: String, // rclone remote type: webdav, sftp, smb, s3, ftp
    pub local_ip: String,
    pub tailscale_ip: String,
    pub port: u16,
    pub drive_letter: String,
    pub protocol: String,
    pub username: String,
    // Password is NOT stored here - it's in rclone's config
    pub network_mode: NetworkMode,
    pub speed_profile: SpeedProfile,
    pub auto_mount: bool,
    pub sort_order: i64, // u32 overflows Date.now() values
    pub created_at: String, // ISO timestamp
    #[serde(default)]
    pub cache_overrides: Option<CacheOverrides>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NetworkMode {
    Auto,
    Local,
    Tailscale,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SpeedProfile {
    Max,
    Balanced,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeedProfileConfig {
    pub vfs_cache_mode: String,
    pub vfs_cache_max_size: String,
    pub vfs_read_ahead: String,
    pub buffer_size: String,
    pub transfers: u32,
    pub multi_thread_streams: u32,
    pub dir_cache_time: String,
    pub poll_interval: String,
    pub ignore_checksum: bool,
    pub no_modtime: bool,
    pub network_mode: bool, // false = mount as local disk
}

impl SpeedProfile {
    pub fn get_config(&self) -> SpeedProfileConfig {
        match self {
            SpeedProfile::Max => SpeedProfileConfig {
                vfs_cache_mode: "full".to_string(),
                vfs_cache_max_size: "50G".to_string(),
                vfs_read_ahead: "512M".to_string(),
                buffer_size: "512M".to_string(),
                transfers: 16,
                multi_thread_streams: 16,
                dir_cache_time: "0".to_string(),
                poll_interval: "5m".to_string(),
                ignore_checksum: true,
                no_modtime: false,
                network_mode: false,
            },
            SpeedProfile::Balanced => SpeedProfileConfig {
                vfs_cache_mode: "full".to_string(),
                vfs_cache_max_size: "10G".to_string(),
                vfs_read_ahead: "128M".to_string(),
                buffer_size: "256M".to_string(),
                transfers: 8,
                multi_thread_streams: 8,
                dir_cache_time: "0".to_string(),
                poll_interval: "5m".to_string(),
                ignore_checksum: true,
                no_modtime: false,
                network_mode: false,
            },
            SpeedProfile::Low => SpeedProfileConfig {
                vfs_cache_mode: "full".to_string(),
                vfs_cache_max_size: "2G".to_string(),
                vfs_read_ahead: "32M".to_string(),
                buffer_size: "64M".to_string(),
                transfers: 4,
                multi_thread_streams: 4,
                dir_cache_time: "30s".to_string(),
                poll_interval: "10m".to_string(),
                ignore_checksum: true,
                no_modtime: false,
                network_mode: false,
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MountStatus {
    pub connection_id: String,
    pub state: MountState,
    pub active_mode: Option<String>, // "local" or "tailscale"
    pub active_url: Option<String>,
    pub pid: Option<u32>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MountState {
    Mounted,
    Mounting,
    Unmounted,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CacheOverrides {
    pub dir_cache_time: Option<String>,
    pub poll_interval: Option<String>,
    pub vfs_cache_mode: Option<String>,
    pub vfs_cache_max_size: Option<String>,
    pub vfs_read_ahead: Option<String>,
    pub buffer_size: Option<String>,
    pub transfers: Option<u32>,
    pub multi_thread_streams: Option<u32>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub start_with_windows: bool,
    pub start_minimized: bool,
    pub close_to_tray: bool,
    pub theme: String, // "dark"
    pub default_speed_profile: SpeedProfile,
    pub default_network_mode: NetworkMode,
    pub show_notifications: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            start_with_windows: false,
            start_minimized: false,
            close_to_tray: true,
            theme: "dark".to_string(),
            default_speed_profile: SpeedProfile::Balanced,
            default_network_mode: NetworkMode::Auto,
            show_notifications: true,
        }
    }
}

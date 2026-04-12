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
    #[serde(default)]
    pub dual_mount: bool,
    #[serde(default)]
    pub archive_drive_letter: Option<String>,
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
                // 500G cap so VM images and other huge files don't deadlock the
                // VFS cache. Paired with --vfs-cache-min-free-space in rclone.rs
                // so the cache can't actually fill the user's OS drive.
                vfs_cache_max_size: "500G".to_string(),
                vfs_read_ahead: "512M".to_string(),
                buffer_size: "512M".to_string(),
                transfers: 16,
                multi_thread_streams: 16,
                // Cache dir listings for 1h; poll every 30s detects real changes
                // and invalidates stale dirs immediately — fast browsing + fresh data
                dir_cache_time: "1h".to_string(),
                poll_interval: "30s".to_string(),
                ignore_checksum: true,
                no_modtime: false,
                network_mode: false,
            },
            SpeedProfile::Balanced => SpeedProfileConfig {
                vfs_cache_mode: "full".to_string(),
                // 200G cap — generous enough for VM backups and large media
                // files without silently deadlocking on files bigger than cache.
                vfs_cache_max_size: "200G".to_string(),
                vfs_read_ahead: "128M".to_string(),
                buffer_size: "256M".to_string(),
                transfers: 8,
                multi_thread_streams: 8,
                // Cache dir listings for 5m; poll every minute keeps it current
                dir_cache_time: "5m".to_string(),
                poll_interval: "1m".to_string(),
                ignore_checksum: true,
                no_modtime: false,
                network_mode: false,
            },
            SpeedProfile::Low => SpeedProfileConfig {
                vfs_cache_mode: "full".to_string(),
                // 50G cap — low-resource profile, but still large enough to
                // handle typical large files without deadlocking.
                vfs_cache_max_size: "50G".to_string(),
                vfs_read_ahead: "32M".to_string(),
                buffer_size: "64M".to_string(),
                transfers: 4,
                multi_thread_streams: 4,
                // 2m dir cache; poll every 5m — conserves bandwidth
                dir_cache_time: "2m".to_string(),
                poll_interval: "5m".to_string(),
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
    pub archive_pid: Option<u32>,
    pub error: Option<String>,
    pub log: Option<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NetworkChangeMode {
    Notify,
    AutoReconnect,
}

impl Default for NetworkChangeMode {
    fn default() -> Self {
        NetworkChangeMode::Notify
    }
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
    #[serde(default)]
    pub network_change_mode: NetworkChangeMode,
    #[serde(default)]
    pub cache_dir: Option<String>,
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
            network_change_mode: NetworkChangeMode::default(),
            cache_dir: None,
        }
    }
}

// TypeScript types matching Rust backend models

export interface Connection {
  id: string;
  name: string;
  description: string;
  remote_type: string; // rclone remote type: webdav, sftp, smb, s3, ftp, etc.
  local_ip: string;
  tailscale_ip: string;
  port: number;
  drive_letter: string;
  protocol: "webdav";
  username: string;
  // Password is NOT stored - it's in rclone config
  network_mode: NetworkMode;
  speed_profile: SpeedProfile;
  auto_mount: boolean;
  sort_order: number;
  created_at: string; // ISO timestamp
}

export type NetworkMode = "auto" | "local" | "tailscale";
export type SpeedProfile = "max" | "balanced" | "low";

export interface MountStatus {
  connection_id: string;
  state: MountState;
  active_mode: "local" | "tailscale" | null;
  active_url: string | null;
  pid: number | null;
  error: string | null;
}

export type MountState = "mounted" | "mounting" | "unmounted" | "error";

export interface AppSettings {
  start_with_windows: boolean;
  start_minimized: boolean;
  close_to_tray: boolean;
  theme: "dark";
  default_speed_profile: SpeedProfile;
  default_network_mode: NetworkMode;
  show_notifications: boolean;
  /** Empty string = use rclone's own default (~/.config/rclone/rclone.conf or %APPDATA%\rclone\rclone.conf) */
  rclone_config_path: string;
}

export interface SpeedProfileInfo {
  id: SpeedProfile;
  label: string;
  description: string;
  icon: string;
  cache: string;
  buffer: string;
  transfers: number;
}

export const SPEED_PROFILES: Record<SpeedProfile, SpeedProfileInfo> = {
  max: {
    id: "max",
    label: "Max Speed",
    description: "10Gbps LAN, Fiber remote",
    icon: "⚡",
    cache: "50 GB",
    buffer: "512 MB",
    transfers: 16,
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    description: "General daily use",
    icon: "⚖️",
    cache: "10 GB",
    buffer: "256 MB",
    transfers: 8,
  },
  low: {
    id: "low",
    label: "Low Resource",
    description: "Battery, slow WiFi",
    icon: "🔋",
    cache: "2 GB",
    buffer: "64 MB",
    transfers: 4,
  },
};

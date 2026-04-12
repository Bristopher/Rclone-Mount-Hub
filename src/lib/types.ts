// TypeScript types matching Rust backend models

export interface Connection {
  id: string;
  name: string;
  description: string;
  remote_type: string;
  local_ip: string;
  tailscale_ip: string;
  port: number;
  drive_letter: string;
  protocol: string;
  vendor: string; // server software: copyparty, sftpgo, openssh, etc.
  username: string;
  network_mode: NetworkMode;
  speed_profile: SpeedProfile;
  auto_mount: boolean;
  sort_order: number;
  created_at: string;
  cache_overrides?: CacheOverrides;
  dual_mount: boolean;
  archive_drive_letter?: string;
}

export type NetworkMode = "auto" | "local" | "tailscale";
export type SpeedProfile = "max" | "balanced" | "low";
export type NetworkChangeMode = "notify" | "auto_reconnect";

export interface MountStatus {
  connection_id: string;
  state: MountState;
  active_mode: "local" | "tailscale" | null;
  active_url: string | null;
  pid: number | null;
  archive_pid: number | null;
  error: string | null;
  log: string | null;
}

export type MountState = "mounted" | "mounting" | "unmounted" | "error";

export interface CacheOverrides {
  dir_cache_time?: string;
  poll_interval?: string;
  vfs_cache_mode?: string;
  vfs_cache_max_size?: string;
  vfs_read_ahead?: string;
  buffer_size?: string;
  transfers?: number;
  multi_thread_streams?: number;
}

export interface AppSettings {
  start_with_windows: boolean;
  start_minimized: boolean;
  close_to_tray: boolean;
  theme: "dark";
  default_speed_profile: SpeedProfile;
  default_network_mode: NetworkMode;
  show_notifications: boolean;
  rclone_config_path: string;
  network_change_mode: NetworkChangeMode;
  cache_dir: string;
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
    cache: "500 GB",
    buffer: "512 MB",
    transfers: 16,
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    description: "General daily use",
    icon: "⚖️",
    cache: "200 GB",
    buffer: "256 MB",
    transfers: 8,
  },
  low: {
    id: "low",
    label: "Low Resource",
    description: "Battery, slow WiFi",
    icon: "🔋",
    cache: "50 GB",
    buffer: "64 MB",
    transfers: 4,
  },
};

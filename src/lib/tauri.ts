// Typed wrappers for Tauri commands

import { invoke } from "@tauri-apps/api/core";

export const rclone = {
  isInstalled: () => invoke<boolean>("check_rclone_installed"),
  isWinfspInstalled: () => invoke<boolean>("check_winfsp_installed"),
  listRemotes: () => invoke<string[]>("list_remotes"),
  createRemote: (
    name: string,
    url: string,
    vendor: string,
    user: string,
    pass: string
  ) => invoke("create_remote", { name, url, vendor, user, pass }),
  deleteRemote: (name: string) => invoke("delete_remote", { name }),
  getAvailableDrives: () => invoke<string[]>("get_available_drives"),
};

export const network = {
  pingHost: (ip: string, timeoutMs: number = 1000) =>
    invoke<boolean>("ping_host", { ip, timeoutMs }),
  pingPort: (ip: string, port: number, timeoutMs: number = 1000) =>
    invoke<boolean>("ping_port", { ip, port, timeoutMs }),
  detectNetworkMode: (localIp: string, port: number) =>
    invoke<string>("detect_network_mode", { localIp, port }),
};

export const system = {
  installRclone: () => invoke("install_rclone"),
  installWinfsp: () => invoke("install_winfsp"),
  refreshPath: () => invoke("refresh_path"),
  openRcloneWebUi: () => invoke("open_rclone_web_ui"),
};

export interface SpeedTestResult {
  upload_mbps: number;
  download_mbps: number;
  latency_ms: number;
  test_duration_secs: number;
  file_size_mb: number;
  bottleneck: string;
  network_type: string;
}

export interface NetworkPathInfo {
  is_local: boolean;
  is_vpn: boolean;
  hops: Array<{ hop_number: number; ip: string; latency_ms: number }>;
  total_latency_ms: number;
}

export const speedtest = {
  runSpeedTest: (driveLetter: string, fileSizeMb: number) =>
    invoke<SpeedTestResult>("run_speed_test", { driveLetter, fileSizeMb }),
  analyzeNetworkPath: (targetIp: string) =>
    invoke<NetworkPathInfo>("analyze_network_path", { targetIp }),
  testLocalDiskSpeed: () => invoke<number>("test_local_disk_speed"),
};

// Speed testing and diagnostics commands

use std::fs::{self, File};
use std::io::{Write, Read};
use std::time::{Instant, Duration};
use std::path::PathBuf;
use tauri::command;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeedTestResult {
    pub upload_mbps: f64,
    pub download_mbps: f64,
    pub latency_ms: u64,
    pub test_duration_secs: u64,
    pub file_size_mb: u64,
    pub bottleneck: String, // "network", "client_disk", "server_disk", "rclone_overhead"
    pub network_type: String, // "local" or "internet"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkPathInfo {
    pub is_local: bool,
    pub is_vpn: bool,
    pub hops: Vec<NetworkHop>,
    pub total_latency_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkHop {
    pub hop_number: u32,
    pub ip: String,
    pub latency_ms: u64,
}

#[command]
pub async fn run_speed_test(
    drive_letter: String,
    file_size_mb: u64,
) -> Result<SpeedTestResult, String> {
    let mount_path = format!("{}:\\", drive_letter);
    let test_file_name = ".__rclone_speedtest__.bin";
    let test_file_path = format!("{}\\{}", mount_path, test_file_name);

    // Generate random data
    let file_size_bytes = file_size_mb * 1024 * 1024;
    let data = vec![0u8; file_size_bytes as usize];

    // === UPLOAD TEST ===
    let upload_start = Instant::now();
    let mut file = File::create(&test_file_path)
        .map_err(|e| format!("Failed to create test file: {}", e))?;
    file.write_all(&data)
        .map_err(|e| format!("Failed to write test file: {}", e))?;
    file.sync_all()
        .map_err(|e| format!("Failed to sync test file: {}", e))?;
    let upload_duration = upload_start.elapsed();

    // === DOWNLOAD TEST ===
    let download_start = Instant::now();
    let mut file = File::open(&test_file_path)
        .map_err(|e| format!("Failed to open test file: {}", e))?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)
        .map_err(|e| format!("Failed to read test file: {}", e))?;
    let download_duration = download_start.elapsed();

    // Clean up test file
    fs::remove_file(&test_file_path)
        .map_err(|e| format!("Failed to remove test file: {}", e))?;

    // Calculate speeds in Mbps
    let upload_mbps = (file_size_bytes as f64 * 8.0) / upload_duration.as_secs_f64() / 1_000_000.0;
    let download_mbps = (file_size_bytes as f64 * 8.0) / download_duration.as_secs_f64() / 1_000_000.0;

    // Simple bottleneck detection
    let bottleneck = if upload_mbps < 100.0 && download_mbps < 100.0 {
        "network"
    } else if upload_mbps > 500.0 && download_mbps > 500.0 {
        "none" // Fast connection
    } else if upload_mbps < download_mbps * 0.5 {
        "rclone_overhead"
    } else {
        "client_disk"
    };

    Ok(SpeedTestResult {
        upload_mbps,
        download_mbps,
        latency_ms: 0, // Will be measured separately with ping
        test_duration_secs: (upload_duration + download_duration).as_secs(),
        file_size_mb,
        bottleneck: bottleneck.to_string(),
        network_type: "unknown".to_string(), // Will be determined by network path analysis
    })
}

#[command]
pub async fn analyze_network_path(target_ip: String) -> Result<NetworkPathInfo, String> {
    // Simple local network detection (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    let is_local = is_local_ip(&target_ip);

    // VPN detection: Tailscale uses 100.x.x.x range
    let is_vpn = target_ip.starts_with("100.");

    // For now, return a simplified result
    // Full traceroute implementation would require platform-specific code
    Ok(NetworkPathInfo {
        is_local,
        is_vpn,
        hops: vec![], // Would populate with actual traceroute data
        total_latency_ms: 0,
    })
}

#[command]
pub async fn test_local_disk_speed() -> Result<f64, String> {
    // Test local disk I/O speed to compare against network mount
    let temp_dir = std::env::temp_dir();
    let test_file = temp_dir.join(".__rclone_disk_test__.bin");

    let file_size_mb = 100;
    let file_size_bytes = file_size_mb * 1024 * 1024;
    let data = vec![0u8; file_size_bytes as usize];

    // Write test
    let start = Instant::now();
    let mut file = File::create(&test_file)
        .map_err(|e| format!("Failed to create disk test file: {}", e))?;
    file.write_all(&data)
        .map_err(|e| format!("Failed to write disk test file: {}", e))?;
    file.sync_all()
        .map_err(|e| format!("Failed to sync disk test file: {}", e))?;
    let write_duration = start.elapsed();

    // Read test
    let start = Instant::now();
    let mut file = File::open(&test_file)
        .map_err(|e| format!("Failed to open disk test file: {}", e))?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)
        .map_err(|e| format!("Failed to read disk test file: {}", e))?;
    let read_duration = start.elapsed();

    // Clean up
    fs::remove_file(&test_file)
        .map_err(|e| format!("Failed to remove disk test file: {}", e))?;

    // Average write and read speed in MB/s
    let write_mbps = (file_size_bytes as f64) / write_duration.as_secs_f64() / 1_000_000.0;
    let read_mbps = (file_size_bytes as f64) / read_duration.as_secs_f64() / 1_000_000.0;
    let avg_mbps = (write_mbps + read_mbps) / 2.0;

    Ok(avg_mbps)
}

fn is_local_ip(ip: &str) -> bool {
    ip.starts_with("192.168.")
        || ip.starts_with("10.")
        || ip.starts_with("172.16.")
        || ip.starts_with("172.17.")
        || ip.starts_with("172.18.")
        || ip.starts_with("172.19.")
        || ip.starts_with("172.20.")
        || ip.starts_with("172.21.")
        || ip.starts_with("172.22.")
        || ip.starts_with("172.23.")
        || ip.starts_with("172.24.")
        || ip.starts_with("172.25.")
        || ip.starts_with("172.26.")
        || ip.starts_with("172.27.")
        || ip.starts_with("172.28.")
        || ip.starts_with("172.29.")
        || ip.starts_with("172.30.")
        || ip.starts_with("172.31.")
}

// Network detection commands

use tauri::command;
use std::net::TcpStream;
use std::time::Duration;

#[command]
pub async fn ping_host(ip: String, timeout_ms: u64) -> Result<bool, String> {
    let timeout = Duration::from_millis(timeout_ms);

    // Try to connect to common ports (80, 443, or the port from the connection)
    // This is a simple TCP connect test, which works better cross-platform than ICMP
    let address = format!("{}:80", ip);

    match TcpStream::connect_timeout(
        &address.parse().map_err(|e| format!("Invalid address: {}", e))?,
        timeout,
    ) {
        Ok(_) => Ok(true),
        Err(_) => {
            // Try port 443 as fallback
            let address_443 = format!("{}:443", ip);
            match TcpStream::connect_timeout(
                &address_443.parse().map_err(|e| format!("Invalid address: {}", e))?,
                timeout,
            ) {
                Ok(_) => Ok(true),
                Err(_) => Ok(false),
            }
        }
    }
}

#[command]
pub async fn ping_port(ip: String, port: u16, timeout_ms: u64) -> Result<bool, String> {
    let timeout = Duration::from_millis(timeout_ms);
    let address = format!("{}:{}", ip, port);

    match TcpStream::connect_timeout(
        &address.parse().map_err(|e| format!("Invalid address: {}", e))?,
        timeout,
    ) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[command]
pub async fn detect_network_mode(local_ip: String, port: u16) -> Result<String, String> {
    // Ping the local IP with a short timeout
    let is_local_reachable = ping_port(local_ip, port, 1000).await?;

    if is_local_reachable {
        Ok("local".to_string())
    } else {
        Ok("tailscale".to_string())
    }
}

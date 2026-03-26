// Network detection commands

use tauri::command;
use tauri::Emitter;
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

#[derive(Debug, serde::Serialize)]
pub struct ConnectionTestResult {
    pub local_reachable: Option<bool>,
    pub local_ip: String,
    pub tailscale_reachable: Option<bool>,
    pub tailscale_ip: String,
    pub active_url_reachable: Option<bool>,
    pub active_url: String,
    pub local_error: Option<String>,
    pub tailscale_error: Option<String>,
}

#[command]
pub async fn test_connection(
    connection_json: String,
    active_url: Option<String>,
) -> Result<ConnectionTestResult, String> {
    let connection: crate::config::Connection = serde_json::from_str(&connection_json)
        .map_err(|e| format!("Invalid connection data: {}", e))?;

    let port = connection.port;
    let local_ip = connection.local_ip.clone();
    let tailscale_ip = connection.tailscale_ip.clone();

    // Test local IP
    let (local_reachable, local_error) = if !local_ip.is_empty() {
        match ping_port(local_ip.clone(), port, 3000).await {
            Ok(true) => (Some(true), None),
            Ok(false) => (Some(false), Some(format!("{}:{} did not respond within 3s", local_ip, port))),
            Err(e) => (Some(false), Some(e)),
        }
    } else {
        (None, None)
    };

    // Test tailscale IP
    let (tailscale_reachable, tailscale_error) = if !tailscale_ip.is_empty() {
        match ping_port(tailscale_ip.clone(), port, 3000).await {
            Ok(true) => (Some(true), None),
            Ok(false) => (Some(false), Some(format!("{}:{} did not respond within 3s", tailscale_ip, port))),
            Err(e) => (Some(false), Some(e)),
        }
    } else {
        (None, None)
    };

    // Test active URL if mount is active
    let (active_url_reachable, active_url_str) = if let Some(ref url) = active_url {
        let stripped = url.replace("http://", "").replace("https://", "");
        let parts: Vec<&str> = stripped.split(':').collect();
        if parts.len() == 2 {
            let ip = parts[0].to_string();
            let p: u16 = parts[1].parse().unwrap_or(80);
            let reachable = ping_port(ip, p, 3000).await.unwrap_or(false);
            (Some(reachable), url.clone())
        } else {
            (None, url.clone())
        }
    } else {
        (None, String::new())
    };

    Ok(ConnectionTestResult {
        local_reachable,
        local_ip,
        tailscale_reachable,
        tailscale_ip,
        active_url_reachable,
        active_url: active_url_str,
        local_error,
        tailscale_error,
    })
}

#[cfg(target_os = "windows")]
pub fn start_network_monitor(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        loop {
            // NotifyAddrChange with synchronous blocking — zero CPU while waiting
            unsafe {
                let mut handle = windows::Win32::Foundation::HANDLE::default();
                let result = windows::Win32::NetworkManagement::IpHelper::NotifyAddrChange(
                    &mut handle,
                    std::ptr::null(),
                );
                if result != 0 {
                    // If the API fails, fall back to polling every 30s
                    std::thread::sleep(std::time::Duration::from_secs(30));
                    app.emit("network-changed", ()).ok();
                    continue;
                }
            }

            // Debounce — network changes often fire multiple rapid events
            std::thread::sleep(std::time::Duration::from_secs(2));

            // Emit event to frontend
            app.emit("network-changed", ()).ok();
        }
    });
}

#[cfg(not(target_os = "windows"))]
pub fn start_network_monitor(_app: tauri::AppHandle) {
    // Network change detection not supported on non-Windows platforms
}

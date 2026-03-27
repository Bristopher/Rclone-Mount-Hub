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

// HANDLE is *mut c_void which is !Send, but we only use it from the monitor thread
// after storing it. Safety: we never dereference concurrently without synchronization.
#[cfg(target_os = "windows")]
struct SendHandle(windows::Win32::Foundation::HANDLE);
#[cfg(target_os = "windows")]
unsafe impl Send for SendHandle {}
#[cfg(target_os = "windows")]
unsafe impl Sync for SendHandle {}

#[cfg(target_os = "windows")]
static CANCEL_EVENT: std::sync::OnceLock<SendHandle> = std::sync::OnceLock::new();

/// Signal the network monitor thread to exit cleanly.
/// Call this before process exit so the blocked thread can wake and return.
#[cfg(target_os = "windows")]
pub fn stop_network_monitor() {
    if let Some(ev) = CANCEL_EVENT.get() {
        unsafe {
            let _ = windows::Win32::System::Threading::SetEvent(ev.0);
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn stop_network_monitor() {}

#[cfg(target_os = "windows")]
pub fn start_network_monitor(app: tauri::AppHandle) {
    use windows::Win32::Foundation::{CloseHandle, HANDLE, WAIT_OBJECT_0};
    use windows::Win32::NetworkManagement::IpHelper::{CancelIPChangeNotify, NotifyAddrChange};
    use windows::Win32::System::IO::OVERLAPPED;
    use windows::Win32::System::Threading::{CreateEventW, WaitForMultipleObjects, INFINITE};

    // Manual-reset event used to signal the thread to stop
    let cancel_event = unsafe {
        CreateEventW(None, true, false, None)
            .expect("Failed to create cancel event for network monitor")
    };
    // Store in the global BEFORE spawning the thread so the thread can retrieve it
    CANCEL_EVENT.set(SendHandle(cancel_event)).ok();

    std::thread::spawn(move || {
        // Retrieve the cancel handle from the global — avoids moving !Send HANDLE across thread boundary
        let cancel_event = CANCEL_EVENT.get().unwrap().0;

        loop {
            // Auto-reset event that NotifyAddrChange will signal on network change
            let notify_event = unsafe {
                CreateEventW(None, false, false, None)
                    .expect("Failed to create notify event")
            };

            let mut notify_handle = HANDLE::default();
            let mut overlapped = OVERLAPPED::default();
            overlapped.hEvent = notify_event;

            unsafe {
                // Overlapped (async) form — returns immediately with ERROR_IO_PENDING
                let _ = NotifyAddrChange(&mut notify_handle, &overlapped as *const OVERLAPPED);

                // Wait for either a network change or the cancel signal
                let handles = [notify_event, cancel_event];
                let result = WaitForMultipleObjects(&handles, false, INFINITE);

                let _ = CloseHandle(notify_event);

                // index 0 (WAIT_OBJECT_0) = notify fired, index 1 = cancel fired
                if result.0 == WAIT_OBJECT_0.0 + 1 {
                    let _ = CancelIPChangeNotify(&overlapped);
                    return;
                }
            }

            // Debounce: network events often fire in rapid bursts.
            // Sleep in short chunks so we can still respond to cancel quickly.
            for _ in 0..20 {
                std::thread::sleep(std::time::Duration::from_millis(100));
                unsafe {
                    let r = windows::Win32::System::Threading::WaitForSingleObject(
                        cancel_event,
                        0,
                    );
                    if r == WAIT_OBJECT_0 {
                        return;
                    }
                }
            }

            app.emit("network-changed", ()).ok();
        }
    });
}

#[cfg(not(target_os = "windows"))]
pub fn start_network_monitor(_app: tauri::AppHandle) {
    // Network change detection not supported on non-Windows platforms
}

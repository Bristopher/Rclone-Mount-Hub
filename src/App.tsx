import { useState, useEffect } from "react";
import { Toaster } from "sonner";
import { AppLayout } from "./components/layout/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { AddConnection } from "./pages/AddConnection";
import { EditConnection } from "./pages/EditConnection";
import { Settings } from "./pages/Settings";
import { Export } from "./pages/Export";
import { SpeedTest } from "./pages/SpeedTest";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore, useConnectionStore } from "./lib/store";
import type { Connection } from "./lib/types";

interface UpdateInfo {
  version: string;
  releaseNotes: string | null;
  downloadSize: number | null;
}

function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [quitting, setQuitting] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const { settings } = useSettingsStore();
  const { connections } = useConnectionStore();

  const navigateTo = (page: string, connectionId?: string) => {
    if (page === "edit" && connectionId) {
      const conn = connections.find((c) => c.id === connectionId);
      if (conn) {
        setEditingConnection(conn);
        setCurrentPage("edit");
      }
    } else {
      setCurrentPage(page);
    }
  };

  // Sync rclone config path to Rust on startup (so all commands use the right file)
  useEffect(() => {
    invoke("set_rclone_config_path", { path: settings.rclone_config_path }).catch(console.error);
  }, [settings.rclone_config_path]);

  // Ctrl+close from Rust: show quit animation then exit
  useEffect(() => {
    const unlisten = listen("quit-requested", () => {
      setQuitting(true);
      setTimeout(() => invoke("full_quit"), 700);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // Listen for network change events from Rust backend
  useEffect(() => {
    const unlisten = listen("network-changed", () => {
      window.dispatchEvent(new CustomEvent("network-changed"));
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // Check for app updates on startup
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const result = await invoke<{
          available: boolean;
          version: string | null;
          release_notes: string | null;
          download_size: number | null;
        }>("check_app_update");
        if (result.available && result.version) {
          setUpdateInfo({
            version: result.version,
            releaseNotes: result.release_notes,
            downloadSize: result.download_size,
          });
        }
      } catch {
        // Silently fail — user can manually check in Settings
      }
    };
    const timer = setTimeout(checkUpdate, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Listen for download progress events
  useEffect(() => {
    const unlisten = listen<number>("update-download-progress", (event) => {
      setDownloadProgress(event.payload);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  const handleApplyUpdate = async () => {
    setUpdating(true);
    setDownloadProgress(0);
    try {
      await invoke("apply_app_update");
      // apply_updates_and_restart restarts the app — this line won't be reached
    } catch {
      setUpdating(false);
      setDownloadProgress(null);
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard onNavigate={navigateTo} />;
      case "add":
        return <AddConnection onNavigate={navigateTo} />;
      case "edit":
        return editingConnection
          ? <EditConnection connection={editingConnection} onNavigate={navigateTo} />
          : <Dashboard onNavigate={navigateTo} />;
      case "settings":
        return <Settings />;
      case "export":
        return <Export />;
      case "speedtest":
        return <SpeedTest />;
      default:
        return <Dashboard onNavigate={navigateTo} />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      {/* Persistent update banner */}
      {updateInfo && !updateDismissed && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-accent-blue/90 to-indigo-600/90 backdrop-blur-sm border-b border-white/10 shadow-lg" data-tauri-drag-region>
          <div className="px-4 py-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-[13px] font-medium text-white">
                <span>v{updateInfo.version} available</span>
                {updateInfo.downloadSize && (
                  <span className="text-white/60 text-[11px]">
                    ({formatBytes(updateInfo.downloadSize)})
                  </span>
                )}
              </div>
              {updateInfo.releaseNotes && !updating && (
                <div className="text-[11px] text-white/70 truncate mt-0.5">
                  {updateInfo.releaseNotes.split("\n")[0].replace(/^#+\s*/, "")}
                </div>
              )}
              {updating && downloadProgress !== null && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-white transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-white/80 font-mono w-8 text-right">
                    {downloadProgress}%
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!updating ? (
                <>
                  <button
                    onClick={handleApplyUpdate}
                    className="px-3 py-1 rounded-md bg-white text-indigo-700 text-[12px] font-semibold hover:bg-white/90 transition-colors"
                  >
                    Update & Restart
                  </button>
                  <button
                    onClick={() => setUpdateDismissed(true)}
                    className="text-white/60 hover:text-white transition-colors text-[18px] leading-none px-1"
                  >
                    &times;
                  </button>
                </>
              ) : (
                <span className="text-[12px] text-white/80 font-medium">
                  {downloadProgress !== null && downloadProgress >= 100 ? "Restarting..." : "Downloading..."}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
      <AppLayout currentPage={currentPage} onNavigate={navigateTo}>
        {/* Push content down when banner is showing */}
        {updateInfo && !updateDismissed && <div className="h-[52px]" />}
        {renderPage()}
      </AppLayout>
      <Toaster position="bottom-right" theme="dark" />

      {/* Ctrl+Close full-quit overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          opacity: quitting ? 1 : 0,
          pointerEvents: quitting ? "all" : "none",
          transition: "opacity 0.2s ease",
        }}
      >
        <div
          style={{
            background: "rgba(20,20,28,0.95)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "16px",
            padding: "32px 48px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
            transform: quitting ? "scale(1)" : "scale(0.85)",
            transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {/* Spinning ring */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "3px solid rgba(255,255,255,0.1)",
              borderTopColor: "#6366f1",
              animation: quitting ? "spin 0.7s linear infinite" : "none",
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ color: "#fff", fontSize: "15px", fontWeight: 600, letterSpacing: "0.01em" }}>
            Quitting Rclone Mount Hub
          </div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>
            Ctrl + Close
          </div>
        </div>
      </div>
    </>
  );
}

export default App;

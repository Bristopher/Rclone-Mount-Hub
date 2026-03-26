import { useState, useEffect } from "react";
import { Toaster } from "sonner";
import { AppLayout } from "./components/layout/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { AddConnection } from "./pages/AddConnection";
import { EditConnection } from "./pages/EditConnection";
import { Settings } from "./pages/Settings";
import { Export } from "./pages/Export";
import { SpeedTest } from "./pages/SpeedTest";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore, useConnectionStore } from "./lib/store";
import type { Connection } from "./lib/types";

function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
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

  // Handle close to tray
  useEffect(() => {
    const appWindow = getCurrentWindow();

    const unlisten = appWindow.onCloseRequested(async (event) => {
      if (settings.close_to_tray) {
        // Prevent default close and hide instead
        event.preventDefault();
        await invoke("hide_window");
      }
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [settings.close_to_tray]);

  // Listen for network change events from Rust backend
  useEffect(() => {
    const unlisten = listen("network-changed", () => {
      window.dispatchEvent(new CustomEvent("network-changed"));
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

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

  return (
    <>
      <AppLayout currentPage={currentPage} onNavigate={navigateTo}>
        {renderPage()}
      </AppLayout>
      <Toaster position="bottom-right" theme="dark" />
    </>
  );
}

export default App;

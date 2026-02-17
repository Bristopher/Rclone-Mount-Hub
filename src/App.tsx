import { useState, useEffect } from "react";
import { Toaster } from "sonner";
import { AppLayout } from "./components/layout/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { AddConnection } from "./pages/AddConnection";
import { Settings } from "./pages/Settings";
import { Export } from "./pages/Export";
import { SpeedTest } from "./pages/SpeedTest";
import { LogPanel } from "./components/LogPanel";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "./lib/store";

function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const { settings } = useSettingsStore();

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

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard onNavigate={setCurrentPage} />;
      case "add":
        return <AddConnection onNavigate={setCurrentPage} />;
      case "settings":
        return <Settings />;
      case "export":
        return <Export />;
      case "speedtest":
        return <SpeedTest />;
      default:
        return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  return (
    <>
      <AppLayout currentPage={currentPage} onNavigate={setCurrentPage}>
        {renderPage()}
      </AppLayout>
      <Toaster position="bottom-right" theme="dark" />
    </>
  );
}

export default App;

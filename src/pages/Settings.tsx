import { useEffect, useState } from "react";
import {
  Gear,
  Rocket,
  Lightning,
  Globe,
  Bell,
  ArrowsClockwise,
  HardDrives,
  Download,
  Trash,
  CloudArrowUp,
  FolderOpen,
  File,
  AppWindow,
  Info,
  CheckCircle,
  WarningCircle,
} from "phosphor-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { DriverCardSkeleton } from "../components/ui/Skeleton";
import { useSettingsStore } from "../lib/store";
import { useLogStore } from "../lib/logStore";
import { Check } from "phosphor-react";
import type { SpeedProfile, NetworkMode } from "../lib/types";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { open as openFilePicker } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";

interface DriverVersions {
  rclone_installed: boolean;
  rclone_version: string | null;
  winfsp_installed: boolean;
  winfsp_version: string | null;
}

export function Settings() {
  const { settings, update, reset } = useSettingsStore();
  const { addLog } = useLogStore();
  const [driverVersions, setDriverVersions] = useState<DriverVersions | null>(null);
  const [driversLoading, setDriversLoading] = useState(true);
  const [installingDrivers, setInstallingDrivers] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [winfspInstallerLaunched, setWinfspInstallerLaunched] = useState(false);
  const [verifyingWinfsp, setVerifyingWinfsp] = useState(false);
  const [defaultConfigPath, setDefaultConfigPath] = useState("");
  const [appVersion, setAppVersion] = useState("");
  const [updateStatus, setUpdateStatus] = useState<"idle" | "checking" | "available" | "up-to-date" | "updating">("idle");
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);

  useEffect(() => {
    loadDriverVersions();
    syncAutostart();
    invoke<string>("get_default_rclone_config_path").then(setDefaultConfigPath).catch(() => {});
    getVersion().then(setAppVersion).catch(() => setAppVersion("unknown"));
  }, []);

  const syncAutostart = async () => {
    try {
      const enabled = await invoke<boolean>("is_autostart_enabled");
      if (enabled !== settings.start_with_windows) {
        update({ start_with_windows: enabled });
      }
    } catch (err) {
      console.error("Failed to check autostart status:", err);
    }
  };

  const handleToggleAutostart = async (enabled: boolean) => {
    try {
      if (enabled) {
        await invoke("enable_autostart", { minimized: settings.start_minimized });
      } else {
        await invoke("disable_autostart");
      }
      update({ start_with_windows: enabled });
      toast.success(enabled ? "Autostart enabled" : "Autostart disabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle autostart");
    }
  };

  const handleBrowseConfigPath = async () => {
    const selected = await openFilePicker({
      title: "Select Rclone Config File",
      filters: [{ name: "Rclone Config", extensions: ["conf"] }],
    });
    if (selected && typeof selected === "string") {
      update({ rclone_config_path: selected });
      await invoke("set_rclone_config_path", { path: selected });
      toast.success("Rclone config path updated");
    }
  };

  const handleResetConfigPath = async () => {
    update({ rclone_config_path: "" });
    await invoke("set_rclone_config_path", { path: "" });
    toast.success("Reset to rclone default config path");
  };

  const handleAddToStartMenu = async () => {
    try {
      await invoke("add_to_start_menu");
      toast.success("Added to Start Menu — notifications will now show 'Rclone Mount Hub'");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add to Start Menu");
    }
  };

  const loadDriverVersions = async () => {
    setDriversLoading(true);
    try {
      const versions = await invoke<DriverVersions>("get_driver_versions");
      setDriverVersions(versions);
    } catch (err) {
      console.error("Failed to get driver versions:", err);
    } finally {
      setDriversLoading(false);
    }
  };

  const handleInstallRclone = async () => {
    setInstallingDrivers(true);
    addLog("info", "Installing Rclone via Scoop...", "drivers");
    try {
      await invoke("install_rclone");
      addLog("success", "✓ Rclone installed successfully", "drivers");
      toast.success("Rclone installed successfully");
      await loadDriverVersions();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to install Rclone";
      addLog("error", `✗ ${errorMsg}`, "drivers");
      toast.error(errorMsg);
    } finally {
      setInstallingDrivers(false);
    }
  };

  const handleDownloadWinfsp = async () => {
    setInstallingDrivers(true);
    addLog("info", "Fetching latest WinFsp release from GitHub...", "drivers");
    try {
      const version = await invoke<string>("download_and_launch_winfsp_installer");
      addLog("success", `✓ WinFsp ${version} installer downloaded and launched`, "drivers");
      addLog("info", "Complete the installation wizard, then click \"I've Installed WinFsp\"", "drivers");
      toast.success(`WinFsp ${version} installer launched — complete the wizard then click Continue`);
      setWinfspInstallerLaunched(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to download WinFsp";
      addLog("error", `✗ ${errorMsg}`, "drivers");
      toast.error(errorMsg);
    } finally {
      setInstallingDrivers(false);
    }
  };

  const handleVerifyWinfsp = async () => {
    setVerifyingWinfsp(true);
    addLog("info", "Verifying WinFsp installation...", "drivers");
    try {
      await loadDriverVersions();
      const versions = await invoke<DriverVersions>("get_driver_versions");
      if (versions.winfsp_installed) {
        addLog("success", "✓ WinFsp detected and ready!", "drivers");
        toast.success("WinFsp is installed and ready!");
        setWinfspInstallerLaunched(false);
      } else {
        addLog("warning", "WinFsp not detected yet — finish the installer wizard and try again", "drivers");
        toast.error("WinFsp not detected yet. Please complete the installer first.");
      }
    } catch (err) {
      addLog("error", "✗ Failed to verify WinFsp", "drivers");
    } finally {
      setVerifyingWinfsp(false);
    }
  };

  const handleUninstallRclone = async () => {
    try {
      await invoke("uninstall_rclone");
      toast.success("Rclone uninstalled");
      await loadDriverVersions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to uninstall Rclone");
    }
  };

  const handleUninstallWinFsp = async () => {
    try {
      await invoke("uninstall_winfsp");
      toast.success("WinFsp uninstalled");
      await loadDriverVersions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to uninstall WinFsp");
    }
  };

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    addLog("info", "Checking for driver updates...", "drivers");
    try {
      const result = await invoke<string>("check_driver_updates");
      addLog("success", `✓ ${result}`, "drivers");
      toast.info(result);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to check for updates";
      addLog("error", `✗ ${errorMsg}`, "drivers");
      toast.error(errorMsg);
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleCheckAppUpdate = async () => {
    setUpdateStatus("checking");
    try {
      const result = await invoke<{ available: boolean; version: string | null }>("check_app_update");
      if (result.available && result.version) {
        setAvailableVersion(result.version);
        setUpdateStatus("available");
      } else {
        setUpdateStatus("up-to-date");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to check for updates");
      setUpdateStatus("idle");
    }
  };

  const handleApplyAppUpdate = async () => {
    setUpdateStatus("updating");
    try {
      await invoke("apply_app_update");
      // apply_updates_and_restart restarts the app — this line won't be reached
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply update");
      setUpdateStatus("available");
    }
  };

  const Toggle = ({
    enabled,
    onChange,
  }: {
    enabled: boolean;
    onChange: (value: boolean) => void;
  }) => (
    <button
      onClick={() => onChange(!enabled)}
      className={`
        relative w-11 h-6 rounded-full transition-all duration-200
        ${
          enabled
            ? "bg-accent-blue shadow-[0_0_8px_rgba(59,130,246,0.3)]"
            : "bg-white/[0.15]"
        }
      `}
    >
      <div
        className={`
          absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200
          ${enabled ? "left-[22px]" : "left-0.5"}
        `}
      />
    </button>
  );

  return (
    <div className="h-full overflow-y-auto content-scroll">
      <div className="px-10 py-8 pb-12 max-w-3xl w-full mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight mb-2 flex items-center gap-3">
            <Gear size={28} weight="duotone" className="text-accent-blue" />
            Settings
          </h1>
          <p className="text-[13px] text-text-secondary">
            Configure application preferences and defaults
          </p>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* Section A - Startup */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-5 flex items-center gap-2">
              <Rocket size={18} weight="duotone" className="text-accent-green" />
              Startup Behavior
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-1">
                <div>
                  <div className="text-[13px] font-medium text-text-primary mb-0.5">
                    Start with Windows
                  </div>
                  <div className="text-[11px] text-text-tertiary">
                    Launch Rclone Mounter when your computer starts
                  </div>
                </div>
                <Toggle
                  enabled={settings.start_with_windows}
                  onChange={handleToggleAutostart}
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <div>
                  <div className="text-[13px] font-medium text-text-primary mb-0.5">
                    Start minimized
                  </div>
                  <div className="text-[11px] text-text-tertiary">
                    Open to system tray instead of showing the window
                  </div>
                </div>
                <Toggle
                  enabled={settings.start_minimized}
                  onChange={async (val) => {
                    update({ start_minimized: val });
                    // Keep registry entry in sync if autostart is enabled
                    if (settings.start_with_windows) {
                      await invoke("enable_autostart", { minimized: val }).catch(() => {});
                    }
                  }}
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <div>
                  <div className="text-[13px] font-medium text-text-primary mb-0.5">
                    Close to tray
                  </div>
                  <div className="text-[11px] text-text-tertiary">
                    Minimize to tray instead of closing completely
                  </div>
                </div>
                <Toggle
                  enabled={settings.close_to_tray}
                  onChange={(val) => update({ close_to_tray: val })}
                />
              </div>

              <div className="h-px bg-white/[0.06] my-1" />

              <div className="flex items-center justify-between py-1">
                <div>
                  <div className="text-[13px] font-medium text-text-primary mb-0.5">
                    Add to Start Menu
                  </div>
                  <div className="text-[11px] text-text-tertiary">
                    Creates a Start Menu shortcut and registers the app so toast
                    notifications show "Rclone Mount Hub" instead of "Windows PowerShell"
                  </div>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleAddToStartMenu}
                  className="gap-1.5 shrink-0 ml-4"
                >
                  <AppWindow size={14} weight="bold" />
                  Add to Start Menu
                </Button>
              </div>
            </div>
          </Card>

          {/* Section B - Performance Defaults */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Lightning
                size={18}
                weight="duotone"
                className="text-accent-amber"
              />
              Default Performance Profile
            </h2>
            <p className="text-[11px] text-text-tertiary mb-4">
              Used for new connections unless changed
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  value: "max" as SpeedProfile,
                  label: "Max",
                  desc: "10Gbps LAN",
                },
                {
                  value: "balanced" as SpeedProfile,
                  label: "Balanced",
                  desc: "Daily use",
                },
                {
                  value: "low" as SpeedProfile,
                  label: "Low",
                  desc: "Battery mode",
                },
              ].map((profile) => (
                <button
                  key={profile.value}
                  onClick={() =>
                    update({ default_speed_profile: profile.value })
                  }
                  className={`
                    p-3 rounded-lg border transition-all duration-150 text-left
                    ${
                      settings.default_speed_profile === profile.value
                        ? "bg-accent-amber/10 border-accent-amber/40 shadow-[0_0_12px_rgba(251,191,36,0.15)]"
                        : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05]"
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[13px] font-medium ${
                        settings.default_speed_profile === profile.value
                          ? "text-accent-amber"
                          : "text-text-primary"
                      }`}
                    >
                      {profile.label}
                    </span>
                    {settings.default_speed_profile === profile.value && (
                      <Check size={14} weight="bold" className="text-accent-amber" />
                    )}
                  </div>
                  <span className="text-[11px] text-text-tertiary">
                    {profile.desc}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          {/* Section C - Network Defaults */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Globe size={18} weight="duotone" className="text-accent-purple" />
              Default Network Mode
            </h2>
            <p className="text-[11px] text-text-tertiary mb-4">
              Used for new connections unless changed
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  value: "auto" as NetworkMode,
                  label: "Auto",
                  desc: "Smart switch",
                },
                {
                  value: "local" as NetworkMode,
                  label: "LAN Only",
                  desc: "Local network",
                },
                {
                  value: "tailscale" as NetworkMode,
                  label: "Tailscale",
                  desc: "Remote access",
                },
              ].map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => update({ default_network_mode: mode.value })}
                  className={`
                    p-3 rounded-lg border transition-all duration-150 text-left
                    ${
                      settings.default_network_mode === mode.value
                        ? "bg-accent-purple/10 border-accent-purple/40 shadow-[0_0_12px_rgba(168,85,247,0.15)]"
                        : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05]"
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[13px] font-medium ${
                        settings.default_network_mode === mode.value
                          ? "text-accent-purple"
                          : "text-text-primary"
                      }`}
                    >
                      {mode.label}
                    </span>
                    {settings.default_network_mode === mode.value && (
                      <Check size={14} weight="bold" className="text-accent-purple" />
                    )}
                  </div>
                  <span className="text-[11px] text-text-tertiary">
                    {mode.desc}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          {/* Section D - Notifications */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-5 flex items-center gap-2">
              <Bell size={18} weight="duotone" className="text-accent-blue" />
              Notifications
            </h2>
            <div className="flex items-center justify-between py-1">
              <div>
                <div className="text-[13px] font-medium text-text-primary mb-0.5">
                  Show mount/unmount notifications
                </div>
                <div className="text-[11px] text-text-tertiary">
                  Display system notifications when drives connect or disconnect
                </div>
              </div>
              <Toggle
                enabled={settings.show_notifications}
                onChange={(val) => update({ show_notifications: val })}
              />
            </div>
          </Card>

          {/* Section E - Rclone Config Path */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-5 flex items-center gap-2">
              <File size={18} weight="duotone" className="text-accent-purple" />
              Rclone Config File
            </h2>
            <p className="text-[11px] text-text-tertiary mb-4">
              By default rclone uses its own config file location. Set a custom path if you use a different config file.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={settings.rclone_config_path}
                  onChange={(e) => update({ rclone_config_path: e.target.value })}
                  onBlur={() => invoke("set_rclone_config_path", { path: settings.rclone_config_path }).catch(() => {})}
                  placeholder={defaultConfigPath || "%APPDATA%\\rclone\\rclone.conf"}
                  className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue/50 font-mono"
                />
                <Button variant="ghost" size="sm" onClick={handleBrowseConfigPath} className="gap-1.5 shrink-0">
                  <FolderOpen size={15} weight="bold" />
                  Browse
                </Button>
              </div>
              {settings.rclone_config_path && (
                <Button variant="ghost" size="sm" onClick={handleResetConfigPath} className="gap-1.5 text-text-tertiary">
                  <ArrowsClockwise size={13} weight="bold" />
                  Reset to rclone default
                </Button>
              )}
              {!settings.rclone_config_path && defaultConfigPath && (
                <p className="text-[11px] text-text-tertiary">
                  Using default: <span className="font-mono text-text-secondary">{defaultConfigPath}</span>
                </p>
              )}
            </div>
          </Card>

          {/* Section F - Driver Management */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-5 flex items-center gap-2">
              <HardDrives size={18} weight="duotone" className="text-accent-red" />
              Driver Management
            </h2>

            {driversLoading ? (
              <DriverCardSkeleton />
            ) : driverVersions ? (
              <div className="space-y-4">
                {/* Driver Status */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Rclone */}
                  <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-medium text-text-secondary">
                        Rclone
                      </span>
                      {driverVersions.rclone_installed ? (
                        <Badge variant="connected">Installed</Badge>
                      ) : (
                        <Badge variant="disconnected">Not Installed</Badge>
                      )}
                    </div>
                    <div className="text-sm text-text-primary">
                      {driverVersions.rclone_version || "—"}
                    </div>
                    {driverVersions.rclone_installed && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleUninstallRclone}
                        className="gap-1.5 mt-2"
                      >
                        <Trash size={14} weight="bold" />
                        Uninstall
                      </Button>
                    )}
                  </div>

                  {/* WinFsp */}
                  <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-medium text-text-secondary">
                        WinFsp
                      </span>
                      {driverVersions.winfsp_installed ? (
                        <Badge variant="connected">Installed</Badge>
                      ) : (
                        <Badge variant="disconnected">Not Installed</Badge>
                      )}
                    </div>
                    <div className="text-sm text-text-primary">
                      {driverVersions.winfsp_version || "—"}
                    </div>
                    {driverVersions.winfsp_installed && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleUninstallWinFsp}
                        className="gap-1.5 mt-2"
                      >
                        <Trash size={14} weight="bold" />
                        Uninstall
                      </Button>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Rclone install/update */}
                  {!driverVersions.rclone_installed && (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleInstallRclone}
                      disabled={installingDrivers}
                      className="gap-2"
                    >
                      {installingDrivers ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Installing...
                        </>
                      ) : (
                        <>
                          <Download size={16} weight="bold" />
                          Install Rclone (Scoop)
                        </>
                      )}
                    </Button>
                  )}

                  {/* WinFsp install or verify */}
                  {!driverVersions.winfsp_installed && !winfspInstallerLaunched && (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleDownloadWinfsp}
                      disabled={installingDrivers}
                      className="gap-2"
                    >
                      {installingDrivers ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <Download size={16} weight="bold" />
                          Download &amp; Install WinFsp
                        </>
                      )}
                    </Button>
                  )}

                  {/* Continue button after installer is launched */}
                  {winfspInstallerLaunched && (
                    <Button
                      variant="success"
                      size="md"
                      onClick={handleVerifyWinfsp}
                      disabled={verifyingWinfsp}
                      className="gap-2"
                    >
                      {verifyingWinfsp ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <Check size={16} weight="bold" />
                          I've Installed WinFsp
                        </>
                      )}
                    </Button>
                  )}

                  {/* Check for updates (when both installed) */}
                  {driverVersions.rclone_installed && driverVersions.winfsp_installed && (
                    <Button
                      variant="default"
                      size="md"
                      onClick={handleCheckUpdates}
                      disabled={checkingUpdates}
                      className="gap-2"
                    >
                      {checkingUpdates ? (
                        <>
                          <div className="w-4 h-4 border-2 border-text-primary/30 border-t-text-primary rounded-full animate-spin" />
                          Checking...
                        </>
                      ) : (
                        <>
                          <CloudArrowUp size={16} weight="bold" />
                          Check for Updates
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-[13px] text-text-tertiary">
                Could not load driver information.
              </div>
            )}
          </Card>

          {/* Section G - About & Updates */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-5 flex items-center gap-2">
              <Info size={18} weight="duotone" className="text-accent-blue" />
              About &amp; Updates
            </h2>

            <div className="flex items-center justify-between py-1">
              <div>
                <div className="text-[13px] font-medium text-text-primary mb-0.5">
                  Rclone Mount Hub
                </div>
                <div className="text-[11px] text-text-tertiary font-mono">
                  v{appVersion || "…"}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Status badge */}
                {updateStatus === "up-to-date" && (
                  <div className="flex items-center gap-1.5 text-accent-green text-[12px]">
                    <CheckCircle size={14} weight="fill" />
                    Up to date
                  </div>
                )}
                {updateStatus === "available" && availableVersion && (
                  <div className="flex items-center gap-1.5 text-accent-amber text-[12px]">
                    <WarningCircle size={14} weight="fill" />
                    v{availableVersion} available
                  </div>
                )}

                {/* Update & Restart button — only shown when update is ready */}
                {updateStatus === "available" && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleApplyAppUpdate}
                    className="gap-1.5"
                  >
                    <Download size={14} weight="bold" />
                    Update &amp; Restart
                  </Button>
                )}

                {/* Check for Updates button */}
                {updateStatus !== "available" && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleCheckAppUpdate}
                    disabled={updateStatus === "checking" || updateStatus === "updating"}
                    className="gap-1.5"
                  >
                    {updateStatus === "checking" ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-text-primary/30 border-t-text-primary rounded-full animate-spin" />
                        Checking…
                      </>
                    ) : updateStatus === "updating" ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-text-primary/30 border-t-text-primary rounded-full animate-spin" />
                        Updating…
                      </>
                    ) : (
                      <>
                        <CloudArrowUp size={14} weight="bold" />
                        Check for Updates
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="ghost"
              size="md"
              onClick={reset}
              className="gap-2"
            >
              <ArrowsClockwise size={16} weight="bold" />
              Reset to Defaults
            </Button>
            <div className="flex-1" />
            <div className="text-[11px] text-text-tertiary">
              Settings saved automatically
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

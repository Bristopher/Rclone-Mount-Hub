import { useEffect, useRef, useState } from "react";
import {
  Plus,
  HardDrives,
  ArrowsClockwise,
  Lightning,
  WifiHigh,
  Play,
  Stop,
  Warning,
  Trash,
  CloudArrowDown,
  CloudArrowUp,
  DesktopTower,
  PencilSimple,
} from "phosphor-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ConnectionCardSkeleton, StatCardsSkeleton } from "../components/ui/Skeleton";
import { useConnectionStore, useMountSummaryStore, useSettingsStore } from "../lib/store";
import { useLogStore } from "../lib/logStore";
import type { Connection, MountStatus } from "../lib/types";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { DirectUploadModal } from "../components/DirectUploadModal";

interface DashboardProps {
  onNavigate?: (page: string, connectionId?: string) => void;
}

interface DriverVersions {
  rclone_installed: boolean;
  rclone_version: string | null;
  winfsp_installed: boolean;
  winfsp_version: string | null;
}

interface ExternalMount {
  pid: number;
  remote_name: string;
  mount_point: string;
  command_line: string;
}

interface RcloneRemote {
  name: string;
  remote_type: string;
}

export function Dashboard({ onNavigate }: DashboardProps = {}) {
  const { connections, remove, add } = useConnectionStore();
  const { addLog } = useLogStore();
  const { setMountSummary } = useMountSummaryStore();
  const { settings } = useSettingsStore();
  const [mountStatuses, setMountStatuses] = useState<Record<string, MountStatus>>({});
  const [driverVersions, setDriverVersions] = useState<DriverVersions | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [externalMounts, setExternalMounts] = useState<ExternalMount[]>([]);
  const [unmanagedRemotes, setUnmanagedRemotes] = useState<RcloneRemote[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [timeSince, setTimeSince] = useState<string>("");
  const [showUpload, setShowUpload] = useState(false);
  const didAutoMount = useRef(false);

  // Keep the "X seconds/minutes ago" label ticking every 5 s
  useEffect(() => {
    if (!lastRefreshed) return;
    const update = () => {
      const secs = Math.round((Date.now() - lastRefreshed.getTime()) / 1000);
      if (secs < 5) setTimeSince("just now");
      else if (secs < 60) setTimeSince(`${secs}s ago`);
      else setTimeSince(`${Math.floor(secs / 60)}m ago`);
    };
    update();
    const t = setInterval(update, 5000);
    return () => clearInterval(t);
  }, [lastRefreshed]);

  // Run auto-mount exactly once — useRef guard prevents StrictMode double-fire
  useEffect(() => {
    if (!didAutoMount.current) {
      didAutoMount.current = true;
      refreshAll().then(() => autoMountConnections());
    } else {
      refreshAll();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshAll = async () => {
    try {
      await Promise.all([checkDrivers(), refreshStatuses(), refreshExternalMounts()]);
    } finally {
      setInitialLoading(false);
      setLastRefreshed(new Date());
    }
  };

  // Push live counts to the global summary store AND update tray menu
  useEffect(() => {
    const mountedEntries = connections
      .filter((c) => mountStatuses[c.id]?.state === "mounted")
      .map<[string, string]>((c) => [c.name, c.drive_letter]);
    const externalEntries = externalMounts.map<[string, string]>((m) => [
      m.remote_name ? m.remote_name.replace(/:$/, "") : "External",
      m.mount_point.replace(":", ""),
    ]);
    const allEntries = [...mountedEntries, ...externalEntries];

    const total = allEntries.length;
    const mountedVals = Object.values(mountStatuses).filter((s) => s.state === "mounted");
    const network: "local" | "tailscale" | "offline" =
      total === 0
        ? "offline"
        : mountedVals.some((s) => s.active_mode === "local") || externalMounts.length > 0
        ? "local"
        : "tailscale";
    setMountSummary(total, network);

    // Update system tray menu with active mounts
    invoke("update_tray_menu", { mountEntries: allEntries }).catch(console.error);
  }, [mountStatuses, externalMounts, connections, setMountSummary]);

  // Handle network change events
  useEffect(() => {
    const handler = async () => {
      addLog("info", "Network change detected, checking connections...", "network");

      for (const conn of connections) {
        const status = mountStatuses[conn.id];
        if (status?.state !== "mounted" || conn.network_mode !== "auto") continue;

        const activeMode = status.active_mode;
        const localIp = conn.local_ip;
        const tailscaleIp = conn.tailscale_ip;
        const port = conn.port;

        let localReachable = false;
        let tailscaleReachable = false;

        try {
          if (localIp) {
            localReachable = await invoke<boolean>("ping_port", { ip: localIp, port, timeoutMs: 2000 });
          }
          if (tailscaleIp) {
            tailscaleReachable = await invoke<boolean>("ping_port", { ip: tailscaleIp, port, timeoutMs: 2000 });
          }
        } catch {
          continue;
        }

        const needsSwitch =
          (activeMode === "local" && !localReachable && tailscaleReachable) ||
          (activeMode === "tailscale" && localReachable);

        if (!needsSwitch) continue;

        const newMode = localReachable ? "LAN" : "Tailscale";

        if (settings.network_change_mode === "auto_reconnect") {
          addLog("info", `Network changed: remounting ${conn.name} to ${newMode}...`, "network");
          try {
            await invoke("unmount_drive", { connectionId: conn.id });
            const newStatus = await invoke<MountStatus>("mount_drive", {
              connectionJson: JSON.stringify(conn),
              cacheDir: settings.cache_dir || null,
            });
            setMountStatuses(prev => ({ ...prev, [conn.id]: newStatus }));
            addLog("success", `${conn.name} reconnected via ${newMode}`, "network");
            toast.info(`${conn.name} switched to ${newMode}`);
            await invoke("send_notification", {
              title: "Network Changed",
              body: `${conn.name} reconnected via ${newMode}`,
            }).catch(() => {});
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            addLog("error", `Failed to reconnect ${conn.name}: ${msg}`, "network");
          }
        } else {
          addLog("warning", `Network changed: ${conn.name} is on ${activeMode === "local" ? "LAN" : "Tailscale"} but ${newMode} is now available. Consider reconnecting.`, "network");
          toast.warning(`${conn.name}: switch to ${newMode} available`, { duration: 10000 });
          await invoke("send_notification", {
            title: "Network Changed",
            body: `${conn.name} may need to switch to ${newMode}`,
          }).catch(() => {});
        }
      }
    };

    window.addEventListener("network-changed", handler);
    return () => window.removeEventListener("network-changed", handler);
  }, [connections, mountStatuses, settings.network_change_mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const autoMountConnections = async () => {
    // Fetch external mounts first so we don't try to mount already-occupied drive letters
    let externals: ExternalMount[] = [];
    try {
      externals = await invoke<ExternalMount[]>("list_external_rclone_mounts");
    } catch {
      // ignore
    }
    const occupiedDrives = new Set(
      externals.map((m) => m.mount_point.replace(":", "").toUpperCase())
    );

    for (const conn of connections) {
      if (!conn.auto_mount) continue;
      // Skip if drive letter is already in use externally
      if (occupiedDrives.has(conn.drive_letter.toUpperCase())) continue;

      try {
        const status = await invoke<MountStatus>("get_mount_status", {
          connectionId: conn.id,
        });
        if (status.state !== "mounted") {
          await handleMount(conn);
        }
      } catch (err) {
        console.error(`Failed to auto-mount ${conn.name}:`, err);
      }
    }
  };

  const checkDrivers = async () => {
    try {
      const versions = await invoke<DriverVersions>("get_driver_versions");
      setDriverVersions(versions);
    } catch (err) {
      console.error("Failed to check drivers:", err);
    }
  };

  const refreshStatuses = async () => {
    const statuses: Record<string, MountStatus> = {};
    for (const conn of connections) {
      try {
        const status = await invoke<MountStatus>("get_mount_status", {
          connectionId: conn.id,
        });
        statuses[conn.id] = status;
      } catch (err) {
        console.error(`Failed to get status for ${conn.id}:`, err);
      }
    }
    setMountStatuses(statuses);
  };

  const refreshExternalMounts = async () => {
    try {
      const [externals, remotes] = await Promise.all([
        invoke<ExternalMount[]>("list_external_rclone_mounts"),
        invoke<RcloneRemote[]>("list_rclone_remotes"),
      ]);
      setExternalMounts(externals);

      // Find remotes that aren't managed by any connection in our store
      const managedNames = new Set(connections.map((c) => c.name.toLowerCase()));
      const unmanaged = remotes.filter(
        (r) => !managedNames.has(r.name.toLowerCase())
      );
      setUnmanagedRemotes(unmanaged);
    } catch (err) {
      console.error("Failed to fetch external mounts:", err);
    }
  };

  const handleMount = async (conn: Connection) => {
    setLoading({ ...loading, [conn.id]: true });
    addLog("info", `Mounting ${conn.name} to drive ${conn.drive_letter}:...`, "mounts");

    try {
      const status = await invoke<MountStatus>("mount_drive", {
        connectionJson: JSON.stringify(conn),
        cacheDir: settings.cache_dir || null,
      });
      setMountStatuses({ ...mountStatuses, [conn.id]: status });

      if (status.log) {
        addLog("info", status.log, "network");
      }

      const mode = status.active_mode === "local" ? "LAN" : "Tailscale";
      const url = status.active_url?.replace("http://", "") || "";

      if (status.error) {
        addLog("warning", status.error, "mounts");
        toast.warning(`${conn.name} mounted via ${mode} (${url}) with warning: ${status.error}`);
      } else {
        addLog("success", `${conn.name} mounted to ${conn.drive_letter}: via ${mode} (${url})`, "mounts");
        toast.success(`Mounted ${conn.name} to drive ${conn.drive_letter}: via ${mode}`);
      }

      try {
        await invoke("send_notification", {
          title: "Drive Mounted",
          body: `${conn.name} connected via ${mode}`,
        });
      } catch (err) {
        console.error("Failed to send notification:", err);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : (typeof err === "string" ? err : `Failed to mount ${conn.name}`);
      addLog("error", `Mount failed: ${errorMsg}`, "mounts");
      toast.error(errorMsg);
    } finally {
      setLoading({ ...loading, [conn.id]: false });
    }
  };

  const handleUnmount = async (conn: Connection) => {
    setLoading({ ...loading, [conn.id]: true });
    addLog("info", `Unmounting ${conn.name}...`, "mounts");

    try {
      await invoke("unmount_drive", { connectionId: conn.id });
      const status = await invoke<MountStatus>("get_mount_status", {
        connectionId: conn.id,
      });
      setMountStatuses({ ...mountStatuses, [conn.id]: status });
      addLog("success", `${conn.name} unmounted successfully`, "mounts");
      toast.success(`Unmounted ${conn.name}`);

      try {
        await invoke("send_notification", {
          title: "Drive Unmounted",
          body: `${conn.name} disconnected`,
        });
      } catch (err) {
        console.error("Failed to send notification:", err);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : (typeof err === "string" ? err : `Failed to unmount ${conn.name}`);
      addLog("error", `Unmount failed: ${errorMsg}`, "mounts");
      toast.error(errorMsg);
    } finally {
      setLoading({ ...loading, [conn.id]: false });
    }
  };

  const handleUnmountExternal = async (mount: ExternalMount) => {
    const key = `ext-${mount.pid}`;
    setLoading({ ...loading, [key]: true });
    addLog("info", `Unmounting external mount ${mount.remote_name} (PID ${mount.pid})...`, "mounts");

    try {
      await invoke("unmount_external_mount", { pid: mount.pid });
      addLog("success", `External mount ${mount.remote_name} unmounted`, "mounts");
      toast.success(`Unmounted ${mount.remote_name || mount.mount_point}`);
      await refreshExternalMounts();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      addLog("error", `Failed to unmount external: ${errorMsg}`, "mounts");
      toast.error(errorMsg);
    } finally {
      setLoading({ ...loading, [key]: false });
    }
  };

  const handleTestConnection = async (conn: Connection) => {
    const key = `test-${conn.id}`;
    setLoading({ ...loading, [key]: true });
    addLog("info", `Testing connection for ${conn.name}...`, "network");

    try {
      const status = mountStatuses[conn.id];
      const activeUrl = status?.state === "mounted" ? status.active_url : null;

      const result = await invoke<{
        local_reachable: boolean | null;
        local_ip: string;
        tailscale_reachable: boolean | null;
        tailscale_ip: string;
        active_url_reachable: boolean | null;
        active_url: string;
        local_error: string | null;
        tailscale_error: string | null;
      }>("test_connection", {
        connectionJson: JSON.stringify(conn),
        activeUrl,
      });

      if (result.local_reachable !== null) {
        if (result.local_reachable) {
          addLog("success", `Local (${result.local_ip}:${conn.port}): reachable`, "network");
        } else {
          addLog("error", `Local (${result.local_ip}:${conn.port}): unreachable${result.local_error ? ` — ${result.local_error}` : ""}`, "network");
        }
      }

      if (result.tailscale_reachable !== null) {
        if (result.tailscale_reachable) {
          addLog("success", `Tailscale (${result.tailscale_ip}:${conn.port}): reachable`, "network");
        } else {
          addLog("error", `Tailscale (${result.tailscale_ip}:${conn.port}): unreachable${result.tailscale_error ? ` — ${result.tailscale_error}` : ""}`, "network");
        }
      }

      if (result.active_url_reachable !== null) {
        if (result.active_url_reachable) {
          addLog("success", `Active mount (${result.active_url}): reachable`, "network");
        } else {
          addLog("error", `Active mount (${result.active_url}): unreachable`, "network");
        }
      }

      const localStatus = result.local_reachable === null ? "" : result.local_reachable ? "Local: OK" : "Local: Failed";
      const tsStatus = result.tailscale_reachable === null ? "" : result.tailscale_reachable ? "Tailscale: OK" : "Tailscale: Failed";
      const parts = [localStatus, tsStatus].filter(Boolean).join(", ");
      const anySuccess = result.local_reachable || result.tailscale_reachable;

      if (anySuccess) {
        toast.success(parts);
      } else {
        toast.error(parts || "No IPs configured to test");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog("error", `Test failed: ${msg}`, "network");
      toast.error(msg);
    } finally {
      setLoading({ ...loading, [key]: false });
    }
  };

  const handleDelete = async (conn: Connection) => {
    const confirmed = await confirm(`Delete connection "${conn.name}"? This cannot be undone.`, {
      title: "Delete Connection",
      kind: "warning",
    });
    if (!confirmed) return;

    const status = mountStatuses[conn.id];
    if (status?.state === "mounted") {
      try {
        await invoke("unmount_drive", { connectionId: conn.id });
      } catch (err) {
        console.error("Failed to unmount before delete:", err);
      }
    }

    try {
      await invoke("delete_remote", { name: conn.name });
    } catch (err) {
      console.error("Failed to delete remote:", err);
    }

    remove(conn.id);
    toast.success(`Deleted ${conn.name}`);
  };

  const handleDeleteRemote = async (remoteName: string) => {
    const confirmed = await confirm(`Delete rclone remote "${remoteName}"? This will remove it from rclone config.`, {
      title: "Delete Remote",
      kind: "warning",
    });
    if (!confirmed) return;

    try {
      await invoke("delete_remote", { name: remoteName });
      toast.success(`Deleted remote ${remoteName}`);
      await refreshExternalMounts();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(errorMsg);
    }
  };

  const handleImportRemote = async (remote: RcloneRemote) => {
    try {
      // Read the full rclone config to extract connection details
      const dump = await invoke<string>("get_rclone_config_dump");
      const config = JSON.parse(dump);
      const remoteConfig = config[remote.name] || {};

      const remoteType = remoteConfig.type || remote.remote_type || "webdav";
      const host = remoteConfig.host || "";
      const port = parseInt(remoteConfig.port) || (
        remoteType === "sftp" ? 22 : remoteType === "ftp" ? 21 : remoteType === "smb" ? 445 : 80
      );
      const username = remoteConfig.user || "";
      const vendor = remoteConfig.vendor || "";

      // For WebDAV, extract host/port from the url field
      let localIp = host;
      let importPort = port;
      if (remoteType === "webdav" && remoteConfig.url) {
        try {
          const parsed = new URL(remoteConfig.url);
          localIp = parsed.hostname;
          importPort = parseInt(parsed.port) || 80;
        } catch { /* keep defaults */ }
      }

      // Find a free drive letter
      const usedLetters = new Set(connections.map(c => c.drive_letter.toUpperCase()));
      const freeLetter = Array.from("ZYXWVUTSRQPONMLKJIHGFED").find(
        l => !usedLetters.has(l)
      ) || "Z";

      const connection: Connection = {
        id: crypto.randomUUID(),
        name: remote.name,
        description: "Imported from rclone config",
        remote_type: remoteType,
        local_ip: localIp,
        tailscale_ip: "",
        port: importPort,
        drive_letter: freeLetter,
        protocol: remoteType,
        vendor,
        username,
        network_mode: settings.default_network_mode,
        speed_profile: settings.default_speed_profile,
        auto_mount: false,
        sort_order: Date.now(),
        created_at: new Date().toISOString(),
        custom_flags: [],
        dual_mount: false,
      };

      add(connection);
      addLog("success", `Imported "${remote.name}" — edit it to set IP, drive letter, and other settings`, "mounts");
      toast.success(`Imported "${remote.name}" into the app. Edit it to configure fully.`);
      await refreshExternalMounts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Import failed: ${msg}`);
    }
  };

  const activeMounts = Object.values(mountStatuses).filter(s => s.state === "mounted").length;
  const totalActive = activeMounts + externalMounts.length;
  const driversInstalled = driverVersions?.rclone_installed && driverVersions?.winfsp_installed;

  return (
    <div className="h-full overflow-y-auto content-scroll">
      <div className="px-10 py-8 pb-12 space-y-6 max-w-6xl w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
              Overview
            </h1>
            <p className="text-[13px] text-text-secondary mt-1">
              Manage your rclone drive mounts
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastRefreshed && (
              <span className="text-[12px] text-text-tertiary select-none">
                Updated {timeSince}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-[13px]"
              onClick={refreshAll}
            >
              <ArrowsClockwise size={15} weight="bold" />
              Refresh
            </Button>
            <Button
              variant="default"
              size="sm"
              className="gap-1.5 text-[13px]"
              onClick={() => setShowUpload(true)}
              disabled={totalActive === 0}
              title={totalActive === 0 ? "Mount a drive first" : "Upload files directly — bypasses VFS cache"}
            >
              <CloudArrowUp size={15} weight="bold" />
              Direct Upload
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="gap-1.5 text-[13px]"
              onClick={() => onNavigate?.("add")}
            >
              <Plus size={15} weight="bold" />
              New Mount
            </Button>
          </div>
        </div>

        {/* Driver Warning — only show once we have a result, to avoid false flash on load */}
        {driverVersions !== null && !driversInstalled && (
          <Card className="p-4 bg-accent-amber/10 border-accent-amber/30">
            <div className="flex items-start gap-3">
              <Warning size={20} className="text-accent-amber mt-0.5" weight="bold" />
              <div className="flex-1">
                <div className="text-[13px] font-medium text-text-primary mb-1">
                  Required drivers not installed
                </div>
                <div className="text-[13px] text-text-secondary mb-3">
                  Rclone and WinFsp must be installed before you can mount drives.
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onNavigate?.("settings")}
                  className="gap-1.5"
                >
                  Install Drivers in Settings
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Quick Stats */}
        {initialLoading ? (
          <StatCardsSkeleton />
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              icon={HardDrives}
              label="Total Mounts"
              value={(connections.length + unmanagedRemotes.length).toString()}
              color="text-text-primary"
            />
            <StatCard
              icon={Lightning}
              label="Active"
              value={totalActive.toString()}
              color="text-accent-green"
            />
            <StatCard
              icon={WifiHigh}
              label="Network"
              value={totalActive > 0 ? "Online" : "Offline"}
              color={totalActive > 0 ? "text-accent-green" : "text-text-tertiary"}
              isText
            />
          </div>
        )}

        {/* Managed Connections */}
        {initialLoading ? (
          <div className="space-y-3">
            <div className="text-[11px] text-text-tertiary uppercase tracking-wider font-medium">
              Managed Connections
            </div>
            {[0, 1].map((i) => <ConnectionCardSkeleton key={i} />)}
          </div>
        ) : connections.length > 0 && (
          <div className="space-y-3">
            <div className="text-[11px] text-text-tertiary uppercase tracking-wider font-medium">
              Managed Connections
            </div>
            {connections.map((conn) => {
              const status = mountStatuses[conn.id];
              const isMounted = status?.state === "mounted";
              const isLoading = loading[conn.id];

              return (
                <Card key={conn.id} className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-base font-semibold text-text-primary">
                          {conn.name}
                        </h3>
                        {isMounted ? (
                          status?.error ? (
                            <Badge variant="default" dot>
                              Mounted (Warning)
                            </Badge>
                          ) : (
                            <Badge variant="connected" dot>
                              Mounted
                            </Badge>
                          )
                        ) : (
                          <Badge variant="disconnected">Unmounted</Badge>
                        )}
                        {status?.active_mode && (
                          <Badge
                            variant={
                              status.active_mode === "local" ? "local" : "tailscale"
                            }
                          >
                            {status.active_mode === "local" ? "LAN" : "Tailscale"}
                          </Badge>
                        )}
                      </div>
                      {conn.description && (
                        <div className="text-[12px] text-text-tertiary mb-1 italic">
                          {conn.description}
                        </div>
                      )}
                      <div className="text-[13px] text-text-secondary">
                        {conn.remote_type?.toUpperCase() || "WEBDAV"} &bull; Drive {conn.drive_letter}:{conn.dual_mount && conn.archive_drive_letter ? ` + ${conn.archive_drive_letter}: (Archive)` : ""} &bull;{" "}
                        {isMounted && status?.active_url
                          ? status.active_url.replace("http://", "")
                          : `${conn.local_ip}:${conn.port}`} &bull;{" "}
                        {conn.speed_profile} profile
                      </div>
                      {isMounted && status?.error && (
                        <div className="text-[11px] text-accent-amber mt-1">
                          {status.error}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isMounted ? (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleUnmount(conn)}
                          disabled={isLoading || !driversInstalled}
                          className="gap-1.5"
                        >
                          {isLoading ? (
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Stop size={14} weight="bold" />
                          )}
                          Unmount
                        </Button>
                      ) : (
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => handleMount(conn)}
                          disabled={isLoading || !driversInstalled}
                          className="gap-1.5"
                        >
                          {isLoading ? (
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Play size={14} weight="bold" />
                          )}
                          Mount
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTestConnection(conn)}
                        disabled={loading[`test-${conn.id}`]}
                        title="Test connection"
                      >
                        {loading[`test-${conn.id}`] ? (
                          <div className="w-3.5 h-3.5 border-2 border-text-primary/30 border-t-text-primary rounded-full animate-spin" />
                        ) : (
                          <WifiHigh size={14} weight="bold" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onNavigate?.("edit", conn.id)}
                        title="Edit connection"
                      >
                        <PencilSimple size={14} weight="bold" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(conn)}
                        title="Delete connection"
                      >
                        <Trash size={14} weight="bold" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* External Active Mounts */}
        {!initialLoading && externalMounts.length > 0 && (
          <div className="space-y-3">
            <div className="text-[11px] text-text-tertiary uppercase tracking-wider font-medium">
              External Mounts (running outside this app)
            </div>
            {externalMounts.map((mount) => {
              const key = `ext-${mount.pid}`;
              const isLoading = loading[key];
              const displayName = mount.remote_name
                ? mount.remote_name.replace(/:$/, "")
                : "Unknown";

              return (
                <Card key={key} className="p-5 border-accent-amber/20">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <DesktopTower size={18} className="text-accent-amber" weight="duotone" />
                        <h3 className="text-base font-semibold text-text-primary">
                          {displayName}
                        </h3>
                        <Badge variant="connected" dot>
                          Mounted
                        </Badge>
                        <Badge variant="default">External</Badge>
                      </div>
                      <div className="text-[13px] text-text-secondary">
                        {mount.mount_point ? `Drive ${mount.mount_point}` : "Mount point unknown"} &bull; PID {mount.pid}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleUnmountExternal(mount)}
                        disabled={isLoading}
                        className="gap-1.5"
                      >
                        {isLoading ? (
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Stop size={14} weight="bold" />
                        )}
                        Unmount
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Unmanaged Rclone Remotes */}
        {!initialLoading && unmanagedRemotes.length > 0 && (
          <div className="space-y-3">
            <div className="text-[11px] text-text-tertiary uppercase tracking-wider font-medium">
              Rclone Remotes (in rclone config, not managed here)
            </div>
            {unmanagedRemotes.map((remote) => {
              // Check if this remote is currently mounted externally
              const externallyMounted = externalMounts.find(
                (m) =>
                  m.remote_name.replace(/:$/, "").toLowerCase() ===
                  remote.name.toLowerCase()
              );

              return (
                <Card key={remote.name} className="p-5 border-border-default/50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CloudArrowDown size={18} className="text-text-tertiary" weight="duotone" />
                        <h3 className="text-base font-semibold text-text-primary">
                          {remote.name}
                        </h3>
                        <Badge variant="default">{remote.remote_type}</Badge>
                        {externallyMounted && (
                          <Badge variant="connected" dot>
                            Mounted ({externallyMounted.mount_point})
                          </Badge>
                        )}
                      </div>
                      <div className="text-[13px] text-text-secondary">
                        In rclone config but not managed here — import to edit and mount
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleImportRemote(remote)}
                        className="gap-1.5"
                      >
                        <CloudArrowDown size={14} weight="bold" />
                        Import
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRemote(remote.name)}
                        className="gap-1.5"
                      >
                        <Trash size={14} weight="bold" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!initialLoading && connections.length === 0 && externalMounts.length === 0 && unmanagedRemotes.length === 0 && (
          <Card className="flex flex-col items-center justify-center text-center py-20 px-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-blue/15 to-accent-purple/15 border border-white/[0.08] flex items-center justify-center mb-6 shadow-[0_8px_24px_rgba(59,130,246,0.12)]">
              <HardDrives size={32} className="text-accent-blue" weight="duotone" />
            </div>
            <h2 className="text-xl font-semibold text-text-primary mb-3">
              No mounts configured
            </h2>
            <p className="text-[13px] text-text-secondary max-w-md mb-8 leading-relaxed">
              Connect to your Unraid server, NAS, or cloud storage. Drives appear
              in Windows Explorer like local disks.
            </p>
            <Button
              variant="primary"
              size="md"
              className="gap-2 text-[13px] cursor-pointer"
              onClick={() => onNavigate?.("add")}
            >
              <Plus size={16} weight="bold" />
              Add Your First Mount
            </Button>
          </Card>
        )}
      </div>

      <DirectUploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        mountedConnections={connections
          .filter(c => mountStatuses[c.id]?.state === "mounted")
          .map(c => ({
            id: c.id,
            name: c.name,
            remoteType: c.remote_type || "webdav",
            activeUrl: mountStatuses[c.id]?.active_url || "",
            port: c.port,
            vendor: c.vendor || "",
          }))}
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  isText,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  isText?: boolean;
}) {
  return (
    <Card className="p-5 group hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center group-hover:bg-white/[0.06] transition-colors duration-150">
          <Icon size={18} className="text-text-tertiary" weight="duotone" />
        </div>
      </div>
      <div
        className={`${isText ? "text-lg" : "text-3xl"} font-semibold ${color} leading-none mb-2 tracking-tight`}
      >
        {value}
      </div>
      <div className="text-[11px] text-text-tertiary uppercase tracking-wider font-medium">
        {label}
      </div>
    </Card>
  );
}

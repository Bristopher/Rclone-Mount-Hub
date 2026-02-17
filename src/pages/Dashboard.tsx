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
  DesktopTower,
  PencilSimple,
} from "phosphor-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ConnectionCardSkeleton, StatCardsSkeleton } from "../components/ui/Skeleton";
import { useConnectionStore } from "../lib/store";
import { useLogStore } from "../lib/logStore";
import type { Connection, MountStatus } from "../lib/types";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

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
  const { connections, remove } = useConnectionStore();
  const { addLog } = useLogStore();
  const [mountStatuses, setMountStatuses] = useState<Record<string, MountStatus>>({});
  const [driverVersions, setDriverVersions] = useState<DriverVersions | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [externalMounts, setExternalMounts] = useState<ExternalMount[]>([]);
  const [unmanagedRemotes, setUnmanagedRemotes] = useState<RcloneRemote[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const didAutoMount = useRef(false);

  // Run auto-mount exactly once — useRef guard prevents StrictMode double-fire
  useEffect(() => {
    checkDrivers();
    if (!didAutoMount.current) {
      didAutoMount.current = true;
      autoMountConnections();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const init = async () => {
      await Promise.all([refreshStatuses(), refreshExternalMounts()]);
      setInitialLoading(false);
    };
    init();

    const interval = setInterval(() => {
      refreshStatuses();
      refreshExternalMounts();
    }, 3000);
    return () => clearInterval(interval);
  }, [connections]);

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
      });
      setMountStatuses({ ...mountStatuses, [conn.id]: status });

      const mode = status.active_mode === "local" ? "LAN" : "Tailscale";
      addLog("success", `${conn.name} mounted successfully via ${mode}`, "mounts");
      toast.success(`Mounted ${conn.name} to drive ${conn.drive_letter}:`);

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

  const handleDelete = async (conn: Connection) => {
    if (!confirm(`Delete connection "${conn.name}"? This cannot be undone.`)) {
      return;
    }

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
    if (!confirm(`Delete rclone remote "${remoteName}"? This will remove it from rclone config.`)) {
      return;
    }

    try {
      await invoke("delete_remote", { name: remoteName });
      toast.success(`Deleted remote ${remoteName}`);
      await refreshExternalMounts();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(errorMsg);
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
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-[13px]"
              onClick={() => {
                refreshStatuses();
                refreshExternalMounts();
              }}
            >
              <ArrowsClockwise size={15} weight="bold" />
              Refresh
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

        {/* Driver Warning */}
        {!driversInstalled && (
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
                          <Badge variant="connected" dot>
                            Mounted
                          </Badge>
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
                        {conn.remote_type?.toUpperCase() || "WEBDAV"} &bull; Drive {conn.drive_letter}: &bull; {conn.local_ip}:{conn.port} &bull;{" "}
                        {conn.speed_profile} profile
                      </div>
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
                        Configured in rclone but not managed by this app
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
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

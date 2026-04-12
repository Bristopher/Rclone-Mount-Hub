import { useState, useEffect } from "react";
import {
  HardDrive,
  Globe,
  Lock,
  User,
  Lightning,
  Check,
  ArrowLeft,
  CircleNotch,
  Cloud,
  Desktop,
  Database,
  FloppyDisk,
  CaretLeft,
  CaretRight,
  CaretDown,
  Gear,
} from "phosphor-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useConnectionStore } from "../lib/store";
import { useLogStore } from "../lib/logStore";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type { Connection, CacheOverrides } from "../lib/types";

interface EditConnectionProps {
  connection: Connection;
  onNavigate?: (page: string) => void;
}

const WEBDAV_VENDORS = [
  { value: "copyparty", label: "Copyparty (Unraid)" },
  { value: "nextcloud", label: "Nextcloud" },
  { value: "owncloud", label: "ownCloud" },
  { value: "sharepoint", label: "SharePoint" },
  { value: "other", label: "Other WebDAV" },
];

export function EditConnection({ connection, onNavigate }: EditConnectionProps) {
  const { update } = useConnectionStore();
  const { addLog } = useLogStore();

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  const [name, setName] = useState(connection.name);
  const [description, setDescription] = useState(connection.description || "");
  const [driveLetter, setDriveLetter] = useState(connection.drive_letter);
  const [availableLetters, setAvailableLetters] = useState<string[]>([]);
  const [host, setHost] = useState(connection.local_ip);
  const [tailscaleIp, setTailscaleIp] = useState(connection.tailscale_ip || "");
  const [port, setPort] = useState(String(connection.port));
  const [username, setUsername] = useState(connection.username || "");
  const [password, setPassword] = useState(""); // never pre-fill password
  const [networkMode, setNetworkMode] = useState(connection.network_mode);
  const [speedProfile, setSpeedProfile] = useState(connection.speed_profile);
  const [autoMount, setAutoMount] = useState(connection.auto_mount);
  const [dualMount, setDualMount] = useState(connection.dual_mount ?? false);
  const [archiveDriveLetter, setArchiveDriveLetter] = useState(connection.archive_drive_letter || "");
  const [webdavVendor, setWebdavVendor] = useState("copyparty");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cacheOverrides, setCacheOverrides] = useState<Partial<CacheOverrides>>(
    connection.cache_overrides || {}
  );

  useEffect(() => {
    invoke<string[]>("get_available_drives").then((letters) => {
      // Include the currently assigned letter even if "in use" by this connection
      const withCurrent = letters.includes(connection.drive_letter)
        ? letters
        : [...letters, connection.drive_letter].sort();
      setAvailableLetters(withCurrent);
    }).catch(() => {});
  }, []);

  const navigateLetter = (dir: 1 | -1) => {
    if (availableLetters.length === 0) return;
    const idx = availableLetters.indexOf(driveLetter);
    if (idx === -1) {
      setDriveLetter(dir === 1 ? availableLetters[0] : availableLetters[availableLetters.length - 1]);
    } else {
      setDriveLetter(availableLetters[(idx + dir + availableLetters.length) % availableLetters.length]);
    }
  };

  const navigateArchiveLetter = (dir: 1 | -1) => {
    const free = availableLetters.filter(l => l !== driveLetter);
    if (free.length === 0) return;
    const idx = free.indexOf(archiveDriveLetter);
    if (idx === -1) {
      setArchiveDriveLetter(dir === 1 ? free[0] : free[free.length - 1]);
    } else {
      setArchiveDriveLetter(free[(idx + dir + free.length) % free.length]);
    }
  };

  const remoteType = connection.remote_type || "webdav";

  const remoteTypeLabel: Record<string, string> = {
    webdav: "WebDAV",
    sftp: "SFTP",
    smb: "SMB / Samba",
    s3: "S3",
    ftp: "FTP",
  };

  const remoteTypeIcon: Record<string, React.ElementType> = {
    webdav: Globe,
    sftp: Desktop,
    smb: Desktop,
    s3: Cloud,
    ftp: Database,
  };

  const TypeIcon = remoteTypeIcon[remoteType] || HardDrive;

  const validateForm = () => {
    if (!name.trim()) { toast.error("Name is required"); return false; }
    if (!driveLetter.trim()) { toast.error("Drive letter is required"); return false; }
    if (remoteType !== "s3" && !host.trim()) { toast.error("Host is required"); return false; }
    return true;
  };

  const handleTest = async () => {
    if (!validateForm()) return;
    setTesting(true);
    setTestResult(null);

    try {
      let anySuccess = false;
      const testPort = parseInt(port) || 0;

      // Test local IP
      addLog("info", `Testing local ${host}:${testPort}...`, "network");
      const localReachable = await invoke<boolean>("ping_port", {
        ip: host,
        port: testPort,
        timeoutMs: 3000,
      });
      if (localReachable) {
        addLog("success", `Local (${host}:${testPort}): reachable`, "network");
        anySuccess = true;
      } else {
        addLog("error", `Local (${host}:${testPort}): unreachable`, "network");
      }

      // Test tailscale IP if provided
      let tailscaleReachable = false;
      if (tailscaleIp.trim()) {
        addLog("info", `Testing Tailscale ${tailscaleIp}:${testPort}...`, "network");
        tailscaleReachable = await invoke<boolean>("ping_port", {
          ip: tailscaleIp,
          port: testPort,
          timeoutMs: 3000,
        });
        if (tailscaleReachable) {
          addLog("success", `Tailscale (${tailscaleIp}:${testPort}): reachable`, "network");
          anySuccess = true;
        } else {
          addLog("error", `Tailscale (${tailscaleIp}:${testPort}): unreachable`, "network");
        }
      }

      const localLabel = localReachable ? "Local: OK" : "Local: Failed";
      const tsLabel = tailscaleIp.trim() ? (tailscaleReachable ? "Tailscale: OK" : "Tailscale: Failed") : "";
      const summary = [localLabel, tsLabel].filter(Boolean).join(", ");

      if (anySuccess) {
        setTestResult("success");
        toast.success(summary);
      } else {
        setTestResult("error");
        toast.error(summary);
      }
    } catch (err) {
      setTestResult("error");
      const msg = err instanceof Error ? err.message : (typeof err === "string" ? err : "Test failed");
      addLog("error", msg, "network");
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);

    try {
      // If password was changed, update rclone config
      if (password) {
        const params: Record<string, string> = {};
        if (remoteType === "webdav") {
          params.url = `http://${host}:${port}`;
          params.vendor = webdavVendor;
          params.user = username;
          params.pass = password;
        } else if (remoteType === "sftp" || remoteType === "ftp") {
          params.host = host;
          params.port = port;
          params.user = username;
          params.pass = password;
        } else if (remoteType === "smb") {
          params.host = host;
          params.user = username;
          params.pass = password;
        }

        // Delete and recreate remote to update credentials
        await invoke("delete_remote", { name: connection.name });
        await invoke("create_remote", { name, remoteType, params });
      } else if (name !== connection.name) {
        // Name changed but no password — recreate with empty pass for now
        // (rclone stores the encrypted pass; we can't read it back to re-use)
        toast("Note: changing name requires re-entering your password to update the rclone config.");
      }

      // Update local store
      const updates: Partial<Connection> = {
        name,
        description,
        drive_letter: driveLetter,
        local_ip: host,
        tailscale_ip: tailscaleIp,
        port: parseInt(port) || connection.port,
        username,
        network_mode: networkMode,
        speed_profile: speedProfile,
        auto_mount: autoMount,
        cache_overrides: Object.values(cacheOverrides).some(v => v !== undefined) ? cacheOverrides as CacheOverrides : undefined,
        dual_mount: dualMount,
        archive_drive_letter: dualMount && archiveDriveLetter ? archiveDriveLetter : undefined,
      };

      update(connection.id, updates);
      addLog("success", `Connection "${name}" updated`, "mounts");
      toast.success(`Saved changes to "${name}"`);
      onNavigate?.("dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : (typeof err === "string" ? err : "Failed to save");
      addLog("error", `Save failed: ${msg}`, "mounts");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto content-scroll">
      <div className="px-10 py-8 pb-12 max-w-3xl w-full mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => onNavigate?.("dashboard")}
            className="flex items-center gap-1.5 text-[13px] text-text-tertiary hover:text-text-secondary mb-4 transition-colors"
          >
            <ArrowLeft size={14} weight="bold" />
            Back to Overview
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center">
              <TypeIcon size={18} weight="duotone" className="text-accent-blue" />
            </div>
            <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
              Edit Connection
            </h1>
          </div>
          <p className="text-[13px] text-text-secondary">
            {remoteTypeLabel[remoteType] || remoteType} connection &bull; created{" "}
            {new Date(connection.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="space-y-6">
          {/* Basic Info */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <HardDrive size={18} weight="duotone" className="text-accent-blue" />
              Basic Information
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Connection Name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setTestResult(null); }}
                />
                {/* Drive letter picker */}
                <div>
                  <label className="block text-[13px] font-medium text-text-secondary mb-2">
                    Drive Letter
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => navigateLetter(-1)}
                      disabled={availableLetters.length === 0}
                      className="w-8 h-9 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-text-tertiary hover:text-text-primary hover:bg-white/[0.08] transition-colors disabled:opacity-30"
                    >
                      <CaretLeft size={13} weight="bold" />
                    </button>
                    <input
                      maxLength={1}
                      value={driveLetter}
                      onChange={(e) => setDriveLetter(e.target.value.toUpperCase())}
                      className="w-12 h-9 text-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-[15px] font-semibold text-text-primary focus:outline-none focus:border-accent-blue/50 uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => navigateLetter(1)}
                      disabled={availableLetters.length === 0}
                      className="w-8 h-9 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-text-tertiary hover:text-text-primary hover:bg-white/[0.08] transition-colors disabled:opacity-30"
                    >
                      <CaretRight size={13} weight="bold" />
                    </button>
                    {availableLetters.length > 0 && (
                      <span className="text-[11px] text-text-tertiary ml-1">
                        {availableLetters.length} free
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Input
                label="Description (optional)"
                placeholder="e.g., main storage, media share"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </Card>

          {/* Host settings (not S3) */}
          {remoteType !== "s3" && (
            <Card className="p-6">
              <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                <TypeIcon size={18} weight="duotone" className="text-accent-purple" />
                {remoteTypeLabel[remoteType] || "Remote"} Settings
              </h2>
              <div className="space-y-4">
                {remoteType === "webdav" && (
                  <div>
                    <label className="block text-[13px] font-medium text-text-secondary mb-2">
                      Server Software
                    </label>
                    <select
                      value={webdavVendor}
                      onChange={(e) => setWebdavVendor(e.target.value)}
                      className="w-full bg-bg-overlay border border-border-default rounded-lg px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-accent-blue/60"
                    >
                      {WEBDAV_VENDORS.map((v) => (
                        <option key={v.value} value={v.value}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <Input
                      label="Host / IP (LAN)"
                      value={host}
                      onChange={(e) => { setHost(e.target.value); setTestResult(null); }}
                    />
                  </div>
                  <Input
                    label="Port"
                    type="number"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                  />
                </div>
                <Input
                  label="Tailscale IP (optional)"
                  placeholder="100.x.x.x"
                  value={tailscaleIp}
                  onChange={(e) => setTailscaleIp(e.target.value)}
                  hint="Used when away from home"
                />
              </div>
            </Card>
          )}

          {/* Authentication */}
          {remoteType !== "s3" && (
            <Card className="p-6">
              <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Lock size={18} weight="duotone" className="text-accent-amber" />
                Authentication
              </h2>
              <div className="space-y-4">
                <Input
                  label="Username"
                  icon={User}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <Input
                  label="New Password (leave blank to keep current)"
                  type="password"
                  placeholder="••••••••"
                  icon={Lock}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  hint="Password is stored encrypted in rclone config"
                />
              </div>
            </Card>
          )}

          {/* Network Mode */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Globe size={18} weight="duotone" className="text-accent-purple" />
              Network Mode
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "auto", label: "Auto", desc: "Smart switching" },
                { value: "local", label: "LAN Only", desc: "Local network" },
                { value: "tailscale", label: "Tailscale", desc: "Remote access" },
              ].map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setNetworkMode(mode.value as typeof networkMode)}
                  className={`p-3 rounded-lg border transition-all duration-150 text-left ${
                    networkMode === mode.value
                      ? "bg-accent-blue/10 border-accent-blue/40"
                      : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[13px] font-medium ${networkMode === mode.value ? "text-accent-blue" : "text-text-primary"}`}>
                      {mode.label}
                    </span>
                    {networkMode === mode.value && <Check size={14} weight="bold" className="text-accent-blue" />}
                  </div>
                  <span className="text-[11px] text-text-tertiary">{mode.desc}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Speed Profile */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Lightning size={18} weight="duotone" className="text-accent-green" />
              Performance Profile
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "max", label: "Max Speed", cache: "500 GB", desc: "10Gbps LAN, Fiber" },
                { value: "balanced", label: "Balanced", cache: "200 GB", desc: "Daily use (Recommended)" },
                { value: "low", label: "Low Resource", cache: "50 GB", desc: "Battery, slow WiFi" },
              ].map((profile) => (
                <button
                  key={profile.value}
                  onClick={() => setSpeedProfile(profile.value as typeof speedProfile)}
                  className={`p-4 rounded-lg border transition-all duration-150 text-left ${
                    speedProfile === profile.value
                      ? "bg-accent-green/10 border-accent-green/40"
                      : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[13px] font-semibold ${speedProfile === profile.value ? "text-accent-green" : "text-text-primary"}`}>
                      {profile.label}
                    </span>
                    {speedProfile === profile.value && <Check size={14} weight="bold" className="text-accent-green" />}
                  </div>
                  <div className="text-[11px] text-text-tertiary mb-1">Cache: {profile.cache}</div>
                  <div className="text-[11px] text-text-tertiary">{profile.desc}</div>
                </button>
              ))}
            </div>
          </Card>

          {/* Advanced Cache Settings */}
          <Card className="p-6">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between"
            >
              <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <Gear size={18} weight="duotone" className="text-text-tertiary" />
                Advanced Cache Settings
              </h2>
              <div className="flex items-center gap-2">
                {!showAdvanced && (
                  <span className="text-[11px] text-text-tertiary">
                    Using {speedProfile} profile defaults
                  </span>
                )}
                <CaretDown
                  size={14}
                  weight="bold"
                  className={`text-text-tertiary transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                />
              </div>
            </button>
            {showAdvanced && (
              <div className="mt-4 space-y-4">
                <p className="text-[11px] text-text-tertiary">
                  Leave blank to use the speed profile defaults. Dir Cache Time: how long directory listings are cached (0 = always fresh). Poll Interval: how often rclone checks for remote changes.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Dir Cache Time"
                    placeholder={speedProfile === "low" ? "30s" : "0"}
                    value={cacheOverrides.dir_cache_time || ""}
                    onChange={(e) => setCacheOverrides({ ...cacheOverrides, dir_cache_time: e.target.value || undefined })}
                    hint="0 = always fresh on navigate"
                  />
                  <Input
                    label="Poll Interval"
                    placeholder={speedProfile === "low" ? "10m" : "5m"}
                    value={cacheOverrides.poll_interval || ""}
                    onChange={(e) => setCacheOverrides({ ...cacheOverrides, poll_interval: e.target.value || undefined })}
                    hint="Background check interval"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-medium text-text-secondary mb-2">
                      VFS Cache Mode
                    </label>
                    <select
                      value={cacheOverrides.vfs_cache_mode || ""}
                      onChange={(e) => setCacheOverrides({ ...cacheOverrides, vfs_cache_mode: e.target.value || undefined })}
                      className="w-full bg-bg-overlay border border-border-default rounded-lg px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-accent-blue/60"
                    >
                      <option value="">Default (full)</option>
                      <option value="full">Full</option>
                      <option value="writes">Writes</option>
                      <option value="minimal">Minimal</option>
                      <option value="off">Off</option>
                    </select>
                  </div>
                  <Input
                    label="VFS Cache Size"
                    placeholder={speedProfile === "max" ? "500G" : speedProfile === "balanced" ? "200G" : "50G"}
                    value={cacheOverrides.vfs_cache_max_size || ""}
                    onChange={(e) => setCacheOverrides({ ...cacheOverrides, vfs_cache_max_size: e.target.value || undefined })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Read Ahead"
                    placeholder={speedProfile === "max" ? "512M" : speedProfile === "balanced" ? "128M" : "32M"}
                    value={cacheOverrides.vfs_read_ahead || ""}
                    onChange={(e) => setCacheOverrides({ ...cacheOverrides, vfs_read_ahead: e.target.value || undefined })}
                  />
                  <Input
                    label="Buffer Size"
                    placeholder={speedProfile === "max" ? "512M" : speedProfile === "balanced" ? "256M" : "64M"}
                    value={cacheOverrides.buffer_size || ""}
                    onChange={(e) => setCacheOverrides({ ...cacheOverrides, buffer_size: e.target.value || undefined })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Transfers"
                    type="number"
                    placeholder={speedProfile === "max" ? "16" : speedProfile === "balanced" ? "8" : "4"}
                    value={cacheOverrides.transfers?.toString() || ""}
                    onChange={(e) => setCacheOverrides({ ...cacheOverrides, transfers: e.target.value ? parseInt(e.target.value) : undefined })}
                  />
                  <Input
                    label="Multi-thread Streams"
                    type="number"
                    placeholder={speedProfile === "max" ? "16" : speedProfile === "balanced" ? "8" : "4"}
                    value={cacheOverrides.multi_thread_streams?.toString() || ""}
                    onChange={(e) => setCacheOverrides({ ...cacheOverrides, multi_thread_streams: e.target.value ? parseInt(e.target.value) : undefined })}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCacheOverrides({})}
                  className="text-text-tertiary"
                >
                  Reset to Profile Defaults
                </Button>
              </div>
            )}
          </Card>

          {/* Auto-mount */}
          <Card className="p-5 flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-text-primary mb-0.5">
                Auto-mount on startup
              </div>
              <div className="text-[11px] text-text-tertiary">
                Automatically connect this drive when the app starts
              </div>
            </div>
            <button
              onClick={() => setAutoMount(!autoMount)}
              className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
                autoMount ? "bg-accent-blue shadow-[0_0_8px_rgba(59,130,246,0.3)]" : "bg-white/[0.15]"
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${
                  autoMount ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </Card>

          {/* Dual Mount */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-0">
              <div>
                <div className="text-[13px] font-medium text-text-primary mb-0.5">
                  Dual Mount (Archive)
                </div>
                <div className="text-[11px] text-text-tertiary">
                  Mount a second read-only drive with 24h cached listings — fast browsing for grabbing old files
                </div>
              </div>
              <button
                onClick={() => setDualMount(!dualMount)}
                className={`relative w-11 h-6 rounded-full transition-all duration-200 flex-shrink-0 ml-4 ${
                  dualMount ? "bg-accent-purple shadow-[0_0_8px_rgba(139,92,246,0.3)]" : "bg-white/[0.15]"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${
                    dualMount ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {dualMount && (
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <div className="grid grid-cols-2 gap-4 items-start">
                  <div>
                    <div className="text-[11px] font-medium text-text-secondary mb-2 uppercase tracking-wide">Live Mount</div>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-9 flex items-center justify-center rounded-lg bg-accent-blue/10 border border-accent-blue/20 text-[15px] font-semibold text-accent-blue">
                        {driveLetter}
                      </div>
                      <div className="text-[11px] text-text-tertiary leading-tight">
                        Always up-to-date<br />normal speed profile
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-text-secondary mb-2 uppercase tracking-wide">Archive Mount</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigateArchiveLetter(-1)}
                        className="w-8 h-9 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-text-tertiary hover:text-text-primary hover:bg-white/[0.08] transition-colors"
                      >
                        <CaretLeft size={13} weight="bold" />
                      </button>
                      <input
                        maxLength={1}
                        value={archiveDriveLetter}
                        onChange={(e) => setArchiveDriveLetter(e.target.value.toUpperCase())}
                        className="w-12 h-9 text-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-[15px] font-semibold text-accent-purple focus:outline-none focus:border-accent-purple/50 uppercase"
                      />
                      <button
                        type="button"
                        onClick={() => navigateArchiveLetter(1)}
                        className="w-8 h-9 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-text-tertiary hover:text-text-primary hover:bg-white/[0.08] transition-colors"
                      >
                        <CaretRight size={13} weight="bold" />
                      </button>
                      <div className="text-[11px] text-text-tertiary leading-tight">
                        Read-only, 24h<br />dir cache
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-text-tertiary mt-3">
                  The archive mount has aggressive directory caching (24h) and polls for changes only hourly. Use it to browse and grab files — uploads and edits should use the live mount.
                </p>
              </div>
            )}
          </Card>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="ghost"
              size="md"
              className="flex-1"
              onClick={() => onNavigate?.("dashboard")}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="md"
              className={`gap-2 ${
                testResult === "success" ? "border-accent-green/40 text-accent-green" :
                testResult === "error" ? "border-accent-red/40 text-accent-red" : ""
              }`}
              onClick={handleTest}
              disabled={testing || saving}
            >
              {testing ? (
                <CircleNotch size={16} weight="bold" className="animate-spin" />
              ) : testResult === "success" ? (
                <Check size={16} weight="bold" />
              ) : (
                <Globe size={16} weight="bold" />
              )}
              {testing ? "Testing..." : testResult === "success" ? "Reachable" : "Test Connection"}
            </Button>
            <Button
              variant="primary"
              size="md"
              className="gap-2"
              onClick={handleSave}
              disabled={saving || testing}
            >
              {saving ? (
                <CircleNotch size={16} weight="bold" className="animate-spin" />
              ) : (
                <FloppyDisk size={16} weight="bold" />
              )}
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

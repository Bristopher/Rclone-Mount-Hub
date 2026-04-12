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

interface AddConnectionProps {
  onNavigate?: (page: string) => void;
}

// Supported remote types with display info
const REMOTE_TYPES = [
  {
    id: "webdav",
    label: "WebDAV",
    icon: Globe,
    color: "accent-blue",
    desc: "Unraid, Nextcloud, copyparty",
  },
  {
    id: "sftp",
    label: "SFTP",
    icon: Desktop,
    color: "accent-purple",
    desc: "SFTPGo, OpenSSH",
  },
  {
    id: "smb",
    label: "SMB / Samba",
    icon: Desktop,
    color: "accent-amber",
    desc: "Windows shares, NAS",
  },
  {
    id: "s3",
    label: "S3",
    icon: Cloud,
    color: "accent-green",
    desc: "AWS S3, MinIO, Backblaze",
  },
  {
    id: "ftp",
    label: "FTP",
    icon: Database,
    color: "text-text-tertiary",
    desc: "Classic FTP server",
  },
] as const;

type RemoteTypeId = (typeof REMOTE_TYPES)[number]["id"];

// WebDAV vendor options
const WEBDAV_VENDORS = [
  { value: "copyparty", label: "Copyparty (Unraid)" },
  { value: "nextcloud", label: "Nextcloud" },
  { value: "owncloud", label: "ownCloud" },
  { value: "sharepoint", label: "SharePoint" },
  { value: "other", label: "Other WebDAV" },
];

// SFTP server software options
const SFTP_VENDORS = [
  { value: "sftpgo", label: "SFTPGo" },
  { value: "openssh", label: "OpenSSH" },
  { value: "other", label: "Other SFTP Server" },
];

export function AddConnection({ onNavigate }: AddConnectionProps = {}) {
  const { add } = useConnectionStore();
  const { addLog } = useLogStore();

  const [remoteType, setRemoteType] = useState<RemoteTypeId>("webdav");
  const [testing, setTesting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  // Common fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [driveLetter, setDriveLetter] = useState("Z");
  const [availableLetters, setAvailableLetters] = useState<string[]>([]);
  const [networkMode, setNetworkMode] = useState<"auto" | "local" | "tailscale">("auto");
  const [speedProfile, setSpeedProfile] = useState<"max" | "balanced" | "low">("balanced");
  const [autoMount, setAutoMount] = useState(true);
  const [dualMount, setDualMount] = useState(false);
  const [archiveDriveLetter, setArchiveDriveLetter] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cacheOverrides, setCacheOverrides] = useState<Partial<CacheOverrides>>({});
  const [customFlags, setCustomFlags] = useState("");

  // WebDAV / SFTP / FTP / SMB fields
  const [host, setHost] = useState("");
  const [tailscaleIp, setTailscaleIp] = useState("");
  const [port, setPort] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [webdavVendor, setWebdavVendor] = useState("copyparty");
  const [sftpVendor, setSftpVendor] = useState("sftpgo");

  // S3 fields
  const [s3Provider, setS3Provider] = useState("AWS");
  const [s3AccessKey, setS3AccessKey] = useState("");
  const [s3SecretKey, setS3SecretKey] = useState("");
  const [s3Region, setS3Region] = useState("us-east-1");
  const [s3Endpoint, setS3Endpoint] = useState("");
  const [s3Bucket, setS3Bucket] = useState("");

  // Default ports per type
  const defaultPorts: Record<RemoteTypeId, string> = {
    webdav: "80",
    sftp: "22",
    smb: "445",
    s3: "",
    ftp: "21",
  };

  useEffect(() => {
    invoke<string[]>("get_available_drives").then((letters) => {
      setAvailableLetters(letters);
      // If default "Z" isn't available, pick the last available letter
      if (letters.length > 0 && !letters.includes("Z")) {
        setDriveLetter(letters[letters.length - 1]);
      }
    }).catch(() => {});
    // Set initial port based on default remote type
    setPort(defaultPorts["webdav"]);
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

  const handleTypeChange = (type: RemoteTypeId) => {
    setRemoteType(type);
    setPort(defaultPorts[type]);
    setTestResult(null);
  };

  const getTestHost = () => host;
  const getTestPort = () => parseInt(port) || 0;

  const buildRcloneParams = (): Record<string, string> => {
    switch (remoteType) {
      case "webdav":
        return {
          url: `http://${host}:${port}`,
          vendor: webdavVendor,
          user: username,
          pass: password,
        };
      case "sftp":
        return {
          host,
          port,
          user: username,
          pass: password,
        };
      case "smb":
        return {
          host,
          user: username,
          pass: password,
        };
      case "s3":
        return {
          provider: s3Provider,
          access_key_id: s3AccessKey,
          secret_access_key: s3SecretKey,
          region: s3Region,
          ...(s3Endpoint ? { endpoint: s3Endpoint } : {}),
        };
      case "ftp":
        return {
          host,
          port,
          user: username,
          pass: password,
        };
    }
  };

  const validateForm = () => {
    if (!name.trim()) {
      toast.error("Connection name is required");
      return false;
    }
    if (!driveLetter.trim()) {
      toast.error("Drive letter is required");
      return false;
    }
    if (remoteType !== "s3" && !host.trim()) {
      toast.error("Host / IP address is required");
      return false;
    }
    if (remoteType === "s3" && (!s3AccessKey || !s3SecretKey)) {
      toast.error("S3 access key and secret key are required");
      return false;
    }
    return true;
  };

  const handleTestConnection = async () => {
    if (!validateForm()) return;

    setTesting(true);
    setTestResult(null);

    try {
      if (remoteType === "s3") {
        toast.success("S3 config looks valid (start mount to verify credentials)");
        setTestResult("success");
        setTesting(false);
        return;
      }

      const testHost = getTestHost();
      const testPort = getTestPort();
      let anySuccess = false;

      // Test local IP
      addLog("info", `Testing local ${testHost}:${testPort}...`, "network");
      const localReachable = await invoke<boolean>("ping_port", {
        ip: testHost,
        port: testPort,
        timeoutMs: 3000,
      });
      if (localReachable) {
        addLog("success", `Local (${testHost}:${testPort}): reachable`, "network");
        anySuccess = true;
      } else {
        addLog("error", `Local (${testHost}:${testPort}): unreachable`, "network");
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
      const msg = err instanceof Error ? err.message : String(err);
      addLog("error", `Test failed: ${msg}`, "network");
      toast.error(`Test failed: ${msg}`);
    } finally {
      setTesting(false);
    }
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    setCreating(true);
    addLog("info", `Creating rclone remote "${name}" (${remoteType})...`, "mounts");

    try {
      await invoke("create_remote", {
        name,
        remoteType,
        params: buildRcloneParams(),
      });

      const vendor = remoteType === "webdav" ? webdavVendor
        : remoteType === "sftp" ? sftpVendor
        : "";

      const connection: Connection = {
        id: crypto.randomUUID(),
        name,
        description,
        remote_type: remoteType,
        local_ip: remoteType === "s3" ? "" : host,
        tailscale_ip: tailscaleIp,
        port: parseInt(port) || 0,
        drive_letter: driveLetter,
        protocol: remoteType,
        vendor,
        username,
        network_mode: networkMode,
        speed_profile: speedProfile,
        auto_mount: autoMount,
        sort_order: Date.now(),
        created_at: new Date().toISOString(),
        cache_overrides: Object.values(cacheOverrides).some(v => v !== undefined) ? cacheOverrides as CacheOverrides : undefined,
        custom_flags: customFlags.split("\n").map(s => s.trim()).filter(Boolean),
        dual_mount: dualMount,
        archive_drive_letter: dualMount && archiveDriveLetter ? archiveDriveLetter : undefined,
      };

      add(connection);
      addLog("success", `Remote "${name}" created`, "mounts");
      toast.success(`Created mount "${name}"`);
      onNavigate?.("dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog("error", `Failed to create remote: ${msg}`, "mounts");
      toast.error(`Failed to create: ${msg}`);
    } finally {
      setCreating(false);
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
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight mb-2">
            Add New Mount
          </h1>
          <p className="text-[13px] text-text-secondary">
            Connect to a remote storage and mount it as a local drive
          </p>
        </div>

        <div className="space-y-6">
          {/* Connection Type */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Cloud size={18} weight="duotone" className="text-accent-blue" />
              Connection Type
            </h2>
            <div className="grid grid-cols-5 gap-2">
              {REMOTE_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = remoteType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => handleTypeChange(type.id)}
                    className={`p-3 rounded-lg border transition-all duration-150 text-left ${
                      isSelected
                        ? "bg-accent-blue/10 border-accent-blue/40"
                        : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05]"
                    }`}
                  >
                    <Icon
                      size={20}
                      weight="duotone"
                      className={`mb-1.5 ${isSelected ? "text-accent-blue" : "text-text-tertiary"}`}
                    />
                    <div
                      className={`text-[13px] font-medium mb-0.5 ${
                        isSelected ? "text-accent-blue" : "text-text-primary"
                      }`}
                    >
                      {type.label}
                    </div>
                    <div className="text-[10px] text-text-tertiary leading-tight">
                      {type.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

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
                  placeholder="e.g., Home Server, NAS"
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

          {/* Type-specific fields */}
          {remoteType === "webdav" && (
            <Card className="p-6">
              <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Globe size={18} weight="duotone" className="text-accent-purple" />
                WebDAV Settings
              </h2>
              <div className="space-y-4">
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
                      <option key={v.value} value={v.value}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <Input
                      label="Host / IP (LAN)"
                      placeholder="192.168.x.x"
                      value={host}
                      onChange={(e) => { setHost(e.target.value); setTestResult(null); }}
                      hint="Local network address"
                    />
                  </div>
                  <Input
                    label="Port"
                    type="number"
                    placeholder="80"
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

          {(remoteType === "sftp" || remoteType === "ftp") && (
            <Card className="p-6">
              <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Desktop size={18} weight="duotone" className="text-accent-purple" />
                {remoteType.toUpperCase()} Settings
              </h2>
              <div className="space-y-4">
                {remoteType === "sftp" && (
                  <div>
                    <label className="block text-[13px] font-medium text-text-secondary mb-2">
                      Server Software
                    </label>
                    <select
                      value={sftpVendor}
                      onChange={(e) => setSftpVendor(e.target.value)}
                      className="w-full bg-bg-overlay border border-border-default rounded-lg px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-accent-blue/60"
                    >
                      {SFTP_VENDORS.map((v) => (
                        <option key={v.value} value={v.value}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                    {sftpVendor === "sftpgo" && (
                      <p className="text-[11px] text-text-tertiary mt-1.5">
                        Add custom rclone flags in Advanced Settings below (e.g. --sftp-set-modtime=false for object-storage backends).
                      </p>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <Input
                      label="Host / IP (LAN)"
                      placeholder="192.168.x.x"
                      value={host}
                      onChange={(e) => { setHost(e.target.value); setTestResult(null); }}
                      hint="Local network address"
                    />
                  </div>
                  <Input
                    label="Port"
                    type="number"
                    placeholder={remoteType === "sftp" ? "22" : "21"}
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

          {remoteType === "smb" && (
            <Card className="p-6">
              <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Desktop size={18} weight="duotone" className="text-accent-amber" />
                SMB / Samba Settings
              </h2>
              <div className="space-y-4">
                <Input
                  label="Host / IP"
                  placeholder="192.168.1.x or \\\\SERVER\\share"
                  value={host}
                  onChange={(e) => { setHost(e.target.value); setTestResult(null); }}
                />
                <Input
                  label="Tailscale IP (optional)"
                  placeholder="100.x.x.x"
                  value={tailscaleIp}
                  onChange={(e) => setTailscaleIp(e.target.value)}
                />
              </div>
            </Card>
          )}

          {remoteType === "s3" && (
            <Card className="p-6">
              <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Cloud size={18} weight="duotone" className="text-accent-green" />
                S3 Settings
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-text-secondary mb-2">
                    Provider
                  </label>
                  <select
                    value={s3Provider}
                    onChange={(e) => setS3Provider(e.target.value)}
                    className="w-full bg-bg-overlay border border-border-default rounded-lg px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-accent-blue/60"
                  >
                    {["AWS", "MinIO", "Backblaze", "Wasabi", "Other"].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Access Key ID"
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                    value={s3AccessKey}
                    onChange={(e) => setS3AccessKey(e.target.value)}
                  />
                  <Input
                    label="Secret Access Key"
                    type="password"
                    placeholder="••••••••"
                    value={s3SecretKey}
                    onChange={(e) => setS3SecretKey(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Region"
                    placeholder="us-east-1"
                    value={s3Region}
                    onChange={(e) => setS3Region(e.target.value)}
                  />
                  <Input
                    label="Bucket"
                    placeholder="my-bucket"
                    value={s3Bucket}
                    onChange={(e) => setS3Bucket(e.target.value)}
                  />
                </div>
                <Input
                  label="Custom Endpoint (optional)"
                  placeholder="https://s3.example.com"
                  value={s3Endpoint}
                  onChange={(e) => setS3Endpoint(e.target.value)}
                  hint="For MinIO or other S3-compatible services"
                />
              </div>
            </Card>
          )}

          {/* Authentication (not S3 — it uses keys above) */}
          {remoteType !== "s3" && (
            <Card className="p-6">
              <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Lock size={18} weight="duotone" className="text-accent-amber" />
                Authentication
              </h2>
              <div className="space-y-4">
                <Input
                  label="Username"
                  placeholder="admin"
                  icon={User}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  icon={Lock}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                    <span
                      className={`text-[13px] font-medium ${
                        networkMode === mode.value ? "text-accent-blue" : "text-text-primary"
                      }`}
                    >
                      {mode.label}
                    </span>
                    {networkMode === mode.value && (
                      <Check size={14} weight="bold" className="text-accent-blue" />
                    )}
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
                    <span
                      className={`text-[13px] font-semibold ${
                        speedProfile === profile.value ? "text-accent-green" : "text-text-primary"
                      }`}
                    >
                      {profile.label}
                    </span>
                    {speedProfile === profile.value && (
                      <Check size={14} weight="bold" className="text-accent-green" />
                    )}
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
                  onClick={() => { setCacheOverrides({}); setCustomFlags(""); }}
                  className="text-text-tertiary"
                >
                  Reset to Defaults
                </Button>

                {/* Custom rclone flags */}
                <div className="pt-3 border-t border-white/[0.06]">
                  <label className="block text-[13px] font-medium text-text-secondary mb-2">
                    Extra Rclone Flags
                  </label>
                  <textarea
                    value={customFlags}
                    onChange={(e) => setCustomFlags(e.target.value)}
                    placeholder="--sftp-set-modtime=false&#10;--sftp-disable-hashcheck&#10;--checkers 8"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue/50 font-mono resize-y"
                  />
                  <p className="text-[11px] text-text-tertiary mt-1">
                    One flag per line. Appended to the rclone mount command after all other settings.
                  </p>
                </div>
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
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="md"
              className={`gap-2 ${
                testResult === "success"
                  ? "border-accent-green/40 text-accent-green"
                  : testResult === "error"
                  ? "border-accent-red/40 text-accent-red"
                  : ""
              }`}
              onClick={handleTestConnection}
              disabled={testing || creating}
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
              onClick={handleCreate}
              disabled={creating || testing}
            >
              {creating ? (
                <CircleNotch size={16} weight="bold" className="animate-spin" />
              ) : (
                <Check size={16} weight="bold" />
              )}
              {creating ? "Creating..." : "Create Mount"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

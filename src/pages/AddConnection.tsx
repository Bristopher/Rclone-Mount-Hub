import { useState } from "react";
import {
  HardDrive,
  Globe,
  Lock,
  User,
  Lightning,
  Check,
  ArrowLeft,
  CircleNotch,
} from "phosphor-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useConnectionStore } from "../lib/store";
import { useLogStore } from "../lib/logStore";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type { Connection } from "../lib/types";

interface AddConnectionProps {
  onNavigate?: (page: string) => void;
}

export function AddConnection({ onNavigate }: AddConnectionProps = {}) {
  const { add } = useConnectionStore();
  const { addLog } = useLogStore();

  const [formData, setFormData] = useState({
    name: "",
    localIp: "192.168.1.x",
    tailscaleIp: "",
    port: "80",
    driveLetter: "Z",
    username: "",
    password: "",
    networkMode: "auto" as "auto" | "local" | "tailscale",
    speedProfile: "balanced" as "max" | "balanced" | "low",
    autoMount: true,
  });

  const [testing, setTesting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  const updateField = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTestResult(null);
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error("Connection name is required");
      return false;
    }
    if (!formData.localIp.trim()) {
      toast.error("Local IP address is required");
      return false;
    }
    if (!formData.driveLetter.trim()) {
      toast.error("Drive letter is required");
      return false;
    }
    return true;
  };

  const handleTestConnection = async () => {
    if (!validateForm()) return;

    setTesting(true);
    setTestResult(null);
    addLog("info", `Testing connection to ${formData.localIp}:${formData.port}...`, "network");

    try {
      const reachable = await invoke<boolean>("ping_port", {
        host: formData.localIp,
        port: parseInt(formData.port),
        timeoutMs: 3000,
      });

      if (reachable) {
        setTestResult("success");
        addLog("success", `Connection to ${formData.localIp}:${formData.port} successful`, "network");
        toast.success("Connection test passed");
      } else {
        setTestResult("error");
        addLog("error", `Cannot reach ${formData.localIp}:${formData.port}`, "network");
        toast.error(`Cannot reach ${formData.localIp}:${formData.port}`);
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
    addLog("info", `Creating rclone remote "${formData.name}"...`, "mounts");

    try {
      // Create the rclone remote with credentials
      await invoke("create_remote", {
        name: formData.name,
        url: `http://${formData.localIp}:${formData.port}`,
        vendor: "copyparty",
        user: formData.username,
        pass: formData.password,
      });

      // Save connection to the store
      const connection: Connection = {
        id: crypto.randomUUID(),
        name: formData.name,
        local_ip: formData.localIp,
        tailscale_ip: formData.tailscaleIp,
        port: parseInt(formData.port),
        drive_letter: formData.driveLetter,
        protocol: "webdav",
        username: formData.username,
        network_mode: formData.networkMode,
        speed_profile: formData.speedProfile,
        auto_mount: formData.autoMount,
        sort_order: Date.now(),
        created_at: new Date().toISOString(),
      };

      add(connection);
      addLog("success", `Remote "${formData.name}" created and saved`, "mounts");
      toast.success(`Created mount "${formData.name}"`);
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
            Connect to your Unraid server, NAS, or cloud storage via WebDAV
          </p>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* Basic Info */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <HardDrive size={18} weight="duotone" className="text-accent-blue" />
              Basic Information
            </h2>
            <div className="space-y-4">
              <Input
                label="Connection Name"
                placeholder="e.g., MyNAS, Media Server"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Drive Letter"
                  placeholder="Z"
                  maxLength={1}
                  value={formData.driveLetter}
                  onChange={(e) =>
                    updateField("driveLetter", e.target.value.toUpperCase())
                  }
                />
                <Input
                  label="Port"
                  type="number"
                  placeholder="80"
                  value={formData.port}
                  onChange={(e) => updateField("port", e.target.value)}
                />
              </div>
            </div>
          </Card>

          {/* Network Settings */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Globe size={18} weight="duotone" className="text-accent-purple" />
              Network Configuration
            </h2>
            <div className="space-y-4">
              <Input
                label="Local IP Address (LAN)"
                placeholder="192.168.1.x"
                value={formData.localIp}
                onChange={(e) => updateField("localIp", e.target.value)}
                hint="Used when connected to your home network"
              />
              <Input
                label="Tailscale IP Address (Optional)"
                placeholder="100.x.x.x"
                value={formData.tailscaleIp}
                onChange={(e) => updateField("tailscaleIp", e.target.value)}
                hint="Used when away from home"
              />

              {/* Network Mode Selector */}
              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-2">
                  Network Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "auto", label: "Auto", desc: "Smart switching" },
                    { value: "local", label: "LAN Only", desc: "Local network" },
                    { value: "tailscale", label: "Tailscale", desc: "Remote access" },
                  ].map((mode) => (
                    <button
                      key={mode.value}
                      onClick={() => updateField("networkMode", mode.value)}
                      className={`
                        p-3 rounded-lg border transition-all duration-150 text-left
                        ${
                          formData.networkMode === mode.value
                            ? "bg-accent-blue/10 border-accent-blue/40 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                            : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05]"
                        }
                      `}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-[13px] font-medium ${
                            formData.networkMode === mode.value
                              ? "text-accent-blue"
                              : "text-text-primary"
                          }`}
                        >
                          {mode.label}
                        </span>
                        {formData.networkMode === mode.value && (
                          <Check size={14} weight="bold" className="text-accent-blue" />
                        )}
                      </div>
                      <span className="text-[11px] text-text-tertiary">
                        {mode.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Authentication */}
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
                value={formData.username}
                onChange={(e) => updateField("username", e.target.value)}
              />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                icon={Lock}
                value={formData.password}
                onChange={(e) => updateField("password", e.target.value)}
              />
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
                {
                  value: "max",
                  label: "Max Speed",
                  cache: "50 GB",
                  desc: "10Gbps LAN, Fiber",
                },
                {
                  value: "balanced",
                  label: "Balanced",
                  cache: "10 GB",
                  desc: "Daily use (Recommended)",
                },
                {
                  value: "low",
                  label: "Low Resource",
                  cache: "2 GB",
                  desc: "Battery, slow WiFi",
                },
              ].map((profile) => (
                <button
                  key={profile.value}
                  onClick={() => updateField("speedProfile", profile.value)}
                  className={`
                    p-4 rounded-lg border transition-all duration-150 text-left
                    ${
                      formData.speedProfile === profile.value
                        ? "bg-accent-green/10 border-accent-green/40 shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                        : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05]"
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[13px] font-semibold ${
                        formData.speedProfile === profile.value
                          ? "text-accent-green"
                          : "text-text-primary"
                      }`}
                    >
                      {profile.label}
                    </span>
                    {formData.speedProfile === profile.value && (
                      <Check size={14} weight="bold" className="text-accent-green" />
                    )}
                  </div>
                  <div className="text-[11px] text-text-tertiary mb-1">
                    Cache: {profile.cache}
                  </div>
                  <div className="text-[11px] text-text-tertiary">
                    {profile.desc}
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Auto-mount Toggle */}
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
              onClick={() => updateField("autoMount", !formData.autoMount)}
              className={`
                relative w-11 h-6 rounded-full transition-all duration-200
                ${
                  formData.autoMount
                    ? "bg-accent-blue shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                    : "bg-white/[0.15]"
                }
              `}
            >
              <div
                className={`
                  absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200
                  ${formData.autoMount ? "left-[22px]" : "left-0.5"}
                `}
              />
            </button>
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
              className={`gap-2 ${testResult === "success" ? "border-accent-green/40 text-accent-green" : testResult === "error" ? "border-accent-red/40 text-accent-red" : ""}`}
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

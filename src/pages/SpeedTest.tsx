import { useState } from "react";
import {
  Gauge,
  Play,
  ArrowUp,
  ArrowDown,
  Timer,
  Warning,
  HardDrive,
  GitBranch,
  CloudArrowUp,
  Check,
} from "phosphor-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

interface SpeedTestResult {
  upload_mbps: number;
  download_mbps: number;
  latency_ms: number;
  bottleneck: "network" | "disk" | "rclone";
  network_type: "local" | "tailscale";
}

interface NetworkPathResult {
  is_local: boolean;
  is_vpn: boolean;
  hops: Array<{ ip: string; latency_ms: number }>;
}

export function SpeedTest() {
  const [selectedDrive, setSelectedDrive] = useState("Z");
  const [fileSize, setFileSize] = useState<10 | 100 | 1000>(100);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SpeedTestResult | null>(null);

  const [targetIp, setTargetIp] = useState("");
  const [analyzingPath, setAnalyzingPath] = useState(false);
  const [pathResult, setPathResult] = useState<NetworkPathResult | null>(null);

  const [benchmarkingDisk, setBenchmarkingDisk] = useState(false);
  const [diskSpeed, setDiskSpeed] = useState<number | null>(null);

  // Run speed test
  const handleRunSpeedTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await invoke<SpeedTestResult>("run_speed_test", {
        driveLetter: selectedDrive,
        fileSizeMb: fileSize,
      });
      setResult(res);
      toast.success("Speed test completed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speed test failed");
    } finally {
      setLoading(false);
    }
  };

  // Analyze network path
  const handleAnalyzePath = async () => {
    if (!targetIp.trim()) {
      toast.error("Please enter a target IP address");
      return;
    }
    setAnalyzingPath(true);
    setPathResult(null);
    try {
      const res = await invoke<NetworkPathResult>("analyze_network_path", {
        targetIp,
      });
      setPathResult(res);
      toast.success("Network path analyzed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Path analysis failed");
    } finally {
      setAnalyzingPath(false);
    }
  };

  // Benchmark local disk
  const handleBenchmarkDisk = async () => {
    setBenchmarkingDisk(true);
    setDiskSpeed(null);
    try {
      const speed = await invoke<number>("test_local_disk_speed");
      setDiskSpeed(speed);
      toast.success("Disk benchmark completed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Disk benchmark failed");
    } finally {
      setBenchmarkingDisk(false);
    }
  };

  const getBottleneckColor = (bottleneck: string) => {
    switch (bottleneck) {
      case "network":
        return "text-accent-blue";
      case "disk":
        return "text-accent-amber";
      case "rclone":
        return "text-accent-purple";
      default:
        return "text-text-secondary";
    }
  };

  return (
    <div className="h-full overflow-y-auto content-scroll">
      <div className="px-10 py-8 pb-12 max-w-3xl w-full mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight mb-2 flex items-center gap-3">
            <Gauge size={28} weight="duotone" className="text-accent-blue" />
            Speed Test & Diagnostics
          </h1>
          <p className="text-[13px] text-text-secondary">
            Test transfer speeds and identify performance bottlenecks
          </p>
        </div>

        <div className="space-y-6">
          {/* Section A - Test Controls */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Play size={18} weight="duotone" className="text-accent-green" />
              Run Speed Test
            </h2>
            <div className="space-y-4">
              {/* Drive Letter */}
              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-2">
                  Drive Letter
                </label>
                <Input
                  placeholder="Z"
                  maxLength={1}
                  value={selectedDrive}
                  onChange={(e) => setSelectedDrive(e.target.value.toUpperCase())}
                />
              </div>

              {/* File Size */}
              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-2">
                  Test File Size
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 10, label: "10 MB", desc: "Quick test" },
                    { value: 100, label: "100 MB", desc: "Recommended" },
                    { value: 1000, label: "1 GB", desc: "Thorough" },
                  ].map((size) => (
                    <button
                      key={size.value}
                      onClick={() => setFileSize(size.value as 10 | 100 | 1000)}
                      className={`
                        p-3 rounded-lg border transition-all duration-150 text-left
                        ${
                          fileSize === size.value
                            ? "bg-accent-green/10 border-accent-green/40 shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                            : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05]"
                        }
                      `}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-[13px] font-medium ${
                            fileSize === size.value
                              ? "text-accent-green"
                              : "text-text-primary"
                          }`}
                        >
                          {size.label}
                        </span>
                        {fileSize === size.value && (
                          <Check size={14} weight="bold" className="text-accent-green" />
                        )}
                      </div>
                      <span className="text-[11px] text-text-tertiary">
                        {size.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Run Button */}
              <Button
                variant="primary"
                size="md"
                onClick={handleRunSpeedTest}
                disabled={loading || !selectedDrive}
                className="gap-2 w-full"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Running Test...
                  </>
                ) : (
                  <>
                    <Play size={16} weight="bold" />
                    Run Speed Test
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Section B - Results */}
          {result && (
            <Card className="p-6">
              <h2 className="text-base font-semibold text-text-primary mb-5 flex items-center gap-2">
                <Gauge size={18} weight="duotone" className="text-accent-blue" />
                Test Results
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {/* Upload Speed */}
                <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowUp size={16} className="text-accent-green" weight="bold" />
                    <span className="text-[13px] font-medium text-text-secondary">
                      Upload
                    </span>
                  </div>
                  <div className="text-2xl font-semibold text-text-primary">
                    {result.upload_mbps.toFixed(1)}
                    <span className="text-base text-text-tertiary ml-1">MB/s</span>
                  </div>
                </div>

                {/* Download Speed */}
                <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowDown size={16} className="text-accent-blue" weight="bold" />
                    <span className="text-[13px] font-medium text-text-secondary">
                      Download
                    </span>
                  </div>
                  <div className="text-2xl font-semibold text-text-primary">
                    {result.download_mbps.toFixed(1)}
                    <span className="text-base text-text-tertiary ml-1">MB/s</span>
                  </div>
                </div>

                {/* Latency */}
                <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-2">
                    <Timer size={16} className="text-accent-amber" weight="bold" />
                    <span className="text-[13px] font-medium text-text-secondary">
                      Latency
                    </span>
                  </div>
                  <div className="text-2xl font-semibold text-text-primary">
                    {result.latency_ms}
                    <span className="text-base text-text-tertiary ml-1">ms</span>
                  </div>
                </div>

                {/* Bottleneck */}
                <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-2">
                    <Warning size={16} className="text-accent-red" weight="bold" />
                    <span className="text-[13px] font-medium text-text-secondary">
                      Bottleneck
                    </span>
                  </div>
                  <div className={`text-lg font-semibold capitalize ${getBottleneckColor(result.bottleneck)}`}>
                    {result.bottleneck}
                  </div>
                </div>
              </div>

              {/* Network Type Badge */}
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <Badge variant={result.network_type === "local" ? "local" : "tailscale"}>
                  {result.network_type === "local" ? "Local Network" : "Tailscale VPN"}
                </Badge>
              </div>
            </Card>
          )}

          {/* Section C - Network Path Analysis */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <GitBranch size={18} weight="duotone" className="text-accent-purple" />
              Network Path Analysis
            </h2>
            <div className="space-y-4">
              <Input
                label="Target IP Address"
                placeholder="192.168.x.x"
                value={targetIp}
                onChange={(e) => setTargetIp(e.target.value)}
              />
              <Button
                variant="default"
                size="md"
                onClick={handleAnalyzePath}
                disabled={analyzingPath || !targetIp.trim()}
                className="gap-2"
              >
                {analyzingPath ? (
                  <>
                    <div className="w-4 h-4 border-2 border-text-primary/30 border-t-text-primary rounded-full animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <GitBranch size={16} weight="bold" />
                    Analyze Path
                  </>
                )}
              </Button>

              {pathResult && (
                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-3">
                    {pathResult.is_local && <Badge variant="local">Local Network</Badge>}
                    {pathResult.is_vpn && <Badge variant="tailscale">VPN</Badge>}
                  </div>
                  {pathResult.hops.length > 0 && (
                    <div>
                      <div className="text-[13px] font-medium text-text-secondary mb-2">
                        Network Hops
                      </div>
                      <div className="space-y-2">
                        {pathResult.hops.map((hop, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]"
                          >
                            <span className="text-[13px] text-text-primary font-mono">
                              {hop.ip}
                            </span>
                            <span className="text-[13px] text-text-tertiary">
                              {hop.latency_ms}ms
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Section D - Local Disk Benchmark */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <HardDrive size={18} weight="duotone" className="text-accent-amber" />
              Local Disk Benchmark
            </h2>
            <div className="space-y-4">
              <p className="text-[13px] text-text-secondary">
                Test your local disk's read/write performance
              </p>
              <Button
                variant="default"
                size="md"
                onClick={handleBenchmarkDisk}
                disabled={benchmarkingDisk}
                className="gap-2"
              >
                {benchmarkingDisk ? (
                  <>
                    <div className="w-4 h-4 border-2 border-text-primary/30 border-t-text-primary rounded-full animate-spin" />
                    Benchmarking...
                  </>
                ) : (
                  <>
                    <CloudArrowUp size={16} weight="bold" />
                    Benchmark Local Disk
                  </>
                )}
              </Button>

              {diskSpeed !== null && (
                <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-2">
                    <HardDrive size={16} className="text-accent-amber" weight="bold" />
                    <span className="text-[13px] font-medium text-text-secondary">
                      Disk Speed
                    </span>
                  </div>
                  <div className="text-2xl font-semibold text-text-primary">
                    {diskSpeed.toFixed(1)}
                    <span className="text-base text-text-tertiary ml-1">MB/s</span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  HardDrives,
  Plus,
  Gauge,
  GearSix,
  Export,
  CirclesFour,
} from "phosphor-react";
import { clsx } from "clsx";
import { invoke } from "@tauri-apps/api/core";

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const mainNav = [
  { id: "dashboard", label: "Overview", icon: CirclesFour },
  { id: "add", label: "Add Connection", icon: Plus },
];

const toolsNav = [
  { id: "speedtest", label: "Speed Test", icon: Gauge },
  { id: "export", label: "Export", icon: Export },
  { id: "settings", label: "Settings", icon: GearSix },
];

function NavButton({
  item,
  isActive,
  onClick,
}: {
  item: { id: string; label: string; icon: React.ElementType };
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] font-medium transition-all duration-150 cursor-pointer",
        "outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/50",
        isActive
          ? "bg-white/[0.09] text-text-primary shadow-[inset_0_0.5px_0_rgba(255,255,255,0.06)]"
          : "text-text-secondary hover:text-text-primary hover:bg-white/[0.04] active:bg-white/[0.07]"
      )}
    >
      <Icon
        size={18}
        weight={isActive ? "fill" : "regular"}
        className={clsx(
          "flex-shrink-0 transition-colors duration-150",
          isActive ? "text-text-primary" : "text-text-tertiary"
        )}
      />
      {item.label}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 mb-1.5 mt-4 first:mt-0">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary/70">
        {children}
      </span>
    </div>
  );
}

interface DriverVersions {
  rclone_installed: boolean;
  rclone_version: string | null;
  winfsp_installed: boolean;
  winfsp_version: string | null;
}

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const [driverVersions, setDriverVersions] = useState<DriverVersions | null>(null);
  const [activeMountCount, setActiveMountCount] = useState(0);

  useEffect(() => {
    loadDriverVersions();
    refreshActiveMounts();

    const interval = setInterval(() => {
      loadDriverVersions();
      refreshActiveMounts();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadDriverVersions = async () => {
    try {
      const versions = await invoke<DriverVersions>("get_driver_versions");
      setDriverVersions(versions);
    } catch (err) {
      console.error("Failed to get driver versions:", err);
    }
  };

  const refreshActiveMounts = async () => {
    try {
      const [managedStatuses, externalMounts] = await Promise.all([
        invoke<Record<string, { state: string }>>("get_all_mount_statuses"),
        invoke<unknown[]>("list_external_rclone_mounts"),
      ]);
      const managedActive = Object.values(managedStatuses).filter(
        (s) => s.state === "mounted"
      ).length;
      setActiveMountCount(managedActive + externalMounts.length);
    } catch {
      // silently ignore
    }
  };

  return (
    <div className="w-[220px] h-full bg-bg-base/50 backdrop-blur-2xl border-r border-white/[0.06] flex flex-col select-none">
      {/* App identity */}
      <div className="px-4 pt-3.5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] rounded-[8px] bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center shadow-lg shadow-accent-blue/20">
            <HardDrives size={16} weight="bold" className="text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-text-primary leading-tight truncate">
              Mount Hub
            </h2>
            <p className="text-[11px] text-text-tertiary leading-tight">
              {activeMountCount} active
            </p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 h-px bg-white/[0.06]" />

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-2.5 pt-2 pb-3 sidebar-scroll">
        <SectionLabel>Drives</SectionLabel>
        <nav className="flex flex-col gap-0.5">
          {mainNav.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={currentPage === item.id}
              onClick={() => onNavigate(item.id)}
            />
          ))}
        </nav>

        <SectionLabel>Tools</SectionLabel>
        <nav className="flex flex-col gap-0.5">
          {toolsNav.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={currentPage === item.id}
              onClick={() => onNavigate(item.id)}
            />
          ))}
        </nav>
      </div>

      {/* Bottom info - Driver Status */}
      <div className="px-4 py-3 border-t border-white/[0.06]">
        {driverVersions ? (
          <>
            <div className="flex items-center gap-2">
              <div
                className={clsx(
                  "w-1.5 h-1.5 rounded-full",
                  driverVersions.rclone_installed
                    ? "bg-accent-green shadow-[0_0_6px_rgba(34,197,94,0.5)]"
                    : "bg-accent-red shadow-[0_0_6px_rgba(239,68,68,0.5)]"
                )}
              />
              <span className="text-[11px] text-text-tertiary">
                {driverVersions.rclone_installed
                  ? `rclone ${driverVersions.rclone_version || "installed"}`
                  : "rclone missing"}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div
                className={clsx(
                  "w-1.5 h-1.5 rounded-full",
                  driverVersions.winfsp_installed
                    ? "bg-accent-green shadow-[0_0_6px_rgba(34,197,94,0.5)]"
                    : "bg-accent-red shadow-[0_0_6px_rgba(239,68,68,0.5)]"
                )}
              />
              <span className="text-[11px] text-text-tertiary">
                {driverVersions.winfsp_installed
                  ? `WinFsp ${driverVersions.winfsp_version || "ready"}`
                  : "WinFsp missing"}
              </span>
            </div>
          </>
        ) : (
          <span className="text-[11px] text-text-tertiary">Checking drivers...</span>
        )}
      </div>
    </div>
  );
}

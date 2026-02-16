import { HardDrives, Plus, Gauge, Gear, Export } from "phosphor-react";
import { clsx } from "clsx";

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: "dashboard", label: "Drives", icon: HardDrives },
  { id: "add", label: "Add Connection", icon: Plus },
  { id: "speedtest", label: "Speed Test", icon: Gauge },
  { id: "settings", label: "Settings", icon: Gear },
  { id: "export", label: "Export", icon: Export },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <div className="w-56 h-full bg-bg-base/80 backdrop-blur-xl border-r border-border-default flex flex-col">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center">
            <HardDrives size={18} weight="bold" className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Mounts</h2>
            <p className="text-xs text-text-tertiary">0 active</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-accent-blue/15 text-accent-blue border border-accent-blue/30"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-overlay"
                )}
              >
                <Icon size={18} weight={isActive ? "fill" : "regular"} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom section */}
      <div className="p-4 border-t border-border-default">
        <div className="text-xs text-text-tertiary space-y-1">
          <p>rclone v1.68.2</p>
          <p>WinFsp installed</p>
        </div>
      </div>
    </div>
  );
}

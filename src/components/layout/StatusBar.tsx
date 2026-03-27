import { clsx } from "clsx";
import { CaretUp, CaretDown, Terminal } from "phosphor-react";
import { useLogStore } from "../../lib/logStore";
import { getVersion } from "@tauri-apps/api/app";
import { useState, useEffect } from "react";

interface StatusBarProps {
  mountedCount: number;
  networkStatus: "local" | "tailscale" | "offline";
}

export function StatusBar({ mountedCount, networkStatus }: StatusBarProps) {
  const { isOpen, toggleOpen, logs, filter } = useLogStore();
  const filteredLogs = filter === "all"
    ? logs
    : logs.filter(log => log.category === filter);
  const [appVersion, setAppVersion] = useState("");
  useEffect(() => { getVersion().then(setAppVersion).catch(() => {}); }, []);

  return (
    <div className="h-[26px] px-3 bg-bg-base/80 backdrop-blur-md border-t border-white/[0.06] flex items-center justify-between text-[11px] text-text-tertiary select-none">
      <div className="flex items-center gap-3">
        <span>
          {mountedCount} {mountedCount === 1 ? "mount" : "mounts"} active
        </span>
        <div className="w-px h-3 bg-white/[0.08]" />
        <div className="flex items-center gap-1.5">
          <div
            className={clsx(
              "w-[6px] h-[6px] rounded-full transition-colors duration-200",
              networkStatus === "local" &&
                "bg-accent-green shadow-[0_0_4px_rgba(34,197,94,0.5)]",
              networkStatus === "tailscale" &&
                "bg-accent-purple shadow-[0_0_4px_rgba(168,85,247,0.5)]",
              networkStatus === "offline" && "bg-text-tertiary"
            )}
          />
          <span>
            {networkStatus === "local" && "LAN"}
            {networkStatus === "tailscale" && "Tailscale"}
            {networkStatus === "offline" && "Offline"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Log Toggle Button */}
        <button
          onClick={toggleOpen}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-white/[0.05] transition-colors group"
        >
          <Terminal size={12} weight="duotone" className="text-accent-blue" />
          <span className="group-hover:text-text-primary transition-colors">
            {isOpen ? "Hide Logs" : "Show Logs"}
          </span>
          {!isOpen && logs.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-accent-blue/20 text-accent-blue text-[10px] font-bold">
              {filteredLogs.length}
            </span>
          )}
          {isOpen ? (
            <CaretDown size={12} weight="bold" className="text-accent-blue" />
          ) : (
            <CaretUp size={12} weight="bold" className="text-accent-blue" />
          )}
        </button>

        <div className="w-px h-3 bg-white/[0.08]" />
        {appVersion && <span className="opacity-50">v{appVersion}</span>}
      </div>
    </div>
  );
}

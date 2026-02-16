import { clsx } from "clsx";

interface StatusBarProps {
  mountedCount: number;
  networkStatus: "local" | "tailscale" | "offline";
}

export function StatusBar({ mountedCount, networkStatus }: StatusBarProps) {
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

      <span className="opacity-50">v0.1.0</span>
    </div>
  );
}

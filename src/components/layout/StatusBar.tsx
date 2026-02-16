import { Circle } from "phosphor-react";
import { clsx } from "clsx";

interface StatusBarProps {
  mountedCount: number;
  networkStatus: "local" | "tailscale" | "offline";
}

export function StatusBar({ mountedCount, networkStatus }: StatusBarProps) {
  return (
    <div className="h-9 px-4 bg-bg-base/60 backdrop-blur-md border-t border-border-default flex items-center justify-between text-xs text-text-tertiary select-none">
      <div className="flex items-center gap-5">
        <span className="font-medium">
          {mountedCount} {mountedCount === 1 ? "mount" : "mounts"} active
        </span>
        <div className="w-px h-4 bg-border-default" />
        <div className="flex items-center gap-2">
          <Circle
            size={8}
            weight="fill"
            className={clsx(
              "transition-colors duration-200",
              networkStatus === "local" && "text-accent-green drop-shadow-[0_0_4px_rgba(34,197,94,0.5)]",
              networkStatus === "tailscale" && "text-accent-purple drop-shadow-[0_0_4px_rgba(168,85,247,0.5)]",
              networkStatus === "offline" && "text-accent-red"
            )}
          />
          <span>
            {networkStatus === "local" && "LAN detected"}
            {networkStatus === "tailscale" && "Tailscale active"}
            {networkStatus === "offline" && "Offline"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <span className="opacity-60">v0.1.0</span>
      </div>
    </div>
  );
}

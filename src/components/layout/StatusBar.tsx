import { Circle } from "phosphor-react";
import { clsx } from "clsx";

interface StatusBarProps {
  mountedCount: number;
  networkStatus: "local" | "tailscale" | "offline";
}

export function StatusBar({ mountedCount, networkStatus }: StatusBarProps) {
  return (
    <div className="h-8 px-4 bg-bg-base/60 backdrop-blur-md border-t border-border-default flex items-center justify-between text-xs text-text-tertiary">
      <div className="flex items-center gap-4">
        <span>
          {mountedCount} {mountedCount === 1 ? "mount" : "mounts"} active
        </span>
        <div className="w-px h-4 bg-border-default" />
        <div className="flex items-center gap-1.5">
          <Circle
            size={8}
            weight="fill"
            className={clsx(
              networkStatus === "local" && "text-accent-green",
              networkStatus === "tailscale" && "text-accent-purple",
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

      <div className="flex items-center gap-4">
        <span>v0.1.0</span>
      </div>
    </div>
  );
}

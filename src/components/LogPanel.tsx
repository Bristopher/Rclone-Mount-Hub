import { useEffect, useRef } from "react";
import {
  Terminal,
  X,
  Trash,
  CaretDown,
  CaretUp,
  CheckCircle,
  Warning,
  XCircle,
  Info,
} from "phosphor-react";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { useLogStore } from "../lib/logStore";
import type { LogEntry, LogCategory } from "../lib/logStore";

export function LogPanel() {
  const { logs, isOpen, filter, toggleOpen, clearLogs, setFilter } = useLogStore();
  const logEndRef = useRef<HTMLDivElement>(null);

  // Filter logs based on selected category
  const filteredLogs = filter === "all"
    ? logs
    : logs.filter(log => log.category === filter);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isOpen) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isOpen]);

  const getLogIcon = (level: LogEntry["level"]) => {
    switch (level) {
      case "success":
        return <CheckCircle size={14} weight="fill" className="text-accent-green" />;
      case "error":
        return <XCircle size={14} weight="fill" className="text-accent-red" />;
      case "warning":
        return <Warning size={14} weight="fill" className="text-accent-amber" />;
      case "info":
      default:
        return <Info size={14} weight="fill" className="text-accent-blue" />;
    }
  };

  const getLogColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "success":
        return "text-accent-green";
      case "error":
        return "text-accent-red";
      case "warning":
        return "text-accent-amber";
      case "info":
      default:
        return "text-text-primary";
    }
  };

  const getCategoryColor = (category: LogCategory) => {
    switch (category) {
      case "drivers":
        return "text-accent-amber";
      case "mounts":
        return "text-accent-green";
      case "network":
        return "text-accent-purple";
      case "speedtest":
        return "text-accent-blue";
      default:
        return "text-text-tertiary";
    }
  };

  const getCategoryBadge = (category: LogCategory) => {
    const labels: Record<LogCategory, string> = {
      system: "SYS",
      drivers: "DRV",
      mounts: "MNT",
      network: "NET",
      speedtest: "SPD",
    };
    return labels[category];
  };

  return (
    <div
      className="w-full transition-all duration-300 ease-in-out overflow-hidden flex flex-col border-t border-white/[0.06]"
      style={{
        height: isOpen ? "350px" : "0px"
      }}
    >
      {/* Header Bar (at top of logs) */}
      <div className="bg-bg-surface border-b border-white/[0.06] px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Terminal size={16} weight="duotone" className="text-accent-blue" />
            <span className="text-[13px] font-medium text-text-primary">
              System Logs
            </span>
            {logs.length > 0 && (
              <span className="text-[11px] text-text-tertiary">
                ({filteredLogs.length}/{logs.length})
              </span>
            )}
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center gap-1">
            {(["all", "drivers", "mounts", "network", "system"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  filter === cat
                    ? "bg-accent-blue/20 text-accent-blue"
                    : "text-text-tertiary hover:text-text-primary hover:bg-white/[0.05]"
                }`}
              >
                {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearLogs}
            className="gap-1.5"
            disabled={logs.length === 0}
          >
            <Trash size={14} weight="bold" />
            Clear
          </Button>
          {/* Minimize Button with Chevron */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleOpen}
            className="gap-1.5"
          >
            <CaretDown size={14} weight="bold" />
            Minimize
          </Button>
        </div>
      </div>

      {/* Log Content */}
      <div className="bg-bg-base border-t border-white/[0.04] overflow-y-auto content-scroll flex-1">
        <div className="p-4 font-mono text-[12px] space-y-1">
          {filteredLogs.length === 0 ? (
            <div className="text-text-tertiary text-center py-8">
              {filter === "all" ? "No log entries yet" : `No ${filter} logs`}
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`flex items-start gap-2 py-1 px-2 -mx-2 rounded transition-colors ${
                  filter !== "all" && log.category === filter
                    ? "bg-accent-blue/10 border-l-2 border-accent-blue"
                    : "hover:bg-white/[0.02]"
                }`}
              >
                <span className="text-text-tertiary text-[11px] mt-0.5 whitespace-nowrap">
                  {log.timestamp.toLocaleTimeString()}
                </span>
                <span
                  className={`text-[10px] font-bold ${getCategoryColor(log.category)} mt-0.5 w-8`}
                >
                  [{getCategoryBadge(log.category)}]
                </span>
                {getLogIcon(log.level)}
                <span className={`flex-1 ${getLogColor(log.level)}`}>
                  {log.message}
                </span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}

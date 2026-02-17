import { create } from "zustand";

export type LogCategory = "system" | "drivers" | "mounts" | "network" | "speedtest";

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: "info" | "success" | "error" | "warning";
  message: string;
  category: LogCategory;
}

interface LogStore {
  logs: LogEntry[];
  isOpen: boolean;
  filter: LogCategory | "all";
  addLog: (level: LogEntry["level"], message: string, category?: LogCategory) => void;
  clearLogs: () => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  setFilter: (filter: LogCategory | "all") => void;
}

export const useLogStore = create<LogStore>((set) => ({
  logs: [],
  isOpen: false,
  filter: "all",
  addLog: (level, message, category = "system") => {
    const entry: LogEntry = {
      id: Date.now().toString() + Math.random(),
      timestamp: new Date(),
      level,
      message,
      category,
    };
    set((state) => ({
      logs: [...state.logs, entry],
      // Auto-open log panel when new message arrives
      isOpen: true,
    }));
  },
  clearLogs: () => set({ logs: [] }),
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
  setFilter: (filter) => set({ filter }),
}));

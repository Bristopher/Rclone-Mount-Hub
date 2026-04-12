import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import { LazyStore } from "@tauri-apps/plugin-store";
import type { AppSettings, Connection } from "./types";

// Tauri plugin-store backed storage — survives Velopack updates
// (localStorage lives in WebView2 profile which can be wiped on reinstall)
const tauriFileStore = new LazyStore("connections.json");

const tauriStorage: PersistStorage<ConnectionStore> = {
  getItem: async (name): Promise<StorageValue<ConnectionStore> | null> => {
    const value = await tauriFileStore.get<StorageValue<ConnectionStore>>(name);
    return value ?? null;
  },
  setItem: async (name, value) => {
    await tauriFileStore.set(name, value);
    await tauriFileStore.save();
  },
  removeItem: async (name) => {
    await tauriFileStore.delete(name);
    await tauriFileStore.save();
  },
};

// Mount status summary store (written by Dashboard, read by StatusBar)
interface MountSummaryStore {
  mountedCount: number;
  networkStatus: "local" | "tailscale" | "offline";
  setMountSummary: (count: number, network: "local" | "tailscale" | "offline") => void;
}

export const useMountSummaryStore = create<MountSummaryStore>()((set) => ({
  mountedCount: 0,
  networkStatus: "offline",
  setMountSummary: (mountedCount, networkStatus) => set({ mountedCount, networkStatus }),
}));

// Default settings matching AppSettings type
const DEFAULT_SETTINGS: AppSettings = {
  start_with_windows: false,
  start_minimized: true,
  close_to_tray: true,
  theme: "dark",
  default_speed_profile: "balanced",
  default_network_mode: "auto",
  show_notifications: true,
  rclone_config_path: "",
  network_change_mode: "notify",
  cache_dir: "",
};

// Settings Store
interface SettingsStore {
  settings: AppSettings;
  update: (partial: Partial<AppSettings>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      update: (partial) =>
        set((state) => ({
          settings: { ...state.settings, ...partial },
        })),
      reset: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: "rclone-mounter-settings",
    }
  )
);

// Connection Store
interface ConnectionStore {
  connections: Connection[];
  add: (connection: Connection) => void;
  remove: (id: string) => void;
  update: (id: string, updates: Partial<Connection>) => void;
  setAll: (connections: Connection[]) => void;
}

export const useConnectionStore = create<ConnectionStore>()(
  persist(
    (set) => ({
      connections: [],
      add: (connection) =>
        set((state) => ({
          connections: [...state.connections, connection],
        })),
      remove: (id) =>
        set((state) => ({
          connections: state.connections.filter((c) => c.id !== id),
        })),
      update: (id, updates) =>
        set((state) => ({
          connections: state.connections.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),
      setAll: (connections) => set({ connections }),
    }),
    {
      name: "rclone-mounter-connections",
      storage: tauriStorage,
    }
  )
);

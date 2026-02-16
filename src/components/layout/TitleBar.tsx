import { X, Minus, Square } from "phosphor-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function TitleBar() {
  const appWindow = getCurrentWindow();

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();

  return (
    <div
      data-tauri-drag-region
      className="h-12 flex items-center justify-between px-4 bg-bg-base/80 backdrop-blur-xl border-b border-border-default select-none"
    >
      <div data-tauri-drag-region className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-accent-blue" />
        <h1 className="text-sm font-semibold text-text-primary">
          Rclone Mount Hub
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleMinimize}
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-bg-overlay text-text-secondary hover:text-text-primary transition-colors"
        >
          <Minus size={16} weight="bold" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-bg-overlay text-text-secondary hover:text-text-primary transition-colors"
        >
          <Square size={14} weight="bold" />
        </button>
        <button
          onClick={handleClose}
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-accent-red/20 text-text-secondary hover:text-accent-red transition-colors"
        >
          <X size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}

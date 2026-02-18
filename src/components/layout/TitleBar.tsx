import { X, Minus, CornersOut } from "phosphor-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function TitleBar() {
  const appWindow = getCurrentWindow();

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();

  // Use startDragging() instead of data-tauri-drag-region — more reliable in
  // packaged (WebView2) builds where the CSS attribute can stop working.
  const handleDragStart = (e: React.MouseEvent) => {
    if (e.buttons === 1) {
      appWindow.startDragging();
    }
  };

  return (
    <div
      onMouseDown={handleDragStart}
      className="h-[38px] flex items-center justify-between bg-bg-base/90 backdrop-blur-xl border-b border-white/[0.06] select-none"
    >
      {/* Left: drag region with app name */}
      <div onMouseDown={handleDragStart} className="flex-1 flex items-center pl-4 gap-2.5 h-full">
        <div className="w-[7px] h-[7px] rounded-full bg-accent-blue shadow-[0_0_6px_rgba(59,130,246,0.4)]" />
        <span className="text-[12px] font-medium text-text-secondary tracking-tight">
          Rclone Mount Hub
        </span>
      </div>

      {/* Right: window controls — stop mousedown so drag doesn't fire */}
      <div className="flex items-center h-full" onMouseDown={(e) => e.stopPropagation()}>
        <button
          onClick={handleMinimize}
          className="w-[46px] h-full flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-white/[0.06] transition-colors duration-100 cursor-pointer"
        >
          <Minus size={14} weight="bold" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-[46px] h-full flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-white/[0.06] transition-colors duration-100 cursor-pointer"
        >
          <CornersOut size={13} weight="bold" />
        </button>
        <button
          onClick={handleClose}
          className="w-[46px] h-full flex items-center justify-center text-text-tertiary hover:text-white hover:bg-accent-red transition-colors duration-100 cursor-pointer"
        >
          <X size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}

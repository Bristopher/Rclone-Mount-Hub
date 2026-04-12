import { useEffect, useRef, useState } from "react";
import {
  CloudArrowUp,
  FolderOpen,
  File,
  X,
  CircleNotch,
  CheckCircle,
  WarningCircle,
} from "phosphor-react";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { useSettingsStore } from "../lib/store";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open as openPicker } from "@tauri-apps/plugin-dialog";

interface MountedConnection {
  id: string;
  name: string;
  activeUrl: string;
}

interface DirectUploadModalProps {
  open: boolean;
  onClose: () => void;
  mountedConnections: MountedConnection[];
}

type UploadState = "idle" | "uploading" | "done" | "error";

interface ProgressInfo {
  transferred: string;
  total: string;
  percent: number;
  speed: string;
  eta: string;
}

export function DirectUploadModal({
  open,
  onClose,
  mountedConnections,
}: DirectUploadModalProps) {
  const { settings } = useSettingsStore();
  const [sourcePath, setSourcePath] = useState("");
  const [isDirectory, setIsDirectory] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState("");
  const [destPath, setDestPath] = useState("/");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadPid, setUploadPid] = useState<number | null>(null);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-select the only connection if there's just one
  useEffect(() => {
    if (mountedConnections.length === 1 && !selectedConnection) {
      setSelectedConnection(mountedConnections[0].name);
    }
  }, [mountedConnections, selectedConnection]);

  // Listen for rclone progress events
  useEffect(() => {
    if (!open) return;

    const unlistenProgress = listen<{ pid: number; line: string }>(
      "upload-progress",
      (event) => {
        if (uploadPid && event.payload.pid !== uploadPid) return;
        const raw = event.payload.line;

        // rclone -P uses \r for in-place updates; take the last segment
        const segments = raw.split(/\r|\n/).filter((s) => s.trim());
        for (const line of segments) {
          // Parse the "Transferred:" line for progress info
          const match = line.match(
            /Transferred:\s+(.+?)\s+\/\s+(.+?),\s+(\d+)%,\s+(.+?),\s+ETA\s+(.+)/
          );
          if (match) {
            setProgress({
              transferred: match[1],
              total: match[2],
              percent: parseInt(match[3], 10),
              speed: match[4],
              eta: match[5],
            });
          } else if (line.trim() && !line.startsWith("Transferred:") && !line.startsWith("Elapsed") && !line.startsWith("Checks:")) {
            setLogLines((prev) => [...prev.slice(-100), line.trim()]);
          }
        }
      }
    );

    const unlistenComplete = listen<{ pid: number; code: number }>(
      "upload-complete",
      (event) => {
        if (uploadPid && event.payload.pid !== uploadPid) return;
        if (event.payload.code === 0) {
          setUploadState("done");
          setProgress((p) => (p ? { ...p, percent: 100 } : p));
        } else {
          setUploadState("error");
          setErrorMsg(`rclone exited with code ${event.payload.code}`);
        }
        setUploadPid(null);
      }
    );

    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenComplete.then((fn) => fn());
    };
  }, [open, uploadPid]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logLines]);

  const handlePickFile = async () => {
    const selected = await openPicker({
      title: "Select File to Upload",
      multiple: false,
    });
    if (selected && typeof selected === "string") {
      setSourcePath(selected);
      setIsDirectory(false);
    }
  };

  const handlePickFolder = async () => {
    const selected = await openPicker({
      title: "Select Folder to Upload",
      directory: true,
    });
    if (selected && typeof selected === "string") {
      setSourcePath(selected);
      setIsDirectory(true);
    }
  };

  const handleUpload = async () => {
    if (!sourcePath || !selectedConnection) return;

    setUploadState("uploading");
    setProgress(null);
    setLogLines([]);
    setErrorMsg("");

    const conn = mountedConnections.find((c) => c.name === selectedConnection);

    try {
      const pid = await invoke<number>("direct_upload", {
        sourcePath,
        remoteName: selectedConnection,
        destPath: destPath || "/",
        transfers: 4,
        webdavUrl: conn?.activeUrl || null,
        cacheDir: settings.cache_dir || null,
      });
      setUploadPid(pid);
    } catch (err) {
      setUploadState("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCancel = async () => {
    if (uploadPid) {
      try {
        await invoke("cancel_upload", { pid: uploadPid });
      } catch {
        // process may already be dead
      }
      setUploadPid(null);
      setUploadState("idle");
    }
  };

  const handleClose = () => {
    if (uploadState === "uploading") return; // don't close during upload
    setSourcePath("");
    setSelectedConnection(
      mountedConnections.length === 1 ? mountedConnections[0].name : ""
    );
    setDestPath("/");
    setUploadState("idle");
    setProgress(null);
    setLogLines([]);
    setErrorMsg("");
    setUploadPid(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="w-[560px] max-h-[80vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <CloudArrowUp size={20} weight="duotone" className="text-accent-blue" />
            <h2 className="text-base font-semibold text-text-primary">
              Direct Upload
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={uploadState === "uploading"}
            className="text-text-tertiary hover:text-text-primary transition-colors disabled:opacity-30"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          <p className="text-[12px] text-text-tertiary">
            Upload files directly to your remote without going through the mounted drive. Streams straight to the server — no local VFS cache needed.
          </p>

          {/* Source picker */}
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-text-secondary">
              Source
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-text-primary font-mono min-h-[36px] flex items-center overflow-hidden">
                {sourcePath ? (
                  <span className="flex items-center gap-1.5 truncate">
                    {isDirectory ? (
                      <FolderOpen size={14} className="text-accent-amber shrink-0" />
                    ) : (
                      <File size={14} className="text-accent-blue shrink-0" />
                    )}
                    <span className="truncate">{sourcePath}</span>
                  </span>
                ) : (
                  <span className="text-text-tertiary">No file or folder selected</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePickFile}
                disabled={uploadState === "uploading"}
              >
                <File size={14} weight="bold" />
                File
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePickFolder}
                disabled={uploadState === "uploading"}
              >
                <FolderOpen size={14} weight="bold" />
                Folder
              </Button>
            </div>
          </div>

          {/* Target connection */}
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-text-secondary">
              Destination Remote
            </label>
            <select
              value={selectedConnection}
              onChange={(e) => setSelectedConnection(e.target.value)}
              disabled={uploadState === "uploading"}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-text-primary focus:outline-none focus:border-accent-blue/50"
            >
              <option value="">Select a mounted connection...</option>
              {mountedConnections.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Destination path */}
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-text-secondary">
              Destination Path
            </label>
            <input
              type="text"
              value={destPath}
              onChange={(e) => setDestPath(e.target.value)}
              disabled={uploadState === "uploading"}
              placeholder="/"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue/50 font-mono"
            />
            <p className="text-[11px] text-text-tertiary">
              Path on the remote where files will be uploaded (e.g. /Chris-disk10/Backups)
            </p>
          </div>

          {/* Progress section */}
          {(uploadState === "uploading" || uploadState === "done" || uploadState === "error") && (
            <div className="space-y-3 pt-2">
              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-text-secondary flex items-center gap-1.5">
                    {uploadState === "uploading" && (
                      <CircleNotch size={14} className="animate-spin text-accent-blue" />
                    )}
                    {uploadState === "done" && (
                      <CheckCircle size={14} className="text-accent-green" weight="fill" />
                    )}
                    {uploadState === "error" && (
                      <WarningCircle size={14} className="text-accent-red" weight="fill" />
                    )}
                    {uploadState === "uploading" && "Uploading..."}
                    {uploadState === "done" && "Upload complete"}
                    {uploadState === "error" && "Upload failed"}
                  </span>
                  {progress && (
                    <span className="text-text-tertiary font-mono">
                      {progress.transferred} / {progress.total} ({progress.percent}%)
                    </span>
                  )}
                </div>
                <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      uploadState === "error"
                        ? "bg-accent-red"
                        : uploadState === "done"
                          ? "bg-accent-green"
                          : "bg-accent-blue"
                    }`}
                    style={{ width: `${progress?.percent ?? 0}%` }}
                  />
                </div>
                {progress && uploadState === "uploading" && (
                  <div className="flex justify-between text-[11px] text-text-tertiary font-mono">
                    <span>{progress.speed}</span>
                    <span>ETA {progress.eta}</span>
                  </div>
                )}
              </div>

              {/* Error message */}
              {uploadState === "error" && errorMsg && (
                <div className="px-3 py-2 rounded-lg bg-accent-red/10 border border-accent-red/20 text-[12px] text-accent-red font-mono">
                  {errorMsg}
                </div>
              )}

              {/* Log output */}
              {logLines.length > 0 && (
                <div
                  ref={logRef}
                  className="max-h-[120px] overflow-y-auto rounded-lg bg-black/30 border border-white/[0.06] p-3 font-mono text-[11px] text-text-tertiary space-y-0.5"
                >
                  {logLines.map((line, i) => (
                    <div key={i} className="whitespace-pre-wrap break-all">
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/[0.06]">
          {uploadState === "uploading" ? (
            <Button variant="danger" size="sm" onClick={handleCancel}>
              Cancel Upload
            </Button>
          ) : uploadState === "done" || uploadState === "error" ? (
            <Button variant="default" size="sm" onClick={handleClose}>
              Close
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleUpload}
                disabled={!sourcePath || !selectedConnection}
                className="gap-1.5"
              >
                <CloudArrowUp size={15} weight="bold" />
                Upload
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

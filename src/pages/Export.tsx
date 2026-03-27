import { useRef, useState } from "react";
import {
  Export as ExportIcon,
  Download,
  Copy,
  Upload,
  Code,
  FileArrowDown,
  Warning,
  LockKey,
  Eye,
  EyeSlash,
} from "phosphor-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useConnectionStore, useSettingsStore } from "../lib/store";
import { invoke } from "@tauri-apps/api/core";
import { save as saveDialog, open as openDialog } from "@tauri-apps/plugin-dialog";
import { downloadDir } from "@tauri-apps/api/path";
import { toast } from "sonner";
import type { Connection } from "../lib/types";

// ── Encryption helpers (Web Crypto / AES-GCM) ──────────────────────────────

async function encryptExport(plaintext: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 200_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));

  // Pack: salt(16) + iv(12) + ciphertext, then base64
  const buf = new Uint8Array(16 + 12 + ciphertext.byteLength);
  buf.set(salt, 0);
  buf.set(iv, 16);
  buf.set(new Uint8Array(ciphertext), 28);
  return btoa(String.fromCharCode(...buf));
}

async function decryptExport(b64: string, password: string): Promise<string> {
  const buf = new Uint8Array(atob(b64).split("").map(c => c.charCodeAt(0)));
  const salt       = buf.slice(0, 16);
  const iv         = buf.slice(16, 28);
  const ciphertext = buf.slice(28);

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 200_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

// ── Date formatter: 2026_03-27 ──────────────────────────────────────────────

function exportDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}_${m}-${day}`;
}

// ── Password modal ──────────────────────────────────────────────────────────

function PasswordModal({
  mode,
  onConfirm,
  onCancel,
}: {
  mode: "export" | "import";
  onConfirm: (password: string) => void;
  onCancel: () => void;
}) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          background: "rgba(20,20,28,0.97)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "16px",
          padding: "28px 32px",
          width: 360,
          display: "flex", flexDirection: "column", gap: "18px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LockKey size={22} weight="duotone" style={{ color: "#a78bfa" }} />
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>
            {mode === "export" ? "Encrypt Export" : "Decrypt Import"}
          </span>
        </div>

        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
          {mode === "export"
            ? "Your connections (including usernames and all settings) will be encrypted with AES-256-GCM. You'll need this password to import the file."
            : "Enter the password used when this export was created."}
        </p>

        <div style={{ position: "relative" }}>
          <input
            type={show ? "text" : "password"}
            placeholder="Password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === "Enter" && pw.length >= 4 && onConfirm(pw)}
            autoFocus
            style={{
              width: "100%", padding: "10px 40px 10px 12px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, color: "#fff", fontSize: 13,
              outline: "none", boxSizing: "border-box",
            }}
          />
          <button
            onClick={() => setShow(s => !s)}
            style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.4)", padding: 2,
            }}
          >
            {show ? <EyeSlash size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {mode === "export" && pw.length > 0 && pw.length < 4 && (
          <p style={{ color: "#f87171", fontSize: 11, margin: 0 }}>
            Password must be at least 4 characters
          </p>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13,
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => pw.length >= 4 && onConfirm(pw)}
            disabled={pw.length < 4}
            style={{
              padding: "8px 18px", borderRadius: 8, border: "none",
              background: pw.length >= 4 ? "#6366f1" : "rgba(99,102,241,0.3)",
              color: pw.length >= 4 ? "#fff" : "rgba(255,255,255,0.3)",
              cursor: pw.length >= 4 ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 600,
            }}
          >
            {mode === "export" ? "Encrypt & Save" : "Decrypt & Import"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function Export() {
  const { connections, setAll } = useConnectionStore();
  const { settings } = useSettingsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string>("");
  const [showPasswordModal, setShowPasswordModal] = useState<"export" | "import" | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<string | null>(null);

  // Preview shows full data (including usernames) since export will be encrypted
  const previewData = {
    version: 1,
    exported_at: new Date().toISOString(),
    connections,
    settings,
  };
  const jsonPreview = JSON.stringify(previewData, null, 2);

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExportJSON = () => {
    if (connections.length === 0) return;
    setShowPasswordModal("export");
  };

  const doExport = async (password: string) => {
    setShowPasswordModal(null);
    try {
      const payload = JSON.stringify({
        version: 1,
        exported_at: new Date().toISOString(),
        connections,
        settings,
      }, null, 2);

      const encrypted = await encryptExport(payload, password);
      const fileContent = JSON.stringify({ version: 1, encrypted: true, data: encrypted }, null, 2);

      const downloadsPath = await downloadDir();
      const defaultName = `Rclone-Mount-Hub_${exportDateString()}_Settings_Export.json`;

      const filePath = await saveDialog({
        defaultPath: `${downloadsPath}/${defaultName}`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });

      if (!filePath) return; // user cancelled

      await invoke("write_text_file", { path: filePath, content: fileContent });
      toast.success("Export saved and encrypted successfully");
    } catch (err) {
      toast.error(`Export failed: ${err}`);
    }
  };

  // ── Copy to clipboard (plain JSON for quick use) ──────────────────────────

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(jsonPreview);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  // ── Import ────────────────────────────────────────────────────────────────

  const handleImportJSON = async () => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!selected) return;

    const filePath = typeof selected === "string" ? selected : selected[0];
    if (!filePath) return;

    try {
      const text = await invoke<string>("read_text_file", { path: filePath });

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("File is not valid JSON");
      }

      const obj = parsed as Record<string, unknown>;

      if (obj.encrypted === true && typeof obj.data === "string") {
        // Encrypted export — prompt for password
        setPendingImportFile(obj.data as string);
        setShowPasswordModal("import");
        return;
      }

      // Unencrypted (legacy or plain) format
      await processImport(obj);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setImportError(msg);
      toast.error(msg);
    }
  };

  const doImport = async (password: string) => {
    setShowPasswordModal(null);
    if (!pendingImportFile) return;
    try {
      const decrypted = await decryptExport(pendingImportFile, password);
      const obj = JSON.parse(decrypted) as Record<string, unknown>;
      await processImport(obj);
    } catch {
      const msg = "Wrong password or corrupted file";
      setImportError(msg);
      toast.error(msg);
    } finally {
      setPendingImportFile(null);
    }
  };

  const processImport = async (obj: Record<string, unknown>) => {
    if (Array.isArray(obj)) {
      // Very old plain array format
      await importConnectionsArray(obj as Connection[]);
      return;
    }

    // New format: { version, connections, settings }
    const importedConns = obj.connections as Connection[] | undefined;
    const importedSettings = obj.settings;

    if (importedConns && Array.isArray(importedConns)) {
      await importConnectionsArray(importedConns);
    }
    if (importedSettings) {
      // Settings import is silently skipped for now (user didn't ask for that flow)
    }
  };

  const importConnectionsArray = async (data: Connection[]) => {
    const requiredFields = ["id", "name", "local_ip", "port", "drive_letter"];
    for (const conn of data) {
      for (const field of requiredFields) {
        if (!(field in conn)) throw new Error(`Missing required field: ${field}`);
      }
    }

    const importedConnections: Connection[] = [];
    for (const conn of data) {
      const password = prompt(`Enter WebDAV password for "${conn.name}":`);
      if (!password) {
        toast.warning(`Skipped: ${conn.name} (no password provided)`);
        continue;
      }

      try {
        const url = `http://${conn.local_ip}:${conn.port}`;
        await invoke("create_remote", {
          name: conn.name, url, vendor: "other",
          user: conn.username ?? "", pass: password,
        });
        importedConnections.push(conn);
      } catch (err) {
        toast.error(`Failed to create remote for ${conn.name}: ${err}`);
      }
    }

    if (importedConnections.length > 0) {
      setAll([...connections, ...importedConnections]);
      setImportError("");
      toast.success(`Imported ${importedConnections.length} connection(s)`);
    } else {
      toast.warning("No connections were imported");
    }
  };

  // ── PowerShell scripts ────────────────────────────────────────────────────

  const generatePowerShellScript = (conn: Connection): string => {
    const url = conn.network_mode === "tailscale"
      ? `http://${conn.tailscale_ip}:${conn.port}`
      : `http://${conn.local_ip}:${conn.port}`;

    return `# Rclone Mount Script - ${conn.name}
# Generated by Rclone Mount Hub

$driveLetter = "${conn.drive_letter}"
$webdavUrl = "${url}"
$username = "${conn.username}"

if (Test-Path "$driveLetter:\\") {
    Write-Host "Drive $driveLetter is already in use" -ForegroundColor Yellow
    exit 1
}

Write-Host "Mounting ${conn.name} to $driveLetter..." -ForegroundColor Cyan

rclone mount "${conn.name}:" "$driveLetter:" \`
  --vfs-cache-mode full \`
  --webdav-url "$webdavUrl" \`
  --webdav-user "$username" \`
  --no-console

# This script will keep running until you press Ctrl+C
`;
  };

  const handleDownloadScript = async (conn: Connection) => {
    const script = generatePowerShellScript(conn);
    const downloadsPath = await downloadDir();
    const defaultName = `mount-${conn.name.toLowerCase().replace(/\s+/g, "-")}.ps1`;

    const filePath = await saveDialog({
      defaultPath: `${downloadsPath}/${defaultName}`,
      filters: [{ name: "PowerShell Script", extensions: ["ps1"] }],
    });

    if (!filePath) return;
    await invoke("write_text_file", { path: filePath, content: script });
    toast.success(`Script saved: ${conn.name}`);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-full overflow-y-auto content-scroll">
      <div className="px-10 py-8 pb-12 max-w-3xl w-full mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight mb-2 flex items-center gap-3">
            <ExportIcon size={28} weight="duotone" className="text-accent-blue" />
            Export & Import
          </h1>
          <p className="text-[13px] text-text-secondary">
            Backup your connections or generate standalone scripts
          </p>
        </div>

        <div className="space-y-6">
          {/* Export */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Download size={18} weight="duotone" className="text-accent-green" />
              Export Connections
            </h2>
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-accent-purple/10 border border-accent-purple/20 flex items-start gap-2">
                <LockKey size={15} className="text-accent-purple mt-0.5" weight="bold" />
                <p className="text-[12px] text-accent-purple">
                  Export is encrypted with AES-256-GCM. You'll enter a password before saving.
                  Includes all connection data, usernames, and app settings.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleExportJSON}
                  disabled={connections.length === 0}
                  className="gap-2"
                >
                  <FileArrowDown size={16} weight="bold" />
                  Export as JSON
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={handleCopyToClipboard}
                  disabled={connections.length === 0}
                  className="gap-2"
                >
                  <Copy size={16} weight="bold" />
                  Copy Plain JSON
                </Button>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-2">
                  Preview (what will be included in the export)
                </label>
                <textarea
                  readOnly
                  value={connections.length === 0 ? "No connections to export" : jsonPreview}
                  className="w-full h-48 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[12px] text-text-primary font-mono resize-none focus:outline-none"
                />
              </div>
            </div>
          </Card>

          {/* Import */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Upload size={18} weight="duotone" className="text-accent-purple" />
              Import Connections
            </h2>
            <div className="space-y-3">
              <p className="text-[13px] text-text-secondary">
                Import from an encrypted or plain JSON export. Encrypted files will prompt for the password.
                You'll be asked to enter the WebDAV password for each connection.
              </p>
              <Button
                variant="default"
                size="md"
                onClick={handleImportJSON}
                className="gap-2"
              >
                <Upload size={16} weight="bold" />
                Import JSON File
              </Button>
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" />
              {importError && (
                <div className="p-3 rounded-lg bg-accent-red/10 border border-accent-red/30 flex items-start gap-2">
                  <Warning size={16} className="text-accent-red mt-0.5" weight="bold" />
                  <p className="text-[13px] text-accent-red">{importError}</p>
                </div>
              )}
            </div>
          </Card>

          {/* PowerShell Scripts */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Code size={18} weight="duotone" className="text-accent-amber" />
              PowerShell Scripts
            </h2>
            <p className="text-[13px] text-text-secondary mb-4">
              Generate standalone mount scripts for each connection
            </p>
            {connections.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[13px] text-text-tertiary">
                  No connections available. Add a connection first.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {connections.map((conn) => (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]"
                  >
                    <div>
                      <div className="text-[13px] font-medium text-text-primary">{conn.name}</div>
                      <div className="text-[11px] text-text-tertiary">
                        Drive {conn.drive_letter}: • {conn.network_mode} mode
                      </div>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleDownloadScript(conn)}
                      className="gap-1.5"
                    >
                      <Download size={14} weight="bold" />
                      Download Script
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Password modal */}
      {showPasswordModal && (
        <PasswordModal
          mode={showPasswordModal}
          onConfirm={showPasswordModal === "export" ? doExport : doImport}
          onCancel={() => {
            setShowPasswordModal(null);
            setPendingImportFile(null);
          }}
        />
      )}
    </div>
  );
}

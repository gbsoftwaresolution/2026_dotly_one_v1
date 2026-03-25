import React from "react";
import JSZip from "jszip";
import { useNavigate } from "react-router-dom";
import { decryptCiphertextToBlob } from "../crypto/decrypt";

type ManifestItem = {
  mediaId: string;
  originalFilename?: string;
  contentType: string;
  byteSize: number;
  encAlgo?: string;
  encMeta?: unknown;
};

type ExportManifest = {
  exportId: string;
  ownerUserId?: string;
  createdAt: string;
  items: ManifestItem[];
};

function hasIvB64(encMeta: unknown): encMeta is { ivB64: string } {
  if (!encMeta || typeof encMeta !== "object") return false;
  return typeof (encMeta as { ivB64?: unknown }).ivB64 === "string";
}

function sanitizeFilename(name: string): string {
  // Keep it simple and cross-platform safe.
  return name
    .replace(/\s+/g, " ")
    .replace(/[\\/\0<>:"|?*]+/g, "-")
    .trim();
}

function guessExtensionFromContentType(contentType: string): string {
  const ct = String(contentType || "").toLowerCase();
  if (ct === "image/jpeg") return ".jpg";
  if (ct === "image/png") return ".png";
  if (ct === "image/webp") return ".webp";
  if (ct === "image/gif") return ".gif";
  if (ct === "video/mp4") return ".mp4";
  if (ct === "video/webm") return ".webm";
  if (ct === "application/pdf") return ".pdf";
  return "";
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Icons ---

const LockIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);

const FileZipIcon = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
    <polyline points="10 9 9 9 8 9"></polyline>
  </svg>
);

const RefreshIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>
);

const ArrowLeftIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="19" y1="12" x2="5" y2="12"></line>
    <polyline points="12 19 5 12 12 5"></polyline>
  </svg>
);

const CheckIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

export const DecryptExport: React.FC = () => {
  const navigate = useNavigate();

  const [zipFile, setZipFile] = React.useState<File | null>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [status, setStatus] = React.useState<
    | { kind: "idle" }
    | { kind: "working"; message: string; percent?: number }
    | { kind: "done"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const onPickZip = (file: File | null) => {
    if (
      file &&
      (file.name.endsWith(".zip") ||
        file.type === "application/zip" ||
        file.type === "application/x-zip-compressed")
    ) {
      setZipFile(file);
      setStatus({ kind: "idle" });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onPickZip(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const runDecrypt = async () => {
    if (!zipFile) return;

    try {
      setStatus({ kind: "working", message: "Loading ZIP archive..." });
      const zip = await JSZip.loadAsync(zipFile);

      const manifestFile = zip.file("manifest.json");
      if (!manifestFile) {
        throw new Error("manifest.json not found in ZIP");
      }

      const manifestText = await manifestFile.async("string");
      const manifest = JSON.parse(manifestText) as ExportManifest;

      if (!manifest?.items || !Array.isArray(manifest.items)) {
        throw new Error("Invalid manifest.json format");
      }

      const needsOwnerUserId = manifest.items.some((i) => {
        const v =
          i.encMeta &&
          typeof i.encMeta === "object" &&
          "v" in (i.encMeta as any)
            ? (i.encMeta as any).v
            : undefined;
        return v === 2;
      });
      if (needsOwnerUserId && !manifest.ownerUserId) {
        throw new Error(
          "This export manifest is missing ownerUserId (required for v2 AAD-bound decrypt). Please create a new export and try again.",
        );
      }

      // Ensure encMeta exists; older exports won't have it.
      const missingMeta = manifest.items.some(
        (i) => !i.encMeta || (!i.encAlgo && !hasIvB64(i.encMeta)),
      );
      if (missingMeta) {
        throw new Error(
          "This export was created with an older version and is missing encryption metadata in manifest.json. Please create a new export and try again.",
        );
      }

      // Warning: JSZip is not streaming; large exports can exceed memory.
      if (zipFile.size > 1024 * 1024 * 512) {
        // 512MB
        setStatus({
          kind: "working",
          message:
            "Large ZIP detected. Decryption may be slow or run out of memory in the browser.",
        });
        await new Promise((r) => setTimeout(r, 250));
      }

      const outZip = new JSZip();
      const total = manifest.items.length;

      for (const [index, item] of manifest.items.entries()) {
        const percent = Math.round(((index + 1) / total) * 100);

        setStatus({
          kind: "working",
          message: `Decrypting ${index + 1}/${total}…`,
          percent,
        });

        const entryPath = `ciphertext/${item.mediaId}.bin`;
        const entry = zip.file(entryPath);
        if (!entry) {
          throw new Error(`Missing ZIP entry: ${entryPath}`);
        }

        const ciphertext = await entry.async("arraybuffer");
        const plaintextBlob = await decryptCiphertextToBlob({
          userId: manifest.ownerUserId,
          mediaId: item.mediaId,
          ciphertext,
          encAlgo: item.encAlgo,
          encMeta: item.encMeta,
          variant: "original",
          mimeType: item.contentType,
        });

        const baseNameRaw = item.originalFilename || item.mediaId;
        const baseName = sanitizeFilename(baseNameRaw);
        const ext = baseName.includes(".")
          ? ""
          : guessExtensionFromContentType(item.contentType);
        const outName = `${baseName}${ext}`;

        outZip.file(outName, plaintextBlob);
      }

      setStatus({ kind: "working", message: "Creating decrypted ZIP…" });

      const decryptedZipBlob = await outZip.generateAsync(
        {
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 6 },
        },
        (meta) => {
          const p = Math.max(0, Math.min(100, Math.round(meta.percent || 0)));
          setStatus({
            kind: "working",
            message: "Creating decrypted ZIP…",
            percent: p,
          });
        },
      );

      const outFilename = `booster-vault-export-${sanitizeFilename(
        manifest.exportId || "decrypted",
      )}-decrypted.zip`;
      downloadBlob(decryptedZipBlob, outFilename);

      setStatus({ kind: "done", message: "Decrypted ZIP downloaded." });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setStatus({
        kind: "error",
        message,
      });
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background:
          "linear-gradient(to bottom, var(--bg-primary), var(--bg-secondary))",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "600px",
          backgroundColor: "var(--bg-elevated)",
          borderRadius: "24px",
          border: "1px solid var(--border-primary)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "2rem",
            borderBottom: "1px solid var(--border-primary)",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <button
            onClick={() => navigate("/app/vault/exports")}
            style={{
              alignSelf: "flex-start",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "transparent",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              fontSize: "0.9rem",
              padding: 0,
            }}
          >
            <ArrowLeftIcon />
            Back to Exports
          </button>

          <div>
            <h1
              style={{
                margin: "0 0 0.5rem 0",
                fontSize: "1.75rem",
                fontWeight: 700,
              }}
            >
              Decrypt Export
            </h1>
            <p
              style={{
                margin: 0,
                color: "var(--text-secondary)",
                lineHeight: 1.5,
              }}
            >
              Use your device's local keys to decrypt your export securely.{" "}
              <br />
              <span
                style={{
                  color: "var(--accent-primary)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "0.85rem",
                  background: "rgba(74, 222, 128, 0.1)",
                  padding: "2px 8px",
                  borderRadius: "99px",
                  marginTop: "8px",
                }}
              >
                <LockIcon /> Zero-Knowledge Encryption
              </span>
            </p>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "2rem" }}>
          {!zipFile ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              style={{
                border: `2px dashed ${isDragOver ? "var(--accent-primary)" : "var(--border-primary)"}`,
                borderRadius: "16px",
                padding: "3rem 2rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                backgroundColor: isDragOver
                  ? "rgba(74, 222, 128, 0.05)"
                  : "var(--bg-primary)",
                transition: "all 0.2s ease",
                cursor: "pointer",
              }}
            >
              <input
                type="file"
                accept=".zip,application/zip"
                onChange={(e) => onPickZip(e.target.files?.[0] ?? null)}
                style={{ display: "none" }}
                id="zip-upload"
              />

              <div
                style={{
                  color: isDragOver
                    ? "var(--accent-primary)"
                    : "var(--text-tertiary)",
                  marginBottom: "1rem",
                  transition: "color 0.2s",
                }}
              >
                <FileZipIcon />
              </div>

              <label htmlFor="zip-upload" style={{ cursor: "pointer" }}>
                <div
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginBottom: "0.5rem",
                  }}
                >
                  Choose Export ZIP
                </div>
                <div
                  style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}
                >
                  or drag and drop it here
                </div>
              </label>
            </div>
          ) : (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div
                style={{
                  padding: "1rem",
                  backgroundColor: "var(--bg-primary)",
                  borderRadius: "12px",
                  border: "1px solid var(--border-primary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  marginBottom: "2rem",
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "10px",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-primary)",
                  }}
                >
                  <FileZipIcon />
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div
                    style={{
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {zipFile.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {(zipFile.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                {status.kind !== "working" && (
                  <button
                    onClick={() => {
                      setZipFile(null);
                      setStatus({ kind: "idle" });
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-tertiary)",
                      cursor: "pointer",
                      padding: "0.5rem",
                    }}
                  >
                    <RefreshIcon />
                  </button>
                )}
              </div>

              {status.kind === "idle" && (
                <button
                  onClick={runDecrypt}
                  style={{
                    width: "100%",
                    padding: "1rem",
                    backgroundColor: "var(--accent-primary)",
                    color: "#000",
                    border: "none",
                    borderRadius: "12px",
                    fontWeight: 600,
                    fontSize: "1rem",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(74, 222, 128, 0.2)",
                    transition: "all 0.2s",
                  }}
                >
                  Decrypt & Download
                </button>
              )}

              {status.kind === "working" && (
                <div style={{ textAlign: "center", padding: "1rem 0" }}>
                  <div style={{ marginBottom: "1rem", fontWeight: 500 }}>
                    {status.message}
                  </div>
                  {typeof status.percent === "number" && (
                    <div
                      style={{
                        height: "8px",
                        width: "100%",
                        backgroundColor: "var(--bg-primary)",
                        borderRadius: "99px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${status.percent}%`,
                          backgroundColor: "var(--accent-primary)",
                          transition: "width 0.2s ease",
                        }}
                      />
                    </div>
                  )}
                  <div
                    style={{
                      marginTop: "0.5rem",
                      fontSize: "0.85rem",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {status.percent || 0}%
                  </div>
                </div>
              )}

              {status.kind === "done" && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "1rem 0",
                    animation: "fadeIn 0.3s",
                  }}
                >
                  <div
                    style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(74, 222, 128, 0.1)",
                      color: "var(--accent-primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 1rem auto",
                    }}
                  >
                    <CheckIcon />
                  </div>
                  <h3 style={{ margin: "0 0 0.5rem 0" }}>
                    Decryption Complete
                  </h3>
                  <p
                    style={{
                      color: "var(--text-secondary)",
                      margin: "0 0 1.5rem 0",
                    }}
                  >
                    Your browser has downloaded the decrypted ZIP file.
                  </p>
                  <button
                    onClick={() => {
                      setZipFile(null);
                      setStatus({ kind: "idle" });
                    }}
                    style={{
                      padding: "0.75rem 1.5rem",
                      backgroundColor: "var(--bg-primary)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-primary)",
                      borderRadius: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Decrypt Another
                  </button>
                </div>
              )}

              {status.kind === "error" && (
                <div
                  style={{
                    padding: "1rem",
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    color: "var(--danger)",
                    borderRadius: "12px",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                  }}
                >
                  <strong>Error:</strong> {status.message}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div
          style={{
            padding: "1.5rem 2rem",
            borderTop: "1px solid var(--border-primary)",
            backgroundColor: "var(--bg-primary)",
            fontSize: "0.85rem",
            color: "var(--text-tertiary)",
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          This tool runs entirely in your browser. Your password and keys never
          leave this device.
          <br />
          Wait until the download finishes before closing this tab.
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

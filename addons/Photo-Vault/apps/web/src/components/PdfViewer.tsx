import React, { useEffect, useMemo, useRef, useState } from "react";
import { getPdfJs } from "../media/pdfjs";

type PdfViewerProps = {
  src: string;
  title?: string;
  height?: string;
};

export const PdfViewer: React.FC<PdfViewerProps> = ({
  src,
  title,
  height = "70vh",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadSeqRef = useRef(0);
  const renderSeqRef = useRef(0);

  type PdfJsModule = Awaited<ReturnType<typeof getPdfJs>>;

  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canPrev = pageNumber > 1;
  const canNext = numPages ? pageNumber < numPages : false;

  const titleText = useMemo(() => title || "PDF", [title]);

  const createPdfLoadingTask = async (pdfjs: PdfJsModule, url: string) => {
    const normalized = String(url || "");

    // We commonly pass decrypted PDFs as blob: object URLs.
    // Loading from bytes is more reliable than letting pdf.js fetch blob: itself.
    if (normalized.startsWith("blob:") || normalized.startsWith("data:")) {
      try {
        const res = await globalThis.fetch(normalized);
        const data = await res.arrayBuffer();
        return pdfjs.getDocument({ data });
      } catch {
        // Fall back to url-based loading
      }
    }

    return pdfjs.getDocument({ url: normalized });
  };

  useEffect(() => {
    let cancelled = false;
    const seq = (loadSeqRef.current += 1);

    async function load() {
      setIsLoading(true);
      setError(null);
      setNumPages(null);
      setPageNumber(1);

      try {
        const pdfjs = await getPdfJs();
        const task = await createPdfLoadingTask(pdfjs, src);
        const pdf = await task.promise;

        if (cancelled || seq !== loadSeqRef.current) {
          try {
            await task.destroy();
          } catch {
            // ignore
          }
          return;
        }

        setNumPages(pdf.numPages);
      } catch (e: unknown) {
        if (cancelled || seq !== loadSeqRef.current) return;
        const message = e instanceof Error ? e.message : String(e);
        setError(message || "Failed to load PDF");
      } finally {
        if (!cancelled && seq === loadSeqRef.current) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    let cancelled = false;
    const seq = (renderSeqRef.current += 1);

    async function render() {
      if (!canvasRef.current) return;
      if (!src) return;
      if (!numPages) return;

      setIsLoading(true);
      setError(null);

      try {
        const pdfjs = await getPdfJs();
        const task = await createPdfLoadingTask(pdfjs, src);
        const pdf = await task.promise;

        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas unavailable");

        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));

        const renderTask = page.render({
          canvasContext: ctx,
          canvas,
          viewport,
        });
        await renderTask.promise;

        try {
          await task.destroy();
        } catch {
          // ignore
        }

        if (cancelled || seq !== renderSeqRef.current) return;
      } catch (e: unknown) {
        if (cancelled || seq !== renderSeqRef.current) return;
        const message = e instanceof Error ? e.message : String(e);
        setError(message || "Failed to render PDF");
      } finally {
        if (!cancelled && seq === renderSeqRef.current) setIsLoading(false);
      }
    }

    void render();

    return () => {
      cancelled = true;
    };
  }, [src, numPages, pageNumber, scale]);

  return (
    <div
      data-testid="pdf-viewer"
      style={{
        width: "100%",
        height,
        borderRadius: "4px",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-primary)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderBottom: "1px solid var(--border-primary)",
          gap: "12px",
        }}
      >
        <div
          style={{
            fontSize: "0.875rem",
            color: "var(--text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "55%",
          }}
          title={titleText}
        >
          {titleText}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() =>
              setScale((s) => Math.max(0.5, Math.round((s - 0.1) * 10) / 10))
            }
            disabled={isLoading}
            aria-label="Zoom out"
          >
            −
          </button>
          <div
            style={{
              fontSize: "0.875rem",
              color: "var(--text-secondary)",
              minWidth: 56,
              textAlign: "center",
            }}
          >
            {Math.round(scale * 100)}%
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() =>
              setScale((s) => Math.min(3, Math.round((s + 0.1) * 10) / 10))
            }
            disabled={isLoading}
            aria-label="Zoom in"
          >
            +
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={!canPrev || isLoading}
          >
            Prev
          </button>
          <div
            style={{
              fontSize: "0.875rem",
              color: "var(--text-secondary)",
              minWidth: 92,
              textAlign: "center",
            }}
          >
            {numPages ? `${pageNumber} / ${numPages}` : "—"}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() =>
              setPageNumber((p) =>
                numPages ? Math.min(numPages, p + 1) : p + 1,
              )
            }
            disabled={!canNext || isLoading}
          >
            Next
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          display: "flex",
          justifyContent: "center",
          alignItems: isLoading ? "center" : "flex-start",
          padding: "12px",
        }}
      >
        {error ? (
          <div style={{ color: "var(--text-secondary)", textAlign: "center" }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              PDF preview failed
            </div>
            <div style={{ fontSize: "0.875rem" }}>{error}</div>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            aria-label={titleText}
            style={{
              background: "white",
              borderRadius: "4px",
              boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
              maxWidth: "100%",
              height: "auto",
            }}
          />
        )}
      </div>
    </div>
  );
};

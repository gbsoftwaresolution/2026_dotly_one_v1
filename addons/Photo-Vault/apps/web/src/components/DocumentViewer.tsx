import React, { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import type * as XLSXTypes from "xlsx";

let mammothPromise: Promise<typeof import("mammoth")> | null = null;
const loadMammoth = () => (mammothPromise ??= import("mammoth"));

let markedPromise: Promise<typeof import("marked")> | null = null;
const loadMarked = () => (markedPromise ??= import("marked"));

let docxPreviewPromise: Promise<typeof import("docx-preview")> | null = null;
const loadDocxPreview = () => (docxPreviewPromise ??= import("docx-preview"));

let jszipPromise: Promise<any> | null = null;
const loadJSZip = async () =>
  (jszipPromise ??= import("jszip").then((m: any) => m?.default ?? m));

let papaPromise: Promise<any> | null = null;
const loadPapaParse = async () =>
  (papaPromise ??= import("papaparse").then((m: any) => m?.default ?? m));

let xlsxPromise: Promise<typeof import("xlsx")> | null = null;
const loadXLSX = () => (xlsxPromise ??= import("xlsx"));

let epubPromise: Promise<typeof import("epubjs")> | null = null;
const loadEpubJs = () => (epubPromise ??= import("epubjs"));

type DocxEmbeddedImage = {
  name: string;
  mime: string;
  url?: string;
  reasonUnsupported?: string;
};

type DocxChartPreview = {
  name: string;
  seriesNames: string[];
  categories: string[];
  valuesBySeries: Array<Array<string | number | null>>;
};

type DocxEmbeddedObject = {
  name: string;
  kind:
    | "spreadsheet"
    | "presentation"
    | "document"
    | "pdf"
    | "image"
    | "binary";
};

type DocxPackageSignals = {
  hasEmbeddings: boolean;
  hasDrawings: boolean;
  hasDiagrams: boolean;
  hasVml: boolean;
  hasActiveX: boolean;
};

type DocumentViewerProps = {
  src: string;
  contentType: string;
  filename?: string;
  height?: string;
};

type DocKind =
  | "pdf"
  | "docx"
  | "xlsx"
  | "pptx"
  | "txt"
  | "md"
  | "html"
  | "rtf"
  | "json"
  | "xml"
  | "yaml"
  | "log"
  | "odt"
  | "ods"
  | "odp"
  | "epub"
  | "csv"
  | "zip"
  | "legacy-office"
  | "unknown";

type MammothParagraph = {
  alignment?: "left" | "center" | "right" | "both" | "justify" | string;
  styleId?: string;
} & Record<string, unknown>;

type MammothTransforms = {
  paragraph: (fn: (p: MammothParagraph) => MammothParagraph) => unknown;
};

type DocxPreviewOptions = {
  className?: string;
  inWrapper?: boolean;
  ignoreWidth?: boolean;
  ignoreHeight?: boolean;
  ignoreFonts?: boolean;
  breakPages?: boolean;
  renderHeaders?: boolean;
  renderFooters?: boolean;
  renderComments?: boolean;
  renderChanges?: boolean;
  useBase64URL?: boolean;
};

type XlsxGrid = {
  cells: string[][];
  merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
  truncated: boolean;
  rowOffset: number;
  colOffset: number;
};

const getExtLower = (name?: string) => {
  const n = String(name || "");
  const ext = n.split(".").pop();
  return ext ? ext.toLowerCase() : "";
};

const normalizeContentType = (ct: string) =>
  String(ct || "")
    .split(";")[0]
    ?.trim()
    .toLowerCase();

const guessKind = (contentType: string, filename?: string): DocKind => {
  const ct = normalizeContentType(contentType);
  const ext = getExtLower(filename);

  if (ct === "application/pdf" || ext === "pdf") return "pdf";

  // Modern Office
  if (
    ct ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    return "docx";
  }
  if (
    ct ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    ext === "xlsx"
  ) {
    return "xlsx";
  }
  if (
    ct ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    ext === "pptx"
  ) {
    return "pptx";
  }

  // Text
  if (ct === "text/plain" || ext === "txt") return "txt";
  if (ext === "log") return "log";
  if (ct === "text/markdown" || ext === "md" || ext === "markdown") return "md";
  if (ct === "text/html" || ext === "html" || ext === "htm") return "html";
  if (ct === "application/rtf" || ct === "text/rtf" || ext === "rtf")
    return "rtf";
  if (ct === "application/json" || ext === "json") return "json";
  if (ct === "application/xml" || ct === "text/xml" || ext === "xml")
    return "xml";
  if (
    ct === "application/yaml" ||
    ct === "text/yaml" ||
    ext === "yml" ||
    ext === "yaml"
  ) {
    return "yaml";
  }
  if (ct === "application/vnd.oasis.opendocument.text" || ext === "odt")
    return "odt";
  if (
    ct === "application/vnd.oasis.opendocument.spreadsheet" ||
    ext === "ods"
  ) {
    return "ods";
  }
  if (
    ct === "application/vnd.oasis.opendocument.presentation" ||
    ext === "odp"
  ) {
    return "odp";
  }
  if (ct === "application/epub+zip" || ext === "epub") return "epub";
  if (ct === "text/csv" || ext === "csv") return "csv";

  // Archive
  if (ct === "application/zip" || ext === "zip") return "zip";

  // Legacy Office (allowed Tier-1 upload, but preview is limited)
  if (ct === "application/msword" || ext === "doc") return "legacy-office";
  if (ct === "application/vnd.ms-excel" || ext === "xls")
    return "legacy-office";
  if (ct === "application/vnd.ms-powerpoint" || ext === "ppt")
    return "legacy-office";

  return "unknown";
};

const stripXmlToText = (xml: string) => {
  try {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    return (doc.documentElement?.textContent || "").trim();
  } catch {
    return String(xml || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
};

const rtfToText = (rtf: string) => {
  const s = String(rtf || "");
  // Minimal, best-effort RTF plain-text extraction.
  // Handles common escapes and paragraph markers; ignores rich formatting.
  const withoutGroups = s.replace(/\{\\\*[^}]*\}/g, "");
  const withNewlines = withoutGroups
    .replace(/\\par[d]?\b/g, "\n")
    .replace(/\\line\b/g, "\n");
  const decodedHex = withNewlines.replace(/\\'([0-9a-fA-F]{2})/g, (_, h) => {
    const code = Number.parseInt(String(h), 16);
    return Number.isFinite(code) ? String.fromCharCode(code) : "";
  });
  const noControls = decodedHex
    .replace(/\\[a-zA-Z]+-?\d*\s?/g, "")
    .replace(/[{}]/g, "");
  return noControls.replace(/\s+\n/g, "\n").trim();
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const encodeExcelCol = (index: number): string => {
  // 0 -> A, 25 -> Z, 26 -> AA
  let n = Math.max(0, Math.floor(index));
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
};

const guessMimeFromFilename = (name: string) => {
  const ext = (name.split(".").pop() || "").toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "bmp":
      return "image/bmp";
    case "svg":
      return "image/svg+xml";
    case "tif":
    case "tiff":
      return "image/tiff";
    case "wmf":
      return "image/wmf";
    case "emf":
      return "image/emf";
    default:
      return "application/octet-stream";
  }
};

const isBrowserRenderableImageMime = (mime: string) =>
  mime === "image/png" ||
  mime === "image/jpeg" ||
  mime === "image/gif" ||
  mime === "image/webp" ||
  mime === "image/bmp" ||
  mime === "image/svg+xml";

const buildXlsxGridFromSheet = (
  xlsx: typeof import("xlsx"),
  sheet: XLSXTypes.WorkSheet,
  options?: { maxRows?: number; maxCols?: number },
): XlsxGrid => {
  const maxRows = options?.maxRows ?? 200;
  const maxCols = options?.maxCols ?? 40;

  const ref = String(sheet["!ref"] ?? "").trim();
  if (!ref) {
    return {
      cells: [],
      merges: [],
      truncated: false,
      rowOffset: 0,
      colOffset: 0,
    };
  }

  const range = xlsx.utils.decode_range(ref);
  const totalRows = Math.max(0, range.e.r - range.s.r + 1);
  const totalCols = Math.max(0, range.e.c - range.s.c + 1);

  const rowCount = Math.min(totalRows, maxRows);
  const colCount = Math.min(totalCols, maxCols);
  const rowOffset = range.s.r;
  const colOffset = range.s.c;

  const cellsByAddr = sheet as unknown as Record<
    string,
    XLSXTypes.CellObject | undefined
  >;

  const cells: string[][] = Array.from({ length: rowCount }, (_, r) =>
    Array.from({ length: colCount }, (_, c) => {
      const addr = xlsx.utils.encode_cell({
        r: rowOffset + r,
        c: colOffset + c,
      });
      const cell = cellsByAddr[addr];
      const v = cell?.w ?? cell?.v;
      if (v == null) return "";
      return typeof v === "string" ? v : String(v);
    }),
  );

  const mergesRaw =
    (sheet["!merges"] as
      | Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>
      | undefined) ?? [];
  const merges = mergesRaw.filter((m) => {
    if (!m?.s || !m?.e) return false;
    if (m.e.r < rowOffset || m.s.r >= rowOffset + rowCount) return false;
    if (m.e.c < colOffset || m.s.c >= colOffset + colCount) return false;
    return true;
  });

  return {
    cells,
    merges,
    truncated: totalRows > maxRows || totalCols > maxCols,
    rowOffset,
    colOffset,
  };
};

const extractChartPreview = (xml: string, name: string): DocxChartPreview => {
  const doc = new DOMParser().parseFromString(xml, "application/xml");

  const seriesNodes = Array.from(doc.getElementsByTagNameNS("*", "ser"));
  const seriesNames: string[] = [];
  const categoriesBySeries: string[][] = [];
  const valuesBySeries: Array<Array<string | number | null>> = [];

  for (const ser of seriesNodes) {
    const tx = ser.getElementsByTagNameNS("*", "tx")[0];
    const txV = tx?.getElementsByTagNameNS("*", "v")[0]?.textContent?.trim();
    seriesNames.push(txV || `Series ${seriesNames.length + 1}`);

    const cat = ser.getElementsByTagNameNS("*", "cat")[0];
    const catVs = Array.from(cat?.getElementsByTagNameNS("*", "v") ?? []).map(
      (n) => (n.textContent || "").trim(),
    );
    categoriesBySeries.push(catVs.filter(Boolean));

    const val = ser.getElementsByTagNameNS("*", "val")[0];
    const valVs = Array.from(val?.getElementsByTagNameNS("*", "v") ?? []).map(
      (n) => {
        const raw = (n.textContent || "").trim();
        if (!raw) return null;
        const num = Number(raw);
        return Number.isFinite(num) ? num : raw;
      },
    );
    valuesBySeries.push(valVs);
  }

  // Pick a "best" categories list to display (prefer the longest).
  const categories = categoriesBySeries.reduce(
    (best: string[], curr: string[]) =>
      curr.length > best.length ? curr : best,
    [] as string[],
  );

  return {
    name,
    seriesNames,
    categories,
    valuesBySeries,
  };
};

const extractDocxAssets = async (buffer: ArrayBuffer) => {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(buffer);

  const zipFiles = Object.values(zip.files) as Array<{
    dir: boolean;
    name: string;
  }>;

  const allFileNames = zipFiles.filter((f) => !f.dir).map((f) => f.name);

  const mediaFiles = allFileNames
    .filter((name) => /^word\/media\//i.test(name))
    .sort((a, b) => a.localeCompare(b));

  const images: DocxEmbeddedImage[] = [];

  for (const name of mediaFiles) {
    const file = zip.file(name);
    if (!file) continue;
    const mime = guessMimeFromFilename(name);

    if (!isBrowserRenderableImageMime(mime)) {
      images.push({
        name,
        mime,
        reasonUnsupported:
          mime === "image/emf" || mime === "image/wmf"
            ? "EMF/WMF vectors are not renderable in browsers"
            : `Unsupported image type (${mime})`,
      });
      continue;
    }

    const base64 = await file.async("base64");
    images.push({ name, mime, url: `data:${mime};base64,${base64}` });
  }

  const chartFiles = zipFiles
    .filter((f) => !f.dir && /^word\/charts\/chart\d+\.xml$/i.test(f.name))
    .map((f) => f.name)
    .sort((a, b) => a.localeCompare(b));

  const charts: DocxChartPreview[] = [];
  for (const chartName of chartFiles) {
    const file = zip.file(chartName);
    if (!file) continue;
    try {
      const xml = await file.async("text");
      const preview = extractChartPreview(xml, chartName);
      if (preview.seriesNames.length > 0) charts.push(preview);
    } catch {
      // ignore chart parse failures
    }
  }

  // External (linked) images are referenced via relationship files.
  // These won't exist under word/media and will often render as blank placeholders.
  const relFiles = allFileNames
    .filter(
      (name) =>
        /^word\/_rels\/.*\.rels$/i.test(name) ||
        /^word\/.*\.xml\.rels$/i.test(name),
    )
    .sort((a, b) => a.localeCompare(b));

  const externalImageTargets: string[] = [];
  for (const relName of relFiles) {
    const file = zip.file(relName);
    if (!file) continue;
    try {
      const xml = await file.async("text");
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      const rels = Array.from(doc.getElementsByTagName("Relationship"));
      for (const rel of rels) {
        const type = rel.getAttribute("Type") || "";
        const target = rel.getAttribute("Target") || "";
        const targetMode = rel.getAttribute("TargetMode") || "";
        if (!target) continue;
        if (!/\/relationships\/image$/i.test(type)) continue;
        if (!/^external$/i.test(targetMode)) continue;
        externalImageTargets.push(target);
      }
    } catch {
      // ignore rel parse failures
    }
  }

  const dedupExternalImageTargets = Array.from(
    new Set(externalImageTargets.map((t) => t.trim()).filter(Boolean)),
  );

  // Embedded OLE/package objects commonly live here and may appear as blank boxes.
  const embeddingFiles = allFileNames
    .filter((name) => /^word\/embeddings\//i.test(name))
    .sort((a, b) => a.localeCompare(b));
  const embeddedObjects: DocxEmbeddedObject[] = embeddingFiles.map((name) => {
    const ext = (name.split(".").pop() || "").toLowerCase();
    if (ext === "xlsx" || ext === "xlsm" || ext === "xls") {
      return { name, kind: "spreadsheet" };
    }
    if (ext === "pptx" || ext === "ppt") {
      return { name, kind: "presentation" };
    }
    if (ext === "docx" || ext === "doc") {
      return { name, kind: "document" };
    }
    if (ext === "pdf") {
      return { name, kind: "pdf" };
    }
    if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "gif") {
      return { name, kind: "image" };
    }
    return { name, kind: "binary" };
  });

  const signals: DocxPackageSignals = {
    hasEmbeddings: embeddingFiles.length > 0,
    hasDrawings: allFileNames.some((n) =>
      /^word\/(drawings\/|drawing\d+\.xml$)/i.test(n),
    ),
    hasDiagrams: allFileNames.some((n) => /^word\/diagrams\//i.test(n)),
    hasVml: allFileNames.some(
      (n) =>
        /^word\/vmlDrawing\d+\.vml$/i.test(n) || /^word\/\w+\.vml$/i.test(n),
    ),
    hasActiveX: allFileNames.some((n) => /^word\/activeX\//i.test(n)),
  };

  return {
    images,
    charts,
    externalImageTargets: dedupExternalImageTargets,
    embeddedObjects,
    signals,
  };
};

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  src,
  contentType,
  filename,
  height = "70vh",
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [html, setHtml] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [docxBuffer, setDocxBuffer] = useState<ArrayBuffer | null>(null);
  const [docxRenderError, setDocxRenderError] = useState<string | null>(null);
  const [docxEmbeddedImages, setDocxEmbeddedImages] = useState<
    DocxEmbeddedImage[]
  >([]);
  const [docxCharts, setDocxCharts] = useState<DocxChartPreview[]>([]);
  const [docxExternalImageTargets, setDocxExternalImageTargets] = useState<
    string[]
  >([]);
  const [docxEmbeddedObjects, setDocxEmbeddedObjects] = useState<
    DocxEmbeddedObject[]
  >([]);
  const [docxSignals, setDocxSignals] = useState<DocxPackageSignals | null>(
    null,
  );
  const [docxHasAnyRenderedImages, setDocxHasAnyRenderedImages] =
    useState(false);
  const [docxPhase, setDocxPhase] = useState<
    "idle" | "extracting" | "rendering" | "rendered" | "failed"
  >("idle");
  const [csvTable, setCsvTable] = useState<{
    columns: string[];
    rows: string[][];
    truncated: boolean;
  } | null>(null);
  const [zipEntries, setZipEntries] = useState<
    Array<{ name: string; isDir: boolean }>
  >([]);
  const [pptSlides, setPptSlides] = useState<
    Array<{ name: string; text: string }>
  >([]);

  const [xlsxSheets, setXlsxSheets] = useState<string[]>([]);
  const [xlsxActiveSheet, setXlsxActiveSheet] = useState<string | null>(null);
  const [xlsxGrid, setXlsxGrid] = useState<XlsxGrid | null>(null);
  const [xlsxBuffer, setXlsxBuffer] = useState<ArrayBuffer | null>(null);
  const xlsxWorkbookRef = useRef<XLSXTypes.WorkBook | null>(null);

  const [epubUrl, setEpubUrl] = useState<string | null>(null);
  const [epubToc, setEpubToc] = useState<
    Array<{ label: string; href: string }>
  >([]);
  const [epubActiveHref, setEpubActiveHref] = useState<string>("");
  const epubContainerRef = useRef<HTMLDivElement | null>(null);
  const epubBookRef = useRef<any>(null);
  const epubRenditionRef = useRef<any>(null);

  const docxContainerRef = useRef<HTMLDivElement | null>(null);
  const docxAssetSeqRef = useRef(0);

  const docxCss = useMemo(
    () => `
[data-docx-preview] .docx-content {
  color: #111;
  line-height: 1.6;
  font-size: 14px;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
}

[data-docx-preview] .docx-content p { margin: 0 0 0.75em; }
[data-docx-preview] .docx-content h1,
[data-docx-preview] .docx-content h2,
[data-docx-preview] .docx-content h3,
[data-docx-preview] .docx-content h4 { margin: 0.9em 0 0.4em; line-height: 1.25; }

[data-docx-preview] .docx-content ul,
[data-docx-preview] .docx-content ol { margin: 0.25em 0 0.75em 1.4em; padding: 0; }
[data-docx-preview] .docx-content li { margin: 0.15em 0; }

[data-docx-preview] .docx-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.5em 0 1em;
  table-layout: auto;
}
[data-docx-preview] .docx-content td,
[data-docx-preview] .docx-content th {
  border: 1px solid #e3e3e3;
  padding: 8px;
  vertical-align: top;
}

[data-docx-preview] .docx-content img { max-width: 100%; height: auto; }

[data-docx-preview] .docx img { max-width: 100%; height: auto; }

[data-docx-preview] .docx-align-center { text-align: center; }
[data-docx-preview] .docx-align-right { text-align: right; }

/* docx-preview library output */
[data-docx-preview] .docx-wrapper {
  background: #f3f4f6;
  padding: 12px;
  border-radius: 6px;
}

[data-docx-preview] .docx {
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
}
`,
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function renderDocx() {
      if (!docxBuffer) return;
      setDocxPhase("extracting");

      // Extract embedded images + chart data from the DOCX package.
      // This provides a fallback when charts/images are present but not rendered
      // by the primary docx renderer.
      const assetSeq = (docxAssetSeqRef.current += 1);
      try {
        const assets = await extractDocxAssets(docxBuffer);
        if (!cancelled && assetSeq === docxAssetSeqRef.current) {
          setDocxEmbeddedImages(assets.images);
          setDocxCharts(assets.charts);
          setDocxExternalImageTargets(assets.externalImageTargets);
          setDocxEmbeddedObjects(assets.embeddedObjects);
          setDocxSignals(assets.signals);
        }
      } catch {
        if (!cancelled && assetSeq === docxAssetSeqRef.current) {
          setDocxEmbeddedImages([]);
          setDocxCharts([]);
          setDocxExternalImageTargets([]);
          setDocxEmbeddedObjects([]);
          setDocxSignals(null);
        }
      }

      setDocxRenderError(null);
      setDocxHasAnyRenderedImages(false);

      // Wait for the container ref to exist (avoid rare timing/race issues).
      let tries = 0;
      while (!docxContainerRef.current && tries < 20) {
        if (cancelled) return;
        await new Promise<void>((resolve) => {
          const g = globalThis as unknown as {
            requestAnimationFrame?: (cb: () => void) => unknown;
            setTimeout?: (cb: () => void, ms?: number) => unknown;
          };

          if (typeof g.requestAnimationFrame === "function") {
            g.requestAnimationFrame(() => resolve());
            return;
          }
          if (typeof g.setTimeout === "function") {
            g.setTimeout(() => resolve(), 16);
            return;
          }
          void Promise.resolve().then(() => resolve());
        });
        tries += 1;
      }
      if (!docxContainerRef.current) {
        setDocxRenderError("DOCX preview container not ready");
        setDocxPhase("failed");
        return;
      }

      try {
        setDocxPhase("rendering");
        const el = docxContainerRef.current;
        el.innerHTML = "";

        const options: DocxPreviewOptions = {
          className: "docx",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          renderComments: true,
          renderChanges: true,
          // Prefer base64 URLs for embedded resources (images, etc.) to avoid
          // issues with blob URL lifetimes/CSP in some environments.
          useBase64URL: true,
        };

        const { renderAsync } = await loadDocxPreview();
        await renderAsync(docxBuffer, el, undefined, options);

        // Detect if the main renderer produced any images.
        // (Charts often fail to render; in that case we show extracted assets.)
        const scheduleMicrotask = (fn: () => void) => {
          const g = globalThis as unknown as {
            queueMicrotask?: (cb: () => void) => void;
          };
          if (typeof g.queueMicrotask === "function") {
            g.queueMicrotask(fn);
            return;
          }
          void Promise.resolve().then(fn);
        };

        scheduleMicrotask(() => {
          if (cancelled) return;
          const hasImg =
            el.querySelector("img") != null ||
            el.querySelector("svg image") != null;
          setDocxHasAnyRenderedImages(hasImg);
          setDocxPhase("rendered");
        });
      } catch (e: unknown) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setDocxRenderError(message || "Failed to render DOCX preview");
        setDocxPhase("failed");

        // Fallback: Mammoth semantic HTML conversion + sanitization.
        try {
          const mammoth = await loadMammoth();
          const transforms = (
            mammoth as unknown as { transforms?: MammothTransforms }
          ).transforms;
          const transformDocument: ((element: unknown) => unknown) | undefined =
            transforms?.paragraph
              ? (transforms.paragraph((paragraph) => {
                  if (paragraph.alignment === "center" && !paragraph.styleId) {
                    return { ...paragraph, styleId: "DocxAlignCenter" };
                  }
                  if (paragraph.alignment === "right" && !paragraph.styleId) {
                    return { ...paragraph, styleId: "DocxAlignRight" };
                  }
                  return paragraph;
                }) as unknown as (element: unknown) => unknown)
              : undefined;

          const mammothOptions: Parameters<typeof mammoth.convertToHtml>[1] = {
            ignoreEmptyParagraphs: false,
            includeEmbeddedStyleMap: true,
            includeDefaultStyleMap: true,
            // Inline images as data URIs for the fallback preview.
            // (This also helps charts, which often have a rendered image fallback.)
            convertImage: mammoth.images.dataUri,
            styleMap: [
              "p.DocxAlignCenter => p.docx-align-center:fresh",
              "p.DocxAlignRight => p.docx-align-right:fresh",
            ],
            ...(transformDocument ? { transformDocument } : {}),
          };

          const result = await mammoth.convertToHtml(
            { arrayBuffer: docxBuffer },
            mammothOptions,
          );
          const sanitized = DOMPurify.sanitize(result.value, {
            USE_PROFILES: { html: true },
            // Allow safe embedded images produced by mammoth's inline converter.
            ADD_TAGS: ["img"],
            ADD_ATTR: ["src", "alt", "title", "width", "height", "style"],
            ALLOWED_URI_REGEXP:
              /^(?:(?:https?|mailto|tel):|data:image\/|blob:)/i,
          });
          if (!cancelled) setHtml(sanitized);
        } catch {
          // keep original docxRenderError
        }
      }
    }

    void renderDocx();

    return () => {
      cancelled = true;
    };
  }, [docxBuffer]);

  const loadSeqRef = useRef(0);

  const kind = useMemo(
    () => guessKind(contentType, filename),
    [contentType, filename],
  );

  useEffect(() => {
    return () => {
      if (epubUrl) URL.revokeObjectURL(epubUrl);
    };
  }, [epubUrl]);

  useEffect(() => {
    if (kind !== "epub") return;
    if (!epubUrl) return;
    const container = epubContainerRef.current;
    if (!container) return;

    let cancelled = false;
    container.innerHTML = "";

    void (async () => {
      try {
        const epubMod = await loadEpubJs();
        const ePubFactory: any =
          (epubMod as any).default ?? (epubMod as any).ePub ?? epubMod;

        const book = (ePubFactory as any)(epubUrl);
        epubBookRef.current = book;
        const rendition = book.renderTo(container, {
          width: "100%",
          height: "100%",
          spread: "none",
        });
        epubRenditionRef.current = rendition;

        void Promise.resolve(rendition.display()).catch(() => {
          // errors handled via setError below when possible
        });

        void Promise.resolve(book.loaded?.navigation)
          .then((nav: any) => {
            if (cancelled) return;
            const toc = (nav?.toc || [])
              .map((item: any) => ({
                label: String(item?.label || item?.title || "Chapter"),
                href: String(item?.href || ""),
              }))
              .filter((i: any) => Boolean(i.href));
            setEpubToc(toc);
          })
          .catch(() => {
            // TOC is optional
          });

        if (typeof rendition?.on === "function") {
          rendition.on("relocated", (location: any) => {
            if (cancelled) return;
            const currentHref = String(location?.start?.href || "");
            if (currentHref) setEpubActiveHref(currentHref);
          });
        }
      } catch (e: unknown) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setError(message || "Failed to render EPUB");
      }
    })();

    return () => {
      cancelled = true;
      try {
        epubRenditionRef.current?.destroy?.();
      } catch {
        // ignore
      }
      try {
        epubBookRef.current?.destroy?.();
      } catch {
        // ignore
      }
      epubRenditionRef.current = null;
      epubBookRef.current = null;
      if (container) container.innerHTML = "";
    };
  }, [kind, epubUrl]);

  const titleText = useMemo(() => {
    if (filename) return filename;
    return kind === "docx"
      ? "Word document"
      : kind === "xlsx"
        ? "Spreadsheet"
        : kind === "pptx"
          ? "Presentation"
          : kind === "md"
            ? "Markdown"
            : kind === "html"
              ? "HTML"
              : kind === "rtf"
                ? "Rich Text"
                : kind === "json"
                  ? "JSON"
                  : kind === "xml"
                    ? "XML"
                    : kind === "yaml"
                      ? "YAML"
                      : kind === "log"
                        ? "Log"
                        : kind === "odt"
                          ? "OpenDocument Text"
                          : kind === "ods"
                            ? "OpenDocument Spreadsheet"
                            : kind === "odp"
                              ? "OpenDocument Presentation"
                              : kind === "epub"
                                ? "EPUB"
                                : kind === "zip"
                                  ? "ZIP archive"
                                  : kind === "csv"
                                    ? "CSV"
                                    : kind === "txt"
                                      ? "Text"
                                      : "Document";
  }, [filename, kind]);

  useEffect(() => {
    let cancelled = false;
    const seq = (loadSeqRef.current += 1);

    const reset = () => {
      setError(null);
      setHtml(null);
      setText(null);
      setDocxBuffer(null);
      setDocxRenderError(null);
      setDocxEmbeddedImages([]);
      setDocxCharts([]);
      setDocxExternalImageTargets([]);
      setDocxEmbeddedObjects([]);
      setDocxSignals(null);
      setDocxHasAnyRenderedImages(false);
      setDocxPhase("idle");
      setCsvTable(null);
      setZipEntries([]);
      setPptSlides([]);
      setXlsxSheets([]);
      setXlsxActiveSheet(null);
      setXlsxGrid(null);
      setXlsxBuffer(null);
      xlsxWorkbookRef.current = null;
      setEpubToc([]);
      setEpubActiveHref("");
      setEpubUrl(null);
    };

    async function load() {
      setIsLoading(true);
      reset();

      try {
        if (!src) throw new Error("Missing document source");

        const res = await globalThis.fetch(src);
        const blob = await res.blob();

        // Safety/perf guard: keep previews from blowing up memory.
        const MAX_PREVIEW_BYTES = 25 * 1024 * 1024;
        if (blob.size > MAX_PREVIEW_BYTES) {
          throw new Error(
            `Document is too large to preview safely (${formatBytes(blob.size)}). Use Download instead.`,
          );
        }

        const buffer = await blob.arrayBuffer();

        if (cancelled || seq !== loadSeqRef.current) return;

        if (kind === "docx") {
          setDocxBuffer(buffer);
          setIsLoading(false);
          return;
        }

        if (kind === "xlsx") {
          setXlsxBuffer(buffer);
          const XLSX = await loadXLSX();
          const workbook = XLSX.read(new Uint8Array(buffer), {
            type: "array",
            cellText: true,
            cellDates: true,
          });
          xlsxWorkbookRef.current = workbook;
          const sheets = workbook.SheetNames || [];
          setXlsxSheets(sheets);
          const first = sheets[0] || null;
          setXlsxActiveSheet(first);

          if (first) {
            const sheet = workbook.Sheets[first];
            if (!sheet) {
              throw new Error("Failed to load spreadsheet sheet");
            }
            setXlsxGrid(
              buildXlsxGridFromSheet(XLSX, sheet, {
                maxRows: 200,
                maxCols: 60,
              }),
            );
          }
          return;
        }

        if (kind === "pptx") {
          const JSZip = await loadJSZip();
          const zip = await JSZip.loadAsync(buffer);
          const slideFiles = Object.keys(zip.files)
            .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
            .sort((a, b) => {
              const an = Number(a.match(/slide(\d+)\.xml/i)?.[1] ?? 0);
              const bn = Number(b.match(/slide(\d+)\.xml/i)?.[1] ?? 0);
              return an - bn;
            });

          const slides: Array<{ name: string; text: string }> = [];
          for (const slideName of slideFiles) {
            const file = zip.file(slideName);
            if (!file) continue;
            const xml = await file.async("text");
            const doc = new DOMParser().parseFromString(xml, "application/xml");
            const textNodes = Array.from(doc.getElementsByTagNameNS("*", "t"));
            const lines = textNodes
              .map((n) => (n.textContent || "").trim())
              .filter(Boolean);
            slides.push({
              name: slideName,
              text: lines.length ? lines.join("\n") : "(No text found)",
            });
          }
          setPptSlides(slides);
          return;
        }

        if (kind === "zip") {
          const JSZip = await loadJSZip();
          const zip = await JSZip.loadAsync(buffer);
          const entries = (
            Object.values(zip.files) as Array<{ name: string; dir: boolean }>
          )
            .map((f) => ({ name: f.name, isDir: f.dir }))
            .sort((a, b) => a.name.localeCompare(b.name));
          setZipEntries(entries);
          return;
        }

        if (kind === "csv") {
          const decoded = new TextDecoder("utf-8", { fatal: false }).decode(
            buffer,
          );
          const Papa = await loadPapaParse();
          const parsed = Papa.parse(decoded, {
            skipEmptyLines: true,
          }) as { data?: unknown; errors?: Array<{ message?: string }> };

          if (parsed.errors?.length) {
            throw new Error(parsed.errors[0]?.message || "Failed to parse CSV");
          }

          const rows = (parsed.data || []) as unknown as string[][];
          const MAX_ROWS = 300;
          const MAX_COLS = 40;
          const clipped = rows
            .slice(0, MAX_ROWS)
            .map((r) => r.slice(0, MAX_COLS));
          const truncated =
            rows.length > MAX_ROWS || (rows[0]?.length ?? 0) > MAX_COLS;

          const header = clipped[0] ?? [];
          const body = clipped.length > 1 ? clipped.slice(1) : [];

          setCsvTable({
            columns: header,
            rows: body,
            truncated,
          });
          return;
        }

        if (kind === "txt") {
          const decoded = new TextDecoder("utf-8", { fatal: false }).decode(
            buffer,
          );
          setText(decoded);
          return;
        }

        if (kind === "log") {
          const decoded = new TextDecoder("utf-8", { fatal: false }).decode(
            buffer,
          );
          setText(decoded);
          return;
        }

        if (kind === "json") {
          const decoded = new TextDecoder("utf-8", { fatal: false }).decode(
            buffer,
          );
          try {
            const parsed = JSON.parse(decoded);
            setText(JSON.stringify(parsed, null, 2));
          } catch {
            setText(decoded);
          }
          return;
        }

        if (kind === "xml") {
          const decoded = new TextDecoder("utf-8", { fatal: false }).decode(
            buffer,
          );
          setText(decoded);
          return;
        }

        if (kind === "yaml") {
          const decoded = new TextDecoder("utf-8", { fatal: false }).decode(
            buffer,
          );
          setText(decoded);
          return;
        }

        if (kind === "md") {
          const decoded = new TextDecoder("utf-8", { fatal: false }).decode(
            buffer,
          );
          const markedMod = await loadMarked();
          const markedInstance: any =
            (markedMod as any).marked ??
            (markedMod as any).default ??
            markedMod;
          const rendered =
            typeof markedInstance?.parse === "function"
              ? markedInstance.parse(decoded)
              : String(decoded);
          const sanitized = DOMPurify.sanitize(String(rendered || ""), {
            USE_PROFILES: { html: true },
            ALLOWED_URI_REGEXP:
              /^(?:(?:https?|mailto|tel):|data:image\/|blob:)/i,
          });
          setHtml(sanitized);
          return;
        }

        if (kind === "html") {
          const decoded = new TextDecoder("utf-8", { fatal: false }).decode(
            buffer,
          );
          const sanitized = DOMPurify.sanitize(decoded, {
            USE_PROFILES: { html: true },
            ALLOWED_URI_REGEXP:
              /^(?:(?:https?|mailto|tel):|data:image\/|blob:)/i,
          });
          setHtml(sanitized);
          return;
        }

        if (kind === "rtf") {
          const decoded = new TextDecoder("utf-8", { fatal: false }).decode(
            buffer,
          );
          setText(rtfToText(decoded));
          return;
        }

        if (kind === "odt") {
          const JSZip = await loadJSZip();
          const zip = await JSZip.loadAsync(buffer);
          const content = zip.file("content.xml");
          if (!content) {
            throw new Error("Invalid ODT: missing content.xml");
          }
          const xml = await content.async("text");
          const text = stripXmlToText(xml);
          setText(text || "(No text found)");
          return;
        }

        if (kind === "ods") {
          const JSZip = await loadJSZip();
          const zip = await JSZip.loadAsync(buffer);
          const content = zip.file("content.xml");
          if (!content) {
            throw new Error("Invalid ODS: missing content.xml");
          }
          const xml = await content.async("text");
          const text = stripXmlToText(xml);
          setText(text || "(No text found)");
          return;
        }

        if (kind === "odp") {
          const JSZip = await loadJSZip();
          const zip = await JSZip.loadAsync(buffer);
          const content = zip.file("content.xml");
          if (!content) {
            throw new Error("Invalid ODP: missing content.xml");
          }
          const xml = await content.async("text");
          const text = stripXmlToText(xml);
          setText(text || "(No text found)");
          return;
        }

        if (kind === "epub") {
          const url = URL.createObjectURL(
            new Blob([buffer], { type: "application/epub+zip" }),
          );
          setEpubUrl(url);
          return;
        }

        if (kind === "legacy-office") {
          throw new Error(
            "Preview for legacy Office formats (.doc/.xls/.ppt) isn’t supported yet. Please convert to .docx/.xlsx/.pptx or use Download.",
          );
        }

        throw new Error("Unsupported document preview type");
      } catch (e: unknown) {
        if (cancelled || seq !== loadSeqRef.current) return;
        const message = e instanceof Error ? e.message : String(e);
        setError(message || "Failed to preview document");
      } finally {
        if (!cancelled && seq === loadSeqRef.current) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [src, kind]);

  const renderXlsxGrid = () => {
    if (!xlsxGrid) return null;
    const rows = xlsxGrid.cells;
    const colCount = rows[0]?.length ?? 0;
    if (!rows.length || colCount === 0) {
      return <div style={{ color: "var(--text-secondary)" }}>Empty sheet</div>;
    }

    const rowCount = rows.length;
    const { rowOffset, colOffset } = xlsxGrid;

    const skip = new Set<string>();
    const spanByStart = new Map<string, { rowSpan: number; colSpan: number }>();

    for (const m of xlsxGrid.merges) {
      const sr = m.s.r - rowOffset;
      const sc = m.s.c - colOffset;
      const er = m.e.r - rowOffset;
      const ec = m.e.c - colOffset;
      if (sr < 0 || sc < 0) continue;
      if (sr >= rowCount || sc >= colCount) continue;
      const rowSpan = Math.max(1, Math.min(rowCount - 1, er) - sr + 1);
      const colSpan = Math.max(1, Math.min(colCount - 1, ec) - sc + 1);
      spanByStart.set(`${sr}:${sc}`, { rowSpan, colSpan });
      for (let r = sr; r < sr + rowSpan; r++) {
        for (let c = sc; c < sc + colSpan; c++) {
          if (r === sr && c === sc) continue;
          skip.add(`${r}:${c}`);
        }
      }
    }

    return (
      <div style={{ width: "100%" }}>
        {xlsxGrid.truncated ? (
          <div
            className="banner banner-warning"
            style={{ fontSize: "0.875rem", marginBottom: "12px" }}
          >
            Preview truncated for performance.
          </div>
        ) : null}

        <div
          style={{
            overflow: "auto",
            borderRadius: 6,
            border: "1px solid var(--border-primary)",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "white",
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    position: "sticky",
                    top: 0,
                    left: 0,
                    zIndex: 4,
                    background: "#f6f6f6",
                    borderBottom: "1px solid #ddd",
                    borderRight: "1px solid #ddd",
                    padding: "8px",
                    textAlign: "right",
                    fontSize: "0.75rem",
                    whiteSpace: "nowrap",
                    minWidth: 44,
                  }}
                />
                {Array.from({ length: colCount }, (_, idx) => idx).map(
                  (idx) => (
                    <th
                      key={idx}
                      style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 3,
                        background: "#f6f6f6",
                        borderBottom: "1px solid #ddd",
                        borderRight: "1px solid #eee",
                        padding: "8px",
                        textAlign: "left",
                        fontSize: "0.875rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {encodeExcelCol(colOffset + idx)}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ridx) => (
                <tr key={ridx}>
                  <th
                    style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 2,
                      background: "#f6f6f6",
                      borderRight: "1px solid #ddd",
                      borderBottom: "1px solid #eee",
                      padding: "8px",
                      textAlign: "right",
                      fontSize: "0.75rem",
                      whiteSpace: "nowrap",
                      minWidth: 44,
                    }}
                  >
                    {rowOffset + ridx + 1}
                  </th>
                  {Array.from({ length: colCount }, (_, cidx) => {
                    const key = `${ridx}:${cidx}`;
                    if (skip.has(key)) return null;
                    const span = spanByStart.get(key);
                    return (
                      <td
                        key={cidx}
                        rowSpan={span?.rowSpan}
                        colSpan={span?.colSpan}
                        style={{
                          borderBottom: "1px solid #eee",
                          borderRight: "1px solid #f1f1f1",
                          padding: "8px",
                          fontSize: "0.875rem",
                          whiteSpace: "nowrap",
                          background: span ? "#fafafa" : "white",
                        }}
                      >
                        {String(r?.[cidx] ?? "")}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCsvTable = () => {
    if (!csvTable) return null;

    return (
      <div style={{ width: "100%" }}>
        {csvTable.truncated ? (
          <div
            className="banner banner-warning"
            style={{ fontSize: "0.875rem", marginBottom: "12px" }}
          >
            Preview truncated for performance.
          </div>
        ) : null}

        <div
          style={{
            overflow: "auto",
            borderRadius: 6,
            border: "1px solid var(--border-primary)",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "white",
            }}
          >
            <thead>
              <tr>
                {csvTable.columns.map((h, idx) => (
                  <th
                    key={idx}
                    style={{
                      position: "sticky",
                      top: 0,
                      background: "#f6f6f6",
                      borderBottom: "1px solid #ddd",
                      padding: "8px",
                      textAlign: "left",
                      fontSize: "0.875rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {String(h ?? "")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {csvTable.rows.map((r, ridx) => (
                <tr key={ridx}>
                  {csvTable.columns.map((_, cidx) => (
                    <td
                      key={cidx}
                      style={{
                        borderBottom: "1px solid #eee",
                        padding: "8px",
                        fontSize: "0.875rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {String(r?.[cidx] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div
      data-testid="document-viewer"
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
            maxWidth: "70%",
          }}
          title={titleText}
        >
          {titleText}
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
          {kind.toUpperCase()}
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
              Document preview failed
            </div>
            <div style={{ fontSize: "0.875rem" }}>{error}</div>
          </div>
        ) : docxBuffer ? (
          <div
            data-docx-preview
            style={{
              width: "100%",
              background: "white",
              borderRadius: 6,
              border: "1px solid #ddd",
              padding: 16,
            }}
          >
            <style>{docxCss}</style>
            {docxRenderError ? (
              <div
                style={{
                  marginBottom: 12,
                  color: "#6b7280",
                  fontSize: "0.875rem",
                }}
              >
                DOCX layout preview failed ({docxRenderError}). Showing fallback
                preview.
              </div>
            ) : null}
            {html ? (
              <div
                className="docx-content"
                // Sanitized via DOMPurify
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <div ref={docxContainerRef} />
            )}

            {/* Asset fallback when charts/images don't render */}
            {!html && !docxRenderError && !docxHasAnyRenderedImages ? (
              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    marginBottom: 10,
                    padding: "10px 12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    background: "#fafafa",
                    color: "#111",
                    fontSize: "0.875rem",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    DOCX preview fallback
                  </div>
                  <div style={{ color: "#6b7280" }}>
                    {`Renderer phase: ${docxPhase}. Extracted: ${docxEmbeddedImages.length} images, ${docxCharts.length} charts, ${docxExternalImageTargets.length} external image links, ${docxEmbeddedObjects.length} embedded objects.`}
                  </div>
                  {docxEmbeddedImages.length === 0 &&
                  docxCharts.length === 0 &&
                  docxExternalImageTargets.length === 0 &&
                  docxEmbeddedObjects.length === 0 ? (
                    <div style={{ color: "#6b7280", marginTop: 6 }}>
                      No embedded images, chart XML, external image links, or
                      embedded objects were found in this DOCX. If the document
                      only contains drawing objects (e.g., SmartArt/shapes) or
                      vector content without raster fallbacks, the browser
                      preview may appear blank. Use Download to view it exactly.
                    </div>
                  ) : null}

                  {docxSignals ? (
                    <div style={{ color: "#6b7280", marginTop: 6 }}>
                      {`Package signals: embeddings=${String(docxSignals.hasEmbeddings)}, drawings=${String(docxSignals.hasDrawings)}, diagrams=${String(docxSignals.hasDiagrams)}, vml=${String(docxSignals.hasVml)}, activeX=${String(docxSignals.hasActiveX)}`}
                    </div>
                  ) : null}
                </div>

                {docxExternalImageTargets.length ? (
                  <div style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        marginBottom: 6,
                        color: "#111",
                      }}
                    >
                      Linked images (external)
                    </div>
                    <div style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                      This DOCX references images via external links (not
                      embedded in the file). For privacy and reliability, the
                      in-app preview doesn’t fetch external image URLs, so Word
                      may show a blank placeholder. Embed the image into the
                      DOCX or use Download.
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: 10,
                        background: "#fff",
                        fontSize: "0.75rem",
                        color: "#6b7280",
                        maxHeight: 140,
                        overflow: "auto",
                        wordBreak: "break-word",
                      }}
                    >
                      {docxExternalImageTargets.slice(0, 12).map((t) => (
                        <div key={t}>{t}</div>
                      ))}
                      {docxExternalImageTargets.length > 12 ? (
                        <div style={{ marginTop: 6 }}>
                          …and {docxExternalImageTargets.length - 12} more
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {docxEmbeddedObjects.length ? (
                  <div style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        marginBottom: 6,
                        color: "#111",
                      }}
                    >
                      Embedded objects
                    </div>
                    <div style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                      This DOCX contains embedded objects (OLE/packages).
                      Browsers often render these as empty boxes. Use Download
                      for exact rendering.
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: 10,
                        background: "#fff",
                        fontSize: "0.75rem",
                        color: "#6b7280",
                        maxHeight: 140,
                        overflow: "auto",
                        wordBreak: "break-word",
                      }}
                    >
                      {docxEmbeddedObjects.slice(0, 40).map((o) => (
                        <div key={o.name}>
                          {o.kind}: {o.name}
                        </div>
                      ))}
                      {docxEmbeddedObjects.length > 40 ? (
                        <div style={{ marginTop: 6 }}>
                          …and {docxEmbeddedObjects.length - 40} more
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {docxEmbeddedImages.some((i) => i.url) ? (
                  <div style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        marginBottom: 6,
                        color: "#111",
                      }}
                    >
                      Embedded images
                    </div>
                    <div
                      style={{
                        color: "#6b7280",
                        fontSize: "0.875rem",
                        marginBottom: 10,
                      }}
                    >
                      The DOCX renderer didn’t output any images. Showing the
                      embedded image assets extracted from the DOCX.
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 12,
                      }}
                    >
                      {docxEmbeddedImages
                        .filter((i) => i.url)
                        .map((img) => (
                          <div
                            key={img.name}
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: 8,
                              padding: 10,
                              background: "#fff",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "#6b7280",
                                marginBottom: 6,
                                wordBreak: "break-word",
                              }}
                            >
                              {img.name}
                            </div>
                            <img
                              src={img.url}
                              alt={img.name}
                              style={{
                                width: "100%",
                                height: "auto",
                                borderRadius: 6,
                                border: "1px solid #f3f4f6",
                                background: "#f9fafb",
                              }}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null}

                {docxEmbeddedImages.some((i) => !i.url) ? (
                  <div style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        marginBottom: 6,
                        color: "#111",
                      }}
                    >
                      Unsupported embedded images
                    </div>
                    <div style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                      Some DOCX embedded images are in formats browsers can’t
                      render directly (commonly EMF/WMF charts). Use Download to
                      view them exactly.
                    </div>
                  </div>
                ) : null}

                {docxCharts.length ? (
                  <div style={{ marginTop: 10 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        marginBottom: 6,
                        color: "#111",
                      }}
                    >
                      Chart data (extracted)
                    </div>
                    <div
                      style={{
                        color: "#6b7280",
                        fontSize: "0.875rem",
                        marginBottom: 10,
                      }}
                    >
                      If the chart can’t be rendered visually, this shows the
                      underlying series data from the DOCX.
                    </div>

                    {docxCharts.map((chart) => {
                      const maxRows = Math.max(
                        chart.categories.length,
                        ...chart.valuesBySeries.map((v) => v.length),
                      );
                      const rowCount = Math.min(maxRows, 60);
                      return (
                        <div
                          key={chart.name}
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 8,
                            padding: 10,
                            marginBottom: 12,
                            overflowX: "auto",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "#6b7280",
                              marginBottom: 8,
                              wordBreak: "break-word",
                            }}
                          >
                            {chart.name}
                          </div>
                          <table
                            style={{
                              width: "100%",
                              borderCollapse: "collapse",
                              fontSize: "0.875rem",
                            }}
                          >
                            <thead>
                              <tr>
                                <th
                                  style={{
                                    textAlign: "left",
                                    borderBottom: "1px solid #e5e7eb",
                                    padding: "6px 8px",
                                  }}
                                >
                                  Category
                                </th>
                                {chart.seriesNames.map((s) => (
                                  <th
                                    key={s}
                                    style={{
                                      textAlign: "left",
                                      borderBottom: "1px solid #e5e7eb",
                                      padding: "6px 8px",
                                    }}
                                  >
                                    {s}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {Array.from({ length: rowCount }).map(
                                (_, idx) => (
                                  <tr key={idx}>
                                    <td
                                      style={{
                                        borderBottom: "1px solid #f3f4f6",
                                        padding: "6px 8px",
                                        color: "#111",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {chart.categories[idx] ?? String(idx + 1)}
                                    </td>
                                    {chart.valuesBySeries.map((vals, sIdx) => (
                                      <td
                                        key={sIdx}
                                        style={{
                                          borderBottom: "1px solid #f3f4f6",
                                          padding: "6px 8px",
                                          color: "#111",
                                        }}
                                      >
                                        {vals[idx] == null
                                          ? ""
                                          : String(vals[idx])}
                                      </td>
                                    ))}
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                          {maxRows > rowCount ? (
                            <div
                              style={{
                                marginTop: 8,
                                color: "#6b7280",
                                fontSize: "0.75rem",
                              }}
                            >
                              Showing first {rowCount} rows.
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : html ? (
          <div
            data-docx-preview
            style={{
              width: "100%",
              background: "white",
              borderRadius: 6,
              border: "1px solid #ddd",
              padding: 16,
            }}
          >
            {kind === "docx" ? <style>{docxCss}</style> : null}
            <div
              className="docx-content"
              // Sanitized via DOMPurify
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        ) : kind === "epub" && epubUrl ? (
          <div
            style={{
              width: "100%",
              flex: 1,
              alignSelf: "stretch",
              background: "white",
              borderRadius: 6,
              border: "1px solid #ddd",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              minHeight: 360,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderBottom: "1px solid #eee",
                background: "#fafafa",
                flexWrap: "wrap",
              }}
            >
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => epubRenditionRef.current?.prev?.()}
                disabled={isLoading}
              >
                Prev
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => epubRenditionRef.current?.next?.()}
                disabled={isLoading}
              >
                Next
              </button>

              {epubToc.length ? (
                <select
                  value={epubActiveHref}
                  onChange={(e) => {
                    const href = e.target.value;
                    setEpubActiveHref(href);
                    void Promise.resolve(
                      epubRenditionRef.current?.display?.(href),
                    ).catch(() => {
                      // ignore navigation errors
                    });
                  }}
                  style={{
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: "1px solid #ddd",
                    background: "white",
                    fontSize: "0.875rem",
                    minWidth: 240,
                    maxWidth: "100%",
                  }}
                >
                  <option value="">Table of contents…</option>
                  {epubToc.map((item) => (
                    <option key={item.href} value={item.href}>
                      {item.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                  Loading chapters…
                </div>
              )}
            </div>

            <div
              ref={epubContainerRef}
              style={{
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
              }}
            />
          </div>
        ) : text != null ? (
          <pre
            style={{
              width: "100%",
              background: "white",
              borderRadius: 6,
              border: "1px solid #ddd",
              padding: 16,
              color: "#111",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: "0.875rem",
              lineHeight: 1.5,
            }}
          >
            {text}
          </pre>
        ) : csvTable ? (
          renderCsvTable()
        ) : xlsxGrid ? (
          <div style={{ width: "100%" }}>
            {xlsxSheets.length > 1 ? (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 12,
                }}
              >
                {xlsxSheets.map((s) => (
                  <button
                    key={s}
                    className={
                      s === xlsxActiveSheet
                        ? "btn btn-primary btn-sm"
                        : "btn btn-secondary btn-sm"
                    }
                    onClick={async () => {
                      const seq = loadSeqRef.current;
                      try {
                        setIsLoading(true);
                        setError(null);
                        const XLSX = await loadXLSX();
                        const workbook =
                          xlsxWorkbookRef.current ||
                          (xlsxBuffer
                            ? XLSX.read(new Uint8Array(xlsxBuffer), {
                                type: "array",
                                cellText: true,
                                cellDates: true,
                              })
                            : null);
                        if (!workbook) {
                          throw new Error("Spreadsheet not loaded");
                        }
                        if (!xlsxWorkbookRef.current) {
                          xlsxWorkbookRef.current = workbook;
                        }

                        const sheet = workbook.Sheets[s];
                        if (!sheet) {
                          throw new Error("Failed to load spreadsheet sheet");
                        }
                        if (seq !== loadSeqRef.current) return;
                        setXlsxActiveSheet(s);
                        setXlsxGrid(
                          buildXlsxGridFromSheet(XLSX, sheet, {
                            maxRows: 200,
                            maxCols: 60,
                          }),
                        );
                      } catch (e: unknown) {
                        const message =
                          e instanceof Error ? e.message : String(e);
                        setError(message || "Failed to load sheet");
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
            {renderXlsxGrid()}
          </div>
        ) : zipEntries.length ? (
          <div
            style={{
              width: "100%",
              background: "white",
              borderRadius: 6,
              border: "1px solid #ddd",
              padding: 12,
              color: "#111",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Contents</div>
            <div style={{ fontSize: "0.875rem", color: "#333" }}>
              {zipEntries.slice(0, 500).map((e) => (
                <div
                  key={e.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #f0f0f0",
                    padding: "6px 0",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  <span>{e.name}</span>
                  <span style={{ color: "#666" }}>{e.isDir ? "DIR" : ""}</span>
                </div>
              ))}
            </div>
            {zipEntries.length > 500 ? (
              <div
                style={{ marginTop: 10, color: "#666", fontSize: "0.875rem" }}
              >
                Showing first 500 entries.
              </div>
            ) : null}
          </div>
        ) : pptSlides.length ? (
          <div style={{ width: "100%" }}>
            {pptSlides.map((s) => (
              <div
                key={s.name}
                style={{
                  background: "white",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{s.name}</div>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontSize: "0.875rem",
                    lineHeight: 1.5,
                    color: "#111",
                  }}
                >
                  {s.text}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: "var(--text-secondary)", textAlign: "center" }}>
            {isLoading ? "Loading preview…" : "No preview available"}
          </div>
        )}
      </div>
    </div>
  );
};

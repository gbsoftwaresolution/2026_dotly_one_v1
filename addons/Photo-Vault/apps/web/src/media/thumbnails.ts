export type ThumbnailResult = {
  blob: Blob;
  contentType: string;
  width: number;
  height: number;
};

import { getPdfJs } from "./pdfjs";
import DOMPurify from "dompurify";
import type * as XLSXTypes from "xlsx";

let docxPreviewPromise: Promise<typeof import("docx-preview")> | null = null;
const loadDocxPreview = () => (docxPreviewPromise ??= import("docx-preview"));

let html2canvasPromise: Promise<typeof import("html2canvas")> | null = null;
const loadHtml2Canvas = () => (html2canvasPromise ??= import("html2canvas"));

let jszipPromise: Promise<any> | null = null;
const loadJSZip = async () =>
  (jszipPromise ??= import("jszip").then((m: any) => m?.default ?? m));

let markedPromise: Promise<typeof import("marked")> | null = null;
const loadMarked = () => (markedPromise ??= import("marked"));

let papaPromise: Promise<any> | null = null;
const loadPapaParse = async () =>
  (papaPromise ??= import("papaparse").then((m: any) => m?.default ?? m));

let xlsxPromise: Promise<typeof import("xlsx")> | null = null;
const loadXLSX = () => (xlsxPromise ??= import("xlsx"));

const getExtLower = (file: File): string => {
  const name = String(file.name || "");
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot + 1) : "";
  return ext.trim().toLowerCase();
};

const isDocx = (file: File): boolean => {
  const ct = String(file.type || "").toLowerCase();
  const ext = getExtLower(file);
  return (
    ct ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  );
};

const isXlsx = (file: File): boolean => {
  const ct = String(file.type || "").toLowerCase();
  const ext = getExtLower(file);
  return (
    ct ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    ext === "xlsx"
  );
};

const isPptx = (file: File): boolean => {
  const ct = String(file.type || "").toLowerCase();
  const ext = getExtLower(file);
  return (
    ct ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    ext === "pptx"
  );
};

const isZip = (file: File): boolean => {
  const ct = String(file.type || "").toLowerCase();
  const ext = getExtLower(file);
  return ct === "application/zip" || ext === "zip";
};

const isMarkdown = (file: File): boolean => {
  const ct = String(file.type || "").toLowerCase();
  const ext = getExtLower(file);
  return ct === "text/markdown" || ext === "md" || ext === "markdown";
};

const isJson = (file: File): boolean => {
  const ct = String(file.type || "").toLowerCase();
  const ext = getExtLower(file);
  return ct === "application/json" || ext === "json";
};

const isXml = (file: File): boolean => {
  const ct = String(file.type || "").toLowerCase();
  const ext = getExtLower(file);
  return ct === "application/xml" || ct === "text/xml" || ext === "xml";
};

const isYaml = (file: File): boolean => {
  const ct = String(file.type || "").toLowerCase();
  const ext = getExtLower(file);
  return (
    ct === "application/yaml" ||
    ct === "text/yaml" ||
    ext === "yml" ||
    ext === "yaml"
  );
};

const isLog = (file: File): boolean => {
  const ext = getExtLower(file);
  return ext === "log";
};

const isCsv = (file: File): boolean => {
  const ct = String(file.type || "").toLowerCase();
  const ext = getExtLower(file);
  return ct === "text/csv" || ext === "csv";
};

const isHtmlDoc = (file: File): boolean => {
  const ct = String(file.type || "").toLowerCase();
  const ext = getExtLower(file);
  return ct === "text/html" || ext === "html" || ext === "htm";
};

const isRtf = (file: File): boolean => {
  const ct = String(file.type || "").toLowerCase();
  const ext = getExtLower(file);
  return ct === "application/rtf" || ct === "text/rtf" || ext === "rtf";
};

const isOdt = (file: File): boolean => {
  const ct = String(file.type || "").toLowerCase();
  const ext = getExtLower(file);
  return ct === "application/vnd.oasis.opendocument.text" || ext === "odt";
};

const isOds = (file: File): boolean => {
  const ct = String(file.type || "").toLowerCase();
  const ext = getExtLower(file);
  return (
    ct === "application/vnd.oasis.opendocument.spreadsheet" || ext === "ods"
  );
};

const isOdp = (file: File): boolean => {
  const ct = String(file.type || "").toLowerCase();
  const ext = getExtLower(file);
  return (
    ct === "application/vnd.oasis.opendocument.presentation" || ext === "odp"
  );
};

const isEpub = (file: File): boolean => {
  const ct = String(file.type || "").toLowerCase();
  const ext = getExtLower(file);
  return ct === "application/epub+zip" || ext === "epub";
};

const stripHtmlToText = (html: string) => {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return (doc.body?.textContent || "").trim();
  } catch {
    return String(html || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
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

const wrapLines = (text: string, maxChars: number, maxLines: number) => {
  const out: string[] = [];
  const clean = String(text || "").replace(/\r\n?/g, "\n");
  for (const rawLine of clean.split("\n")) {
    let line = rawLine;
    while (line.length > maxChars) {
      out.push(line.slice(0, maxChars));
      line = line.slice(maxChars);
      if (out.length >= maxLines) return out;
    }
    out.push(line);
    if (out.length >= maxLines) return out;
  }
  return out;
};

async function generateTextSnippetThumbnail(
  text: string,
  options?: { maxDim?: number; quality?: number },
): Promise<ThumbnailResult | null> {
  const quality = options?.quality ?? 0.92;
  const maxDim = options?.maxDim ?? 640;

  const dpr =
    typeof window !== "undefined" && typeof window.devicePixelRatio === "number"
      ? window.devicePixelRatio
      : 1;
  const scale = Math.min(3, Math.max(2, Math.round(dpr * 2) / 2));

  const logicalW = 820;
  const logicalH = 540;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(logicalW * scale));
  canvas.height = Math.max(1, Math.round(logicalH * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, logicalW, logicalH);
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.strokeRect(12, 12, logicalW - 24, logicalH - 24);

  ctx.fillStyle = "#111827";
  ctx.font =
    "600 14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
  ctx.fillText("Preview", 24, 34);

  const lines = wrapLines(text, 72, 20);
  ctx.fillStyle = "#111827";
  ctx.font =
    "13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace";
  let y = 62;
  for (const line of lines) {
    ctx.fillText(line, 24, y);
    y += 22;
  }

  return scaleCanvasToResult(canvas, {
    maxDim,
    quality,
    preferredType: "image/png",
  });
}

async function generateSlideTextThumbnail(
  title: string,
  text: string,
  options?: { maxDim?: number; quality?: number },
): Promise<ThumbnailResult | null> {
  const quality = options?.quality ?? 0.92;
  const maxDim = options?.maxDim ?? 640;

  const dpr =
    typeof window !== "undefined" && typeof window.devicePixelRatio === "number"
      ? window.devicePixelRatio
      : 1;
  const scale = Math.min(3, Math.max(2, Math.round(dpr * 2) / 2));

  const logicalW = 960;
  const logicalH = 540;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(logicalW * scale));
  canvas.height = Math.max(1, Math.round(logicalH * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, logicalW, logicalH);
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.strokeRect(14, 14, logicalW - 28, logicalH - 28);

  ctx.fillStyle = "#111827";
  ctx.font =
    "600 18px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
  ctx.fillText(ellipsize(title || "Slide", 40), 28, 50);

  const lines = wrapLines(text, 86, 18);
  ctx.fillStyle = "#111827";
  ctx.font =
    "14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
  let y = 86;
  for (const line of lines) {
    ctx.fillText(line, 28, y);
    y += 24;
  }

  return scaleCanvasToResult(canvas, {
    maxDim,
    quality,
    preferredType: "image/png",
  });
}

function promiseWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
): { raced: Promise<T>; suppress: () => void } {
  let suppressFn: (() => void) | null = null;
  const raced = new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error("timeout")), ms);
    promise
      .then((v) => {
        window.clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        window.clearTimeout(t);
        reject(e);
      });
    suppressFn = () => {
      promise.catch(() => {
        // suppress unhandled rejections after timeout
      });
    };
  });
  return { raced, suppress: () => suppressFn?.() };
}

function scaleToFit(
  srcWidth: number,
  srcHeight: number,
  maxDim: number,
): { width: number; height: number } {
  const maxSrc = Math.max(srcWidth, srcHeight);
  if (maxSrc <= 0) return { width: maxDim, height: maxDim };
  const scale = Math.min(1, maxDim / maxSrc);
  return {
    width: Math.max(1, Math.round(srcWidth * scale)),
    height: Math.max(1, Math.round(srcHeight * scale)),
  };
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  preferredType: string,
  quality: number,
): Promise<{ blob: Blob; contentType: string } | null> {
  const tryType = async (type: string) => {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, quality),
    );
    return blob ? { blob, contentType: type } : null;
  };

  // Prefer requested type, fallback to JPEG.
  return (await tryType(preferredType)) || (await tryType("image/jpeg"));
}

export async function generatePdfThumbnail(
  file: File,
  options?: { maxDim?: number; quality?: number },
): Promise<ThumbnailResult | null> {
  const maxDim = options?.maxDim ?? 512;
  const quality = options?.quality ?? 1;

  try {
    const pdfjs = await getPdfJs();
    const data = new Uint8Array(await file.arrayBuffer());
    const loadingTask = pdfjs.getDocument({ data });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    const viewport1 = page.getViewport({ scale: 1 });
    const maxSrc = Math.max(viewport1.width, viewport1.height);
    const scale = maxSrc > 0 ? Math.min(1, maxDim / maxSrc) : 1;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));

    const renderTask = page.render({
      canvas: canvas,
      canvasContext: ctx,
      viewport,
    });
    await renderTask.promise;

    // Prefer PNG for document crispness.
    const encoded = await canvasToBlob(canvas, "image/png", quality);
    if (!encoded) return null;

    return {
      blob: encoded.blob,
      contentType: encoded.contentType,
      width: canvas.width,
      height: canvas.height,
    };
  } catch {
    return null;
  }
}

export async function generateImageThumbnail(
  file: File,
  options?: { maxDim?: number; quality?: number },
): Promise<ThumbnailResult | null> {
  const maxDim = options?.maxDim ?? 512;
  const quality = options?.quality ?? 0.72;

  // Using createImageBitmap avoids DOM image decode issues and is fast.
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = scaleToFit(bitmap.width, bitmap.height, maxDim);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(bitmap, 0, 0, width, height);

    const encoded = await canvasToBlob(canvas, "image/webp", quality);
    if (!encoded) return null;

    return {
      blob: encoded.blob,
      contentType: encoded.contentType,
      width,
      height,
    };
  } finally {
    bitmap.close();
  }
}

async function generateImageThumbnailFromBlob(
  blob: Blob,
  options?: { maxDim?: number; quality?: number; preferredType?: string },
): Promise<ThumbnailResult | null> {
  const maxDim = options?.maxDim ?? 512;
  const quality = options?.quality ?? 0.72;
  const preferredType = options?.preferredType;

  try {
    const bitmap = await createImageBitmap(blob);
    try {
      const { width, height } = scaleToFit(bitmap.width, bitmap.height, maxDim);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, width, height);
      const encoded = await canvasToBlob(
        canvas,
        preferredType || "image/png",
        quality,
      );
      if (!encoded) return null;
      return {
        blob: encoded.blob,
        contentType: encoded.contentType,
        width,
        height,
      };
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

async function generateRenderedHtmlThumbnail(
  html: string,
  options?: { maxDim?: number; quality?: number; timeoutMs?: number },
): Promise<ThumbnailResult | null> {
  const timeoutMs = options?.timeoutMs ?? 7000;
  const quality = options?.quality ?? 0.88;
  const maxDim = options?.maxDim ?? 640;

  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = "820px";
  host.style.background = "white";
  host.style.pointerEvents = "none";
  host.style.opacity = "0";
  host.style.zIndex = "-1";
  document.body.appendChild(host);

  const work = (async () => {
    host.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.style.padding = "16px";
    wrapper.style.fontFamily =
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    wrapper.style.color = "#111";
    wrapper.style.fontSize = "14px";
    wrapper.style.lineHeight = "1.6";
    wrapper.style.wordBreak = "break-word";
    wrapper.style.overflow = "hidden";

    const sanitized = DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      // Support common inline-image output from document renderers.
      ADD_TAGS: ["img"],
      ADD_ATTR: [
        "src",
        "alt",
        "title",
        "width",
        "height",
        "style",
        "href",
        "target",
        "rel",
        "class",
      ],
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|data:image\/|blob:)/i,
    });

    wrapper.innerHTML = sanitized;
    host.appendChild(wrapper);

    const dpr =
      typeof window !== "undefined" &&
      typeof window.devicePixelRatio === "number"
        ? window.devicePixelRatio
        : 1;
    const scale = Math.min(3, Math.max(2, Math.round(dpr * 2) / 2));

    const { default: html2canvas } = await loadHtml2Canvas();
    const canvas = await html2canvas(host, {
      backgroundColor: "#ffffff",
      logging: false,
      scale,
    });
    return scaleCanvasToResult(canvas, {
      maxDim,
      quality,
      preferredType: "image/png",
    });
  })();

  try {
    return await withTimeout(work, timeoutMs);
  } catch {
    return null;
  } finally {
    host.remove();
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(
      () => reject(new Error("Thumbnail generation timed out")),
      ms,
    );
    promise
      .then((v) => {
        window.clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        window.clearTimeout(t);
        reject(e);
      });
  });
}

async function scaleCanvasToResult(
  srcCanvas: HTMLCanvasElement,
  options?: {
    maxDim?: number;
    quality?: number;
    preferredType?: string;
  },
): Promise<ThumbnailResult | null> {
  const maxDim = options?.maxDim ?? 512;
  const quality = options?.quality ?? 0.72;
  const preferredType = options?.preferredType ?? "image/png";

  const { width, height } = scaleToFit(
    srcCanvas.width,
    srcCanvas.height,
    maxDim,
  );
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(srcCanvas, 0, 0, width, height);
  const encoded = await canvasToBlob(out, preferredType, quality);
  if (!encoded) return null;
  return {
    blob: encoded.blob,
    contentType: encoded.contentType,
    width,
    height,
  };
}

export async function generateDocxThumbnail(
  file: File,
  options?: { maxDim?: number; quality?: number; timeoutMs?: number },
): Promise<ThumbnailResult | null> {
  const timeoutMs = options?.timeoutMs ?? 9000;
  const quality = options?.quality ?? 0.86;
  const maxDim = options?.maxDim ?? 640;

  // Avoid expensive DOM work for huge files.
  const MAX_BYTES = 18 * 1024 * 1024;
  if (file.size > MAX_BYTES) return null;

  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = "820px";
  host.style.background = "white";
  host.style.pointerEvents = "none";
  host.style.opacity = "0";
  host.style.zIndex = "-1";

  document.body.appendChild(host);

  const work = (async () => {
    const buffer = await file.arrayBuffer();
    host.innerHTML = "";

    const { renderAsync } = await loadDocxPreview();
    await renderAsync(buffer, host, undefined, {
      className: "docx",
      inWrapper: true,
      breakPages: true,
      renderHeaders: true,
      renderFooters: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      useBase64URL: true,
    });

    const pageEl =
      (host.querySelector(".docx") as HTMLElement | null) ||
      (host.querySelector(".docx-wrapper") as HTMLElement | null) ||
      host;

    const dpr =
      typeof window !== "undefined" &&
      typeof window.devicePixelRatio === "number"
        ? window.devicePixelRatio
        : 1;
    const scale = Math.min(3, Math.max(2, Math.round(dpr * 2) / 2));

    const { default: html2canvas } = await loadHtml2Canvas();
    const canvas = await html2canvas(pageEl, {
      backgroundColor: "#ffffff",
      logging: false,
      scale,
    });

    return scaleCanvasToResult(canvas, {
      maxDim,
      quality,
      preferredType: "image/png",
    });
  })();

  try {
    const { raced, suppress } = promiseWithTimeout(work, timeoutMs);
    try {
      return await raced;
    } catch {
      suppress();
      return null;
    }
  } finally {
    host.remove();
  }
}

const ellipsize = (s: string, maxLen: number) => {
  if (s.length <= maxLen) return s;
  if (maxLen <= 1) return s.slice(0, 1);
  return `${s.slice(0, Math.max(0, maxLen - 1))}…`;
};

export async function generateXlsxThumbnail(
  file: File,
  options?: { maxDim?: number; quality?: number },
): Promise<ThumbnailResult | null> {
  // Avoid expensive parse for huge files.
  const MAX_BYTES = 18 * 1024 * 1024;
  if (file.size > MAX_BYTES) return null;

  try {
    const quality = options?.quality ?? 0.86;
    const maxDim = options?.maxDim ?? 640;

    const buffer = await file.arrayBuffer();
    const XLSX = await loadXLSX();
    const workbook = XLSX.read(new Uint8Array(buffer), {
      type: "array",
      cellText: true,
      cellDates: true,
    });
    const sheetName = workbook.SheetNames?.[0];
    if (!sheetName) return null;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return null;

    const ref = String(sheet["!ref"] ?? "").trim();
    if (!ref) return null;
    const range = XLSX.utils.decode_range(ref);

    const totalRows = Math.max(0, range.e.r - range.s.r + 1);
    const totalCols = Math.max(0, range.e.c - range.s.c + 1);
    const rowCount = Math.min(18, totalRows);
    const colCount = Math.min(8, totalCols);

    const rowOffset = range.s.r;
    const colOffset = range.s.c;

    const cellsByAddr = sheet as unknown as Record<
      string,
      XLSXTypes.CellObject | undefined
    >;

    const mergesRaw =
      (sheet["!merges"] as
        | Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>
        | undefined) ?? [];
    const skip = new Set<string>();
    const spanByStart = new Map<string, { rowSpan: number; colSpan: number }>();
    for (const m of mergesRaw) {
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

    const cellW = 120;
    const cellH = 28;
    const rowHdrW = 44;
    const colHdrH = 28;

    const dpr =
      typeof window !== "undefined" &&
      typeof window.devicePixelRatio === "number"
        ? window.devicePixelRatio
        : 1;
    const scale = Math.min(3, Math.max(2, Math.round(dpr * 2) / 2));

    const canvas = document.createElement("canvas");
    const logicalW = rowHdrW + colCount * cellW;
    const logicalH = colHdrH + rowCount * cellH;
    canvas.width = Math.max(1, Math.round(logicalW * scale));
    canvas.height = Math.max(1, Math.round(logicalH * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, logicalW, logicalH);

    // headers background
    ctx.fillStyle = "#f6f6f6";
    ctx.fillRect(0, 0, logicalW, colHdrH);
    ctx.fillRect(0, 0, rowHdrW, logicalH);

    // grid lines
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    for (let c = 0; c <= colCount; c++) {
      const x = rowHdrW + c * cellW;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, logicalH);
      ctx.stroke();
    }
    for (let r = 0; r <= rowCount; r++) {
      const y = colHdrH + r * cellH;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(logicalW, y);
      ctx.stroke();
    }

    // header labels
    ctx.fillStyle = "#111827";
    ctx.font =
      "600 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let c = 0; c < colCount; c++) {
      const x = rowHdrW + c * cellW + cellW / 2;
      ctx.fillText(XLSX.utils.encode_col(colOffset + c), x, colHdrH / 2);
    }
    ctx.textAlign = "right";
    for (let r = 0; r < rowCount; r++) {
      const y = colHdrH + r * cellH + cellH / 2;
      ctx.fillText(String(rowOffset + r + 1), rowHdrW - 6, y);
    }

    // cells
    ctx.font =
      "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.fillStyle = "#111827";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
        const key = `${r}:${c}`;
        if (skip.has(key)) continue;
        const span = spanByStart.get(key);
        const addr = XLSX.utils.encode_cell({
          r: rowOffset + r,
          c: colOffset + c,
        });
        const cell = cellsByAddr[addr];
        const raw = cell?.w ?? cell?.v;
        const text = raw == null ? "" : String(raw);

        const x = rowHdrW + c * cellW;
        const y = colHdrH + r * cellH;
        const w = (span?.colSpan ?? 1) * cellW;
        const h = (span?.rowSpan ?? 1) * cellH;

        // Clip text inside the cell
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 6, y + 2, w - 12, h - 4);
        ctx.clip();
        ctx.fillText(ellipsize(text, 28), x + 8, y + h / 2);
        ctx.restore();
      }
    }

    return await scaleCanvasToResult(canvas, {
      maxDim,
      quality,
      preferredType: "image/png",
    });
  } catch {
    return null;
  }
}

export async function generateCsvThumbnail(
  file: File,
  options?: { maxDim?: number; quality?: number },
): Promise<ThumbnailResult | null> {
  const MAX_BYTES = 6 * 1024 * 1024;
  if (file.size > MAX_BYTES) return null;

  try {
    const maxDim = options?.maxDim ?? 640;
    const quality = options?.quality ?? 0.9;

    const buffer = await file.arrayBuffer();
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    const Papa = await loadPapaParse();
    const parsed = Papa.parse(decoded, {
      skipEmptyLines: true,
      preview: 24,
    }) as { data?: unknown };
    const rowsRaw = ((parsed.data || []) as unknown as string[][]).filter((r) =>
      Array.isArray(r),
    );
    if (!rowsRaw.length) return null;

    const rowCount = Math.min(18, rowsRaw.length);
    const colCount = Math.min(
      8,
      Math.max(...rowsRaw.slice(0, rowCount).map((r) => r.length)),
    );
    if (colCount <= 0) return null;

    const cellW = 140;
    const cellH = 28;
    const logicalW = colCount * cellW;
    const logicalH = rowCount * cellH;

    const dpr =
      typeof window !== "undefined" &&
      typeof window.devicePixelRatio === "number"
        ? window.devicePixelRatio
        : 1;
    const scale = Math.min(3, Math.max(2, Math.round(dpr * 2) / 2));

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(logicalW * scale));
    canvas.height = Math.max(1, Math.round(logicalH * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, logicalW, logicalH);

    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    for (let r = 0; r <= rowCount; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellH);
      ctx.lineTo(logicalW, r * cellH);
      ctx.stroke();
    }
    for (let c = 0; c <= colCount; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellW, 0);
      ctx.lineTo(c * cellW, logicalH);
      ctx.stroke();
    }

    ctx.font =
      "13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.fillStyle = "#111827";
    for (let r = 0; r < rowCount; r++) {
      const row = rowsRaw[r] || [];
      for (let c = 0; c < colCount; c++) {
        const v = ellipsize(String(row[c] ?? ""), 22);
        ctx.fillText(v, c * cellW + 8, r * cellH + 19);
      }
    }

    return scaleCanvasToResult(canvas, {
      maxDim,
      quality,
      preferredType: "image/png",
    });
  } catch {
    return null;
  }
}

export async function generateVideoThumbnail(
  file: File,
  options?: { maxDim?: number; quality?: number; timeoutMs?: number },
): Promise<ThumbnailResult | null> {
  const maxDim = options?.maxDim ?? 512;
  const quality = options?.quality ?? 0.72;
  const timeoutMs = options?.timeoutMs ?? 8000;

  // Best-effort: decode a frame in-browser, no server processing.
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.src = url;

  const cleanup = () => {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  };

  try {
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        const onError = () =>
          reject(new Error("Failed to load video metadata"));
        const onLoaded = () => resolve();
        video.addEventListener("error", onError, { once: true });
        video.addEventListener("loadedmetadata", onLoaded, { once: true });
      }),
      timeoutMs,
    );

    const seekTo =
      Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(1, video.duration * 0.1)
        : 0;

    // Some browsers require a small seek to decode a frame.
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        const onError = () => reject(new Error("Failed to seek video"));
        const onSeeked = () => resolve();
        video.addEventListener("error", onError, { once: true });
        video.addEventListener("seeked", onSeeked, { once: true });
        try {
          video.currentTime = seekTo;
        } catch {
          // ignore; may still fire seeked
        }
      }),
      timeoutMs,
    );

    const srcW = video.videoWidth;
    const srcH = video.videoHeight;
    if (!srcW || !srcH) return null;

    const { width, height } = scaleToFit(srcW, srcH, maxDim);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);

    const encoded = await canvasToBlob(canvas, "image/webp", quality);
    if (!encoded) return null;

    return {
      blob: encoded.blob,
      contentType: encoded.contentType,
      width,
      height,
    };
  } catch {
    return null;
  } finally {
    cleanup();
  }
}

function getExtLabelForDocument(file: File): string {
  const name = String(file.name || "");
  const dot = name.lastIndexOf(".");
  const ext =
    dot >= 0
      ? name
          .slice(dot + 1)
          .trim()
          .toLowerCase()
      : "";
  if (!ext) return "DOC";
  if (ext === "doc" || ext === "docx") return "DOC";
  if (ext === "xls" || ext === "xlsx") return "XLS";
  if (ext === "ppt" || ext === "pptx") return "PPT";
  if (ext === "pdf") return "PDF";
  if (ext === "csv") return "CSV";
  if (ext === "txt") return "TXT";
  if (ext === "zip") return "ZIP";
  return ext.length <= 4 ? ext.toUpperCase() : ext.slice(0, 4).toUpperCase();
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export async function generateDocumentBadgeThumbnail(
  file: File,
  options?: { maxDim?: number; quality?: number },
): Promise<ThumbnailResult | null> {
  const maxDim = options?.maxDim ?? 512;
  const quality = options?.quality ?? 1;

  try {
    const size = Math.max(64, Math.min(1024, Math.round(maxDim)));
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Background
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(1, "#111827");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const pad = Math.round(size * 0.12);
    const docX = pad;
    const docY = Math.round(size * 0.12);
    const docW = size - pad * 2;
    const docH = Math.round(size * 0.7);
    const radius = Math.round(size * 0.05);

    // Shadow
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = Math.round(size * 0.05);
    ctx.shadowOffsetY = Math.round(size * 0.02);
    ctx.fillStyle = "white";
    roundedRectPath(ctx, docX, docY, docW, docH, radius);
    ctx.fill();
    ctx.restore();

    // Paper
    ctx.fillStyle = "#ffffff";
    roundedRectPath(ctx, docX, docY, docW, docH, radius);
    ctx.fill();

    // Folded corner
    const fold = Math.round(docW * 0.18);
    ctx.beginPath();
    ctx.moveTo(docX + docW - fold, docY);
    ctx.lineTo(docX + docW, docY);
    ctx.lineTo(docX + docW, docY + fold);
    ctx.closePath();
    ctx.fillStyle = "#e5e7eb";
    ctx.fill();

    // Light lines to suggest content
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = Math.max(1, Math.round(size * 0.004));
    const lineLeft = docX + Math.round(docW * 0.12);
    const lineRight = docX + docW - Math.round(docW * 0.12);
    const lineTop = docY + Math.round(docH * 0.22);
    const lineGap = Math.round(docH * 0.1);
    for (let i = 0; i < 4; i++) {
      const y = lineTop + i * lineGap;
      ctx.beginPath();
      ctx.moveTo(lineLeft, y);
      ctx.lineTo(lineRight - (i % 2 ? Math.round(docW * 0.18) : 0), y);
      ctx.stroke();
    }

    // Extension badge
    const label = getExtLabelForDocument(file);
    const badgeW = Math.round(docW * 0.62);
    const badgeH = Math.round(size * 0.14);
    const badgeX = Math.round((size - badgeW) / 2);
    const badgeY = docY + docH + Math.round(size * 0.06);
    const badgeR = Math.round(badgeH / 2);

    ctx.fillStyle = "rgba(255,255,255,0.12)";
    roundedRectPath(ctx, badgeX, badgeY, badgeW, badgeH, badgeR);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = `600 ${Math.round(size * 0.12)}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, badgeX + badgeW / 2, badgeY + badgeH / 2);

    const encoded = await canvasToBlob(canvas, "image/png", quality);
    if (!encoded) return null;

    return {
      blob: encoded.blob,
      contentType: encoded.contentType,
      width: size,
      height: size,
    };
  } catch {
    return null;
  }
}

async function extractOdfContentXmlText(file: File): Promise<string | null> {
  try {
    const buffer = await file.arrayBuffer();
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(buffer);
    const content = zip.file("content.xml");
    if (!content) return null;
    const xml = await content.async("text");
    return stripXmlToText(xml);
  } catch {
    return null;
  }
}

async function extractEpubText(file: File): Promise<string | null> {
  try {
    const buffer = await file.arrayBuffer();
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(buffer);
    const htmlNames = Object.keys(zip.files)
      .filter((n) => /\.(xhtml|html?)$/i.test(n))
      .sort((a, b) => a.localeCompare(b));
    const first = htmlNames[0];
    if (!first) return null;
    const html = await zip.file(first)!.async("text");
    return stripHtmlToText(html);
  } catch {
    return null;
  }
}

const joinZipPath = (basePath: string, href: string) => {
  const base = String(basePath || "");
  const baseDir = base.includes("/")
    ? base.slice(0, base.lastIndexOf("/") + 1)
    : "";
  const raw = `${baseDir}${String(href || "")}`;
  const parts = raw.split("/").filter((p) => p.length > 0);
  const out: string[] = [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out.join("/");
};

const guessImageMimeFromPath = (path: string) => {
  const p = String(path || "").toLowerCase();
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".gif")) return "image/gif";
  if (p.endsWith(".bmp")) return "image/bmp";
  if (p.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
};

async function extractEpubCoverBlob(file: File): Promise<Blob | null> {
  try {
    const buffer = await file.arrayBuffer();
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(buffer);

    const containerFile =
      zip.file("META-INF/container.xml") || zip.file("meta-inf/container.xml");
    const containerXml = containerFile
      ? await containerFile.async("text")
      : null;
    if (!containerXml) return null;

    const containerDoc = new DOMParser().parseFromString(
      containerXml,
      "application/xml",
    );
    const rootfileEl = containerDoc.querySelector(
      "container > rootfiles > rootfile",
    );
    const opfPath = rootfileEl?.getAttribute("full-path") || "";
    if (!opfPath) return null;

    const opfFile = zip.file(opfPath);
    if (!opfFile) return null;
    const opfXml = await opfFile.async("text");
    const opfDoc = new DOMParser().parseFromString(opfXml, "application/xml");

    // 1) EPUB3: manifest item with properties="cover-image"
    const coverItemByProp = Array.from(
      opfDoc.querySelectorAll("package > manifest > item"),
    ).find((el) => {
      const props = String(el.getAttribute("properties") || "").toLowerCase();
      return props.split(/\s+/).includes("cover-image");
    });

    // 2) EPUB2: <meta name="cover" content="id"/>
    const coverId =
      opfDoc
        .querySelector('package > metadata > meta[name="cover"]')
        ?.getAttribute("content") ||
      opfDoc
        .querySelector('metadata > meta[name="cover"]')
        ?.getAttribute("content") ||
      "";
    const coverItemById = coverId
      ? opfDoc.querySelector(`package > manifest > item#${CSS.escape(coverId)}`)
      : null;

    // 3) Heuristic: item id/href mentions cover
    const coverItemHeuristic = Array.from(
      opfDoc.querySelectorAll("package > manifest > item"),
    ).find((el) => {
      const id = String(el.getAttribute("id") || "").toLowerCase();
      const href = String(el.getAttribute("href") || "").toLowerCase();
      const mt = String(el.getAttribute("media-type") || "").toLowerCase();
      if (!mt.startsWith("image/")) return false;
      return id.includes("cover") || href.includes("cover");
    });

    const item = coverItemByProp || coverItemById || coverItemHeuristic;
    const href = item?.getAttribute("href") || "";
    const mediaType = item?.getAttribute("media-type") || "";
    let candidatePath = href ? joinZipPath(opfPath, href) : "";

    if (!candidatePath) {
      // 4) Fallback: find a common cover filename anywhere in the zip
      const names = Object.keys(zip.files);
      const coverName = names
        .filter((n) => !zip.files[n]?.dir)
        .find((n) => /(^|\/)cover\.(png|jpe?g|webp|gif)$/i.test(n));
      if (coverName) candidatePath = coverName;
    }

    if (!candidatePath) return null;
    const coverFile = zip.file(candidatePath);
    if (!coverFile) return null;
    const data = await coverFile.async("arraybuffer");
    const type =
      (String(mediaType || "")
        .toLowerCase()
        .startsWith("image/")
        ? mediaType
        : guessImageMimeFromPath(candidatePath)) || "application/octet-stream";
    return new Blob([data], { type });
  } catch {
    return null;
  }
}

async function extractPptxFirstSlideText(file: File): Promise<string | null> {
  // Avoid expensive unzip for huge files.
  const MAX_BYTES = 18 * 1024 * 1024;
  if (file.size > MAX_BYTES) return null;

  try {
    const buffer = await file.arrayBuffer();
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(buffer);
    const slideNames = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const first = slideNames[0];
    if (!first) return null;
    const xml = await zip.file(first)!.async("text");
    const doc = new DOMParser().parseFromString(xml, "application/xml");

    // PPTX text runs live in <a:t>.
    const texts = Array.from(doc.getElementsByTagNameNS("*", "t"))
      .map((el) => (el.textContent || "").trim())
      .filter(Boolean);
    const joined = texts
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return joined || null;
  } catch {
    return null;
  }
}

async function generatePptxThumbnail(
  file: File,
  options?: { maxDim?: number; quality?: number },
): Promise<ThumbnailResult | null> {
  const text = await extractPptxFirstSlideText(file);
  if (!text) return null;
  return generateSlideTextThumbnail("Slide 1", text, options);
}

async function generateZipListingThumbnail(
  file: File,
  options?: { maxDim?: number; quality?: number },
): Promise<ThumbnailResult | null> {
  const MAX_BYTES = 18 * 1024 * 1024;
  if (file.size > MAX_BYTES) return null;

  try {
    const buffer = await file.arrayBuffer();
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(buffer);
    const names = Object.keys(zip.files)
      .filter((n) => !zip.files[n]?.dir)
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 30);
    const text = names.length ? names.join("\n") : "(Empty archive)";
    return generateTextSnippetThumbnail(text, options);
  } catch {
    return null;
  }
}

async function generateTextLikeDocumentThumbnail(
  file: File,
  options?: { maxDim?: number; quality?: number },
): Promise<ThumbnailResult | null> {
  // Avoid expensive decode for huge files.
  const MAX_BYTES = 6 * 1024 * 1024;
  if (file.size > MAX_BYTES) return null;

  try {
    const buffer = await file.arrayBuffer();
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    let text = decoded;
    if (isMarkdown(file)) {
      const markedMod = await loadMarked();
      const markedInstance: any =
        (markedMod as any).marked ?? (markedMod as any).default ?? markedMod;
      const rendered =
        typeof markedInstance?.parse === "function"
          ? markedInstance.parse(decoded)
          : String(decoded);
      const sanitized = DOMPurify.sanitize(String(rendered || ""), {
        USE_PROFILES: { html: true },
        // Avoid external fetches while thumbnailing.
        FORBID_TAGS: [
          "img",
          "video",
          "audio",
          "iframe",
          "object",
          "embed",
          "svg",
        ],
      });
      const thumb = await generateRenderedHtmlThumbnail(sanitized, {
        maxDim: options?.maxDim ?? 640,
        quality: options?.quality ?? 0.9,
      });
      if (thumb) return thumb;
    }
    if (isHtmlDoc(file)) {
      const sanitized = DOMPurify.sanitize(decoded, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: [
          "img",
          "video",
          "audio",
          "iframe",
          "object",
          "embed",
          "svg",
        ],
      });
      const thumb = await generateRenderedHtmlThumbnail(sanitized, {
        maxDim: options?.maxDim ?? 640,
        quality: options?.quality ?? 0.9,
      });
      if (thumb) return thumb;
      text = stripHtmlToText(decoded);
    }
    if (isHtmlDoc(file)) text = stripHtmlToText(decoded);
    if (isRtf(file)) text = rtfToText(decoded);
    return await generateTextSnippetThumbnail(text, options);
  } catch {
    return null;
  }
}

async function generateOdtThumbnail(
  file: File,
  options?: { maxDim?: number; quality?: number },
): Promise<ThumbnailResult | null> {
  const MAX_BYTES = 18 * 1024 * 1024;
  if (file.size > MAX_BYTES) return null;
  const text = await extractOdfContentXmlText(file);
  if (!text) return null;
  return await generateTextSnippetThumbnail(text, options);
}

async function generateOdsThumbnail(
  file: File,
  options?: { maxDim?: number; quality?: number },
): Promise<ThumbnailResult | null> {
  const MAX_BYTES = 18 * 1024 * 1024;
  if (file.size > MAX_BYTES) return null;
  const text = await extractOdfContentXmlText(file);
  if (!text) return null;
  return await generateTextSnippetThumbnail(text, options);
}

async function generateOdpThumbnail(
  file: File,
  options?: { maxDim?: number; quality?: number },
): Promise<ThumbnailResult | null> {
  const MAX_BYTES = 18 * 1024 * 1024;
  if (file.size > MAX_BYTES) return null;
  const text = await extractOdfContentXmlText(file);
  if (!text) return null;
  return await generateTextSnippetThumbnail(text, options);
}

async function generateEpubThumbnail(
  file: File,
  options?: { maxDim?: number; quality?: number },
): Promise<ThumbnailResult | null> {
  const MAX_BYTES = 18 * 1024 * 1024;
  if (file.size > MAX_BYTES) return null;

  const cover = await extractEpubCoverBlob(file);
  if (cover) {
    const imageThumb = await generateImageThumbnailFromBlob(cover, {
      maxDim: options?.maxDim ?? 640,
      quality: options?.quality ?? 0.78,
      preferredType: "image/png",
    });
    if (imageThumb) return imageThumb;
  }

  const text = await extractEpubText(file);
  if (!text) return null;
  return await generateTextSnippetThumbnail(text, options);
}

export async function generateThumbnail(
  file: File,
  mediaType: "PHOTO" | "VIDEO" | "DOCUMENT",
): Promise<ThumbnailResult | null> {
  if (mediaType === "PHOTO") {
    return generateImageThumbnail(file);
  }
  if (mediaType === "VIDEO") {
    return generateVideoThumbnail(file);
  }
  if (mediaType === "DOCUMENT") {
    const isPdf =
      String(file.type || "").toLowerCase() === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      return generatePdfThumbnail(file);
    }
    if (isDocx(file)) {
      const thumb = await generateDocxThumbnail(file);
      if (thumb) return thumb;
    }
    if (isXlsx(file)) {
      const thumb = await generateXlsxThumbnail(file);
      if (thumb) return thumb;
    }

    if (isCsv(file)) {
      const thumb = await generateCsvThumbnail(file);
      if (thumb) return thumb;
    }

    if (isPptx(file)) {
      const thumb = await generatePptxThumbnail(file);
      if (thumb) return thumb;
    }

    if (
      String(file.type || "")
        .toLowerCase()
        .startsWith("text/") ||
      isMarkdown(file) ||
      isJson(file) ||
      isXml(file) ||
      isYaml(file) ||
      isLog(file) ||
      isHtmlDoc(file) ||
      isRtf(file)
    ) {
      const thumb = await generateTextLikeDocumentThumbnail(file);
      if (thumb) return thumb;
    }

    if (isOdt(file)) {
      const thumb = await generateOdtThumbnail(file);
      if (thumb) return thumb;
    }

    if (isOds(file)) {
      const thumb = await generateOdsThumbnail(file);
      if (thumb) return thumb;
    }

    if (isOdp(file)) {
      const thumb = await generateOdpThumbnail(file);
      if (thumb) return thumb;
    }

    if (isEpub(file)) {
      const thumb = await generateEpubThumbnail(file);
      if (thumb) return thumb;
    }

    if (isZip(file)) {
      const thumb = await generateZipListingThumbnail(file);
      if (thumb) return thumb;
    }

    return generateDocumentBadgeThumbnail(file);
  }
  return null;
}

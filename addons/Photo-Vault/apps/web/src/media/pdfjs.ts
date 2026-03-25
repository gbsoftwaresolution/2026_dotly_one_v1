let pdfWorkerConfigured = false;

export async function getPdfJs(): Promise<typeof import("pdfjs-dist")> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfWorkerConfigured) {
    try {
      const workerSrc = (
        await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
      ).default as string;
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    } catch {
      // If worker can't be configured, pdfjs may fall back (slower) or throw.
    }
    pdfWorkerConfigured = true;
  }
  return pdfjs;
}

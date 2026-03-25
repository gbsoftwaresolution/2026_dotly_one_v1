import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  const plugins = [react()];

  if (mode === 'analyze') {
    plugins.push(
      visualizer({
        filename: 'dist/stats.html',
        template: 'treemap',
        gzipSize: true,
        brotliSize: true,
      }) as any,
    );
  }

  return {
    plugins,
    server: {
      port: 3000,
      host: '127.0.0.1',
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Workspace runtime package(s) (may resolve outside node_modules in a monorepo).
            if (id.includes('/packages/shared/')) return 'booster-shared';

            if (!id.includes('node_modules')) return;

            // Split core runtime deps for better caching and smaller per-chunk payloads.
            if (id.includes('/node_modules/react/')) return 'react';
            if (id.includes('/node_modules/react-dom/')) return 'react-dom';
            if (
              id.includes('/node_modules/react-router/') ||
              id.includes('/node_modules/react-router-dom/')
            )
              return 'react-router';

            // Workspace runtime package(s).
            if (id.includes('/node_modules/@booster-vault/shared/')) return 'booster-shared';

            // Used for sanitization in thumbnails.
            if (id.includes('/node_modules/dompurify/')) return 'dompurify';

            if (id.includes('/node_modules/pdfjs-dist/')) return 'pdfjs';

            // Keep heavy preview/tooling deps split out.
            const docPreviewDepToChunk: Record<string, string> = {
              'docx-preview': 'docx-preview',
              mammoth: 'mammoth',
              xlsx: 'xlsx',
              papaparse: 'papaparse',
              marked: 'marked',
              epubjs: 'epubjs',
              html2canvas: 'html2canvas',
            };

            for (const [dep, chunk] of Object.entries(docPreviewDepToChunk)) {
              if (id.includes(`/node_modules/${dep}/`)) return chunk;
            }

            // For everything else, let Rollup decide chunking based on the import graph.
            return;
          },
        },
      },
    },
  };
});
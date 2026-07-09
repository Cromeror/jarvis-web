import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:7436',
    },
  },
  build: {
    // Output to packages/mcp/web-app/dist so the HTTP server can serve it.
    // The http-server.ts resolves distDir relative to its compiled location:
    //   packages/mcp/dist/http-server.js → ../../web-app/dist = packages/mcp/web-app/dist
    outDir: resolve(__dirname, '../mcp/web-app/dist'),
    emptyOutDir: true,
    // Mermaid weighs ~650KB and is loaded lazily; the default 500KB warning is
    // not actionable for our case.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          // Keep mermaid in a separate chunk to avoid bloating the initial bundle.
          mermaid: ['mermaid'],
        },
      },
    },
  },
});

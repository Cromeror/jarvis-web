import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

// .env lives at the repo root, not packages/web-app (Vite's default envDir),
// since it's shared with http-api/storage — point both Vite's own client-env
// loading and this file's loadEnv() call at it.
const envDir = resolve(__dirname, '../..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');

  return {
    plugins: [react(), tailwindcss()],
    envDir,
    server: {
      // Defaults to loopback-only, matching Vite's own default. Override to
      // 0.0.0.0 so a reverse proxy in another container/host (e.g. Traefik
      // reaching this via host.docker.internal) can reach it.
      host: env['JARVIS_WEB_APP_HOST'] ?? 'localhost',
      port: env['JARVIS_WEB_APP_PORT'] ? parseInt(env['JARVIS_WEB_APP_PORT'], 10) : 5173,
      strictPort: true,
      proxy: {
        // @jarvis/http-api (packages/http-api) — independent NestJS server,
        // not the @jarvis/mcp daemon (which stays on 7432 for the MCP shim).
        '/api': env['JARVIS_HTTP_API_URL'] ?? 'http://localhost:7433',
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
  };
});

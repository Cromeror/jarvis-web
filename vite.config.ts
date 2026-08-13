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
      // Vite 6 rejects any request whose Host header isn't recognized —
      // fine for plain localhost dev, but a reverse proxy (Traefik, via
      // host.docker.internal) forwards the original Host, not "localhost".
      // Comma-separated list in .env; unset keeps Vite's own safe default.
      allowedHosts: env['JARVIS_ALLOWED_HOSTS']
        ? env['JARVIS_ALLOWED_HOSTS'].split(',').map((h) => h.trim())
        : undefined,
      proxy: {
        // @jarvis/http-api (packages/http-api) — independent NestJS server,
        // not the @jarvis/mcp daemon (which stays on 7432 for the MCP shim).
        '/api': env['JARVIS_HTTP_API_URL'] ?? 'http://localhost:7433',
      },
    },
    build: {
      // El build vive dentro del propio paquete; http-api lo sirve desde acá
      // (packages/http-api/src/static.ts → ../../web-app/dist). Antes salía a
      // packages/mcp/web-app/dist, cuando el daemon MCP era quien lo servía —
      // el MCP se eliminó.
      outDir: resolve(__dirname, 'dist'),
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

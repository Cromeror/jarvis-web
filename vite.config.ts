import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

// El .env vive en la raíz de ESTE repo. Cuando la web era packages/web-app
// dentro del monorepo, apuntaba dos niveles arriba porque el archivo se
// compartía con http-api y storage; acá no se comparte con nadie.
const envDir = __dirname;

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
      // Proxy de desarrollo: evita CORS mientras se trabaja en local, sin
      // tener que declarar VITE_API_URL. En un build publicado no interviene
      // —Vite dev server no existe ahí—, así que para apuntar a una API en
      // otro origen la variable es VITE_API_URL. Ver README.
      proxy: {
        '/api': env['JARVIS_API_PROXY'] ?? 'http://localhost:7433',
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

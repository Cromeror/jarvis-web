# jarvis-web

SPA de Jarvis: chat, planes, workspaces, environments. React + Vite.

Vivía en `packages/web-app` del monorepo de Jarvis; se separó cuando la API dejó
de servir el bundle. **El historial de esos 86 commits se conserva acá** — este
repo no arranca en un commit inicial vacío.

## Arrancar

```bash
pnpm install
cp .env.example .env
pnpm dev            # http://localhost:5173
```

Necesita una API de Jarvis corriendo. En local, `JARVIS_API_PROXY` apunta el dev
server hacia ella y así no hay CORS.

```bash
pnpm build          # bundle estático en dist/
pnpm test           # vitest, sólo lógica pura (sin jsdom, a propósito)
```

## Cómo se conecta con la API

El front y la API son dos despliegues independientes. El contrato son **dos
variables**, una en cada lado:

| Variable | Dónde va | Se lee en | Ausente significa |
|---|---|---|---|
| `VITE_API_URL` | **este repo** | **build** | mismo origen que el front |
| `WEB_URL` | la API (`http-api`) | runtime | cualquier origen puede llamar |

### La asimetría, que es lo que confunde

`VITE_API_URL` es de **build-time**: Vite la inlinea dentro del bundle.
Cambiarla exige recompilar y volver a publicar; **reiniciar no hace nada**,
porque ningún proceso la lee. `WEB_URL`, del lado de la API, es de runtime y le
alcanza un restart.

Si este front se sirve desde un origen distinto al de la API, **las dos van
juntas**:

```bash
VITE_API_URL=https://api.jarvis.ejemplo pnpm build   # acá
WEB_URL=https://jarvis.ejemplo                       # en el .env de la API
```

Sólo la primera: el browser bloquea cada llamada por CORS. Sólo la segunda: el
front se sigue llamando a sí mismo y no llega a la API.

## Servir el bundle

`dist/` es estático, lo sirve cualquier servidor. Dos requisitos:

- **Fallback SPA**: toda ruta que no sea un archivo del bundle devuelve
  `index.html`, o un deep link recargado (`/plans/123`) da 404.
- **Nunca servir el dev server en producción**: entrega fuente sin compilar y
  arrastra CVEs de bypass de `server.fs.deny`. Publicá `dist/`, no `pnpm dev`.

## Dónde se decide el origen — un solo lugar

`src/lib/api-origin.ts`. Los módulos escriben rutas relativas (`/api/plans`) y
el interceptor de `fetch` (`src/lib/auth-fetch-interceptor.ts`) les antepone el
origen.

Dos cosas que conviene no romper:

- **Reconocer la llamada no puede ser `url.startsWith('/api/')`.** Con un origen
  absoluto ese prefijo deja de matchear y el interceptor se apaga entero —sin
  `Authorization`, sin guardar el `X-Jarvis-Token` renovado y sin reaccionar al
  401— **sin tirar una excepción**. El síntoma es "la app me desloguea sola".
  Para eso existe `apiRequestPath()`, que reconoce las dos formas.
- **`EventSource` no pasa por el interceptor.** Los cinco streams (chat,
  plan-runs, pipelines, login, file/watch) llaman a `apiUrl()` explícitamente.
  Dejar uno relativo con un origen configurado lo apunta al host del bundle y el
  chat queda mudo, sin error en consola. Hay un test que lo impide.

`src/lib/__tests__/api-origin.spec.ts` cubre los dos casos.

## Deuda conocida

`docs/deuda-conocida.md` — problemas detectados y no resueltos, con lo medido y
lo que hay que decidir antes de tocarlos. Hoy: el polling del panel Historial
(un BUG: su costo crece con la cantidad de proyectos de la instalación, no con
lo que se está mirando) y el N+1 de infraestructura del dashboard.

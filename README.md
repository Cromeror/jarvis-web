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

## Sistema de diseño — tokens, Basecoat (CSS) y Radix (comportamiento)

El aspecto de la app sale del template **SpaceMyWork**. Son tres capas, y cada
una hace una sola cosa:

| Capa | Quién | Qué aporta |
|---|---|---|
| Colores y medidas | `src/theme/tokens.css` | la fuente de verdad única — 130 tokens `--sw-*` |
| Cómo se ve | **Basecoat**, sólo su CSS | 39 componentes (`.btn`, `.card`, `.dialog`, …) |
| Cómo se comporta | **Radix** | foco, teclado, Escape, ARIA, abierto/cerrado |

### De Basecoat usamos el CSS y NADA MÁS

Su JS muta el DOM por detrás de React — medido sobre el bundle del template: 45
`setAttribute`, 14 `classList` y 4 `innerHTML`. O sea, toca el mismo árbol que
React cree controlar. El comportamiento lo pone Radix, que hace exactamente lo
mismo pero **desde** React.

No es una convención escrita al margen: `src/theme/__tests__/basecoat-solo-css.spec.ts`
la fija. El fallo que evita es silencioso — un `import` del JS compila verde y
rompe en runtime, de a ratos, sólo cuando las dos partes tocan el mismo nodo.

### Cómo se usa: `className` + `data-*`

Basecoat no expone componentes, expone clases. Las variantes son atributos de
dato:

```jsx
<button className="btn">Ejecutar</button>
<button className="btn" data-variant="secondary">Duplicar</button>
<button className="btn" data-variant="destructive">Borrar</button>
<span className="badge" data-variant="success">ok</span>
<span className="avatar" data-size="sm"><span>GB</span></span>
```

**Sus clases no son atómicas como las de Tailwind, son estructurales.** Tailwind
te da `flex`, `p-4` — planas, sin contexto. Basecoat selecciona por descendencia
(`.dropdown-menu [role=menuitem]`), así que **tu DOM tiene que tener la forma que
el CSS espera**. De ahí salen las dos trampas de abajo.

### Las dos trampas al combinar con Radix

1. **El wrapper es obligatorio y el contenido NO va portalado.** Todo el CSS del
   menú cuelga de `.dropdown-menu` como descendiente; portalado al `body` la
   cadena se corta y no le llega **una sola regla**.

   ```jsx
   <div className="dropdown-menu">
     <DropdownMenu.Root>
       <DropdownMenu.Trigger asChild>…</DropdownMenu.Trigger>
       {/* sin <Portal> — a propósito */}
       <DropdownMenu.Content align="end">…</DropdownMenu.Content>
     </DropdownMenu.Root>
   </div>
   ```

2. **El posicionamiento pelea.** Radix posiciona con Floating UI (`transform`
   inline), Basecoat con `top`/`inset`. Por eso al `Content` no se le pone el
   `[data-popover]` de Basecoat: se le da a mano sólo la **superficie** — fondo,
   borde, radio y sombra, todo desde tokens.

Regla corta: de Basecoat tomás **aspecto**; posición y comportamiento son de Radix.

### El seam: `basecoat-map.css` no se toca

117 líneas que apuntan las 39 variables de Basecoat (`--background`, `--primary`,
`--radius`…) a los `--sw-*`. Ni un valor literal, ni una regla de componente. Es
lo que permite subir de versión la librería sin reescribir nada — y lo que hace
que un cambio de paleta se propague solo.

### Orden de carga (`src/styles-tailwind.css`), y por qué

1. **Tailwind primero** — Basecoat arma sus componentes con `@apply`; sin las
   utilidades, la compilación muere con `Cannot apply unknown utility class`.
2. **`tokens.css`** antes que Basecoat: el seam apunta a estos tokens.
3. **Basecoat desde npm, no vendorizado.** El bundle del template son 234 KB con
   Tailwind compilado adentro; acá lo compila el Tailwind de arriba.
   ⚠️ **`@import "basecoat-css"` no trae los componentes** — resuelve a base +
   tema. Las 39 clases hay que pedirlas aparte con `@import "basecoat-css/components"`,
   y si falta el CSS sale sin `.card` ni `.dialog`, en silencio.
4. **`base.css` después de Basecoat**, para que el reset del template le gane a
   su preflight.

### Temas

Son **tres estados, no dos**: `auto`, `light`, `dark`. `auto` es una elección, no
su ausencia — sigue al sistema en vivo vía `matchMedia`. Se estampa como
`data-theme` en el `<html>`, y el bootstrap está en `index.html` antes de la
primera pintura para que no parpadee mientras React monta.

### Íconos

39 shapes de Lucide en `src/theme/icons.js`. El registro no se toca; el tamaño
sale de `--sw-ico` vía `.sw-ico` y el color siempre es `currentColor`.

### La referencia

El template vive en `/home/jarvis-dev/template-spacemywork`
(`git@github.com:gbaamonde/SystemDesignJarvis.git`). Su `prueba-react/` es el
port validado de una pantalla: **ante duda, el componente que corre ahí es la
especificación.**

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

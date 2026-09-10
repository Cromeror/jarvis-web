#!/usr/bin/env bash
#
# Deploy de la WEB de Jarvis a PROD (el :80 de este VPS).
#
# Este repo se deploya SOLO. Hasta el 9-sep-2026 había un único deploy porque la
# web era `packages/web-app` dentro del monorepo y `http-api` la servía con un
# ServeStaticModule; publicar un cambio de front obligaba a reiniciar la API, y
# ese restart mata las sesiones de chat en curso de TODOS los proyectos. Hoy son
# dos deploys independientes:
#
#   API  → su propio repo y su propio script   (proceso, systemd)
#   WEB  → este script                         (bundle estático)
#
# Acá NO se reinicia ningún proceso. El contrato de este repo con el mundo es UN
# DIRECTORIO: `dist/`. Publicar es reemplazar sus archivos; quien los entrega al
# navegador es un servidor de estáticos que vive fuera de este repo y lee ese
# directorio por un bind mount.
#
# Este repo NO sabe cuál es ese servidor, ni dónde está su config: no lo
# necesita para hacer su trabajo, y saberlo lo ataría a decisiones de
# infraestructura que cambian por su cuenta. Lo único que se verifica es el
# RESULTADO (paso 7), que vale igual sea nginx, Caddy o un CDN.
#
# Uso:
#   ./scripts/deploy-prod.sh            # pull + install + build + publicar
#   ./scripts/deploy-prod.sh --no-pull  # publicar lo que ya está en el working tree
#   ./scripts/deploy-prod.sh --test     # correr los tests antes de publicar

set -Eeuo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$REPO_DIR/dist"
# Build a un directorio aparte y recién después publicar: si el build revienta,
# prod sigue sirviendo el bundle anterior.
STAGE_DIR="$REPO_DIR/.dist-stage"
BASE_URL="http://localhost"

DO_PULL=1
DO_TESTS=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-pull) DO_PULL=0 ;;
    --test)    DO_TESTS=1 ;;
    -h|--help) sed -n '2,25p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "Opción desconocida: $1" >&2; exit 2 ;;
  esac
  shift
done

if [[ -t 1 ]]; then
  C_OK=$'\033[32m'; C_ERR=$'\033[31m'; C_STEP=$'\033[1;36m'; C_OFF=$'\033[0m'
else
  C_OK=""; C_ERR=""; C_STEP=""; C_OFF=""
fi
step() { echo; echo "${C_STEP}==> $*${C_OFF}"; }
ok()   { echo "  ${C_OK}✓${C_OFF} $*"; }
die()  { echo "  ${C_ERR}✗${C_OFF} $*" >&2; exit 1; }

cd "$REPO_DIR"

step "[1] Preflight"
command -v pnpm >/dev/null || die "falta pnpm en el PATH"
ok "pnpm está"

if [[ $DO_PULL -eq 1 ]]; then
  step "[2] git pull"
  [[ -z "$(git status --porcelain)" ]] || die "working tree sucio — commiteá o stasheá antes"
  git pull --ff-only
  ok "en $(git rev-parse --short HEAD)"
fi

step "[3] pnpm install"
pnpm install --frozen-lockfile
ok "dependencias al día"

if [[ $DO_TESTS -eq 1 ]]; then
  step "[4] Tests"
  pnpm test
  ok "tests verdes"
fi

step "[5] Build del bundle"
# VITE_API_URL sin setear = mismo origen. En este VPS es lo correcto: el :80
# rutea /api a la API y el resto a este bundle, así que
# el front y la API comparten origen y no hay CORS. Es de BUILD-TIME: si algún
# día la API queda en otro origen, hay que rebuildear — reiniciar no hace nada.
rm -rf "$STAGE_DIR"
pnpm build --outDir "$STAGE_DIR" --emptyOutDir
[[ -f "$STAGE_DIR/index.html" ]] || die "el build no dejó index.html"
ok "bundle compilado"

step "[6] Publicar"
# rsync sobre el MISMO directorio, no `mv`: el servidor de estáticos lo tiene
# bind-mounteado, y un bind mount sigue al inodo original — reemplazar el
# directorio lo dejaría sirviendo el bundle viejo para siempre, sin error.
mkdir -p "$DIST_DIR"
rsync -a --delete "$STAGE_DIR/" "$DIST_DIR/"
rm -rf "$STAGE_DIR"
ok "publicado en $DIST_DIR"

step "[7] Verificación"
code_for() { curl -s -o /dev/null -w '%{http_code}' "$BASE_URL$1"; }
asset="$(grep -o '/assets/index-[A-Za-z0-9_-]*\.js' "$DIST_DIR/index.html" | head -1)"

[[ "$(code_for /)" == "200" ]]            || die "el :80 no devuelve la web (raíz)"
ok "raíz 200"
[[ "$(code_for /plans/123)" == "200" ]]   || die "deep link 404 — se perdió el fallback SPA"
ok "deep link 200 (fallback SPA)"
[[ -n "$asset" && "$(code_for "$asset")" == "200" ]] || die "el :80 no sirve $asset"
ok "assets 200 ($asset — el bundle recién publicado)"
# La API tiene que seguir contestando por su cuenta: si el catch-all se comiera
# /api, el front cargaría y ninguna llamada funcionaría.
[[ "$(code_for /api/version)" =~ ^(200|401)$ ]] || die "/api/* no llega a la API"
ok "/api/* sigue yendo a la API"

echo
echo "${C_OK}✓ Web deployada${C_OFF} — $(git rev-parse --short HEAD)"
echo "  la API se deploya aparte, desde su propio repo"

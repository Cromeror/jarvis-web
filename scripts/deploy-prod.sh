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
#   API  → /home/ubuntu/srv/jarvis-agent/scripts/deploy-prod.sh   (systemd jarvis-api)
#   WEB  → este script                                            (bundle estático)
#
# Acá NO se reinicia ningún proceso: el bundle lo sirve un nginx
# (jarvis-agent/traefik/web-static/) que lee el directorio `dist` por un bind
# mount. Publicar es reemplazar los archivos.
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
docker ps --filter name=jarvis-web-static --format '{{.Names}}' | grep -q . \
  || die "el container jarvis-web-static no corre — levantalo con:
      cd /home/ubuntu/srv/jarvis-agent/traefik/web-static && docker compose up -d"
ok "pnpm y el servidor de estáticos están"

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
# VITE_API_URL sin setear = mismo origen. En este VPS es lo correcto: Traefik
# rutea /api del :80 a la API (jarvis-agent/traefik/dynamic/jarvis.yml), así que
# el front y la API comparten origen y no hay CORS. Es de BUILD-TIME: si algún
# día la API queda en otro origen, hay que rebuildear — reiniciar no hace nada.
rm -rf "$STAGE_DIR"
pnpm build --outDir "$STAGE_DIR" --emptyOutDir
[[ -f "$STAGE_DIR/index.html" ]] || die "el build no dejó index.html"
ok "bundle compilado"

step "[6] Publicar"
# rsync sobre el MISMO directorio, no `mv`: nginx lo tiene bind-mounteado, y un
# bind mount sigue al inodo original — reemplazar el directorio dejaría al
# container sirviendo el bundle viejo para siempre, sin ningún error visible.
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
echo "  la API se deploya aparte: /home/ubuntu/srv/jarvis-agent/scripts/deploy-prod.sh"

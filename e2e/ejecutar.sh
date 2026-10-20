#!/usr/bin/env bash
# Corre las pruebas end to end con Playwright contra un stack desechable (SCRUM-235): el Frontend de produccion servido por nginx y el
# stack de pruebas del Backend (PostgreSQL 17, Mailpit y el backend con los limites de produccion).
#
#   bash e2e/ejecutar.sh                        todas las pruebas
#   bash e2e/ejecutar.sh -- --grep pendientes   solo las que coinciden (lo que va despues de "--" se le pasa a Playwright)
#   bash e2e/ejecutar.sh --conservar            deja el stack encendido al terminar
#   bash e2e/ejecutar.sh --sin-lighthouse       solo Playwright (las pruebas de flujos, accesibilidad con axe y PWA)
#   bash e2e/ejecutar.sh --solo-lighthouse      solo la auditoria de Lighthouse (rendimiento, accesibilidad, buenas practicas y SEO en movil)
#
# Hace falta Docker y el repositorio del Backend junto a este (../Backend) o en RUTA_BACKEND. Playwright corre dentro de su contenedor
# oficial, fijado por digest: no hay que instalar navegadores. Los informes, trazas y videos quedan en e2e/resultados/.
# Nunca apuntes esto a produccion ni a preproduccion: este script SOLO levanta su propio stack local.
set -euo pipefail
# Git Bash en Windows convierte "/etc/..." en rutas de Windows al pasarlas a docker.exe.
export MSYS_NO_PATHCONV=1
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

IMAGEN_PLAYWRIGHT="mcr.microsoft.com/playwright:v1.64.1-noble@sha256:7852dc5a7d72f5fe458a597d690f6c42fbc8e9e26ddfa95f8e6ef552558d9bbf"
PROYECTO="cundiapp-e2e"

CONSERVAR=0
LIGHTHOUSE=si
ARGUMENTOS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --conservar) CONSERVAR=1 ;;
    --sin-lighthouse) LIGHTHOUSE=no ;;
    --solo-lighthouse) LIGHTHOUSE=solo ;;
    --) shift; ARGUMENTOS=("$@"); break ;;
    *) echo "Opcion desconocida: $1" >&2; exit 2 ;;
  esac
  shift
done

# Si se pide un subconjunto de Playwright (-- --grep ...), la auditoria de Lighthouse no corre sola: se pide con --solo-lighthouse.
if [[ ${#ARGUMENTOS[@]} -gt 0 && "$LIGHTHOUSE" == si ]]; then LIGHTHOUSE=no; fi

# docker.exe (Git Bash en Windows) no entiende /d/...: se le pasa la ruta de Windows. En Linux, pwd -W no existe y se usa la misma.
ruta_docker() { (cd "$1" && { pwd -W 2> /dev/null || pwd; }); }
aleatorio() { head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }

RUTA_BACKEND="${RUTA_BACKEND:-$AQUI/../../Backend}"
if [[ ! -f "$RUTA_BACKEND/infra/pruebas/compose.yml" ]]; then
  echo "No encuentro el Backend en $RUTA_BACKEND (hace falta infra/pruebas/compose.yml). Clonalo junto a este repositorio o define RUTA_BACKEND." >&2
  exit 2
fi
RUTA_BACKEND="$(ruta_docker "$RUTA_BACKEND")"
export RUTA_BACKEND

# Los secretos nacen aqui, en cada ejecucion, y mueren con ella: ninguno esta escrito en un archivo.
DB_PASSWORD="$(aleatorio)"
JWT_SECRETO="$(aleatorio)"
export DB_PASSWORD JWT_SECRETO
# Las pruebas de la API crean varias cuentas desde una sola IP: el limite de correos por IP sube, como en las pruebas de la API del Backend.
export LIMITE_CORREOS_POR_IP=1000
# La app se abre en http://localhost:8080 (el navegador comparte la red del contenedor del frontend; ver mas abajo): el backend solo acepta
# peticiones de ese origen (CORS), como en produccion acepta el del sitio.
export CORS_ORIGENES=http://localhost:8080

ARCHIVO="$(ruta_docker "$AQUI")/compose.yml"
compose() { docker compose -p "$PROYECTO" -f "$ARCHIVO" "$@"; }

RESULTADOS="$AQUI/resultados"
mkdir -p "$RESULTADOS"
# El usuario del contenedor de Playwright y el del runner no son el mismo: la carpeta tiene que dejarse escribir.
chmod 777 "$RESULTADOS"

# Se invoca con trap, no por su nombre: ShellCheck no lo ve.
# shellcheck disable=SC2329,SC2317
limpiar() {
  if [[ "$CONSERVAR" -eq 1 ]]; then
    echo "Stack conservado. Apagalo con: docker compose -p $PROYECTO -f e2e/compose.yml down -v"
  else
    compose down -v --remove-orphans > /dev/null 2>&1 || true
  fi
}
trap limpiar EXIT

# Docker Hub y ECR limitan las descargas anonimas en los runners compartidos ("toomanyrequests"): una imagen que no baja a la primera no
# debe contarse como un fallo de la prueba. Se reintenta con espera antes de levantar nada.
bajar() {
  for intento in 1 2 3 4; do
    if docker pull --quiet "$1" > /dev/null 2>&1; then return 0; fi
    echo "No se pudo bajar $1 (intento $intento de 4)" >&2
    sleep $((intento * 15))
  done
  echo "No se pudo bajar $1." >&2
  return 1
}
echo "==> Bajando las imagenes"
grep -hE '^\s+image:' "$RUTA_BACKEND/infra/pruebas/compose.yml" | sed -E 's/^\s*image:\s*//' | while read -r imagen; do bajar "$imagen" || exit 1; done
bajar "$IMAGEN_PLAYWRIGHT"

echo "==> Levantando el stack (la primera vez compila el backend y el frontend: unos minutos)"
# Las compilaciones bajan imagenes base de ECR publico, que a veces no responde. Se alternan los dos origenes (mismo digest en los dos) y se
# reintenta con espera.
REGISTROS=("${REGISTRO:-public.ecr.aws/docker/library}" "docker.io/library")
REGISTROS_NGINX=("${REGISTRO_NGINX:-public.ecr.aws/nginx}" "docker.io/nginxinc")
levantado=0
for intento in 1 2 3 4; do
  indice=$(((intento - 1) % 2))
  if REGISTRO="${REGISTROS[$indice]}" REGISTRO_NGINX="${REGISTROS_NGINX[$indice]}" compose up -d --build --wait --wait-timeout 420 > "$RESULTADOS/stack.log" 2>&1; then
    levantado=1
    break
  fi
  echo "El stack no levanto (intento $intento de 4); se reintenta con otro origen de imagenes." >&2
  tail -n 6 "$RESULTADOS/stack.log" >&2
  sleep $((intento * 10))
done
if [[ "$levantado" -ne 1 ]]; then
  tail -n 30 "$RESULTADOS/stack.log" >&2
  compose logs --tail 40 >&2 || true
  echo "El stack no quedo sano." >&2
  exit 1
fi

echo "==> Playwright"
estado=0
# El navegador comparte la red del contenedor del frontend: asi la app se abre en http://localhost:8080, que es un contexto seguro y deja
# registrar el service worker (con http://frontend:8080 el navegador no lo permite). El correo y el backend siguen alcanzandose por su nombre.
FRONTEND="$(compose ps -q frontend)"
docker run --rm --network "container:$FRONTEND" --ipc=host \
  -v "$(ruta_docker "$AQUI")":/e2e \
  -v "$RUTA_BACKEND/docs/postman/ejemplos":/ejemplos:ro \
  -w /e2e \
  -e CI="${CI:-}" -e LIGHTHOUSE="$LIGHTHOUSE" -e BASE_URL=http://localhost:8080 -e MAILPIT_URL=http://correo:8025 -e EJEMPLOS=/ejemplos \
  "$IMAGEN_PLAYWRIGHT" \
  sh -c 'npm ci --no-audit --no-fund --loglevel=error || exit 1; npm run typecheck --silent || exit 1; r=0; if [ "$LIGHTHOUSE" != solo ]; then npx playwright test "$@" || r=1; fi; if [ "$LIGHTHOUSE" != no ]; then node lighthouse.mjs || r=1; fi; exit $r' sh "${ARGUMENTOS[@]}" || estado=$?

echo "==> Estado del backend despues de las pruebas"
BACKEND="$(compose ps -q backend)"
oom="$(docker inspect -f '{{.State.OOMKilled}}' "$BACKEND")"
reinicios="$(docker inspect -f '{{.RestartCount}}' "$BACKEND")"
echo "    OOMKilled=$oom reinicios=$reinicios"
if [[ "$oom" != "false" || "$reinicios" != "0" ]]; then
  echo "FALLO: el backend se cayo o se reinicio durante las pruebas." >&2
  estado=1
fi
exit "$estado"

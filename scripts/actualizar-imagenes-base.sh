#!/usr/bin/env bash
# Refresca, o solo verifica, los digests de las imagenes base (12 factores, factor 2, SCRUM-214).
#
#   scripts/actualizar-imagenes-base.sh          resuelve el digest actual de cada etiqueta, comprueba que sea el MISMO
#                                                 en todos los registros que usa el proyecto y reescribe el Dockerfile
#   scripts/actualizar-imagenes-base.sh --ver    no escribe nada: dice cuales estan al dia y cuales tienen un digest nuevo
#                                                 (sale con codigo 1 si alguno cambio o si un digest escrito no existe)
#
# Por que hace falta: un digest fija la imagen y por eso el build es reproducible, pero tambien deja de recibir parches
# solo (sin Dependabot nadie abre el pull request). Refrescarlo cuando salga un aviso de seguridad de Node, nginx o
# Alpine, y de todas formas cada cierto tiempo. Despues: npm run lint && npm test && npm run build, construir la imagen y
# abrir un PR.
#
# Para cada imagen, el digest tiene que ser el mismo en ECR Publico, mirror.gcr.io y Docker Hub: el Dockerfile se
# construye contra los tres (SCRUM-202) y un digest que exista en uno y no en otro rompe el respaldo.
set -euo pipefail
cd "$(dirname "$0")/.."

MODO="${1:-actualizar}"
[[ "$MODO" == "actualizar" || "$MODO" == "--ver" ]] || { echo "Uso: $0 [--ver]" >&2; exit 2; }

# nombre:etiqueta | referencias completas (sin digest) donde debe existir el mismo digest | archivos que lo llevan
IMAGENES=(
  "node:24-alpine|public.ecr.aws/docker/library/node:24-alpine mirror.gcr.io/library/node:24-alpine docker.io/library/node:24-alpine|Dockerfile"
  "nginx-unprivileged:alpine|public.ecr.aws/nginx/nginx-unprivileged:alpine mirror.gcr.io/nginxinc/nginx-unprivileged:alpine docker.io/nginxinc/nginx-unprivileged:alpine|Dockerfile"
)

# El digest de una lista de manifiestos es el SHA-256 de sus bytes. Con --raw se baja solo esa lista (una peticion);
# "--format {{.Manifest.Digest}}" baja ademas el manifiesto de cada plataforma y ECR Publico responde "Rate exceeded".
digest_de() {
  local crudo
  crudo="$(docker buildx imagetools inspect --raw "$1" 2>/dev/null | sha256sum | cut -d' ' -f1)" || return 0
  [[ -n "$crudo" ]] && echo "sha256:$crudo"
}

# ECR Publico limita las descargas anonimas: se reintenta antes de dar la imagen por perdida.
digest_con_reintentos() {
  local referencia="$1" intento d
  for intento in 1 2 3 4 5; do
    d="$(digest_de "$referencia")"
    if [[ "$d" =~ ^sha256:[0-9a-f]{64}$ ]]; then echo "$d"; return 0; fi
    sleep $((intento * 15))
  done
  return 1
}

hay_cambios=0
for fila in "${IMAGENES[@]}"; do
  IFS='|' read -r nombre referencias archivos <<<"$fila"
  nuevo=""
  for referencia in $referencias; do
    d="$(digest_con_reintentos "$referencia")" || { echo "ERROR: no pude resolver $referencia" >&2; exit 1; }
    if [[ -z "$nuevo" ]]; then
      nuevo="$d"
    elif [[ "$d" != "$nuevo" ]]; then
      echo "ERROR: $nombre tiene digests distintos entre registros ($referencia = $d, esperado $nuevo)." >&2
      echo "       No se fija: el respaldo entre registros se romperia. Esperar a que los espejos se sincronicen." >&2
      exit 1
    fi
  done

  escrito="$(grep -rhoE "${nombre//./\\.}@sha256:[0-9a-f]{64}" $archivos | head -n1 | sed 's/.*@//' || true)"
  if [[ "$escrito" == "$nuevo" ]]; then
    echo "al dia      $nombre  $nuevo"
  else
    hay_cambios=1
    echo "CAMBIO      $nombre  ${escrito:-sin digest} -> $nuevo"
    if [[ "$MODO" == "actualizar" ]]; then
      for archivo in $archivos; do
        sed -i -E "s#(${nombre//./\\.}@)sha256:[0-9a-f]{64}#\1$nuevo#g" "$archivo"
      done
    fi
  fi

  # Un digest escrito a mano con una letra de mas o de menos no existe: se comprueba contra el registro.
  if [[ -n "$escrito" ]]; then
    for referencia in $referencias; do
      if [[ "$(digest_de "${referencia}@${escrito}")" != "$escrito" ]]; then
        echo "ERROR: ${referencia}@${escrito} (el que esta escrito en los archivos) no existe en el registro." >&2
        hay_cambios=1
      fi
    done
  fi
done

if [[ "$MODO" == "--ver" ]]; then
  exit "$hay_cambios"
fi
[[ "$hay_cambios" -eq 0 ]] && echo "Nada que cambiar." || echo "Listo. Revisa con git diff, construye la imagen y abre un PR."

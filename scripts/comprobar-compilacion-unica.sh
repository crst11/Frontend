#!/usr/bin/env bash
# Falla si alguna configuracion de angular.json compila con un archivo de entorno distinto de los demas (12 factores,
# factores 3 y 5, SCRUM-218). Una sola compilacion tiene que servir a todos los ambientes: lo que cambia entre ellos va en
# /config.json, que se lee al arrancar. Si alguien vuelve a crear environment.pre.ts o environment.prod.ts, cada
# ambiente vuelve a tener su propio bundle y no hay nada que promover.
#
# Es la comprobacion barata y sin compilar del CI. La prueba completa (compilar las tres configuraciones y comparar los
# archivos; solo ngsw.json difiere, por su marca de tiempo) se hizo a mano y esta en el CHANGELOG.
set -euo pipefail
cd "$(dirname "$0")/.."

distintos="$(grep -oE '"with": *"[^"]+"' angular.json | sort -u)"
cantidad="$(printf '%s\n' "$distintos" | grep -c . || true)"

if [ "$cantidad" -ne 1 ]; then
  echo "angular.json reemplaza el entorno por $cantidad archivos distintos:" >&2
  printf '%s\n' "$distintos" >&2
  echo "Todas las configuraciones deben usar el mismo (src/environments/environment.production.ts)." >&2
  exit 1
fi

if ! printf '%s\n' "$distintos" | grep -q 'environment\.production\.ts'; then
  echo "El archivo de entorno de las compilaciones debe ser src/environments/environment.production.ts:" >&2
  printf '%s\n' "$distintos" >&2
  exit 1
fi

for sobrante in src/environments/environment.pre.ts src/environments/environment.prod.ts src/environments/environment.dev.ts; do
  if [ -e "$sobrante" ]; then
    echo "Sobra $sobrante: una compilacion no necesita un archivo de entorno por ambiente." >&2
    exit 1
  fi
done

echo "Todas las configuraciones compilan con el mismo archivo de entorno."

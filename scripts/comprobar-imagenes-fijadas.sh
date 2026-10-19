#!/usr/bin/env bash
# Falla si alguna imagen base del Dockerfile no va fijada por digest (12 factores, factor 2, SCRUM-214). Es la
# comprobacion barata y sin red del CI: no dice si el digest esta al dia (eso lo hace actualizar-imagenes-base.sh --ver),
# solo que nadie vuelva a escribir "FROM algo:etiqueta" a secas.
set -euo pipefail
cd "$(dirname "$0")/.."

# Todo FROM que baja una imagen de un registro (las etapas se llaman por su nombre, sin registro).
if grep -nE '^FROM .*\$\{REGISTRO[A-Z_]*\}' Dockerfile | grep -v '@sha256:[0-9a-f]\{64\}'; then
  echo "^ Dockerfile: imagen base sin digest" >&2
  echo "Fija la imagen: scripts/actualizar-imagenes-base.sh resuelve el digest y lo escribe." >&2
  exit 1
fi
echo "Todas las imagenes base van fijadas por digest."

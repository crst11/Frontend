#
# Imagen de produccion del frontend (SCRUM-70). Dos etapas: Node compila Angular y nginx sin
# privilegios sirve solo el resultado. Node y node_modules no llegan a la imagen final.
#
#   docker build -t cundiapp-frontend --build-arg CONFIGURACION=dev .
#   docker run --rm -p 4200:8080 -e BACKEND_URL=http://host.docker.internal:8080 cundiapp-frontend
#
# CONFIGURACION es una de las de angular.json: dev (Compose y DEV en la nube), pre o production.

# Imagenes desde el espejo de AWS y no desde Docker Hub (limite de descargas anonimas en el CI).
# Para volver a Docker Hub:  --build-arg REGISTRO=docker.io/library  y  --build-arg REGISTRO_NGINX=docker.io/nginxinc
ARG REGISTRO=public.ecr.aws/docker/library
ARG REGISTRO_NGINX=public.ecr.aws/nginx

# ---- Etapa 1: compilar ----------------------------------------------------------------------------
FROM ${REGISTRO}/node:24-alpine AS compilar
WORKDIR /src

# Primero solo lo que define las dependencias: mientras no cambien, esta capa (la lenta) se reusa.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
ARG CONFIGURACION=dev
RUN npx ng build --configuration "${CONFIGURACION}"

# ---- Etapa 2: servir ------------------------------------------------------------------------------
FROM ${REGISTRO_NGINX}/nginx-unprivileged:alpine

# Solo el resultado de la compilacion: index.html, los chunks con hash y el service worker.
COPY --from=compilar /src/dist/cundiapp/browser /usr/share/nginx/html
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# A donde reenvia nginx las llamadas a /api. En Compose es el servicio "backend".
ENV BACKEND_URL=http://backend:8080

# nginx-unprivileged ya corre como el usuario 101 y escucha en el 8080.
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/salud || exit 1

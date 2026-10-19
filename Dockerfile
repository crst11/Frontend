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

# Las imagenes base van fijadas por digest (12 factores, factor 2, SCRUM-214): el mismo commit construye siempre lo
# mismo. El digest es el de la lista multiplataforma y es identico en los tres registros del encadenamiento (ECR
# Publico, mirror.gcr.io y Docker Hub); scripts/actualizar-imagenes-base.sh lo comprueba al refrescarlo. Sin
# Dependabot el digest NO se actualiza solo: refrescarlo cuando salga un parche de seguridad de Node o de nginx.

# ---- Etapa 1: compilar ----------------------------------------------------------------------------
FROM ${REGISTRO}/node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS compilar
WORKDIR /src

# Primero solo lo que define las dependencias: mientras no cambien, esta capa (la lenta) se reusa.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
ARG CONFIGURACION=dev
RUN npx ng build --configuration "${CONFIGURACION}"

# ---- Etapa 2: servir ------------------------------------------------------------------------------
FROM ${REGISTRO_NGINX}/nginx-unprivileged:alpine@sha256:378d0c32f6562f7fd9629170797f57d2b953aa09be983b3daaf4809bb039ca00

# Solo el resultado de la compilacion: index.html, los chunks con hash y el service worker.
COPY --from=compilar /src/dist/cundiapp/browser /usr/share/nginx/html
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# A donde reenvia nginx las llamadas a /api. En Compose es el servicio "backend".
ENV BACKEND_URL=http://backend:8080

# nginx-unprivileged ya corre como el usuario 101 y escucha en el 8080.
EXPOSE 8080
# --start-interval: durante el arranque pregunta cada 1 s y no cada 15, asi que el contenedor se
# declara sano apenas nginx escucha. Pasado el --start-period vuelve a preguntar cada 15 s.
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --start-interval=1s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/salud || exit 1

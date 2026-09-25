# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado semántico. Cada versión corresponde a lo que se promueve a la rama `produccion`.

## [0.1.0] - 2026-09-25 · Sprint 1 (Review 1)

### Agregado
- Proyecto Angular 22 como PWA, con ESLint, pruebas y ambientes DEV, PRE y PROD.
- Guía institucional pública: lista de categorías.
- Registro con correo institucional y aceptación del tratamiento de datos.
- Verificación del correo con código, con opción de pedir uno nuevo.
- Inicio de sesión, pantalla *Mi cuenta* protegida y cierre de sesión.
- Sesión en memoria (nada en localStorage), interceptor que agrega el token y lo renueva ante un 401, y guardia de rutas.
- Integración continua: lint, pruebas y build en cada pull request.

### Cambiado
- Carpetas, archivos y componentes en inglés (`core/session`, `features/guide`, `features/account`); las URLs y textos de la interfaz siguen en español.
- La configuración del editor ya no se versiona.

# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado semántico. Cada versión corresponde a lo que se promueve a la rama `produccion`.

## [Sin publicar]

### Agregado
- Ojo para mostrar u ocultar la contraseña en el registro (las dos contraseñas) y en el inicio de sesión, con el componente reutilizable `app-password-input`.
- Avisos emergentes con SweetAlert2 detrás de `NotifierService`, con los colores y tipografías de la app: aviso al crear la cuenta, ventana al verificar el correo, confirmación antes de cerrar sesión y ventana cuando el servidor no responde.

### Cambiado
- Si no hay conexión con el servidor (o responde con un error interno), el registro, el inicio de sesión y la verificación lo dicen con una ventana clara en vez del mensaje genérico dentro del formulario. Los datos que la persona puede corregir siguen mostrándose junto al campo.
- SweetAlert2 se descarga solo al mostrar el primer aviso (18,75 kB), no en la carga inicial.

## [0.1.0] - 2026-09-25 · Sprint 1 (Review 1)

### Agregado
- Proyecto Angular 22 como PWA, con ESLint, pruebas y ambientes DEV, PRE y PROD.
- Guía institucional pública: lista de categorías.
- Registro con correo institucional y aceptación del tratamiento de datos.
- Verificación del correo con código, con opción de pedir uno nuevo.
- Inicio de sesión, pantalla *Mi cuenta* protegida y cierre de sesión.
- Sesión en memoria (nada en localStorage), interceptor que agrega el token y lo renueva ante un 401, y guardia de rutas.
- Integración continua: lint, pruebas y build en cada pull request.

- Diseño visual del equipo: pantalla de entrada, registro con confirmación de contraseña y errores por campo, verificación con seis casillas para el código, "Bienvenido de nuevo" y "Mi cuenta" con saludo; sistema de estilos compartido en `src/styles.css`.

### Corregido
- Una sesión guardada que ya no existe en el servidor se reintentaba en cada carga de la app; ahora se descarta al primer rechazo.

### Cambiado
- Carpetas, archivos y componentes en inglés (`core/session`, `features/guide`, `features/account`); las URLs y textos de la interfaz siguen en español.
- La configuración del editor ya no se versiona.

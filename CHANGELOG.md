# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado semántico. Cada versión corresponde a lo que se promueve a la rama `produccion`.

## [Sin publicar]

### Agregado
- Pantalla *Mi plan de estudios* (SCRUM-21), enlazada desde Mi cuenta. Si todavía no hay programa elegido, lo primero es elegirlo; después la pantalla muestra la ruta de aprendizaje semestre por semestre, con los créditos de cada uno y, en cada asignatura, lo que hay que ver antes. Los prerrequisitos se muestran por su nombre y no por su código: `CAD612021102` no le dice nada a nadie. Las de diagnóstico y nivelatorio se marcan como *No pondera*, que es lo que significan sus 0 créditos. Los semestres se abren de a uno, con el primero abierto, porque en un teléfono nueve listas desplegadas no se leen. La agrupación por período y los créditos llegan hechos del backend: el frontend no calcula nada.

## [0.3.0] - 2026-10-01 · Sprint 1 (cierre)

### Agregado
- Pantallas para recuperar la contraseña olvidada (SCRUM-68): *¿Olvidaste tu contraseña?* pide el código al correo institucional y *Crea tu contraseña nueva* lo recibe junto con la contraseña. El enlace está en el inicio de sesión. El aviso nunca confirma si ese correo tiene cuenta, igual que el backend. La contraseña nueva usa la misma lista de requisitos del registro (`shared/password-policy`), que para esto se escribió aparte.
- El registro y el restablecimiento muestran bajo el campo la regla completa de la contraseña, redactada como en Google: *Usa 8 caracteres como mínimo con una combinación de mayúsculas, minúsculas, números y símbolos* (SCRUM-66). Debajo, una lista marca cada requisito mientras la persona escribe: avisar antes es más amable que rechazar el formulario al enviarlo. La política (`shared/password-policy`) es el espejo de la del backend, que es quien manda.

## [0.2.0] - 2026-09-29 · Sprint 1 (Review 1, avance)

### Agregado
- Campo de correo institucional (registro, inicio de sesión y verificación): la persona solo escribe su usuario y el dominio `@ucundinamarca.edu.co` ya está puesto, siempre a la vista. Si pega un correo completo o escribe la arroba, lo que sigue se descarta solo. Componente reutilizable `app-institutional-email-input`.
- Guía institucional con buscador (SCRUM-19): sugerencias de qué buscar (reglamento, calendario, plantillas, cancelar materias, grados...), filtro por categoría y documentos agrupados, cada uno con su enlace oficial, *Descargar PDF/Word/Excel/PowerPoint* o *Abrir página oficial*, si sigue vigente y cuándo se verificó. Si no hay resultados, propone las sugerencias. Nuevas clases del sistema visual: `.chip` y `.badge`.
- Inicio de sesión con Google (SCRUM-48), la API externa del proyecto: botón oficial "Continuar con Google" en *Iniciar sesión* y sección *Inicio con Google* en *Mi cuenta* para vincular o quitar la cuenta de Google. La librería de Google se descarga solo cuando hay que mostrar el botón, y sin `googleClientId` el botón no aparece.
- Ojo para mostrar u ocultar la contraseña en el registro (las dos contraseñas) y en el inicio de sesión, con el componente reutilizable `app-password-input`.
- Avisos emergentes con SweetAlert2 detrás de `NotifierService`, con los colores y tipografías de la app: aviso al crear la cuenta, ventana al verificar el correo, confirmación antes de cerrar sesión y ventana cuando el servidor no responde.
- Aviso "Tu sesión venció" cuando la renovación falla (antes la persona era llevada al inicio de sesión sin explicación) y avisos breves al iniciar sesión, cerrar sesión y pedir un código nuevo.
- Si la cuenta se crea pero el correo con el código no sale (503 `Correo no enviado`), el registro lleva a la verificación y explica que hay que pedir otro código; el reenvío muestra el mismo aviso si vuelve a fallar.

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

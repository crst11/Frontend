# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado semántico. Cada versión corresponde a lo que se promueve a la rama `produccion`.

## [Sin publicar]

### Agregado
- Historial de cargas y deshacer, dentro de la pantalla de importar (SCRUM-24). Debajo del área para subir el archivo aparecen las cargas anteriores con su fecha y cuántas asignaturas dejó cada una. **Deshacer no es borrar**, y el aviso lo dice: lo que la carga agregó se quita y lo que cambió vuelve a la nota que tenía. Solo la última carga confirmada trae el botón, y eso lo decide el servidor (`sePuedeDeshacer`), no la pantalla; al deshacerla, la anterior vuelve a poder deshacerse. Una carga ya deshecha se muestra tachada: sigue siendo parte de lo que el estudiante hizo. Si el historial de cargas no carga, la pantalla sigue sirviendo para importar.

### Agregado
- Pantalla *Importar mi reporte* (SCRUM-23), enlazada desde Mi cuenta. Son dos pasos en una sola pantalla: primero explica de dónde se saca el archivo y lo recibe, y después muestra lo detectado para confirmar. **Nada toca el historial hasta que el estudiante confirme.** Lo que no está en su ruta de aprendizaje se muestra apagado y marcado como "no se guarda": callarlo sería peor que decirlo. Separa la cuenta de lo nuevo y lo que se actualiza, para que sepa qué va a pasar antes de aceptar. Si el reporte es de otro programa lo avisa pero no bloquea: puede haber cambiado de programa, y quién sabe cuál es el caso es él. Si el archivo no se puede leer, muestra el motivo que da el servidor y ofrece registrar las notas a mano.
- Guía *¿Dónde consigo ese archivo?* dentro de la misma pantalla, con los seis pasos desde el portal de la universidad hasta *Imprimir → Guardar como PDF*, y las dos advertencias que más hacen falta: subirlo tal como se descargó, y que *Consultar Notas Actuales* no sirve porque no trae las notas definitivas. El texto también está en `docs/como-descargar-el-registro-extendido.md` para poder revisarlo como cualquier otro contenido.

### Agregado
- Pantalla *Mi historial* (SCRUM-22), enlazada desde Mi cuenta: el promedio acumulado, el avance en la carrera con su barra, y las asignaturas cursadas semestre por semestre con su nota, sus créditos y su estado. Los semestres van del más reciente al más antiguo y el actual se abre solo, porque es el que el estudiante viene a mirar. Una asignatura sin nota lo dice con palabras y no con un 0.0, que sería mentira. Cuando el promedio viene del reporte de la universidad se marca como *oficial*; cuando lo calculó la app, lo dice también. El frontend no calcula nada: los promedios, los créditos y el avance llegan hechos del backend. Sin programa elegido no se muestra un avance vacío sino un enlace para elegirlo, y sin asignaturas cargadas se explica que saldrán del Registro Académico Extendido.

### Agregado
- Pantalla *Mis sesiones* (SCRUM-49), enlazada desde Mi cuenta: lista los dispositivos donde la cuenta tiene una sesión abierta, con el navegador y el sistema, si entró con contraseña o con Google, cuándo empezó, cuánto le queda y desde qué IP. Cada una se cierra por separado y, cuando hay más de una, aparece *Cerrar sesión en todos los dispositivos*. Del user agent solo se interpreta el navegador y el sistema: adivinar el modelo del equipo y equivocarse sería peor que no decir nada. Cerrar todas limpia la sesión local y lleva a iniciar sesión, porque el backend revoca también la de quien lo pide; quien usa esa opción suele sospechar que alguien más entró.
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

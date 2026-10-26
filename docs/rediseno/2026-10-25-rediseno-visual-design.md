# Rediseño visual del frontend (guía de Figma)

Fuente: archivo de Figma `y1g7HYrQ1xKvxUIPFaA7Ei` (seis pantallas móviles de 402 px y una hoja «Componentes y estados»).
Tarea de la fase 1: SCRUM-259. Aprobado por Cristian el 25 de octubre de 2026.

## Entendimiento acordado

- **Objetivo:** que la aplicación tenga el aspecto del Figma, sin tocar lógica, textos, rutas ni accesibilidad.
- **Alcance elegido (opción A):** por fases, cada una con su tarea de Jira, su pull request y su promoción. Primero la base compartida, luego las pantallas con diseño y al final el resto, que no tiene diseño en Figma y se adapta con los mismos componentes, confirmado con Cristian por grupo.
- **Fuera de alcance:** la barra de estado del iPhone (9:41, señal, wifi, batería) y la píldora inferior del Figma. Son el marco del dispositivo, no de la aplicación. Tampoco se agrega ninguna función nueva.
- **Éxito:** cada pantalla se ve como el Figma a 360 px y a 402 px; `npm run lint`, `npm test`, `npm run build`, e2e de Playwright y axe AA en verde.

## Lenguaje visual

La identidad no cambia (verde, Outfit para títulos y botones, DM Sans para el texto). Cambian los valores y las formas.

| Token (`src/styles.css`) | Hoy | Figma |
|---|---|---|
| `--color-primary` | `#0a7a55` | `#047857` |
| `--color-primary-strong` | `#086447` | oscurecer en la misma proporción (hover/pulsado) |
| `--color-primary-soft` | `#e6f7ef` | `#ecfdf5` |
| `--color-background` | `#f7f8fa` | `#f9fafb` |
| `--color-border` | `#e3e6ea` | `#e5e7eb` |
| `--color-text` | `#374151` | `#4b5563` |
| `--color-ink` | `#111827` | `#111827` |
| Rojo de estado | `#c62828` | `#ef4444` (relleno) |
| Ámbar de estado | `#e08a1e` | `#f59e0b` (relleno) |

Formas: campo de 48 px con radio 12; botón de 50 px con radio 14 y sombra verde suave (`0 8px 10px rgba(4,120,87,.15)`); tarjetas y checklist con radio 12 y borde de 1 px; título de pantalla 28 px Outfit extrabold; subtítulo 15 px; etiqueta de campo 14 px semibold; píldora de dominio 13 px semibold sobre `#f3f4f6`.

### Accesibilidad (decisión aprobada)

El Figma usa colores que no llegan a 4.5:1 como texto pequeño: rojo `#ef4444` (3.8:1), ámbar `#f59e0b` (2.1:1) y gris `#9ca3af` (2.5:1). Regla: se respeta el Figma en rellenos, bordes, iconos y títulos grandes; el **texto** que no llegue a 4.5:1 sobre su fondo se oscurece dentro de la misma familia (rojo `#b91c1c`, ámbar `#92400e`, gris `#6b7280`). El Figma ya usa `#92400e` para el texto de «En 20 min». El marcador de posición (placeholder) puede mantener `#9ca3af`. Los tokens de texto oscurecido se documentan en `styles.css`.

## Fases

Cada fase: tarea en Jira (Sprint 8), rama `feature/SCRUM-XX-…` desde `desarrollo`, comparación contra el Figma en el navegador con las cuentas de prueba locales, PR, promoción y verificación en producción.

1. **Fundación (SCRUM-259).** Tokens y clases compartidas de `styles.css`: `.button` (principal, suave, contorno, Google; estados normal, pulsado al 98 %, cargando), `.field` / `.field__input` (normal, foco, error), pastilla de dominio en `institutional-email-input`, ojo en `password-input`, `.card`, `.badge`, checklist de pendiente/hecho en `pending-activities` y `.alert` / `.notice`. El progreso por pasos (`.steps`) y la insignia de estado de clase pasan a la fase 3, donde se usan por primera vez (YAGNI); el botón «Continuar con Google» sigue siendo el oficial de Google Identity Services, que no admite un botón propio. Avisos emergentes con los tokens nuevos. No cambia ninguna plantilla de pantalla salvo lo mínimo para estrenar las clases.
2. **Acceso.** `entry/welcome`, `account/login`, `account/register`, `account/verification`. Aquí entran el logo sobre fondo suave, el divisor «o» y la caja de seis celdas del código (componente nuevo en `shared`, con el mismo comportamiento: pegar el código completo, autoavance, teclado y lector de pantalla).
3. **Importar y día.** `importing` (zona de arrastre punteada con insignia «REPORTE OFICIAL RF03» y progreso por pasos), `today` (saludo y avatar con iniciales, tarjetas de clases con franja de color e insignia de estado, próximas entregas, Brújula con indicadores semicirculares y mensaje de acompañamiento) y la barra inferior de `shell/app-shell`.
4. **Resto.** `schedule`, `grading`, `tasks`, `simulator`, `compass`, `guide`, `notifications` y `account` (cuenta, plan, recuperación): sin diseño en Figma, se adaptan con los componentes de las fases 1 a 3 y Cristian confirma cada grupo antes de cerrarlo.

Nota de ajuste de la fase 1: el ojo de `password-input` ya cumple el diseño y no cambia, y el estado «hecho» del checklist llega con la pantalla que lo muestra (fase 3), porque `pending-activities` hoy solo lista pendientes y mostrarlo exige tocar su plantilla. Los tokens de ámbar (`--color-warning*`) quedan definidos y los estrenan las fases 3 y 4.

Nota de ajuste: la barra inferior y las celdas del código estaban previstas en la fase 1, pero dependen de la estructura de sus pantallas y del comportamiento de la verificación; se construyen en las fases 3 y 2 donde se usan.

Nota de ajuste de la fase 2: el Figma pone «¿Olvidaste tu contraseña?» bajo el campo de contraseña, así que en «Entrar» el orden del teclado pasa a contraseña, ojo, enlace, casilla de dispositivo personal, botón (antes el enlace iba en el pie); y las casillas del código ganan `aria-invalid` cuando el código es incorrecto o incompleto, algo que el diseño necesita para mostrar el error y que ayuda al lector de pantalla. Son las dos excepciones a «`aria-*` y orden del teclado no cambian».

Nota de ajuste de la fase 3: el Figma trae relojes y marcadores en las tarjetas de clase, y una sección de próximas entregas; no se construyen porque no hay datos ni función detrás (solo se pintan datos reales). La Brújula usa un medidor decorativo simple (el nivel sigue escrito) en lugar de los indicadores completos del Figma. La barra inferior reemplaza a la prevista en la fase 1, ya con las rutas reales: Inicio (`/inicio`), Horario (`/horario`), Notas (`/calificaciones/mis-notas`; el Figma dice «Calificaciones», pero a 360 px no cabe en su celda), Pendientes (`/pendientes`) y «Más», que abre el menú de siempre.

Nota de la fase 4 (por grupos, cada uno confirmado por Cristian en producción): el grupo A (SCRUM-264) cubre Mi horario, Mis notas y Mis pendientes, las tres pantallas de la barra inferior. Solo se aplican las piezas ya aprobadas (franjas de estado, insignias ámbar y verde); no se rehace ninguna estructura. Quedan para los siguientes grupos: Armar mi horario, Simulador y Brújula, Avisos, Guía y Cuenta.

## Reglas de implementación

- Se reutiliza lo que existe: clases globales de `styles.css` y componentes de `shared/`. No se crean componentes nuevos si una clase alcanza.
- Sin Tailwind ni dependencias nuevas. Iconos del Figma como SVG propios en `public/` (no se usan las URLs temporales de Figma).
- Las URLs, textos, `aria-*`, rutas y el orden del teclado no cambian: las pruebas e2e y axe existentes siguen siendo la red de seguridad. Toda pantalla nueva entra a la lista de `e2e/accesibilidad.e2e.ts` si aún no está.
- Móvil primero desde 360 px; la columna máxima sigue siendo 440 px.
- «Brújula Académica», nunca «semáforo».

## Verificación por fase

1. `npm run lint && npm test && npm run build` en verde, con el resultado a la vista.
2. Docker local con el frontend de la rama (`RUTA_FRONTEND`), cuentas de prueba locales y capturas a 360 px y 402 px junto al Figma.
3. E2E de Playwright y axe AA en el pull request.
4. Tras promover, revisión en producción por Cristian (yo no entro a su sesión).

## Riesgos

- El cambio de tokens de la fase 1 repinta toda la aplicación de una vez: se compensa con capturas de las pantallas existentes antes y después.
- Una pantalla sin diseño en Figma (fase 4) puede verse distinta al resto si se improvisa: por eso se adapta solo con los componentes aprobados y se confirma con Cristian.
- Contraste: cualquier color nuevo se mide con axe antes de fusionar.

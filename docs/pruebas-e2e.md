# Pruebas end to end con Playwright

Un navegador real (Chromium, emulando un Pixel 7 porque la app es móvil primero) recorre los flujos críticos contra el **Frontend de producción servido por nginx** y el **backend real** con los mismos límites que tiene en producción (448 MiB, mismos parámetros de la JVM, pool de 5 conexiones, PostgreSQL 17). Nada está simulado: si una pantalla deja de hablar bien con la API, o una validación cambia de mensaje, la prueba falla.

## Cómo correrlas

Hace falta Docker y el repositorio del Backend junto a este (`../Backend`) o en `RUTA_BACKEND`. No hay que instalar navegadores: Playwright corre dentro de su contenedor oficial, fijado por digest.

```bash
bash e2e/ejecutar.sh                         # Playwright (flujos, accesibilidad y PWA) y Lighthouse: unos 2 minutos más la primera construcción
bash e2e/ejecutar.sh -- --grep pendientes    # solo las pruebas de Playwright que coinciden (lo de después de "--" va a Playwright)
bash e2e/ejecutar.sh --sin-lighthouse        # solo Playwright
bash e2e/ejecutar.sh --solo-lighthouse       # solo la auditoría de Lighthouse
bash e2e/ejecutar.sh --conservar             # deja el stack encendido para mirarlo a mano
```

Los informes quedan en `e2e/resultados/` (que no va a git): `informe/index.html`, `junit.xml` y, de lo que falle, capturas, video y la traza de Playwright (`npx playwright show-trace e2e/resultados/artefactos/<prueba>/trace.zip`).

En GitHub corre en cada pull request (job «Pruebas end to end (Playwright)» de `ci.yml`); descarga el Backend (`desarrollo`) con `actions/checkout`, porque los dos repositorios son públicos. Los informes se guardan 14 días como artefacto.

## Qué recorren

| Archivo | Flujo |
|---|---|
| `cuenta.e2e.ts` | Registro, código de verificación leído de Mailpit, verificación e inicio de sesión. Una clave incorrecta no deja entrar y el mensaje no revela si el correo existe |
| `pendientes.e2e.ts` | Crear un pendiente, marcarlo como hecho, reabrirlo y borrarlo (con su confirmación). No deja guardar sin título ni fecha |
| `importacion.e2e.ts` | Elegir el programa, importar el Registro Académico en PDF (se muestra lo detectado y no se guarda hasta confirmar) y ver el historial con su promedio y avance. Un archivo que no es PDF se rechaza |
| `dispositivo-compartido.e2e.ts` | SCRUM-231: desmarcar «Es mi dispositivo personal» cierra la sesión tras 15 minutos sin actividad (se adelanta el reloj del navegador con `page.clock`); en uno personal no |
| `sin-conexion.e2e.ts` | RF12: con el service worker ya instalado y sin red, la app abre y muestra la copia local. En un dispositivo compartido no queda ninguna fila en IndexedDB |
| `accesibilidad.e2e.ts` | axe-core contra WCAG 2.2 AA a 360 px en 22 pantallas (públicas y con sesión, con datos importados) y en los estados con errores de validación, aviso emergente, panel del perfil y formulario abierto. Cero violaciones, sin lista de excepciones |
| `fuentes.e2e.ts` | SCRUM-237: las tipografías salen de la propia app (ninguna petición sale de su dominio) y las dos se cargan |
| `guia.e2e.ts` | SCRUM-237: la Guía no se desplaza mientras llegan sus sugerencias, categorías y documentos (se retrasan 800 ms para que el salto se vea) |
| `oferta-de-horarios.e2e.ts` | SCRUM-243: sube la oferta de la universidad (en windows-1252, como la guarda la plataforma), elige la mañana y el servidor real propone combinaciones; el archivo de «afuera» dice cuál subir; sin violaciones de accesibilidad con la oferta cargada |
| `pwa.e2e.ts` | Lo que hace instalable a la app: manifiesto completo (nombre, colores, idioma), íconos que existen y son del tamaño que dicen, service worker activo con su lista de archivos y un `robots.txt` de verdad |

El PDF de la importación es el de ejemplo del Backend (`docs/postman/ejemplos/registro_academico_extendido_de_ejemplo.pdf`), con datos ficticios: ningún reporte real entra a los repositorios (Ley 1581 de 2012).

## Accesibilidad y Lighthouse (SCRUM-237)

**axe** va dentro de Playwright: cada pantalla se abre a 360 px y se revisa con las reglas A y AA de WCAG 2.0, 2.1 y 2.2. Una violación falla la prueba y el mensaje dice la regla, su gravedad, el elemento y el enlace a su explicación. No hay lista de excepciones: si una regla falla, se corrige la pantalla; si algún día hiciera falta una excepción, va en `accesibilidad.e2e.ts` con el motivo y la fecha en que se revisa. Una pantalla nueva entra a las listas de ese archivo.

**Lighthouse** (`lighthouse.mjs`) audita en móvil (la emulación y la red lenta que trae por defecto) la entrada, la Guía y las pantallas de inicio de sesión y registro, sobre la compilación de producción. Usa el Chromium de Playwright, así que no hay otro Chrome que instalar. Falla si una categoría baja del mínimo de `lighthouse-presupuesto.json`: rendimiento 70; accesibilidad, buenas prácticas y SEO 95. El SEO solo se mide donde se quiere que los buscadores lleguen (la entrada y la Guía): `robots.txt` deja fuera `/cuenta/` a propósito y Lighthouse castiga una página que dice «no me indexes».

Desde su versión 12 Lighthouse ya no puntúa la PWA; por eso existe `pwa.e2e.ts`.

Resultados de referencia (20 de octubre de 2026, mismo equipo de las demás pruebas):

| Pantalla | Rendimiento | Accesibilidad | Buenas prácticas | SEO |
|---|---|---|---|---|
| `/` | 98 | 100 | 100 | 100 |
| `/guia` | 94 | 100 | 100 | 100 |
| `/cuenta/entrar` | 89 | 100 | 100 | no aplica |
| `/cuenta/registro` | 92 | 100 | 100 | no aplica |

### Lo que encontraron y se corrigió

- **«Etiqueta en el nombre» (WCAG 2.5.3)**, gravedad seria, en 15 pantallas: el avatar del encabezado mostraba «CM» pero su nombre accesible era «Mi perfil: …», y los días del horario mostraban «Lun» pero se llamaban «Lunes». axe pide que el texto visible sea una palabra del nombre accesible (quien maneja la pantalla por voz dice lo que ve). Ahora son «CM, mi perfil: …» y «Lun, Lunes». Cada uno tiene su prueba unitaria.
- **Manifiesto incompleto**: sin `theme_color`, `background_color`, `lang` ni descripción, y con el nombre en minúsculas («cundiapp»). La app instalada abría con la barra y el fondo por defecto del sistema.
- **Sin `robots.txt`**: nginx contestaba con el HTML de la app y Lighthouse lo marcaba como inválido. Ahora deja fuera `/api/` y `/cuenta/`.

- **`/guia` con un desplazamiento de diseño de 0,29** (lo bueno es menos de 0,1). Se creyó que era el cambio de fuente web y se autoalojaron Outfit y DM Sans (con un respaldo de medidas ajustadas; de paso ya no se le manda la IP de cada estudiante a Google), pero el CLS siguió igual: el informe de Lighthouse (`e2e/resultados/lighthouse/guia.json`, auditoría `layout-shifts`) señalaba otra causa. Las sugerencias y las categorías llegan del servidor después de pintar y empujaban los resultados. Ahora se reserva su lugar y el aviso del final espera a los documentos: el CLS pasó de 0,29 a 0 y el rendimiento de `/guia` de 78 a 94. Moraleja: mirar qué elemento se movió antes de arreglar lo que se sospecha. `guia.e2e.ts` lo vigila retrasando esas respuestas.

El presupuesto de rendimiento (70) queda por debajo de lo medido a propósito, para que lo detecte si empeora.

## Cómo está armado

- **Un solo stack.** `e2e/compose.yml` incluye el del Backend (`infra/pruebas/compose.yml`: PostgreSQL, Mailpit y el backend) y le suma el contenedor del Frontend, construido con el mismo `Dockerfile` que se despliega. nginx reenvía `/api` al backend, como CloudFront en la instancia.
- **El navegador comparte la red del contenedor del Frontend.** Así la app se abre en `http://localhost:8080`, que es un *contexto seguro*: sin eso el navegador no deja registrar el service worker y no se puede probar la consulta sin conexión. El correo y el backend se alcanzan por su nombre de servicio.
- **Cada prueba crea su propia cuenta** por la API (`ayudas.ts`: registro, código de Mailpit y verificación), así no dependen unas de otras y pueden correr en paralelo (2 trabajadores). Lo que se prueba por la pantalla es el flujo de la prueba; el resto de la preparación va por la API para no repetir el registro 10 veces.
- **Los selectores son los de una persona**: por rol, etiqueta o texto visible (`getByRole`, `getByLabel`), nunca por clases CSS. Si una pantalla deja de ser accesible, la prueba también lo nota.
- Los secretos del stack (contraseña de la base y llave del JWT) nacen en cada ejecución y mueren con ella.

## Lo que ya encontraron

- **Un defecto real del Backend (SCRUM-236).** Con dos peticiones casi simultáneas de la misma IP, el limitador de peticiones guardaba una hora anterior a la ya registrada, la restricción `ck_limite_de_uso_orden` la rechazaba y el cliente veía un **401 sin cuerpo** en el registro. Una IP compartida (un campus) lo produce. Quedó corregido en el Backend, con una prueba por limitador.
- Un origen (CORS) que el stack de pruebas del Backend no dejaba cambiar (SCRUM-235): se hizo configurable.

## Cómo agregar una prueba

1. Archivo nuevo `e2e/<flujo>.e2e.ts` (el sufijo `.e2e.ts` es lo que Playwright recoge).
2. Cuenta nueva con `crearCuenta(request)` e `iniciarSesion(page, usuario)` de `ayudas.ts`.
3. Selectores por rol o etiqueta. Si algo tapa la página (un aviso de SweetAlert), se cierra por su botón.
4. `bash e2e/ejecutar.sh -- --grep <nombre>` hasta que pase, y después la suite completa: el backend tiene 1 CPU y 448 MiB, y varias pruebas a la vez son parte de lo que se mide.

## Límites

- Solo Chromium móvil. No se prueba Safari ni Firefox.
- No hay Google (es un servicio externo) ni envío real de Web Push: el servidor del stack no tiene llaves VAPID.
- axe no sustituye una revisión con lector de pantalla (NVDA, TalkBack, VoiceOver): encuentra cerca de la mitad de los problemas. Conviene hacerla antes de una entrega grande.
- Lighthouse audita las pantallas públicas; las que piden sesión se cubren con axe.

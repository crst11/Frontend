# Pruebas end to end con Playwright

Un navegador real (Chromium, emulando un Pixel 7 porque la app es móvil primero) recorre los flujos críticos contra el **Frontend de producción servido por nginx** y el **backend real** con los mismos límites que tiene en producción (448 MiB, mismos parámetros de la JVM, pool de 5 conexiones, PostgreSQL 17). Nada está simulado: si una pantalla deja de hablar bien con la API, o una validación cambia de mensaje, la prueba falla.

## Cómo correrlas

Hace falta Docker y el repositorio del Backend junto a este (`../Backend`) o en `RUTA_BACKEND`. No hay que instalar navegadores: Playwright corre dentro de su contenedor oficial, fijado por digest.

```bash
bash e2e/ejecutar.sh                         # todas (unos 30 s, más la primera construcción de las imágenes)
bash e2e/ejecutar.sh -- --grep pendientes    # solo las que coinciden (lo de después de "--" va a Playwright)
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

El PDF de la importación es el de ejemplo del Backend (`docs/postman/ejemplos/registro_academico_extendido_de_ejemplo.pdf`), con datos ficticios: ningún reporte real entra a los repositorios (Ley 1581 de 2012).

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
- La accesibilidad automatizada (axe) y la auditoría PWA (Lighthouse) son la fase 3.

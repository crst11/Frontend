# Guía del proyecto - CundiApp Frontend

Documento de trabajo del equipo. Resume el contexto del producto, las reglas del proyecto y la forma de trabajar en este repositorio. Cuando esta guía y un documento más reciente del proyecto no coincidan, manda el más reciente.

## 1. Contexto del producto

CundiApp es una PWA para estudiantes de la Universidad de Cundinamarca (programa piloto: Ingeniería de Sistemas, sede Fusagasugá). Centraliza en un solo lugar la información académica que hoy está dispersa entre la plataforma institucional (Academusoft/Hermesoft) y Moodle, y además la interpreta: el problema no es que falten datos, es que nadie los interpreta a tiempo.

Prioridad del producto, en este orden:

1. **Unificación:** horario, notas, salones y fechas en un solo lugar.
2. **El plus, no el eje:** la Brújula Académica (simulador de calificaciones e indicador de riesgo). Nunca se llama "semáforo" en pantallas; la universidad ya usa esa palabra para otro reporte.
3. **Funciones activas:** Mis Pendientes con notificaciones, horario organizado por parámetros propios, importación de reportes en PDF.
4. **Guía institucional:** consulta pública de documentos oficiales sin cuenta.

### Restricción técnica fundamental

CundiApp no se conecta a ninguna plataforma institucional sin autorización. Nada de scraping, nada de pedir credenciales institucionales, nada de leer Moodle en vivo. Los datos llegan por tres fuentes intercambiables:

- **Importación de PDF** que la universidad le entrega al propio estudiante (Registro Académico Extendido, Semáforo del Creador de Oportunidades, Reporte de Horario, Consultar Notas Actuales), con confirmación antes de guardar y actualización incremental sin duplicados.
- **Registro manual** del estudiante (estructura de evaluación, notas parciales, pendientes).
- **Integración autorizada futura** (Web Services de Moodle): se prevé como un adaptador más y no se construye ahora.

La Guía institucional solo lee documentos que la universidad ya publica sin sesión en su portal.

## 2. Alcance vigente

Son doce requerimientos funcionales. No se agregan más sin acuerdo del equipo.

| Código | Nombre |
|---|---|
| RF01 | Gestión de cuenta y sesión |
| RF02 | Perfil, plan de estudios e historial |
| RF03 | Importación y actualización de reportes institucionales (PDF) |
| RF04 | Horario con ubicación y organización por parámetros |
| RF05 | Estructura de evaluación y calificaciones |
| RF06 | Mis Pendientes |
| RF07 | Pantalla del día |
| RF08 | Simulador de calificaciones |
| RF09 | Brújula Académica |
| RF10 | Motor de notificaciones |
| RF11 | Guía institucional y acceso a plataformas oficiales |
| RF12 | Consulta sin conexión |

Actores: el **estudiante** (RF01 a RF12, autenticado) y el **visitante sin cuenta** (solo RF11). No existe rol administrativo. Los parámetros los ajusta el propio estudiante.

### Reglas de negocio con valores por defecto

| Parámetro | Valor por defecto | Quién lo cambia |
|---|---|---|
| Estructura de evaluación | Árbol ponderado de dos niveles: categorías que suman 100 % y, dentro de cada una, actividades que suman 100 %. Escala 0.0 a 5.0. Plantilla inicial 30 % / 30 % / 40 % | El estudiante (RF05) |
| Meta de calificación | 3.0 | El estudiante (RF08) |
| Umbral de riesgo medio | Nota requerida mayor a 3.5 | El estudiante (RF09) |
| Umbral de riesgo alto | Nota requerida mayor a 4.5 o inalcanzable | El estudiante (RF09) |

La evaluación nunca se modela como "tres cortes fijos" ni como tres columnas.

### Requerimientos no funcionales que afectan el código

| Requerimiento | Criterio verificable |
|---|---|
| Seguridad | JWT de acceso corto (15 a 30 min) más refresco (7 días) del que solo se guarda la huella SHA-256; contraseñas con bcrypt; ningún estudiante ve datos de otro (403) |
| Rendimiento | Respuesta menor a 3 s con 40 a 80 usuarios concurrentes |
| Disponibilidad | 99 % durante el período académico |
| Usabilidad | Diseño móvil primero; registrar una nota en máximo tres interacciones |
| Portabilidad | PWA instalable, funcional desde 360 px de ancho |
| Escalabilidad | Hasta 10 000 estudiantes con respuesta menor a 3 s en prueba de carga |
| Mantenibilidad | Motor académico probado sin base de datos ni interfaz; cobertura mayor o igual a 80 % en dominio |
| Ley 1581 de 2012 | Consentimiento explícito con fecha; no se almacena documento de identidad del estudiante ni de docentes |

## 3. Reglas innegociables

1. **Arquitectura hexagonal en el backend.** El dominio es Java puro, las dependencias apuntan hacia adentro y ArchUnit lo verifica en cada compilación.
2. **Nada de lógica de negocio en controladores ni en Angular.** El frontend muestra y captura; los cálculos (nota requerida, riesgo, semana cargada) viven en el dominio.
3. **Angular nunca habla con la base de datos.** Siempre Angular, API REST de Spring Boot y PostgreSQL.
4. **Configuración fuera del código.** Ninguna URL, puerto, credencial ni secreto escrito a mano. Todo lo que va a Angular es público.
5. **Ningún secreto en Git.** `.env` y `application-local.properties` con contraseñas van en `.gitignore` desde el primer commit. Se versiona `.env.example` con las llaves vacías.
6. **Dos repositorios, tres ramas de ambiente,** código en una sola dirección (sección 5).
7. **Ningún cambio entra a `desarrollo` sin pull request** revisado por el otro integrante y con CI en verde.
8. **Una tarea está terminada** solo cuando cumple la Definición de Terminado (sección 6).
9. **Las entidades JPA no son entidades de dominio.** Viven en infraestructura y se mapean.
10. **Lo calculado no se guarda.** Promedios, nota requerida y nivel de riesgo se calculan en el dominio o salen de vistas SQL; no son columnas.
11. **Hibernate nunca crea ni altera tablas** (`spring.jpa.hibernate.ddl-auto=validate`). El esquema lo gobiernan las migraciones.
12. **Monolito modular, no microservicios.** Un solo backend desplegable, bien delimitado por dentro.
13. **Menos carpetas y más claridad.** No se crean paquetes vacíos "por si acaso" ni abstracciones sin un motivo concreto. Pregunta de control: "¿el equipo sabría en 5 segundos dónde va el próximo archivo?".

Idioma: carpetas, archivos y nombres técnicos en inglés. Vocabulario del negocio, textos de la interfaz, mensajes de commit y documentación en español (sección 8).

## 4. Stack y versiones

| Capa | Tecnología | Nota |
|---|---|---|
| Backend | Java 21 LTS, Spring Boot (línea 4.x estable) y Maven Wrapper | Se genera desde start.spring.io. Si alguna dependencia aún no soporta 4.x, se usa la última 3.5.x y se deja escrito en un ADR |
| Dependencias | Web, Validation, Data JPA, Security, OAuth2 Resource Server (JWT), PostgreSQL Driver, Flyway (`spring-boot-starter-flyway` y `flyway-database-postgresql`), Actuator, springdoc-openapi, Apache PDFBox (sprint 2), ArchUnit, Testcontainers | No usar iText (licencia AGPL) |
| Base de datos | PostgreSQL 16, esquema `cundiapp` | Docker en local, Supabase en el ambiente compartido |
| Frontend | Angular con componentes standalone, señales y `@angular/pwa` | Repositorio Frontend |
| Notificaciones | Web Push API (service worker) más aviso dentro de la app | Sprint 6 |
| Identidad | JWT propio, "Iniciar con Google" (OpenID Connect) y verificación del correo institucional por código | Modelado como puerto para migrar a Microsoft Entra ID en la v2.0 |
| Gestión | Jira (proyecto SCRUM), GitHub y GitHub Actions | |

## 5. Ramas, commits y pull requests

Hay dos repositorios, `Backend` y `Frontend`, porque se despliegan por separado.

| Rama | Contenido | Cómo entra el código | Ambiente |
|---|---|---|---|
| `feature/SCRUM-XX-descripcion` | Trabajo de una historia o tarea | Se crea desde `desarrollo` | Local (DEV) |
| `fix/SCRUM-XX-descripcion` | Corrección de un error | Se crea desde `desarrollo` | Local (DEV) |
| `desarrollo` | Integración del sprint en curso | Pull request revisado y CI en verde | Desarrollo |
| `preproduccion` | Lo que se demuestra ante el Comité de Arquitectura | Merge desde `desarrollo` al cerrar el sprint | Preproducción (PRE) |
| `produccion` | Producción: lo que el Comité aceptó | Merge desde `preproduccion` después del comité | Producción (PROD) |

`desarrollo` es la rama por defecto. El código fluye siempre `feature` → `desarrollo` → `preproduccion` → `produccion`, siempre por merge. Ninguna rama de historia salta a `preproduccion` ni a `produccion`. Los ajustes que salgan de la demostración en `preproduccion` se hacen como pull requests pequeños hacia `desarrollo` y se vuelven a promover. Una corrección urgente en producción sale de `produccion`, se fusiona a `produccion` y se devuelve a `desarrollo`.

### Protección de ramas

`desarrollo`, `preproduccion` y `produccion` requieren pull request con 1 aprobación, checks de CI en verde, y bloquean push directo, force push y borrado.

### Commits

Se usa Conventional Commits con la llave de Jira para que quede enlazado:

```
feat(cuenta): registrar estudiante con correo institucional SCRUM-17
fix(horario): corregir choque de bloques que terminan a la misma hora SCRUM-25
test(evaluacion): cubrir suma de pesos distinta de 100 % SCRUM-27
refactor(persistencia): extraer mapeador de matrícula SCRUM-21
docs(adr): registrar decisión de Flyway SCRUM-41
chore(ci): agregar verificación de arquitectura SCRUM-43
```

Tipos: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `perf`. Commits pequeños, un propósito por commit. Están prohibidos mensajes como "cambios", "arreglos" o "final".

### Pull requests

- Título: `SCRUM-XX tipo: descripción`.
- Cuerpo según la plantilla del repositorio.
- Pequeños: idealmente menos de 400 líneas cambiadas. Si una historia crece, se parte.
- El autor no aprueba su propio pull request. El otro integrante revisa con criterio constructivo.

### Versiones

Etiquetas de versionado semántico al promover a `produccion`: `v0.1.0` (sprint 1), `v0.2.0`, y así hasta `v1.0.0` (cierre del semestre). Los cambios se registran en `CHANGELOG.md`.

## 6. Jira y ciclo de trabajo

El trabajo se lleva en el proyecto SCRUM de Jira: una **épica** por requerimiento funcional, **historias** con criterios de aceptación y **tareas** técnicas. Las subtareas técnicas se crean cuando la incidencia arranca, no antes.

### Los seis pasos de cada funcionalidad

Se construye en este orden: primero base de datos, luego backend y luego frontend.

1. **Migración de base de datos** (si la historia la necesita).
2. **Dominio y puerto:** modelo, reglas y pruebas unitarias; interfaces de puertos.
3. **Adaptador de persistencia:** entidad JPA, repositorio Spring Data, mapeador y prueba de integración.
4. **Caso de uso y API:** implementación del caso de uso, controlador REST, DTOs y documentación OpenAPI.
5. **Pantalla en Angular:** repositorio de datos, componente, ruta y pruebas.
6. **Despliegue en preproducción** y demostración.

Una funcionalidad no cuenta como avance hasta recorrer los seis. Las capas sueltas nunca son historias propias: siempre son subtareas. Además de los seis pasos, cada historia lleva su historia de usuario (HU) y su caso de uso (CU) documentados.

### Tablero

Cinco columnas: Pendiente, Listo para desarrollar, En desarrollo, En revisión y Hecho, con un máximo de dos tarjetas en curso. Al crear la rama la tarjeta pasa a En desarrollo; al abrir el pull request, a En revisión; al fusionar y desplegar en preproducción, a Hecho.

### Plan de sprints

Sprints de dos semanas, dos funcionalidades por sprint, cada uno cierra con un Comité de Arquitectura.

| Sprint | Funcionalidades |
|---|---|
| 1 | Esquema de base de datos, RF01 y RF11, primer despliegue |
| 2 | RF02 y RF03 |
| 3 | RF04 y RF05 |
| 4 | RF06 y RF07 |
| 5 | RF08 y RF09 |
| 6 | RF10 y RF12 |
| 7 | Estabilización, pruebas de carga, documentación y paso a producción |

### Definición de Listo

Una historia entra al sprint solo si tiene criterios de aceptación claros, estimación y no depende de algo sin resolver.

### Definición de Terminado

- Código en la rama de la historia, siguiendo esta guía.
- Pruebas escritas y en verde (unitarias de dominio; de integración si toca persistencia).
- ArchUnit en verde.
- Pull request revisado y aprobado por el compañero, y fusionado a `desarrollo`.
- Funcionalidad desplegada en preproducción y verificable por un tercero.
- Documentación actualizada (README, OpenAPI y ADR si hubo decisión).
- Incidencia cerrada en Jira.

## 7. Ambientes y configuración

| Ambiente | Rama | Frontend | API |
|---|---|---|---|
| DEV | `feature/*` y `desarrollo` | `http://localhost:4200` | `http://localhost:8080/api` |
| PRE | `preproduccion` | URL de hosting PRE | URL de API PRE |
| PROD | `produccion` | URL de hosting PROD | URL de API PROD |

Las URLs de PRE y PROD se definen cuando se decida el hosting.

Archivos de `src/environments/`:

```
environment.ts        (DEV)
environment.pre.ts    (PRE)
environment.prod.ts   (PROD)
```

```ts
export const environment = {
  production: false,
  nombreAmbiente: 'DEV',
  apiUrl: 'http://localhost:8080/api',
  googleClientId: '', // es público: el client ID de Google no es un secreto
  vapidPublica: ''    // la llave VAPID pública también es pública
};
```

Se configuran `fileReplacements` en `angular.json` para las configuraciones `pre` y `production`, y los scripts `npm run build:pre` y `npm run build:prod`. Nada secreto va aquí: todo lo que llega al navegador se puede inspeccionar.

## 8. Estructura y reglas de Angular

La estructura "clásica" de Angular (`app.module.ts`, `app-routing.module.ts`, carpeta `assets/`) corresponde a versiones anteriores. En la versión vigente el CLI genera componentes standalone sin `NgModule`: `app.config.ts` (proveedores), `app.routes.ts` (rutas), el componente raíz, `public/` en lugar de `assets/` y la carpeta `environments/` con `ng generate environments`. Se usa lo que genere el CLI instalado.

Creación del proyecto (solo si el repositorio aún no lo tiene, dentro de la carpeta clonada y sin reiniciar git):

```bash
npx @angular/cli@latest new cundiapp --directory . --skip-git --routing --style=css --ssr=false --strict
ng add @angular/pwa
ng add angular-eslint
ng generate environments
```

### Carpetas

```
src/app/
  core/          transversal a toda la app
    session/       session.service (sesión en memoria), session.interceptor (Bearer y refresco),
                   session.guard (rutas protegidas)
    feedback/      notifier.service (avisos emergentes con SweetAlert2), server-failure (distingue
                   una falla del sistema de un dato que la persona puede corregir)
  data-access/   "puertos" del frontend: clases abstractas (EstudianteRepository, CategoriaDeRecursoRepository...)
    http/          sus implementaciones con HttpClient; indexeddb/ llega con RF12 (sprint 6)
  features/      una carpeta por área funcional, cada pantalla cargada de forma diferida:
    guide/         RF11 (categories)
    account/       RF01, RF02 (register, verification, login, my-account)
    entry/         pantalla con los dos caminos (consulta pública o iniciar sesión)
    importing/     RF03
    schedule/      RF04
    today/         RF07 Pantalla del día
    grading/       RF05
    tasks/         RF06 Mis Pendientes
    simulator/     RF08
    compass/       RF09 Brújula Académica
  shared/        componentes de interfaz reutilizables, pipes, utilidades
    password-input/  campo de contraseña con el ojo para mostrarla u ocultarla
  app.config.ts
  app.routes.ts
```

Cada carpeta de `features/` se crea cuando llega su sprint, no antes. Dentro de una carpeta, el archivo, la clase y el selector del componente llevan el mismo nombre (`account/login/login.ts` → clase `Login`, selector `app-login`), como indica la convención de Angular.

**Convención de nombres.** Carpetas, archivos y nombres técnicos en inglés, como en un equipo de desarrollo real. El vocabulario del negocio que viene del backend (Estudiante, CategoriaDeRecurso, correo...) se mantiene en español para que ambos lados hablen el mismo idioma. Las URLs y los textos que ve el estudiante siguen en español (`/cuenta/entrar`, "Iniciar sesión").

### Diseño visual

Las pantallas siguen el diseño móvil acordado por el equipo (entrada, registro, verificación, inicio de sesión, inicio del día con la Brújula y carga del reporte PDF). Todo lo compartido vive en `src/styles.css`, así que una pantalla nueva no inventa colores ni botones: los reutiliza.

| Pieza | Clase o token |
|---|---|
| Colores | `--color-primary` (#0a7a55), `--color-primary-soft`, `--color-ink`, `--color-text`, `--color-muted`, `--color-border`, `--color-background`, `--color-danger` |
| Tipografías | `Outfit` para títulos y botones, `DM Sans` para el texto (Google Fonts, en `index.html`) |
| Pantalla | `.screen` (columna de 440 px máximo, alto completo), `.screen__body`, `.screen__footer` (acciones abajo, como en el diseño) |
| Cabecera | `.top-bar` con `.icon-button` (flecha de volver) y `.top-bar__title` |
| Textos | `.title`, `.subtitle` |
| Formularios | `.field`, `.field-row` (dos campos lado a lado), `.field__label`, `.field__input`, `.field__hint`, `.field__error`, `.checkbox` |
| Botones | `.button` con `--primary` (acción principal), `--soft` (secundaria verde) o `--outline` |
| Mensajes y bloques | `.alert` (error), `.notice` (aviso), `.card` |
| Contraseñas | `<app-password-input inputId="..." formControlName="...">` de `shared/`: todo campo de contraseña lo usa para traer el ojo; no se escribe un `<input type="password">` suelto |
| Avisos emergentes | `NotifierService` (`core/feedback`): `exito`, `problema`, `confirmar` y `aviso` (mensaje breve que se cierra solo). Están tematizados con los mismos tokens (clase `app-popup` en `styles.css`) |

**Cuándo usar cada aviso.** Lo que la persona puede corregir (un dato mal escrito, un correo ya registrado, un código incorrecto) va junto al formulario, en el campo o en `.alert`. La ventana emergente es para tres cosas: confirmar una acción que no se puede deshacer (`confirmar`, p. ej. cerrar sesión), celebrar un paso que abre el siguiente (`exito`, `aviso`) y avisar de una falla del sistema (`problema`, cuando `esFalloDelServidor(err)`: sin conexión o error 5xx). Las pantallas no importan SweetAlert2 directamente: piden el aviso al servicio, que descarga la librería solo la primera vez que se usa.

Reglas: errores junto al campo que los causa, además del mensaje del backend en `.alert`; nada de botones de funciones que aún no existen (Google llega con SCRUM-48 y "¿Olvidaste tu contraseña?" cuando exista su historia); la barra de navegación inferior del diseño (Inicio, Horario, Calificaciones, Pendientes, Más) llega con la pantalla del día (RF07), cuando haya secciones a las que ir.

### Reglas del frontend

- Los componentes nunca llaman a `HttpClient` directamente: usan un repositorio de `data-access` inyectado por su clase abstracta. Es la misma idea de puertos del backend y permite cambiar HTTP por IndexedDB sin tocar la pantalla (RF12).
- Las URLs salen siempre de `environment.apiUrl`. Nunca `http://localhost:8080` escrito en un componente.
- El estado se maneja con señales (`signal`, `computed`); RxJS queda para los flujos HTTP.
- Interceptor funcional que agrega `Authorization: Bearer` y, ante un 401, intenta un refresco una sola vez.
- Sin lógica de negocio: el frontend no calcula notas requeridas ni niveles de riesgo; los pide al backend.
- Móvil primero, usable desde 360 px, accesible (etiquetas, contraste y navegación con teclado).
- Textos de interfaz: "Brújula Académica", nunca "semáforo". Cada recurso de la Guía enlaza a la fuente oficial y aclara que es contenido de apoyo.
- TypeScript estricto.

## 9. PWA y consulta sin conexión

- `ngsw-config.json`: `assetGroups` para el cascarón de la app (instalable y que abre sin red) y `dataGroups` con estrategia `freshness` para las consultas de solo lectura (horario, notas y fechas).
- **RF12 (sprint 6):** el horario, las calificaciones registradas y las fechas previamente descargadas se consultan sin internet en solo lectura, desde IndexedDB; al volver la conexión se sincroniza.
- **RF10 (sprint 6):** suscripción Web Push con la llave VAPID pública; el backend envía con la privada.
- El service worker solo funciona en HTTPS o en `localhost`: se prueba con `ng build` y un servidor estático, no con `ng serve`.

## 10. Pruebas

- Pruebas de componentes y servicios con el runner que traiga el CLI.
- De 3 a 5 pruebas de extremo a extremo con Playwright para los flujos clave: entrada pública, inicio de sesión, registrar una nota y ver la Brújula.
- Antes de dar algo por terminado: `npm run lint`, `npm test` y `npm run build` en verde.

## 11. Integración continua y despliegue

Flujos en `.github/workflows/`:

- `ci.yml`: en cada pull request, con Node LTS y caché de npm, ejecuta `npm ci`, `npm run lint`, `npm test` (sin interfaz) y `npm run build`. Es check obligatorio para fusionar.
- `desplegar-pre.yml` y `desplegar-prod.yml`: ejecutan `npm run build:pre` o `npm run build:prod` y publican en el hosting.

Los secretos del hosting se guardan en Settings → Secrets and variables → Actions, por Environment (`pre` y `prod`).

## 12. Decisiones abiertas

Se resuelven con el equipo y se registran como ADR en el repositorio Backend (`docs/adr/`).

| Decisión | Recomendación |
|---|---|
| Hosting del frontend | Hosting estático con HTTPS (Firebase Hosting, Netlify, Vercel o GitHub Pages) |
| Dominios y cookie de refresco | Mismo sitio si el hosting lo permite; si no, ajustar SameSite y CORS con el backend |
| Versión exacta de Angular | La estable vigente al generar el proyecto |

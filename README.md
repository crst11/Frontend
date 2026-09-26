# CundiApp - Frontend

Aplicación web progresiva (PWA) de CundiApp, la plataforma centralizada de información académica para los estudiantes de la Universidad de Cundinamarca (programa piloto: Ingeniería de Sistemas, sede Fusagasugá).

Proyecto integrador de Ingeniería de Software I (2026-2).

## Objetivo

Ofrecer al estudiante, desde el celular o el computador, su horario, sus notas, sus pendientes y la interpretación de su situación académica en un solo lugar: qué tiene hoy, qué nota necesita, en qué asignatura está en riesgo y qué se le vence. La aplicación consume la API REST del repositorio Backend y nunca habla con la base de datos.

## Estado del proyecto (Review 1)

| Pantalla | Ruta | Estado |
|---|---|---|
| Entrada (iniciar sesión, crear cuenta o consultar la guía) | `/` | Hecho |
| Guía institucional (categorías) | `/guia` | Hecho, pública |
| Crear cuenta | `/cuenta/registro` | Hecho |
| Verificar el correo | `/cuenta/verificacion` | Hecho |
| Iniciar sesión | `/cuenta/entrar` | Hecho, con contraseña o con el botón de Google |
| Mi cuenta (protegida) | `/cuenta/mi-cuenta` | Hecho; ahí se vincula o se quita Google |

La sesión se mantiene sola: el token de acceso vive en memoria y, cuando vence, se renueva con la cookie de refresco que maneja el navegador.

## Tecnologías

- Angular 22 con componentes standalone y señales, en TypeScript estricto
- PWA con service worker
- SweetAlert2 para los avisos emergentes (detrás de `NotifierService`, se carga solo cuando hace falta)
- API externa: Google Identity Services, el botón oficial "Continuar con Google" (detrás de `GoogleIdentityService`; sin `googleClientId` el botón no aparece)
- Pruebas con Vitest (runner del CLI de Angular) y ESLint

## Estructura

```
src/app/
  core/session/     sesión en memoria, interceptor (Bearer y renovación) y guardia de rutas
  core/feedback/    avisos emergentes (NotifierService) y detección de fallas del servidor
  core/google/      botón de Google Identity Services (GoogleIdentityService)
  shared/           componentes reutilizables (password-input: contraseña con ojo)
  data-access/      servicios de consumo de la API detrás de clases abstractas (http/ los implementa)
  features/
    entry/          welcome
    guide/          categories
    account/        register, verification, login, my-account
src/styles.css      sistema visual compartido (colores, tipografías, campos, botones)
```

Las pantallas siguen el diseño móvil del equipo; las piezas visuales y sus reglas están en la sección "Diseño visual" de la [guía del proyecto](docs/guia-proyecto.md).

Los componentes nunca usan `HttpClient` directamente: piden los datos a un servicio de `data-access`, que es el único que conoce las URLs (salen de `src/environments/`).

## Requisitos previos

- Node.js (versión LTS) y npm
- El backend corriendo en `http://localhost:8080` (repositorio Backend)

## Levantar en local

```powershell
npm install        # la primera vez
npm start          # http://localhost:4200
```

## Pruebas

```powershell
npm run lint
npm test -- --watch=false
npm run build
```

Los tres deben terminar en verde antes de abrir un pull request; la integración continua los ejecuta en cada uno.

## Ramas y flujo de trabajo

| Rama | Uso |
|---|---|
| `feature/SCRUM-XX-descripcion` | Trabajo de una incidencia de Jira |
| `desarrollo` | Integración del sprint en curso (rama por defecto) |
| `preproduccion` | Demostración ante el Comité de Arquitectura |
| `produccion` | Versión presentada y aceptada |

El código fluye de la rama de la incidencia a `desarrollo`, luego a `preproduccion` y por último a `produccion`. Los commits siguen el formato `tipo(módulo): descripción SCRUM-XX`. Los cambios de cada versión están en [CHANGELOG.md](CHANGELOG.md).

## Documentación

- [Guía del proyecto](docs/guia-proyecto.md): contexto, reglas, estructura de Angular, ambientes, pruebas y flujo de trabajo.
- La arquitectura completa, los casos de uso y el guion de la demo de la Review 1 están en el repositorio Backend (`docs/review-1/`).

## Autores

- Cristian Albeiro Morales Urrea
- Naomi Xannathl Ochoa Trejo

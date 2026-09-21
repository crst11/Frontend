# CundiApp - Frontend

Aplicación web progresiva (PWA) de CundiApp, la plataforma centralizada de información académica para los estudiantes de la Universidad de Cundinamarca (programa piloto: Ingeniería de Sistemas, sede Fusagasugá).

Proyecto integrador de Ingeniería de Software I (2026-2).

## Objetivo

Ofrecer al estudiante, desde el celular o el computador, su horario, sus notas, sus pendientes y la interpretación de su situación académica en un solo lugar: qué tiene hoy, qué nota necesita, en qué asignatura está en riesgo y qué se le vence. La aplicación consume la API REST del repositorio Backend y nunca habla con la base de datos.

## Estado del proyecto

Repositorio base. Contiene las reglas del equipo, la guía del proyecto y las plantillas de trabajo. El proyecto Angular se agrega en la tarea SCRUM-43 del tablero de Jira; este README se completa con ella.

## Tecnologías

- Angular con componentes standalone y señales, en TypeScript estricto
- PWA con service worker (instalable y con consulta sin conexión)
- Consumo de la API REST del repositorio Backend
- Pruebas con el runner del CLI de Angular y Playwright para los flujos clave

## Requisitos previos

- Node.js (versión LTS) y npm
- Git

## Instalación y ejecución

Se documenta aquí, paso a paso y para levantar el proyecto en menos de diez minutos, cuando exista el proyecto (SCRUM-43). Las URLs de la API salen siempre de los archivos de `src/environments/`; nada secreto va en ellos, porque todo lo que llega al navegador se puede inspeccionar.

## Uso

La aplicación se diseña primero para el celular y funciona desde 360 px de ancho. El visitante sin cuenta solo puede consultar la Guía institucional; el resto exige iniciar sesión.

## Pruebas

El estándar del proyecto es que `npm run lint`, `npm test` y `npm run build` terminen en verde antes de abrir un pull request.

## Ramas y flujo de trabajo

| Rama | Uso |
|---|---|
| `feature/SCRUM-XX-descripcion` | Trabajo de una incidencia de Jira |
| `desarrollo` | Integración del sprint en curso (rama por defecto) |
| `preproduccion` | Demostración ante el Comité de Arquitectura |
| `produccion` | Producción |

El código fluye siempre de la rama de la incidencia a `desarrollo`, luego a `preproduccion` y por último a `produccion`, mediante pull request o merge. Ninguna rama de ambiente admite push directo. Los commits siguen el formato `tipo(módulo): descripción SCRUM-XX`.

## Documentación

- [Guía del proyecto](docs/guia-proyecto.md): contexto, reglas, estructura de Angular, ambientes, pruebas y flujo de trabajo.

## Autores

- Cristian Albeiro Morales Urrea
- Naomi Xannathl Ochoa Trejo

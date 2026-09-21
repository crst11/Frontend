# CundiApp - Frontend (Angular PWA)

Guía completa: @docs/guia-proyecto.md (leer antes de trabajar).

- Angular con componentes standalone y señales. Carpetas: `core`, `data-access`, `features` y `shared`; cada carpeta de `features` se crea cuando llega su sprint.
- Los componentes nunca usan `HttpClient` directo: usan repositorios de `data-access` (clase abstracta más implementación).
- Las URLs salen solo de `environment.apiUrl`. Nada secreto en `environments`.
- Sin lógica de negocio: los cálculos los hace el backend. Nombre público del indicador: "Brújula Académica", nunca "semáforo".
- Móvil primero, desde 360 px, y accesible.
- Ramas y commits: igual que el backend (`feature/SCRUM-XX-descripcion` desde `desarrollo`, `tipo(módulo): descripción SCRUM-XX`, en español). Nunca push a `desarrollo`, `preproduccion` ni `main`.
- Antes de proponer código, presentar el plan de la tarea y esperar aprobación. No inventar requerimientos: el alcance es RF01 a RF12.
- Antes de dar algo por terminado: `npm run lint && npm test && npm run build` en verde y mostrar el resultado.
- Sin firmas de IA: nada de `Co-Authored-By` ni "Generated with" en commits, pull requests, código ni documentación.
- Código, nombres, commits y documentación en español, salvo palabras técnicas estándar.

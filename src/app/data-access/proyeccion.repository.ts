import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AsignaturaMatriculada } from './evaluacion.repository';

/** Si la meta ya se alcanzó, se puede alcanzar o ya no. Lo decide el servidor (SCRUM-33). */
export type SituacionDeLaMeta = 'alcanzada' | 'alcanzable' | 'inalcanzable';

/**
 * La nota que hace falta en una asignatura para llegar a la meta (RF08).
 *
 * La cuenta la hace el servidor con el peso real de cada actividad. `notaRequerida` es nula cuando la
 * meta ya no se alcanza: la pantalla lo dice con `situacion` en vez de mostrar un número que pase de 5.0.
 */
export interface ProyeccionDeNota {
  asignatura: AsignaturaMatriculada;
  meta: number;
  puntos: number;
  porcentajeEvaluado: number;
  porcentajeRestante: number;
  notaRequerida: number | null;
  maximoPosible: number;
  situacion: SituacionDeLaMeta;
}

/** Una nota que todavía no existe, para probar qué pasaría (SCRUM-34). Nunca se guarda. */
export interface NotaSimulada {
  consecCategoria: number;
  consecActividad: number;
  nota: number;
}

export interface Configuracion {
  meta: number;
}

/** Puerto del frontend hacia la nota que necesito, el simulador y la meta (RF08). */
@Injectable()
export abstract class ProyeccionRepository {
  /** Con la meta guardada, o con `meta` si viene (sin guardarla). */
  abstract proyeccion(idMatricula: number, meta?: number): Observable<ProyeccionDeNota>;
  /** Lo mismo con notas hipotéticas encima de las reales; no escribe nada. */
  abstract simular(
    idMatricula: number,
    notas: NotaSimulada[],
    meta?: number,
  ): Observable<ProyeccionDeNota>;
  abstract miConfiguracion(): Observable<Configuracion>;
  abstract cambiarMeta(meta: number): Observable<Configuracion>;
}

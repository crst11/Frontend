import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DocenteDeClase } from './horario.repository';

/** Dónde está una clase respecto de la hora de ahora. Solo cambia en hoy. */
export type EstadoDeLaClase = 'pasada' | 'en_curso' | 'proxima' | 'luego';

/** Qué clase de día es: con `lectivo` puede haber clase; `festivo` y `fuera_de_periodo` no. */
export type TipoDeDia = 'lectivo' | 'festivo' | 'fuera_de_periodo';

/**
 * Una clase del día (SCRUM-31). `actividades` es cuántas actividades de evaluación tiene la asignatura:
 * con eso la pantalla decide si abre sus actividades o ofrece subirlas. El salón, el bloque y la sede
 * vienen nulos cuando el estudiante todavía no los conoce.
 */
export interface ClaseDelDia {
  idMatricula: number | null;
  codigoAsignatura: string | null;
  asignatura: string;
  horaInicio: string;
  horaFin: string;
  salon: string | null;
  bloque: string | null;
  sede: string | null;
  docente: DocenteDeClase | null;
  estado: EstadoDeLaClase;
  actividades: number;
  /** Una actividad extra (SCRUM-266) se ve como una clase pero no tiene matrícula, ni actividades, ni notas. */
  esExtra: boolean;
  lugar: string | null;
  responsable: string | null;
}

/** El próximo día que sí tiene clases, para mostrar mañana o el lunes después de un festivo. */
export interface SiguienteDiaConClases {
  fecha: string;
  dia: string;
  clases: ClaseDelDia[];
}

/**
 * La pantalla del día como la manda el servidor. `hoy` es la fecha de Bogotá y `fecha` la que se muestra.
 * Qué día es y en qué clase va el estudiante lo decide el servidor, no el teléfono. `siguiente` no viene
 * si el estudiante todavía no tiene horario.
 */
export interface MiDia {
  hoy: string;
  fecha: string;
  dia: string;
  tipo: TipoDeDia;
  festivo: string | null;
  clases: ClaseDelDia[];
  siguiente: SiguienteDiaConClases | null;
}

/** Puerto del frontend hacia la pantalla del día (RF07). */
@Injectable()
export abstract class DiaRepository {
  /** Sin fecha es hoy en Bogotá. */
  abstract miDia(fecha?: string): Observable<MiDia>;
}

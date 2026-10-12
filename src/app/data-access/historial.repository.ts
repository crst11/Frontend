import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/** De dónde sale un promedio: del reporte de la universidad o del cálculo de la app (SCRUM-22). */
export type FuenteDelPromedio = 'oficial' | 'calculado';

export interface AsignaturaCursada {
  codigo: string;
  nombre: string;
  creditos: number;
  /** Nula mientras la asignatura esté en curso: todavía no hay nota que mostrar. */
  nota: number | null;
  estado: string;
  /** Las de 0 créditos se cursan y se califican, pero no mueven el promedio. */
  pondera: boolean;
}

export interface PeriodoCursado {
  codigo: string;
  creditosMatriculados: number;
  creditosAprobados: number;
  promedio: number | null;
  fuenteDelPromedio: FuenteDelPromedio | null;
  asignaturas: AsignaturaCursada[];
}

/** `creditosDelPrograma` y `porcentajeDeAvance` vienen nulos si no hay programa elegido. */
export interface MiHistorial {
  periodos: PeriodoCursado[];
  promedioAcumulado: number | null;
  fuenteDelAcumulado: FuenteDelPromedio | null;
  creditosAprobados: number;
  creditosDelPrograma: number | null;
  porcentajeDeAvance: number | null;
}

/** Puerto del frontend hacia el historial académico del estudiante (RF02). */
@Injectable()
export abstract class HistorialRepository {
  abstract miHistorial(): Observable<MiHistorial>;
}

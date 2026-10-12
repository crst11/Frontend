import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Una asignatura que el estudiante tiene matriculada (SCRUM-27).
 *
 * `tieneEstructura` lo decide el servidor contando las categorías guardadas: la pantalla no lo
 * deduce de si la lista llegó vacía.
 */
export interface AsignaturaMatriculada {
  idMatricula: number;
  codigoAsignatura: string;
  nombre: string;
  creditos: number;
  codigoPeriodo: string;
  estado: string;
  enCurso: boolean;
  tieneEstructura: boolean;
  categorias: number;
  actividades: number;
}

/** El peso es dentro de su categoría, no dentro de la asignatura. */
export interface ActividadDeEvaluacion {
  consecutivo: number;
  nombre: string;
  porcentaje: number;
  fechaProgramada: string | null;
  tipo: string;
  estadoEntrega: string;
}

export interface CategoriaDeEvaluacion {
  consecutivo: number;
  nombre: string;
  porcentaje: number;
  origen: string;
  actividades: ActividadDeEvaluacion[];
}

/**
 * `guardada` en falso significa que esto es la propuesta de la plantilla 30/30/40 y que todavía no
 * hay nada escrito: la pantalla lo dice en vez de hacerle creer que ya configuró la asignatura.
 */
export interface EstructuraDeEvaluacion {
  asignatura: AsignaturaMatriculada;
  guardada: boolean;
  categorias: CategoriaDeEvaluacion[];
}

/** Lo que se manda al guardar: el árbol completo, que reemplaza el anterior. */
export interface CategoriaPorGuardar {
  consecutivo: number;
  nombre: string;
  porcentaje: number;
  origen?: string;
  actividades: ActividadPorGuardar[];
}

export interface ActividadPorGuardar {
  consecutivo: number;
  nombre: string;
  porcentaje: number;
  fechaProgramada: string | null;
  tipo: string;
}

/** Puerto del frontend hacia la estructura de evaluación y las calificaciones (RF05). */
@Injectable()
export abstract class EvaluacionRepository {
  abstract misAsignaturas(): Observable<AsignaturaMatriculada[]>;
  abstract estructuraDe(idMatricula: number): Observable<EstructuraDeEvaluacion>;
  abstract guardar(
    idMatricula: number,
    categorias: CategoriaPorGuardar[],
  ): Observable<EstructuraDeEvaluacion>;
}

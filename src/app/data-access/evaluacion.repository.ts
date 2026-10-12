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
  /** La nota que el estudiante registró; nula si todavía no tiene (SCRUM-28). */
  nota: number | null;
}

export interface CategoriaDeEvaluacion {
  consecutivo: number;
  nombre: string;
  porcentaje: number;
  origen: string;
  actividades: ActividadDeEvaluacion[];
}

/**
 * Lo que el estudiante lleva en una asignatura con las notas que ya registró (SCRUM-28).
 *
 * Lo calcula el servidor: la pantalla solo lo muestra. `promedioDeLoEvaluado` es nulo mientras no
 * haya ninguna nota, porque mostrar 0.0 sería inventar una nota que nadie puso.
 */
export interface AcumuladoDeNotas {
  puntos: number;
  porcentajeEvaluado: number;
  promedioDeLoEvaluado: number | null;
  actividadesCalificadas: number;
  actividadesTotales: number;
}

/** La nota que quedó guardada y lo que el estudiante lleva ya con ella. */
export interface NotaRegistrada {
  nota: number;
  acumulado: AcumuladoDeNotas;
}

/**
 * `guardada` en falso significa que esto es la propuesta de la plantilla 30/30/40 y que todavía no
 * hay nada escrito: la pantalla lo dice en vez de hacerle creer que ya configuró la asignatura.
 */
export interface EstructuraDeEvaluacion {
  asignatura: AsignaturaMatriculada;
  guardada: boolean;
  categorias: CategoriaDeEvaluacion[];
  acumulado: AcumuladoDeNotas;
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
  /** Anota o corrige la nota de una actividad (SCRUM-28). */
  abstract registrarNota(
    idMatricula: number,
    consecCategoria: number,
    consecActividad: number,
    nota: number,
  ): Observable<NotaRegistrada>;
  /** Quita la nota de una actividad y devuelve lo que se lleva sin ella. */
  abstract quitarNota(
    idMatricula: number,
    consecCategoria: number,
    consecActividad: number,
  ): Observable<AcumuladoDeNotas>;
}

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AsignaturaMatriculada } from './evaluacion.repository';

/** Qué tan comprometida está una asignatura (RF09). Lo decide el servidor. */
export type NivelDeRiesgo = 'alto' | 'medio' | 'bajo' | 'sin_datos';

/** Desde qué nota requerida una asignatura pasa a riesgo medio y a riesgo alto. */
export interface Umbrales {
  medio: number;
  alto: number;
}

/**
 * El riesgo de una asignatura que se cursa ahora (SCRUM-35).
 *
 * `explicacion` ya viene escrita por el servidor: dice por qué está en ese nivel. `notaRequerida` es
 * nula cuando no hay datos o cuando la meta ya no se alcanza.
 */
export interface RiesgoDeAsignatura {
  asignatura: AsignaturaMatriculada;
  nivel: NivelDeRiesgo;
  motivo: string;
  explicacion: string;
  notaRequerida: number | null;
  maximoPosible: number | null;
}

/** La Brújula Académica: de lo más urgente a lo menos, con lo que no tiene datos al final. */
export interface Brujula {
  meta: number;
  umbrales: Umbrales;
  asignaturas: RiesgoDeAsignatura[];
}

export interface ConfiguracionConUmbrales {
  meta: number;
  umbrales: Umbrales;
}

/** Puerto del frontend hacia la Brújula Académica y sus umbrales (RF09). */
@Injectable()
export abstract class BrujulaRepository {
  abstract miBrujula(): Observable<Brujula>;
  /** Cambia los dos umbrales a la vez; el servidor valida que el medio sea menor que el alto. */
  abstract cambiarUmbrales(umbrales: Umbrales): Observable<ConfiguracionConUmbrales>;
}

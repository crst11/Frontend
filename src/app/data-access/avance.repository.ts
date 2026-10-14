import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/** Qué se le pide cargar al estudiante en cada paso. */
export type TipoDePaso = 'registro_extendido' | 'horario' | 'asignatura';

/**
 * Un paso del avance (SCRUM-84). `idMatricula` solo viene en los de asignatura: es la materia cuyas
 * actividades faltan.
 */
export interface PasoDeAvance {
  tipo: TipoDePaso;
  texto: string;
  hecho: boolean;
  idMatricula: number | null;
}

/**
 * Cuánta información lleva cargada el estudiante, como la calcula el servidor. El porcentaje ya viene
 * truncado: la pantalla no lo calcula.
 */
export interface AvanceDeInformacion {
  porcentaje: number;
  hechos: number;
  total: number;
  pasos: PasoDeAvance[];
}

/** Puerto del frontend hacia «Importar todos mis archivos» (RF03). */
@Injectable()
export abstract class AvanceRepository {
  abstract miAvance(): Observable<AvanceDeInformacion>;
}

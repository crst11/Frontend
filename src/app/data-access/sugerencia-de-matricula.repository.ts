import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/** Por qué el servidor propone una materia para el próximo semestre. */
export type MotivoDeSugerencia = 'siguiente_semestre' | 'pendiente' | 'a_repetir' | 'adelantable';

/** Una materia del plan que el servidor propone matricular; los créditos y el motivo los calcula él. */
export interface MateriaSugerida {
  codigo: string;
  nombre: string;
  creditos: number;
  semestre: number;
  motivoDeSugerencia: MotivoDeSugerencia;
  /** Algún prerrequisito se está cursando ahora: cuenta como cumplido, pero hay que aprobarlo. */
  dependeDeUnaEnCurso: boolean;
}

/**
 * Qué matricular el próximo semestre (RF13, SCRUM-244). Sin plan, sin historial o sin nada por matricular,
 * `semestreSugerido` es nulo y `motivo` dice por qué: la pantalla cae al armado manual.
 */
export interface SugerenciaDeMatricula {
  semestreActual: number | null;
  semestreSugerido: number | null;
  materias: MateriaSugerida[];
  creditos: number;
  /** Materias de semestres posteriores que ya cumplen sus prerrequisitos; no cuentan en `creditos`. */
  adelantables: MateriaSugerida[];
  motivo: string | null;
}

/** Puerto del frontend hacia la sugerencia de matrícula (RF13, SCRUM-244). Solo lee. */
@Injectable()
export abstract class SugerenciaDeMatriculaRepository {
  abstract consultar(): Observable<SugerenciaDeMatricula>;
}

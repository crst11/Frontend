import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/** Un programa entre los que el estudiante puede elegir (SCRUM-21). */
export interface Programa {
  codigo: string;
  nombre: string;
  facultad: string;
  sede: string;
  totalCreditos: number;
  numeroPeriodos: number;
}

export interface Asignatura {
  codigo: string;
  nombre: string;
  creditos: number;
  tipo: string;
  /** Códigos de las asignaturas que hay que ver antes; la pantalla los traduce a nombres. */
  prerrequisitos: string[];
}

export interface Periodo {
  periodo: number;
  creditos: number;
  asignaturas: Asignatura[];
}

/** La ruta de aprendizaje ya agrupada por período: el agrupado lo hace el dominio del backend. */
export interface PlanDeEstudios {
  codigo: string;
  programa: Programa;
  periodos: Periodo[];
}

/** `plan` viene nulo mientras el estudiante no haya elegido programa. */
export interface PerfilAcademico {
  programaElegido: boolean;
  plan: PlanDeEstudios | null;
}

/** Puerto del frontend hacia el plan de estudios del estudiante (RF02). */
@Injectable()
export abstract class PlanDeEstudiosRepository {
  abstract programas(): Observable<Programa[]>;
  abstract miPerfil(): Observable<PerfilAcademico>;
  abstract elegirPrograma(codigoPrograma: string): Observable<PerfilAcademico>;
}

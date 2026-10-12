import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/** El docente de una clase: solo nombres y apellidos, nunca su documento de identidad. */
export interface DocenteDeClase {
  nombres: string;
  apellidos: string;
}

/**
 * Un bloque del horario con la asignatura a la que pertenece (SCRUM-25).
 *
 * `dia` viaja sin tildes (`miercoles`, `sabado`) y las horas como `08:00`. El salón, el bloque y la
 * sede vienen nulos cuando el estudiante todavía no los conoce: la pantalla no los inventa.
 */
export interface ClaseDelHorario {
  idMatricula: number;
  consecutivo: number;
  codigoAsignatura: string;
  asignatura: string;
  dia: string;
  horaInicio: string;
  horaFin: string;
  duracionEnMinutos: number;
  salon: string | null;
  bloque: string | null;
  sede: string | null;
  docente: DocenteDeClase | null;
}

export interface DiaConClases {
  dia: string;
  clases: ClaseDelHorario[];
}

/**
 * Solo trae los días que tienen clases, de lunes a domingo, y dentro de cada día las clases en
 * orden de hora. Ese orden lo pone el servidor: la pantalla no vuelve a ordenar.
 */
export interface Horario {
  totalDeClases: number;
  dias: DiaConClases[];
}

/** Lo que se manda al agregar un bloque. El lugar y el docente son opcionales. */
export interface ClasePorAgregar {
  dia: string;
  horaInicio: string;
  horaFin: string;
  salon?: string;
  bloque?: string;
  sede?: string;
  docente?: DocenteDeClase;
}

/** Puerto del frontend hacia el horario del estudiante (RF04). */
@Injectable()
export abstract class HorarioRepository {
  abstract miHorario(): Observable<Horario>;
  abstract agregar(idMatricula: number, clase: ClasePorAgregar): Observable<ClaseDelHorario>;
  abstract quitar(idMatricula: number, consecutivo: number): Observable<void>;
}

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

/** Una asignatura que aparece en el horario, para poder elegirla en el filtro. */
export interface AsignaturaDelHorario {
  codigo: string;
  nombre: string;
}

/** Cómo se ordenan las clases dentro de un día. */
export type OrdenDelHorario = 'hora' | 'asignatura';

/** Con qué vista abre el horario. */
export type VistaDelHorario = 'dia' | 'semana';

/**
 * Lo que se pidió: el filtro y el orden con los que el servidor armó el horario. Los criterios
 * nulos significan «todas».
 */
export interface FiltroAplicado {
  asignatura: string | null;
  sede: string | null;
  orden: OrdenDelHorario;
}

/**
 * Solo trae los días que tienen clases, de lunes a domingo, y dentro de cada día las clases en el
 * orden pedido. Ese orden y ese filtro los pone el servidor: la pantalla no vuelve a ordenar ni a
 * filtrar.
 *
 * `sedes` y `asignaturas` son lo que se puede elegir en el filtro y salen siempre del horario
 * completo, no del filtrado: quien filtra por una sede tiene que poder elegir otra.
 */
export interface Horario {
  totalDeClases: number;
  dias: DiaConClases[];
  sedes: string[];
  asignaturas: AsignaturaDelHorario[];
  aplicado: FiltroAplicado;
}

/** Los criterios con los que se pide el horario. Los que faltan no filtran. */
export interface ConsultaDelHorario {
  asignatura?: string;
  sede?: string;
  orden?: OrdenDelHorario;
}

/**
 * Cómo le gusta al estudiante ver su horario, y lo que se guarda para la próxima vez (SCRUM-26).
 * El filtro por asignatura no se guarda a propósito: cambia cada período.
 */
export interface PreferenciaDeHorario {
  vista: VistaDelHorario;
  sede: string | null;
  orden: OrdenDelHorario;
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
  abstract miHorario(consulta?: ConsultaDelHorario): Observable<Horario>;
  abstract agregar(idMatricula: number, clase: ClasePorAgregar): Observable<ClaseDelHorario>;
  abstract quitar(idMatricula: number, consecutivo: number): Observable<void>;
  abstract miPreferencia(): Observable<PreferenciaDeHorario>;
  abstract guardarPreferencia(preferencia: PreferenciaDeHorario): Observable<PreferenciaDeHorario>;
}

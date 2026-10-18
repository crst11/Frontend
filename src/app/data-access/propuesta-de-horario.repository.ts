import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/** Los días en que puede haber clase; son los mismos que usa el servidor, sin tildes. */
export type DiaDeClase = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';

/** La parte del día en la que prefiere tener clase. */
export type FranjaPreferida = 'manana' | 'tarde' | 'noche';

/** Un bloque de un grupo, tal como lo escribe el estudiante: día y horas como `08:00`. */
export interface BloqueDeOferta {
  dia: DiaDeClase;
  inicio: string;
  fin: string;
}

export interface GrupoDeOferta {
  codigo: string;
  bloques: BloqueDeOferta[];
}

export interface AsignaturaDeOferta {
  nombre: string;
  grupos: GrupoDeOferta[];
}

/** Lo que prefiere. Lo que no pide no cuenta en el puntaje. */
export interface CriterioDeAcomodo {
  franja: FranjaPreferida | null;
  pocosHuecos: boolean;
  diasLibres: DiaDeClase[];
}

/** La oferta que el estudiante escribió y lo que prefiere (RF13, SCRUM-209). */
export interface PedidoDePropuestas {
  asignaturas: AsignaturaDeOferta[];
  criterio: CriterioDeAcomodo;
}

/** El grupo elegido de una asignatura, con sus bloques para dibujarlos. */
export interface EleccionDePropuesta {
  asignatura: string;
  grupo: string;
  bloques: BloqueDeOferta[];
}

export interface ResumenDePropuesta {
  minutosEnLaManana: number;
  minutosEnLaTarde: number;
  minutosEnLaNoche: number;
  minutosDeHuecos: number;
  diasConClase: DiaDeClase[];
  diasLibres: DiaDeClase[];
}

/** Una combinación sin choques. El puntaje y los motivos los calcula y escribe el servidor. */
export interface PropuestaDeHorario {
  puntaje: number;
  elecciones: EleccionDePropuesta[];
  resumen: ResumenDePropuesta;
  motivos: string[];
}

/** Dos asignaturas cuyos grupos chocan todos entre sí. */
export interface ChoqueDeAsignaturas {
  asignatura: string;
  otra: string;
}

/**
 * Lo que responde el servidor: hasta tres propuestas o, si no hay ninguna, `mensaje` con el motivo y, si se
 * puede decir, `choques`. `busquedaIncompleta` avisa de que la búsqueda se cortó y puede haber algo mejor.
 */
export interface PropuestasDeHorario {
  propuestas: PropuestaDeHorario[];
  choques: ChoqueDeAsignaturas[];
  mensaje: string | null;
  busquedaIncompleta: boolean;
}

/** Puerto del frontend hacia el motor que acomoda el horario de matrícula (RF13, SCRUM-209). No guarda nada. */
@Injectable()
export abstract class PropuestaDeHorarioRepository {
  abstract proponer(pedido: PedidoDePropuestas): Observable<PropuestasDeHorario>;
}

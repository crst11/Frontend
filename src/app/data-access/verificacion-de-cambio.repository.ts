import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DiaDeClase, GrupoDeOferta } from './propuesta-de-horario.repository';

/** Una materia del horario armado con el grupo que la persona tiene elegido. */
export interface EleccionDelHorario {
  asignatura: string;
  grupo: GrupoDeOferta;
}

/** El horario armado, la materia que se quiere cambiar y los otros grupos que se quieren probar (RF13, SCRUM-245). */
export interface PedidoDeVerificacion {
  horario: EleccionDelHorario[];
  asignaturaACambiar: string;
  candidatos: GrupoDeOferta[];
}

/** La clase del horario armado con la que choca un grupo probado: materia, grupo, día y hora. */
export interface ChoqueDelCambio {
  asignatura: string;
  grupo: string;
  dia: DiaDeClase;
  inicio: string;
  fin: string;
}

export interface CandidatoVerificado {
  grupo: string;
  cabe: boolean;
  choques: ChoqueDelCambio[];
}

/** Por cada grupo que se probó, en el mismo orden en que se mandó: si cabe o con qué choca. */
export interface VerificacionDeCambio {
  candidatos: CandidatoVerificado[];
}

/** Puerto del frontend hacia la verificación del cambio de grupo (RF13, SCRUM-245). No guarda nada. */
@Injectable()
export abstract class VerificacionDeCambioRepository {
  abstract verificar(pedido: PedidoDeVerificacion): Observable<VerificacionDeCambio>;
}

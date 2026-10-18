import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DocenteDeClase } from './horario.repository';

/**
 * Una clase detectada en el Reporte de Horario (SCRUM-81). Tiene los mismos nombres que la clase que
 * se agrega a mano, así que lo que se muestra es lo que se manda de vuelta al confirmar.
 *
 * `dia` viaja sin tildes y las horas como `09:00`. El salón, el bloque y la sede vienen nulos cuando
 * el reporte no los trae.
 */
export interface ClaseDetectada {
  dia: string;
  horaInicio: string;
  horaFin: string;
  salon: string | null;
  bloque: string | null;
  sede: string | null;
  docente: DocenteDeClase | null;
}

/**
 * Una asignatura del reporte. `enElPlan` en falso significa que no se va a guardar; `yaEstaba` que
 * el estudiante ya la tiene en este período, y `clasesQueTiene` cuántas clases se reemplazan.
 */
export interface AsignaturaDelReporte {
  codigo: string;
  nombre: string;
  grupo: string | null;
  enElPlan: boolean;
  yaEstaba: boolean;
  clasesQueTiene: number;
  clases: ClaseDetectada[];
}

/** `periodo` se deduce de la fecha del reporte; `coincideConMiPrograma` avisa si es de otro programa. */
export interface AnalisisDeHorario {
  nombreArchivo: string;
  programaDelReporte: string;
  sedeDelReporte: string;
  coincideConMiPrograma: boolean;
  periodo: string;
  detectadas: number;
  clases: number;
  seVanAGuardar: number;
  asignaturas: AsignaturaDelReporte[];
}

export interface ConfirmacionDeHorario {
  periodo: string;
  asignaturas: { codigo: string; grupo: string | null; clases: ClaseDetectada[] }[];
}

/** `omitidas` son las que no están en la ruta de aprendizaje o que ya cerraron con nota en ese período. */
export interface ResultadoDeHorario {
  nuevas: number;
  actualizadas: number;
  omitidas: number;
  clases: number;
}

/** Puerto del frontend hacia la importación del Reporte de Horario (RF04). */
@Injectable()
export abstract class ImportacionDeHorarioRepository {
  /** Lee el archivo y devuelve lo detectado. No guarda nada. */
  abstract analizar(archivo: File): Observable<AnalisisDeHorario>;
  abstract confirmar(confirmacion: ConfirmacionDeHorario): Observable<ResultadoDeHorario>;
}

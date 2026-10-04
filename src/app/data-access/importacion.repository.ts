import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Una asignatura leída del reporte (SCRUM-23).
 *
 * `enElPlan` en falso significa que no se va a guardar: sin estar en la ruta de aprendizaje no hay
 * nombre ni créditos con qué contarla. Se muestra igual para que el estudiante sepa que la vimos.
 * `yaEstaba` distingue lo nuevo de lo que se va a actualizar.
 */
export interface AsignaturaDetectada {
  codigo: string;
  nombre: string;
  creditos: number;
  nota: number | null;
  estado: string;
  enElPlan: boolean;
  yaEstaba: boolean;
}

export interface PeriodoDetectado {
  codigo: string;
  creditosMatriculados: number | null;
  creditosAprobados: number | null;
  promedioPeriodo: number | null;
  promedioAcumulado: number | null;
  asignaturas: AsignaturaDetectada[];
}

/** `coincideConMiPrograma` avisa si el reporte es de un programa distinto al elegido en la app. */
export interface AnalisisDeImportacion {
  nombreArchivo: string;
  programaDelReporte: string;
  sedeDelReporte: string;
  coincideConMiPrograma: boolean;
  detectadas: number;
  seVanAGuardar: number;
  periodos: PeriodoDetectado[];
}

export interface NotaConfirmada {
  codigoAsignatura: string;
  nota: number | null;
}

export interface PeriodoConfirmado {
  codigo: string;
  creditosMatriculados: number;
  creditosAprobados: number;
  promedioPeriodo: number | null;
  promedioAcumulado: number | null;
  notas: NotaConfirmada[];
}

export interface Confirmacion {
  nombreArchivo: string;
  detectadas: number;
  periodos: PeriodoConfirmado[];
}

/** `omitidas` son las que el reporte traía pero no están en la ruta de aprendizaje. */
export interface ResultadoDeImportacion {
  idImportacion: number;
  guardadas: number;
  actualizadas: number;
  omitidas: number;
}

/** Puerto del frontend hacia la importación de reportes institucionales (RF03). */
@Injectable()
export abstract class ImportacionRepository {
  /** Lee el archivo y devuelve lo detectado. No guarda nada. */
  abstract analizar(archivo: File): Observable<AnalisisDeImportacion>;
  abstract confirmar(confirmacion: Confirmacion): Observable<ResultadoDeImportacion>;
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AnalisisDeHorario,
  ConfirmacionDeHorario,
  ImportacionDeHorarioRepository,
  ResultadoDeHorario,
} from '../importacion-de-horario.repository';

@Injectable()
export class ImportacionDeHorarioHttpRepository extends ImportacionDeHorarioRepository {
  private readonly http = inject(HttpClient);
  private readonly ruta = `${environment.apiUrl}/mis/importaciones/horario`;

  override analizar(archivo: File): Observable<AnalisisDeHorario> {
    const cuerpo = new FormData();
    cuerpo.append('archivo', archivo, archivo.name);
    return this.http.post<AnalisisDeHorario>(`${this.ruta}/analisis`, cuerpo);
  }

  override confirmar(confirmacion: ConfirmacionDeHorario): Observable<ResultadoDeHorario> {
    return this.http.post<ResultadoDeHorario>(this.ruta, confirmacion);
  }
}

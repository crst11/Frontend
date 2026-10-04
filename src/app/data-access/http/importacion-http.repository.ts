import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AnalisisDeImportacion,
  Confirmacion,
  ImportacionRepository,
  ResultadoDeImportacion,
} from '../importacion.repository';

@Injectable()
export class ImportacionHttpRepository extends ImportacionRepository {
  private readonly http = inject(HttpClient);
  private readonly ruta = `${environment.apiUrl}/mis/importaciones`;

  override analizar(archivo: File): Observable<AnalisisDeImportacion> {
    const cuerpo = new FormData();
    cuerpo.append('archivo', archivo, archivo.name);
    return this.http.post<AnalisisDeImportacion>(`${this.ruta}/analisis`, cuerpo);
  }

  override confirmar(confirmacion: Confirmacion): Observable<ResultadoDeImportacion> {
    return this.http.post<ResultadoDeImportacion>(this.ruta, confirmacion);
  }
}

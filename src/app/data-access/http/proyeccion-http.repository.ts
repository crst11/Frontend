import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Configuracion,
  NotaSimulada,
  ProyeccionDeNota,
  ProyeccionRepository,
} from '../proyeccion.repository';

@Injectable()
export class ProyeccionHttpRepository extends ProyeccionRepository {
  private readonly http = inject(HttpClient);
  private readonly rutaMatriculas = `${environment.apiUrl}/mis/matriculas`;
  private readonly rutaConfiguracion = `${environment.apiUrl}/mis/configuracion`;

  override proyeccion(idMatricula: number, meta?: number): Observable<ProyeccionDeNota> {
    return this.http.get<ProyeccionDeNota>(`${this.rutaMatriculas}/${idMatricula}/proyeccion`, {
      params: meta === undefined ? {} : { meta },
    });
  }

  override simular(idMatricula: number, notas: NotaSimulada[], meta?: number): Observable<ProyeccionDeNota> {
    return this.http.post<ProyeccionDeNota>(`${this.rutaMatriculas}/${idMatricula}/simulaciones`, {
      ...(meta === undefined ? {} : { meta }),
      notas,
    });
  }

  override miConfiguracion(): Observable<Configuracion> {
    return this.http.get<Configuracion>(this.rutaConfiguracion);
  }

  override cambiarMeta(meta: number): Observable<Configuracion> {
    return this.http.patch<Configuracion>(this.rutaConfiguracion, { meta });
  }
}

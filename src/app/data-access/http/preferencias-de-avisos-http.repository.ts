import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PreferenciasDeAvisos, PreferenciasDeAvisosRepository } from '../preferencias-de-avisos.repository';

@Injectable()
export class PreferenciasDeAvisosHttpRepository extends PreferenciasDeAvisosRepository {
  private readonly http = inject(HttpClient);
  private readonly ruta = `${environment.apiUrl}/mis/configuracion/avisos`;

  override mias(): Observable<PreferenciasDeAvisos> {
    return this.http.get<PreferenciasDeAvisos>(this.ruta);
  }

  override cambiar(preferencias: PreferenciasDeAvisos): Observable<PreferenciasDeAvisos> {
    return this.http.put<PreferenciasDeAvisos>(this.ruta, preferencias);
  }
}

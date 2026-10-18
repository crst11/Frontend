import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AvisoRepository, MisAvisos } from '../aviso.repository';

@Injectable()
export class AvisoHttpRepository extends AvisoRepository {
  private readonly http = inject(HttpClient);
  private readonly ruta = `${environment.apiUrl}/mis/avisos`;

  override misAvisos(soloSinLeer = false): Observable<MisAvisos> {
    return this.http.get<MisAvisos>(this.ruta, { params: soloSinLeer ? { soloSinLeer: true } : {} });
  }

  override marcar(id: number, leido: boolean): Observable<void> {
    return this.http.patch<void>(`${this.ruta}/${id}`, { leido });
  }

  override marcarTodos(): Observable<void> {
    return this.http.post<void>(`${this.ruta}/leidos`, {});
  }
}

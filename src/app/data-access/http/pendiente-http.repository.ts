import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Pendiente, PendientePorCrear, PendienteRepository } from '../pendiente.repository';

@Injectable()
export class PendienteHttpRepository extends PendienteRepository {
  private readonly http = inject(HttpClient);
  private readonly ruta = `${environment.apiUrl}/mis/pendientes`;

  override listar(incluirCumplidos = false): Observable<Pendiente[]> {
    return this.http.get<Pendiente[]>(this.ruta, {
      params: incluirCumplidos ? { incluirCumplidos: true } : {},
    });
  }

  override crear(pendiente: PendientePorCrear): Observable<Pendiente> {
    return this.http.post<Pendiente>(this.ruta, pendiente);
  }

  override marcar(id: number, cumplido: boolean): Observable<Pendiente> {
    return this.http.patch<Pendiente>(`${this.ruta}/${id}`, { cumplido });
  }

  override eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.ruta}/${id}`);
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PedidoDeVerificacion,
  VerificacionDeCambio,
  VerificacionDeCambioRepository,
} from '../verificacion-de-cambio.repository';

@Injectable()
export class VerificacionDeCambioHttpRepository extends VerificacionDeCambioRepository {
  private readonly http = inject(HttpClient);
  private readonly ruta = `${environment.apiUrl}/mis/horario/verificaciones`;

  override verificar(pedido: PedidoDeVerificacion): Observable<VerificacionDeCambio> {
    return this.http.post<VerificacionDeCambio>(this.ruta, pedido);
  }
}

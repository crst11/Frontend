import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PedidoDePropuestas,
  PropuestaDeHorarioRepository,
  PropuestasDeHorario,
} from '../propuesta-de-horario.repository';

@Injectable()
export class PropuestaDeHorarioHttpRepository extends PropuestaDeHorarioRepository {
  private readonly http = inject(HttpClient);
  private readonly ruta = `${environment.apiUrl}/mis/horario/propuestas`;

  override proponer(pedido: PedidoDePropuestas): Observable<PropuestasDeHorario> {
    return this.http.post<PropuestasDeHorario>(this.ruta, pedido);
  }
}

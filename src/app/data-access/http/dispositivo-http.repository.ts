import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DispositivoConAvisos,
  DispositivoRepository,
  LlaveDePush,
  SuscripcionPush,
} from '../dispositivo.repository';

@Injectable()
export class DispositivoHttpRepository extends DispositivoRepository {
  private readonly http = inject(HttpClient);
  private readonly ruta = `${environment.apiUrl}/mis/dispositivos`;

  override llavePublica(): Observable<LlaveDePush> {
    return this.http.get<LlaveDePush>(`${this.ruta}/llave-publica`);
  }

  override suscribir(suscripcion: SuscripcionPush): Observable<DispositivoConAvisos> {
    return this.http.put<DispositivoConAvisos>(`${this.ruta}/suscripcion`, suscripcion);
  }
}

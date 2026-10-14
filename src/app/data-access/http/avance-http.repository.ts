import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AvanceDeInformacion, AvanceRepository } from '../avance.repository';

@Injectable()
export class AvanceHttpRepository extends AvanceRepository {
  private readonly http = inject(HttpClient);
  private readonly ruta = `${environment.apiUrl}/mis/avance-de-informacion`;

  override miAvance(): Observable<AvanceDeInformacion> {
    return this.http.get<AvanceDeInformacion>(this.ruta);
  }
}

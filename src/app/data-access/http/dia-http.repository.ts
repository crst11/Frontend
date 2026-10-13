import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DiaRepository, MiDia } from '../dia.repository';

@Injectable()
export class DiaHttpRepository extends DiaRepository {
  private readonly http = inject(HttpClient);
  private readonly ruta = `${environment.apiUrl}/mis/dia`;

  override miDia(fecha?: string): Observable<MiDia> {
    return this.http.get<MiDia>(this.ruta, fecha ? { params: { fecha } } : {});
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { HistorialRepository, MiHistorial } from '../historial.repository';

@Injectable()
export class HistorialHttpRepository extends HistorialRepository {
  private readonly http = inject(HttpClient);

  override miHistorial(): Observable<MiHistorial> {
    return this.http.get<MiHistorial>(`${environment.apiUrl}/mis/historial`);
  }
}

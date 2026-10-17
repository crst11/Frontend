import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Brujula, BrujulaRepository, ConfiguracionConUmbrales, Umbrales } from '../brujula.repository';

@Injectable()
export class BrujulaHttpRepository extends BrujulaRepository {
  private readonly http = inject(HttpClient);

  override miBrujula(): Observable<Brujula> {
    return this.http.get<Brujula>(`${environment.apiUrl}/mis/brujula`);
  }

  override cambiarUmbrales(umbrales: Umbrales): Observable<ConfiguracionConUmbrales> {
    return this.http.put<ConfiguracionConUmbrales>(`${environment.apiUrl}/mis/configuracion/umbrales`, umbrales);
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CuentaRegistrada, DatosDeRegistro, EstudianteRepository } from '../estudiante.repository';

@Injectable()
export class EstudianteHttpRepository extends EstudianteRepository {
  private readonly http = inject(HttpClient);

  override registrar(datos: DatosDeRegistro): Observable<CuentaRegistrada> {
    return this.http.post<CuentaRegistrada>(`${environment.apiUrl}/publico/auth/registro`, datos);
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CuentaRegistrada, DatosDeRegistro, EstudianteRepository } from '../estudiante.repository';

@Injectable()
export class EstudianteHttpRepository extends EstudianteRepository {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/publico/auth`;

  override registrar(datos: DatosDeRegistro): Observable<CuentaRegistrada> {
    return this.http.post<CuentaRegistrada>(`${this.base}/registro`, datos);
  }

  override verificarCorreo(correo: string, codigo: string): Observable<CuentaRegistrada> {
    return this.http.post<CuentaRegistrada>(`${this.base}/verificacion`, { correo, codigo });
  }

  override reenviarCodigo(correo: string): Observable<void> {
    return this.http.post<void>(`${this.base}/verificacion/reenvio`, { correo });
  }
}

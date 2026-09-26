import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Cuenta,
  CuentaRegistrada,
  DatosDeRegistro,
  EstudianteRepository,
  SesionIniciada,
  VinculoConGoogle,
} from '../estudiante.repository';

/** Valor de la cookie XSRF-TOKEN que el backend deja al iniciar sesión (no es HttpOnly a propósito). */
function tokenCsrf(): string {
  const cookie = document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='));
  return cookie ? decodeURIComponent(cookie.substring('XSRF-TOKEN='.length)) : '';
}

@Injectable()
export class EstudianteHttpRepository extends EstudianteRepository {
  private readonly http = inject(HttpClient);
  private readonly publico = `${environment.apiUrl}/publico/auth`;

  override registrar(datos: DatosDeRegistro): Observable<CuentaRegistrada> {
    return this.http.post<CuentaRegistrada>(`${this.publico}/registro`, datos);
  }

  override verificarCorreo(correo: string, codigo: string): Observable<CuentaRegistrada> {
    return this.http.post<CuentaRegistrada>(`${this.publico}/verificacion`, { correo, codigo });
  }

  override reenviarCodigo(correo: string): Observable<void> {
    return this.http.post<void>(`${this.publico}/verificacion/reenvio`, { correo });
  }

  override iniciarSesion(correo: string, contrasena: string): Observable<SesionIniciada> {
    return this.http.post<SesionIniciada>(`${this.publico}/login`, { correo, contrasena }, { withCredentials: true });
  }

  override iniciarSesionConGoogle(idToken: string): Observable<SesionIniciada> {
    return this.http.post<SesionIniciada>(`${this.publico}/google`, { idToken }, { withCredentials: true });
  }

  override renovarSesion(): Observable<SesionIniciada> {
    return this.http.post<SesionIniciada>(`${this.publico}/refresco`, null, this.opcionesConCsrf());
  }

  override cerrarSesion(): Observable<void> {
    return this.http.post<void>(`${this.publico}/logout`, null, this.opcionesConCsrf());
  }

  override miCuenta(): Observable<Cuenta> {
    return this.http.get<Cuenta>(`${environment.apiUrl}/mis/cuenta`);
  }

  override vinculoConGoogle(): Observable<VinculoConGoogle> {
    return this.http.get<VinculoConGoogle>(`${environment.apiUrl}/mis/google`);
  }

  override vincularGoogle(idToken: string): Observable<VinculoConGoogle> {
    return this.http.post<VinculoConGoogle>(`${environment.apiUrl}/mis/google`, { idToken });
  }

  override desvincularGoogle(): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/mis/google`);
  }

  private opcionesConCsrf() {
    return { withCredentials: true, headers: new HttpHeaders({ 'X-XSRF-TOKEN': tokenCsrf() }) };
  }
}

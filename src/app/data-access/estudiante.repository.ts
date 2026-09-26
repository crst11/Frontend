import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface DatosDeRegistro {
  correo: string;
  contrasena: string;
  nombres: string;
  apellidos: string;
  aceptaTratamientoDatos: boolean;
}

export interface CuentaRegistrada {
  id: number;
  correo: string;
  estado: string;
}

export interface Cuenta {
  id: number;
  correo: string;
  nombres: string;
  apellidos: string;
  estado: string;
}

/** El refresco no viaja aquí: el backend lo deja en una cookie HttpOnly que JavaScript no puede leer. */
export interface SesionIniciada {
  tokenDeAcceso: string;
  tipo: string;
  expiraEnSegundos: number;
  cuenta: Cuenta;
}

/** Si la cuenta tiene Google vinculado y con qué correo de Google (SCRUM-48). */
export interface VinculoConGoogle {
  vinculada: boolean;
  correo: string | null;
  fechaVinculacion: string | null;
}

/** Puerto del frontend hacia la cuenta del estudiante (RF01): registro, verificación, sesión y Google. */
@Injectable()
export abstract class EstudianteRepository {
  abstract registrar(datos: DatosDeRegistro): Observable<CuentaRegistrada>;
  abstract verificarCorreo(correo: string, codigo: string): Observable<CuentaRegistrada>;
  abstract reenviarCodigo(correo: string): Observable<void>;
  abstract iniciarSesion(correo: string, contrasena: string): Observable<SesionIniciada>;
  abstract iniciarSesionConGoogle(idToken: string): Observable<SesionIniciada>;
  abstract renovarSesion(): Observable<SesionIniciada>;
  abstract cerrarSesion(): Observable<void>;
  abstract miCuenta(): Observable<Cuenta>;
  abstract vinculoConGoogle(): Observable<VinculoConGoogle>;
  abstract vincularGoogle(idToken: string): Observable<VinculoConGoogle>;
  abstract desvincularGoogle(): Observable<void>;
}

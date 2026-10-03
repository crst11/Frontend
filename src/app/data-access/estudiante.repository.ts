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

/**
 * Una sesión abierta en algún dispositivo (SCRUM-49). La huella del token de refresco no viaja:
 * identifica la sesión por dentro y no es asunto de la pantalla.
 */
export interface SesionAbierta {
  consecutivo: number;
  metodo: string;
  fechaInicio: string;
  fechaExpiracion: string;
  dispositivo: string | null;
  ip: string | null;
}

/** Puerto del frontend hacia la cuenta del estudiante (RF01): registro, verificación, sesión, recuperación y Google. */
@Injectable()
export abstract class EstudianteRepository {
  abstract registrar(datos: DatosDeRegistro): Observable<CuentaRegistrada>;
  abstract verificarCorreo(correo: string, codigo: string): Observable<CuentaRegistrada>;
  abstract reenviarCodigo(correo: string): Observable<void>;
  /** Pide el código para cambiar la contraseña. Responde igual exista o no la cuenta (SCRUM-68). */
  abstract solicitarRecuperacion(correo: string): Observable<void>;
  abstract restablecerContrasena(correo: string, codigo: string, contrasenaNueva: string): Observable<void>;
  abstract iniciarSesion(correo: string, contrasena: string): Observable<SesionIniciada>;
  abstract iniciarSesionConGoogle(idToken: string): Observable<SesionIniciada>;
  abstract renovarSesion(): Observable<SesionIniciada>;
  abstract cerrarSesion(): Observable<void>;
  abstract miCuenta(): Observable<Cuenta>;
  abstract eliminarCuenta(): Observable<void>;
  abstract misSesiones(): Observable<SesionAbierta[]>;
  abstract cerrarSesionEnDispositivo(consecutivo: number): Observable<void>;
  /** Cierra todas, incluida la de quien lo pide: el backend lo hace a propósito (SCRUM-49). */
  abstract cerrarTodasMisSesiones(): Observable<void>;
  abstract vinculoConGoogle(): Observable<VinculoConGoogle>;
  abstract vincularGoogle(idToken: string): Observable<VinculoConGoogle>;
  abstract desvincularGoogle(): Observable<void>;
}

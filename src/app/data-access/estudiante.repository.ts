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

/** Puerto del frontend hacia la cuenta del estudiante (RF01): registro y verificación del correo. */
@Injectable()
export abstract class EstudianteRepository {
  abstract registrar(datos: DatosDeRegistro): Observable<CuentaRegistrada>;
  abstract verificarCorreo(correo: string, codigo: string): Observable<CuentaRegistrada>;
  abstract reenviarCodigo(correo: string): Observable<void>;
}

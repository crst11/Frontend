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

/** Puerto del frontend hacia la cuenta del estudiante (RF01): registro e inicio de sesión. */
@Injectable()
export abstract class EstudianteRepository {
  abstract registrar(datos: DatosDeRegistro): Observable<CuentaRegistrada>;
}

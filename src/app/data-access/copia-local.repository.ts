import { Injectable } from '@angular/core';

/** Lo último que se guardó de una lectura, con el momento en que se guardó (milisegundos desde 1970). */
export interface CopiaGuardada {
  valor: unknown;
  guardadaEn: number;
}

/**
 * Puerto del frontend hacia la copia que la aplicación guarda en el dispositivo para consultar sin conexión
 * (RF12, SCRUM-39): la última respuesta buena de cada lectura. Cambiar IndexedDB por otra cosa no toca a quien
 * lo usa.
 *
 * <p>Nunca lanza: si el dispositivo no deja guardar (ventana privada, sin espacio), la aplicación sigue
 * funcionando con conexión; lo único que se pierde es poder consultar sin ella.
 */
@Injectable()
export abstract class CopiaLocalRepository {
  abstract guardar(clave: string, valor: unknown, guardadaEn: number): Promise<void>;
  abstract leer(clave: string): Promise<CopiaGuardada | null>;
  /** Borra todo lo guardado: se usa al cerrar sesión, para no dejar datos personales en el dispositivo. */
  abstract borrarTodo(): Promise<void>;
}

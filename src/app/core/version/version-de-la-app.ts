import { Injectable, signal } from '@angular/core';

/**
 * Con qué versión está corriendo la app (SCRUM-272). Hay una sola compilación para todos los ambientes (SCRUM-218), así
 * que la versión no se compila: el despliegue escribe `/version.json` junto a `/config.json` con el commit que subió, y
 * la imagen de Docker de desarrollo hace lo mismo (SCRUM-270). Es público: llega al navegador de todas formas.
 */
const RUTA_DE_LA_VERSION = '/version.json';
/** Que un servidor lento no deje colgado el menú: pasado esto no se muestra la versión. */
const ESPERA_MAXIMA_MS = 3000;
/** Un commit corto o una etiqueta de versión: letras, números, punto, guion y guion bajo. Nada que se pueda interpretar. */
const FORMATO_DE_LA_VERSION = /^[A-Za-z0-9._-]{1,40}$/;

type Obtener = (entrada: string, opciones?: RequestInit) => Promise<Response>;

/** La versión publicada, o nulo si no hay archivo, no hay red o lo que hay no tiene el formato esperado. */
export async function leerVersion(obtener: Obtener = (entrada, opciones) => fetch(entrada, opciones)): Promise<string | null> {
  try {
    const respuesta = await obtener(RUTA_DE_LA_VERSION, { cache: 'no-store', signal: AbortSignal.timeout(ESPERA_MAXIMA_MS) });
    if (!respuesta.ok) {
      return null;
    }
    // Si el sitio no tiene version.json, el hosting suele devolver index.html con 200: eso no es JSON y se descarta.
    const datos: unknown = await respuesta.json();
    const version = typeof datos === 'object' && datos !== null ? (datos as Record<string, unknown>)['version'] : null;
    return typeof version === 'string' && FORMATO_DE_LA_VERSION.test(version) ? version : null;
  } catch {
    return null;
  }
}

/** La versión de la app para mostrarla en el menú Más. Se lee al abrir el menú, no al arrancar, y una vez que se logra. */
@Injectable({ providedIn: 'root' })
export class VersionDeLaApp {
  private readonly _version = signal<string | null>(null);
  readonly version = this._version.asReadonly();

  async cargar(): Promise<void> {
    if (this._version() !== null) {
      return;
    }
    this._version.set(await leerVersion());
  }
}

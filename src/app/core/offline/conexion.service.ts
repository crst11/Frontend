import { Injectable, signal } from '@angular/core';

/**
 * Si el dispositivo dice tener red (RF12, SCRUM-40). El navegador avisa cuando la conexión se cae o vuelve, y
 * esta señal lo refleja para que la barra y las escrituras reaccionen al instante.
 *
 * <p>«Con red» es lo que el dispositivo cree: puede haber red y el servidor no responder. Por eso el interceptor
 * también sirve la copia guardada cuando el servidor falla aunque esta señal diga que hay conexión.
 */
@Injectable({ providedIn: 'root' })
export class Conexion {
  private readonly enLineaActual = signal(typeof navigator === 'undefined' ? true : navigator.onLine);

  readonly enLinea = this.enLineaActual.asReadonly();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.enLineaActual.set(true));
      window.addEventListener('offline', () => this.enLineaActual.set(false));
    }
  }
}

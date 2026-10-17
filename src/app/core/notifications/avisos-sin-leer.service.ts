import { Injectable, inject, signal } from '@angular/core';
import { AvisoRepository } from '../../data-access/aviso.repository';

/**
 * Cuántos avisos no he leído, para el número de la campana (RF10, SCRUM-37). Lo comparten el marco de la
 * aplicación, que lo muestra, y la pantalla de avisos, que lo actualiza al leer.
 */
@Injectable({ providedIn: 'root' })
export class AvisosSinLeer {
  private readonly repositorio = inject(AvisoRepository);

  readonly cantidad = signal(0);

  /** Vuelve a preguntar. Es una ayuda: si no llega, se conserva el último número en vez de borrarlo. */
  refrescar(): void {
    this.repositorio.misAvisos(true).subscribe({
      next: (respuesta) => this.cantidad.set(respuesta.sinLeer),
      error: () => undefined,
    });
  }

  fijar(cantidad: number): void {
    this.cantidad.set(cantidad);
  }
}

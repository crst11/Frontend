import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Cuándo se actualizó lo que la pantalla muestra (RF12, SCRUM-40).
 *
 * <p>Cada lectura que termina avisa aquí: si vino del servidor, es «ahora»; si se sirvió de la copia guardada,
 * es el momento en que se guardó. Una pantalla suele hacer varias lecturas, y lo que dice si los datos están al
 * día es la **más antigua**, así que eso es lo que se muestra. Al cambiar de pantalla se empieza de cero.
 */
@Injectable({ providedIn: 'root' })
export class Sincronizacion {
  private readonly momentos = signal<readonly number[]>([]);
  private readonly copias = signal(0);

  /** El momento más antiguo entre las lecturas de esta pantalla, o nulo si todavía no hay ninguna. */
  readonly ultimaActualizacion = computed(() => {
    const momentos = this.momentos();
    return momentos.length === 0 ? null : Math.min(...momentos);
  });

  /** Si alguna de las lecturas de esta pantalla salió de la copia guardada y no del servidor. */
  readonly mostrandoCopia = computed(() => this.copias() > 0);

  constructor() {
    inject(Router)
      .events.pipe(filter((evento) => evento instanceof NavigationStart))
      .subscribe(() => this.reiniciar());
  }

  /** Una lectura que acaba de llegar del servidor. */
  registrarActual(momento: number): void {
    this.momentos.update((anteriores) => [...anteriores, momento]);
  }

  /** Una lectura servida de la copia guardada en `guardadaEn`. */
  registrarCopia(guardadaEn: number): void {
    this.momentos.update((anteriores) => [...anteriores, guardadaEn]);
    this.copias.update((cantidad) => cantidad + 1);
  }

  reiniciar(): void {
    this.momentos.set([]);
    this.copias.set(0);
  }
}

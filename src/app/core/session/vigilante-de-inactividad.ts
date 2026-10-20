import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NotifierService } from '../feedback/notifier.service';
import { DispositivoDeLaSesion } from './dispositivo-de-la-sesion';
import { SessionService } from './session.service';

/** Lo que cuenta como «la persona sigue ahí». */
const EVENTOS_DE_ACTIVIDAD = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const;

/** Cada cuánto se mira si ya pasó el plazo, con la aplicación abierta. */
const CADA_CUANTO_MIRAR_EN_MS = 15_000;

/**
 * Cierra la sesión de un equipo compartido tras el plazo sin actividad (SCRUM-231). Mira lo que hace la persona (tocar, teclear,
 * desplazarse) y, si en un dispositivo marcado como compartido pasan más de {@link PLAZO_DE_INACTIVIDAD_EN_MS} sin nada, cierra la
 * sesión (se revoca en el servidor y se borra todo lo local) y lleva a iniciar sesión. En un dispositivo personal no hace nada.
 *
 * <p>Al volver a abrir la aplicación después de un rato lo resuelve {@code SessionService.restaurar}: este vigilante cubre la
 * aplicación abierta y la pestaña que se deja olvidada en segundo plano.
 */
@Injectable({ providedIn: 'root' })
export class VigilanteDeInactividad {
  private readonly sesion = inject(SessionService);
  private readonly dispositivo = inject(DispositivoDeLaSesion);
  private readonly router = inject(Router);
  private readonly notificador = inject(NotifierService);
  private iniciado = false;
  private cerrando = false;

  /** Empieza a vigilar (una sola vez, al arrancar la aplicación). Devuelve la función que deja de vigilar. */
  iniciar(): () => void {
    if (this.iniciado) {
      return () => undefined;
    }
    this.iniciado = true;
    const escuchas = new AbortController();
    for (const evento of EVENTOS_DE_ACTIVIDAD) {
      document.addEventListener(evento, () => this.alHaberActividad(), { passive: true, capture: true, signal: escuchas.signal });
    }
    // Una pestaña en segundo plano frena sus temporizadores: al volver se mira primero, antes de que el primer toque cuente como actividad.
    document.addEventListener(
      'visibilitychange',
      () => {
        if (!document.hidden) {
          this.revisar();
        }
      },
      { signal: escuchas.signal },
    );
    const temporizador = setInterval(() => this.revisar(), CADA_CUANTO_MIRAR_EN_MS);
    return () => {
      escuchas.abort();
      clearInterval(temporizador);
      this.iniciado = false;
    };
  }

  /** Cierra la sesión si es un equipo compartido y ya pasó el plazo. Pública para poder probarla sin esperar. */
  revisar(ahora = Date.now()): void {
    if (this.cerrando || !this.sesion.estaAutenticada() || !this.dispositivo.estaInactivo(ahora)) {
      return;
    }
    this.cerrando = true;
    const terminar = () => {
      this.cerrando = false;
      void this.router.navigate(['/cuenta/entrar']);
      void this.notificador.informar(
        'Cerramos tu sesión',
        'Pasaron 15 minutos sin actividad en este equipo compartido, así que la cerramos para proteger tus datos. Inicia sesión de nuevo cuando quieras.',
      );
    };
    this.sesion.cerrar().subscribe({ next: terminar, error: terminar });
  }

  private alHaberActividad(): void {
    // Si ya pasó el plazo, este toque no «revive» la sesión: la persona que llega ahora no es la que la dejó.
    if (this.dispositivo.estaInactivo()) {
      this.revisar();
      return;
    }
    this.dispositivo.registrarActividad();
  }
}

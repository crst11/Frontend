import { Injectable, InjectionToken, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import { NotifierService } from '../feedback/notifier.service';

/** Cada cuánto se busca una versión nueva con la aplicación abierta. */
const CADA_CUANTO_BUSCAR_EN_MS = 30 * 60_000;

/** Cuánto se espera la respuesta del service worker al activar la versión nueva antes de recargar de todos modos. */
const ESPERA_DE_LA_ACTIVACION_EN_MS = 5_000;

/** Marca que deja la actualización en la sesión de la pestaña para avisar, ya recargada, que salió bien. */
const MARCA_DE_ACTUALIZADA = 'cundiapp.actualizada';

/** Recargar la página: va en un token para poder probar el servicio sin recargar el navegador de las pruebas. */
export const RECARGAR_LA_PAGINA = new InjectionToken<() => void>('RECARGAR_LA_PAGINA', {
  providedIn: 'root',
  factory: () => () => location.reload(),
});

/**
 * Mantiene la aplicación al día (SCRUM-258). El service worker baja la versión nueva en segundo plano, pero sigue mostrando la
 * vieja hasta que la aplicación se cierra y se vuelve a abrir, y como la sesión se restaura sola, casi nunca se cierra. Este
 * servicio busca la versión nueva al volver a la aplicación y cada media hora, y cuando está lista pregunta si se actualiza ahora.
 *
 * <p>No recarga sin preguntar: «Armar mi horario» guarda la oferta que se sube solo en memoria, y una recarga a mitad de trabajo la
 * borraría. Si la persona deja la actualización para después, vuelve a preguntar cuando regresa a la aplicación.
 */
@Injectable({ providedIn: 'root' })
export class ActualizadorDeLaApp {
  private readonly serviceWorker = inject(SwUpdate);
  private readonly notificador = inject(NotifierService);
  private readonly recargar = inject(RECARGAR_LA_PAGINA);
  private iniciado = false;
  private preguntando = false;
  private hayVersionLista = false;

  /** Empieza a vigilar (una sola vez, al arrancar). Devuelve la función que deja de vigilar. Sin service worker (desarrollo) no hace nada. */
  iniciar(): () => void {
    if (this.iniciado || !this.serviceWorker.isEnabled) {
      return () => undefined;
    }
    this.iniciado = true;
    this.confirmarSiVieneDeActualizar();
    const suscripciones = [
      this.serviceWorker.versionUpdates
        .pipe(filter((evento): evento is VersionReadyEvent => evento.type === 'VERSION_READY'))
        .subscribe(() => {
          this.hayVersionLista = true;
          void this.ofrecer();
        }),
      this.serviceWorker.unrecoverable.subscribe(() => void this.recargarPorFalla()),
    ];
    const escuchas = new AbortController();
    document.addEventListener(
      'visibilitychange',
      () => {
        if (!document.hidden) {
          this.revisar();
        }
      },
      { signal: escuchas.signal },
    );
    const temporizador = setInterval(() => this.revisar(), CADA_CUANTO_BUSCAR_EN_MS);
    return () => {
      suscripciones.forEach((suscripcion) => suscripcion.unsubscribe());
      escuchas.abort();
      clearInterval(temporizador);
      this.iniciado = false;
    };
  }

  private revisar(): void {
    void this.buscar();
    void this.ofrecer();
  }

  private async buscar(): Promise<void> {
    try {
      await this.serviceWorker.checkForUpdate();
    } catch {
      // Sin conexión o con el servidor caído no hay nada que hacer ni que decirle a la persona: se intenta de nuevo en la próxima revisión.
    }
  }

  private async ofrecer(): Promise<void> {
    if (!this.hayVersionLista || this.preguntando) {
      return;
    }
    this.preguntando = true;
    try {
      const acepta = await this.notificador.confirmar(
        'Hay una versión nueva de CundiApp',
        'Actualiza para ver los últimos cambios. Si estás armando tu horario con una oferta subida, al actualizar tendrás que subirla de nuevo.',
        'Actualizar ahora',
        'Después',
      );
      if (acepta) {
        await this.actualizar();
      }
    } finally {
      this.preguntando = false;
    }
  }

  private async actualizar(): Promise<void> {
    try {
      await this.activarSinEsperarParaSiempre();
    } catch {
      await this.notificador.problema('No pudimos actualizar', 'Cierra la aplicación y vuelve a abrirla para ver la versión nueva.');
      return;
    }
    this.dejarMarcaDeActualizada();
    this.recargar();
  }

  /**
   * Activa la versión nueva, pero si el service worker no contesta en unos segundos sigue de todos modos: la versión ya está
   * descargada y una recarga la toma, así que aceptar nunca queda sin efecto.
   */
  private async activarSinEsperarParaSiempre(): Promise<void> {
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const sinRespuesta = new Promise<void>((resolver) => {
      temporizador = setTimeout(resolver, ESPERA_DE_LA_ACTIVACION_EN_MS);
    });
    try {
      await Promise.race([this.serviceWorker.activateUpdate(), sinRespuesta]);
    } finally {
      clearTimeout(temporizador);
    }
  }

  private dejarMarcaDeActualizada(): void {
    try {
      sessionStorage.setItem(MARCA_DE_ACTUALIZADA, '1');
    } catch {
      // Sin almacenamiento de sesión solo se pierde el aviso de «ya está actualizada»; la actualización sigue.
    }
  }

  /** La aplicación acaba de recargarse por una actualización aceptada: lo confirma una sola vez. */
  private confirmarSiVieneDeActualizar(): void {
    try {
      if (sessionStorage.getItem(MARCA_DE_ACTUALIZADA) === null) {
        return;
      }
      sessionStorage.removeItem(MARCA_DE_ACTUALIZADA);
    } catch {
      return;
    }
    void this.notificador.aviso('Listo, ya tienes la versión nueva de CundiApp.');
  }

  /** El service worker quedó con archivos dañados o incompletos: sin recargar la aplicación no se arregla. */
  private async recargarPorFalla(): Promise<void> {
    await this.notificador.informar(
      'La aplicación necesita recargarse',
      'Algo de lo guardado en tu dispositivo quedó desactualizado. La recargamos para que siga funcionando.',
    );
    this.recargar();
  }
}

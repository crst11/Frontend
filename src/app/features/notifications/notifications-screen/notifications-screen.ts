import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import { AvisosSinLeer } from '../../../core/notifications/avisos-sin-leer.service';
import { AvisosPush } from '../../../core/push/avisos-push.service';
import { Aviso, AvisoRepository } from '../../../data-access/aviso.repository';
import { IosInstallGuide } from '../../../shared/ios-install-guide/ios-install-guide';

const SIN_CONEXION =
  'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.';

const FORMATO_DE_AVISO = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * Mis avisos (RF10, SCRUM-37): la campana de la aplicación y el lugar donde se activan los avisos en este
 * dispositivo.
 *
 * <p>Todo aviso se ve aquí, haya llegado o no al dispositivo: el Web Push es un extra. El texto de cada
 * aviso llega escrito por el servidor; la pantalla solo lo muestra y deja marcarlo como leído.
 */
@Component({
  selector: 'app-notifications-screen',
  imports: [RouterLink, IosInstallGuide],
  templateUrl: './notifications-screen.html',
  styleUrl: './notifications-screen.css',
})
export class NotificationsScreen {
  private readonly repositorio = inject(AvisoRepository);
  private readonly notificador = inject(NotifierService);
  private readonly sinLeerGlobal = inject(AvisosSinLeer);
  protected readonly push = inject(AvisosPush);

  protected readonly avisos = signal<Aviso[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly ocupado = signal(false);

  protected readonly sinLeer = computed(() => this.avisos().filter((a) => !a.leido).length);

  constructor() {
    this.cargar();
    void this.push.comprobar();
  }

  protected reintentar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.cargar();
  }

  protected activar(): void {
    void this.push.activar();
  }

  protected reintentarLosAvisosDelDispositivo(): void {
    void this.push.comprobar();
  }

  protected alternar(aviso: Aviso): void {
    this.ocupado.set(true);
    this.repositorio.marcar(aviso.id, !aviso.leido).subscribe({
      next: () => this.alCambiar(),
      error: (err: HttpErrorResponse) => this.mostrarFalla(err),
    });
  }

  protected marcarTodos(): void {
    this.ocupado.set(true);
    this.repositorio.marcarTodos().subscribe({
      next: () => this.alCambiar(),
      error: (err: HttpErrorResponse) => this.mostrarFalla(err),
    });
  }

  protected fecha(aviso: Aviso): string {
    return FORMATO_DE_AVISO.format(new Date(aviso.fecha));
  }

  /** A dónde lleva cada aviso: el pendiente que vence o se venció, o la Brújula en la que cambió el riesgo. */
  protected destino(aviso: Aviso): { ruta: string; texto: string } {
    return aviso.tipo === 'cambio_riesgo'
      ? { ruta: '/brujula', texto: 'Ver mi Brújula' }
      : { ruta: '/pendientes', texto: 'Ver mis pendientes' };
  }

  private alCambiar(): void {
    this.ocupado.set(false);
    this.cargar();
  }

  private cargar(): void {
    this.repositorio.misAvisos().subscribe({
      next: (respuesta) => {
        this.avisos.set(respuesta.avisos);
        this.sinLeerGlobal.fijar(respuesta.sinLeer);
        this.error.set(null);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        // Si ya había avisos en pantalla se dejan: un tropiezo al volver a pedirlos no debe borrarlos.
        if (this.avisos().length === 0) {
          this.error.set('No pudimos traer tus avisos. Intenta de nuevo en un momento.');
        }
        if (esFalloDelServidor(err)) {
          void this.notificador.problema('No pudimos traer tus avisos', SIN_CONEXION);
        }
      },
    });
  }

  private mostrarFalla(err: HttpErrorResponse): void {
    this.ocupado.set(false);
    if (esFalloDelServidor(err)) {
      void this.notificador.problema('No pudimos actualizar tus avisos', SIN_CONEXION);
      return;
    }
    this.error.set(err.error?.detail ?? 'No pudimos actualizar tus avisos.');
  }
}

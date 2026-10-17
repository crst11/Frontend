import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import { DispositivoConAvisos, DispositivoRepository } from '../../../data-access/dispositivo.repository';
import {
  PreferenciasDeAvisos,
  PreferenciasDeAvisosRepository,
} from '../../../data-access/preferencias-de-avisos.repository';

const SIN_CONEXION =
  'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.';

const FORMATO_DE_FECHA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * Configurar mis avisos (RF10, SCRUM-38): qué avisos recibo, con cuánta anticipación y en qué dispositivos.
 *
 * <p>Aquí no se decide nada: los interruptores y las horas se guardan tal cual y el servidor dice si son
 * válidos (la anticipación va de 1 a 168 horas). El interruptor general manda sobre los otros dos, y la
 * pantalla lo muestra apagando los demás en vez de esconderlos.
 */
@Component({
  selector: 'app-notification-settings',
  imports: [RouterLink],
  templateUrl: './notification-settings.html',
  styleUrl: './notification-settings.css',
})
export class NotificationSettings {
  private readonly preferencias = inject(PreferenciasDeAvisosRepository);
  private readonly repositorioDeDispositivos = inject(DispositivoRepository);
  private readonly notificador = inject(NotifierService);

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly activos = signal(true);
  protected readonly vencimientos = signal(true);
  protected readonly cambioDeRiesgo = signal(true);
  /** Lo que la persona escribió en las horas, tal cual, mientras decide. */
  protected readonly horasTexto = signal('24');
  protected readonly guardando = signal(false);
  protected readonly errorDeHoras = signal<string | null>(null);

  protected readonly dispositivos = signal<DispositivoConAvisos[]>([]);
  protected readonly errorDeDispositivos = signal<string | null>(null);
  protected readonly quitando = signal(false);

  constructor() {
    this.cargarPreferencias();
    this.cargarDispositivos();
  }

  protected reintentar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.cargarPreferencias();
    this.cargarDispositivos();
  }

  protected guardar(): void {
    const texto = this.horasTexto().trim();
    if (!/^\d+$/.test(texto)) {
      this.errorDeHoras.set('Escribe las horas como un número entero, por ejemplo 24.');
      return;
    }
    this.errorDeHoras.set(null);
    this.guardando.set(true);
    this.preferencias
      .cambiar({
        activos: this.activos(),
        vencimientos: this.vencimientos(),
        cambioDeRiesgo: this.cambioDeRiesgo(),
        anticipacionEnHoras: Number(texto),
      })
      .subscribe({
        next: (guardadas) => {
          this.guardando.set(false);
          this.mostrar(guardadas);
          void this.notificador.aviso('Guardamos tus preferencias de avisos.');
        },
        error: (err: HttpErrorResponse) => {
          this.guardando.set(false);
          if (esFalloDelServidor(err)) {
            void this.notificador.problema('No pudimos guardar tus preferencias', SIN_CONEXION);
            return;
          }
          this.errorDeHoras.set(err.error?.detail ?? 'No pudimos guardar tus preferencias. Revisa los valores.');
        },
      });
  }

  protected async quitar(dispositivo: DispositivoConAvisos): Promise<void> {
    const confirmado = await this.notificador.confirmar(
      '¿Quitar este dispositivo?',
      `Dejaremos de mandar avisos a «${dispositivo.nombre}». Podrás activarlos de nuevo desde él cuando quieras.`,
      'Quitar dispositivo',
    );
    if (!confirmado) {
      return;
    }
    this.quitando.set(true);
    this.errorDeDispositivos.set(null);
    this.repositorioDeDispositivos.quitar(dispositivo.consecutivo).subscribe({
      next: () => {
        this.quitando.set(false);
        this.cargarDispositivos();
      },
      error: (err: HttpErrorResponse) => {
        this.quitando.set(false);
        if (esFalloDelServidor(err)) {
          void this.notificador.problema('No pudimos quitar el dispositivo', SIN_CONEXION);
          return;
        }
        this.errorDeDispositivos.set(err.error?.detail ?? 'No pudimos quitar el dispositivo.');
        this.cargarDispositivos();
      },
    });
  }

  protected desde(dispositivo: DispositivoConAvisos): string | null {
    return dispositivo.fechaSincronizacion === null
      ? null
      : FORMATO_DE_FECHA.format(new Date(dispositivo.fechaSincronizacion));
  }

  private mostrar(preferencias: PreferenciasDeAvisos): void {
    this.activos.set(preferencias.activos);
    this.vencimientos.set(preferencias.vencimientos);
    this.cambioDeRiesgo.set(preferencias.cambioDeRiesgo);
    this.horasTexto.set(String(preferencias.anticipacionEnHoras));
  }

  private cargarPreferencias(): void {
    this.preferencias.mias().subscribe({
      next: (mias) => {
        this.mostrar(mias);
        this.error.set(null);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set('No pudimos traer tus preferencias de avisos. Intenta de nuevo en un momento.');
        if (esFalloDelServidor(err)) {
          void this.notificador.problema('No pudimos traer tus preferencias', SIN_CONEXION);
        }
      },
    });
  }

  private cargarDispositivos(): void {
    this.repositorioDeDispositivos.misDispositivos().subscribe({
      next: (lista) => this.dispositivos.set(lista),
      error: () => this.errorDeDispositivos.set('No pudimos traer tus dispositivos. Intenta de nuevo en un momento.'),
    });
  }
}

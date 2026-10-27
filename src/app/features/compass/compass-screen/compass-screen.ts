import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import { Brujula, BrujulaRepository, NivelDeRiesgo } from '../../../data-access/brujula.repository';
import { leerNumero } from '../../../shared/leer-numero';
import { Cargando } from '../../../shared/cargando/cargando';

const SIN_CONEXION =
  'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.';

/** El nivel escrito: nunca se comunica solo con un color. */
const ETIQUETAS: Record<NivelDeRiesgo, string> = {
  alto: 'Riesgo alto',
  medio: 'Riesgo medio',
  bajo: 'Riesgo bajo',
  sin_datos: 'Sin datos',
};

/**
 * La Brújula Académica (RF09, SCRUM-35 y SCRUM-36): qué tan comprometida está cada asignatura que se
 * cursa ahora, y por qué.
 *
 * <p>Aquí no se calcula nada. El nivel, el motivo y la frase que lo explica llegan del servidor, que
 * ya los ordenó de lo más urgente a lo menos. Los umbrales se ajustan aquí mismo: al guardarlos se
 * vuelve a pedir la Brújula, que el servidor recalcula con los nuevos.
 */
@Component({
  selector: 'app-compass-screen',
  imports: [Cargando, DecimalPipe, RouterLink],
  templateUrl: './compass-screen.html',
  styleUrl: './compass-screen.css',
})
export class CompassScreen {
  private readonly repositorio = inject(BrujulaRepository);
  private readonly notificador = inject(NotifierService);

  protected readonly brujula = signal<Brujula | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  /** Lo que la persona escribió en los umbrales, tal cual, mientras decide. */
  protected readonly medioTexto = signal('');
  protected readonly altoTexto = signal('');
  protected readonly guardando = signal(false);
  protected readonly errorDeUmbrales = signal<string | null>(null);

  constructor() {
    this.cargar();
  }

  protected etiqueta(nivel: NivelDeRiesgo): string {
    return ETIQUETAS[nivel];
  }

  protected reintentar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.cargar();
  }

  protected guardarUmbrales(): void {
    const medio = leerNumero(this.medioTexto());
    const alto = leerNumero(this.altoTexto());
    if (medio === null || alto === null || Number.isNaN(medio) || Number.isNaN(alto)) {
      this.errorDeUmbrales.set('Escribe los dos umbrales como número, por ejemplo 3.5 y 4.5.');
      return;
    }
    this.errorDeUmbrales.set(null);
    this.guardando.set(true);
    this.repositorio.cambiarUmbrales({ medio, alto }).subscribe({
      next: () => {
        this.guardando.set(false);
        void this.notificador.aviso('Guardamos tus umbrales.');
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        if (esFalloDelServidor(err)) {
          void this.notificador.problema('No pudimos guardar tus umbrales', SIN_CONEXION);
          return;
        }
        this.errorDeUmbrales.set(err.error?.detail ?? 'No pudimos guardar tus umbrales. Revisa los valores.');
      },
    });
  }

  private cargar(): void {
    this.repositorio.miBrujula().subscribe({
      next: (brujula) => {
        this.brujula.set(brujula);
        this.medioTexto.set(String(brujula.umbrales.medio));
        this.altoTexto.set(String(brujula.umbrales.alto));
        this.error.set(null);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        // Si ya había algo en pantalla se deja: un tropiezo al recalcular no debe borrarla.
        if (this.brujula() === null) {
          this.error.set('No pudimos traer tu Brújula. Intenta de nuevo en un momento.');
        }
        if (esFalloDelServidor(err)) {
          void this.notificador.problema('No pudimos traer tu Brújula', SIN_CONEXION);
        }
      },
    });
  }
}

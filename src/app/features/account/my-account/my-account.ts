import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import { GoogleIdentityService } from '../../../core/google/google-identity.service';
import { SessionService } from '../../../core/session/session.service';
import { Cuenta, EstudianteRepository, VinculoConGoogle } from '../../../data-access/estudiante.repository';

/** Pantalla protegida: pide al backend los datos de la cuenta con el token; el estudiante sale del token. */
@Component({
  selector: 'app-my-account',
  imports: [],
  templateUrl: './my-account.html',
  styleUrl: './my-account.css',
})
export class MyAccount {
  private readonly repositorio = inject(EstudianteRepository);
  private readonly sesion = inject(SessionService);
  private readonly router = inject(Router);
  private readonly notificador = inject(NotifierService);
  private readonly contenedorGoogle = viewChild<ElementRef<HTMLElement>>('botonGoogle');
  protected readonly google = inject(GoogleIdentityService);

  protected readonly cuenta = signal<Cuenta | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal(false);
  protected readonly vinculo = signal<VinculoConGoogle | null>(null);

  constructor() {
    this.repositorio.miCuenta().subscribe({
      next: (cuenta) => {
        this.cuenta.set(cuenta);
        this.cargando.set(false);
      },
      error: (err: { status?: number }) => {
        this.error.set(true);
        this.cargando.set(false);
        if (esFalloDelServidor(err)) {
          void this.notificador.problema(
            'No pudimos cargar tu cuenta',
            'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.',
          );
        }
      },
    });

    if (this.google.disponible) {
      // Si esto falla, la sección de Google simplemente no aparece: el resto de la cuenta sigue igual.
      this.repositorio.vinculoConGoogle().subscribe({ next: (vinculo) => this.vinculo.set(vinculo), error: () => undefined });
    }

    // El contenedor del botón aparece cuando la cuenta no tiene Google; también después de quitarlo.
    effect(() => {
      const contenedor = this.contenedorGoogle()?.nativeElement;
      if (contenedor) {
        this.google
          .dibujarBoton(contenedor, 'continue_with', (idToken) => this.vincularGoogle(idToken))
          .catch(() => undefined);
      }
    });
  }

  protected primerNombre(nombres: string): string {
    return nombres.trim().split(/\s+/)[0] ?? '';
  }

  /** El correo se muestra en dos partes para que, si no cabe, se parta en la @ y no a mitad de palabra. */
  protected usuarioDelCorreo(correo: string): string {
    return correo.slice(0, correo.indexOf('@'));
  }

  protected dominioDelCorreo(correo: string): string {
    return correo.slice(correo.indexOf('@'));
  }

  protected iniciales(nombres: string, apellidos: string): string {
    return ((nombres.trim()[0] ?? '') + (apellidos.trim()[0] ?? '')).toUpperCase();
  }

  protected vincularGoogle(idToken: string): void {
    this.repositorio.vincularGoogle(idToken).subscribe({
      next: (vinculo) => {
        this.vinculo.set(vinculo);
        void this.notificador.aviso('Cuenta de Google vinculada. Ya puedes entrar con un toque.');
      },
      error: (err: HttpErrorResponse) => {
        if (esFalloDelServidor(err)) {
          void this.notificador.problema(
            'No pudimos vincular Google',
            err.error?.detail ?? 'No logramos comunicarnos con el servidor. Intenta de nuevo en unos minutos.',
          );
          return;
        }
        // 409 (esa cuenta de Google ya está en uso) o 422: el servidor explica qué hacer.
        void this.notificador.informar(
          'No pudimos vincular Google',
          err.error?.detail ?? 'Intenta de nuevo con otra cuenta de Google.',
        );
      },
    });
  }

  protected async quitarGoogle(): Promise<void> {
    const confirmado = await this.notificador.confirmar(
      '¿Quitar el inicio con Google?',
      'Podrás seguir entrando con tu correo institucional y tu contraseña.',
      'Quitar Google',
    );
    if (!confirmado) {
      return;
    }

    this.repositorio.desvincularGoogle().subscribe({
      next: () => {
        this.vinculo.set({ vinculada: false, correo: null, fechaVinculacion: null });
        void this.notificador.aviso('Se quitó el inicio con Google.');
      },
      error: () =>
        void this.notificador.problema(
          'No pudimos quitar Google',
          'No logramos comunicarnos con el servidor. Intenta de nuevo en unos minutos.',
        ),
    });
  }

  protected async cerrarSesion(): Promise<void> {
    const confirmado = await this.notificador.confirmar(
      '¿Cerrar sesión?',
      'Tendrás que iniciar sesión de nuevo para ver tu cuenta.',
      'Cerrar sesión',
    );
    if (!confirmado) {
      return;
    }

    const irAEntrar = () => {
      void this.router.navigate(['/cuenta/entrar']);
      void this.notificador.aviso('Sesión cerrada.');
    };
    this.sesion.cerrar().subscribe({ next: irAEntrar, error: irAEntrar });
  }
}

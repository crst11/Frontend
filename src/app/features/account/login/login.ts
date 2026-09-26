import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import { GoogleIdentityService } from '../../../core/google/google-identity.service';
import { SessionService } from '../../../core/session/session.service';
import { PasswordInput } from '../../../shared/password-input/password-input';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, PasswordInput],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly sesion = inject(SessionService);
  private readonly notificador = inject(NotifierService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly contenedorGoogle = viewChild<ElementRef<HTMLElement>>('botonGoogle');
  protected readonly google = inject(GoogleIdentityService);

  protected readonly formulario = this.fb.nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
    contrasena: ['', Validators.required],
  });

  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly cuentaPendiente = signal(false);
  protected readonly googleSinCargar = signal(false);

  constructor() {
    // El botón lo dibuja Google dentro de su contenedor, cuando ya existe en la página.
    afterNextRender(() => {
      const contenedor = this.contenedorGoogle()?.nativeElement;
      if (contenedor) {
        this.google
          .dibujarBoton(contenedor, 'continue_with', (idToken) => this.entrarConGoogle(idToken))
          .catch(() => this.googleSinCargar.set(true));
      }
    });
  }

  entrar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const { correo, contrasena } = this.formulario.getRawValue();
    this.enviando.set(true);
    this.error.set(null);
    this.cuentaPendiente.set(false);
    this.sesion.iniciar(correo, contrasena).subscribe({
      next: () => this.alEntrar(),
      error: (err: HttpErrorResponse) => {
        this.enviando.set(false);
        if (esFalloDelServidor(err)) {
          void this.notificador.problema(
            'No pudimos iniciar sesión',
            'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.',
          );
          return;
        }
        this.cuentaPendiente.set(err.status === 403 && (err.error?.detail ?? '').includes('Verifica tu correo'));
        this.error.set(err.error?.detail ?? 'No se pudo iniciar sesión. Intenta de nuevo.');
      },
    });
  }

  protected entrarConGoogle(idToken: string): void {
    this.enviando.set(true);
    this.error.set(null);
    this.cuentaPendiente.set(false);
    this.sesion.iniciarConGoogle(idToken).subscribe({
      next: () => this.alEntrar(),
      error: (err: HttpErrorResponse) => {
        this.enviando.set(false);
        if (err.status === 404 && err.error?.title === 'Google no vinculado') {
          // No es un error de la persona: le falta un paso, y el mensaje del servidor le dice cuál.
          void this.notificador.informar('Tu cuenta de Google aún no está vinculada', err.error.detail);
          return;
        }
        if (esFalloDelServidor(err)) {
          void this.notificador.problema(
            'No pudimos iniciar sesión con Google',
            err.error?.detail ?? 'No logramos comunicarnos con el servidor. Intenta de nuevo en unos minutos.',
          );
          return;
        }
        this.error.set(err.error?.detail ?? 'No se pudo iniciar sesión con Google. Intenta de nuevo.');
      },
    });
  }

  protected correoEscrito(): string {
    return this.formulario.controls.correo.value;
  }

  private alEntrar(): void {
    this.enviando.set(false);
    void this.router.navigate(['/cuenta/mi-cuenta']);
    void this.notificador.aviso('Sesión iniciada.');
  }
}

import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
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

  protected readonly formulario = this.fb.nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
    contrasena: ['', Validators.required],
  });

  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly cuentaPendiente = signal(false);

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
      next: () => {
        this.enviando.set(false);
        void this.router.navigate(['/cuenta/mi-cuenta']);
        void this.notificador.aviso('Sesión iniciada.');
      },
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

  protected correoEscrito(): string {
    return this.formulario.controls.correo.value;
  }
}

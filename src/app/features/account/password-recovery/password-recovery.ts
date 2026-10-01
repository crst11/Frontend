import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import { EstudianteRepository } from '../../../data-access/estudiante.repository';
import { InstitutionalEmailInput } from '../../../shared/institutional-email-input/institutional-email-input';

/**
 * Pide el código para cambiar la contraseña (SCRUM-68).
 *
 * <p>El backend responde igual exista o no la cuenta, así que esta pantalla también: decir "ese correo
 * no está registrado" dejaría averiguar quién tiene cuenta probando correos uno por uno.
 */
@Component({
  selector: 'app-password-recovery',
  imports: [ReactiveFormsModule, RouterLink, InstitutionalEmailInput],
  templateUrl: './password-recovery.html',
  styleUrl: './password-recovery.css',
})
export class PasswordRecovery {
  private readonly repositorio = inject(EstudianteRepository);
  private readonly notificador = inject(NotifierService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected readonly formulario = this.fb.nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
  });

  protected readonly enviando = signal(false);

  protected invalido(): boolean {
    const control = this.formulario.controls.correo;
    return control.invalid && control.touched;
  }

  enviar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const { correo } = this.formulario.getRawValue();
    this.enviando.set(true);
    this.repositorio.solicitarRecuperacion(correo).subscribe({
      next: () => {
        this.enviando.set(false);
        void this.router.navigate(['/cuenta/nueva-contrasena'], { queryParams: { correo } });
        void this.notificador.aviso('Si ese correo tiene una cuenta, te llegará un código en unos segundos.');
      },
      error: (err: HttpErrorResponse) => {
        this.enviando.set(false);
        if (esFalloDelServidor(err)) {
          void this.notificador.problema(
            'No pudimos enviar el código',
            'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.',
          );
          return;
        }
        void this.notificador.problema(
          'No pudimos enviar el código',
          err.error?.detail ?? 'Intenta de nuevo en unos minutos.',
        );
      },
    });
  }
}

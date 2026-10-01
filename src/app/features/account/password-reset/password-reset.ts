import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import { EstudianteRepository } from '../../../data-access/estudiante.repository';
import { InstitutionalEmailInput } from '../../../shared/institutional-email-input/institutional-email-input';
import { PasswordInput } from '../../../shared/password-input/password-input';
import { contrasenaDistintaDelCorreo, contrasenaSegura } from '../../../shared/password-policy/password-policy';
import { PasswordRequirements } from '../../../shared/password-policy/password-requirements';

/** Confirmar la contraseña es solo una ayuda de la interfaz: el backend nunca la recibe. */
function contrasenasIguales(grupo: AbstractControl): ValidationErrors | null {
  const contrasena = grupo.get('contrasena')?.value;
  const confirmacion = grupo.get('confirmacion')?.value;
  return confirmacion && contrasena !== confirmacion ? { contrasenasDistintas: true } : null;
}

/** Define la contraseña nueva con el código que llegó al correo (SCRUM-68). */
@Component({
  selector: 'app-password-reset',
  imports: [ReactiveFormsModule, RouterLink, InstitutionalEmailInput, PasswordInput, PasswordRequirements],
  templateUrl: './password-reset.html',
  styleUrl: './password-reset.css',
})
export class PasswordReset {
  private readonly repositorio = inject(EstudianteRepository);
  private readonly notificador = inject(NotifierService);
  private readonly fb = inject(FormBuilder);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** El correo llega de la pantalla anterior; si alguien abre esta directamente, lo escribe. */
  protected readonly correoRecibido = this.ruta.snapshot.queryParamMap.get('correo') ?? '';

  protected readonly formulario = this.fb.nonNullable.group(
    {
      correo: [this.correoRecibido, [Validators.required, Validators.email]],
      codigo: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      contrasena: ['', [Validators.required, contrasenaSegura]],
      confirmacion: ['', Validators.required],
    },
    { validators: [contrasenasIguales, contrasenaDistintaDelCorreo] },
  );

  protected readonly contrasenaEscrita = toSignal(this.formulario.controls.contrasena.valueChanges, {
    initialValue: '',
  });

  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected invalido(campo: 'correo' | 'codigo'): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && control.touched;
  }

  protected confirmacionDistinta(): boolean {
    return this.formulario.hasError('contrasenasDistintas') && this.formulario.controls.confirmacion.touched;
  }

  protected contrasenaConElCorreo(): boolean {
    return this.formulario.hasError('contrasenaConElCorreo') && this.formulario.controls.contrasena.touched;
  }

  enviar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const { correo, codigo, contrasena } = this.formulario.getRawValue();
    this.enviando.set(true);
    this.error.set(null);
    this.repositorio.restablecerContrasena(correo, codigo, contrasena).subscribe({
      next: () => {
        this.enviando.set(false);
        void this.router.navigate(['/cuenta/entrar']);
        void this.notificador.aviso('Tu contraseña quedó cambiada. Inicia sesión con la nueva.');
      },
      error: (err: HttpErrorResponse) => {
        this.enviando.set(false);
        if (esFalloDelServidor(err)) {
          void this.notificador.problema(
            'No pudimos cambiar tu contraseña',
            'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.',
          );
          return;
        }
        this.error.set(err.error?.detail ?? 'No se pudo cambiar la contraseña. Intenta de nuevo.');
      },
    });
  }
}

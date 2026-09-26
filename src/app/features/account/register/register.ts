import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import { EstudianteRepository } from '../../../data-access/estudiante.repository';
import { PasswordInput } from '../../../shared/password-input/password-input';

/** Confirmar la contraseña es solo una ayuda de la interfaz: el backend nunca la recibe. */
function contrasenasIguales(grupo: AbstractControl): ValidationErrors | null {
  const contrasena = grupo.get('contrasena')?.value;
  const confirmacion = grupo.get('confirmacion')?.value;
  return confirmacion && contrasena !== confirmacion ? { contrasenasDistintas: true } : null;
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, PasswordInput],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  private readonly repositorio = inject(EstudianteRepository);
  private readonly notificador = inject(NotifierService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected readonly formulario = this.fb.nonNullable.group(
    {
      nombres: ['', Validators.required],
      apellidos: ['', Validators.required],
      correo: ['', [Validators.required, Validators.email]],
      contrasena: ['', [Validators.required, Validators.minLength(8)]],
      confirmacion: ['', Validators.required],
      aceptaTratamientoDatos: [false, Validators.requiredTrue],
    },
    { validators: contrasenasIguales },
  );

  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected invalido(campo: keyof typeof this.formulario.controls): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && control.touched;
  }

  protected confirmacionDistinta(): boolean {
    return this.formulario.hasError('contrasenasDistintas') && this.formulario.controls.confirmacion.touched;
  }

  enviar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const { nombres, apellidos, correo, contrasena, aceptaTratamientoDatos } = this.formulario.getRawValue();
    this.enviando.set(true);
    this.error.set(null);
    this.repositorio.registrar({ nombres, apellidos, correo, contrasena, aceptaTratamientoDatos }).subscribe({
      next: (cuenta) => {
        this.enviando.set(false);
        void this.router.navigate(['/cuenta/verificacion'], { queryParams: { correo: cuenta.correo } });
        void this.notificador.aviso('Cuenta creada. Ahora verifica tu correo.');
      },
      error: (err: HttpErrorResponse) => {
        this.enviando.set(false);
        if (esFalloDelServidor(err)) {
          void this.notificador.problema(
            'No pudimos crear tu cuenta',
            'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.',
          );
          return;
        }
        this.error.set(err.error?.detail ?? 'No se pudo completar el registro. Intenta de nuevo.');
      },
    });
  }
}

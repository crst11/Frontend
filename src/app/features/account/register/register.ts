import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { EstudianteRepository } from '../../../data-access/estudiante.repository';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  private readonly repositorio = inject(EstudianteRepository);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected readonly formulario = this.fb.nonNullable.group({
    nombres: ['', Validators.required],
    apellidos: ['', Validators.required],
    correo: ['', [Validators.required, Validators.email]],
    contrasena: ['', [Validators.required, Validators.minLength(8)]],
    aceptaTratamientoDatos: [false, Validators.requiredTrue],
  });

  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  enviar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.error.set(null);
    this.repositorio.registrar(this.formulario.getRawValue()).subscribe({
      next: (cuenta) => {
        this.enviando.set(false);
        void this.router.navigate(['/cuenta/verificacion'], { queryParams: { correo: cuenta.correo } });
      },
      error: (err: HttpErrorResponse) => {
        this.enviando.set(false);
        this.error.set(err.error?.detail ?? 'No se pudo completar el registro. Intenta de nuevo.');
      },
    });
  }
}

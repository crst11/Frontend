import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EstudianteRepository } from '../../../data-access/estudiante.repository';

@Component({
  selector: 'app-verificacion',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './verificacion.html',
  styleUrl: './verificacion.css',
})
export class Verificacion {
  private readonly repositorio = inject(EstudianteRepository);
  private readonly fb = inject(FormBuilder);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly formulario = this.fb.nonNullable.group({
    correo: [this.ruta.snapshot.queryParamMap.get('correo') ?? '', [Validators.required, Validators.email]],
    codigo: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly verificada = signal(false);

  verificar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const { correo, codigo } = this.formulario.getRawValue();
    this.enviando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    this.repositorio.verificarCorreo(correo, codigo).subscribe({
      next: () => {
        this.enviando.set(false);
        this.verificada.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.enviando.set(false);
        this.error.set(err.error?.detail ?? 'No se pudo verificar el código. Intenta de nuevo.');
      },
    });
  }

  reenviar(): void {
    const correo = this.formulario.controls.correo;
    if (correo.invalid) {
      correo.markAsTouched();
      return;
    }

    this.error.set(null);
    this.aviso.set(null);
    this.repositorio.reenviarCodigo(correo.value).subscribe({
      next: () => this.aviso.set('Si tu cuenta está pendiente de verificar, te enviamos un código nuevo.'),
      error: (err: HttpErrorResponse) =>
        this.error.set(err.error?.detail ?? 'No se pudo enviar el código. Intenta de nuevo.'),
    });
  }
}

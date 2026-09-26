import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, computed, inject, signal, viewChildren } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import { EstudianteRepository } from '../../../data-access/estudiante.repository';

const LARGO_CODIGO = 6;

@Component({
  selector: 'app-verification',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './verification.html',
  styleUrl: './verification.css',
})
export class Verification {
  private readonly repositorio = inject(EstudianteRepository);
  private readonly fb = inject(FormBuilder);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notificador = inject(NotifierService);
  private readonly casillas = viewChildren<ElementRef<HTMLInputElement>>('casilla');

  /** El correo llega desde el registro; si alguien abre la pantalla directamente, lo escribe. */
  protected readonly correoDelRegistro = this.ruta.snapshot.queryParamMap.get('correo') ?? '';
  protected readonly formulario = this.fb.nonNullable.group({
    correo: [this.correoDelRegistro, [Validators.required, Validators.email]],
  });

  protected readonly posiciones = Array.from({ length: LARGO_CODIGO }, (_, i) => i);
  protected readonly digitos = signal<string[]>(Array(LARGO_CODIGO).fill(''));
  protected readonly codigoCompleto = computed(() => this.digitos().every((d) => d !== ''));

  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly verificada = signal(false);

  protected escribir(posicion: number, evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const soloNumeros = campo.value.replace(/\D/g, '');
    if (soloNumeros.length > 1) {
      this.repartir(soloNumeros, posicion);
      return;
    }
    this.fijar(posicion, soloNumeros);
    campo.value = soloNumeros;
    if (soloNumeros && posicion < LARGO_CODIGO - 1) {
      this.enfocar(posicion + 1);
    }
  }

  protected retroceder(posicion: number, evento: KeyboardEvent): void {
    if (evento.key === 'Backspace' && !this.digitos()[posicion] && posicion > 0) {
      this.fijar(posicion - 1, '');
      this.enfocar(posicion - 1);
    }
  }

  protected pegar(posicion: number, evento: ClipboardEvent): void {
    evento.preventDefault();
    this.repartir((evento.clipboardData?.getData('text') ?? '').replace(/\D/g, ''), posicion);
  }

  verificar(): void {
    if (this.formulario.invalid || !this.codigoCompleto()) {
      this.formulario.markAllAsTouched();
      this.error.set('Escribe los 6 dígitos del código.');
      return;
    }

    this.enviando.set(true);
    this.error.set(null);
    this.repositorio.verificarCorreo(this.formulario.controls.correo.value, this.digitos().join('')).subscribe({
      next: () => {
        this.enviando.set(false);
        this.verificada.set(true);
        void this.notificador
          .exito('¡Correo verificado!', 'Tu cuenta quedó activa. Ya puedes iniciar sesión.', 'Iniciar sesión')
          .then(() => this.router.navigate(['/cuenta/entrar']));
      },
      error: (err: HttpErrorResponse) => {
        this.enviando.set(false);
        if (esFalloDelServidor(err)) {
          this.avisarFalloDelServidor('No pudimos verificar tu código');
          return;
        }
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
    this.repositorio.reenviarCodigo(correo.value).subscribe({
      next: () => void this.notificador.aviso('Si tu cuenta está pendiente de verificar, te enviamos un código nuevo.'),
      error: (err: HttpErrorResponse) => {
        if (esFalloDelServidor(err)) {
          this.avisarFalloDelServidor('No pudimos enviar el código');
          return;
        }
        this.error.set(err.error?.detail ?? 'No se pudo enviar el código. Intenta de nuevo.');
      },
    });
  }

  private avisarFalloDelServidor(titulo: string): void {
    void this.notificador.problema(
      titulo,
      'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.',
    );
  }

  private repartir(numeros: string, desde: number): void {
    const nuevos = [...this.digitos()];
    let ultima = desde;
    for (let i = 0; i < numeros.length && desde + i < LARGO_CODIGO; i++) {
      nuevos[desde + i] = numeros[i];
      ultima = desde + i;
    }
    this.digitos.set(nuevos);
    this.casillas().forEach((c, i) => (c.nativeElement.value = nuevos[i]));
    this.enfocar(Math.min(ultima + 1, LARGO_CODIGO - 1));
  }

  private fijar(posicion: number, valor: string): void {
    this.digitos.update((actuales) => actuales.map((d, i) => (i === posicion ? valor : d)));
    const casilla = this.casillas()[posicion];
    if (casilla) {
      casilla.nativeElement.value = valor;
    }
  }

  private enfocar(posicion: number): void {
    this.casillas()[posicion]?.nativeElement.focus();
  }
}

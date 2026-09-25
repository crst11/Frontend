import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ServicioDeSesion } from '../../../core/sesion/servicio-de-sesion';
import { Cuenta, EstudianteRepository } from '../../../data-access/estudiante.repository';

/** Pantalla protegida: pide al backend los datos de la cuenta con el token; el estudiante sale del token. */
@Component({
  selector: 'app-mi-cuenta',
  imports: [],
  templateUrl: './mi-cuenta.html',
  styleUrl: './mi-cuenta.css',
})
export class MiCuenta {
  private readonly repositorio = inject(EstudianteRepository);
  private readonly sesion = inject(ServicioDeSesion);
  private readonly router = inject(Router);

  protected readonly cuenta = signal<Cuenta | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal(false);

  constructor() {
    this.repositorio.miCuenta().subscribe({
      next: (cuenta) => {
        this.cuenta.set(cuenta);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      },
    });
  }

  protected cerrarSesion(): void {
    const irAEntrar = () => void this.router.navigate(['/cuenta/entrar']);
    this.sesion.cerrar().subscribe({ next: irAEntrar, error: irAEntrar });
  }
}

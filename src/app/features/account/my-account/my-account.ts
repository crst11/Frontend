import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { SessionService } from '../../../core/session/session.service';
import { Cuenta, EstudianteRepository } from '../../../data-access/estudiante.repository';

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

  protected async cerrarSesion(): Promise<void> {
    const confirmado = await this.notificador.confirmar(
      '¿Cerrar sesión?',
      'Tendrás que iniciar sesión de nuevo para ver tu cuenta.',
      'Cerrar sesión',
    );
    if (!confirmado) {
      return;
    }

    const irAEntrar = () => void this.router.navigate(['/cuenta/entrar']);
    this.sesion.cerrar().subscribe({ next: irAEntrar, error: irAEntrar });
  }
}

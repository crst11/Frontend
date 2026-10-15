import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NotifierService } from '../feedback/notifier.service';
import { SessionService } from './session.service';

/**
 * Cerrar sesión con confirmación (SCRUM-83). Lo usan Mi cuenta y el panel del avatar: un solo lugar para
 * que los dos hagan exactamente lo mismo.
 */
@Injectable({ providedIn: 'root' })
export class CierreDeSesion {
  private readonly sesion = inject(SessionService);
  private readonly router = inject(Router);
  private readonly notificador = inject(NotifierService);

  async conConfirmacion(): Promise<void> {
    const confirmado = await this.notificador.confirmar(
      '¿Cerrar sesión?',
      'Tendrás que iniciar sesión de nuevo para ver tu cuenta.',
      'Cerrar sesión',
    );
    if (!confirmado) {
      return;
    }

    const irAEntrar = () => {
      void this.router.navigate(['/cuenta/entrar']);
      void this.notificador.aviso('Sesión cerrada.');
    };
    this.sesion.cerrar().subscribe({ next: irAEntrar, error: irAEntrar });
  }
}

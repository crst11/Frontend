import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';

/** Solo deja pasar a quien tiene sesión; a los demás los manda a iniciar sesión. */
export const sessionGuard: CanActivateFn = () => {
  const sesion = inject(SessionService);
  return sesion.estaAutenticada() ? true : inject(Router).createUrlTree(['/cuenta/entrar']);
};

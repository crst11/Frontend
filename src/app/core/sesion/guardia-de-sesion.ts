import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ServicioDeSesion } from './servicio-de-sesion';

/** Solo deja pasar a quien tiene sesión; a los demás los manda a iniciar sesión. */
export const guardiaDeSesion: CanActivateFn = () => {
  const sesion = inject(ServicioDeSesion);
  return sesion.estaAutenticada() ? true : inject(Router).createUrlTree(['/cuenta/entrar']);
};

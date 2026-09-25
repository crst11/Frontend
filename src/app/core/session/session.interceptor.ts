import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SessionService } from './session.service';

/**
 * Agrega el token de acceso a las llamadas protegidas de la API y, si una responde 401, intenta
 * un refresco una sola vez y repite la llamada. Si el refresco también falla, manda a iniciar sesión.
 */
export const sessionInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const sesion = inject(SessionService);
  const router = inject(Router);

  const esProtegida = peticion.url.startsWith(environment.apiUrl) && !peticion.url.startsWith(`${environment.apiUrl}/publico/`);
  if (!esProtegida) {
    return siguiente(peticion);
  }

  const conToken = (original: HttpRequest<unknown>) => {
    const token = sesion.token();
    return token ? original.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : original;
  };

  return siguiente(conToken(peticion)).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      return sesion.renovar().pipe(
        switchMap(() => siguiente(conToken(peticion))),
        catchError((falla: unknown) => {
          sesion.limpiar();
          void router.navigate(['/cuenta/entrar']);
          return throwError(() => falla);
        }),
      );
    }),
  );
};

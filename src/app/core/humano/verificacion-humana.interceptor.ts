import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { VerificacionHumana } from './verificacion-humana.service';

/** Las tres rutas públicas donde el backend pide la prueba (SCRUM-92): no la confirmación de la recuperación. */
/** Es una funcion y no una constante: `apiUrl` se lee de config.json al arrancar (SCRUM-218), despues de importar este modulo. */
const rutasConPrueba = (): string[] => ['registro', 'login', 'recuperacion'].map((ruta) => `${environment.apiUrl}/publico/auth/${ruta}`);

/**
 * Agrega la prueba de persona al registro, al inicio de sesión y a la recuperación de la contraseña, en el
 * encabezado `X-Verificacion-Humana`. Las pantallas no se enteran: no saben que existe. Con la verificación
 * apagada, o si no se pudo conseguir la prueba, la petición sale tal cual.
 */
export const verificacionHumanaInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const humana = inject(VerificacionHumana);
  if (!humana.disponible || peticion.method !== 'POST' || !rutasConPrueba().includes(peticion.url)) {
    return siguiente(peticion);
  }
  return from(humana.obtenerPrueba()).pipe(
    switchMap((prueba) =>
      siguiente(prueba ? peticion.clone({ setHeaders: { 'X-Verificacion-Humana': prueba } }) : peticion),
    ),
  );
};

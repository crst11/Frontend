import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';
import { TimeoutError, catchError, from, of, switchMap, tap, throwError, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CopiaLocalRepository } from '../../data-access/copia-local.repository';
import { esFalloDelServidor } from '../feedback/server-failure';
import { DispositivoDeLaSesion } from '../session/dispositivo-de-la-sesion';
import { SessionService } from '../session/session.service';
import { Conexion } from './conexion.service';
import { esLecturaGuardable, esSondeoDeFondo } from './lecturas-guardables';
import { Sincronizacion } from './sincronizacion.service';

/** Cuánto se espera al servidor por una lectura antes de darla por perdida y mirar la copia guardada. */
export const PLAZO_DE_UNA_LECTURA_EN_MS = new InjectionToken<number>('PLAZO_DE_UNA_LECTURA_EN_MS', {
  providedIn: 'root',
  factory: () => 8_000,
});

/**
 * Consultar sin conexión (RF12, SCRUM-39): guarda la última respuesta buena de cada lectura permitida y, si el
 * servidor no responde (sin red o error 5xx), entrega la guardada. Lo que se entrega de la copia queda
 * anotado en {@link Sincronizacion}, para que la barra diga de cuándo es.
 *
 * <p>Tres decisiones que importan:
 * <ul>
 *   <li>La clave lleva el id del estudiante: en un dispositivo compartido nadie ve la copia de otro.</li>
 *   <li>Sin conexión solo se consulta: una escritura no sale y responde como falta de conexión (la misma
 *       respuesta que ya saben mostrar las pantallas). Nada se encola ni se aplica a escondidas.</li>
 *   <li>Un 4xx (sesión vencida, dato inválido) nunca se tapa con la copia: es una respuesta del servidor,
 *       no una falta de conexión.</li>
 * </ul>
 */
export const lecturasSinConexionInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  if (!peticion.url.startsWith(environment.apiUrl)) {
    return siguiente(peticion);
  }

  if (peticion.method !== 'GET') {
    return inject(Conexion).enLinea() ? siguiente(peticion) : throwError(() => sinConexion(peticion));
  }

  const cuenta = inject(SessionService).cuenta();
  // Una dirección escrita con su `?` dentro también cuenta: la ruta es lo que va antes de los parámetros.
  const ruta = peticion.url.slice(environment.apiUrl.length).split('?')[0];
  // En un equipo compartido no se guarda nada para consultar sin conexión (SCRUM-231): lo vería la persona que llegue después.
  if (!cuenta || !esLecturaGuardable(ruta) || !inject(DispositivoDeLaSesion).permiteCopiaLocal()) {
    return siguiente(peticion);
  }

  const copia = inject(CopiaLocalRepository);
  const sincronizacion = inject(Sincronizacion);
  const plazo = inject(PLAZO_DE_UNA_LECTURA_EN_MS);
  const clave = `${cuenta.id}|${peticion.urlWithParams}`;
  const cuentaParaLaPantalla = !esSondeoDeFondo(peticion.urlWithParams);

  return siguiente(peticion).pipe(
    // Con mala señal el servidor puede no contestar nunca: pasado el plazo se trata como falta de conexión.
    // Es `each` y no `first` porque HttpClient emite un evento «enviada» apenas sale la petición, y ese
    // primer evento daría el plazo por cumplido sin que haya llegado la respuesta.
    timeout({ each: plazo }),
    tap((evento) => {
      if (evento instanceof HttpResponse) {
        const ahora = Date.now();
        void copia.guardar(clave, evento.body, ahora);
        if (cuentaParaLaPantalla) {
          sincronizacion.registrarActual(ahora);
        }
      }
    }),
    catchError((fallo: unknown) => {
      const error = fallo instanceof TimeoutError ? sinConexion(peticion) : fallo;
      if (!(error instanceof HttpErrorResponse) || !esFalloDelServidor(error)) {
        return throwError(() => error);
      }
      return from(copia.leer(clave)).pipe(
        switchMap((guardada) => {
          if (!guardada) {
            return throwError(() => error);
          }
          if (cuentaParaLaPantalla) {
            sincronizacion.registrarCopia(guardada.guardadaEn);
          }
          return of(new HttpResponse({ body: guardada.valor, status: 200, url: peticion.urlWithParams }));
        }),
      );
    }),
  );
};

function sinConexion(peticion: HttpRequest<unknown>): HttpErrorResponse {
  return new HttpErrorResponse({ status: 0, statusText: 'Sin conexión', url: peticion.url });
}

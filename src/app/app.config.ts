import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { ServicioDeSesion } from './core/sesion/servicio-de-sesion';
import { interceptorDeSesion } from './core/sesion/interceptor-de-sesion';
import { CategoriaDeRecursoRepository } from './data-access/categoria-de-recurso.repository';
import { CategoriaDeRecursoHttpRepository } from './data-access/http/categoria-de-recurso-http.repository';
import { EstudianteRepository } from './data-access/estudiante.repository';
import { EstudianteHttpRepository } from './data-access/http/estudiante-http.repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([interceptorDeSesion])),
    { provide: CategoriaDeRecursoRepository, useClass: CategoriaDeRecursoHttpRepository },
    { provide: EstudianteRepository, useClass: EstudianteHttpRepository },
    // Antes de mostrar la primera pantalla intenta recuperar la sesión con la cookie de refresco.
    provideAppInitializer(() => inject(ServicioDeSesion).restaurar()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};

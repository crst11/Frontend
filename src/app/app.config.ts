import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { CategoriaDeRecursoRepository } from './data-access/categoria-de-recurso.repository';
import { CategoriaDeRecursoHttpRepository } from './data-access/http/categoria-de-recurso-http.repository';
import { EstudianteRepository } from './data-access/estudiante.repository';
import { EstudianteHttpRepository } from './data-access/http/estudiante-http.repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    { provide: CategoriaDeRecursoRepository, useClass: CategoriaDeRecursoHttpRepository },
    { provide: EstudianteRepository, useClass: EstudianteHttpRepository },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};

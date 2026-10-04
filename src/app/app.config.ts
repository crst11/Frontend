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
import { SessionService } from './core/session/session.service';
import { sessionInterceptor } from './core/session/session.interceptor';
import { EstudianteRepository } from './data-access/estudiante.repository';
import { EstudianteHttpRepository } from './data-access/http/estudiante-http.repository';
import { GuiaRepository } from './data-access/guia.repository';
import { HistorialRepository } from './data-access/historial.repository';
import { HistorialHttpRepository } from './data-access/http/historial-http.repository';
import { PlanDeEstudiosRepository } from './data-access/plan-de-estudios.repository';
import { PlanDeEstudiosHttpRepository } from './data-access/http/plan-de-estudios-http.repository';
import { GuiaHttpRepository } from './data-access/http/guia-http.repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([sessionInterceptor])),
    { provide: GuiaRepository, useClass: GuiaHttpRepository },
    { provide: EstudianteRepository, useClass: EstudianteHttpRepository },
    { provide: PlanDeEstudiosRepository, useClass: PlanDeEstudiosHttpRepository },
    { provide: HistorialRepository, useClass: HistorialHttpRepository },
    // Antes de mostrar la primera pantalla intenta recuperar la sesión con la cookie de refresco.
    provideAppInitializer(() => inject(SessionService).restaurar()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};

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
import { VigilanteDeInactividad } from './core/session/vigilante-de-inactividad';
import { verificacionHumanaInterceptor } from './core/humano/verificacion-humana.interceptor';
import { sessionInterceptor } from './core/session/session.interceptor';
import { lecturasSinConexionInterceptor } from './core/offline/lecturas-sin-conexion.interceptor';
import { CopiaLocalRepository } from './data-access/copia-local.repository';
import { CopiaLocalIndexedDbRepository } from './data-access/indexeddb/copia-local-indexeddb.repository';
import { EstudianteRepository } from './data-access/estudiante.repository';
import { EstudianteHttpRepository } from './data-access/http/estudiante-http.repository';
import { GuiaRepository } from './data-access/guia.repository';
import { HistorialRepository } from './data-access/historial.repository';
import { EvaluacionRepository } from './data-access/evaluacion.repository';
import { EvaluacionHttpRepository } from './data-access/http/evaluacion-http.repository';
import { HorarioRepository } from './data-access/horario.repository';
import { HorarioHttpRepository } from './data-access/http/horario-http.repository';
import { ImportacionRepository } from './data-access/importacion.repository';
import { ImportacionHttpRepository } from './data-access/http/importacion-http.repository';
import { AvanceRepository } from './data-access/avance.repository';
import { AvanceHttpRepository } from './data-access/http/avance-http.repository';
import { DiaRepository } from './data-access/dia.repository';
import { PendienteRepository } from './data-access/pendiente.repository';
import { DiaHttpRepository } from './data-access/http/dia-http.repository';
import { PendienteHttpRepository } from './data-access/http/pendiente-http.repository';
import { AvisoRepository } from './data-access/aviso.repository';
import { AvisoHttpRepository } from './data-access/http/aviso-http.repository';
import { DispositivoRepository } from './data-access/dispositivo.repository';
import { PreferenciasDeAvisosHttpRepository } from './data-access/http/preferencias-de-avisos-http.repository';
import { PreferenciasDeAvisosRepository } from './data-access/preferencias-de-avisos.repository';
import { DispositivoHttpRepository } from './data-access/http/dispositivo-http.repository';
import { BrujulaRepository } from './data-access/brujula.repository';
import { BrujulaHttpRepository } from './data-access/http/brujula-http.repository';
import { ProyeccionRepository } from './data-access/proyeccion.repository';
import { PropuestaDeHorarioRepository } from './data-access/propuesta-de-horario.repository';
import { PropuestaDeHorarioHttpRepository } from './data-access/http/propuesta-de-horario-http.repository';
import { VerificacionDeCambioRepository } from './data-access/verificacion-de-cambio.repository';
import { VerificacionDeCambioHttpRepository } from './data-access/http/verificacion-de-cambio-http.repository';
import { ProyeccionHttpRepository } from './data-access/http/proyeccion-http.repository';
import { ImportacionDeHorarioRepository } from './data-access/importacion-de-horario.repository';
import { ImportacionDeHorarioHttpRepository } from './data-access/http/importacion-de-horario-http.repository';
import { HistorialHttpRepository } from './data-access/http/historial-http.repository';
import { PlanDeEstudiosRepository } from './data-access/plan-de-estudios.repository';
import { PlanDeEstudiosHttpRepository } from './data-access/http/plan-de-estudios-http.repository';
import { GuiaHttpRepository } from './data-access/http/guia-http.repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // La copia para consultar sin conexión va después de la sesión: un 401 se renueva antes de mirar la copia.
    provideHttpClient(withInterceptors([verificacionHumanaInterceptor, sessionInterceptor, lecturasSinConexionInterceptor])),
    { provide: CopiaLocalRepository, useClass: CopiaLocalIndexedDbRepository },
    { provide: GuiaRepository, useClass: GuiaHttpRepository },
    { provide: EstudianteRepository, useClass: EstudianteHttpRepository },
    { provide: PlanDeEstudiosRepository, useClass: PlanDeEstudiosHttpRepository },
    { provide: HistorialRepository, useClass: HistorialHttpRepository },
    { provide: ImportacionRepository, useClass: ImportacionHttpRepository },
    { provide: DiaRepository, useClass: DiaHttpRepository },
    { provide: PendienteRepository, useClass: PendienteHttpRepository },
    { provide: ProyeccionRepository, useClass: ProyeccionHttpRepository },
    { provide: PropuestaDeHorarioRepository, useClass: PropuestaDeHorarioHttpRepository },
    { provide: VerificacionDeCambioRepository, useClass: VerificacionDeCambioHttpRepository },
    { provide: BrujulaRepository, useClass: BrujulaHttpRepository },
    { provide: AvisoRepository, useClass: AvisoHttpRepository },
    { provide: DispositivoRepository, useClass: DispositivoHttpRepository },
    { provide: PreferenciasDeAvisosRepository, useClass: PreferenciasDeAvisosHttpRepository },
    { provide: AvanceRepository, useClass: AvanceHttpRepository },
    { provide: ImportacionDeHorarioRepository, useClass: ImportacionDeHorarioHttpRepository },
    { provide: EvaluacionRepository, useClass: EvaluacionHttpRepository },
    { provide: HorarioRepository, useClass: HorarioHttpRepository },
    // Antes de mostrar la primera pantalla intenta recuperar la sesión con la cookie de refresco.
    provideAppInitializer(() => inject(SessionService).restaurar()),
    // En un equipo compartido la sesión se cierra sola tras 15 minutos sin actividad (SCRUM-231).
    provideAppInitializer(() => {
      inject(VigilanteDeInactividad).iniciar();
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Qué avisos recibo y con cuánta anticipación (RF10, SCRUM-38). `activos` es el interruptor general: si
 * está apagado no llega ninguno, sin importar los otros dos.
 */
export interface PreferenciasDeAvisos {
  activos: boolean;
  vencimientos: boolean;
  cambioDeRiesgo: boolean;
  anticipacionEnHoras: number;
}

/** Puerto del frontend hacia mis preferencias de avisos. */
@Injectable()
export abstract class PreferenciasDeAvisosRepository {
  abstract mias(): Observable<PreferenciasDeAvisos>;
  abstract cambiar(preferencias: PreferenciasDeAvisos): Observable<PreferenciasDeAvisos>;
}

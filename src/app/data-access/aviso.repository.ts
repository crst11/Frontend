import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Qué avisa un aviso (RF10): un pendiente por vencer o ya vencido, o un cambio en el riesgo de una asignatura.
 */
export type TipoDeAviso = 'vencimiento_proximo' | 'pendiente_vencido' | 'cambio_riesgo';

/** Un aviso, con el texto ya escrito por el servidor: la pantalla solo lo muestra. */
export interface Aviso {
  id: number;
  tipo: TipoDeAviso;
  titulo: string;
  mensaje: string;
  fecha: string;
  leido: boolean;
}

/** `sinLeer` cuenta todos los no leídos, aunque la lista venga recortada: es lo que muestra la campana. */
export interface MisAvisos {
  sinLeer: number;
  avisos: Aviso[];
}

/** Puerto del frontend hacia los avisos de la aplicación (RF10, SCRUM-37). */
@Injectable()
export abstract class AvisoRepository {
  abstract misAvisos(soloSinLeer?: boolean): Observable<MisAvisos>;
  abstract marcar(id: number, leido: boolean): Observable<void>;
  abstract marcarTodos(): Observable<void>;
}

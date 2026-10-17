import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * La llave con la que el navegador se suscribe a los avisos (RF10). Si el servidor no tiene Web Push,
 * `disponible` es falso y `llave` nula: los avisos siguen viéndose dentro de la aplicación.
 */
export interface LlaveDePush {
  disponible: boolean;
  llave: string | null;
}

/** La suscripción tal como la entrega el navegador (`PushSubscription.toJSON()`). */
export interface SuscripcionPush {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Un dispositivo que recibe avisos. El servidor no devuelve la dirección ni las llaves: son secretas. */
export interface DispositivoConAvisos {
  consecutivo: number;
  nombre: string;
  activo: boolean;
  fechaSincronizacion: string | null;
}

/** Puerto del frontend hacia los dispositivos que reciben avisos (RF10, SCRUM-37). */
@Injectable()
export abstract class DispositivoRepository {
  abstract llavePublica(): Observable<LlaveDePush>;
  /** Activa los avisos en este dispositivo; volver a suscribir el mismo navegador no lo duplica. */
  abstract suscribir(suscripcion: SuscripcionPush): Observable<DispositivoConAvisos>;
}

import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { DispositivoRepository } from '../../data-access/dispositivo.repository';
import { esFalloDelServidor } from '../feedback/server-failure';
import { EntornoDelNavegador } from './entorno-del-navegador';

/**
 * En qué punto están los avisos de este dispositivo (RF10, SCRUM-37).
 *
 * - `instalar_en_ios`: iPhone o iPad con la aplicación en una pestaña; hay que instalarla primero.
 * - `no_disponible`: el navegador o el servidor no admiten Web Push; los avisos se ven dentro de la aplicación.
 * - `bloqueado`: la persona negó el permiso de notificaciones; solo ella puede cambiarlo.
 * - `desactivado` y `activado`: se pueden activar, o ya llegan a este dispositivo.
 */
export type EstadoDeAvisosPush =
  | 'comprobando'
  | 'no_disponible'
  | 'instalar_en_ios'
  | 'bloqueado'
  | 'desactivado'
  | 'activado'
  | 'fallo';

/**
 * Activar los avisos en este dispositivo: pide el permiso, crea la suscripción Web Push del navegador y
 * se la entrega al servidor, que es quien después manda los avisos aunque la aplicación esté cerrada.
 */
@Injectable({ providedIn: 'root' })
export class AvisosPush {
  private readonly swPush = inject(SwPush);
  private readonly dispositivos = inject(DispositivoRepository);
  private readonly entorno = inject(EntornoDelNavegador);

  readonly estado = signal<EstadoDeAvisosPush>('comprobando');
  readonly activando = signal(false);
  /** Qué salió mal al activar, en palabras de la persona; nulo si no hubo problema. */
  readonly error = signal<string | null>(null);

  async comprobar(): Promise<void> {
    this.error.set(null);
    if (this.entorno.esIos() && !this.entorno.estaInstalada()) {
      this.estado.set('instalar_en_ios');
      return;
    }
    if (!this.swPush.isEnabled || this.entorno.permisoDeNotificaciones() === 'no_soportado') {
      this.estado.set('no_disponible');
      return;
    }
    if (this.entorno.permisoDeNotificaciones() === 'denied') {
      this.estado.set('bloqueado');
      return;
    }
    try {
      const llave = await firstValueFrom(this.dispositivos.llavePublica());
      if (!llave.disponible) {
        this.estado.set('no_disponible');
        return;
      }
      const suscripcion = await firstValueFrom(this.swPush.subscription);
      this.estado.set(suscripcion ? 'activado' : 'desactivado');
    } catch {
      this.estado.set('no_disponible');
    }
  }

  async activar(): Promise<void> {
    this.activando.set(true);
    this.error.set(null);
    try {
      const llave = await firstValueFrom(this.dispositivos.llavePublica());
      if (!llave.disponible || !llave.llave) {
        this.estado.set('no_disponible');
        return;
      }
      const suscripcion = (await this.swPush.requestSubscription({ serverPublicKey: llave.llave })).toJSON();
      if (!suscripcion.endpoint || !suscripcion.keys?.['p256dh'] || !suscripcion.keys['auth']) {
        throw new Error('El navegador no entregó una suscripción completa');
      }
      await firstValueFrom(
        this.dispositivos.suscribir({
          endpoint: suscripcion.endpoint,
          keys: { p256dh: suscripcion.keys['p256dh'], auth: suscripcion.keys['auth'] },
        }),
      );
      this.estado.set('activado');
    } catch (err) {
      if (this.entorno.permisoDeNotificaciones() === 'denied') {
        this.estado.set('bloqueado');
      } else {
        this.estado.set('fallo');
        this.error.set(mensajeDeError(err));
      }
    } finally {
      this.activando.set(false);
    }
  }
}

/** Lo que el servidor rechaza (un servicio de avisos que no admite, o demasiados dispositivos) se muestra tal cual. */
function mensajeDeError(err: unknown): string {
  if (err instanceof HttpErrorResponse && !esFalloDelServidor(err) && err.error?.detail) {
    return err.error.detail;
  }
  return 'No pudimos activar los avisos en este dispositivo. Intenta de nuevo en un momento.';
}

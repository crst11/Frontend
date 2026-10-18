import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { SwPush } from '@angular/service-worker';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { DispositivoRepository } from '../../data-access/dispositivo.repository';
import { AvisosPush } from './avisos-push.service';
import { EntornoDelNavegador } from './entorno-del-navegador';

describe('AvisosPush', () => {
  const dispositivos = { llavePublica: vi.fn(), suscribir: vi.fn() };
  const swPush = { isEnabled: true, subscription: of(null as PushSubscription | null), requestSubscription: vi.fn() };
  const entorno = { esIos: vi.fn(), estaInstalada: vi.fn(), permisoDeNotificaciones: vi.fn() };

  const SUSCRIPCION = {
    toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'clave', auth: 'secreto' } }),
  } as unknown as PushSubscription;

  beforeEach(() => {
    dispositivos.llavePublica.mockReset().mockReturnValue(of({ disponible: true, llave: 'llave-del-servidor' }));
    dispositivos.suscribir.mockReset().mockReturnValue(of({ consecutivo: 1, nombre: 'Chrome en Android', activo: true, fechaSincronizacion: null }));
    swPush.isEnabled = true;
    swPush.subscription = of(null);
    swPush.requestSubscription.mockReset().mockResolvedValue(SUSCRIPCION);
    entorno.esIos.mockReset().mockReturnValue(false);
    entorno.estaInstalada.mockReset().mockReturnValue(false);
    entorno.permisoDeNotificaciones.mockReset().mockReturnValue('default');
  });

  function servicio(): AvisosPush {
    TestBed.configureTestingModule({
      providers: [
        { provide: SwPush, useValue: swPush },
        { provide: DispositivoRepository, useValue: dispositivos },
        { provide: EntornoDelNavegador, useValue: entorno },
      ],
    });
    return TestBed.inject(AvisosPush);
  }

  describe('comprobar', () => {
    it('en un iPhone con la aplicación en una pestaña pide instalarla primero', async () => {
      entorno.esIos.mockReturnValue(true);
      const avisos = servicio();

      await avisos.comprobar();

      expect(avisos.estado()).toBe('instalar_en_ios');
      expect(dispositivos.llavePublica).not.toHaveBeenCalled();
    });

    it('en un iPhone con la aplicación instalada sigue adelante', async () => {
      entorno.esIos.mockReturnValue(true);
      entorno.estaInstalada.mockReturnValue(true);
      const avisos = servicio();

      await avisos.comprobar();

      expect(avisos.estado()).toBe('desactivado');
    });

    it('sin service worker no hay avisos al dispositivo', async () => {
      swPush.isEnabled = false;
      const avisos = servicio();

      await avisos.comprobar();

      expect(avisos.estado()).toBe('no_disponible');
    });

    it('si el navegador no soporta notificaciones no hay avisos al dispositivo', async () => {
      entorno.permisoDeNotificaciones.mockReturnValue('no_soportado');
      const avisos = servicio();

      await avisos.comprobar();

      expect(avisos.estado()).toBe('no_disponible');
    });

    it('si la persona negó el permiso lo dice y no molesta al servidor', async () => {
      entorno.permisoDeNotificaciones.mockReturnValue('denied');
      const avisos = servicio();

      await avisos.comprobar();

      expect(avisos.estado()).toBe('bloqueado');
      expect(dispositivos.llavePublica).not.toHaveBeenCalled();
    });

    it('si el servidor no tiene Web Push los avisos solo se ven dentro de la aplicación', async () => {
      dispositivos.llavePublica.mockReturnValue(of({ disponible: false, llave: null }));
      const avisos = servicio();

      await avisos.comprobar();

      expect(avisos.estado()).toBe('no_disponible');
    });

    it('sin suscripción se puede activar y con ella ya está activado', async () => {
      const sinSuscripcion = servicio();
      await sinSuscripcion.comprobar();
      expect(sinSuscripcion.estado()).toBe('desactivado');

      TestBed.resetTestingModule();
      swPush.subscription = of(SUSCRIPCION);
      const conSuscripcion = servicio();
      await conSuscripcion.comprobar();
      expect(conSuscripcion.estado()).toBe('activado');
    });

    it('si no se puede preguntar al servidor no promete avisos', async () => {
      dispositivos.llavePublica.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
      const avisos = servicio();

      await avisos.comprobar();

      expect(avisos.estado()).toBe('no_disponible');
    });
  });

  describe('activar', () => {
    it('pide la suscripción con la llave del servidor y se la entrega', async () => {
      const avisos = servicio();

      await avisos.activar();

      expect(swPush.requestSubscription).toHaveBeenCalledWith({ serverPublicKey: 'llave-del-servidor' });
      expect(dispositivos.suscribir).toHaveBeenCalledWith({
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
        keys: { p256dh: 'clave', auth: 'secreto' },
      });
      expect(avisos.estado()).toBe('activado');
      expect(avisos.error()).toBeNull();
      expect(avisos.activando()).toBe(false);
    });

    it('si la persona niega el permiso queda bloqueado y no se le dice que falló', async () => {
      swPush.requestSubscription.mockRejectedValue(new Error('Permission denied'));
      entorno.permisoDeNotificaciones.mockReturnValue('denied');
      const avisos = servicio();

      await avisos.activar();

      expect(avisos.estado()).toBe('bloqueado');
      expect(avisos.error()).toBeNull();
      expect(dispositivos.suscribir).not.toHaveBeenCalled();
    });

    it('lo que el servidor rechaza se muestra tal cual', async () => {
      dispositivos.suscribir.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 422, error: { detail: 'Ya tienes 10 dispositivos con avisos. Quita uno para activar este' } })),
      );
      const avisos = servicio();

      await avisos.activar();

      expect(avisos.estado()).toBe('fallo');
      expect(avisos.error()).toContain('10 dispositivos');
      expect(avisos.activando()).toBe(false);
    });

    it('una falla del sistema da un mensaje general y deja intentar de nuevo', async () => {
      dispositivos.suscribir.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
      const avisos = servicio();

      await avisos.activar();

      expect(avisos.estado()).toBe('fallo');
      expect(avisos.error()).toContain('No pudimos activar los avisos');
    });

    it('si el navegador entrega una suscripción incompleta no la manda', async () => {
      swPush.requestSubscription.mockResolvedValue({ toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/x' }) } as unknown as PushSubscription);
      const avisos = servicio();

      await avisos.activar();

      expect(avisos.estado()).toBe('fallo');
      expect(dispositivos.suscribir).not.toHaveBeenCalled();
    });

    it('si el servidor dejó de tener Web Push al activar, queda no disponible', async () => {
      dispositivos.llavePublica.mockReturnValue(of({ disponible: false, llave: null }));
      const avisos = servicio();

      await avisos.activar();

      expect(avisos.estado()).toBe('no_disponible');
      expect(swPush.requestSubscription).not.toHaveBeenCalled();
    });
  });
});

import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { AvisosSinLeer } from '../../../core/notifications/avisos-sin-leer.service';
import { AvisosPush, EstadoDeAvisosPush } from '../../../core/push/avisos-push.service';
import { Aviso, AvisoRepository, MisAvisos } from '../../../data-access/aviso.repository';
import { NotificationsScreen } from './notifications-screen';

describe('NotificationsScreen', () => {
  const notificador = { problema: vi.fn(), aviso: vi.fn(), confirmar: vi.fn() };

  const SIN_LEER: Aviso = {
    id: 1,
    tipo: 'vencimiento_proximo',
    titulo: 'Vence pronto',
    mensaje: '«Taller de redes» vence hoy a las 11:59 p. m.',
    fecha: '2026-10-14T15:00:00Z',
    leido: false,
  };
  const LEIDO: Aviso = { ...SIN_LEER, id: 2, mensaje: '«Ensayo» vence mañana a las 8:00 a. m.', leido: true };
  const DE_RIESGO: Aviso = {
    id: 3,
    tipo: 'cambio_riesgo',
    titulo: 'Cambió tu riesgo',
    mensaje: 'Cálculo pasó de riesgo medio a riesgo alto.',
    fecha: '2026-10-14T14:00:00Z',
    leido: false,
  };

  const repositorio = { misAvisos: vi.fn(), marcar: vi.fn(), marcarTodos: vi.fn() };
  const sinLeerGlobal = { cantidad: signal(0), refrescar: vi.fn(), fijar: vi.fn() };
  const estado = signal<EstadoDeAvisosPush>('desactivado');
  const push = {
    estado,
    activando: signal(false),
    error: signal<string | null>(null),
    comprobar: vi.fn(),
    activar: vi.fn(),
  };

  const respuesta = (avisos: Aviso[]): MisAvisos => ({ sinLeer: avisos.filter((a) => !a.leido).length, avisos });

  beforeEach(() => {
    notificador.problema.mockReset().mockResolvedValue(undefined);
    repositorio.misAvisos.mockReset().mockReturnValue(of(respuesta([SIN_LEER, LEIDO])));
    repositorio.marcar.mockReset().mockReturnValue(of(undefined));
    repositorio.marcarTodos.mockReset().mockReturnValue(of(undefined));
    sinLeerGlobal.fijar.mockReset();
    push.comprobar.mockReset().mockResolvedValue(undefined);
    push.activar.mockReset().mockResolvedValue(undefined);
    push.error.set(null);
    estado.set('desactivado');
  });

  function crear() {
    TestBed.configureTestingModule({
      imports: [NotificationsScreen],
      providers: [
        provideRouter([]),
        { provide: AvisoRepository, useValue: repositorio },
        { provide: AvisosSinLeer, useValue: sinLeerGlobal },
        { provide: AvisosPush, useValue: push },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    const fixture = TestBed.createComponent(NotificationsScreen);
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement };
  }

  it('lista los avisos con su texto, marca los nuevos y avisa a la campana cuántos faltan', () => {
    const { html } = crear();

    const items = html.querySelectorAll('.avisos__item');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Vence pronto');
    expect(items[0].textContent).toContain('«Taller de redes» vence hoy a las 11:59 p. m.');
    expect(items[0].textContent).toContain('Nuevo');
    expect(items[0].classList).toContain('avisos__item--sin-leer');
    expect(items[1].textContent).not.toContain('Nuevo');
    expect(sinLeerGlobal.fijar).toHaveBeenCalledWith(1);
  });

  it('cada aviso lleva a lo que avisa', () => {
    repositorio.misAvisos.mockReturnValue(of(respuesta([SIN_LEER, DE_RIESGO])));
    const { html } = crear();

    const enlaces = Array.from(html.querySelectorAll<HTMLAnchorElement>('.avisos__item a')).map((a) => a.getAttribute('href'));
    expect(enlaces).toEqual(['/pendientes', '/brujula']);
  });

  it('marcar un aviso como leído lo pide, vuelve a traer la lista y actualiza la campana', () => {
    const { fixture, html } = crear();
    repositorio.misAvisos.mockReturnValue(of(respuesta([{ ...SIN_LEER, leido: true }, LEIDO])));

    html.querySelector<HTMLButtonElement>('.avisos__marcar')!.click();
    fixture.detectChanges();

    expect(repositorio.marcar).toHaveBeenCalledWith(1, true);
    expect(sinLeerGlobal.fijar).toHaveBeenLastCalledWith(0);
    expect(html.querySelectorAll('.avisos__item--sin-leer')).toHaveLength(0);
  });

  it('un aviso leído se puede devolver a sin leer', () => {
    const { html } = crear();

    html.querySelectorAll<HTMLButtonElement>('.avisos__marcar')[1].click();

    expect(repositorio.marcar).toHaveBeenCalledWith(2, false);
  });

  it('marcar todos como leídos dice cuántos son y llama una sola vez', () => {
    repositorio.misAvisos.mockReturnValue(of(respuesta([SIN_LEER, DE_RIESGO])));
    const { fixture, html } = crear();
    const boton = html.querySelector<HTMLButtonElement>('.avisos > .button--outline')!;
    expect(boton.textContent).toContain('(2)');

    boton.click();
    fixture.detectChanges();

    expect(repositorio.marcarTodos).toHaveBeenCalledTimes(1);
  });

  it('sin avisos nuevos no ofrece marcar todos', () => {
    repositorio.misAvisos.mockReturnValue(of(respuesta([LEIDO])));
    const { html } = crear();

    expect(html.querySelector('.avisos > .button--outline')).toBeNull();
  });

  it('sin avisos lo dice', () => {
    repositorio.misAvisos.mockReturnValue(of(respuesta([])));
    const { html } = crear();

    expect(html.textContent).toContain('No tienes avisos');
    expect(html.querySelector('.avisos__item')).toBeNull();
  });

  it('si no se pueden traer lo dice, avisa de la falla del sistema y deja reintentar', () => {
    repositorio.misAvisos.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));
    const { fixture, html } = crear();

    expect(html.querySelector('[role="alert"]')?.textContent).toContain('No pudimos traer tus avisos');
    expect(notificador.problema).toHaveBeenCalled();

    html.querySelector<HTMLButtonElement>('.button--soft')!.click();
    fixture.detectChanges();

    expect(html.querySelectorAll('.avisos__item')).toHaveLength(2);
  });

  describe('los avisos en este dispositivo', () => {
    it('al abrir comprueba en qué punto están', () => {
      crear();

      expect(push.comprobar).toHaveBeenCalled();
    });

    it('desactivados: ofrece activarlos y al tocar lo pide', () => {
      const { html } = crear();

      html.querySelector<HTMLButtonElement>('.avisos__dispositivo .button--primary')!.click();

      expect(push.activar).toHaveBeenCalled();
    });

    it('activados: lo dice', () => {
      estado.set('activado');
      const { html } = crear();

      expect(html.querySelector('.avisos__dispositivo--activo')?.textContent).toContain('Los avisos llegan a este dispositivo');
    });

    it('bloqueados: explica cómo permitirlos y deja volver a comprobar', () => {
      estado.set('bloqueado');
      const { html } = crear();

      expect(html.querySelector('.avisos__dispositivo')?.textContent).toContain('bloqueados');
      push.comprobar.mockClear();
      html.querySelector<HTMLButtonElement>('.avisos__dispositivo .button--soft')!.click();
      expect(push.comprobar).toHaveBeenCalled();
    });

    it('en un iPhone sin instalar muestra la guía y no un botón que no serviría', () => {
      estado.set('instalar_en_ios');
      const { html } = crear();

      expect(html.querySelector('app-ios-install-guide')?.textContent).toContain('Añadir a pantalla de inicio');
      expect(html.querySelector('.avisos__dispositivo')).toBeNull();
    });

    it('si falla al activar muestra el motivo y deja intentar de nuevo', () => {
      estado.set('fallo');
      push.error.set('Ya tienes 10 dispositivos con avisos. Quita uno para activar este');
      const { html } = crear();

      expect(html.querySelector('.avisos__dispositivo [role="alert"]')?.textContent).toContain('10 dispositivos');
      html.querySelector<HTMLButtonElement>('.avisos__dispositivo .button--soft')!.click();
      expect(push.activar).toHaveBeenCalled();
    });

    it('si no está disponible, aclara que los avisos se ven aquí', () => {
      estado.set('no_disponible');
      const { html } = crear();

      expect(html.querySelector('.avisos__nota')?.textContent).toContain('Los verás siempre en esta pantalla');
    });
  });
});

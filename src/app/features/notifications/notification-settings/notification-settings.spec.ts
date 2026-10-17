import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { DispositivoConAvisos, DispositivoRepository } from '../../../data-access/dispositivo.repository';
import {
  PreferenciasDeAvisos,
  PreferenciasDeAvisosRepository,
} from '../../../data-access/preferencias-de-avisos.repository';
import { NotificationSettings } from './notification-settings';

describe('NotificationSettings', () => {
  const notificador = { problema: vi.fn(), aviso: vi.fn(), confirmar: vi.fn() };

  const PREFERENCIAS: PreferenciasDeAvisos = {
    activos: true,
    vencimientos: true,
    cambioDeRiesgo: false,
    anticipacionEnHoras: 48,
  };
  const CELULAR: DispositivoConAvisos = {
    consecutivo: 1,
    nombre: 'Chrome en Android',
    activo: true,
    fechaSincronizacion: '2026-10-17T15:00:00Z',
  };
  const PORTATIL: DispositivoConAvisos = {
    consecutivo: 2,
    nombre: 'Firefox en Windows',
    activo: true,
    fechaSincronizacion: null,
  };

  const preferencias = { mias: vi.fn(), cambiar: vi.fn() };
  const dispositivos = { misDispositivos: vi.fn(), quitar: vi.fn(), llavePublica: vi.fn(), suscribir: vi.fn() };

  beforeEach(() => {
    notificador.problema.mockReset().mockResolvedValue(undefined);
    notificador.aviso.mockReset().mockResolvedValue(undefined);
    notificador.confirmar.mockReset().mockResolvedValue(true);
    preferencias.mias.mockReset().mockReturnValue(of(PREFERENCIAS));
    preferencias.cambiar.mockReset().mockImplementation((nuevas: PreferenciasDeAvisos) => of(nuevas));
    dispositivos.misDispositivos.mockReset().mockReturnValue(of([CELULAR, PORTATIL]));
    dispositivos.quitar.mockReset().mockReturnValue(of(undefined));
  });

  function crear() {
    TestBed.configureTestingModule({
      imports: [NotificationSettings],
      providers: [
        provideRouter([]),
        { provide: PreferenciasDeAvisosRepository, useValue: preferencias },
        { provide: DispositivoRepository, useValue: dispositivos },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    const fixture = TestBed.createComponent(NotificationSettings);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    const campo = (id: string) => html.querySelector<HTMLInputElement>(`#${id}`)!;
    return { fixture, html, campo };
  }

  it('muestra lo que la persona tiene guardado', () => {
    const { campo } = crear();

    expect(campo('avisos-activos').checked).toBe(true);
    expect(campo('avisos-vencimientos').checked).toBe(true);
    expect(campo('avisos-riesgo').checked).toBe(false);
    expect(campo('avisos-horas').value).toBe('48');
  });

  it('apagar el interruptor general deshabilita los otros y lo explica', () => {
    const { fixture, html, campo } = crear();

    campo('avisos-activos').click();
    fixture.detectChanges();

    expect(campo('avisos-vencimientos').disabled).toBe(true);
    expect(campo('avisos-riesgo').disabled).toBe(true);
    expect(campo('avisos-horas').disabled).toBe(true);
    expect(html.textContent).toContain('no te llega ningún aviso');
  });

  it('guarda los interruptores y las horas tal cual', () => {
    const { fixture, html, campo } = crear();

    campo('avisos-riesgo').click();
    const horas = campo('avisos-horas');
    horas.value = '72';
    horas.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    html.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();

    expect(preferencias.cambiar).toHaveBeenCalledWith({
      activos: true,
      vencimientos: true,
      cambioDeRiesgo: true,
      anticipacionEnHoras: 72,
    });
    expect(notificador.aviso).toHaveBeenCalled();
  });

  it('unas horas que no son un número entero no se envían', () => {
    const { fixture, html, campo } = crear();

    const horas = campo('avisos-horas');
    horas.value = 'mañana';
    horas.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    html.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    fixture.detectChanges();

    expect(preferencias.cambiar).not.toHaveBeenCalled();
    expect(html.querySelector('.field__error')?.textContent).toContain('número entero');
  });

  it('muestra lo que dice el servidor cuando rechaza las horas', () => {
    preferencias.cambiar.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { detail: 'La anticipación tiene que estar entre 1 y 168 horas' } })),
    );
    const { fixture, html, campo } = crear();

    const horas = campo('avisos-horas');
    horas.value = '500';
    horas.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    html.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    fixture.detectChanges();

    expect(html.querySelector('.field__error')?.textContent).toContain('entre 1 y 168 horas');
    expect(notificador.problema).not.toHaveBeenCalled();
  });

  it('una falla del sistema al guardar se avisa en una ventana', () => {
    preferencias.cambiar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    const { html } = crear();

    html.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();

    expect(notificador.problema).toHaveBeenCalled();
  });

  it('lista los dispositivos y la fecha solo de los que la tienen', () => {
    const { html } = crear();

    const nombres = Array.from(html.querySelectorAll('.configuracion__nombre')).map((n) => n.textContent);
    expect(nombres).toEqual(['Chrome en Android', 'Firefox en Windows']);
    expect(html.querySelectorAll('.configuracion__fecha').length).toBe(1);
  });

  it('quitar un dispositivo pide confirmar y vuelve a pedir la lista', async () => {
    const { fixture, html } = crear();
    dispositivos.misDispositivos.mockReturnValue(of([PORTATIL]));

    html.querySelectorAll<HTMLButtonElement>('.configuracion__dispositivo button')[0].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(notificador.confirmar).toHaveBeenCalled();
    expect(dispositivos.quitar).toHaveBeenCalledWith(1);
    expect(html.querySelectorAll('.configuracion__nombre').length).toBe(1);
  });

  it('si la persona se arrepiente no se quita nada', async () => {
    notificador.confirmar.mockResolvedValue(false);
    const { fixture, html } = crear();

    html.querySelectorAll<HTMLButtonElement>('.configuracion__dispositivo button')[0].click();
    await fixture.whenStable();

    expect(dispositivos.quitar).not.toHaveBeenCalled();
  });

  it('sin dispositivos explica cómo activar los avisos', () => {
    dispositivos.misDispositivos.mockReturnValue(of([]));
    const { html } = crear();

    expect(html.textContent).toContain('Ningún dispositivo recibe avisos');
  });

  it('si no logra traer las preferencias deja volver a intentar', () => {
    preferencias.mias.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const { fixture, html } = crear();

    expect(html.querySelector('.alert')?.textContent).toContain('No pudimos traer tus preferencias');
    preferencias.mias.mockReturnValue(of(PREFERENCIAS));
    html.querySelector<HTMLButtonElement>('button.button--soft')!.click();
    fixture.detectChanges();

    expect(html.querySelector('#avisos-horas')).not.toBeNull();
  });
});

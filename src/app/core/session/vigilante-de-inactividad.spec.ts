import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../feedback/notifier.service';
import { DispositivoDeLaSesion } from './dispositivo-de-la-sesion';
import { SessionService } from './session.service';
import { VigilanteDeInactividad } from './vigilante-de-inactividad';

describe('VigilanteDeInactividad', () => {
  const PLAZO = 15 * 60_000;
  const T0 = 1_000_000_000_000;
  const autenticada = signal(true);
  const cerrar = vi.fn();
  const informar = vi.fn();
  let detener: (() => void) | null = null;

  function crear() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SessionService, useValue: { estaAutenticada: autenticada.asReadonly(), cerrar } },
        { provide: NotifierService, useValue: { informar } },
      ],
    });
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    return { vigilante: TestBed.inject(VigilanteDeInactividad), dispositivo: TestBed.inject(DispositivoDeLaSesion), navegar };
  }

  beforeEach(() => {
    localStorage.clear();
    autenticada.set(true);
    cerrar.mockReset().mockReturnValue(of(undefined));
    informar.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    detener?.();
    detener = null;
    localStorage.clear();
    vi.useRealTimers();
  });

  it('en un equipo compartido, pasado el plazo cierra la sesión, lleva a iniciar sesión y lo explica', () => {
    const { vigilante, dispositivo, navegar } = crear();
    dispositivo.marcar(false, T0);

    vigilante.revisar(T0 + PLAZO);

    expect(cerrar).toHaveBeenCalledTimes(1);
    expect(navegar).toHaveBeenCalledWith(['/cuenta/entrar']);
    expect(informar).toHaveBeenCalledWith('Cerramos tu sesión', expect.stringContaining('15 minutos'));
  });

  it('antes del plazo no hace nada', () => {
    const { vigilante, dispositivo } = crear();
    dispositivo.marcar(false, T0);

    vigilante.revisar(T0 + PLAZO - 1);

    expect(cerrar).not.toHaveBeenCalled();
  });

  it('en un dispositivo personal nunca cierra por inactividad', () => {
    const { vigilante } = crear();

    vigilante.revisar(T0 + 100 * PLAZO);

    expect(cerrar).not.toHaveBeenCalled();
  });

  it('sin sesión no hay nada que cerrar', () => {
    const { vigilante, dispositivo } = crear();
    dispositivo.marcar(false, T0);
    autenticada.set(false);

    vigilante.revisar(T0 + PLAZO);

    expect(cerrar).not.toHaveBeenCalled();
  });

  it('si el servidor no responde al cerrar, igual lleva a iniciar sesión', () => {
    cerrar.mockReturnValue(throwError(() => new Error('sin red')));
    const { vigilante, dispositivo, navegar } = crear();
    dispositivo.marcar(false, T0);

    vigilante.revisar(T0 + PLAZO);

    expect(navegar).toHaveBeenCalledWith(['/cuenta/entrar']);
  });

  it('no cierra dos veces si se revisa de nuevo mientras cierra', () => {
    cerrar.mockReturnValue(NEVER);
    const { vigilante, dispositivo } = crear();
    dispositivo.marcar(false, T0);

    vigilante.revisar(T0 + PLAZO);
    vigilante.revisar(T0 + PLAZO + 1_000);

    expect(cerrar).toHaveBeenCalledTimes(1);
  });

  it('un toque después del plazo no revive la sesión: cierra', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const { vigilante, dispositivo } = crear();
    dispositivo.marcar(false, T0);
    detener = vigilante.iniciar();

    vi.setSystemTime(T0 + PLAZO + 1_000);
    document.dispatchEvent(new Event('pointerdown'));

    expect(cerrar).toHaveBeenCalledTimes(1);
  });

  it('la actividad dentro del plazo la mantiene abierta', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const { vigilante, dispositivo } = crear();
    dispositivo.marcar(false, T0);
    detener = vigilante.iniciar();

    vi.setSystemTime(T0 + PLAZO - 60_000);
    document.dispatchEvent(new Event('keydown'));
    vi.setSystemTime(T0 + PLAZO + 60_000);
    vigilante.revisar();

    expect(cerrar).not.toHaveBeenCalled();
  });
});

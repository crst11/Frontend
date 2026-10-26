import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../feedback/notifier.service';
import { ActualizadorDeLaApp, RECARGAR_LA_PAGINA } from './actualizador-de-la-app';

describe('ActualizadorDeLaApp (SCRUM-258)', () => {
  const MEDIA_HORA = 30 * 60_000;
  const versionLista = { type: 'VERSION_READY', currentVersion: { hash: 'a' }, latestVersion: { hash: 'b' } };

  const versionUpdates = new Subject<unknown>();
  const unrecoverable = new Subject<unknown>();
  const checkForUpdate = vi.fn();
  const activateUpdate = vi.fn();
  const confirmar = vi.fn();
  const informar = vi.fn();
  const problema = vi.fn();
  const aviso = vi.fn();
  const recargar = vi.fn();
  let detener: (() => void) | null = null;

  function crear(habilitado = true): ActualizadorDeLaApp {
    TestBed.configureTestingModule({
      providers: [
        { provide: SwUpdate, useValue: { isEnabled: habilitado, versionUpdates, unrecoverable, checkForUpdate, activateUpdate } },
        { provide: NotifierService, useValue: { confirmar, informar, problema, aviso } },
        { provide: RECARGAR_LA_PAGINA, useValue: recargar },
      ],
    });
    return TestBed.inject(ActualizadorDeLaApp);
  }

  function iniciar(habilitado = true): void {
    detener = crear(habilitado).iniciar();
  }

  /** Deja que terminen las promesas pendientes (el aviso y la activación) antes de mirar el resultado. */
  const asentar = (): Promise<void> => new Promise((resolver) => setTimeout(resolver, 0));

  beforeEach(() => {
    checkForUpdate.mockReset().mockResolvedValue(false);
    activateUpdate.mockReset().mockResolvedValue(true);
    confirmar.mockReset().mockResolvedValue(true);
    informar.mockReset().mockResolvedValue(undefined);
    problema.mockReset().mockResolvedValue(undefined);
    aviso.mockReset().mockResolvedValue(undefined);
    sessionStorage.clear();
    recargar.mockReset();
  });
  afterEach(() => {
    detener?.();
    detener = null;
    vi.useRealTimers();
  });

  it('cuando hay una versión lista pregunta, y si la persona acepta la activa y recarga', async () => {
    iniciar();

    versionUpdates.next(versionLista);
    await asentar();

    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(confirmar.mock.calls[0][0]).toBe('Hay una versión nueva de CundiApp');
    expect(confirmar.mock.calls[0][2]).toBe('Actualizar ahora');
    expect(confirmar.mock.calls[0][3]).toBe('Después');
    expect(activateUpdate).toHaveBeenCalledTimes(1);
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('si la persona deja la actualización para después no activa ni recarga', async () => {
    confirmar.mockResolvedValue(false);
    iniciar();

    versionUpdates.next(versionLista);
    await asentar();

    expect(activateUpdate).not.toHaveBeenCalled();
    expect(recargar).not.toHaveBeenCalled();
  });

  it('no abre un segundo aviso mientras el primero sigue en pantalla', async () => {
    confirmar.mockReturnValue(new Promise(() => undefined));
    iniciar();

    versionUpdates.next(versionLista);
    versionUpdates.next(versionLista);
    document.dispatchEvent(new Event('visibilitychange'));
    await asentar();

    expect(confirmar).toHaveBeenCalledTimes(1);
  });

  it('si quedó para después, vuelve a preguntar cuando la persona regresa a la aplicación', async () => {
    confirmar.mockResolvedValue(false);
    iniciar();
    versionUpdates.next(versionLista);
    await asentar();

    document.dispatchEvent(new Event('visibilitychange'));
    await asentar();

    expect(confirmar).toHaveBeenCalledTimes(2);
  });

  it('sin una versión lista no pregunta nada aunque la persona vuelva a la aplicación', async () => {
    iniciar();

    document.dispatchEvent(new Event('visibilitychange'));
    versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'b' } });
    await asentar();

    expect(confirmar).not.toHaveBeenCalled();
  });

  it('busca una versión nueva al volver a la aplicación y cada media hora', async () => {
    vi.useFakeTimers();
    iniciar();
    expect(checkForUpdate).not.toHaveBeenCalled();

    document.dispatchEvent(new Event('visibilitychange'));
    expect(checkForUpdate).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(MEDIA_HORA);
    expect(checkForUpdate).toHaveBeenCalledTimes(2);
  });

  it('si la búsqueda falla (sin conexión) no rompe nada y lo intenta en la próxima', async () => {
    checkForUpdate.mockRejectedValueOnce(new Error('sin conexión'));
    iniciar();

    document.dispatchEvent(new Event('visibilitychange'));
    await asentar();
    document.dispatchEvent(new Event('visibilitychange'));
    await asentar();

    expect(checkForUpdate).toHaveBeenCalledTimes(2);
    expect(problema).not.toHaveBeenCalled();
  });

  it('si no se pudo activar la versión avisa y no recarga', async () => {
    activateUpdate.mockRejectedValue(new Error('falló'));
    iniciar();

    versionUpdates.next(versionLista);
    await asentar();

    expect(problema).toHaveBeenCalledTimes(1);
    expect(recargar).not.toHaveBeenCalled();
  });

  it('si el service worker no contesta la activación, recarga igual en pocos segundos', async () => {
    vi.useFakeTimers();
    activateUpdate.mockReturnValue(new Promise(() => undefined));
    iniciar();

    versionUpdates.next(versionLista);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(recargar).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(problema).not.toHaveBeenCalled();
  });

  it('tras actualizar, la aplicación recién recargada avisa una sola vez que ya tiene la versión nueva', async () => {
    iniciar();
    versionUpdates.next(versionLista);
    await asentar();
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(aviso).not.toHaveBeenCalled();

    detener?.();
    TestBed.resetTestingModule();
    iniciar();
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(aviso.mock.calls[0][0]).toContain('versión nueva');

    detener?.();
    TestBed.resetTestingModule();
    iniciar();
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it('una recarga por falla del service worker no dice que se actualizó', async () => {
    iniciar();
    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'archivo dañado' });
    await asentar();

    detener?.();
    TestBed.resetTestingModule();
    iniciar();

    expect(aviso).not.toHaveBeenCalled();
  });

  it('si el service worker queda en un estado irrecuperable lo explica y recarga', async () => {
    iniciar();

    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'archivo dañado' });
    await asentar();

    expect(informar).toHaveBeenCalledTimes(1);
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('sin service worker (desarrollo) no escucha ni busca nada', async () => {
    iniciar(false);

    versionUpdates.next(versionLista);
    document.dispatchEvent(new Event('visibilitychange'));
    await asentar();

    expect(confirmar).not.toHaveBeenCalled();
    expect(checkForUpdate).not.toHaveBeenCalled();
  });

  it('iniciar dos veces no duplica los avisos', async () => {
    const actualizador = crear();
    detener = actualizador.iniciar();
    actualizador.iniciar();

    versionUpdates.next(versionLista);
    await asentar();

    expect(confirmar).toHaveBeenCalledTimes(1);
  });

  it('al detenerlo deja de escuchar', async () => {
    iniciar();
    detener!();
    detener = null;

    versionUpdates.next(versionLista);
    document.dispatchEvent(new Event('visibilitychange'));
    await asentar();

    expect(confirmar).not.toHaveBeenCalled();
    expect(checkForUpdate).not.toHaveBeenCalled();
  });
});

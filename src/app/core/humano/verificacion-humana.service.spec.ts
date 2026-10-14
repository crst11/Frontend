import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { Turnstile, VerificacionHumana } from './verificacion-humana.service';

type VentanaDePrueba = Window & { turnstile?: Turnstile };

describe('VerificacionHumana', () => {
  const llaveOriginal = environment.turnstileLlave;
  let callback: (prueba: string) => void = () => undefined;
  let turnstile: { render: ReturnType<typeof vi.fn>; reset: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    environment.turnstileLlave = 'llave-publica';
    turnstile = {
      render: vi.fn().mockImplementation((_contenedor: HTMLElement, opciones: { callback: (p: string) => void }) => {
        callback = opciones.callback;
        return 'widget-1';
      }),
      reset: vi.fn(),
    };
    (window as VentanaDePrueba).turnstile = turnstile as unknown as Turnstile;
  });

  afterEach(() => {
    environment.turnstileLlave = llaveOriginal;
    delete (window as VentanaDePrueba).turnstile;
    document.body.querySelectorAll('div[style*="position: fixed"]').forEach((e) => e.remove());
    vi.useRealTimers();
  });

  function crear(): VerificacionHumana {
    return TestBed.inject(VerificacionHumana);
  }

  it('sin llave configurada está apagada: no descarga ni dibuja nada', async () => {
    environment.turnstileLlave = '';
    const humana = crear();

    expect(humana.disponible).toBe(false);
    expect(await humana.obtenerPrueba()).toBeNull();
    expect(turnstile.render).not.toHaveBeenCalled();
  });

  it('dibuja el widget una sola vez, abajo, y entrega la prueba que Cloudflare da', async () => {
    const humana = crear();

    const pedida = humana.obtenerPrueba();
    await vi.waitFor(() => expect(turnstile.render).toHaveBeenCalledTimes(1));
    callback('prueba-1');

    expect(await pedida).toBe('prueba-1');
    expect(turnstile.render.mock.calls[0][1]).toMatchObject({ sitekey: 'llave-publica', appearance: 'interaction-only', language: 'es' });
  });

  it('cada prueba vale una sola vez: al entregarla pide la siguiente y no reutiliza la vieja', async () => {
    const humana = crear();
    const primera = humana.obtenerPrueba();
    await vi.waitFor(() => expect(turnstile.render).toHaveBeenCalled());
    callback('prueba-1');
    expect(await primera).toBe('prueba-1');
    expect(turnstile.reset).toHaveBeenCalledWith('widget-1');

    const segunda = humana.obtenerPrueba();
    await vi.waitFor(() => undefined);
    callback('prueba-2');

    expect(await segunda).toBe('prueba-2');
    expect(turnstile.render).toHaveBeenCalledTimes(1);
  });

  it('si Cloudflare no entrega nada a tiempo devuelve nulo y no se queda colgado', async () => {
    vi.useFakeTimers();
    const humana = crear();

    const pedida = humana.obtenerPrueba();
    await vi.advanceTimersByTimeAsync(11_000);

    expect(await pedida).toBeNull();
  });

  it('si no se puede descargar Turnstile devuelve nulo para que la petición salga igual', async () => {
    delete (window as VentanaDePrueba).turnstile;
    const humana = crear();

    const pedida = humana.obtenerPrueba();
    await vi.waitFor(() => expect(document.head.querySelector('script[src*="challenges.cloudflare.com"]')).not.toBeNull());
    document.head.querySelector('script[src*="challenges.cloudflare.com"]')!.dispatchEvent(new Event('error'));

    expect(await pedida).toBeNull();
    document.head.querySelectorAll('script[src*="challenges.cloudflare.com"]').forEach((s) => s.remove());
  });
});

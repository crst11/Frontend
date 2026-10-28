import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { VersionDeLaApp, leerVersion } from './version-de-la-app';

function respuesta(cuerpo: string, estado = 200): Response {
  return new Response(cuerpo, { status: estado });
}

describe('leerVersion (SCRUM-272)', () => {
  it('devuelve la versión que publicó el despliegue', async () => {
    const obtener = vi.fn().mockResolvedValue(respuesta('{"version":"db43b76"}'));

    expect(await leerVersion(obtener)).toBe('db43b76');
  });

  it('la pide sin caché, para ver siempre la versión que está sirviendo el sitio', async () => {
    const obtener = vi.fn().mockResolvedValue(respuesta('{"version":"db43b76"}'));

    await leerVersion(obtener);

    expect(obtener).toHaveBeenCalledWith('/version.json', expect.objectContaining({ cache: 'no-store' }));
  });

  it('sin archivo (el hosting devuelve la página de inicio con 200) no hay versión', async () => {
    const obtener = vi.fn().mockResolvedValue(respuesta('<!doctype html><html></html>'));

    expect(await leerVersion(obtener)).toBeNull();
  });

  it('con un error del servidor no hay versión', async () => {
    const obtener = vi.fn().mockResolvedValue(respuesta('{"version":"db43b76"}', 503));

    expect(await leerVersion(obtener)).toBeNull();
  });

  it('sin red no hay versión y no lanza error', async () => {
    const obtener = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await leerVersion(obtener)).toBeNull();
  });

  it.each([
    ['sin el campo', '{}'],
    ['que no es texto', '{"version":12}'],
    ['vacía', '{"version":""}'],
    ['con etiquetas', '{"version":"<script>alert(1)</script>"}'],
    ['con espacios', '{"version":"db43 b76"}'],
    ['demasiado larga', `{"version":"${'a'.repeat(41)}"}`],
  ])('descarta una versión %s', async (_caso, cuerpo) => {
    const obtener = vi.fn().mockResolvedValue(respuesta(cuerpo));

    expect(await leerVersion(obtener)).toBeNull();
  });
});

describe('VersionDeLaApp (SCRUM-272)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('empieza sin versión y la tiene después de cargar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta('{"version":"db43b76"}')));
    const servicio = TestBed.inject(VersionDeLaApp);
    expect(servicio.version()).toBeNull();

    await servicio.cargar();

    expect(servicio.version()).toBe('db43b76');
  });

  it('carga una sola vez aunque se abra el menú muchas veces', async () => {
    const obtener = vi.fn().mockResolvedValue(respuesta('{"version":"db43b76"}'));
    vi.stubGlobal('fetch', obtener);
    const servicio = TestBed.inject(VersionDeLaApp);

    await servicio.cargar();
    await servicio.cargar();

    expect(obtener).toHaveBeenCalledTimes(1);
  });

  it('si no se pudo leer, la próxima vez que se abra el menú lo vuelve a intentar', async () => {
    const obtener = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(respuesta('{"version":"db43b76"}'));
    vi.stubGlobal('fetch', obtener);
    const servicio = TestBed.inject(VersionDeLaApp);

    await servicio.cargar();
    expect(servicio.version()).toBeNull();
    await servicio.cargar();

    expect(servicio.version()).toBe('db43b76');
  });
});

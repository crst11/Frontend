import { vi } from 'vitest';
import {
  CLAVE_DE_LA_COPIA,
  ConfiguracionDeEjecucion,
  leerConfiguracion,
} from './configuracion-en-ejecucion';

describe('leerConfiguracion', () => {
  const base: ConfiguracionDeEjecucion = {
    apiUrl: '/api',
    googleClientId: 'cliente-del-bundle',
    turnstileLlave: '',
    urlConsultaDeHorarios: 'https://universidad.example/horarios',
  };

  function respuesta(cuerpo: unknown, ok = true, status = ok ? 200 : 404): Response {
    return {
      ok,
      status,
      json: () => (typeof cuerpo === 'string' ? Promise.reject(new SyntaxError('no es JSON')) : Promise.resolve(cuerpo)),
    } as unknown as Response;
  }

  function almacenEnMemoria(inicial: Record<string, string> = {}) {
    const datos = new Map(Object.entries(inicial));
    return {
      getItem: vi.fn((clave: string) => datos.get(clave) ?? null),
      setItem: vi.fn((clave: string, valor: string) => void datos.set(clave, valor)),
      datos,
    };
  }

  it('lo que trae config.json reemplaza a los valores del bundle', async () => {
    const obtener = vi.fn().mockResolvedValue(respuesta({ googleClientId: 'cliente-de-preproduccion', turnstileLlave: 'llave-pre' }));

    const config = await leerConfiguracion(base, obtener, almacenEnMemoria());

    expect(config).toEqual({ ...base, googleClientId: 'cliente-de-preproduccion', turnstileLlave: 'llave-pre' });
  });

  it('pide config.json sin usar el caché del navegador', async () => {
    const obtener = vi.fn().mockResolvedValue(respuesta({}));

    await leerConfiguracion(base, obtener, almacenEnMemoria());

    expect(obtener).toHaveBeenCalledWith('/config.json', expect.objectContaining({ cache: 'no-store' }));
  });

  it('una cadena vacía se respeta: es la forma de apagar Google o Turnstile en un ambiente', async () => {
    const obtener = vi.fn().mockResolvedValue(respuesta({ googleClientId: '' }));

    const config = await leerConfiguracion(base, obtener, almacenEnMemoria());

    expect(config.googleClientId).toBe('');
  });

  it('ignora lo que no conoce y lo que no es una cadena', async () => {
    const obtener = vi.fn().mockResolvedValue(
      respuesta({ googleClientId: 42, turnstileLlave: ['x'], algoNuevo: 'zzz', apiUrl: null }),
    );

    const config = await leerConfiguracion(base, obtener, almacenEnMemoria());

    expect(config).toEqual(base);
    expect(config).not.toHaveProperty('algoNuevo');
  });

  it('rechaza una apiUrl que no sea una ruta ni una dirección http(s)', async () => {
    for (const rara of ['javascript:alert(1)', 'data:text/html,hola', 'api sin barra', '//otro-sitio.com/api']) {
      const obtener = vi.fn().mockResolvedValue(respuesta({ apiUrl: rara }));

      const config = await leerConfiguracion(base, obtener, almacenEnMemoria());

      expect(config.apiUrl, rara).toBe('/api');
    }
  });

  it('acepta una apiUrl relativa o una dirección https', async () => {
    const obtener = vi.fn().mockResolvedValue(respuesta({ apiUrl: 'https://api.ejemplo.edu.co/api' }));

    expect((await leerConfiguracion(base, obtener, almacenEnMemoria())).apiUrl).toBe('https://api.ejemplo.edu.co/api');
  });

  it('si el servidor devuelve index.html en vez de JSON (ruta de Angular), usa el bundle', async () => {
    const obtener = vi.fn().mockResolvedValue(respuesta('<!doctype html>'));

    expect(await leerConfiguracion(base, obtener, almacenEnMemoria())).toEqual(base);
  });

  it('si config.json no existe (404), usa el bundle', async () => {
    const obtener = vi.fn().mockResolvedValue(respuesta({ googleClientId: 'no-debe-usarse' }, false));

    expect(await leerConfiguracion(base, obtener, almacenEnMemoria())).toEqual(base);
  });

  it('si el JSON no es un objeto, usa el bundle', async () => {
    for (const raro of [null, 12, ['a']]) {
      const obtener = vi.fn().mockResolvedValue(respuesta(raro));

      expect(await leerConfiguracion(base, obtener, almacenEnMemoria())).toEqual(base);
    }
  });

  it('si el servidor responde que no hay config.json (404), olvida la copia vieja y usa el bundle', async () => {
    const almacen = almacenEnMemoria({ [CLAVE_DE_LA_COPIA]: JSON.stringify({ apiUrl: '/api-que-ya-no-existe' }) });
    const obtener = vi.fn().mockResolvedValue(respuesta({}, false, 404));

    const config = await leerConfiguracion(base, obtener, almacen);

    expect(config).toEqual(base);
    expect(JSON.parse(almacen.datos.get(CLAVE_DE_LA_COPIA) ?? 'null')).toEqual({});
  });

  it('si el hosting devuelve index.html en vez de config.json, olvida la copia vieja y usa el bundle', async () => {
    const almacen = almacenEnMemoria({ [CLAVE_DE_LA_COPIA]: JSON.stringify({ apiUrl: '/api-que-ya-no-existe' }) });
    const obtener = vi.fn().mockResolvedValue(respuesta('<!doctype html>'));

    expect(await leerConfiguracion(base, obtener, almacen)).toEqual(base);
    expect(JSON.parse(almacen.datos.get(CLAVE_DE_LA_COPIA) ?? 'null')).toEqual({});
  });

  it('si el servidor falla (503), todavía no sabe nada: usa la copia', async () => {
    const almacen = almacenEnMemoria({ [CLAVE_DE_LA_COPIA]: JSON.stringify({ turnstileLlave: 'llave-pre' }) });
    const obtener = vi.fn().mockResolvedValue(respuesta({}, false, 503));

    expect(await leerConfiguracion(base, obtener, almacen)).toEqual({ ...base, turnstileLlave: 'llave-pre' });
  });

  it('guarda una copia de lo bueno y la usa cuando no hay red', async () => {
    const almacen = almacenEnMemoria();
    await leerConfiguracion(base, vi.fn().mockResolvedValue(respuesta({ turnstileLlave: 'llave-pre' })), almacen);
    const sinRed = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const config = await leerConfiguracion(base, sinRed, almacen);

    expect(config).toEqual({ ...base, turnstileLlave: 'llave-pre' });
  });

  it('sin red y sin copia, usa el bundle', async () => {
    const sinRed = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await leerConfiguracion(base, sinRed, almacenEnMemoria())).toEqual(base);
  });

  it('una copia dañada se ignora', async () => {
    const sinRed = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const almacen = almacenEnMemoria({ [CLAVE_DE_LA_COPIA]: '{esto no es json' });

    expect(await leerConfiguracion(base, sinRed, almacen)).toEqual(base);
  });

  it('lo recién descargado manda sobre la copia vieja', async () => {
    const almacen = almacenEnMemoria({ [CLAVE_DE_LA_COPIA]: JSON.stringify({ googleClientId: 'viejo', turnstileLlave: 'vieja' }) });
    const obtener = vi.fn().mockResolvedValue(respuesta({ googleClientId: 'nuevo' }));

    const config = await leerConfiguracion(base, obtener, almacen);

    expect(config.googleClientId).toBe('nuevo');
  });

  it('un almacenamiento que falla (modo privado) no impide arrancar', async () => {
    const roto = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    const obtener = vi.fn().mockResolvedValue(respuesta({ googleClientId: 'cliente-pre' }));

    expect((await leerConfiguracion(base, obtener, roto)).googleClientId).toBe('cliente-pre');
  });

  it('sin almacenamiento disponible tampoco falla', async () => {
    const obtener = vi.fn().mockResolvedValue(respuesta({ googleClientId: 'cliente-pre' }));

    expect((await leerConfiguracion(base, obtener, null)).googleClientId).toBe('cliente-pre');
  });

  it('no modifica el objeto base que recibe', async () => {
    const original = { ...base };
    const obtener = vi.fn().mockResolvedValue(respuesta({ googleClientId: 'otro' }));

    await leerConfiguracion(original, obtener, almacenEnMemoria());

    expect(original).toEqual(base);
  });
});

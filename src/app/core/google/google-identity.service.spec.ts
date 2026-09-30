import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { GoogleAccountsId, GoogleIdentityService } from './google-identity.service';

type VentanaDePrueba = Window & { google?: { accounts: { id: GoogleAccountsId } } };

describe('GoogleIdentityService', () => {
  const ventana = window as VentanaDePrueba;
  let googleFalso: { initialize: ReturnType<typeof vi.fn>; renderButton: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    googleFalso = { initialize: vi.fn(), renderButton: vi.fn() };
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    delete ventana.google;
    document.head.querySelectorAll('script[src*="accounts.google.com"]').forEach((s) => s.remove());
  });

  function callbackDeGoogle(): (respuesta: { credential: string }) => void {
    return googleFalso.initialize.mock.calls[0][0].callback;
  }

  it('dibuja el botón oficial en el contenedor y entrega el ID token al elegir cuenta', async () => {
    ventana.google = { accounts: { id: googleFalso as unknown as GoogleAccountsId } };
    const servicio = TestBed.inject(GoogleIdentityService);
    const contenedor = document.createElement('div');
    const alElegir = vi.fn();

    await servicio.dibujarBoton(contenedor, 'continue_with', alElegir);
    callbackDeGoogle()({ credential: 'id-token-de-google' });

    expect(googleFalso.renderButton).toHaveBeenCalledWith(
      contenedor,
      expect.objectContaining({ text: 'continue_with', theme: 'outline', locale: 'es' }),
    );
    expect(alElegir).toHaveBeenCalledWith('id-token-de-google');
  });

  it('inicializa Google una sola vez y el token va a la última pantalla que dibujó el botón', async () => {
    ventana.google = { accounts: { id: googleFalso as unknown as GoogleAccountsId } };
    const servicio = TestBed.inject(GoogleIdentityService);
    const deLogin = vi.fn();
    const deMiCuenta = vi.fn();

    await servicio.dibujarBoton(document.createElement('div'), 'continue_with', deLogin);
    await servicio.dibujarBoton(document.createElement('div'), 'continue_with', deMiCuenta);
    callbackDeGoogle()({ credential: 'token' });

    expect(googleFalso.initialize).toHaveBeenCalledTimes(1);
    expect(deMiCuenta).toHaveBeenCalledWith('token');
    expect(deLogin).not.toHaveBeenCalled();
  });

  it('descarga la librería de Google solo cuando hace falta un botón', async () => {
    const servicio = TestBed.inject(GoogleIdentityService);
    expect(document.head.querySelector('script[src*="accounts.google.com"]')).toBeNull();

    const dibujo = servicio.dibujarBoton(document.createElement('div'), 'continue_with', vi.fn());
    const script = document.head.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')!;
    ventana.google = { accounts: { id: googleFalso as unknown as GoogleAccountsId } };
    script.dispatchEvent(new Event('load'));
    await dibujo;

    expect(googleFalso.renderButton).toHaveBeenCalled();
  });

  it('si la librería no se puede descargar, falla y el siguiente intento la pide otra vez', async () => {
    const servicio = TestBed.inject(GoogleIdentityService);

    const primero = servicio.dibujarBoton(document.createElement('div'), 'continue_with', vi.fn());
    document.head.querySelector('script[src*="accounts.google.com"]')!.dispatchEvent(new Event('error'));
    await expect(primero).rejects.toThrow('No se pudo descargar');

    void servicio.dibujarBoton(document.createElement('div'), 'continue_with', vi.fn()).catch(() => undefined);
    expect(document.head.querySelectorAll('script[src*="accounts.google.com"]').length).toBe(2);
  });
});

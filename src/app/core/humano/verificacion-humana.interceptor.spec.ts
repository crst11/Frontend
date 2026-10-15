import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { verificacionHumanaInterceptor } from './verificacion-humana.interceptor';
import { VerificacionHumana } from './verificacion-humana.service';

describe('verificacionHumanaInterceptor', () => {
  const publico = `${environment.apiUrl}/publico/auth`;

  function preparar(humana: { disponible: boolean; obtenerPrueba: () => Promise<string | null> }) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([verificacionHumanaInterceptor])),
        provideHttpClientTesting(),
        { provide: VerificacionHumana, useValue: humana },
      ],
    });
    return { http: TestBed.inject(HttpClient), controlador: TestBed.inject(HttpTestingController) };
  }

  it('pide una prueba por cada petición al iniciar sesión, registrarse y pedir la recuperación', async () => {
    const humana = { disponible: true, obtenerPrueba: vi.fn().mockResolvedValue('prueba-1') };
    const { http, controlador } = preparar(humana);

    for (const ruta of ['login', 'registro', 'recuperacion']) {
      http.post(`${publico}/${ruta}`, {}).subscribe();
      await vi.waitFor(() => controlador.expectOne(`${publico}/${ruta}`));
    }

    // Cada prueba vale una sola vez: no se reutiliza.
    expect(humana.obtenerPrueba).toHaveBeenCalledTimes(3);
  });

  it('el encabezado lleva la prueba', async () => {
    const { http, controlador } = preparar({ disponible: true, obtenerPrueba: async () => 'prueba-1' });

    http.post(`${publico}/login`, {}).subscribe();
    const peticion = await vi.waitFor(() => controlador.expectOne(`${publico}/login`));

    expect(peticion.request.headers.get('X-Verificacion-Humana')).toBe('prueba-1');
  });

  it('si no se pudo conseguir la prueba la petición sale igual, sin encabezado', async () => {
    const { http, controlador } = preparar({ disponible: true, obtenerPrueba: async () => null });

    http.post(`${publico}/login`, {}).subscribe();
    const peticion = await vi.waitFor(() => controlador.expectOne(`${publico}/login`));

    expect(peticion.request.headers.has('X-Verificacion-Humana')).toBe(false);
  });

  it('apagada no pide nada y no toca la petición', () => {
    const humana = { disponible: false, obtenerPrueba: vi.fn() };
    const { http, controlador } = preparar(humana);

    http.post(`${publico}/login`, {}).subscribe();

    const peticion = controlador.expectOne(`${publico}/login`);
    expect(peticion.request.headers.has('X-Verificacion-Humana')).toBe(false);
    expect(humana.obtenerPrueba).not.toHaveBeenCalled();
  });

  it('no se mete con las demás rutas: la confirmación de la recuperación, el refresco, los GET y lo protegido', () => {
    const humana = { disponible: true, obtenerPrueba: vi.fn() };
    const { http, controlador } = preparar(humana);

    http.post(`${publico}/recuperacion/confirmacion`, {}).subscribe();
    http.post(`${publico}/refresco`, {}).subscribe();
    http.get(`${publico}/login`).subscribe();
    http.post(`${environment.apiUrl}/mis/importaciones/analisis`, {}).subscribe();

    expect(controlador.match(() => true)).toHaveLength(4);
    expect(humana.obtenerPrueba).not.toHaveBeenCalled();
  });
});

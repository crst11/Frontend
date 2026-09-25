import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { sessionInterceptor } from './session.interceptor';
import { SessionService } from './session.service';

describe('sessionInterceptor', () => {
  let http: HttpClient;
  let controlador: HttpTestingController;
  const sesion = { token: vi.fn(), renovar: vi.fn(), limpiar: vi.fn() };
  const router = { navigate: vi.fn().mockResolvedValue(true) };

  beforeEach(() => {
    sesion.token.mockReset().mockReturnValue('jwt-viejo');
    sesion.renovar.mockReset();
    sesion.limpiar.mockReset();
    router.navigate.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([sessionInterceptor])),
        provideHttpClientTesting(),
        { provide: SessionService, useValue: sesion },
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    controlador = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controlador.verify());

  it('agrega el token a las llamadas protegidas de la API', () => {
    http.get(`${environment.apiUrl}/mis/cuenta`).subscribe();

    const peticion = controlador.expectOne(`${environment.apiUrl}/mis/cuenta`);
    expect(peticion.request.headers.get('Authorization')).toBe('Bearer jwt-viejo');
    peticion.flush({});
  });

  it('no manda el token a las rutas públicas ni a otros sitios', () => {
    http.get(`${environment.apiUrl}/publico/guia/categorias`).subscribe();
    http.get('https://otro-sitio.com/datos').subscribe();

    expect(controlador.expectOne(`${environment.apiUrl}/publico/guia/categorias`).request.headers.has('Authorization')).toBe(false);
    expect(controlador.expectOne('https://otro-sitio.com/datos').request.headers.has('Authorization')).toBe(false);
  });

  it('ante un 401 renueva la sesión una vez y repite la llamada con el token nuevo', () => {
    sesion.renovar.mockImplementation(() => {
      sesion.token.mockReturnValue('jwt-nuevo');
      return of('jwt-nuevo');
    });
    let respuesta: unknown;
    http.get(`${environment.apiUrl}/mis/cuenta`).subscribe((r) => (respuesta = r));

    controlador.expectOne(`${environment.apiUrl}/mis/cuenta`).flush(null, { status: 401, statusText: 'No autorizado' });
    const repetida = controlador.expectOne(`${environment.apiUrl}/mis/cuenta`);
    expect(repetida.request.headers.get('Authorization')).toBe('Bearer jwt-nuevo');
    repetida.flush({ id: 1 });

    expect(sesion.renovar).toHaveBeenCalledTimes(1);
    expect(respuesta).toEqual({ id: 1 });
  });

  it('si la renovación falla, cierra la sesión local y manda a iniciar sesión', () => {
    sesion.renovar.mockReturnValue(throwError(() => new Error('401')));
    let fallo = false;
    http.get(`${environment.apiUrl}/mis/cuenta`).subscribe({ error: () => (fallo = true) });

    controlador.expectOne(`${environment.apiUrl}/mis/cuenta`).flush(null, { status: 401, statusText: 'No autorizado' });

    expect(fallo).toBe(true);
    expect(sesion.limpiar).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/cuenta/entrar']);
  });

  it('no intenta renovar por errores que no son 401', () => {
    let estado = 0;
    http.get(`${environment.apiUrl}/mis/cuenta`).subscribe({ error: (e) => (estado = e.status) });

    controlador.expectOne(`${environment.apiUrl}/mis/cuenta`).flush(null, { status: 500, statusText: 'Error' });

    expect(estado).toBe(500);
    expect(sesion.renovar).not.toHaveBeenCalled();
  });
});

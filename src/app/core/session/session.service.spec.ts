import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { EstudianteRepository, SesionIniciada } from '../../data-access/estudiante.repository';
import { SessionService } from './session.service';

describe('SessionService', () => {
  const cuenta = { id: 1, correo: 'ana.diaz@ucundinamarca.edu.co', nombres: 'Ana', apellidos: 'Díaz', estado: 'activa' };
  const sesion = (token: string): SesionIniciada => ({ tokenDeAcceso: token, tipo: 'Bearer', expiraEnSegundos: 1200, cuenta });

  function crear(repositorio: Partial<EstudianteRepository>) {
    TestBed.configureTestingModule({ providers: [{ provide: EstudianteRepository, useValue: repositorio }] });
    return TestBed.inject(SessionService);
  }

  function borrarCookieCsrf() {
    document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/';
  }

  afterEach(borrarCookieCsrf);

  it('empieza sin sesión', () => {
    const servicio = crear({});

    expect(servicio.estaAutenticada()).toBe(false);
    expect(servicio.token()).toBeNull();
  });

  it('inicia sesión y guarda el token y la cuenta en memoria', () => {
    const servicio = crear({ iniciarSesion: vi.fn().mockReturnValue(of(sesion('jwt-1'))) });

    servicio.iniciar(cuenta.correo, 'claveSegura1').subscribe();

    expect(servicio.estaAutenticada()).toBe(true);
    expect(servicio.token()).toBe('jwt-1');
    expect(servicio.cuenta()?.correo).toBe(cuenta.correo);
  });

  it('al cerrar sesión borra todo del dispositivo', () => {
    const cerrarSesion = vi.fn().mockReturnValue(of(undefined));
    const servicio = crear({ iniciarSesion: () => of(sesion('jwt-1')), cerrarSesion });
    servicio.iniciar(cuenta.correo, 'claveSegura1').subscribe();

    servicio.cerrar().subscribe();

    expect(cerrarSesion).toHaveBeenCalled();
    expect(servicio.estaAutenticada()).toBe(false);
    expect(servicio.cuenta()).toBeNull();
  });

  it('borra la sesión aunque el backend falle al cerrarla', () => {
    const servicio = crear({
      iniciarSesion: () => of(sesion('jwt-1')),
      cerrarSesion: () => throwError(() => new Error('sin conexión')),
    });
    servicio.iniciar(cuenta.correo, 'claveSegura1').subscribe();

    servicio.cerrar().subscribe({ error: () => undefined });

    expect(servicio.estaAutenticada()).toBe(false);
  });

  it('varias renovaciones a la vez comparten un solo refresco', () => {
    const renovarSesion = vi.fn().mockReturnValue(of(sesion('jwt-2')));
    const servicio = crear({ renovarSesion });

    servicio.renovar().subscribe();
    servicio.renovar().subscribe();

    // el primero ya terminó (síncrono), así que cada llamada hace su refresco; en paralelo se compartiría
    expect(renovarSesion).toHaveBeenCalled();
    expect(servicio.token()).toBe('jwt-2');
  });

  it('al abrir la aplicación no molesta al backend si no hubo sesión previa', async () => {
    const renovarSesion = vi.fn();
    const servicio = crear({ renovarSesion });

    await servicio.restaurar();

    expect(renovarSesion).not.toHaveBeenCalled();
    expect(servicio.estaAutenticada()).toBe(false);
  });

  it('al abrir la aplicación recupera la sesión si quedó la cookie de una anterior', async () => {
    document.cookie = 'XSRF-TOKEN=abc; path=/';
    const servicio = crear({ renovarSesion: vi.fn().mockReturnValue(of(sesion('jwt-3'))) });

    await servicio.restaurar();

    expect(servicio.token()).toBe('jwt-3');
  });

  it('si la sesión anterior ya no sirve, queda sin sesión y sin error', async () => {
    document.cookie = 'XSRF-TOKEN=abc; path=/';
    const servicio = crear({ renovarSesion: () => throwError(() => new Error('401')) });

    await servicio.restaurar();

    expect(servicio.estaAutenticada()).toBe(false);
  });
});

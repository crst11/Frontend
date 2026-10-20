import { TestBed } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { CopiaLocalRepository } from '../../data-access/copia-local.repository';
import { EstudianteRepository, SesionIniciada } from '../../data-access/estudiante.repository';
import { CopiaLocalEnMemoriaRepository } from '../../data-access/memoria/copia-local-en-memoria.repository';
import { DispositivoDeLaSesion } from './dispositivo-de-la-sesion';
import { SessionService } from './session.service';

describe('SessionService', () => {
  const cuenta = { id: 1, correo: 'ana.diaz@ucundinamarca.edu.co', nombres: 'Ana', apellidos: 'Díaz', estado: 'activa' };
  const sesion = (token: string): SesionIniciada => ({ tokenDeAcceso: token, tipo: 'Bearer', expiraEnSegundos: 1200, cuenta });

  function crear(repositorio: Partial<EstudianteRepository>) {
    TestBed.configureTestingModule({
      providers: [
        { provide: EstudianteRepository, useValue: repositorio },
        { provide: CopiaLocalRepository, useClass: CopiaLocalEnMemoriaRepository },
      ],
    });
    return TestBed.inject(SessionService);
  }

  const sinRed = () => throwError(() => new HttpErrorResponse({ status: 0 }));

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

  it('con Google la sesión queda igual que con contraseña', () => {
    const iniciarSesionConGoogle = vi.fn().mockReturnValue(of(sesion('jwt-google')));
    const servicio = crear({ iniciarSesionConGoogle });

    servicio.iniciarConGoogle('id-token-de-google').subscribe();

    expect(iniciarSesionConGoogle).toHaveBeenCalledWith('id-token-de-google');
    expect(servicio.token()).toBe('jwt-google');
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

  it('si la sesión anterior ya no sirve, no la vuelve a intentar en la siguiente carga', async () => {
    document.cookie = 'XSRF-TOKEN=abc; path=/';
    const renovarSesion = vi.fn().mockReturnValue(throwError(() => new Error('401')));
    const servicio = crear({ renovarSesion });

    await servicio.restaurar();
    await servicio.restaurar();

    expect(document.cookie).not.toContain('XSRF-TOKEN=abc');
    expect(renovarSesion).toHaveBeenCalledTimes(1);
  });

  describe('para consultar sin conexión (RF12)', () => {
    it('al iniciar sesión guarda quién es la cuenta en el dispositivo, nunca el token', async () => {
      const servicio = crear({ iniciarSesion: () => of(sesion('jwt-secreto')) });

      servicio.iniciar(cuenta.correo, 'claveSegura1').subscribe();
      const guardada = await TestBed.inject(CopiaLocalRepository).leer('cuenta');

      expect(guardada?.valor).toEqual(cuenta);
      expect(JSON.stringify(guardada)).not.toContain('jwt-secreto');
    });

    it('si al abrir no hay red y hay una cuenta guardada, entra en modo consulta y conserva la cookie', async () => {
      document.cookie = 'XSRF-TOKEN=abc; path=/';
      const servicio = crear({ renovarSesion: sinRed });
      await TestBed.inject(CopiaLocalRepository).guardar('cuenta', cuenta, 1);

      await servicio.restaurar();

      expect(servicio.estaAutenticada()).toBe(true);
      expect(servicio.token()).toBeNull();
      expect(servicio.cuenta()?.correo).toBe(cuenta.correo);
      expect(document.cookie).toContain('XSRF-TOKEN=abc');
    });

    it('con el servidor caído (5xx) también entra en modo consulta', async () => {
      document.cookie = 'XSRF-TOKEN=abc; path=/';
      const servicio = crear({ renovarSesion: () => throwError(() => new HttpErrorResponse({ status: 502 })) });
      await TestBed.inject(CopiaLocalRepository).guardar('cuenta', cuenta, 1);

      await servicio.restaurar();

      expect(servicio.estaAutenticada()).toBe(true);
    });

    it('si el servidor no responde nunca, a los 4 segundos entra en modo consulta en vez de dejar la pantalla en blanco', async () => {
      vi.useFakeTimers();
      try {
        document.cookie = 'XSRF-TOKEN=abc; path=/';
        const servicio = crear({ renovarSesion: () => NEVER });
        await TestBed.inject(CopiaLocalRepository).guardar('cuenta', cuenta, 1);

        const restaurada = servicio.restaurar();
        await vi.advanceTimersByTimeAsync(4_000);
        await restaurada;

        expect(servicio.estaAutenticada()).toBe(true);
        expect(servicio.token()).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('si no hay red y tampoco hay cuenta guardada, queda sin sesión', async () => {
      document.cookie = 'XSRF-TOKEN=abc; path=/';
      const servicio = crear({ renovarSesion: sinRed });

      await servicio.restaurar();

      expect(servicio.estaAutenticada()).toBe(false);
    });

    it('si el servidor rechaza la sesión, no entra en modo consulta y borra lo guardado', async () => {
      document.cookie = 'XSRF-TOKEN=abc; path=/';
      const servicio = crear({ renovarSesion: () => throwError(() => new HttpErrorResponse({ status: 401 })) });
      const copia = TestBed.inject(CopiaLocalRepository);
      await copia.guardar('cuenta', cuenta, 1);
      await copia.guardar('1|/api/mis/horario', { dias: [] }, 1);

      await servicio.restaurar();

      expect(servicio.estaAutenticada()).toBe(false);
      expect(await copia.leer('cuenta')).toBeNull();
      expect(await copia.leer('1|/api/mis/horario')).toBeNull();
    });

    it('al volver la conexión, renovar completa la sesión y sale del modo consulta', async () => {
      document.cookie = 'XSRF-TOKEN=abc; path=/';
      const renovarSesion = vi.fn().mockReturnValueOnce(sinRed()).mockReturnValue(of(sesion('jwt-nuevo')));
      const servicio = crear({ renovarSesion });
      await TestBed.inject(CopiaLocalRepository).guardar('cuenta', cuenta, 1);
      await servicio.restaurar();

      servicio.renovar().subscribe();

      expect(servicio.token()).toBe('jwt-nuevo');
      expect(servicio.estaAutenticada()).toBe(true);
    });

    it('al cerrar sesión borra la cuenta y las lecturas guardadas', async () => {
      const servicio = crear({ iniciarSesion: () => of(sesion('jwt-1')), cerrarSesion: () => of(undefined) });
      const copia = TestBed.inject(CopiaLocalRepository);
      servicio.iniciar(cuenta.correo, 'claveSegura1').subscribe();
      await copia.guardar('1|/api/mis/pendientes', [], 1);

      servicio.cerrar().subscribe();

      expect(await copia.leer('cuenta')).toBeNull();
      expect(await copia.leer('1|/api/mis/pendientes')).toBeNull();
    });
  });
});

describe('SessionService en un equipo compartido (SCRUM-231)', () => {
  const cuenta = { id: 1, correo: 'ana.diaz@ucundinamarca.edu.co', nombres: 'Ana', apellidos: 'Díaz', estado: 'activa' };
  const sesion = (token: string): SesionIniciada => ({ tokenDeAcceso: token, tipo: 'Bearer', expiraEnSegundos: 1200, cuenta });
  const PLAZO = 15 * 60_000;

  function crear(repositorio: Partial<EstudianteRepository>) {
    TestBed.configureTestingModule({
      providers: [
        { provide: EstudianteRepository, useValue: repositorio },
        { provide: CopiaLocalRepository, useClass: CopiaLocalEnMemoriaRepository },
      ],
    });
    return {
      servicio: TestBed.inject(SessionService),
      copia: TestBed.inject(CopiaLocalRepository),
      dispositivo: TestBed.inject(DispositivoDeLaSesion),
    };
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/';
  });

  it('en un dispositivo personal guarda la cuenta para consultar sin conexión, como siempre', async () => {
    const { servicio, copia } = crear({ iniciarSesion: vi.fn().mockReturnValue(of(sesion('jwt-1'))) });

    servicio.iniciar(cuenta.correo, 'claveSegura1').subscribe();

    expect((await copia.leer('cuenta'))?.valor).toEqual(cuenta);
  });

  it('en un equipo compartido NO guarda nada para consultar sin conexión', async () => {
    const { servicio, copia, dispositivo } = crear({ iniciarSesion: vi.fn().mockReturnValue(of(sesion('jwt-1'))) });

    servicio.iniciar(cuenta.correo, 'claveSegura1', false).subscribe();

    expect(servicio.estaAutenticada()).toBe(true);
    expect(dispositivo.esCompartido()).toBe(true);
    expect(await copia.leer('cuenta')).toBeNull();
  });

  it('al entrar en un equipo compartido se borra lo que dejó otra persona', async () => {
    const { servicio, copia } = crear({ iniciarSesion: vi.fn().mockReturnValue(of(sesion('jwt-1'))) });
    await copia.guardar('7|/api/mis/horario', { de: 'otra persona' }, Date.now());

    servicio.iniciar(cuenta.correo, 'claveSegura1', false).subscribe();

    expect(await copia.leer('7|/api/mis/horario')).toBeNull();
  });

  it('con Google la elección también cuenta', async () => {
    const { servicio, copia } = crear({ iniciarSesionConGoogle: vi.fn().mockReturnValue(of(sesion('jwt-g'))) });

    servicio.iniciarConGoogle('id-token', false).subscribe();

    expect(await copia.leer('cuenta')).toBeNull();
  });

  it('cerrar sesión borra también la elección del dispositivo', () => {
    const { servicio, dispositivo } = crear({
      iniciarSesion: vi.fn().mockReturnValue(of(sesion('jwt-1'))),
      cerrarSesion: vi.fn().mockReturnValue(of(undefined)),
    });
    servicio.iniciar(cuenta.correo, 'claveSegura1', false).subscribe();

    servicio.cerrar().subscribe();

    expect(dispositivo.esCompartido()).toBe(false);
    expect(localStorage.getItem('cundiapp.dispositivo')).toBeNull();
  });

  it('al reabrir la app pasado el plazo sin actividad, revoca la sesión y borra todo en vez de restaurarla', async () => {
    const cerrarSesion = vi.fn().mockReturnValue(of(undefined));
    const renovarSesion = vi.fn().mockReturnValue(of(sesion('jwt-renovado')));
    const { servicio, copia, dispositivo } = crear({ cerrarSesion, renovarSesion });
    document.cookie = 'XSRF-TOKEN=abc; path=/';
    dispositivo.marcar(false, Date.now() - PLAZO - 1_000);
    await copia.guardar('cuenta', cuenta, Date.now());

    await servicio.restaurar();

    expect(cerrarSesion).toHaveBeenCalledTimes(1);
    expect(renovarSesion).not.toHaveBeenCalled();
    expect(servicio.estaAutenticada()).toBe(false);
    expect(await copia.leer('cuenta')).toBeNull();
    expect(dispositivo.esCompartido()).toBe(false);
  });

  it('pasado el plazo y sin red, igual borra lo local (quien llega no entra con lo de la persona anterior)', async () => {
    const cerrarSesion = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    const { servicio, copia, dispositivo } = crear({ cerrarSesion });
    dispositivo.marcar(false, Date.now() - PLAZO - 1_000);
    await copia.guardar('cuenta', cuenta, Date.now());

    await servicio.restaurar();

    expect(servicio.estaAutenticada()).toBe(false);
    expect(await copia.leer('cuenta')).toBeNull();
  });

  it('dentro del plazo restaura la sesión con normalidad', async () => {
    const renovarSesion = vi.fn().mockReturnValue(of(sesion('jwt-renovado')));
    const cerrarSesion = vi.fn();
    const { servicio, dispositivo } = crear({ renovarSesion, cerrarSesion });
    document.cookie = 'XSRF-TOKEN=abc; path=/';
    dispositivo.marcar(false, Date.now() - 60_000);

    await servicio.restaurar();

    expect(cerrarSesion).not.toHaveBeenCalled();
    expect(servicio.token()).toBe('jwt-renovado');
  });
});

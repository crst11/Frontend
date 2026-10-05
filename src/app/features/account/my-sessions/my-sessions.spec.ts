import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { SessionService } from '../../../core/session/session.service';
import { EstudianteRepository, DispositivoConSesion } from '../../../data-access/estudiante.repository';
import { MySessions } from './my-sessions';

describe('MySessions', () => {
  const EN_UNA_SEMANA = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const notificador = { confirmar: vi.fn(), aviso: vi.fn(), problema: vi.fn() };

  function sesion(consecutivo: number, cambios: Partial<DispositivoConSesion> = {}): DispositivoConSesion {
    return {
      consecutivo,
      metodo: 'local',
      primerAcceso: new Date().toISOString(),
      ultimoAcceso: new Date().toISOString(),
      fechaExpiracion: EN_UNA_SEMANA,
      dispositivo: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36',
      ip: '192.168.1.20',
      esLaActual: false,
      ...cambios,
    };
  }

  beforeEach(() => {
    notificador.confirmar.mockReset().mockResolvedValue(true);
    notificador.aviso.mockReset().mockResolvedValue(undefined);
    notificador.problema.mockReset().mockResolvedValue(undefined);
  });

  function crear(
    misSesiones: ReturnType<typeof vi.fn>,
    cerrarSesionEnDispositivo = vi.fn().mockReturnValue(of(undefined)),
    cerrarTodasMisSesiones = vi.fn().mockReturnValue(of(undefined)),
  ) {
    const limpiar = vi.fn();
    TestBed.configureTestingModule({
      imports: [MySessions],
      providers: [
        provideRouter([]),
        {
          provide: EstudianteRepository,
          useValue: { misSesiones, cerrarSesionEnDispositivo, cerrarTodasMisSesiones },
        },
        { provide: SessionService, useValue: { limpiar } },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    const fixture = TestBed.createComponent(MySessions);
    fixture.detectChanges();
    return {
      fixture,
      html: fixture.nativeElement as HTMLElement,
      cerrarSesionEnDispositivo,
      cerrarTodasMisSesiones,
      limpiar,
    };
  }

  function boton(html: HTMLElement, texto: string): HTMLButtonElement {
    return Array.from(html.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(texto),
    )!;
  }

  it('muestra un dispositivo reconocible por cada sesión abierta', () => {
    const { html } = crear(vi.fn().mockReturnValue(of([sesion(1), sesion(2, { dispositivo: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1' })])));

    expect(html.querySelectorAll('.sessions__item')).toHaveLength(2);
    expect(html.textContent).toContain('Chrome');
    expect(html.textContent).toContain('Windows');
    expect(html.textContent).toContain('Safari');
    expect(html.textContent).toContain('iPhone o iPad');
  });

  it('dice con qué método se entró y desde qué IP', () => {
    const { html } = crear(vi.fn().mockReturnValue(of([sesion(1, { metodo: 'google' })])));

    expect(html.textContent).toContain('Entró con Google');
    expect(html.textContent).toContain('192.168.1.20');
  });

  it('no inventa un nombre cuando el dispositivo llega vacío', () => {
    const { html } = crear(vi.fn().mockReturnValue(of([sesion(1, { dispositivo: null })])));

    expect(html.textContent).toContain('Dispositivo desconocido');
  });

  it('quita de la lista la sesión que se cierra, sin volver a pedirla', async () => {
    const { fixture, html, cerrarSesionEnDispositivo } = crear(
      vi.fn().mockReturnValue(of([sesion(1), sesion(2)])),
    );

    boton(html, 'Cerrar esta sesión').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(cerrarSesionEnDispositivo).toHaveBeenCalledWith(1);
    expect(html.querySelectorAll('.sessions__item')).toHaveLength(1);
  });

  it('marca cuál es la sesión de este dispositivo', () => {
    const { html } = crear(vi.fn().mockReturnValue(of([sesion(1, { esLaActual: true }), sesion(2)])));

    const etiquetas = Array.from(html.querySelectorAll('.badge')).map((b) => b.textContent?.trim());
    expect(etiquetas[0]).toBe('Sesión actual');
    expect(etiquetas[1]).not.toBe('Sesión actual');
    expect(html.textContent).toContain('Cerrar sesión aquí');
  });

  it('muestra desde cuándo está dentro el dispositivo y cuándo fue su último acceso', () => {
    // SCRUM-73: la cadena de renovaciones se lee como un solo dispositivo con dos fechas.
    const { html } = crear(vi.fn().mockReturnValue(of([sesion(1)])));

    const etiquetas = Array.from(html.querySelectorAll('.sessions__fact .field__label')).map((e) =>
      e.textContent?.trim(),
    );
    expect(etiquetas).toContain('Dentro desde');
    expect(etiquetas).toContain('Último acceso');
  });

  it('al cerrar la propia sesión sale de la app en vez de dejar la pantalla mintiendo', async () => {
    const { fixture, html, limpiar } = crear(vi.fn().mockReturnValue(of([sesion(1, { esLaActual: true })])));
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    boton(html, 'Cerrar sesión aquí').click();
    await fixture.whenStable();

    expect(limpiar).toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledWith(['/cuenta/entrar']);
  });

  it('avisa que cerrar la propia saca de la app antes de hacerlo', async () => {
    const { fixture, html } = crear(vi.fn().mockReturnValue(of([sesion(1, { esLaActual: true })])));
    // Sin esto, la salida lanza una navegación real contra un router sin rutas y Vitest la cuenta
    // como error no manejado aunque la prueba pase.
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    boton(html, 'Cerrar sesión aquí').click();
    await fixture.whenStable();

    expect(notificador.confirmar).toHaveBeenCalledWith(
      '¿Cerrar la sesión de este dispositivo?',
      expect.stringContaining('vas a salir de la app'),
      'Cerrar sesión',
    );
  });

  it('no cierra nada si la persona cancela la confirmación', async () => {
    notificador.confirmar.mockResolvedValue(false);
    const { fixture, html, cerrarSesionEnDispositivo } = crear(vi.fn().mockReturnValue(of([sesion(1)])));

    boton(html, 'Cerrar esta sesión').click();
    await fixture.whenStable();

    expect(cerrarSesionEnDispositivo).not.toHaveBeenCalled();
  });

  it('al cerrar todas limpia la sesión local y lleva a iniciar sesión', async () => {
    const { fixture, html, cerrarTodasMisSesiones, limpiar } = crear(
      vi.fn().mockReturnValue(of([sesion(1), sesion(2)])),
    );
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    boton(html, 'Cerrar sesión en todos los dispositivos').click();
    await fixture.whenStable();

    expect(cerrarTodasMisSesiones).toHaveBeenCalled();
    // El backend ya revocó esta sesión: dejarla viva en memoria mostraría una pantalla que ya no sirve.
    expect(limpiar).toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledWith(['/cuenta/entrar']);
  });

  it('con una sola sesión no ofrece cerrar todas', () => {
    const { html } = crear(vi.fn().mockReturnValue(of([sesion(1)])));

    expect(boton(html, 'Cerrar sesión en todos los dispositivos')).toBeUndefined();
  });

  it('avisa en pantalla cuando la lista no carga', () => {
    const { html } = crear(vi.fn().mockReturnValue(throwError(() => ({ status: 500 }))));

    expect(html.querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar tus sesiones');
  });
});

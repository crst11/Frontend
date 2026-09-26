import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { GoogleIdentityService } from '../../../core/google/google-identity.service';
import { SessionService } from '../../../core/session/session.service';
import { EstudianteRepository } from '../../../data-access/estudiante.repository';
import { MyAccount } from './my-account';

describe('MyAccount', () => {
  const cuenta = { id: 1, correo: 'ana.diaz@ucundinamarca.edu.co', nombres: 'Ana', apellidos: 'Díaz', estado: 'activa' };
  const notificador = { confirmar: vi.fn(), aviso: vi.fn(), problema: vi.fn() };

  beforeEach(() => {
    notificador.confirmar.mockReset().mockResolvedValue(true);
    notificador.aviso.mockReset().mockResolvedValue(undefined);
    notificador.problema.mockReset().mockResolvedValue(undefined);
  });

  function crear(miCuenta: ReturnType<typeof vi.fn>, cerrar = vi.fn().mockReturnValue(of(undefined))) {
    TestBed.configureTestingModule({
      imports: [MyAccount],
      providers: [
        provideRouter([]),
        { provide: EstudianteRepository, useValue: { miCuenta } },
        { provide: SessionService, useValue: { cerrar } },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    const fixture = TestBed.createComponent(MyAccount);
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement, cerrar };
  }

  it('muestra los datos de la cuenta del estudiante autenticado', () => {
    const { html } = crear(vi.fn().mockReturnValue(of(cuenta)));

    expect(html.textContent).toContain('Ana Díaz');
    expect(html.textContent).toContain('ana.diaz@ucundinamarca.edu.co');
    expect(html.textContent).toContain('activa');
  });

  it('avisa si no se pudo cargar la cuenta', () => {
    const { html } = crear(vi.fn().mockReturnValue(throwError(() => new Error('sin conexión'))));

    expect(html.querySelector('[role="alert"]')).toBeTruthy();
  });

  it('cerrar sesión pide confirmación, llama al servicio y lleva a la pantalla de entrada', async () => {
    const { fixture, html, cerrar } = crear(vi.fn().mockReturnValue(of(cuenta)));
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    html.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();

    expect(notificador.confirmar).toHaveBeenCalled();
    expect(cerrar).toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledWith(['/cuenta/entrar']);
    expect(notificador.aviso).toHaveBeenCalledWith('Sesión cerrada.');
  });

  it('si el servidor no responde al cargar la cuenta, lo avisa en una ventana además del mensaje en pantalla', () => {
    const { html } = crear(vi.fn().mockReturnValue(throwError(() => ({ status: 0 }))));

    expect(notificador.problema).toHaveBeenCalledWith('No pudimos cargar tu cuenta', expect.any(String));
    expect(html.querySelector('[role="alert"]')).toBeTruthy();
  });

  it('si la persona se arrepiente en la confirmación, la sesión sigue abierta', async () => {
    notificador.confirmar.mockResolvedValue(false);
    const { fixture, html, cerrar } = crear(vi.fn().mockReturnValue(of(cuenta)));
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    html.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();

    expect(cerrar).not.toHaveBeenCalled();
    expect(navegar).not.toHaveBeenCalled();
  });
});

describe('MyAccount con Google', () => {
  const cuenta = { id: 1, correo: 'ana.diaz@ucundinamarca.edu.co', nombres: 'Ana', apellidos: 'Díaz', estado: 'activa' };
  const sinVincular = { vinculada: false, correo: null, fechaVinculacion: null };
  const vinculada = { vinculada: true, correo: 'ana.diaz@gmail.com', fechaVinculacion: '2026-09-26T10:00:00Z' };
  const notificador = { confirmar: vi.fn(), aviso: vi.fn(), problema: vi.fn(), informar: vi.fn() };
  let alElegirCuenta: (idToken: string) => void = () => undefined;
  const google = {
    disponible: true,
    dibujarBoton: vi.fn(async (_contenedor: HTMLElement, _texto: string, alElegir: (idToken: string) => void) => {
      alElegirCuenta = alElegir;
    }),
  };

  beforeEach(() => {
    Object.values(notificador).forEach((simulado) => simulado.mockReset().mockResolvedValue(undefined));
    notificador.confirmar.mockResolvedValue(true);
    google.dibujarBoton.mockClear();
  });

  async function crear(repositorio: Record<string, ReturnType<typeof vi.fn>>) {
    TestBed.configureTestingModule({
      imports: [MyAccount],
      providers: [
        provideRouter([]),
        { provide: EstudianteRepository, useValue: { miCuenta: vi.fn().mockReturnValue(of(cuenta)), ...repositorio } },
        { provide: SessionService, useValue: { cerrar: vi.fn() } },
        { provide: NotifierService, useValue: notificador },
        { provide: GoogleIdentityService, useValue: google },
      ],
    });
    const fixture = TestBed.createComponent(MyAccount);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, html: fixture.nativeElement as HTMLElement };
  }

  it('si no tiene Google, muestra el botón oficial para vincularlo', async () => {
    const { html } = await crear({ vinculoConGoogle: vi.fn().mockReturnValue(of(sinVincular)) });

    expect(html.textContent).toContain('Vincula tu cuenta de Google');
    expect(google.dibujarBoton).toHaveBeenCalledWith(
      html.querySelector('.my-account__google-button'),
      'continue_with',
      expect.any(Function),
    );
  });

  it('al elegir la cuenta de Google la vincula y muestra su correo', async () => {
    const vincularGoogle = vi.fn().mockReturnValue(of(vinculada));
    const { fixture, html } = await crear({ vinculoConGoogle: vi.fn().mockReturnValue(of(sinVincular)), vincularGoogle });

    alElegirCuenta('id-token-de-google');
    await fixture.whenStable();

    expect(vincularGoogle).toHaveBeenCalledWith('id-token-de-google');
    expect(html.textContent).toContain('ana.diaz@gmail.com');
    expect(notificador.aviso).toHaveBeenCalledWith(expect.stringContaining('vinculada'));
  });

  it('si esa cuenta de Google ya está en otra cuenta, lo explica con el mensaje del servidor', async () => {
    const detalle = 'Esa cuenta de Google ya está vinculada a otra cuenta de CundiApp';
    await crear({
      vinculoConGoogle: vi.fn().mockReturnValue(of(sinVincular)),
      vincularGoogle: vi
        .fn()
        .mockReturnValue(throwError(() => ({ status: 409, error: { title: 'Google ya vinculado', detail: detalle } }))),
    });

    alElegirCuenta('id-token-de-google');

    expect(notificador.informar).toHaveBeenCalledWith('No pudimos vincular Google', detalle);
  });

  it('con Google vinculado muestra el correo y, tras confirmar, lo quita', async () => {
    const desvincularGoogle = vi.fn().mockReturnValue(of(undefined));
    const { fixture, html } = await crear({ vinculoConGoogle: vi.fn().mockReturnValue(of(vinculada)), desvincularGoogle });
    expect(html.textContent).toContain('ana.diaz@gmail.com');

    const quitar = Array.from(html.querySelectorAll('button')).find((boton) => boton.textContent?.includes('Quitar Google'))!;
    quitar.click();
    await fixture.whenStable();

    expect(notificador.confirmar).toHaveBeenCalled();
    expect(desvincularGoogle).toHaveBeenCalled();
    expect(html.textContent).toContain('Vincula tu cuenta de Google');
  });
});

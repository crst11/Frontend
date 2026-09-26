import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
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

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
  const notificador = { confirmar: vi.fn() };

  beforeEach(() => notificador.confirmar.mockReset().mockResolvedValue(true));

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

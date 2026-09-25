import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ServicioDeSesion } from '../../../core/sesion/servicio-de-sesion';
import { EstudianteRepository } from '../../../data-access/estudiante.repository';
import { MiCuenta } from './mi-cuenta';

describe('MiCuenta', () => {
  const cuenta = { id: 1, correo: 'ana.diaz@ucundinamarca.edu.co', nombres: 'Ana', apellidos: 'Díaz', estado: 'activa' };

  function crear(miCuenta: ReturnType<typeof vi.fn>, cerrar = vi.fn().mockReturnValue(of(undefined))) {
    TestBed.configureTestingModule({
      imports: [MiCuenta],
      providers: [
        provideRouter([]),
        { provide: EstudianteRepository, useValue: { miCuenta } },
        { provide: ServicioDeSesion, useValue: { cerrar } },
      ],
    });
    const fixture = TestBed.createComponent(MiCuenta);
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

  it('cerrar sesión llama al servicio y lleva a la pantalla de entrada', () => {
    const { fixture, html, cerrar } = crear(vi.fn().mockReturnValue(of(cuenta)));
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    html.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();

    expect(cerrar).toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledWith(['/cuenta/entrar']);
  });
});

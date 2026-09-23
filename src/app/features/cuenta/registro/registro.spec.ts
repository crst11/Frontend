import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { EstudianteRepository } from '../../../data-access/estudiante.repository';
import { Registro } from './registro';

describe('Registro', () => {
  function crear(repositorio: Partial<EstudianteRepository>) {
    TestBed.configureTestingModule({
      imports: [Registro, ReactiveFormsModule],
      providers: [{ provide: EstudianteRepository, useValue: repositorio }],
    });
    const fixture = TestBed.createComponent(Registro);
    fixture.detectChanges();
    return fixture;
  }

  function escribir(html: HTMLElement, id: string, valor: string) {
    const campo = html.querySelector<HTMLInputElement>(`#${id}`)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  function llenarFormularioValido(html: HTMLElement) {
    escribir(html, 'nombres', 'Ana');
    escribir(html, 'apellidos', 'Díaz');
    escribir(html, 'correo', 'ana.diaz@ucundinamarca.edu.co');
    escribir(html, 'contrasena', 'unaClaveSegura');
    const consentimiento = html.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    consentimiento.checked = true;
    consentimiento.dispatchEvent(new Event('change'));
  }

  it('registra la cuenta y muestra la confirmación', () => {
    const registrar = vi
      .fn()
      .mockReturnValue(of({ id: 1, correo: 'ana.diaz@ucundinamarca.edu.co', estado: 'pendiente' }));
    const fixture = crear({ registrar });
    const html = fixture.nativeElement as HTMLElement;

    llenarFormularioValido(html);
    html.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(registrar).toHaveBeenCalledWith(
        expect.objectContaining({ correo: 'ana.diaz@ucundinamarca.edu.co', aceptaTratamientoDatos: true }));
    expect(html.querySelector('[role="status"]')?.textContent).toContain('quedó creada');
  });

  it('muestra el mensaje del backend si el correo ya está registrado', () => {
    const registrar = vi
      .fn()
      .mockReturnValue(throwError(() => ({ error: { detail: 'Ya existe una cuenta con ese correo institucional' } })));
    const fixture = crear({ registrar });
    const html = fixture.nativeElement as HTMLElement;

    llenarFormularioValido(html);
    html.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(html.querySelector('[role="alert"]')?.textContent).toContain('Ya existe una cuenta');
  });

  it('no envía el formulario si falta aceptar el tratamiento de datos', () => {
    const registrar = vi.fn();
    const fixture = crear({ registrar });
    const html = fixture.nativeElement as HTMLElement;

    escribir(html, 'nombres', 'Ana');
    escribir(html, 'apellidos', 'Díaz');
    escribir(html, 'correo', 'ana.diaz@ucundinamarca.edu.co');
    escribir(html, 'contrasena', 'unaClaveSegura');
    html.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(registrar).not.toHaveBeenCalled();
  });
});

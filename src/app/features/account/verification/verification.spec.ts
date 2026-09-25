import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { EstudianteRepository } from '../../../data-access/estudiante.repository';
import { Verification } from './verification';

describe('Verification', () => {
  function crear(repositorio: Partial<EstudianteRepository>) {
    TestBed.configureTestingModule({
      imports: [Verification, ReactiveFormsModule],
      providers: [
        { provide: EstudianteRepository, useValue: repositorio },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ correo: 'ana.diaz@ucundinamarca.edu.co' }) } },
        },
      ],
    });
    const fixture = TestBed.createComponent(Verification);
    fixture.detectChanges();
    return fixture;
  }

  function escribirCodigo(html: HTMLElement, codigo: string) {
    const campo = html.querySelector<HTMLInputElement>('#codigo')!;
    campo.value = codigo;
    campo.dispatchEvent(new Event('input'));
  }

  it('trae el correo del registro ya escrito', () => {
    const html = crear({}).nativeElement as HTMLElement;

    expect(html.querySelector<HTMLInputElement>('#correo')!.value).toBe('ana.diaz@ucundinamarca.edu.co');
  });

  it('verifica el código y confirma que la cuenta quedó activa', () => {
    const verificarCorreo = vi
      .fn()
      .mockReturnValue(of({ id: 1, correo: 'ana.diaz@ucundinamarca.edu.co', estado: 'activa' }));
    const fixture = crear({ verificarCorreo });
    const html = fixture.nativeElement as HTMLElement;

    escribirCodigo(html, '123456');
    html.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(verificarCorreo).toHaveBeenCalledWith('ana.diaz@ucundinamarca.edu.co', '123456');
    expect(html.querySelector('[role="status"]')?.textContent).toContain('cuenta está activa');
  });

  it('muestra el mensaje del backend si el código es incorrecto', () => {
    const verificarCorreo = vi
      .fn()
      .mockReturnValue(throwError(() => ({ error: { detail: 'El código es incorrecto. Te quedan 4 intentos' } })));
    const fixture = crear({ verificarCorreo });
    const html = fixture.nativeElement as HTMLElement;

    escribirCodigo(html, '000000');
    html.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(html.querySelector('[role="alert"]')?.textContent).toContain('Te quedan 4 intentos');
  });

  it('no envía un código que no tiene 6 dígitos', () => {
    const verificarCorreo = vi.fn();
    const fixture = crear({ verificarCorreo });
    const html = fixture.nativeElement as HTMLElement;

    escribirCodigo(html, '12ab');
    html.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(verificarCorreo).not.toHaveBeenCalled();
  });

  it('pide un código nuevo y avisa sin revelar si la cuenta existe', () => {
    const reenviarCodigo = vi.fn().mockReturnValue(of(undefined));
    const fixture = crear({ reenviarCodigo });
    const html = fixture.nativeElement as HTMLElement;

    html.querySelector<HTMLButtonElement>('button.secundario')!.click();
    fixture.detectChanges();

    expect(reenviarCodigo).toHaveBeenCalledWith('ana.diaz@ucundinamarca.edu.co');
    expect(html.querySelector('[role="status"]')?.textContent).toContain('Si tu cuenta está pendiente');
  });
});

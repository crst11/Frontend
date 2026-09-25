import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { EstudianteRepository } from '../../../data-access/estudiante.repository';
import { Verification } from './verification';

describe('Verification', () => {
  function crear(repositorio: Partial<EstudianteRepository>, parametros: Record<string, string> = { correo: 'ana.diaz@ucundinamarca.edu.co' }) {
    TestBed.configureTestingModule({
      imports: [Verification, ReactiveFormsModule],
      providers: [
        { provide: EstudianteRepository, useValue: repositorio },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(parametros) } } },
      ],
    });
    const fixture = TestBed.createComponent(Verification);
    fixture.detectChanges();
    return fixture;
  }

  function casillas(html: HTMLElement): HTMLInputElement[] {
    return Array.from(html.querySelectorAll<HTMLInputElement>('.verification__digit'));
  }

  /** Escribe dígito por dígito, como una persona en las seis casillas. */
  function teclear(html: HTMLElement, codigo: string) {
    [...codigo].forEach((caracter, i) => {
      const casilla = casillas(html)[i];
      casilla.value = caracter;
      casilla.dispatchEvent(new Event('input'));
    });
  }

  function enviar(fixture: ReturnType<typeof crear>) {
    (fixture.nativeElement as HTMLElement).querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('muestra el correo que viene del registro y seis casillas para el código', () => {
    const html = crear({}).nativeElement as HTMLElement;

    expect(html.querySelector('.verification__email')?.textContent).toContain('ana.diaz@ucundinamarca.edu.co');
    expect(casillas(html).length).toBe(6);
    expect(html.querySelector('#correo')).toBeNull();
  });

  it('pide el correo si la pantalla se abre sin venir del registro', () => {
    const html = crear({}, {}).nativeElement as HTMLElement;

    expect(html.querySelector('#correo')).toBeTruthy();
  });

  it('verifica el código escrito en las casillas y confirma que la cuenta quedó activa', () => {
    const verificarCorreo = vi
      .fn()
      .mockReturnValue(of({ id: 1, correo: 'ana.diaz@ucundinamarca.edu.co', estado: 'activa' }));
    const fixture = crear({ verificarCorreo });
    const html = fixture.nativeElement as HTMLElement;

    teclear(html, '123456');
    enviar(fixture);

    expect(verificarCorreo).toHaveBeenCalledWith('ana.diaz@ucundinamarca.edu.co', '123456');
    expect(html.querySelector('[role="status"]')?.textContent).toContain('cuenta está activa');
  });

  it('reparte en las casillas un código pegado o autocompletado de una vez', () => {
    const verificarCorreo = vi.fn().mockReturnValue(of({ id: 1, correo: 'ana.diaz@ucundinamarca.edu.co', estado: 'activa' }));
    const fixture = crear({ verificarCorreo });
    const html = fixture.nativeElement as HTMLElement;

    const primera = casillas(html)[0];
    primera.value = '654321';
    primera.dispatchEvent(new Event('input'));

    expect(casillas(html).map((c) => c.value).join('')).toBe('654321');
    enviar(fixture);
    expect(verificarCorreo).toHaveBeenCalledWith('ana.diaz@ucundinamarca.edu.co', '654321');
  });

  it('muestra el mensaje del backend si el código es incorrecto', () => {
    const verificarCorreo = vi
      .fn()
      .mockReturnValue(throwError(() => ({ error: { detail: 'El código es incorrecto. Te quedan 4 intentos' } })));
    const fixture = crear({ verificarCorreo });
    const html = fixture.nativeElement as HTMLElement;

    teclear(html, '000000');
    enviar(fixture);

    expect(html.querySelector('[role="alert"]')?.textContent).toContain('Te quedan 4 intentos');
  });

  it('no envía un código incompleto y descarta lo que no es número', () => {
    const verificarCorreo = vi.fn();
    const fixture = crear({ verificarCorreo });
    const html = fixture.nativeElement as HTMLElement;

    teclear(html, '12ab');
    enviar(fixture);

    expect(casillas(html).map((c) => c.value).join('')).toBe('12');
    expect(verificarCorreo).not.toHaveBeenCalled();
    expect(html.querySelector('[role="alert"]')?.textContent).toContain('6 dígitos');
  });

  it('pide un código nuevo y avisa sin revelar si la cuenta existe', () => {
    const reenviarCodigo = vi.fn().mockReturnValue(of(undefined));
    const fixture = crear({ reenviarCodigo });
    const html = fixture.nativeElement as HTMLElement;

    html.querySelector<HTMLButtonElement>('.verification__resend')!.click();
    fixture.detectChanges();

    expect(reenviarCodigo).toHaveBeenCalledWith('ana.diaz@ucundinamarca.edu.co');
    expect(html.querySelector('[role="status"]')?.textContent).toContain('Si tu cuenta está pendiente');
  });
});

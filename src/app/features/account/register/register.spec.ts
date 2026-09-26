import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { EstudianteRepository } from '../../../data-access/estudiante.repository';
import { Register } from './register';

describe('Register', () => {
  const notificador = { aviso: vi.fn(), problema: vi.fn() };

  beforeEach(() => {
    notificador.aviso.mockReset().mockResolvedValue(undefined);
    notificador.problema.mockReset().mockResolvedValue(undefined);
  });

  function crear(repositorio: Partial<EstudianteRepository>) {
    TestBed.configureTestingModule({
      imports: [Register, ReactiveFormsModule],
      providers: [
        provideRouter([]),
        { provide: EstudianteRepository, useValue: repositorio },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    const fixture = TestBed.createComponent(Register);
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
    escribir(html, 'confirmacion', 'unaClaveSegura');
    const consentimiento = html.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    consentimiento.checked = true;
    consentimiento.dispatchEvent(new Event('change'));
  }

  it('no envía si la confirmación no coincide y lo avisa en el campo', () => {
    const registrar = vi.fn();
    const fixture = crear({ registrar });
    const html = fixture.nativeElement as HTMLElement;

    llenarFormularioValido(html);
    escribir(html, 'confirmacion', 'otraClaveDistinta');
    html.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(registrar).not.toHaveBeenCalled();
    expect(html.textContent).toContain('Las contraseñas no coinciden');
  });

  it('no manda la confirmación de la contraseña al backend', () => {
    const registrar = vi.fn().mockReturnValue(of({ id: 1, correo: 'ana.diaz@ucundinamarca.edu.co', estado: 'pendiente' }));
    const fixture = crear({ registrar });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const html = fixture.nativeElement as HTMLElement;

    llenarFormularioValido(html);
    html.querySelector('form')!.dispatchEvent(new Event('submit'));

    expect(registrar.mock.calls[0][0]).not.toHaveProperty('confirmacion');
  });

  it('registra la cuenta y lleva a verificar el correo', () => {
    const registrar = vi
      .fn()
      .mockReturnValue(of({ id: 1, correo: 'ana.diaz@ucundinamarca.edu.co', estado: 'pendiente' }));
    const fixture = crear({ registrar });
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const html = fixture.nativeElement as HTMLElement;

    llenarFormularioValido(html);
    html.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(registrar).toHaveBeenCalledWith(
        expect.objectContaining({ correo: 'ana.diaz@ucundinamarca.edu.co', aceptaTratamientoDatos: true }));
    expect(navegar).toHaveBeenCalledWith(['/cuenta/verificacion'], {
      queryParams: { correo: 'ana.diaz@ucundinamarca.edu.co' },
    });
    expect(notificador.aviso).toHaveBeenCalledWith(expect.stringContaining('Cuenta creada'));
  });

  it('si no hay conexión con el servidor lo avisa en una ventana y no en el formulario', () => {
    const registrar = vi.fn().mockReturnValue(throwError(() => ({ status: 0, error: null })));
    const fixture = crear({ registrar });
    const html = fixture.nativeElement as HTMLElement;

    llenarFormularioValido(html);
    html.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(notificador.problema).toHaveBeenCalledWith('No pudimos crear tu cuenta', expect.any(String));
    expect(html.querySelector('[role="alert"]')).toBeNull();
  });

  it('si la cuenta se creó pero el correo no salió, lleva a la verificación y explica qué hacer', () => {
    const detalle = 'Tu cuenta quedó creada, pero no pudimos enviarte el código. Pide uno nuevo en la pantalla de verificación';
    const registrar = vi
      .fn()
      .mockReturnValue(throwError(() => ({ status: 503, error: { title: 'Correo no enviado', detail: detalle } })));
    const fixture = crear({ registrar });
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const html = fixture.nativeElement as HTMLElement;

    llenarFormularioValido(html);
    html.querySelector('form')!.dispatchEvent(new Event('submit'));

    expect(navegar).toHaveBeenCalledWith(['/cuenta/verificacion'], {
      queryParams: { correo: 'ana.diaz@ucundinamarca.edu.co' },
    });
    expect(notificador.problema).toHaveBeenCalledWith('No pudimos enviarte el código', detalle);
  });

  it('las dos contraseñas traen el ojo y cada uno muestra solo su campo', () => {
    const fixture = crear({});
    const html = fixture.nativeElement as HTMLElement;
    const ojos = html.querySelectorAll<HTMLButtonElement>('.password__toggle');
    const tipo = (id: string) => html.querySelector<HTMLInputElement>(`#${id}`)!.type;

    expect(ojos.length).toBe(2);
    ojos[0].click();
    fixture.detectChanges();

    expect(tipo('contrasena')).toBe('text');
    expect(tipo('confirmacion')).toBe('password');
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

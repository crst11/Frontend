import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { EstudianteRepository } from '../../../data-access/estudiante.repository';
import { PasswordReset } from './password-reset';

describe('PasswordReset', () => {
  const notificador = { aviso: vi.fn(), problema: vi.fn(), confirmar: vi.fn() };

  beforeEach(() => {
    Object.values(notificador).forEach((simulado) => simulado.mockReset().mockResolvedValue(undefined));
  });

  function crear(restablecerContrasena: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: EstudianteRepository, useValue: { restablecerContrasena } },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    const fixture = TestBed.createComponent(PasswordReset);
    fixture.detectChanges();
    return fixture;
  }

  function escribir(html: HTMLElement, id: string, valor: string) {
    const campo = html.querySelector<HTMLInputElement>(`#${id}`)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  function enviar(fixture: ReturnType<typeof crear>, codigo: string, contrasena: string, confirmacion = contrasena) {
    const html = fixture.nativeElement as HTMLElement;
    escribir(html, 'correo', 'ana.diaz');
    escribir(html, 'codigo', codigo);
    escribir(html, 'contrasena', contrasena);
    escribir(html, 'confirmacion', confirmacion);
    html.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    return html;
  }

  it('cambia la contrasena y lleva a iniciar sesion', () => {
    const restablecer = vi.fn().mockReturnValue(of(undefined));
    const fixture = crear(restablecer);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    enviar(fixture, '482913', 'ClaveNueva2026!');

    expect(restablecer).toHaveBeenCalledWith('ana.diaz@ucundinamarca.edu.co', '482913', 'ClaveNueva2026!');
    expect(navegar).toHaveBeenCalledWith(['/cuenta/entrar']);
  });

  it('no envia una contrasena que no cumple la politica', () => {
    const restablecer = vi.fn();
    const fixture = crear(restablecer);

    enviar(fixture, '482913', 'clave12345');

    expect(restablecer).not.toHaveBeenCalled();
  });

  it('no envia si el codigo no tiene 6 digitos', () => {
    const restablecer = vi.fn();
    const fixture = crear(restablecer);

    enviar(fixture, '123', 'ClaveNueva2026!');

    expect(restablecer).not.toHaveBeenCalled();
  });

  it('no envia si la confirmacion no coincide', () => {
    const restablecer = vi.fn();
    const fixture = crear(restablecer);

    const html = enviar(fixture, '482913', 'ClaveNueva2026!', 'OtraClave2026!');

    expect(restablecer).not.toHaveBeenCalled();
    expect(html.textContent).toContain('no coinciden');
  });

  it('muestra el mensaje del backend si el codigo ya vencio', () => {
    const restablecer = vi
      .fn()
      .mockReturnValue(throwError(() => ({ error: { detail: 'El código no es válido o ya venció. Pide uno nuevo' } })));
    const fixture = crear(restablecer);

    const html = enviar(fixture, '482913', 'ClaveNueva2026!');

    expect(html.textContent).toContain('ya venció');
  });
});

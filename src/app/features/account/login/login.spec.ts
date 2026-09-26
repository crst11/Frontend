import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { SessionService } from '../../../core/session/session.service';
import { Login } from './login';

describe('Login', () => {
  const notificador = { problema: vi.fn(), aviso: vi.fn() };

  beforeEach(() => {
    notificador.problema.mockReset().mockResolvedValue(undefined);
    notificador.aviso.mockReset().mockResolvedValue(undefined);
  });

  function crear(iniciar: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        { provide: SessionService, useValue: { iniciar } },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    return fixture;
  }

  function escribir(html: HTMLElement, id: string, valor: string) {
    const campo = html.querySelector<HTMLInputElement>(`#${id}`)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  function enviar(fixture: ReturnType<typeof crear>, correo: string, contrasena: string) {
    const html = fixture.nativeElement as HTMLElement;
    escribir(html, 'correo', correo);
    escribir(html, 'contrasena', contrasena);
    html.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    return html;
  }

  it('inicia sesión y lleva a la cuenta', () => {
    const iniciar = vi.fn().mockReturnValue(of({ id: 1 }));
    const fixture = crear(iniciar);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    enviar(fixture, 'ana.diaz@ucundinamarca.edu.co', 'claveSegura1');

    expect(iniciar).toHaveBeenCalledWith('ana.diaz@ucundinamarca.edu.co', 'claveSegura1');
    expect(navegar).toHaveBeenCalledWith(['/cuenta/mi-cuenta']);
    expect(notificador.aviso).toHaveBeenCalledWith('Sesión iniciada.');
  });

  it('muestra el mensaje genérico del backend si las credenciales fallan', () => {
    const iniciar = vi.fn().mockReturnValue(throwError(() => ({ status: 401, error: { detail: 'Correo o contraseña incorrectos' } })));
    const fixture = crear(iniciar);

    const html = enviar(fixture, 'ana.diaz@ucundinamarca.edu.co', 'mala');

    expect(html.querySelector('[role="alert"]')?.textContent).toContain('Correo o contraseña incorrectos');
    expect(html.querySelector('a[href*="verificacion"]')).toBeNull();
  });

  it('si el servidor no responde lo avisa en una ventana y no en el formulario', () => {
    const iniciar = vi.fn().mockReturnValue(throwError(() => ({ status: 0, error: null })));
    const fixture = crear(iniciar);

    const html = enviar(fixture, 'ana.diaz@ucundinamarca.edu.co', 'claveSegura1');

    expect(notificador.problema).toHaveBeenCalledWith('No pudimos iniciar sesión', expect.any(String));
    expect(html.querySelector('[role="alert"]')).toBeNull();
  });

  it('el ojo muestra y vuelve a ocultar la contraseña', () => {
    const fixture = crear(vi.fn());
    const html = fixture.nativeElement as HTMLElement;
    const campo = html.querySelector<HTMLInputElement>('#contrasena')!;
    const ojo = html.querySelector<HTMLButtonElement>('.password__toggle')!;

    expect(campo.type).toBe('password');
    ojo.click();
    fixture.detectChanges();
    expect(campo.type).toBe('text');
    ojo.click();
    fixture.detectChanges();
    expect(campo.type).toBe('password');
  });

  it('si la cuenta está pendiente ofrece ir a verificar el correo', () => {
    const iniciar = vi.fn().mockReturnValue(
      throwError(() => ({ status: 403, error: { detail: 'Verifica tu correo institucional con el código' } })),
    );
    const fixture = crear(iniciar);

    const html = enviar(fixture, 'ana.diaz@ucundinamarca.edu.co', 'claveSegura1');

    expect(html.querySelector('a[href*="/cuenta/verificacion"]')).toBeTruthy();
  });

  it('no envía el formulario si faltan datos', () => {
    const iniciar = vi.fn();
    const fixture = crear(iniciar);

    enviar(fixture, '', '');

    expect(iniciar).not.toHaveBeenCalled();
  });
});

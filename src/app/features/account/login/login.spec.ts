import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { GoogleIdentityService } from '../../../core/google/google-identity.service';
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

describe('Login con Google', () => {
  const notificador = { problema: vi.fn(), aviso: vi.fn(), informar: vi.fn() };
  let alElegirCuenta: (idToken: string) => void = () => undefined;
  const google = {
    disponible: true,
    dibujarBoton: vi.fn(async (_contenedor: HTMLElement, _texto: string, alElegir: (idToken: string) => void) => {
      alElegirCuenta = alElegir;
    }),
  };

  beforeEach(() => {
    Object.values(notificador).forEach((simulado) => simulado.mockReset().mockResolvedValue(undefined));
    google.dibujarBoton.mockClear();
    google.disponible = true;
  });

  async function crear(iniciarConGoogle: ReturnType<typeof vi.fn> = vi.fn()) {
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        { provide: SessionService, useValue: { iniciar: vi.fn(), iniciarConGoogle } },
        { provide: NotifierService, useValue: notificador },
        { provide: GoogleIdentityService, useValue: google },
      ],
    });
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('dibuja el botón oficial de Google debajo del formulario', async () => {
    const html = (await crear()).nativeElement as HTMLElement;

    expect(google.dibujarBoton).toHaveBeenCalledWith(html.querySelector('.login__google'), 'continue_with', expect.any(Function));
  });

  it('con la cuenta de Google vinculada entra a Mi cuenta con un toque', async () => {
    const iniciarConGoogle = vi.fn().mockReturnValue(of({ id: 1 }));
    await crear(iniciarConGoogle);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    alElegirCuenta('id-token-de-google');

    expect(iniciarConGoogle).toHaveBeenCalledWith('id-token-de-google');
    expect(navegar).toHaveBeenCalledWith(['/cuenta/mi-cuenta']);
    expect(notificador.aviso).toHaveBeenCalledWith('Sesión iniciada.');
  });

  it('si esa cuenta de Google no está vinculada, explica cómo vincularla', async () => {
    const detalle =
      'Tu cuenta de Google no está vinculada a CundiApp. Inicia sesión con tu correo institucional y vincúlala desde Mi cuenta';
    await crear(
      vi.fn().mockReturnValue(throwError(() => ({ status: 404, error: { title: 'Google no vinculado', detail: detalle } }))),
    );

    alElegirCuenta('id-token-de-google');

    expect(notificador.informar).toHaveBeenCalledWith('Tu cuenta de Google aún no está vinculada', detalle);
  });

  it('sin client ID de Google configurado no aparece el botón', async () => {
    google.disponible = false;
    const html = (await crear()).nativeElement as HTMLElement;

    expect(html.querySelector('.login__google')).toBeNull();
    expect(google.dibujarBoton).not.toHaveBeenCalled();
  });
});

import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { EstudianteRepository } from '../../../data-access/estudiante.repository';
import { PasswordRecovery } from './password-recovery';

describe('PasswordRecovery', () => {
  const notificador = {
    aviso: vi.fn(),
    problema: vi.fn(),
    confirmar: vi.fn(),
  };

  beforeEach(() => {
    Object.values(notificador).forEach((simulado) => simulado.mockReset().mockResolvedValue(undefined));
  });

  function crear(solicitarRecuperacion: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: EstudianteRepository, useValue: { solicitarRecuperacion } },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    const fixture = TestBed.createComponent(PasswordRecovery);
    fixture.detectChanges();
    return fixture;
  }

  function enviar(fixture: ReturnType<typeof crear>, correo: string) {
    const html = fixture.nativeElement as HTMLElement;
    const campo = html.querySelector<HTMLInputElement>('#correo')!;
    campo.value = correo;
    campo.dispatchEvent(new Event('input'));
    html.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    return html;
  }

  it('pide el código y lleva a la pantalla de contraseña nueva', () => {
    const solicitar = vi.fn().mockReturnValue(of(undefined));
    const fixture = crear(solicitar);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    enviar(fixture, 'ana.diaz');

    expect(solicitar).toHaveBeenCalledWith('ana.diaz@ucundinamarca.edu.co');
    expect(navegar).toHaveBeenCalledWith(['/cuenta/nueva-contrasena'], {
      queryParams: { correo: 'ana.diaz@ucundinamarca.edu.co' },
    });
  });

  it('el aviso no confirma si ese correo tiene cuenta', () => {
    const fixture = crear(vi.fn().mockReturnValue(of(undefined)));
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    enviar(fixture, 'ana.diaz');

    expect(notificador.aviso).toHaveBeenCalledWith(expect.stringContaining('Si ese correo tiene una cuenta'));
  });

  it('no envía nada si falta el correo', () => {
    const solicitar = vi.fn();
    const fixture = crear(solicitar);

    enviar(fixture, '');

    expect(solicitar).not.toHaveBeenCalled();
  });

  it('si el servidor no responde lo avisa en una ventana', () => {
    const fixture = crear(vi.fn().mockReturnValue(throwError(() => ({ status: 0, error: null }))));

    enviar(fixture, 'ana.diaz');

    expect(notificador.problema).toHaveBeenCalledWith(
      'No pudimos enviar el código',
      expect.stringContaining('Revisa tu conexión'),
    );
  });
});

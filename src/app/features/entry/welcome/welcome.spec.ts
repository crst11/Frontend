import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SessionService } from '../../../core/session/session.service';
import { Welcome } from './welcome';

describe('Welcome', () => {
  function crear(autenticada: boolean) {
    TestBed.configureTestingModule({
      imports: [Welcome],
      providers: [provideRouter([]), { provide: SessionService, useValue: { estaAutenticada: signal(autenticada) } }],
    });
    const fixture = TestBed.createComponent(Welcome);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const enlaces = (html: HTMLElement) =>
    Array.from(html.querySelectorAll('a')).map((a) => [a.textContent?.trim(), a.getAttribute('href')]);

  it('ofrece iniciar sesión, crear cuenta y consultar la guía sin cuenta', () => {
    expect(enlaces(crear(false))).toEqual([
      ['Iniciar sesión', '/cuenta/entrar'],
      ['Crear cuenta', '/cuenta/registro'],
      ['Consultar guía institucional', '/guia'],
    ]);
  });

  it('si ya hay sesión lleva directo a la cuenta', () => {
    expect(enlaces(crear(true))).toEqual([
      ['Ir a mi cuenta', '/cuenta/mi-cuenta'],
      ['Consultar guía institucional', '/guia'],
    ]);
  });
});

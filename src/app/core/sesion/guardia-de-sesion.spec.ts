import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { guardiaDeSesion } from './guardia-de-sesion';
import { ServicioDeSesion } from './servicio-de-sesion';

describe('guardiaDeSesion', () => {
  const autenticada = signal(false);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ServicioDeSesion, useValue: { estaAutenticada: autenticada } }],
    });
  });

  const ejecutar = () =>
    TestBed.runInInjectionContext(() => guardiaDeSesion({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

  it('deja pasar a quien tiene sesión', () => {
    autenticada.set(true);

    expect(ejecutar()).toBe(true);
  });

  it('manda a iniciar sesión a quien no la tiene', () => {
    autenticada.set(false);

    const resultado = ejecutar();

    expect(resultado).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(resultado as UrlTree)).toBe('/cuenta/entrar');
  });
});

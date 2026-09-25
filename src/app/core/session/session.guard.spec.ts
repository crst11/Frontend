import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { sessionGuard } from './session.guard';
import { SessionService } from './session.service';

describe('sessionGuard', () => {
  const autenticada = signal(false);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SessionService, useValue: { estaAutenticada: autenticada } }],
    });
  });

  const ejecutar = () =>
    TestBed.runInInjectionContext(() => sessionGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

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

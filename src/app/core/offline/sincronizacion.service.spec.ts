import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Sincronizacion } from './sincronizacion.service';

@Component({ template: '' })
class Pantalla {}

describe('Sincronizacion', () => {
  let sincronizacion: Sincronizacion;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'a', component: Pantalla },
          { path: 'b', component: Pantalla },
        ]),
      ],
    });
    sincronizacion = TestBed.inject(Sincronizacion);
  });

  it('empieza sin nada que decir', () => {
    expect(sincronizacion.ultimaActualizacion()).toBeNull();
    expect(sincronizacion.mostrandoCopia()).toBe(false);
  });

  it('lo que llega del servidor es la hora de ahora y no es una copia', () => {
    sincronizacion.registrarActual(2_000);

    expect(sincronizacion.ultimaActualizacion()).toBe(2_000);
    expect(sincronizacion.mostrandoCopia()).toBe(false);
  });

  it('de varias lecturas muestra la más antigua, que es la que dice si los datos están al día', () => {
    sincronizacion.registrarActual(9_000);
    sincronizacion.registrarCopia(3_000);
    sincronizacion.registrarActual(7_000);

    expect(sincronizacion.ultimaActualizacion()).toBe(3_000);
    expect(sincronizacion.mostrandoCopia()).toBe(true);
  });

  it('al cambiar de pantalla empieza de cero', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/a');
    sincronizacion.registrarCopia(1_000);

    await router.navigateByUrl('/b');

    expect(sincronizacion.ultimaActualizacion()).toBeNull();
    expect(sincronizacion.mostrandoCopia()).toBe(false);
  });
});

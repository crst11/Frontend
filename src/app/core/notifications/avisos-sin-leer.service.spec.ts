import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AvisoRepository } from '../../data-access/aviso.repository';
import { AvisosSinLeer } from './avisos-sin-leer.service';

describe('AvisosSinLeer', () => {
  const repositorio = { misAvisos: vi.fn() };

  function servicio(): AvisosSinLeer {
    TestBed.configureTestingModule({ providers: [{ provide: AvisoRepository, useValue: repositorio }] });
    return TestBed.inject(AvisosSinLeer);
  }

  beforeEach(() => repositorio.misAvisos.mockReset().mockReturnValue(of({ sinLeer: 4, avisos: [] })));

  it('empieza en cero y al refrescar toma lo que dice el servidor', () => {
    const avisos = servicio();
    expect(avisos.cantidad()).toBe(0);

    avisos.refrescar();

    expect(repositorio.misAvisos).toHaveBeenCalledWith(true);
    expect(avisos.cantidad()).toBe(4);
  });

  it('si no se puede preguntar conserva el último número en vez de borrarlo', () => {
    const avisos = servicio();
    avisos.refrescar();
    repositorio.misAvisos.mockReturnValue(throwError(() => new Error('sin red')));

    avisos.refrescar();

    expect(avisos.cantidad()).toBe(4);
  });

  it('la pantalla de avisos puede fijar el número sin volver a preguntar', () => {
    const avisos = servicio();

    avisos.fijar(2);

    expect(avisos.cantidad()).toBe(2);
    expect(repositorio.misAvisos).not.toHaveBeenCalled();
  });
});

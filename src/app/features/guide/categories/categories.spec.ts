import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { CategoriaDeRecursoRepository } from '../../../data-access/categoria-de-recurso.repository';
import { Categories } from './categories';

describe('Categories', () => {
  const notificador = { problema: vi.fn() };

  beforeEach(() => notificador.problema.mockReset().mockResolvedValue(undefined));

  function crear(repositorio: Partial<CategoriaDeRecursoRepository>) {
    TestBed.configureTestingModule({
      imports: [Categories],
      providers: [
        provideRouter([]),
        { provide: CategoriaDeRecursoRepository, useValue: repositorio },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    const fixture = TestBed.createComponent(Categories);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra las categorías que devuelve el repositorio', () => {
    const html = crear({
      listar: () => of([{ id: 1, nombre: 'Reglamentos' }, { id: 2, nombre: 'Formatos' }]),
    });

    const nombres = Array.from(html.querySelectorAll('li')).map((li) => li.textContent?.trim());
    expect(nombres).toEqual(['Reglamentos', 'Formatos']);
  });

  it('muestra un mensaje de error si el repositorio falla', () => {
    const html = crear({ listar: () => throwError(() => new Error('sin conexión')) });

    expect(html.querySelector('[role="alert"]')).toBeTruthy();
    expect(html.querySelectorAll('li').length).toBe(0);
  });

  it('si no hay conexión con el servidor lo avisa también en una ventana', () => {
    crear({ listar: () => throwError(() => ({ status: 0 })) });

    expect(notificador.problema).toHaveBeenCalledWith('No pudimos cargar la guía', expect.any(String));
  });
});

import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CategoriaDeRecursoRepository } from '../../../data-access/categoria-de-recurso.repository';
import { Categorias } from './categorias';

describe('Categorias', () => {
  function crear(repositorio: Partial<CategoriaDeRecursoRepository>) {
    TestBed.configureTestingModule({
      imports: [Categorias],
      providers: [{ provide: CategoriaDeRecursoRepository, useValue: repositorio }],
    });
    const fixture = TestBed.createComponent(Categorias);
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
});

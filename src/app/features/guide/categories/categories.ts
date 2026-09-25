import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoriaDeRecurso, CategoriaDeRecursoRepository } from '../../../data-access/categoria-de-recurso.repository';

/**
 * Esqueleto caminante (SCRUM-43): lista las categorías de la guía institucional leídas
 * de PostgreSQL a través de la API pública del backend. Es el primer dato que atraviesa
 * toda la arquitectura, de la base de datos a la pantalla.
 */
@Component({
  selector: 'app-categories',
  imports: [RouterLink],
  templateUrl: './categories.html',
  styleUrl: './categories.css',
})
export class Categories {
  private readonly repositorio = inject(CategoriaDeRecursoRepository);

  protected readonly categorias = signal<CategoriaDeRecurso[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal(false);

  constructor() {
    this.repositorio.listar().subscribe({
      next: (categorias) => {
        this.categorias.set(categorias);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      },
    });
  }
}

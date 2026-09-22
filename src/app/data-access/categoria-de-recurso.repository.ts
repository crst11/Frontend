import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/** Una categoría de la guía institucional (RF11), tal como la expone el backend. */
export interface CategoriaDeRecurso {
  id: number;
  nombre: string;
}

/**
 * Puerto del frontend hacia el origen de las categorías de la guía institucional.
 * Los componentes dependen de esta clase abstracta, nunca de HttpClient directamente,
 * para poder cambiar el origen (HTTP hoy, IndexedDB en RF12) sin tocar la pantalla.
 */
@Injectable()
export abstract class CategoriaDeRecursoRepository {
  abstract listar(): Observable<CategoriaDeRecurso[]>;
}

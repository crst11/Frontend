import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CategoriaDeRecurso, CategoriaDeRecursoRepository } from '../categoria-de-recurso.repository';

/** Implementación HTTP del puerto: llama a la ruta pública de la guía institucional. */
@Injectable()
export class CategoriaDeRecursoHttpRepository extends CategoriaDeRecursoRepository {
  private readonly http = inject(HttpClient);

  override listar(): Observable<CategoriaDeRecurso[]> {
    return this.http.get<CategoriaDeRecurso[]>(`${environment.apiUrl}/publico/guia/categorias`);
  }
}

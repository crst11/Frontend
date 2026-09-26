import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CategoriaDeRecurso, GuiaRepository, RecursoInstitucional } from '../guia.repository';

/** Implementación HTTP del puerto: rutas públicas de la guía institucional. */
@Injectable()
export class GuiaHttpRepository extends GuiaRepository {
  private readonly http = inject(HttpClient);
  private readonly guia = `${environment.apiUrl}/publico/guia`;

  override categorias(): Observable<CategoriaDeRecurso[]> {
    return this.http.get<CategoriaDeRecurso[]>(`${this.guia}/categorias`);
  }

  override buscar(texto: string, idCategoria: number | null): Observable<RecursoInstitucional[]> {
    let params = new HttpParams();
    if (texto.trim()) {
      params = params.set('buscar', texto.trim());
    }
    if (idCategoria !== null) {
      params = params.set('categoria', idCategoria);
    }
    return this.http.get<RecursoInstitucional[]>(`${this.guia}/recursos`, { params });
  }

  override sugerencias(): Observable<string[]> {
    return this.http.get<string[]>(`${this.guia}/sugerencias`);
  }
}

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/** Una categoría de la guía institucional (RF11), tal como la expone el backend. */
export interface CategoriaDeRecurso {
  id: number;
  nombre: string;
}

/** Un documento oficial de la guía: siempre enlaza a su fuente en el portal de la universidad. */
export interface RecursoInstitucional {
  id: number;
  titulo: string;
  descripcion: string | null;
  url: string;
  tipo: 'documento' | 'formato' | 'enlace';
  /** "PDF", "Word", "Excel" o "PowerPoint" si es un archivo; null si es una página web. */
  formato: string | null;
  descargable: boolean;
  vigente: boolean;
  fechaVerificacion: string | null;
  categoria: CategoriaDeRecurso;
}

/**
 * Puerto del frontend hacia la guía institucional. Los componentes dependen de esta clase abstracta,
 * nunca de HttpClient, para poder cambiar el origen (HTTP hoy, IndexedDB en RF12) sin tocar la pantalla.
 */
@Injectable()
export abstract class GuiaRepository {
  abstract categorias(): Observable<CategoriaDeRecurso[]>;
  abstract buscar(texto: string, idCategoria: number | null): Observable<RecursoInstitucional[]>;
  abstract sugerencias(): Observable<string[]>;
}

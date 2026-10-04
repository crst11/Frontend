import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AsignaturaMatriculada,
  CategoriaPorGuardar,
  EstructuraDeEvaluacion,
  EvaluacionRepository,
} from '../evaluacion.repository';

@Injectable()
export class EvaluacionHttpRepository extends EvaluacionRepository {
  private readonly http = inject(HttpClient);
  private readonly ruta = `${environment.apiUrl}/mis/matriculas`;

  override misAsignaturas(): Observable<AsignaturaMatriculada[]> {
    return this.http.get<AsignaturaMatriculada[]>(this.ruta);
  }

  override estructuraDe(idMatricula: number): Observable<EstructuraDeEvaluacion> {
    return this.http.get<EstructuraDeEvaluacion>(`${this.ruta}/${idMatricula}/evaluacion`);
  }

  override guardar(
    idMatricula: number,
    categorias: CategoriaPorGuardar[],
  ): Observable<EstructuraDeEvaluacion> {
    return this.http.put<EstructuraDeEvaluacion>(`${this.ruta}/${idMatricula}/evaluacion`, {
      categorias,
    });
  }
}

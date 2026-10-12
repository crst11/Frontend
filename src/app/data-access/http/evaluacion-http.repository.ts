import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AcumuladoDeNotas,
  AsignaturaMatriculada,
  CategoriaPorGuardar,
  EstructuraDeEvaluacion,
  EvaluacionRepository,
  NotaRegistrada,
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

  override registrarNota(
    idMatricula: number,
    consecCategoria: number,
    consecActividad: number,
    nota: number,
  ): Observable<NotaRegistrada> {
    return this.http.put<NotaRegistrada>(this.rutaDeLaNota(idMatricula, consecCategoria, consecActividad), { nota });
  }

  override quitarNota(
    idMatricula: number,
    consecCategoria: number,
    consecActividad: number,
  ): Observable<AcumuladoDeNotas> {
    return this.http.delete<AcumuladoDeNotas>(this.rutaDeLaNota(idMatricula, consecCategoria, consecActividad));
  }

  private rutaDeLaNota(idMatricula: number, consecCategoria: number, consecActividad: number): string {
    return `${this.ruta}/${idMatricula}/evaluacion/categorias/${consecCategoria}/actividades/${consecActividad}/calificacion`;
  }
}

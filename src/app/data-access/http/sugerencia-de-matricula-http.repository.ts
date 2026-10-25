import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SugerenciaDeMatricula, SugerenciaDeMatriculaRepository } from '../sugerencia-de-matricula.repository';

@Injectable()
export class SugerenciaDeMatriculaHttpRepository extends SugerenciaDeMatriculaRepository {
  private readonly http = inject(HttpClient);
  private readonly ruta = `${environment.apiUrl}/mis/horario/sugerencia-de-matricula`;

  override consultar(): Observable<SugerenciaDeMatricula> {
    return this.http.get<SugerenciaDeMatricula>(this.ruta);
  }
}

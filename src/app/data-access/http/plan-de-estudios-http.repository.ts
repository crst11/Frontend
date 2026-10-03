import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PerfilAcademico, PlanDeEstudiosRepository, Programa } from '../plan-de-estudios.repository';

@Injectable()
export class PlanDeEstudiosHttpRepository extends PlanDeEstudiosRepository {
  private readonly http = inject(HttpClient);

  override programas(): Observable<Programa[]> {
    return this.http.get<Programa[]>(`${environment.apiUrl}/programas`);
  }

  override miPerfil(): Observable<PerfilAcademico> {
    return this.http.get<PerfilAcademico>(`${environment.apiUrl}/mis/perfil-academico`);
  }

  override elegirPrograma(codigoPrograma: string): Observable<PerfilAcademico> {
    return this.http.put<PerfilAcademico>(`${environment.apiUrl}/mis/perfil-academico`, { codigoPrograma });
  }
}

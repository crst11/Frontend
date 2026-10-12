import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ClaseDelHorario, ClasePorAgregar, Horario, HorarioRepository } from '../horario.repository';

@Injectable()
export class HorarioHttpRepository extends HorarioRepository {
  private readonly http = inject(HttpClient);

  override miHorario(): Observable<Horario> {
    return this.http.get<Horario>(`${environment.apiUrl}/mis/horario`);
  }

  override agregar(idMatricula: number, clase: ClasePorAgregar): Observable<ClaseDelHorario> {
    return this.http.post<ClaseDelHorario>(`${environment.apiUrl}/mis/matriculas/${idMatricula}/horario`, clase);
  }

  override quitar(idMatricula: number, consecutivo: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/mis/matriculas/${idMatricula}/horario/${consecutivo}`);
  }
}

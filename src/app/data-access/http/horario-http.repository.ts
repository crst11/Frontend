import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ClaseDelHorario,
  ClasePorAgregar,
  ConsultaDelHorario,
  Horario,
  HorarioRepository,
  PreferenciaDeHorario,
} from '../horario.repository';

@Injectable()
export class HorarioHttpRepository extends HorarioRepository {
  private readonly http = inject(HttpClient);

  override miHorario(consulta: ConsultaDelHorario = {}): Observable<Horario> {
    // Solo viaja lo que se eligió: un criterio vacío es no filtrar, y no hace falta mandarlo.
    let params = new HttpParams();
    if (consulta.asignatura) params = params.set('asignatura', consulta.asignatura);
    if (consulta.sede) params = params.set('sede', consulta.sede);
    if (consulta.orden) params = params.set('orden', consulta.orden);
    return this.http.get<Horario>(`${environment.apiUrl}/mis/horario`, { params });
  }

  override agregar(idMatricula: number, clase: ClasePorAgregar): Observable<ClaseDelHorario> {
    return this.http.post<ClaseDelHorario>(`${environment.apiUrl}/mis/matriculas/${idMatricula}/horario`, clase);
  }

  override quitar(idMatricula: number, consecutivo: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/mis/matriculas/${idMatricula}/horario/${consecutivo}`);
  }

  override miPreferencia(): Observable<PreferenciaDeHorario> {
    return this.http.get<PreferenciaDeHorario>(`${environment.apiUrl}/mis/preferencias-de-horario`);
  }

  override guardarPreferencia(preferencia: PreferenciaDeHorario): Observable<PreferenciaDeHorario> {
    return this.http.put<PreferenciaDeHorario>(`${environment.apiUrl}/mis/preferencias-de-horario`, preferencia);
  }
}

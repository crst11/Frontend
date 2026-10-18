import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export type PrioridadDePendiente = 'alta' | 'media' | 'baja';

/** Cómo está un pendiente respecto de la hora del servidor: lo decide el servidor, no el teléfono. */
export type SituacionDelPendiente = 'cumplido' | 'vencido' | 'urgente' | 'proximo';

/** Un pendiente como lo manda el servidor (RF06, SCRUM-29). `idMatricula` viene nulo si no es de una asignatura. */
export interface Pendiente {
  id: number;
  titulo: string;
  descripcion: string | null;
  fechaLimite: string;
  prioridad: PrioridadDePendiente;
  estado: 'abierto' | 'cumplido';
  situacion: SituacionDelPendiente;
  idMatricula: number | null;
}

/** Lo que se manda al crear. La fecha límite viaja como instante (ISO 8601). */
export interface PendientePorCrear {
  titulo: string;
  descripcion?: string;
  fechaLimite: string;
  prioridad: PrioridadDePendiente;
  idMatricula?: number;
}

/** Puerto del frontend hacia Mis Pendientes (RF06). */
@Injectable()
export abstract class PendienteRepository {
  /** Del más próximo al más lejano; los cumplidos solo con `incluirCumplidos`, y van al final. */
  abstract listar(incluirCumplidos?: boolean): Observable<Pendiente[]>;
  abstract crear(pendiente: PendientePorCrear): Observable<Pendiente>;
  abstract marcar(id: number, cumplido: boolean): Observable<Pendiente>;
  abstract eliminar(id: number): Observable<void>;
}

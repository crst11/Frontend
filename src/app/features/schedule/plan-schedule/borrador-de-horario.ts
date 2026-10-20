import { Injectable, inject } from '@angular/core';
import { SessionService } from '../../../core/session/session.service';
import { DispositivoDeLaSesion } from '../../../core/session/dispositivo-de-la-sesion';
import { CopiaLocalRepository } from '../../../data-access/copia-local.repository';
import {
  AsignaturaDeOferta,
  DiaDeClase,
  FranjaPreferida,
} from '../../../data-access/propuesta-de-horario.repository';

/** Lo que la persona va escribiendo en «Armar mi horario»: la oferta y lo que prefiere. */
export interface BorradorDeHorario {
  asignaturas: AsignaturaDeOferta[];
  franja: FranjaPreferida | null;
  pocosHuecos: boolean;
  diasLibres: DiaDeClase[];
}

/**
 * Guarda el borrador de «Armar mi horario» en el dispositivo (RF13, SCRUM-209), para que recargar la página no
 * obligue a escribir todo otra vez. Usa la misma copia local que la consulta sin conexión (RF12): la clave
 * lleva el id de la cuenta y **se borra al cerrar sesión**, junto con lo demás.
 *
 * <p>Nunca lanza: si el dispositivo no deja guardar, la pantalla sigue funcionando y lo único que se pierde es el
 * borrador.
 */
@Injectable({ providedIn: 'root' })
export class BorradorDeHorarioStore {
  private readonly copia = inject(CopiaLocalRepository);
  private readonly sesion = inject(SessionService);
  private readonly dispositivo = inject(DispositivoDeLaSesion);

  /** El borrador guardado, o `null` si no hay sesión, no hay nada guardado o lo guardado no sirve. */
  async cargar(): Promise<BorradorDeHorario | null> {
    const clave = this.clave();
    if (!clave) {
      return null;
    }
    try {
      const guardado = await this.copia.leer(clave);
      return esBorrador(guardado?.valor) ? guardado.valor : null;
    } catch {
      return null;
    }
  }

  async guardar(borrador: BorradorDeHorario): Promise<void> {
    const clave = this.clave();
    if (!clave) {
      return;
    }
    try {
      await this.copia.guardar(clave, borrador, Date.now());
    } catch {
      // Sin borrador la pantalla sirve igual.
    }
  }

  private clave(): string | null {
    const cuenta = this.sesion.cuenta();
    // En un equipo compartido no se guarda el borrador (SCRUM-231): se pierde al salir, pero no lo ve la persona que llegue después.
    return cuenta && this.dispositivo.permiteCopiaLocal() ? `${cuenta.id}|borrador-de-horario` : null;
  }
}

/** Lo guardado puede venir de una versión vieja de la pantalla: solo se usa si tiene la forma que se espera. */
function esBorrador(valor: unknown): valor is BorradorDeHorario {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }
  const candidato = valor as Partial<BorradorDeHorario>;
  return (
    Array.isArray(candidato.asignaturas) &&
    Array.isArray(candidato.diasLibres) &&
    typeof candidato.pocosHuecos === 'boolean' &&
    (candidato.franja === null || typeof candidato.franja === 'string')
  );
}

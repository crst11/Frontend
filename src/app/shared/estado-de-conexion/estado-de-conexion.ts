import { Component, computed, inject } from '@angular/core';
import { Conexion } from '../../core/offline/conexion.service';
import { Sincronizacion } from '../../core/offline/sincronizacion.service';

const ZONA = 'America/Bogota';

const FECHA = new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, day: 'numeric', month: 'short' });
const HORA = new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, hour: 'numeric', minute: '2-digit' });
/** Solo para saber si dos momentos caen el mismo día en Bogotá. */
const DIA = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA });

/** «hoy, 4:04 p. m.» o «17 oct, 4:04 p. m.»: la hora de Bogotá, como en el resto de la aplicación. */
export function cuando(momento: number, ahora: number = Date.now()): string {
  const fecha = new Date(momento);
  const dia = DIA.format(fecha) === DIA.format(new Date(ahora)) ? 'hoy' : FECHA.format(fecha);
  return `${dia}, ${HORA.format(fecha)}`;
}

/**
 * La franja de estado de la conexión (RF12, SCRUM-40). Sin conexión, o cuando lo que se ve salió de la copia
 * guardada, lo dice con palabras y dice de cuándo es; con conexión, muestra cuándo se actualizó la pantalla.
 *
 * <p>No depende del color: el texto lleva todo el mensaje, y `role="status"` hace que un lector de pantalla lo
 * anuncie cuando cambia.
 */
@Component({
  selector: 'app-estado-de-conexion',
  templateUrl: './estado-de-conexion.html',
  styleUrl: './estado-de-conexion.css',
})
export class EstadoDeConexion {
  private readonly conexion = inject(Conexion);
  private readonly sincronizacion = inject(Sincronizacion);

  protected readonly sinConexion = computed(() => !this.conexion.enLinea() || this.sincronizacion.mostrandoCopia());

  protected readonly fecha = computed(() => {
    const momento = this.sincronizacion.ultimaActualizacion();
    return momento === null ? null : cuando(momento);
  });
}

import { Location } from '@angular/common';

/** Pantallas desde las que se llega a importar y a las que se vuelve (SCRUM-82); lo demás cae en Mi cuenta. */
const ORIGENES: Record<string, string> = {
  '/inicio': 'Volver al inicio',
  '/importar': 'Volver a importar mis archivos',
  '/cuenta/historial': 'Volver a mi historial',
  '/cuenta/mi-cuenta': 'Volver a mi cuenta',
  '/horario': 'Volver a mi horario',
  '/calificaciones/mis-notas': 'Volver a mis notas',
};
const ORIGEN_PREDETERMINADO = '/cuenta/mi-cuenta';

export interface OrigenDeLaImportacion {
  ruta: string;
  texto: string;
}

/**
 * La pantalla desde la que se llegó, que viaja en el estado del historial del navegador (sobrevive a
 * recargar). Solo se aceptan las pantallas conocidas: nada que venga de fuera decide a dónde se vuelve.
 */
export function origenDeLaImportacion(ubicacion: Location): OrigenDeLaImportacion {
  const origen = (ubicacion.getState() as { origen?: unknown } | null)?.origen;
  const ruta = typeof origen === 'string' && origen in ORIGENES ? origen : ORIGEN_PREDETERMINADO;
  return { ruta, texto: ORIGENES[ruta] };
}

import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';

/** Cuánto tiempo sin actividad se tolera en un equipo compartido antes de cerrar la sesión (SCRUM-231). */
export const PLAZO_DE_INACTIVIDAD_EN_MS = new InjectionToken<number>('PLAZO_DE_INACTIVIDAD_EN_MS', {
  providedIn: 'root',
  factory: () => 15 * 60_000,
});

const CLAVE_DISPOSITIVO = 'cundiapp.dispositivo';
const CLAVE_ACTIVIDAD = 'cundiapp.ultima-actividad';
const COMPARTIDO = 'compartido';

/**
 * Si la sesión está en el dispositivo personal de la persona o en uno compartido (una sala de cómputo), y cuándo fue lo último que hizo
 * (SCRUM-231).
 *
 * <p>El problema: quien se va de una sala sin cerrar sesión deja abierta la sesión (la cookie de refresco dura 7 días) y la copia para
 * consultar sin conexión (RF12); la siguiente persona que abre la aplicación entra con ellas. En un dispositivo compartido, entonces:
 * no se guarda nada para consultar sin conexión, y la sesión se cierra sola tras {@link PLAZO_DE_INACTIVIDAD_EN_MS} sin actividad, tanto
 * con la aplicación abierta como al volver a abrirla.
 *
 * <p>Esto solo guarda dos datos en el dispositivo y ninguno es personal ni un secreto: la elección (`personal` o `compartido`) y el
 * momento de la última actividad (milisegundos desde 1970). Si el navegador no deja guardar (ventana privada), vale la elección en
 * memoria mientras la aplicación siga abierta. Es una protección contra la persona que llega después, no contra quien manipula el
 * dispositivo: quien ya está sentado en él puede escribir en `localStorage`.
 */
@Injectable({ providedIn: 'root' })
export class DispositivoDeLaSesion {
  private readonly plazo = inject(PLAZO_DE_INACTIVIDAD_EN_MS);
  private readonly compartido = signal(leer(CLAVE_DISPOSITIVO) === COMPARTIDO);
  private ultimaActividadEnMemoria: number | null = null;

  readonly esCompartido = this.compartido.asReadonly();
  /** La copia para consultar sin conexión solo se guarda en un dispositivo personal. */
  readonly permiteCopiaLocal = computed(() => !this.compartido());

  /** Lo que la persona eligió al iniciar sesión. En uno compartido la cuenta de la inactividad empieza ahora. */
  marcar(esPersonal: boolean, ahora = Date.now()): void {
    this.compartido.set(!esPersonal);
    if (esPersonal) {
      quitar(CLAVE_DISPOSITIVO);
      quitar(CLAVE_ACTIVIDAD);
      this.ultimaActividadEnMemoria = null;
    } else {
      guardar(CLAVE_DISPOSITIVO, COMPARTIDO);
      this.registrarActividad(ahora, true);
    }
  }

  /** Anota que la persona sigue ahí. Solo importa en uno compartido; fuera de él no hace nada. */
  registrarActividad(ahora = Date.now(), forzar = false): void {
    if (!this.compartido()) {
      return;
    }
    // Escribir en el almacenamiento en cada movimiento del ratón sería un gasto sin sentido: con un margen de 10 s sobra.
    if (!forzar && this.ultimaActividadEnMemoria !== null && ahora - this.ultimaActividadEnMemoria < 10_000) {
      return;
    }
    this.ultimaActividadEnMemoria = ahora;
    guardar(CLAVE_ACTIVIDAD, String(ahora));
  }

  /** Cuánto lleva sin actividad (ms), o `null` si no es un dispositivo compartido o no hay registro. */
  inactivoDesde(ahora = Date.now()): number | null {
    if (!this.compartido()) {
      return null;
    }
    const ultima = this.ultimaActividadEnMemoria ?? numero(leer(CLAVE_ACTIVIDAD));
    return ultima === null ? null : Math.max(0, ahora - ultima);
  }

  /** `true` si es un dispositivo compartido y ya pasó el plazo sin actividad. */
  estaInactivo(ahora = Date.now()): boolean {
    const inactivo = this.inactivoDesde(ahora);
    return inactivo !== null && inactivo >= this.plazo;
  }

  /** Cuánto falta para que se cumpla el plazo, o `null` si no aplica. */
  faltaParaCerrar(ahora = Date.now()): number | null {
    const inactivo = this.inactivoDesde(ahora);
    return inactivo === null ? null : Math.max(0, this.plazo - inactivo);
  }

  /** Al cerrar la sesión no queda nada de esto: la próxima persona empieza de cero. */
  olvidar(): void {
    this.compartido.set(false);
    this.ultimaActividadEnMemoria = null;
    quitar(CLAVE_DISPOSITIVO);
    quitar(CLAVE_ACTIVIDAD);
  }
}

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function guardar(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento (ventana privada, sin espacio): vale lo que está en memoria mientras la aplicación siga abierta.
  }
}

function quitar(clave: string): void {
  try {
    localStorage.removeItem(clave);
  } catch {
    // ídem
  }
}

function numero(texto: string | null): number | null {
  if (texto === null) {
    return null;
  }
  const valor = Number(texto);
  return Number.isFinite(valor) ? valor : null;
}

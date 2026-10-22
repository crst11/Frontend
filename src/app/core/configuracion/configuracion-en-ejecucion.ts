/**
 * Configuración que se lee al arrancar, no al compilar (12 factores, factores 3 y 5, SCRUM-218). Una sola compilación
 * sirve a todos los ambientes: lo que cambia entre preproducción y producción está en `/config.json`, que el despliegue
 * escribe junto a los archivos de la app.
 *
 * Todo lo que hay aquí es público (la llave de Cloudflare Turnstile, el client ID de Google y la ruta de la API): llega al
 * navegador de todas formas. Nada secreto va en `config.json`.
 */
export interface ConfiguracionDeEjecucion {
  /** Ruta o dirección de la API. Relativa (`/api`) cuando el sitio y la API comparten origen. */
  apiUrl: string;
  /** Client ID de Google. Vacío = el botón de Google no se muestra. */
  googleClientId: string;
  /** Llave pública de Turnstile. Vacía = la verificación de bots está apagada. */
  turnstileLlave: string;
  /**
   * La página pública de la universidad donde se consulta la oferta de horarios (SCRUM-248). Es la misma en todos los
   * ambientes, así que no se lee de `config.json`: vale la de la compilación.
   */
  urlConsultaDeHorarios: string;
}

/** Dónde se guarda la última configuración buena, para poder arrancar sin red (RF12). */
export const CLAVE_DE_LA_COPIA = 'cundiapp.configuracion';

const RUTA_DE_LA_CONFIGURACION = '/config.json';
/** Que un servidor lento no deje la pantalla en blanco: pasado esto se arranca con lo que haya. */
const ESPERA_MAXIMA_MS = 3000;

type Almacen = Pick<Storage, 'getItem' | 'setItem'>;
type Obtener = (entrada: string, opciones?: RequestInit) => Promise<Response>;

/** Una ruta que empieza con una sola barra, o una dirección http(s). Nada de `javascript:`, `data:` ni `//otro-sitio`. */
function esUnaApiUrlValida(valor: string): boolean {
  return /^\/(?!\/)/.test(valor) || /^https?:\/\/[^\s/]+/i.test(valor);
}

/** Se queda solo con las claves conocidas y bien formadas: lo demás se ignora. */
function validar(crudo: unknown): Partial<ConfiguracionDeEjecucion> {
  if (typeof crudo !== 'object' || crudo === null || Array.isArray(crudo)) {
    return {};
  }
  const datos = crudo as Record<string, unknown>;
  const valida: Partial<ConfiguracionDeEjecucion> = {};
  if (typeof datos['googleClientId'] === 'string') {
    valida.googleClientId = datos['googleClientId'];
  }
  if (typeof datos['turnstileLlave'] === 'string') {
    valida.turnstileLlave = datos['turnstileLlave'];
  }
  if (typeof datos['apiUrl'] === 'string' && esUnaApiUrlValida(datos['apiUrl'])) {
    valida.apiUrl = datos['apiUrl'];
  }
  return valida;
}

function leerCopia(almacen: Almacen | null): Partial<ConfiguracionDeEjecucion> {
  try {
    const texto = almacen?.getItem(CLAVE_DE_LA_COPIA);
    return texto ? validar(JSON.parse(texto)) : {};
  } catch {
    return {};
  }
}

function guardarCopia(almacen: Almacen | null, configuracion: Partial<ConfiguracionDeEjecucion>): void {
  try {
    almacen?.setItem(CLAVE_DE_LA_COPIA, JSON.stringify(configuracion));
  } catch {
    // Modo privado o almacenamiento lleno: la app arranca igual, solo que sin copia para la próxima vez.
  }
}

/**
 * Lo que dijo el servidor. `sin-respuesta` (sin red, tiempo agotado o error 5xx) es la unica situacion en que vale la
 * copia guardada: si el servidor contesta que no hay config.json, la copia vieja ya no manda.
 */
type Descarga =
  | { estado: 'recibida'; datos: Partial<ConfiguracionDeEjecucion> }
  | { estado: 'sin-archivo' }
  | { estado: 'sin-respuesta' };

async function descargar(obtener: Obtener): Promise<Descarga> {
  let respuesta: Response;
  try {
    respuesta = await obtener(RUTA_DE_LA_CONFIGURACION, {
      cache: 'no-store',
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
    });
  } catch {
    return { estado: 'sin-respuesta' };
  }
  if (respuesta.status >= 500) {
    return { estado: 'sin-respuesta' };
  }
  if (!respuesta.ok) {
    return { estado: 'sin-archivo' };
  }
  try {
    return { estado: 'recibida', datos: validar(await respuesta.json()) };
  } catch {
    // Si el sitio no tiene config.json, el hosting suele devolver index.html con 200 (rutas de Angular): eso no es JSON.
    return { estado: 'sin-archivo' };
  }
}

/**
 * Devuelve la configuracion con la que arranca la app, sin tocar `base`. En orden de prioridad: lo recien descargado de
 * `/config.json`, la ultima copia buena de este navegador (solo si el servidor no respondio) y los valores que trae la
 * compilacion.
 */
export async function leerConfiguracion(
  base: ConfiguracionDeEjecucion,
  obtener: Obtener = (entrada, opciones) => fetch(entrada, opciones),
  almacen: Almacen | null = almacenDelNavegador(),
): Promise<ConfiguracionDeEjecucion> {
  const descarga = await descargar(obtener);
  switch (descarga.estado) {
    case 'recibida':
      guardarCopia(almacen, descarga.datos);
      return { ...base, ...descarga.datos };
    case 'sin-archivo':
      // El servidor contesto y no hay configuracion: se olvida la copia, para no arrastrar para siempre una apiUrl vieja.
      guardarCopia(almacen, {});
      return { ...base };
    case 'sin-respuesta':
      return { ...base, ...leerCopia(almacen) };
  }
}

function almacenDelNavegador(): Almacen | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

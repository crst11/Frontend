import { extraerPaginasDeMhtml } from '../../../importing/import-cmad/mhtml';
import { OfertaLeida, OfertaNoLegible, leerOfertaDeHorarios } from './lector-de-oferta';

/** Lo más grande que se acepta, subido o pegado: la página real de una carrera pesa menos de 100 KB. */
export const MAXIMO_DE_BYTES = 2 * 1024 * 1024;

/** La plataforma de la universidad guarda sus páginas en este juego de caracteres. */
const JUEGO_POR_DEFECTO = 'windows-1252';
const BYTES_DONDE_BUSCAR_EL_JUEGO = 4096;

const MENSAJE_DEL_TAMANO =
  'El archivo es demasiado grande para ser la tabla de horarios (pasa de 2 MB). Sube el archivo pub_rep_val.html ' +
  'de la carpeta que se creó al guardar la página.';

/**
 * Lee la oferta de horarios de un archivo que guardó la persona (`.html` o `.mht`, SCRUM-243). Todo ocurre en el
 * navegador: el archivo no se envía a ningún lado. Se revisa el tamaño antes de leerlo.
 */
export async function leerArchivoDeOferta(archivo: File): Promise<OfertaLeida> {
  if (archivo.size > MAXIMO_DE_BYTES) {
    throw new OfertaNoLegible(MENSAJE_DEL_TAMANO);
  }
  const texto = decodificar(new Uint8Array(await archivo.arrayBuffer()));
  // Lo que no es un MHTML es su única página: sirve para el `.html`. El `.mht` que guarda Chrome en el teléfono trae
  // varias (el marco de afuera, uno vacío y la tabla): se prueba cada una y gana la primera que es la tabla.
  return leerLaPrimeraQueEsLaTabla(extraerPaginasDeMhtml(texto));
}

function leerLaPrimeraQueEsLaTabla(paginas: readonly string[]): OfertaLeida {
  let primerFallo: OfertaNoLegible | null = null;
  for (const pagina of paginas) {
    try {
      return leerOfertaDeHorarios(pagina);
    } catch (fallo) {
      if (!(fallo instanceof OfertaNoLegible)) {
        throw fallo;
      }
      primerFallo ??= fallo;
    }
  }
  // Nunca llega vacío: `extraerPaginasDeMhtml` devuelve al menos una página.
  throw primerFallo ?? new OfertaNoLegible(MENSAJE_DE_LA_CARPETA);
}

/** Lo máximo de páginas que se prueban de una carpeta elegida: la que guarda el navegador trae unas pocas. */
export const MAXIMO_DE_PAGINAS_DE_LA_CARPETA = 50;
/** Lo máximo de archivos de la carpeta que se miran para encontrar esas páginas (por si se eligió una carpeta enorme). */
const MAXIMO_DE_ARCHIVOS_DE_LA_CARPETA = 5000;
const ES_UNA_PAGINA = /\.(html?|mht|mhtml)$/i;

const MENSAJE_DE_LA_CARPETA =
  'En esa carpeta no encontramos la tabla de horarios. Elige la carpeta que termina en «_files», la que se creó ' +
  'junto al archivo que guardaste (adentro está pub_rep_val.html).';

/**
 * Lee la oferta de una carpeta que eligió la persona: la que el navegador crea junto a la página guardada (termina
 * en «_files») y trae la tabla en `pub_rep_val.html`. Así no tiene que buscar el archivo adentro. Solo se prueban
 * páginas (.html, .htm, .mht), de a lo sumo 2 MB, empezando por `pub_rep_val`; la primera que sea la tabla gana.
 * Todo ocurre en el navegador.
 */
export async function leerCarpetaDeOferta(archivos: readonly File[]): Promise<OfertaLeida> {
  const paginas = archivos
    .slice(0, MAXIMO_DE_ARCHIVOS_DE_LA_CARPETA)
    .filter((archivo) => ES_UNA_PAGINA.test(archivo.name) && archivo.size <= MAXIMO_DE_BYTES)
    .sort((a, b) => Number(b.name.includes('pub_rep_val')) - Number(a.name.includes('pub_rep_val')))
    .slice(0, MAXIMO_DE_PAGINAS_DE_LA_CARPETA);
  for (const pagina of paginas) {
    try {
      return await leerArchivoDeOferta(pagina);
    } catch {
      // Una página que no es la tabla, o que el navegador no logra abrir, no impide probar las demás de la carpeta.
    }
  }
  throw new OfertaNoLegible(MENSAJE_DE_LA_CARPETA);
}

/** Lee la oferta de la tabla que la persona copió de la página y pegó: llega ya como texto. */
export function leerOfertaPegada(html: string): OfertaLeida {
  if (html.length > MAXIMO_DE_BYTES) {
    throw new OfertaNoLegible(MENSAJE_DEL_TAMANO);
  }
  return leerOfertaDeHorarios(html);
}

/** Decodifica con el juego de caracteres que declara el archivo y, si falta o no existe, con el de la plataforma. */
function decodificar(bytes: Uint8Array): string {
  const principio = new TextDecoder(JUEGO_POR_DEFECTO).decode(bytes.subarray(0, BYTES_DONDE_BUSCAR_EL_JUEGO));
  const declarado = /charset\s*=\s*["']?([\w-]+)/i.exec(principio)?.[1] ?? JUEGO_POR_DEFECTO;
  try {
    return new TextDecoder(declarado).decode(bytes);
  } catch {
    return new TextDecoder(JUEGO_POR_DEFECTO).decode(bytes);
  }
}

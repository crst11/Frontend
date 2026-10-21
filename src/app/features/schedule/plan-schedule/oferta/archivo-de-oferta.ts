import { extraerHtmlDeMhtml } from '../../../importing/import-cmad/mhtml';
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
  // Lo que no es un MHTML se devuelve igual: sirve para el `.html` y para el `.mht` que guarda Chrome en el teléfono.
  return leerOfertaDeHorarios(extraerHtmlDeMhtml(texto));
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

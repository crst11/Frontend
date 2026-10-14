import { Injectable } from '@angular/core';

/** El texto que devuelve el OCR sin las rayas de la tabla ni los espacios de más. */
export function limpiarTextoDeOcr(texto: string): string {
  return texto
    .replace(/[|¦]/g, ' ')
    .split('\n')
    .map((linea) => linea.replace(/[ \t]+/g, ' ').trim())
    .filter((linea) => linea !== '')
    .join('\n');
}

/** El ancho al que se lleva la imagen antes de leerla: el OCR confunde la coma decimal en letra chica. */
const ANCHO_PARA_LEER = 2400;

/**
 * Agranda (o reduce) la imagen al ancho que mejor lee el OCR y sube el contraste. Si algo falla se
 * lee la original: es una mejora, no un requisito.
 */
async function prepararImagen(imagen: File): Promise<Blob> {
  try {
    const mapa = await createImageBitmap(imagen);
    const escala = ANCHO_PARA_LEER / mapa.width;
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(mapa.width * escala);
    lienzo.height = Math.round(mapa.height * escala);
    const contexto = lienzo.getContext('2d');
    if (!contexto) {
      return imagen;
    }
    contexto.filter = 'grayscale(1) contrast(1.4)';
    contexto.drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
    return await new Promise<Blob>((resolver) => lienzo.toBlob((blob) => resolver(blob ?? imagen), 'image/png'));
  } catch {
    return imagen;
  }
}

/**
 * Lee el texto de una foto o captura de pantalla con OCR (Tesseract.js, en español). **Corre en el
 * navegador: la imagen no se sube a ningún servidor.** La librería y el idioma se descargan la primera
 * vez que alguien lo usa, no al abrir la app.
 */
@Injectable({ providedIn: 'root' })
export class LectorDeImagen {
  /** `alProgreso` recibe un número de 0 a 1 mientras se lee. */
  async leer(imagen: File, alProgreso: (avance: number) => void): Promise<string> {
    const { createWorker } = await import('tesseract.js');
    const lector = await createWorker('spa', 1, {
      logger: (mensaje) => {
        if (mensaje.status === 'recognizing text') {
          alProgreso(mensaje.progress);
        }
      },
    });
    try {
      const { data } = await lector.recognize(await prepararImagen(imagen));
      return limpiarTextoDeOcr(data.text);
    } finally {
      await lector.terminate();
    }
  }
}

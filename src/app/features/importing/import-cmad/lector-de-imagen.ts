import { Injectable } from '@angular/core';
import type { PaddleOCR } from '@paddleocr/paddleocr-js';

/** Lo que devuelve crear el lector (con o sin worker): lo único que se usa es leer una imagen. */
type Motor = Awaited<ReturnType<typeof PaddleOCR.create>>;

/**
 * Dónde están los archivos WebAssembly de onnxruntime-web, el motor que corre el modelo. Es la misma
 * versión que está instalada (\`onnxruntime-web\` en package-lock.json): al actualizarla, se cambia aquí.
 */
const RUTA_DE_ONNX = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/';

/** El lado mayor al que se lleva la imagen antes de leerla: más grande solo la hace más lenta. */
const LADO_MAXIMO = 1600;

/** Un trozo de texto que el OCR encontró, con dónde está en la imagen. */
export interface TextoEncontrado {
  texto: string;
  x: number;
  y: number;
  alto: number;
}

/**
 * Junta los trozos que están a la misma altura en una línea, de izquierda a derecha, y las líneas de
 * arriba abajo. Así una fila de la tabla (nombre, peso, nota y rango) sale como una sola línea de texto.
 */
export function juntarEnLineas(trozos: TextoEncontrado[]): string {
  const lineas: { y: number; alto: number; trozos: TextoEncontrado[] }[] = [];
  for (const trozo of [...trozos].sort((a, b) => a.y - b.y)) {
    const linea = lineas.find((l) => Math.abs(l.y - trozo.y) < Math.max(l.alto, trozo.alto) * 0.6);
    if (linea) {
      linea.trozos.push(trozo);
    } else {
      lineas.push({ y: trozo.y, alto: trozo.alto, trozos: [trozo] });
    }
  }
  return lineas.map((l) => [...l.trozos].sort((a, b) => a.x - b.x).map((t) => t.texto).join(' ')).join('\n');
}

/** El texto que devuelve el OCR sin las rayas de la tabla ni los espacios de más. */
export function limpiarTextoDeOcr(texto: string): string {
  return texto
    .replace(/[|¦]/g, ' ')
    .split('\n')
    .map((linea) => linea.replace(/[ \t]+/g, ' ').trim())
    .filter((linea) => linea !== '')
    .join('\n');
}

/** Reduce la imagen si es más grande de lo que hace falta; una imagen chica se deja como está. */
async function ajustarTamano(imagen: File): Promise<Blob> {
  try {
    const mapa = await createImageBitmap(imagen);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(mapa.width, mapa.height));
    if (escala === 1) {
      return imagen;
    }
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(mapa.width * escala);
    lienzo.height = Math.round(mapa.height * escala);
    lienzo.getContext('2d')?.drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
    return await new Promise<Blob>((resolver) => lienzo.toBlob((blob) => resolver(blob ?? imagen), 'image/png'));
  } catch {
    return imagen;
  }
}

/**
 * Lee el texto de una foto o captura de pantalla con OCR (PaddleOCR, modelo PP-OCRv6 en español).
 * **Corre en el navegador: la imagen no se sube a ningún servidor.** Usa la tarjeta gráfica (WebGPU)
 * si el teléfono la tiene y si no, el procesador. La librería y el modelo se descargan la primera vez
 * que alguien lo usa, no al abrir la app, y se reutilizan después.
 *
 * <p>Se eligió sobre Tesseract.js tras medir ambos con la misma tabla del CMAD en cinco calidades de
 * imagen (limpia, captura de teléfono, foto borrosa, poco contraste y tipografía serif): PaddleOCR leyó
 * bien todas las filas, pesos y notas en las cinco, y Tesseract se quedó entre 17 % y 92 % en las
 * difíciles; además PP-OCRv6 tarda menos de un segundo por imagen una vez cargado.
 */
@Injectable({ providedIn: 'root' })
export class LectorDeImagen {
  private motor: Promise<Motor> | null = null;

  async leer(imagen: File): Promise<string> {
    const motor = await this.cargarMotor();
    const [resultado] = await motor.predict(await ajustarTamano(imagen));
    return limpiarTextoDeOcr(
      juntarEnLineas(
        resultado.items.map((item) => {
          const ys = item.poly.map((punto) => punto[1]);
          return {
            texto: item.text,
            x: Math.min(...item.poly.map((punto) => punto[0])),
            y: ys.reduce((suma, y) => suma + y, 0) / ys.length,
            alto: Math.max(...ys) - Math.min(...ys),
          };
        }),
      ),
    );
  }

  /** El motor se crea una sola vez; si falla (sin red, por ejemplo) se vuelve a intentar la próxima. */
  private cargarMotor(): Promise<Motor> {
    this.motor ??= import('@paddleocr/paddleocr-js')
      .then(({ PaddleOCR: Motor }) =>
        Motor.create({ lang: 'es', ocrVersion: 'PP-OCRv6', ortOptions: { backend: 'auto', wasmPaths: RUTA_DE_ONNX } }),
      )
      .catch((error: unknown) => {
        this.motor = null;
        throw error;
      });
    return this.motor;
  }
}

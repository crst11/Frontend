import { Injectable } from '@angular/core';
import type { PaddleOCR } from '@paddleocr/paddleocr-js';

/** Lo que devuelve crear el lector (con o sin worker): lo único que se usa es leer una imagen. */
type Motor = Awaited<ReturnType<typeof PaddleOCR.create>>;

/**
 * Dónde están los archivos WebAssembly de onnxruntime-web, el motor que corre el modelo. Es la misma
 * versión que está instalada (onnxruntime-web en package-lock.json): al actualizarla, se cambia aquí.
 */
const RUTA_DE_ONNX = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/';

/**
 * Los modelos de lectura (PP-OCRv6 liviano, 6 MB) viven en este mismo sitio, en public/ocr. Antes se
 * bajaban del servidor de Baidu en cada sesión: 31 MB que desde Colombia tardaban de uno a tres minutos
 * y a veces no llegaban. Alojados aquí van con el resto de la aplicación, el service worker los guarda y
 * la segunda vez no se bajan. El nombre del archivo lleva el del modelo: si cambia, cambia la dirección.
 */
const MODELOS = {
  deteccion: { nombre: 'PP-OCRv6_tiny_det', archivo: 'ocr/PP-OCRv6_tiny_det_onnx_infer.tar' },
  lectura: { nombre: 'PP-OCRv6_tiny_rec', archivo: 'ocr/PP-OCRv6_tiny_rec_onnx_infer.tar' },
};

/** El ancho al que se lleva una imagen más ancha antes de leerla: más grande solo la hace más lenta. */
const ANCHO_MAXIMO = 1700;

/**
 * Hasta cuánto se lee de una vez. Una captura de toda la página puede medir 1622 × 6420: reducirla a un
 * lado de 1600 dejaba el texto ilegible (escala 0,25) y no se leía nada. Se corta en franjas a tamaño
 * legible, que además se leen más rápido que la imagen entera.
 */
const ALTO_DE_FRANJA = 1400;

/** Cuánto se repite entre una franja y la siguiente, para que una fila cortada por el borde se lea entera. */
const SOLAPE = 160;

/** Un trozo de texto que el OCR encontró, con dónde está en la imagen. */
export interface TextoEncontrado {
  texto: string;
  x: number;
  y: number;
  alto: number;
  /** Hasta dónde llega a la derecha. Con él se sabe si entre dos trozos hay el hueco de una celda. */
  xFin?: number;
}

/**
 * Junta los trozos que están a la misma altura en una línea, de izquierda a derecha, y las líneas de
 * arriba abajo. Así una fila de la tabla (nombre, peso, nota y rango) sale como una sola línea de texto.
 * Entre dos trozos separados por un hueco más ancho que una letra y media se pone un tabulador, como el
 * de una tabla copiada: así se distingue una celda de la siguiente (el nombre de la retroalimentación).
 *
 * <p>Con hastaX se descarta todo lo que empieza más a la derecha: en la página de calificaciones son el
 * porcentaje, la retroalimentación del docente (a veces un párrafo largo que nombra a otras personas) y lo
 * que aporta al curso. Nada de eso hace falta, y un porcentaje suelto junto al nombre se leía como su peso.
 */
export function juntarEnLineas(trozos: TextoEncontrado[], hastaX?: number): string {
  const lineas: { y: number; alto: number; trozos: TextoEncontrado[] }[] = [];
  const leidos = hastaX === undefined ? trozos : trozos.filter((trozo) => trozo.x <= hastaX);
  for (const trozo of [...leidos].sort((a, b) => a.y - b.y)) {
    const linea = lineas.find((l) => Math.abs(l.y - trozo.y) < Math.max(l.alto, trozo.alto) * 0.6);
    if (linea) {
      linea.trozos.push(trozo);
    } else {
      lineas.push({ y: trozo.y, alto: trozo.alto, trozos: [trozo] });
    }
  }
  return lineas.map((l) => unirTrozos([...l.trozos].sort((a, b) => a.x - b.x))).join('\n');
}

/** Las etiquetas de tipo en mayúsculas (TAREA…): están al principio de cada actividad, en la columna del nombre. */
const ETIQUETA = /^(?:TAREA|CUESTIONARIO|FORO|TALLER|LECCI[OÓ]N|WIKI|GLOSARIO|ENCUESTA|ELECCI[OÓ]N|CHAT|PAQUETE SCORM|BASE DE DATOS|CONTENIDO INTERACTIVO)$/;

/** El rango de la nota («0-5», «0–10») tal como sale en su columna. */
const RANGO_DE_LA_NOTA = /^\d+\s*[–-]\s*\d+$/;

/**
 * Hasta dónde se lee hacia la derecha, si la imagen es la página de calificaciones: un poco más allá de
 * la columna del rango (nombre, peso, nota y rango son las que hacen falta). Se ubica con los mismos
 * rangos que trae la imagen (su posición es la mediana de todos), porque el ancho de las columnas cambia
 * de una captura a otra y un corte fijo dejaba el rango del otro lado. Queda el porcentaje, que el lector
 * ignora por ir después del rango, y se descartan la retroalimentación (a 131 px del rango en una captura
 * de 1622 de ancho) y lo que aporta al curso (a 304). Nula si la imagen no trae las etiquetas de tipo
 * (TAREA…) ni varios rangos: no es esa página y se lee todo.
 */
export function finDeLasColumnasQueSeLeen(trozos: TextoEncontrado[], anchoDeLaImagen: number): number | undefined {
  const hayEtiquetas = trozos.filter((t) => ETIQUETA.test(t.texto.trim())).length >= 2;
  const rangos = trozos
    .filter((t) => RANGO_DE_LA_NOTA.test(t.texto.trim()))
    .map((t) => t.x)
    .sort((a, b) => a - b);
  if (!hayEtiquetas || rangos.length < 2) {
    return undefined;
  }
  return rangos[Math.floor(rangos.length / 2)] + anchoDeLaImagen * 0.065;
}

function unirTrozos(trozos: TextoEncontrado[]): string {
  return trozos
    .map((trozo, i) => {
      const previo = trozos[i - 1];
      if (!previo) {
        return trozo.texto;
      }
      const hueco = previo.xFin === undefined ? 0 : trozo.x - previo.xFin;
      return (hueco > Math.max(previo.alto, trozo.alto) * 1.5 ? '\t' : ' ') + trozo.texto;
    })
    .join('');
}

/** El texto que devuelve el OCR sin las rayas de la tabla ni los espacios de más (los tabuladores se conservan). */
export function limpiarTextoDeOcr(texto: string): string {
  return texto
    .replace(/[|¦]/g, ' ')
    .split('\n')
    .map((linea) => linea.replace(/ +/g, ' ').replace(/ ?\t[ \t]*/g, '\t').trim())
    .filter((linea) => linea !== '')
    .join('\n');
}

/** Un tramo de la imagen que se lee de una vez, y la parte de él que le toca conservar. */
export interface Franja {
  desde: number;
  hasta: number;
  /** Lo que queda dentro de [propiaDesde, propiaHasta) es de esta franja; el resto lo lee la vecina. */
  propiaDesde: number;
  propiaHasta: number;
}

/**
 * Las franjas en que se corta una imagen de ese alto: todas del mismo tamaño, con un solape entre una y
 * la siguiente. Cada fila cae en el solape de dos franjas y se queda con la que la ve más al centro, así
 * no sale repetida ni cortada por la mitad.
 */
export function franjasDe(alto: number): Franja[] {
  if (alto <= ALTO_DE_FRANJA + SOLAPE) {
    return [{ desde: 0, hasta: alto, propiaDesde: 0, propiaHasta: alto }];
  }
  const cantidad = Math.ceil((alto - SOLAPE) / (ALTO_DE_FRANJA - SOLAPE));
  const altoDeCadaUna = Math.ceil((alto + (cantidad - 1) * SOLAPE) / cantidad);
  const paso = altoDeCadaUna - SOLAPE;
  const tramos = Array.from({ length: cantidad }, (_, i) => {
    const desde = Math.min(i * paso, alto - altoDeCadaUna);
    return { desde, hasta: desde + altoDeCadaUna };
  });
  // El límite entre dos franjas es el punto medio de lo que las dos ven: ahí cambia de dueña cada fila.
  const limites = tramos.slice(1).map((tramo, i) => Math.round((tramo.desde + tramos[i].hasta) / 2));
  return tramos.map((tramo, i) => ({
    ...tramo,
    propiaDesde: i === 0 ? 0 : limites[i - 1],
    propiaHasta: i === cantidad - 1 ? alto : limites[i],
  }));
}

/** Cómo va la lectura, para que la pantalla lo cuente: primero se prepara el lector y luego cada franja. */
export interface AvanceDeLaLectura {
  etapa: 'preparando' | 'leyendo';
  franja: number;
  franjas: number;
}

/**
 * Lee el texto de una foto o captura de pantalla con OCR (PaddleOCR, modelo PP-OCRv6 liviano en
 * español). **Corre en el navegador: la imagen no se sube a ningún servidor.** Usa la tarjeta gráfica
 * (WebGPU) si el dispositivo la tiene y si no, el procesador. La librería y los modelos se descargan la
 * primera vez que alguien lo usa, no al abrir la app, y se reutilizan después.
 *
 * <p>Se eligió PaddleOCR sobre Tesseract.js tras medir ambos con la misma tabla del CMAD en cinco
 * calidades de imagen (limpia, captura de teléfono, foto borrosa, poco contraste y tipografía serif).
 */
@Injectable({ providedIn: 'root' })
export class LectorDeImagen {
  private motor: Promise<Motor> | null = null;

  /** `alAvanzar` recibe en qué franja va, para mostrarlo: una captura larga son varias lecturas seguidas. */
  async leer(imagen: File, alAvanzar: (avance: AvanceDeLaLectura) => void = () => undefined): Promise<string> {
    alAvanzar({ etapa: 'preparando', franja: 0, franjas: 0 });
    const motor = await this.cargarMotor();
    const mapa = await createImageBitmap(imagen);
    try {
      const escala = Math.min(1, ANCHO_MAXIMO / mapa.width);
      const ancho = Math.round(mapa.width * escala);
      const alto = Math.round(mapa.height * escala);
      const franjas = franjasDe(alto);

      const trozos: TextoEncontrado[] = [];
      for (const [i, franja] of franjas.entries()) {
        alAvanzar({ etapa: 'leyendo', franja: i + 1, franjas: franjas.length });
        const [resultado] = await motor.predict(await recortar(mapa, escala, ancho, franja));
        for (const item of resultado.items) {
          const xs = item.poly.map((punto) => punto[0]);
          const ys = item.poly.map((punto) => punto[1]);
          const y = franja.desde + ys.reduce((suma, valor) => suma + valor, 0) / ys.length;
          if (y >= franja.propiaDesde && y < franja.propiaHasta) {
            trozos.push({ texto: item.text, x: Math.min(...xs), xFin: Math.max(...xs), y, alto: Math.max(...ys) - Math.min(...ys) });
          }
        }
      }
      return limpiarTextoDeOcr(juntarEnLineas(trozos, finDeLasColumnasQueSeLeen(trozos, ancho)));
    } finally {
      mapa.close();
    }
  }

  /** El motor se crea una sola vez; si falla (sin red, por ejemplo) se vuelve a intentar la próxima. */
  private cargarMotor(): Promise<Motor> {
    this.motor ??= import('@paddleocr/paddleocr-js')
      .then(({ PaddleOCR: Motor }) =>
        Motor.create({
          textDetectionModelName: MODELOS.deteccion.nombre,
          textDetectionModelAsset: { url: new URL(MODELOS.deteccion.archivo, document.baseURI).href },
          textRecognitionModelName: MODELOS.lectura.nombre,
          textRecognitionModelAsset: { url: new URL(MODELOS.lectura.archivo, document.baseURI).href },
          ortOptions: { backend: 'auto', wasmPaths: RUTA_DE_ONNX },
        }),
      )
      .catch((error: unknown) => {
        this.motor = null;
        throw error;
      });
    return this.motor;
  }
}

/** El tramo de la imagen (ya a la escala de lectura) como una imagen aparte. */
async function recortar(mapa: ImageBitmap, escala: number, ancho: number, franja: Franja): Promise<Blob> {
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = franja.hasta - franja.desde;
  const contexto = lienzo.getContext('2d');
  if (!contexto) {
    throw new Error('No se pudo preparar la imagen para leerla.');
  }
  contexto.drawImage(
    mapa,
    0,
    franja.desde / escala,
    mapa.width,
    (franja.hasta - franja.desde) / escala,
    0,
    0,
    lienzo.width,
    lienzo.height,
  );
  return await new Promise<Blob>((resolver, rechazar) =>
    lienzo.toBlob((blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo preparar la imagen para leerla.'))), 'image/png'),
  );
}

import { AsignaturaDeOferta, DiaDeClase } from '../../../../data-access/propuesta-de-horario.repository';

/** Lo máximo que se lee de una tabla: más filas que las de la oferta real (424) con mucho margen. */
export const MAXIMO_DE_FILAS = 2000;
/** El texto más largo que puede tener una celda; los nombres de materia más largos miden 60. */
export const MAXIMO_DE_LA_CELDA = 200;

const COLUMNAS = 9;
const MAXIMO_DE_COLUMNAS_QUE_ABARCA_UNA_CELDA = 20;
const SIN_HORARIO = /sin\s+horario/i;

export interface BloqueLeido {
  dia: DiaDeClase;
  inicio: string;
  /** Tal como viene en la tabla (`09:59`): la hora en que termina el último minuto de clase. */
  fin: string;
  salon: string | null;
}

export interface GrupoLeido {
  codigo: string;
  cupos: number | null;
  bloques: BloqueLeido[];
}

export interface MateriaLeida {
  semestre: number;
  codigo: string;
  nombre: string;
  grupos: GrupoLeido[];
}

export interface OfertaLeida {
  periodo: string | null;
  materias: MateriaLeida[];
}

/** Lo que se subió no es la tabla de horarios; el mensaje le dice a la persona qué hacer. */
export class OfertaNoLegible extends Error {}

const DIAS: Record<string, DiaDeClase> = {
  lunes: 'lunes',
  martes: 'martes',
  miercoles: 'miercoles',
  jueves: 'jueves',
  viernes: 'viernes',
  sabado: 'sabado',
  domingo: 'domingo',
};

const LARGO_MAXIMO_DE_LA_CARPETA = 150;

/**
 * Lo que se le dice a quien sube el archivo de «afuera» (el marco vacío que deja Ctrl+S): dónde está la tabla. La
 * carpeta sale de la ruta del marco principal del propio archivo; si no se puede leer, se describe en general.
 */
function mensajeDelArchivoDeAfuera(html: string): string {
  const carpeta = carpetaDelMarcoPrincipal(html);
  const donde = carpeta
    ? `de la carpeta «${carpeta}»`
    : 'de la carpeta que se creó junto a él al guardar la página (termina en «_files»)';
  return (
    `Ese es el archivo de «afuera», que no trae la tabla. La tabla está en el archivo pub_rep_val.html ${donde}. ` +
    'Súbelo, elige esa carpeta con el botón de abajo, o copia la tabla y pégala aquí.'
  );
}

/**
 * La carpeta donde el navegador dejó la página interna, según el `src` del marco `mainFrame`
 * (`./Mi página_files/pub_rep_val.html` → «Mi página_files»). Solo se devuelve texto corto y sin marcas, porque se
 * muestra en pantalla y viene de un archivo que no controlamos.
 */
function carpetaDelMarcoPrincipal(html: string): string | null {
  const marco = (html.match(/<frame\b[^>]*>/gi) ?? []).find((etiqueta) => /mainFrame/i.test(etiqueta));
  const ruta = marco ? /\bsrc\s*=\s*["']([^"']+)["']/i.exec(marco)?.[1] : undefined;
  if (!ruta) {
    return null;
  }
  let decodificada = ruta;
  try {
    decodificada = decodeURIComponent(ruta);
  } catch {
    // Una ruta mal codificada se muestra tal cual.
  }
  const partes = decodificada.split(/[\\/]/).filter((parte) => parte !== '' && parte !== '.');
  const carpeta = partes.length >= 2 ? sinMarcasNiControles(partes[partes.length - 2]).trim() : '';
  return carpeta !== '' && carpeta.length <= LARGO_MAXIMO_DE_LA_CARPETA ? carpeta : null;
}

/**
 * Lee la tabla «Proyección Horarios y Cupos» de la plataforma de la universidad (SCRUM-243).
 *
 * <p>El HTML viene de un archivo que subió la persona, así que se trata como entrada no confiable: se interpreta
 * con `DOMParser`, que produce un documento inerte (no ejecuta scripts ni carga imágenes), y de él solo se toma el
 * texto de las celdas. Nada de ese HTML se inserta en la página. Se rechazan las tablas con demasiadas filas o con
 * celdas enormes antes de armar ningún objeto.
 */
export function leerOfertaDeHorarios(html: string): OfertaLeida {
  if (!html.trim()) {
    throw new OfertaNoLegible('El archivo está vacío.');
  }
  const documento = new DOMParser().parseFromString(html, 'text/html');
  const tabla = [...documento.querySelectorAll('table')].find(esLaTablaDeHorarios);
  if (!tabla) {
    throw new OfertaNoLegible(
      /<frameset/i.test(html) ? mensajeDelArchivoDeAfuera(html) : 'No encontramos la tabla de horarios en ese archivo.',
    );
  }
  if (tabla.rows.length > MAXIMO_DE_FILAS) {
    throw new OfertaNoLegible('La tabla es demasiado grande para leerla.');
  }

  const materias = new Map<string, MateriaLeida>();
  for (const campos of filasDelCuerpo(tabla)) {
    if (SIN_HORARIO.test(campos[5] ?? '')) {
      continue;
    }
    const semestre = aSemestre(campos[0]);
    const clave = `${semestre}|${campos[2]}`;
    const materia = materias.get(clave) ?? { semestre, codigo: campos[2], nombre: campos[1], grupos: [] };
    materias.set(clave, materia);

    const codigoDelGrupo = campos[3];
    let grupo = materia.grupos.find((g) => g.codigo === codigoDelGrupo);
    if (!grupo) {
      grupo = { codigo: codigoDelGrupo, cupos: aNumero(campos[4]), bloques: [] };
      materia.grupos.push(grupo);
    }
    grupo.bloques.push({
      dia: aDia(campos[5]),
      inicio: aHora(campos[6]),
      fin: aHora(campos[7]),
      salon: campos[8] && campos[8] !== '--' ? campos[8] : null,
    });
  }
  if (materias.size === 0) {
    throw new OfertaNoLegible('La tabla no trae grupos con horario.');
  }
  return {
    periodo: /Periodo\s+(\d{4}-\d)/i.exec(documento.body?.textContent ?? '')?.[1] ?? null,
    materias: conNombresUnicos([...materias.values()]),
  };
}

/**
 * La materia lista para pedirle propuestas al servidor. La tabla da la hora en que termina el último minuto
 * (`09:59`) y el servidor trabaja con la hora en que termina la clase (`10:00`): se suma un minuto, para que
 * dos clases seguidas no choquen.
 */
export function aAsignaturaDeOferta(materia: MateriaLeida): AsignaturaDeOferta {
  return {
    nombre: materia.nombre,
    grupos: materia.grupos.map((grupo) => ({
      codigo: grupo.codigo,
      bloques: grupo.bloques.map((bloque) => ({
        dia: bloque.dia,
        inicio: bloque.inicio,
        fin: sumarUnMinuto(bloque.fin),
      })),
    })),
  };
}

/** Quita lo que podría pasar por una etiqueta (`<`, `>`, comillas) y los caracteres de control. */
function sinMarcasNiControles(texto: string): string {
  return Array.from(texto)
    .filter((letra) => !'<>"\''.includes(letra) && letra.charCodeAt(0) >= 32)
    .join('');
}

function esLaTablaDeHorarios(tabla: HTMLTableElement): boolean {
  const cabecera = (tabla.tHead?.textContent ?? tabla.rows[0]?.textContent ?? '').toUpperCase();
  return cabecera.includes('SEMESTRE') && cabecera.includes('HORA INICIO');
}

/**
 * Las filas del cuerpo, cada una con sus nueve columnas. La tabla usa `rowspan` (una celda abarca varias filas
 * de abajo) y `colspan`, así que se lleva la cuenta de lo que cada celda todavía ocupa en las filas siguientes.
 */
function* filasDelCuerpo(tabla: HTMLTableElement): Generator<string[]> {
  const ocupadas = new Map<number, { texto: string; restantes: number }>();
  const arrastrar = (fila: string[], desde: number): number => {
    let columna = desde;
    for (let pendiente = ocupadas.get(columna); pendiente && pendiente.restantes > 0; pendiente = ocupadas.get(columna)) {
      fila[columna] = pendiente.texto;
      pendiente.restantes--;
      columna++;
    }
    return columna;
  };

  for (const tr of Array.from(tabla.rows)) {
    if (tr.parentElement?.tagName === 'THEAD') {
      continue;
    }
    const fila: string[] = [];
    let columna = 0;
    for (const celda of Array.from(tr.cells)) {
      columna = arrastrar(fila, columna);
      const texto = textoDe(celda);
      const ancho = Math.min(Math.max(celda.colSpan, 1), MAXIMO_DE_COLUMNAS_QUE_ABARCA_UNA_CELDA);
      for (let k = 0; k < ancho; k++) {
        fila[columna + k] = texto;
        if (celda.rowSpan > 1) {
          ocupadas.set(columna + k, { texto, restantes: celda.rowSpan - 1 });
        }
      }
      columna += ancho;
    }
    arrastrar(fila, columna);
    if (fila.length >= COLUMNAS - 1) {
      yield fila;
    }
  }
}

function textoDe(celda: HTMLTableCellElement): string {
  const texto = (celda.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (texto.length > MAXIMO_DE_LA_CELDA) {
    throw new OfertaNoLegible('La tabla trae una celda demasiado larga: no parece la de horarios.');
  }
  return texto;
}

function aSemestre(texto: string | undefined): number {
  const semestre = Number.parseInt(texto ?? '', 10);
  if (!Number.isInteger(semestre) || semestre < 1 || semestre > 20) {
    throw new OfertaNoLegible(`El semestre «${texto ?? ''}» no es válido.`);
  }
  return semestre;
}

function aNumero(texto: string | undefined): number | null {
  const numero = Number.parseInt(texto ?? '', 10);
  return Number.isNaN(numero) ? null : numero;
}

function aDia(texto: string | undefined): DiaDeClase {
  const dia = DIAS[(texto ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()];
  if (!dia) {
    throw new OfertaNoLegible(`El día «${texto ?? ''}» no es válido.`);
  }
  return dia;
}

/** `0700` → `07:00`. */
function aHora(texto: string | undefined): string {
  const partes = /^(\d{2})(\d{2})$/.exec(texto ?? '');
  if (!partes || Number(partes[1]) > 23 || Number(partes[2]) > 59) {
    throw new OfertaNoLegible(`La hora «${texto ?? ''}» no es válida.`);
  }
  return `${partes[1]}:${partes[2]}`;
}

function sumarUnMinuto(hora: string): string {
  const [horas, minutos] = hora.split(':').map(Number);
  const total = horas * 60 + minutos + 1;
  // Un fin a las 23:59 no se puede correr al día siguiente: se deja como está.
  if (total >= 24 * 60) {
    return hora;
  }
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * El servidor no admite dos materias con el mismo nombre, y la universidad titula igual todas las líneas de
 * Profundización aunque cada una tiene sus propios grupos, días y horas. Esas se distinguen con la sigla que
 * trae el código de sus grupos (`801SISFU-EASW-B` → «EASW»); si no hay sigla legible, con la letra de la línea.
 */
function conNombresUnicos(materias: MateriaLeida[]): MateriaLeida[] {
  const repetidos = new Set(materias.map((m) => m.nombre).filter((nombre, i, todos) => todos.indexOf(nombre) !== i));
  if (repetidos.size === 0) {
    return materias;
  }
  const siglaDe = (materia: MateriaLeida): string | undefined => {
    const partes = materia.grupos[0].codigo.split('-');
    return partes.length >= 3 ? partes[1] : undefined;
  };
  const letraDe = (materia: MateriaLeida): string => materia.codigo.split('-').pop() ?? materia.codigo;

  return materias.map((materia) => {
    if (!repetidos.has(materia.nombre)) {
      return materia;
    }
    const hermanas = materias.filter((m) => m.nombre === materia.nombre);
    const siglas = hermanas.map(siglaDe);
    const sirvenLasSiglas = siglas.every((s) => !!s) && new Set(siglas).size === hermanas.length;
    return { ...materia, nombre: `${materia.nombre} (${sirvenLasSiglas ? siglaDe(materia) : letraDe(materia)})` };
  });
}

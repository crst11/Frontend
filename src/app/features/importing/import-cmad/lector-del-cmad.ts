/**
 * Lee la tabla de *Valoraciones* del CMAD (Moodle) para traer las actividades y las notas de una
 * asignatura (RF03 y RF05, SCRUM-76).
 *
 * <p>**Todo ocurre en el navegador y el archivo nunca se sube.** La página guardada trae la `sesskey` de
 * la sesión de Moodle y la retroalimentación del docente, que nombra a otros estudiantes. Por eso de la
 * tabla solo se leen cuatro columnas (nombre, ponderación, nota y rango) y **la columna de
 * retroalimentación no se toca**: ni se guarda ni se muestra.
 *
 * <p>El CMAD no da el árbol de dos niveles que usa CundiApp; da una lista plana de actividades con su
 * peso sobre el curso. Los cortes se arman con el prefijo del nombre (`R1-A1-S1 …` es del corte `R1`) y
 * es solo una sugerencia que el estudiante revisa antes de guardar.
 */

/** Una fila de la tabla que cuenta para la nota del curso. */
export interface FilaDelCmad {
  nombre: string;
  /** Lo que pesa sobre el curso, en porcentaje: 8.33 es el 8,33 %. */
  ponderacion: number;
  /** Nula mientras la actividad no tenga nota. Ya sobre la escala de 0 a 5. */
  nota: number | null;
}

export interface TablaDelCmad {
  filas: FilaDelCmad[];
  /** El «Total del curso» que muestra el CMAD, sobre 5, para comprobar que se leyó bien. */
  totalDelCurso: number | null;
  /** El texto de arriba de la tabla (código y nombre del curso), si lo trae. No tiene datos personales. */
  curso: string | null;
}

export class TablaDelCmadNoLegible extends Error {}

const PREFIJOS_DE_TIPO =
  /^(Tarea|Cuestionario|Foro|Taller|Lección|Wiki|Glosario|Encuesta|Elección|Chat|Paquete SCORM|Base de datos|Contenido interactivo|Cálculo total)\s+/i;

/** «4,1», «4.1» y «4.1 / 5» valen lo mismo; todo lo que no es número es «sin nota». */
export function aNumero(texto: string | null | undefined): number | null {
  const encontrado = /(\d+(?:[.,]\d+)?)/.exec((texto ?? '').replace(/\s+/g, ' '));
  return encontrado ? Number(encontrado[1].replace(',', '.')) : null;
}

function limpio(texto: string | null | undefined): string {
  return (texto ?? '').replace(/\s+/g, ' ').trim();
}

function nombreDeLaActividad(texto: string): string {
  return limpio(texto).replace(PREFIJOS_DE_TIPO, '');
}

/** La nota sobre 5: un rango de 0 a 10 se lleva a la escala de la universidad. */
function sobreCinco(valor: number | null, rangoMaximo: number | null): number | null {
  if (valor === null) {
    return null;
  }
  const escala = rangoMaximo && rangoMaximo > 0 ? rangoMaximo : 5;
  return Math.round((valor * 5 * 100) / escala) / 100;
}

function esElTotal(nombre: string): boolean {
  return /total del curso/i.test(nombre);
}

/** La página guardada (`Ctrl+S`): se leen las celdas por sus clases, que son las de Moodle. */
export function leerHtmlDelCmad(html: string): TablaDelCmad {
  const documento = new DOMParser().parseFromString(html, 'text/html');
  const tabla = documento.querySelector('table.user-grade') ?? documento.querySelector('table.generaltable');
  if (!tabla) {
    throw new TablaDelCmadNoLegible('No encontramos la tabla de calificaciones en ese archivo.');
  }

  const filas: FilaDelCmad[] = [];
  let totalDelCurso: number | null = null;
  let curso: string | null = null;
  for (const fila of Array.from(tabla.querySelectorAll('tr'))) {
    const celdaDelNombre = fila.querySelector('.column-itemname');
    if (!celdaDelNombre) {
      continue;
    }
    // Es un enlace cuando la actividad se puede abrir y un simple texto cuando no; el tipo («Tarea») va aparte.
    const enlace = celdaDelNombre.querySelector('.gradeitemheader');
    const nombre = nombreDeLaActividad(enlace?.textContent ?? celdaDelNombre.textContent);
    const rango = fila.querySelector('.column-range')?.textContent ?? '';
    const rangoMaximo = aNumero(rango.split(/[–-]/).pop());
    const nota = sobreCinco(aNumero(fila.querySelector('.column-grade')?.textContent), rangoMaximo);

    if (!fila.querySelector('.column-weight') && curso === null && limpio(celdaDelNombre.textContent).includes('/')) {
      curso = limpio(celdaDelNombre.textContent);
      continue;
    }
    if (esElTotal(limpio(celdaDelNombre.textContent))) {
      totalDelCurso = nota;
      continue;
    }
    const ponderacion = aNumero(fila.querySelector('.column-weight')?.textContent);
    if (nombre && ponderacion !== null && ponderacion > 0) {
      filas.push({ nombre, ponderacion, nota });
    }
  }

  if (filas.length === 0) {
    throw new TablaDelCmadNoLegible('No encontramos actividades con su ponderación en esa tabla.');
  }
  return { filas, totalDelCurso, curso };
}

/**
 * El texto de la tabla copiado y pegado. Al copiar una tabla las celdas quedan separadas por tabulaciones;
 * si el teléfono las vuelve espacios, se prueba también por el orden de los números.
 */
export function leerTextoDelCmad(texto: string): TablaDelCmad {
  const filas: FilaDelCmad[] = [];
  let totalDelCurso: number | null = null;

  for (const linea of texto.split(/\r?\n/)) {
    const lectura = leerLinea(linea);
    if (!lectura) {
      continue;
    }
    if (esElTotal(lectura.nombre)) {
      totalDelCurso = lectura.nota;
    } else if (lectura.ponderacion > 0) {
      filas.push({ nombre: nombreDeLaActividad(lectura.nombre), ponderacion: lectura.ponderacion, nota: lectura.nota });
    }
  }
  if (filas.length === 0) {
    throw new TablaDelCmadNoLegible('No encontramos actividades con su ponderación en ese texto.');
  }
  return { filas, totalDelCurso, curso: null };
}

/** «Cálculo total  Total del curso  -  1.5  0–5  29.3 %»: la ponderación no aplica, la nota es la tercera celda. */
function leerElTotal(linea: string): { nombre: string; ponderacion: number; nota: number | null } | null {
  const celdas = linea.split('\t').map(limpio);
  if (celdas.length >= 4 && esElTotal(celdas[0])) {
    return { nombre: celdas[0], ponderacion: 0, nota: sobreCinco(aNumero(celdas[2]), aNumero(celdas[3].split(/[–-]/).pop())) };
  }
  const plana = /(total del curso)\s+-?\s*(\d+(?:[.,]\d+)?)\s+(\d+)\s*[–-]\s*(\d+)/i.exec(limpio(linea));
  return plana
    ? { nombre: plana[1], ponderacion: 0, nota: sobreCinco(Number(plana[2].replace(',', '.')), Number(plana[4])) }
    : null;
}

function leerLinea(linea: string): { nombre: string; ponderacion: number; nota: number | null } | null {
  const total = leerElTotal(linea);
  if (total) {
    return total;
  }
  const celdas = linea.split('\t').map(limpio);
  if (celdas.length >= 4 && /%/.test(celdas[1])) {
    const ponderacion = aNumero(celdas[1]);
    const rangoMaximo = aNumero(celdas[3].split(/[–-]/).pop());
    return ponderacion === null
      ? null
      : { nombre: celdas[0], ponderacion, nota: sobreCinco(aNumero(celdas[2]), rangoMaximo) };
  }

  // Sin tabulaciones: «nombre  8.33 %  4.1  0–5  82.0 %». La retroalimentación, si viene, queda detrás y no se lee.
  const plana = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*%\s+(-|\d+(?:[.,]\d+)?)\s+(\d+)\s*[–-]\s*(\d+)/.exec(limpio(linea));
  if (!plana) {
    return null;
  }
  return {
    nombre: plana[1],
    ponderacion: Number(plana[2].replace(',', '.')),
    nota: sobreCinco(plana[3] === '-' ? null : Number(plana[3].replace(',', '.')), Number(plana[5])),
  };
}

// ---------------------------------------------------------------------------------------------------

export interface ActividadArmada {
  nombre: string;
  /** Su parte del corte, de 0 a 100. */
  porcentaje: number;
  nota: number | null;
}

export interface CorteArmado {
  nombre: string;
  /** Su parte del curso, de 0 a 100. */
  porcentaje: number;
  actividades: ActividadArmada[];
}

/**
 * Arma los cortes con el prefijo del nombre (`R1-A1-S1 …` va al corte `R1`; lo que no tiene prefijo va
 * a «Actividades»). Los porcentajes salen de los pesos del CMAD y suman exactamente 100 en cada nivel:
 * el resto del redondeo se lo lleva el último, porque el servidor exige que cuadren.
 */
export function armarLosCortes(filas: FilaDelCmad[]): CorteArmado[] {
  const grupos = new Map<string, FilaDelCmad[]>();
  for (const fila of filas) {
    const prefijo = /^(R\d+)\b/i.exec(fila.nombre)?.[1].toUpperCase() ?? 'Actividades';
    grupos.set(prefijo, [...(grupos.get(prefijo) ?? []), fila]);
  }

  const pesoDeCadaCorte = Array.from(grupos.values()).map((actividades) => suma(actividades.map((a) => a.ponderacion)));
  const porcentajesDeLosCortes = repartir(pesoDeCadaCorte);

  return Array.from(grupos.entries()).map(([nombre, actividades], indice) => {
    const porcentajesDeLasActividades = repartir(actividades.map((a) => a.ponderacion));
    return {
      nombre,
      porcentaje: porcentajesDeLosCortes[indice],
      actividades: actividades.map((a, i) => ({
        nombre: a.nombre.slice(0, 120),
        porcentaje: porcentajesDeLasActividades[i],
        nota: a.nota,
      })),
    };
  });
}

function suma(valores: number[]): number {
  return valores.reduce((total, valor) => total + valor, 0);
}

/** Pesos → porcentajes con dos decimales que suman exactamente 100,00. */
function repartir(pesos: number[]): number[] {
  const total = suma(pesos);
  const centesimas = pesos.map((peso) => Math.round((peso / total) * 10_000));
  centesimas[centesimas.length - 1] += 10_000 - suma(centesimas);
  return centesimas.map((c) => c / 100);
}

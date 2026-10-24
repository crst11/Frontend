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

/**
 * La categoría de Moodle de una actividad (`REA 1`, `REA 2`…) y lo que pesa sobre el curso: es el peso de
 * su fila «Total REA 1». Solo la traen los cursos que tienen categorías.
 */
export interface CategoriaDelCmad {
  nombre: string;
  peso: number;
}

/** Una fila de la tabla que cuenta para la nota del curso. */
export interface FilaDelCmad {
  nombre: string;
  /**
   * Lo que pesa, en porcentaje: 8.33 es el 8,33 %. Sobre el curso si la actividad no tiene categoría, y
   * sobre su categoría si la tiene (en un curso con categorías, 25 % es la cuarta parte de su REA).
   */
  ponderacion: number;
  /** Nula mientras la actividad no tenga nota. Ya sobre la escala de 0 a 5. */
  nota: number | null;
  categoria?: CategoriaDelCmad;
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

function sinTildes(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** «Total REA 1» → «REA 1»: la fila que cierra una categoría. Nula si la fila no es el total de nada. */
function categoriaQueCierra(nombre: string): string | null {
  // Moodle pega «Cálculo total» y «Total REA 1» sin espacio entre los dos; el OCR a veces pierde la tilde.
  const sinPrefijo = nombre.replace(/^c[aá]lculo\s*total\s*/i, '');
  const cierre = /^total\s+(\S.*)$/i.exec(sinPrefijo);
  return cierre && !esElTotal(sinPrefijo) ? limpio(cierre[1]) : null;
}

/** La página guardada (`Ctrl+S`): se leen las celdas por sus clases, que son las de Moodle. */
export function leerHtmlDelCmad(html: string): TablaDelCmad {
  const documento = new DOMParser().parseFromString(html, 'text/html');
  const tabla = documento.querySelector('table.user-grade') ?? documento.querySelector('table.generaltable');
  if (!tabla) {
    throw new TablaDelCmadNoLegible('No encontramos la tabla de calificaciones en ese archivo.');
  }

  const filas: FilaDelCmad[] = [];
  /** La categoría de cada fila de `filas`, a la par; su peso se sabe al llegar a su «Total». */
  const categoriaDeCadaFila: (string | null)[] = [];
  const pesoDeCadaCategoria = new Map<string, number>();
  let categoriaActual: string | null = null;
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
    // Una categoría de Moodle (REA 1, REA 2…): sus actividades vienen debajo y su peso en su fila «Total».
    if (!fila.querySelector('.column-weight') && celdaDelNombre.classList.contains('category') && curso !== null) {
      categoriaActual = limpio(celdaDelNombre.textContent) || null;
      continue;
    }
    const ponderacion = aNumero(fila.querySelector('.column-weight')?.textContent);
    const cierra = categoriaQueCierra(nombre);
    if (cierra && categoriaActual && sinTildes(cierra) === sinTildes(categoriaActual)) {
      if (ponderacion !== null && ponderacion > 0) {
        pesoDeCadaCategoria.set(categoriaActual, ponderacion);
      }
      continue;
    }
    if (nombre && ponderacion !== null && ponderacion > 0) {
      filas.push({ nombre, ponderacion, nota });
      categoriaDeCadaFila.push(categoriaActual);
    }
  }
  filas.forEach((fila, i) => {
    const nombreDeLaCategoria = categoriaDeCadaFila[i];
    const peso = nombreDeLaCategoria ? pesoDeCadaCategoria.get(nombreDeLaCategoria) : undefined;
    if (nombreDeLaCategoria && peso) {
      fila.categoria = { nombre: nombreDeLaCategoria, peso };
    }
  });

  if (filas.length === 0) {
    throw new TablaDelCmadNoLegible('No encontramos actividades con su ponderación en esa tabla.');
  }
  return { filas, totalDelCurso, curso };
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
 * Arma los cortes. Si el curso trae categorías (REA 1, REA 2…), cada categoría es un corte con el peso de
 * su «Total»; lo que no pertenece a ninguna va a «Actividades» con su peso sobre el curso. Si no las trae,
 * se arman con el prefijo del nombre (`R1-A1-S1 …` va al corte `R1`; lo que no tiene prefijo va a
 * «Actividades»). Los porcentajes suman exactamente 100 en cada nivel: el resto del redondeo se lo lleva
 * el último, porque el servidor exige que cuadren.
 */
export function armarLosCortes(filas: FilaDelCmad[]): CorteArmado[] {
  const conCategorias = filas.some((fila) => fila.categoria);
  const grupos = new Map<string, FilaDelCmad[]>();
  for (const fila of filas) {
    const nombre = conCategorias
      ? (fila.categoria?.nombre ?? 'Actividades')
      : (/^(R\d+)\b/i.exec(fila.nombre)?.[1].toUpperCase() ?? 'Actividades');
    grupos.set(nombre, [...(grupos.get(nombre) ?? []), fila]);
  }

  const pesoDeCadaCorte = Array.from(grupos.values()).map(
    (actividades) => actividades[0].categoria?.peso ?? suma(actividades.map((a) => a.ponderacion)),
  );
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

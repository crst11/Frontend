import {
  TablaDelCmadNoLegible,
  armarLosCortes,
  aNumero,
  leerHtmlDelCmad,
  leerTextoDelCmad,
} from './lector-del-cmad';

/**
 * Una página del CMAD inventada, con las mismas clases de Moodle y con retroalimentación que nombra a
 * otras personas, para comprobar que eso no se lee. Ningún dato de un estudiante real entra al repositorio.
 */
function fila(nombre: string, peso: string, nota: string, rango = '0–5', retro = ''): string {
  return `<tr>
    <td class="level2 item b1b column-itemname cell c0"><a class="gradeitemheader" href="#">${nombre}</a></td>
    <td class="column-weight">${peso}</td><td class="column-grade">${nota}</td><td class="column-range">${rango}</td>
    <td class="column-percentage">-</td><td class="feedbacktext column-feedback">${retro}</td>
    <td class="column-contributiontocoursetotal">-</td></tr>`;
}

const PAGINA = `<html><head><title>Usuario _ 603574_LENGUA EXTRANJERA III_FU_CAI1002020507_LE3-M1_28619 _ CMAD</title>
<script>var cfg = {"sesskey":"SECRETA123"};</script></head><body>
<table class="generaltable boxaligncenter user-grade"><thead><tr><th class="level1 column-itemname c0">Ítem de calificación</th></tr></thead><tbody>
<tr><td class="level1 column-itemname"><a class="gradeitemheader" href="#">603574/LENGUA EXTRANJERA III/FU/CAI1002020507/LE3-M1/28619</a></td></tr>
${fila('Tarea Retroalimentación de avance', '-', '', '–')}
${fila('Contenido interactivo PAD*', '0.00 %', '-', '0–10')}
${fila('R1-A1-S1 ABOUT ROUTINES!', '8.33 %', '4.1', '0–5', 'Hola Ana, Pedro y Luis: el grupo cumplió.')}
${fila('R1-A2-S2 BROCHURE.', '8.33 %', '4,1', '0–5', 'Mario: lee más despacio.')}
${fila('R1-A3-S3 COMPARATIVE CHART.', '8.33 %', '4.7')}
${fila('R1-A4-S4 COLLAGE.', '8.33 %', '4.7')}
${fila('R2-A1-S5 Last vacation trip!', '8.33 %', '-')}
${fila('R2-A2-S6 INFOGRAPHY.', '8.33 %', '-')}
${fila('R2-A3-S7 AUDIO.', '8.33 %', '-')}
${fila('R2-A4-S8 INFORMATION.', '8.33 %', '-')}
${fila('R3-A1-S9 INFOGRAPHY.', '8.33 %', '-')}
${fila('R3-A2-S10 SWAY.', '8.33 %', '-')}
${fila('R3-A3-S11 INFOGRAPHY.', '8.33 %', '-')}
${fila('R3-A4-S12 VIDEO.', '8.33 %', '-')}
<tr><td class="level1 column-itemname">Cálculo total Total del curso</td><td class="column-weight">-</td><td class="column-grade">1.5</td><td class="column-range">0–5</td></tr>
</tbody></table></body></html>`;

describe('leer la página guardada del CMAD', () => {
  it('trae las doce actividades con peso y deja fuera las que no ponderan', () => {
    const tabla = leerHtmlDelCmad(PAGINA);

    expect(tabla.filas).toHaveLength(12);
    expect(tabla.filas[0]).toEqual({ nombre: 'R1-A1-S1 ABOUT ROUTINES!', ponderacion: 8.33, nota: 4.1 });
    expect(tabla.filas.map((f) => f.nombre)).not.toContain('Contenido interactivo PAD*');
    expect(tabla.filas.map((f) => f.nombre)).not.toContain('Retroalimentación de avance');
  });

  it('las notas con coma valen igual y lo que no tiene nota queda sin nota', () => {
    const tabla = leerHtmlDelCmad(PAGINA);

    expect(tabla.filas[1].nota).toBe(4.1);
    expect(tabla.filas[4].nota).toBeNull();
  });

  it('lee el total del curso para poder comprobar la lectura', () => {
    expect(leerHtmlDelCmad(PAGINA).totalDelCurso).toBe(1.5);
  });

  it('no lee la retroalimentación: nada de lo que dice el docente ni de a quién nombra queda en el resultado', () => {
    const resultado = JSON.stringify(leerHtmlDelCmad(PAGINA));

    expect(resultado).not.toContain('Ana');
    expect(resultado).not.toContain('Pedro');
    expect(resultado).not.toContain('Mario');
    expect(resultado).not.toContain('despacio');
  });

  it('tampoco lee la llave de la sesión de Moodle que trae la página', () => {
    expect(JSON.stringify(leerHtmlDelCmad(PAGINA))).not.toContain('SECRETA123');
  });

  it('una actividad que no es un enlace (texto sin vínculo) también entra con su nombre limpio', () => {
    // En la página real el tipo («Tarea») y el nombre van en bloques distintos: sin separar el nombre del
    // tipo quedaba «TareaR3-A4-…» y esa actividad se iba sola a otro corte.
    const sinEnlace = `<tr><th class="level2 item column-itemname" scope="row"><div><span class="d-block small" title="Tarea">Tarea</span><div class="rowtitle"><span class="gradeitemheader" title="R3-A4-S12 VIDEO.">R3-A4-S12 VIDEO.</span></div></div></th>
      <td class="column-weight">8.33 %</td><td class="column-grade">-</td><td class="column-range">0–5</td></tr>`;
    const html = PAGINA.replace('</tbody>', sinEnlace + '</tbody>');

    const tabla = leerHtmlDelCmad(html);

    expect(tabla.filas.at(-1)?.nombre).toBe('R3-A4-S12 VIDEO.');
    expect(armarLosCortes(tabla.filas).map((c) => c.nombre)).toEqual(['R1', 'R2', 'R3']);
  });

  it('un rango de 0 a 10 se lleva a la escala de 0 a 5', () => {
    const html = PAGINA.replace('</tbody>', fila('R3-A5-S13 EXTRA', '2.00 %', '8', '0–10') + '</tbody>');

    expect(leerHtmlDelCmad(html).filas.at(-1)?.nota).toBe(4);
  });

  it('un archivo que no es la página de calificaciones se rechaza diciendo qué falta', () => {
    expect(() => leerHtmlDelCmad('<html><body><p>hola</p></body></html>')).toThrow(TablaDelCmadNoLegible);
  });
});

describe('leer la tabla pegada', () => {
  const PEGADA = [
    'Ítem de calificación\tPonderación calculada\tCalificación\tRango\tPorcentaje\tRetroalimentación\tAporta',
    'Tarea R1-A1-S1 ABOUT ROUTINES!\t8.33 %\t4.1\t0–5\t82.0 %\tHola Ana, Pedro y Luis\t6.8 %',
    'Tarea R1-A2-S2 BROCHURE.\t8.33 %\t4,1\t0–5\t82.0 %\tMario: lee más despacio\t6.8 %',
    'Tarea R2-A1-S5 Last vacation trip!\t8.33 %\t-\t0–5\t-\t\t0.0 %',
    'Contenido interactivo PAD*\t0.00 %\t-\t0–10\t-\t\t0.0 %',
    'Cálculo total Total del curso\t-\t1.5\t0–5\t29.3 %\t\t-',
  ].join('\n');

  it('con tabulaciones lee las actividades, el total y descarta lo que no pondera', () => {
    const tabla = leerTextoDelCmad(PEGADA);

    expect(tabla.filas.map((f) => f.nombre)).toEqual([
      'R1-A1-S1 ABOUT ROUTINES!',
      'R1-A2-S2 BROCHURE.',
      'R2-A1-S5 Last vacation trip!',
    ]);
    expect(tabla.filas[1].nota).toBe(4.1);
    expect(tabla.totalDelCurso).toBe(1.5);
  });

  it('no deja pasar la retroalimentación', () => {
    const resultado = JSON.stringify(leerTextoDelCmad(PEGADA));

    expect(resultado).not.toContain('Ana');
    expect(resultado).not.toContain('Mario');
  });

  it('si el teléfono cambió las tabulaciones por espacios también la lee', () => {
    const tabla = leerTextoDelCmad('Tarea R1-A1-S1 ABOUT ROUTINES! 8.33 % 4.1 0–5 82.0 % Hola Ana\nTarea R1-A2-S2 BROCHURE. 8.33 % - 0–5 - ');

    expect(tabla.filas).toHaveLength(2);
    expect(tabla.filas[0]).toEqual({ nombre: 'R1-A1-S1 ABOUT ROUTINES!', ponderacion: 8.33, nota: 4.1 });
    expect(tabla.filas[1].nota).toBeNull();
  });

  it('un texto sin ninguna actividad se rechaza', () => {
    expect(() => leerTextoDelCmad('hola, esto no es la tabla')).toThrow(TablaDelCmadNoLegible);
  });
});

describe('armar los cortes', () => {
  it('agrupa por el prefijo del nombre: R1, R2 y R3 son tres cortes', () => {
    const cortes = armarLosCortes(leerHtmlDelCmad(PAGINA).filas);

    expect(cortes.map((c) => c.nombre)).toEqual(['R1', 'R2', 'R3']);
    expect(cortes.map((c) => c.actividades.length)).toEqual([4, 4, 4]);
  });

  it('las actividades de cada corte y los cortes suman exactamente 100', () => {
    const cortes = armarLosCortes(leerHtmlDelCmad(PAGINA).filas);

    expect(cortes.reduce((t, c) => Math.round((t + c.porcentaje) * 100) / 100, 0)).toBe(100);
    for (const corte of cortes) {
      expect(corte.actividades.reduce((t, a) => Math.round((t + a.porcentaje) * 100) / 100, 0)).toBe(100);
    }
    expect(cortes.map((c) => c.porcentaje)).toEqual([33.33, 33.33, 33.34]);
    expect(cortes[0].actividades.map((a) => a.porcentaje)).toEqual([25, 25, 25, 25]);
  });

  it('lleva la nota de cada actividad a su corte', () => {
    const cortes = armarLosCortes(leerHtmlDelCmad(PAGINA).filas);

    expect(cortes[0].actividades.map((a) => a.nota)).toEqual([4.1, 4.1, 4.7, 4.7]);
    expect(cortes[1].actividades.every((a) => a.nota === null)).toBe(true);
  });

  it('lo que no tiene prefijo va a un corte «Actividades»', () => {
    const cortes = armarLosCortes([
      { nombre: 'Parcial final', ponderacion: 60, nota: null },
      { nombre: 'Taller 1', ponderacion: 40, nota: 4 },
    ]);

    expect(cortes).toHaveLength(1);
    expect(cortes[0].nombre).toBe('Actividades');
    expect(cortes[0].porcentaje).toBe(100);
    expect(cortes[0].actividades.map((a) => a.porcentaje)).toEqual([60, 40]);
  });

  it('un reparto desparejo igual suma 100: el resto se lo lleva el último', () => {
    const cortes = armarLosCortes([
      { nombre: 'A', ponderacion: 1, nota: null },
      { nombre: 'B', ponderacion: 1, nota: null },
      { nombre: 'C', ponderacion: 1, nota: null },
    ]);

    expect(cortes[0].actividades.map((a) => a.porcentaje)).toEqual([33.33, 33.33, 33.34]);
  });

  it('recorta los nombres largos a lo que admite el servidor', () => {
    const cortes = armarLosCortes([{ nombre: 'x'.repeat(200), ponderacion: 10, nota: null }]);

    expect(cortes[0].actividades[0].nombre).toHaveLength(120);
  });
});

describe('aNumero', () => {
  it('lee decimales con punto o con coma y nada más', () => {
    expect(aNumero('8.33 %')).toBe(8.33);
    expect(aNumero('4,7')).toBe(4.7);
    expect(aNumero('-')).toBeNull();
    expect(aNumero('')).toBeNull();
    expect(aNumero(undefined)).toBeNull();
  });
});

/**
 * Un curso con categorías, como el de Ingeniería de Software I: cada REA es una categoría con su peso en la
 * fila «Total REA n» y sus actividades pesan sobre la categoría. Datos inventados.
 */
function filaConCategorias(nombre: string, peso: string, nota: string): string {
  return `<tr class="cat_1 cat_2"><td class="level3 item b1b column-itemname"><a class="gradeitemheader" href="#">${nombre}</a></td>
    <td class="column-weight">${peso}</td><td class="column-grade">${nota}</td><td class="column-range">0–5</td></tr>`;
}

function categoria(nombre: string): string {
  return `<tr class="cat_1"><th class="level2 d2 b1b b1t category column-itemname" scope="row">${nombre}</th><td class="cell"></td></tr>`;
}

function totalDeCategoria(nombre: string, peso: string, nota: string): string {
  return `<tr class="cat_1"><td class="level2 d2 baggt b2b column-itemname"><span>Cálculo total</span>Total ${nombre}</td>
    <td class="column-weight">${peso}</td><td class="column-grade">${nota}</td><td class="column-range">0–5</td></tr>`;
}

const PAGINA_CON_CATEGORIAS = `<html><body><table class="generaltable boxaligncenter user-grade"><tbody>
<tr><th class="level1 d1 category column-itemname"><a class="gradeitemheader" href="#">604527/INGENIERIA DE SOFTWARE I/FU/CAD612021521/ SIS.FUSA 501M/26343</a></th></tr>
${categoria('REA 1')}
${filaConCategorias('R1-A1-S2 Análisis del contexto', '25.00 %', '5.0')}
${filaConCategorias('R1-A2-S3 Explorando necesidades', '25.00 %', '3.8')}
${filaConCategorias('R1-A2-S4 Requerimientos', '25.00 %', '4.5')}
${filaConCategorias('Retroalimentación REA 1.', '25.00 %', '4.5')}
${totalDeCategoria('REA 1', '35.00 %', '4.5')}
${categoria('REA 2')}
${filaConCategorias('R2-A3-S5 Descubriendo el problema', '20.00 %', '3.5')}
${filaConCategorias('Texto reflexivo - semana 7', '0.00 %', '-')}
${filaConCategorias('R2-A4-S8 Diseñando la solución', '20.00 %', '-')}
${filaConCategorias('R2-A4-S9 Ciclo de vida', '20.00 %', '-')}
${filaConCategorias('R2-A5-S10 Análisis y diseño', '20.00 %', '-')}
${filaConCategorias('R2-A5-S11 Modelado', '20.00 %', '-')}
${filaConCategorias('Retroalimentación REA 2.', '-', '')}
${totalDeCategoria('REA 2', '40.00 %', '1.7')}
${categoria('REA 3')}
${filaConCategorias('R3-A6-S11 Diagnóstico', '50.00 %', '-')}
${filaConCategorias('R3-A7-S12 Diseño colaborativo', '50.00 %', '-')}
${totalDeCategoria('REA 3', '25.00 %', '-')}
<tr><td class="level1 d1 baggt b2b column-itemname"><span>Cálculo total</span>Total del curso</td><td class="column-weight">-</td>
<td class="column-grade">2.2</td><td class="column-range">0–5</td></tr>
</tbody></table></body></html>`;

describe('un curso con categorías (REA 1, REA 2…)', () => {
  it('lee las actividades de cada categoría y no cuenta los «Total REA n» como actividades', () => {
    const { filas, totalDelCurso } = leerHtmlDelCmad(PAGINA_CON_CATEGORIAS);

    expect(filas.some((f) => /^Total/.test(f.nombre))).toBe(false);
    expect(filas).toHaveLength(11);
    expect(totalDelCurso).toBe(2.2);
  });

  it('cada actividad lleva su categoría con lo que pesa sobre el curso', () => {
    const { filas } = leerHtmlDelCmad(PAGINA_CON_CATEGORIAS);

    expect(filas[0].categoria).toEqual({ nombre: 'REA 1', peso: 35 });
    expect(filas.find((f) => f.nombre.startsWith('R2-A3-S5'))?.categoria).toEqual({ nombre: 'REA 2', peso: 40 });
    expect(filas.find((f) => f.nombre.startsWith('R3-A6-S11'))?.categoria).toEqual({ nombre: 'REA 3', peso: 25 });
  });

  it('el peso de una actividad sigue siendo el que dice el CMAD, sobre su categoría', () => {
    const { filas } = leerHtmlDelCmad(PAGINA_CON_CATEGORIAS);

    expect(filas[0].ponderacion).toBe(25);
    expect(filas.find((f) => f.nombre.startsWith('R2-A3-S5'))?.ponderacion).toBe(20);
  });

  it('las actividades sin peso (0 % o «-») siguen quedando fuera', () => {
    const { filas } = leerHtmlDelCmad(PAGINA_CON_CATEGORIAS);

    expect(filas.map((f) => f.nombre)).not.toContain('Texto reflexivo - semana 7');
    expect(filas.map((f) => f.nombre)).not.toContain('Retroalimentación REA 2.');
  });

  it('arma un corte por categoría con el peso de su total y las actividades suman 100 dentro de cada una', () => {
    const cortes = armarLosCortes(leerHtmlDelCmad(PAGINA_CON_CATEGORIAS).filas);

    expect(cortes.map((c) => c.nombre)).toEqual(['REA 1', 'REA 2', 'REA 3']);
    expect(cortes.map((c) => c.porcentaje)).toEqual([35, 40, 25]);
    for (const corte of cortes) {
      const suma = corte.actividades.reduce((total, a) => total + a.porcentaje, 0);
      expect(Math.round(suma * 100) / 100).toBe(100);
    }
    expect(cortes[0].actividades).toHaveLength(4);
    expect(cortes[1].actividades).toHaveLength(5);
  });

  it('lleva la nota de cada actividad a su corte', () => {
    const cortes = armarLosCortes(leerHtmlDelCmad(PAGINA_CON_CATEGORIAS).filas);

    expect(cortes[0].actividades.map((a) => a.nota)).toEqual([5, 3.8, 4.5, 4.5]);
    expect(cortes[2].actividades.map((a) => a.nota)).toEqual([null, null]);
  });

  it('una tabla sin categorías se sigue armando por el prefijo del nombre', () => {
    const cortes = armarLosCortes(leerHtmlDelCmad(PAGINA).filas);

    expect(cortes.map((c) => c.nombre)).toEqual(['R1', 'R2', 'R3']);
    expect(cortes.every((c) => c.actividades.length > 0)).toBe(true);
  });

  it('lo que no está en ninguna categoría va a «Actividades» con su peso sobre el curso', () => {
    const cortes = armarLosCortes([
      { nombre: 'Taller A', ponderacion: 50, nota: 4, categoria: { nombre: 'REA 1', peso: 60 } },
      { nombre: 'Taller B', ponderacion: 50, nota: null, categoria: { nombre: 'REA 1', peso: 60 } },
      { nombre: 'Proyecto', ponderacion: 40, nota: 3 },
    ]);

    expect(cortes.map((c) => c.nombre)).toEqual(['REA 1', 'Actividades']);
    expect(cortes.map((c) => c.porcentaje)).toEqual([60, 40]);
  });
});

describe('la tabla pegada de un curso con categorías', () => {
  const TEXTO = [
    'R1-A1-S2 Análisis del contexto\t25.00 %\t5.0\t0–5',
    'R1-A2-S3 Explorando necesidades\t25.00 %\t3.8\t0–5',
    'Retroalimentación REA 1.\t50.00 %\t4.5\t0–5',
    'Cálculo total Total REA 1\t35.00 %\t4.4\t0–5',
    'R2-A3-S5 Descubriendo el problema\t50.00 %\t3.5\t0–5',
    'R2-A4-S8 Diseñando la solución\t50.00 %\t-\t0–5',
    'Cálculo total Total REA 2\t65.00 %\t-\t0–5',
    'Cálculo total Total del curso\t-\t2.2\t0–5',
  ].join('\n');

  it('cada grupo de actividades es de la categoría del «Total» que lo cierra', () => {
    const { filas, totalDelCurso } = leerTextoDelCmad(TEXTO);

    expect(filas).toHaveLength(5);
    expect(filas[0].categoria).toEqual({ nombre: 'REA 1', peso: 35 });
    expect(filas[2].categoria).toEqual({ nombre: 'REA 1', peso: 35 });
    expect(filas[3].categoria).toEqual({ nombre: 'REA 2', peso: 65 });
    expect(totalDelCurso).toBe(2.2);
  });

  it('los totales de categoría no entran como actividades', () => {
    const { filas } = leerTextoDelCmad(TEXTO);

    expect(filas.some((f) => /^Total/i.test(f.nombre))).toBe(false);
  });

  it('con tabulaciones perdidas (foto o teléfono) también arma las categorías', () => {
    const plano = TEXTO.replace(/\t/g, ' ');
    const cortes = armarLosCortes(leerTextoDelCmad(plano).filas);

    expect(cortes.map((c) => c.nombre)).toEqual(['REA 1', 'REA 2']);
    expect(cortes.map((c) => c.porcentaje)).toEqual([35, 65]);
  });
});

/**
 * Lo que devuelve el OCR con una captura de la página de calificaciones del CMAD (Planeación Estratégica),
 * tal cual salió: la etiqueta de tipo sobre cada nombre, los nombres partidos en dos o tres líneas, la
 * marca ✓ pegada a la nota, íconos leídos como letras y la retroalimentación del docente al lado del
 * nombre. Los tabuladores son los huecos entre celdas.
 */
const CAPTURA_DE_LA_PAGINA = [
  'Página Principal Área personal Mis campos Monitoreo Campos de Aprendizaje\t35\tCM',
  'Campo\tParticipantes\tValoraciones\tCompetencias',
  '604526/PLANEACION ESTRATEGICA/FU/CAD612021524/ SIS.FUSA',
  '501M/26224',
  'Usuario',
  'Aporta al',
  'Ponderación\ttotal del',
  'Ítem de calificación\tcalculada\tCalificación\tRango\tPorcentaje\tRetroalimentación\tcurso',
  ' 604526/PLANEACION ESTRATEGICA/FU/CAD612021524/ SIS.FUSA 501M/26224',
  'HP\tCONTENIDO INTERACTIVO\t0.00 %\t0-0\t0.0 %',
  'PAD*\t"·',
  'TAREA',
  'Retroalimentación REA 1',
  'TAREA',
  'Retroalimentación REA 2\t一',
  'TAREA\t14.29 %\t✓5.0\t0-5\t100.0 %\tBuen trabajo\t14.3 %',
  'R1-A1-S4 Rumbo Definido.',
  'CUESTIONARIO',
  'R1-A1-S4 Evaluación de\t14.29 %',
  '国\tPensamiento y Actitud\t5.0\t0-5\t100.0 %\t14.3 %',
  'Estratégica.',
  'TAREA',
  'R1-A2-S8 Salida académica\tMuy buen trabajo',
  'Planeación estratégica\t14.29 %\t✓5.0\t0-5\t100.0 %\tmuchachos\t14.3 %',
  'Simposio (Emprendimiento e',
  'Innovación).',
  'TAREA',
  'R2-A1-S11 Radar\t14.29 %\t0-5\t0.0 %',
  'competitivo.',
  'TAREA',
  'R2-A1-S13 Mapa estratégico\t14.29 %\t=\t0-5\t0.0 %',
  'colaborativo.',
  'TAREA',
  'G\tR2-A1-S14 Simulación de\t14.29 %\t0-5\t0.0 %',
  'impacto.',
  'TAREA',
  'R2-A1-S16 Evidenciemos',
  'soluciones (Pitch\t14.29 %\t0-5\t0.0 %',
  'estratégico).',
  'x\tCÁLCULO TOTAL\t2.1\t0-5\t42.9 %',
  'Total del curso',
  'Contáctanos\tDescargar la app para dispositivos móviles',
  'Contactar con el soporte del sitio',
  'Síganos\tGoogle Play\tGET IT ON',
  'Este tema fue desarrollado por',
  'conecti.me',
].join('\n');

describe('una captura de la página de calificaciones (foto o pantallazo)', () => {
  it('lee las siete actividades con peso aunque el nombre esté partido en varias líneas', () => {
    const { filas } = leerTextoDelCmad(CAPTURA_DE_LA_PAGINA);

    expect(filas.map((f) => f.nombre)).toEqual([
      'R1-A1-S4 Rumbo Definido.',
      'R1-A1-S4 Evaluación de Pensamiento y Actitud Estratégica.',
      'R1-A2-S8 Salida académica Planeación estratégica Simposio (Emprendimiento e Innovación).',
      'R2-A1-S11 Radar competitivo.',
      'R2-A1-S13 Mapa estratégico colaborativo.',
      'R2-A1-S14 Simulación de impacto.',
      'R2-A1-S16 Evidenciemos soluciones (Pitch estratégico).',
    ]);
    expect(filas.every((f) => f.ponderacion === 14.29)).toBe(true);
  });

  it('lee la nota aunque traiga la marca ✓ y deja sin nota lo que no tiene', () => {
    const { filas } = leerTextoDelCmad(CAPTURA_DE_LA_PAGINA);

    expect(filas.map((f) => f.nota)).toEqual([5, 5, 5, null, null, null, null]);
  });

  it('lee el total del curso para poder comprobar la lectura', () => {
    expect(leerTextoDelCmad(CAPTURA_DE_LA_PAGINA).totalDelCurso).toBe(2.1);
  });

  it('lee la nota aunque el OCR la haya leído con los tres puntos de la actividad pegados («√5.0…»)', () => {
    const captura = [
      'CUESTIONARIO',
      'R1-A1-S4 Evaluación de\t14.29 %',
      '国\tPensamiento y Actitud\t14.29 %\t√5.0…\t0-5\t100.0 %\t14.3 %',
      'Estratégica.',
      'TAREA',
      'R2-A1-S11 Radar\t14.29 %\t0-5\t0.0 %',
    ].join('\n');

    const { filas } = leerTextoDelCmad(captura);

    expect(filas[0].nombre).toBe('R1-A1-S4 Evaluación de Pensamiento y Actitud Estratégica.');
    expect(filas[0].nota).toBe(5);
    expect(filas[1].nota).toBeNull();
  });

  it('no trae la retroalimentación del docente en los nombres ni lo que hay debajo de la tabla', () => {
    const { filas } = leerTextoDelCmad(CAPTURA_DE_LA_PAGINA);
    const todo = JSON.stringify(filas);

    expect(todo).not.toContain('Buen trabajo');
    expect(todo).not.toContain('muchachos');
    expect(todo).not.toContain('Contáctanos');
  });

  it('deja fuera lo que no pondera: el contenido interactivo y las retroalimentaciones sin peso', () => {
    const { filas } = leerTextoDelCmad(CAPTURA_DE_LA_PAGINA);

    expect(filas.map((f) => f.nombre).join(' ')).not.toMatch(/PAD|Retroalimentación REA/);
  });

  it('arma los cortes con el prefijo del nombre y suman 100', () => {
    const cortes = armarLosCortes(leerTextoDelCmad(CAPTURA_DE_LA_PAGINA).filas);

    expect(cortes.map((c) => c.nombre)).toEqual(['R1', 'R2']);
    expect(cortes.map((c) => c.actividades.length)).toEqual([3, 4]);
    expect(cortes.reduce((total, c) => total + c.porcentaje, 0)).toBeCloseTo(100, 5);
  });

  it('con espacios en vez de tabuladores sigue leyendo las actividades', () => {
    const { filas } = leerTextoDelCmad(CAPTURA_DE_LA_PAGINA.replace(/\t/g, ' '));

    expect(filas).toHaveLength(7);
    expect(filas[0].nombre.startsWith('R1-A1-S4 Rumbo Definido.')).toBe(true);
  });

  it('en un curso con categorías, la captura también arma un corte por REA', () => {
    const captura = [
      'TAREA\t25.00 %\t✓5.0\t0-5\t100.0 %\t25.0 %',
      'R1-A1-S2 Análisis',
      'TAREA',
      'R1-A2-S3 Explorando\t25.00 %\t3.8\t0-5',
      'TAREA',
      'Retroalimentación REA 1.\t50.00 %\t4.5\t0-5',
      'CÁLCULO TOTAL\t35.00 %\t4.4\t0-5',
      'Total REA 1',
      'TAREA\t100.00 %\t0-5',
      'R2-A3-S5 Descubriendo el problema',
      'CÁLCULO TOTAL\t65.00 %\t0-5',
      'Total REA 2',
      'CÁLCULO TOTAL\t2.2\t0-5',
      'Total del curso',
    ].join('\n');

    const { filas, totalDelCurso } = leerTextoDelCmad(captura);
    const cortes = armarLosCortes(filas);

    expect(filas).toHaveLength(4);
    expect(cortes.map((c) => c.nombre)).toEqual(['REA 1', 'REA 2']);
    expect(cortes.map((c) => c.porcentaje)).toEqual([35, 65]);
    expect(totalDelCurso).toBe(2.2);
  });
});

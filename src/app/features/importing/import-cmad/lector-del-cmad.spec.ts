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

import {
  MAXIMO_DE_FILAS,
  MAXIMO_DE_LA_CELDA,
  MateriaLeida,
  OfertaNoLegible,
  aAsignaturaDeOferta,
  leerOfertaDeHorarios,
} from './lector-de-oferta';
import { ARCHIVO_DE_AFUERA, OFERTA_DE_EJEMPLO } from './oferta-de-ejemplo';

const CABECERA =
  '<thead><tr><th>SEMESTRE</th><th>CAMPO DE APRENDIZAJE / NUCLEO TEMATICO</th><th>CÓDIGO</th><th>GRUPO</th>' +
  '<th>CUPOS DISPONIBLES</th><th>DÍA</th><th>HORA INICIO</th><th>HORA FIN</th><th>SALÓN</th></tr></thead>';

/** Una fila completa, sin `rowspan`: las celdas de arriba se repiten, como las dejaría un navegador. */
const fila = (
  semestre: number,
  nombre: string,
  codigo: string,
  grupo: string,
  dia: string,
  inicio: string,
  fin: string,
  salon = '--',
) =>
  `<tr><td>${semestre}</td><td>${nombre}</td><td>${codigo}</td><td>${grupo}</td><td>20</td><td>${dia}</td>` +
  `<td>${inicio}</td><td>${fin}</td><td>${salon}</td></tr>`;

const pagina = (filas: string) =>
  `<html><body><table class="tablesorter PaginarTabla">${CABECERA}<tbody>${filas}</tbody></table></body></html>`;

describe('leerOfertaDeHorarios', () => {
  const oferta = leerOfertaDeHorarios(OFERTA_DE_EJEMPLO);
  const materia = (codigo: string): MateriaLeida => {
    const encontrada = oferta.materias.find((m) => m.codigo === codigo);
    if (!encontrada) {
      throw new Error(`No está la materia ${codigo}`);
    }
    return encontrada;
  };

  it('sigue el rowspan y arma ÁLGEBRA LINEAL con sus cinco grupos', () => {
    const algebra = materia('CAD612021101');

    expect(algebra.semestre).toBe(1);
    expect(algebra.nombre).toBe('ÁLGEBRA LINEAL');
    expect(algebra.grupos.map((g) => g.codigo)).toEqual([
      'SIS.FUSA 101M',
      'SIS.FUSA 102M',
      'SIS.FUSA 103M',
      'SIS.FUSA 104M',
      'SIS.FUSA 105M',
    ]);
    expect(algebra.grupos[0].cupos).toBe(20);
    expect(algebra.grupos[0].bloques).toEqual([{ dia: 'martes', inicio: '07:00', fin: '09:59', salon: null }]);
  });

  it('un grupo con dos bloques conserva los dos', () => {
    const electronica = materia('CAD612021106');

    expect(electronica.grupos).toHaveLength(1);
    expect(electronica.grupos[0].bloques).toEqual([
      { dia: 'jueves', inicio: '11:00', fin: '12:59', salon: null },
      { dia: 'lunes', inicio: '07:00', fin: '08:59', salon: null },
    ]);
  });

  it('omite los grupos sin horario y las materias que se quedan sin grupos', () => {
    expect(oferta.materias.some((m) => m.codigo.startsWith('DN-'))).toBe(false);
    expect(oferta.materias.filter((m) => m.semestre === 1).map((m) => m.codigo)).toEqual([
      'CAD612021101',
      'CAD612021106',
    ]);
  });

  it('quita el espacio y el &nbsp; del código del grupo', () => {
    expect(materia('CAD612021208').grupos.map((g) => g.codigo)).toEqual(['SIS FUSA 202M', 'SIS.FUSA 201M']);
  });

  it('el salón -- es null y C-105 se conserva', () => {
    expect(materia('CAI1002020202').grupos[0].bloques[0].salon).toBe('C-105');
    expect(materia('CAD612021101').grupos[0].bloques[0].salon).toBeNull();
  });

  it('las líneas de Profundización son opciones distintas y quedan con nombre único', () => {
    const a = materia('CAD612021836-A');
    const b = materia('CAD612021836-B');

    expect(a.nombre).toBe('PROFUNDIZACION I (MPD)');
    expect(b.nombre).toBe('PROFUNDIZACION I (EASW)');
    // Cada línea conserva sus propios grupos, días y horas: ninguna se fusiona con otra.
    expect(a.grupos.map((g) => g.codigo)).toEqual(['801SISFU-MPD-A', '802SISFU-MPD-A', '803SISFU-MPD-A']);
    expect(b.grupos.map((g) => g.bloques[0].dia)).toEqual(['sabado', 'sabado', 'sabado']);
    expect(materia('CAD612021101').nombre).toBe('ÁLGEBRA LINEAL');
  });

  it('sin una sigla legible en los grupos, la línea se distingue con su letra', () => {
    const lectura = leerOfertaDeHorarios(
      pagina(
        fila(8, 'PROFUNDIZACION II', 'CAD1-A', '1', 'LUNES', '0700', '0859') +
          fila(8, 'PROFUNDIZACION II', 'CAD1-B', '2', 'MARTES', '0700', '0859'),
      ),
    );

    expect(lectura.materias.map((m) => m.nombre)).toEqual(['PROFUNDIZACION II (A)', 'PROFUNDIZACION II (B)']);
  });

  it('lee el período', () => {
    expect(oferta.periodo).toBe('2026-2');
  });

  it('aAsignaturaDeOferta suma un minuto al fin: 09:59 es hasta las 10:00', () => {
    const asignatura = aAsignaturaDeOferta(materia('CAD612021101'));

    expect(asignatura.nombre).toBe('ÁLGEBRA LINEAL');
    expect(asignatura.grupos[0]).toEqual({
      codigo: 'SIS.FUSA 101M',
      bloques: [{ dia: 'martes', inicio: '07:00', fin: '10:00' }],
    });
  });

  it('dos clases seguidas (fin 09:59 e inicio 10:00) quedan sin solaparse', () => {
    const lectura = leerOfertaDeHorarios(
      pagina(
        fila(1, 'UNA', 'CAD1', 'G1', 'LUNES', '0800', '0959') + fila(1, 'OTRA', 'CAD2', 'G1', 'LUNES', '1000', '1159'),
      ),
    );
    const [una, otra] = lectura.materias.map(aAsignaturaDeOferta);

    expect(una.grupos[0].bloques[0].fin).toBe('10:00');
    expect(otra.grupos[0].bloques[0].inicio).toBe('10:00');
  });

  it('el archivo de afuera (frameset) dice cuál archivo subir y en qué carpeta está', () => {
    expect(() => leerOfertaDeHorarios(ARCHIVO_DE_AFUERA)).toThrow(OfertaNoLegible);
    expect(() => leerOfertaDeHorarios(ARCHIVO_DE_AFUERA)).toThrow(/pub_rep_val\.html/);
    // La carpeta sale del propio archivo (la ruta de su marco principal), no de una suposición.
    expect(() => leerOfertaDeHorarios(ARCHIVO_DE_AFUERA)).toThrow(/Universidad Cundinamarca _ Sistema Institucional_files/);
  });

  it('el archivo de afuera sin ruta legible en su marco sigue diciendo cuál subir', () => {
    const sinRuta = '<html><frameset rows="0,*"><frame name="mainFrame"></frameset></html>';

    expect(() => leerOfertaDeHorarios(sinRuta)).toThrow(/pub_rep_val\.html/);
  });

  it('la ruta del marco no deja pasar texto largo ni marcas: solo se muestra como texto corto', () => {
    const hostil = `<html><frameset><frame name="mainFrame" src="${'x'.repeat(500)}<b>.html"></frameset></html>`;

    expect(() => leerOfertaDeHorarios(hostil)).toThrow(/pub_rep_val\.html/);
    try {
      leerOfertaDeHorarios(hostil);
    } catch (fallo) {
      expect((fallo as Error).message.length).toBeLessThan(500);
    }
  });

  it('un html sin tabla de horarios no se puede leer', () => {
    expect(() => leerOfertaDeHorarios('<html><body><p>Hola</p></body></html>')).toThrow(OfertaNoLegible);
    expect(() => leerOfertaDeHorarios('')).toThrow(OfertaNoLegible);
  });

  it('una tabla con más filas de las admitidas se rechaza antes de leerla', () => {
    const filas = Array.from({ length: MAXIMO_DE_FILAS + 1 }, () => fila(1, 'M', 'CAD1', 'G1', 'LUNES', '0700', '0859'));

    expect(() => leerOfertaDeHorarios(pagina(filas.join('')))).toThrow(OfertaNoLegible);
  });

  it('una celda demasiado larga se rechaza', () => {
    const larga = 'X'.repeat(MAXIMO_DE_LA_CELDA + 1);

    expect(() => leerOfertaDeHorarios(pagina(fila(1, larga, 'CAD1', 'G1', 'LUNES', '0700', '0859')))).toThrow(
      OfertaNoLegible,
    );
  });

  it('un html con img onerror y script no ejecuta nada y los textos salen como texto', () => {
    const w = window as unknown as { __marca?: number };
    delete w.__marca;
    const hostil = OFERTA_DE_EJEMPLO.replace(
      '<body>',
      '<body><img src="x" onerror="window.__marca = 1"><script>window.__marca = 2</script>',
    ).replace('ÁLGEBRA LINEAL', '&lt;b&gt;ÁLGEBRA&lt;/b&gt; LINEAL');

    const lectura = leerOfertaDeHorarios(hostil);

    expect(w.__marca).toBeUndefined();
    expect(lectura.materias[0].nombre).toBe('<b>ÁLGEBRA</b> LINEAL');
  });

  it('entiende los días con mayúsculas y sin tildes', () => {
    const lectura = leerOfertaDeHorarios(
      pagina(
        fila(1, 'M', 'CAD1', 'G1', 'LUNES', '0700', '0859') +
          fila(1, 'M', 'CAD1', 'G1', 'MIERCOLES', '0700', '0859') +
          fila(1, 'M', 'CAD1', 'G1', 'SABADO', '0700', '0859'),
      ),
    );

    expect(lectura.materias[0].grupos[0].bloques.map((b) => b.dia)).toEqual(['lunes', 'miercoles', 'sabado']);
  });

  it('un día desconocido no se puede leer', () => {
    expect(() => leerOfertaDeHorarios(pagina(fila(1, 'M', 'CAD1', 'G1', 'FUTURO', '0700', '0859')))).toThrow(
      OfertaNoLegible,
    );
  });
});

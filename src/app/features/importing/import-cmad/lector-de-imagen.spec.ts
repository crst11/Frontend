import { finDeLasColumnasQueSeLeen, franjasDe, juntarEnLineas, limpiarTextoDeOcr } from './lector-de-imagen';

describe('la retroalimentación del docente en una captura de la página', () => {
  const trozos = [
    { texto: 'TAREA', x: 317, xFin: 380, y: 100, alto: 14 },
    { texto: 'Retroalimentación REA 1', x: 316, xFin: 520, y: 130, alto: 16 },
    { texto: 'El informe es sólido, bien', x: 992, xFin: 1300, y: 100, alto: 16 },
    { texto: 'estructurado y con un enfoque', x: 993, xFin: 1310, y: 160, alto: 16 },
    { texto: 'TAREA', x: 318, xFin: 380, y: 300, alto: 14 },
  ];

  const conRangos = [
    ...trozos,
    { texto: '0-5', x: 776, xFin: 805, y: 100, alto: 16 },
    { texto: '0–5', x: 778, xFin: 806, y: 300, alto: 16 },
    { texto: '0-5', x: 775, xFin: 804, y: 500, alto: 16 },
  ];

  it('se lee hasta un poco más allá de la columna del rango, que se ubica con los rangos de la propia imagen', () => {
    expect(finDeLasColumnasQueSeLeen(conRangos, 1622)).toBeCloseTo(776 + 1622 * 0.065, 5);
  });

  it('el rango queda dentro aunque el de una fila esté unos píxeles más a la derecha que los demás', () => {
    const fila = [...conRangos, { texto: '0-5', x: 803, xFin: 832, y: 700, alto: 16 }];

    const texto = juntarEnLineas(fila, finDeLasColumnasQueSeLeen(fila, 1622));

    expect(texto.split('\n')).toContain('0-5');
    expect(texto.split('\n')).toHaveLength(5);
  });

  it('el porcentaje de al lado del rango queda y la retroalimentación y lo que aporta al curso no', () => {
    const fila = [
      ...conRangos,
      { texto: '80.0 %', x: 802, xFin: 860, y: 100, alto: 16 },
      { texto: 'Buen trabajo', x: 907, xFin: 1000, y: 100, alto: 16 },
      { texto: '7.3 %', x: 1080, xFin: 1130, y: 100, alto: 16 },
    ];

    const texto = juntarEnLineas(fila, finDeLasColumnasQueSeLeen(fila, 1622));

    expect(texto).toContain('80.0 %');
    expect(texto).not.toContain('Buen trabajo');
    expect(texto).not.toContain('7.3 %');
  });

  it('sin etiquetas de tipo ni rangos no se supone ninguna columna y se lee todo', () => {
    expect(finDeLasColumnasQueSeLeen([{ texto: 'Tarea R1-A1', x: 10, y: 10, alto: 14 }], 1622)).toBeUndefined();
    expect(finDeLasColumnasQueSeLeen(trozos, 1622)).toBeUndefined();
  });

  it('lo que está a la derecha del rango (el párrafo del docente) no se lee', () => {
    const texto = juntarEnLineas(conRangos, finDeLasColumnasQueSeLeen(conRangos, 1622));

    expect(texto.split('\n')).toEqual(['TAREA\t0-5', 'Retroalimentación REA 1', 'TAREA\t0–5', '0-5']);
    expect(texto).not.toContain('informe');
    expect(texto).not.toContain('estructurado');
  });

  it('un porcentaje suelto de la columna «Aporta al total» no se confunde con el peso de la actividad', () => {
    const fila = [
      { texto: 'TAREA', x: 317, xFin: 380, y: 100, alto: 14 },
      { texto: 'Automatiza sin', x: 316, xFin: 460, y: 130, alto: 16 },
      { texto: '0.0 %', x: 1080, xFin: 1130, y: 130, alto: 16 },
      { texto: 'ver: el poder de', x: 315, xFin: 470, y: 160, alto: 16 },
      { texto: '9.09 %', x: 496, xFin: 560, y: 160, alto: 16 },
      { texto: '0-5', x: 729, xFin: 760, y: 160, alto: 16 },
      { texto: 'TAREA', x: 317, xFin: 380, y: 300, alto: 14 },
      { texto: '0-5', x: 731, xFin: 760, y: 330, alto: 16 },
    ];

    const texto = juntarEnLineas(fila, finDeLasColumnasQueSeLeen(fila, 1622));

    expect(texto).not.toContain('0.0 %');
    expect(texto).toContain('9.09 %');
    expect(texto).toContain('0-5');
  });

  it('sin límite no se descarta ninguna línea', () => {
    expect(juntarEnLineas(trozos).split('\n')).toHaveLength(4);
  });
});

describe('franjasDe', () => {
  it('una imagen de tamaño normal se lee de una vez', () => {
    expect(franjasDe(1200)).toEqual([{ desde: 0, hasta: 1200, propiaDesde: 0, propiaHasta: 1200 }]);
  });

  it('una captura de toda la página (6420 de alto) se corta en franjas a tamaño legible', () => {
    const franjas = franjasDe(6420);

    expect(franjas.length).toBeGreaterThan(3);
    expect(franjas[0].desde).toBe(0);
    expect(franjas[franjas.length - 1].hasta).toBe(6420);
    expect(franjas.every((f) => f.hasta - f.desde <= 1400)).toBe(true);
  });

  it('las franjas se solapan, así una fila en el borde de una se lee entera en la otra', () => {
    const franjas = franjasDe(6420);

    for (let i = 1; i < franjas.length; i++) {
      expect(franjas[i].desde).toBeLessThan(franjas[i - 1].hasta);
    }
  });

  it('cada altura es de una sola franja: nada se repite y nada se pierde', () => {
    for (const alto of [1561, 2413, 3000, 6420, 9999]) {
      const franjas = franjasDe(alto);

      expect(franjas[0].propiaDesde).toBe(0);
      expect(franjas[franjas.length - 1].propiaHasta).toBe(alto);
      for (let i = 1; i < franjas.length; i++) {
        expect(franjas[i].propiaDesde).toBe(franjas[i - 1].propiaHasta);
      }
      for (const f of franjas) {
        expect(f.propiaDesde).toBeGreaterThanOrEqual(f.desde);
        expect(f.propiaHasta).toBeLessThanOrEqual(f.hasta);
      }
    }
  });
});

describe('limpiarTextoDeOcr', () => {
  it('quita las rayas de la tabla, los espacios de más y las líneas vacías', () => {
    const texto = '  R1-A1 Tarea |  8,33 %  | 4,1 | 0–5  \n\n   \n| R1-A2 Taller | 8,33 % | 4,7 | 0–5';

    expect(limpiarTextoDeOcr(texto)).toBe('R1-A1 Tarea 8,33 % 4,1 0–5\nR1-A2 Taller 8,33 % 4,7 0–5');
  });

  it('conserva los tabuladores entre celdas, que son lo que separa el nombre de lo demás', () => {
    expect(limpiarTextoDeOcr('R1-A1 Tarea \t 8,33 %\t4,1  \n')).toBe('R1-A1 Tarea\t8,33 %\t4,1');
  });
});

describe('juntarEnLineas', () => {
  it('junta lo que está a la misma altura de izquierda a derecha y las filas de arriba abajo', () => {
    const trozos = [
      { texto: '4.7', x: 800, y: 112, alto: 24 },
      { texto: 'Taller R2-A1', x: 20, y: 110, alto: 26 },
      { texto: '25.00 %', x: 600, y: 111, alto: 25 },
      { texto: 'Tarea R1-A1', x: 20, y: 40, alto: 26 },
      { texto: '4.1', x: 800, y: 42, alto: 24 },
    ];

    expect(juntarEnLineas(trozos)).toBe('Tarea R1-A1 4.1\nTaller R2-A1 25.00 % 4.7');
  });

  it('dos filas distintas no se mezclan aunque estén cerca', () => {
    const trozos = [
      { texto: 'A', x: 0, y: 10, alto: 20 },
      { texto: 'B', x: 0, y: 40, alto: 20 },
    ];

    expect(juntarEnLineas(trozos)).toBe('A\nB');
  });

  it('sin texto no devuelve nada', () => {
    expect(juntarEnLineas([])).toBe('');
  });

  it('un hueco ancho entre dos trozos es el borde de una celda y queda como un tabulador', () => {
    const trozos = [
      { texto: 'R1-A2-S8 Salida académica', x: 20, xFin: 300, y: 10, alto: 20 },
      { texto: 'Muy buen trabajo', x: 700, xFin: 880, y: 11, alto: 20 },
    ];

    expect(juntarEnLineas(trozos)).toBe('R1-A2-S8 Salida académica\tMuy buen trabajo');
  });

  it('trozos casi pegados siguen siendo la misma celda y quedan con un espacio', () => {
    const trozos = [
      { texto: 'Evaluación', x: 20, xFin: 120, y: 10, alto: 20 },
      { texto: 'de', x: 130, xFin: 150, y: 10, alto: 20 },
    ];

    expect(juntarEnLineas(trozos)).toBe('Evaluación de');
  });
});

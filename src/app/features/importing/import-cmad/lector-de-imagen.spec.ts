import { juntarEnLineas, limpiarTextoDeOcr } from './lector-de-imagen';

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

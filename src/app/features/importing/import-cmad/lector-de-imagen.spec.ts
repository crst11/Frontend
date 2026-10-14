import { limpiarTextoDeOcr } from './lector-de-imagen';

describe('limpiarTextoDeOcr', () => {
  it('quita las rayas de la tabla, los espacios de más y las líneas vacías', () => {
    const texto = '  R1-A1 Tarea |  8,33 %  | 4,1 | 0–5  \n\n   \n| R1-A2 Taller | 8,33 % | 4,7 | 0–5';

    expect(limpiarTextoDeOcr(texto)).toBe('R1-A1 Tarea 8,33 % 4,1 0–5\nR1-A2 Taller 8,33 % 4,7 0–5');
  });
});

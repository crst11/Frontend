// @ts-expect-error El constructor de pruebas entrega el archivo como texto con este atributo de importación; el tipo no lo conoce.
import estilosCrudos from './oferta-de-la-universidad.css' with { loader: 'text' };

const estilos = estilosCrudos as string;

/** Las declaraciones de la regla de ese selector, como texto y sin comentarios. */
function regla(selector: string): string {
  const reglas = estilos.replace(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, '').split('}');
  const encontrada = reglas.find((texto) => texto.split('{')[0].trim() === selector);
  return encontrada?.split('{')[1] ?? '';
}

describe('estilos de la oferta de la universidad', () => {
  it('el enlace de «Consultar Horarios» tiene el mismo margen lateral que los pasos y la advertencia de la tarjeta', () => {
    // La tarjeta de la guía no tiene relleno: lo ponen sus hijos. Sin este margen el enlace quedaba pegado al borde,
    // más ancho que el texto de abajo.
    expect(regla('.oferta__enlace')).toMatch(/padding:\s*0 16px/);
  });
});

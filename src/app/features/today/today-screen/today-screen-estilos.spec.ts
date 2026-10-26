// @ts-expect-error El constructor de pruebas entrega el archivo como texto con este atributo de importación; el tipo no lo conoce.
import estilosCrudos from './today-screen.css' with { loader: 'text' };

const estilos = estilosCrudos as string;

/** Las declaraciones de las reglas de ese selector exacto, juntas y sin comentarios. */
function regla(selector: string): string {
  const sinComentarios = estilos.replace(/\/\*[\s\S]*?\*\//g, '');
  const cuerpos = sinComentarios.split('}').filter((texto) => texto.split('{')[0].trim() === selector);
  return cuerpos.map((texto) => texto.split('{')[1]).join(' ');
}

describe('estilos de la pantalla del día (SCRUM-263)', () => {
  it('la tarjeta de la clase tiene una franja a la izquierda: verde si va, ámbar si sigue', () => {
    expect(regla('.hoy__clase')).toMatch(/border-left:\s*4px solid var\(--color-border\)/);
    expect(regla('.hoy__clase--en-curso')).toMatch(/border-left-color:\s*var\(--color-primary\)/);
    expect(regla('.hoy__clase--proxima')).toMatch(/border-left-color:\s*var\(--color-warning\)/);
  });

  it('cada pendiente o riesgo es una fila con borde propio', () => {
    const fila = regla('.hoy__por-atender-item');
    expect(fila).toMatch(/border:\s*1px solid var\(--color-border\)/);
    expect(fila).toMatch(/border-radius:\s*12px/);
  });

  it('el medidor cambia de color con el nivel', () => {
    expect(regla('.hoy__medidor--alto')).toMatch(/--medidor-color:\s*var\(--color-danger-line\)/);
    expect(regla('.hoy__medidor--medio')).toMatch(/--medidor-color:\s*var\(--color-warning\)/);
  });
});

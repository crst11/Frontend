// @ts-expect-error El constructor de pruebas entrega el archivo como texto con este atributo de importación; el tipo no lo conoce.
import estilosCrudos from './my-tasks.css' with { loader: 'text' };

const estilos = estilosCrudos as string;

/** Las declaraciones de las reglas de ese selector exacto, juntas y sin comentarios. */
function regla(selector: string): string {
  const sinComentarios = estilos.replace(/\/\*[\s\S]*?\*\//g, '');
  const cuerpos = sinComentarios.split('}').filter((texto) => texto.split('{')[0].trim() === selector);
  return cuerpos.map((texto) => texto.split('{')[1]).join(' ');
}

describe('estilos de Mis pendientes (SCRUM-264)', () => {
  it('cada pendiente lleva una franja a la izquierda: gris normal, ámbar urgente, roja vencido', () => {
    expect(regla('.pendientes__item')).toMatch(/border-left:\s*4px solid var\(--color-border\)/);
    expect(regla('.pendientes__item--urgente')).toMatch(/border-left-color:\s*var\(--color-warning\)/);
    expect(regla('.pendientes__item--vencido')).toMatch(/border-left-color:\s*var\(--color-danger\)/);
  });

  it('lo urgente ya no usa el anillo verde grueso', () => {
    expect(regla('.pendientes__item--urgente')).not.toMatch(/box-shadow/);
  });

  it('la etiqueta de urgente usa el par ámbar que llega a 4.5:1', () => {
    const urgente = regla('.pendientes__situacion--urgente');
    expect(urgente).toMatch(/background:\s*var\(--color-warning-soft\)/);
    expect(urgente).toMatch(/color:\s*var\(--color-warning-text\)/);
  });
});

// @ts-expect-error El constructor de pruebas entrega el archivo como texto con este atributo de importación; el tipo no lo conoce.
import estilosCrudos from './import-report.css' with { loader: 'text' };

const estilos = estilosCrudos as string;

/** Las declaraciones de las reglas de ese selector exacto, juntas y sin comentarios. */
function regla(selector: string): string {
  const sinComentarios = estilos.replace(/\/\*[\s\S]*?\*\//g, '');
  const cuerpos = sinComentarios.split('}').filter((texto) => texto.split('{')[0].trim() === selector);
  return cuerpos.map((texto) => texto.split('{')[1]).join(' ');
}

describe('estilos de la zona de carga (SCRUM-263)', () => {
  it('es un recuadro punteado verde sobre fondo suave, como en el diseño', () => {
    const zona = regla('.import__zona');
    expect(zona).toMatch(/border:\s*2px dashed var\(--color-primary\)/);
    expect(zona).toMatch(/background:\s*var\(--color-primary-soft\)/);
  });

  it('el icono va en un círculo blanco y el texto principal en verde', () => {
    expect(regla('.import__zona-icono')).toMatch(/background:\s*var\(--color-surface\)/);
    expect(regla('.import__zona-texto')).toMatch(/color:\s*var\(--color-primary\)/);
  });
});

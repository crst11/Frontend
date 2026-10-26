// @ts-expect-error El constructor de pruebas entrega el archivo como texto con este atributo de importación; el tipo no lo conoce.
import estilosCrudos from './app-shell.css' with { loader: 'text' };

const estilos = estilosCrudos as string;

/** Las declaraciones de las reglas de ese selector exacto, juntas y sin comentarios. */
function regla(selector: string): string {
  const sinComentarios = estilos.replace(/\/\*[\s\S]*?\*\//g, '');
  const cuerpos = sinComentarios.split('}').filter((texto) => texto.split('{')[0].trim() === selector);
  return cuerpos.map((texto) => texto.split('{')[1]).join(' ');
}

describe('estilos de la barra inferior (SCRUM-263)', () => {
  it('la pestaña activa se distingue también sin el color: lleva una barra arriba', () => {
    expect(regla('.shell__tab')).toMatch(/position:\s*relative/);
    const barra = regla('.shell__tab--activa::before');
    expect(barra).toMatch(/content:\s*''/);
    expect(barra).toMatch(/height:\s*3px/);
    expect(barra).toMatch(/background:\s*var\(--color-primary\)/);
  });

  it('el texto de cada pestaña no se sale de su celda: se recorta con puntos suspensivos', () => {
    const pestana = regla('.shell__tab');
    expect(pestana).toMatch(/min-width:\s*0/);
    expect(regla('.shell__tab-texto')).toMatch(/text-overflow:\s*ellipsis/);
  });
});

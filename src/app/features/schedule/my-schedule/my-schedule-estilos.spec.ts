// @ts-expect-error El constructor de pruebas entrega el archivo como texto con este atributo de importación; el tipo no lo conoce.
import estilosCrudos from './my-schedule.css' with { loader: 'text' };

const estilos = estilosCrudos as string;

/** Las declaraciones de las reglas de ese selector exacto, juntas y sin comentarios. */
function regla(selector: string): string {
  const sinComentarios = estilos.replace(/\/\*[\s\S]*?\*\//g, '');
  const cuerpos = sinComentarios.split('}').filter((texto) => texto.split('{')[0].trim() === selector);
  return cuerpos.map((texto) => texto.split('{')[1]).join(' ');
}

describe('estilos de Mi horario (SCRUM-264)', () => {
  it('cada clase lleva la franja verde a la izquierda, como en la pantalla de hoy', () => {
    expect(regla('.horario__clase')).toMatch(/border-left:\s*4px solid var\(--color-primary\)/);
  });

  it('los iconos de lugar y docente no se encogen cuando el texto ocupa varias líneas', () => {
    expect(regla('.horario__detalle')).toMatch(/align-items:\s*flex-start/);
    expect(regla('.horario__detalle svg')).toMatch(/flex:\s*0 0 auto/);
  });

  it('los filtros plegados no dejan un hueco vacío bajo el título', () => {
    expect(regla('.horario__filtros:not([open])')).toMatch(/gap:\s*0/);
  });
});

// @ts-expect-error El constructor de pruebas entrega el archivo como texto con este atributo de importación; el tipo no lo conoce.
import estilosCrudos from './evaluation-structure.css' with { loader: 'text' };

// @ts-expect-error Mismo atributo de importación que arriba.
import plantillaCruda from './evaluation-structure.html' with { loader: 'text' };

const estilos = estilosCrudos as string;

/** Las declaraciones de las reglas de ese selector exacto, juntas y sin comentarios. */
function regla(selector: string): string {
  const sinComentarios = estilos.replace(/\/\*[\s\S]*?\*\//g, '');
  const cuerpos = sinComentarios.split('}').filter((texto) => texto.split('{')[0].trim() === selector);
  return cuerpos.map((texto) => texto.split('{')[1]).join(' ');
}
const plantilla = plantillaCruda as string;

describe('estilos de la lista de asignaturas de Mis notas (SCRUM-264)', () => {
  it('«Sin configurar» es una insignia ámbar: pide atención sin depender solo del color', () => {
    expect(plantilla).toMatch(/<span class="badge badge--soon">Sin configurar<\/span>/);
  });

  it('la tarjeta lleva una franja verde si ya está configurada y ámbar si falta', () => {
    expect(plantilla).toContain('evaluacion__asignatura--lista');
    expect(regla('.evaluacion__asignatura')).toMatch(/border-left:\s*4px solid var\(--color-warning\)/);
    expect(regla('.evaluacion__asignatura--lista')).toMatch(/border-left-color:\s*var\(--color-primary\)/);
  });
});

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

  it('las tarjetas, los botones y los módulos van separados por 16 px, nunca pegados', () => {
    expect(regla('.horario__cuerpo')).toMatch(/gap:\s*16px/);
    expect(regla('.horario__acciones-superiores')).toMatch(/gap:\s*12px/);
  });

  it('toda la tarjeta de una clase se puede tocar, no solo su nombre', () => {
    expect(regla('.horario__clase')).toMatch(/position:\s*relative/);
    expect(regla('.horario__clase-boton::after')).toMatch(/position:\s*absolute/);
    expect(regla('.horario__clase-boton::after')).toMatch(/inset:\s*0/);
  });

  it('lo que se despliega queda por encima de la zona que se toca, para poder usar sus enlaces', () => {
    expect(regla('.horario__notas')).toMatch(/position:\s*relative/);
    expect(regla('.horario__notas')).toMatch(/z-index:\s*1/);
  });

  it('el foco de teclado se ve sobre toda la tarjeta', () => {
    expect(regla('.horario__clase-boton:focus-visible::after')).toMatch(/outline:\s*3px solid var\(--color-focus\)/);
  });
});

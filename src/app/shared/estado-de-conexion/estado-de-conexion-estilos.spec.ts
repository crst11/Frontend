// @ts-expect-error El constructor de pruebas entrega el archivo como texto con este atributo de importación; el tipo no lo conoce.
import estilosCrudos from './estado-de-conexion.css' with { loader: 'text' };

const estilos = estilosCrudos as string;

describe('estilos de la franja de conexión', () => {
  it('se queda en la columna de la app, la misma de la barra de arriba, y no pegada al borde de la pantalla', () => {
    const anfitrion = /:host\s*\{([^}]*)\}/.exec(estilos)?.[1] ?? '';

    expect(anfitrion).toMatch(/max-width:\s*440px/);
    expect(anfitrion).toMatch(/margin:\s*0 auto/);
  });
});

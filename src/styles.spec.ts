// @ts-expect-error El constructor de pruebas entrega el archivo como texto con este atributo de importación; el tipo no lo conoce.
import estilosCrudos from './styles.css' with { loader: 'text' };

const estilos = estilosCrudos as string;

/** Los tokens de `:root` como mapa nombre → valor. */
function tokens(): Map<string, string> {
  const bloque = /:root\s*\{([^}]*)\}/.exec(estilos)?.[1] ?? '';
  return new Map([...bloque.matchAll(/(--[a-z-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

function color(nombre: string): string {
  if (nombre === 'blanco') {
    return '#ffffff';
  }
  const valor = tokens().get(nombre);
  if (!valor) {
    throw new Error(`Falta el token ${nombre}`);
  }
  return valor;
}

/** Luminancia relativa y razón de contraste de WCAG 2.x. */
function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const canal = parseInt(hex.slice(i, i + 2), 16) / 255;
    return canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

describe('Sistema visual: styles.css (SCRUM-259)', () => {
  it('los tokens tienen los valores del Figma', () => {
    const esperados: Record<string, string> = {
      '--color-primary': '#047857',
      '--color-primary-soft': '#ecfdf5',
      '--color-background': '#f9fafb',
      '--color-border': '#e5e7eb',
      '--color-text': '#4b5563',
      '--color-ink': '#111827',
    };
    for (const [nombre, valor] of Object.entries(esperados)) {
      expect(tokens().get(nombre), nombre).toBe(valor);
    }
  });

  it('el texto cumple 4.5:1 sobre su fondo', () => {
    const pares: [string, string][] = [
      ['--color-text', '--color-background'],
      ['--color-text', '--color-surface'],
      ['--color-ink', '--color-background'],
      ['--color-ink', '--color-surface'],
      ['--color-muted', '--color-background'],
      ['--color-muted', '--color-surface'],
      ['--color-primary', '--color-surface'],
      ['--color-primary', '--color-primary-soft'],
      ['--color-primary-strong', '--color-primary-soft'],
      ['blanco', '--color-primary'],
      ['blanco', '--color-primary-strong'],
      ['--color-danger', '--color-danger-soft'],
      ['--color-danger', '--color-surface'],
      ['--color-warning-text', '--color-warning-soft'],
      ['--color-warning-text', '--color-surface'],
    ];
    for (const [texto, fondo] of pares) {
      expect(contraste(color(texto), color(fondo)), `${texto} sobre ${fondo}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('solo los marcadores de posición usan el gris claro', () => {
    const reglas = estilos.split('}').map((regla) => regla.split('{'));
    const usosComoTexto = reglas.filter(([, cuerpo]) => /(^|[;\s])color:\s*var\(--color-faint\)/.test(cuerpo ?? ''));
    expect(usosComoTexto.length).toBeGreaterThan(0);
    for (const [selector] of usosComoTexto) {
      expect(selector, 'selector que usa --color-faint como texto').toContain('::placeholder');
    }
  });
});

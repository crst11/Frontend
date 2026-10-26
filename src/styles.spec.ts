// @ts-expect-error El constructor de pruebas entrega el archivo como texto con este atributo de importación; el tipo no lo conoce.
import estilosCrudos from './styles.css' with { loader: 'text' };

// @ts-expect-error Mismo atributo de importación que arriba.
import estilosCorreoCrudos from './app/shared/institutional-email-input/institutional-email-input.css' with { loader: 'text' };

const estilos = estilosCrudos as string;
const estilosCorreo = estilosCorreoCrudos as string;

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
      ['--color-text', '--color-chip'],
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

  it('el botón no usa altura fija', () => {
    const regla = /\n\.button\s*\{([^}]*)\}/.exec(estilos)?.[1] ?? '';
    expect(regla).toMatch(/min-height:\s*50px/);
    expect(regla).not.toMatch(/(^|[;\s])height:/);
  });

  it('los rellenos rojo y ámbar del Figma nunca se usan como color de texto', () => {
    for (const css of [estilos, estilosCorreo]) {
      const reglas = css.split('}').map((regla) => regla.split('{'));
      const usos = reglas.filter(([, cuerpo]) => /(^|[;\s])color:\s*var\(--color-(danger-line|warning)\)/.test(cuerpo ?? ''));
      expect(usos.map(([selector]) => selector.trim())).toEqual([]);
    }
  });

  it('un campo con error y foco se distingue con un anillo exterior, en el campo y en el de correo', () => {
    const anillo = /box-shadow:[^;]*0 0 0 [3-4]px/;
    const campo = /\.field__input\[aria-invalid='true'\]:focus\s*\{([^}]*)\}/.exec(estilos)?.[1] ?? '';
    const correo = /\.institutional-email--invalid:focus-within\s*\{([^}]*)\}/.exec(estilosCorreo)?.[1] ?? '';
    expect(campo).toMatch(anillo);
    expect(correo).toMatch(anillo);
  });

  it('la casilla marcada se dibuja con borde verde y marca propia, sin perder el foco visible', () => {
    expect(estilos).toMatch(/\.checkbox input\s*\{[^}]*appearance:\s*none/);
    const marcada = /\.checkbox input:checked\s*\{([^}]*)\}/.exec(estilos)?.[1] ?? '';
    expect(marcada).toMatch(/border-color:\s*var\(--color-primary\)/);
    expect(estilos).toMatch(/\.checkbox input:checked::after/);
    const foco = /\.checkbox input:focus-visible\s*\{([^}]*)\}/.exec(estilos)?.[1] ?? '';
    expect(foco).toMatch(/outline:\s*[2-9]px solid var\(--color-primary\)/);
  });

  it('el pulsado y el spinner se apagan con movimiento reducido', () => {
    const reducido = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(estilos)?.[1] ?? '';
    expect(reducido).toContain('.button--loading::before');
    expect(reducido).toContain('.button:active');
  });
});

describe('Sistema visual: piezas de la fase 3 (SCRUM-263)', () => {
  /** Las declaraciones de la regla de ese selector exacto, o '' si no existe. */
  function regla(selector: string): string {
    const sinComentarios = estilos.replace(/\/\*[\s\S]*?\*\//g, '');
    const cuerpos = sinComentarios.split('}').filter((texto) => texto.split('{')[0].trim() === selector);
    return cuerpos.map((texto) => texto.split('{')[1]).join(' ');
  }

  it('las insignias de estado de clase usan pares de colores que llegan a 4.5:1', () => {
    expect(regla('.badge--live')).toMatch(/background:\s*var\(--color-primary-soft\)/);
    expect(regla('.badge--soon')).toMatch(/background:\s*var\(--color-warning-soft\)/);
    expect(regla('.badge--soon')).toMatch(/color:\s*var\(--color-warning-text\)/);
    expect(regla('.badge--solid')).toMatch(/background:\s*var\(--color-primary\)/);
    expect(regla('.badge--solid')).toMatch(/color:\s*#ffffff/);
    expect(contraste(color('blanco'), color('--color-primary'))).toBeGreaterThanOrEqual(4.5);
  });

  it('el progreso por pasos tiene segmentos y marcadores con su estado hecho', () => {
    expect(regla('.steps__bar')).toMatch(/display:\s*flex/);
    expect(regla('.steps__segment')).toMatch(/background:\s*var\(--color-border\)/);
    expect(regla('.steps__segment--done')).toMatch(/background:\s*var\(--color-primary\)/);
    expect(regla('.steps__marker')).toMatch(/border:\s*2px solid/);
    expect(regla('.steps__marker--done')).toMatch(/background:\s*var\(--color-primary\)/);
  });

  it('los segmentos no dependen del movimiento: el relleno no se anima con movimiento reducido', () => {
    const reducido = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(estilos)?.[1] ?? '';
    expect(reducido).toContain('.steps__segment');
  });
});

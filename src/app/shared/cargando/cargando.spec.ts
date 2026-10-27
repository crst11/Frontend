// @ts-expect-error El constructor de pruebas entrega el archivo como texto con este atributo de importación; el tipo no lo conoce.
import estilosCrudos from './cargando.css' with { loader: 'text' };
import { TestBed } from '@angular/core/testing';
import { Cargando } from './cargando';

const estilos = estilosCrudos as string;

describe('Cargando', () => {
  function crear(mensaje: string): HTMLElement {
    const fixture = TestBed.createComponent(Cargando);
    fixture.componentRef.setInput('mensaje', mensaje);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('dice qué se está haciendo y lo anuncia como estado', () => {
    const raiz = crear('Buscando tu horario…');

    expect(raiz.querySelector('[role="status"]')?.textContent).toContain('Buscando tu horario…');
  });

  it('dibuja cuatro puntos que los lectores de pantalla no leen', () => {
    const raiz = crear('Cargando…');

    expect(raiz.querySelectorAll('.cargando__punto').length).toBe(4);
    expect(raiz.querySelector('.cargando__puntos')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('los puntos son verdes y pulsan uno tras otro', () => {
    expect(estilos).toMatch(/\.cargando__punto\s*\{[^}]*background:\s*var\(--color-primary\)/);
    expect(estilos).toMatch(/\.cargando__punto\s*\{[^}]*animation:\s*cargando-pulso/);
    expect(estilos).toMatch(/animation-delay:\s*0\.45s/);
  });

  it('con movimiento reducido los puntos quedan quietos', () => {
    expect(estilos).toMatch(/prefers-reduced-motion:\s*reduce\)\s*\{[^}]*animation:\s*none/);
  });
});

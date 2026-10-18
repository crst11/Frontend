import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Conexion } from '../../core/offline/conexion.service';
import { Sincronizacion } from '../../core/offline/sincronizacion.service';
import { cuando, EstadoDeConexion } from './estado-de-conexion';

describe('cuando', () => {
  // 17 de octubre de 2026, 16:04 en Bogotá (UTC-5) = 21:04 UTC.
  const MOMENTO = Date.parse('2026-10-17T21:04:00Z');

  it('lo de hoy dice «hoy» y la hora de Bogotá', () => {
    expect(cuando(MOMENTO, Date.parse('2026-10-17T23:00:00Z'))).toMatch(/^hoy, 4:04\s?p\.\s?m\.$/);
  });

  it('lo de otro día dice la fecha y la hora', () => {
    expect(cuando(MOMENTO, Date.parse('2026-10-19T15:00:00Z'))).toMatch(/^17 de oct\.?, 4:04\s?p\.\s?m\.$/);
  });

  it('el día se cuenta en Bogotá y no en UTC', () => {
    // 21:30 en Bogotá es 02:30 UTC del día siguiente: para quien lo vive sigue siendo hoy.
    expect(cuando(Date.parse('2026-10-18T02:30:00Z'), Date.parse('2026-10-18T03:00:00Z'))).toMatch(/^hoy,/);
  });
});

describe('EstadoDeConexion', () => {
  const enLinea = signal(true);

  beforeEach(() => {
    enLinea.set(true);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Conexion, useValue: { enLinea: enLinea.asReadonly() } }],
    });
  });

  function crear() {
    const fixture = TestBed.createComponent(EstadoDeConexion);
    fixture.detectChanges();
    const texto = () => {
      fixture.detectChanges();
      return (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ').trim() ?? '';
    };
    return { fixture, texto, sincronizacion: TestBed.inject(Sincronizacion) };
  }

  it('con conexión y sin lecturas no dice nada', () => {
    const { texto } = crear();

    expect(texto()).toBe('');
  });

  it('con conexión muestra cuándo se actualizó la pantalla', () => {
    const { texto, sincronizacion } = crear();

    sincronizacion.registrarActual(Date.now());

    expect(texto()).toMatch(/^Actualizado hoy, /);
  });

  it('sin conexión lo dice con palabras y avisa que solo se consulta', () => {
    enLinea.set(false);
    const { texto } = crear();

    expect(texto()).toContain('Sin conexión.');
    expect(texto()).toContain('Solo puedes consultar');
  });

  it('sin conexión y con copia dice de cuándo es lo que se está viendo', () => {
    enLinea.set(false);
    const { texto, sincronizacion } = crear();

    sincronizacion.registrarCopia(Date.parse('2026-10-01T15:00:00Z'));

    expect(texto()).toContain('Última actualización: 1 de oct');
    expect(texto()).toContain('Solo puedes consultar');
    expect(texto()).not.toContain('..');
  });

  it('con red pero con lo que se ve sacado de la copia también avisa que no está al día', () => {
    const { texto, sincronizacion } = crear();

    sincronizacion.registrarCopia(Date.parse('2026-10-01T15:00:00Z'));

    expect(texto()).toContain('Sin conexión.');
  });

  it('se anuncia a quien usa lector de pantalla', () => {
    const { fixture } = crear();

    expect((fixture.nativeElement as HTMLElement).querySelector('[role="status"]')).not.toBeNull();
  });
});

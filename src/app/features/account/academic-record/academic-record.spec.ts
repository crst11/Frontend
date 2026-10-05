import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { HistorialRepository, MiHistorial } from '../../../data-access/historial.repository';
import { AcademicRecord } from './academic-record';

describe('AcademicRecord', () => {
  const CON_HISTORIAL: MiHistorial = {
    periodos: [
      {
        codigo: '2024-2',
        creditosMatriculados: 16,
        creditosAprobados: 16,
        promedio: 4.4,
        fuenteDelPromedio: 'oficial',
        asignaturas: [
          { codigo: 'A', nombre: 'Álgebra Lineal', creditos: 3, nota: 4.2, estado: 'aprobada', pondera: true },
          {
            codigo: 'DN-1',
            nombre: 'Diagnóstico y Nivelatorio Razonamiento Lógico',
            creditos: 0,
            nota: 5,
            estado: 'aprobada',
            pondera: false,
          },
        ],
      },
      {
        codigo: '2025-1',
        creditosMatriculados: 18,
        creditosAprobados: 14,
        promedio: 4.74,
        fuenteDelPromedio: 'calculado',
        asignaturas: [
          { codigo: 'B', nombre: 'Programación I', creditos: 3, nota: 3.9, estado: 'aprobada', pondera: true },
          { codigo: 'C', nombre: 'Física I', creditos: 4, nota: null, estado: 'en_curso', pondera: false },
        ],
      },
    ],
    promedioAcumulado: 4.6,
    fuenteDelAcumulado: 'calculado',
    creditosAprobados: 30,
    creditosDelPrograma: 153,
    porcentajeDeAvance: 19.61,
  };

  const SIN_NADA: MiHistorial = {
    periodos: [],
    promedioAcumulado: null,
    fuenteDelAcumulado: null,
    creditosAprobados: 0,
    creditosDelPrograma: null,
    porcentajeDeAvance: null,
  };

  function crear(miHistorial: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [AcademicRecord],
      providers: [provideRouter([]), { provide: HistorialRepository, useValue: { miHistorial } }],
    });
    const fixture = TestBed.createComponent(AcademicRecord);
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement };
  }

  function boton(html: HTMLElement, texto: string): HTMLButtonElement {
    return Array.from(html.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(texto),
    )!;
  }

  it('muestra el promedio acumulado y el avance en la carrera', () => {
    const { html } = crear(vi.fn().mockReturnValue(of(CON_HISTORIAL)));

    expect(html.textContent).toContain('4.6');
    expect(html.textContent).toContain('30 de 153 créditos');
    expect(html.textContent).toContain('19.61%');
  });

  it('muestra los períodos del más reciente al más antiguo', () => {
    const { html } = crear(vi.fn().mockReturnValue(of(CON_HISTORIAL)));

    const nombres = Array.from(html.querySelectorAll('.record__periodo-nombre')).map((n) => n.textContent?.trim());
    expect(nombres).toEqual(['2do semestre', '1er semestre']);
  });

  it('numera los semestres por el orden en que se cursaron, no por el calendario', () => {
    // SCRUM-75. El código del período sigue visible: es el que aparece en los documentos oficiales.
    const { html } = crear(vi.fn().mockReturnValue(of(CON_HISTORIAL)));

    const primero = html.querySelectorAll('.record__periodo')[0];
    expect(primero.querySelector('.record__periodo-nombre')?.textContent?.trim()).toBe('2do semestre');
    expect(primero.textContent).toContain('2025 · primer semestre');
  });

  it('avisa que la cuenta va por semestres cursados y no por calendario', () => {
    const { html } = crear(vi.fn().mockReturnValue(of(CON_HISTORIAL)));

    expect(html.querySelector('.record__aviso')?.textContent).toContain('no el calendario');
  });

  it('abre el período más reciente y deja cerrados los anteriores', () => {
    const { html } = crear(vi.fn().mockReturnValue(of(CON_HISTORIAL)));

    expect(html.textContent).toContain('Programación I');
    expect(html.textContent).not.toContain('Álgebra Lineal');
  });

  it('distingue el promedio oficial del calculado', () => {
    const { fixture, html } = crear(vi.fn().mockReturnValue(of(CON_HISTORIAL)));

    // El de 2024-2 viene del reporte de la universidad.
    const fuentes = Array.from(html.querySelectorAll('.record__periodo-fuente')).map((f) => f.textContent?.trim());
    expect(fuentes).toEqual(['oficial']);

    boton(html, '2024 · segundo semestre').click();
    fixture.detectChanges();
    expect(html.textContent).toContain('Álgebra Lineal');
  });

  it('dice que el acumulado es calculado cuando no viene del reporte', () => {
    const { html } = crear(vi.fn().mockReturnValue(of(CON_HISTORIAL)));

    expect(html.textContent).toContain('Calculado con tus notas cargadas');
  });

  it('una asignatura sin nota lo dice en palabras y no como un cero', () => {
    const { html } = crear(vi.fn().mockReturnValue(of(CON_HISTORIAL)));

    const notas = Array.from(html.querySelectorAll('.record__asignatura-nota')).map((n) => n.textContent?.trim());
    expect(notas).toContain('Sin nota');
    expect(notas).not.toContain('0.0');
  });

  it('marca como "no pondera" la asignatura de cero créditos', () => {
    const { fixture, html } = crear(vi.fn().mockReturnValue(of(CON_HISTORIAL)));

    boton(html, '2024 · segundo semestre').click();
    fixture.detectChanges();

    expect(html.textContent).toContain('no pondera');
  });

  it('sin programa elegido invita a elegirlo en vez de mostrar un avance vacío', () => {
    const sinPrograma = { ...CON_HISTORIAL, creditosDelPrograma: null, porcentajeDeAvance: null };
    const { html } = crear(vi.fn().mockReturnValue(of(sinPrograma)));

    expect(html.textContent).toContain('Elige tu programa');
    expect(html.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('sin asignaturas cargadas explica de dónde van a salir', () => {
    const { html } = crear(vi.fn().mockReturnValue(of(SIN_NADA)));

    expect(html.textContent).toContain('Registro Académico Extendido');
    expect(html.querySelectorAll('.record__periodo')).toHaveLength(0);
  });

  it('avisa en pantalla cuando el historial no carga', () => {
    const { html } = crear(vi.fn().mockReturnValue(throwError(() => ({ status: 500 }))));

    expect(html.querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar tu historial');
  });
});

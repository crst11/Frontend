import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { PerfilAcademico, PlanDeEstudiosRepository } from '../../../data-access/plan-de-estudios.repository';
import { StudyPlan } from './study-plan';

describe('StudyPlan', () => {
  const notificador = { aviso: vi.fn(), problema: vi.fn() };

  const PROGRAMA = {
    codigo: '109964',
    nombre: 'Ingeniería de Sistemas y Computación',
    facultad: 'Ingeniería',
    sede: 'Fusagasugá',
    totalCreditos: 153,
    numeroPeriodos: 9,
  };

  const CON_PLAN: PerfilAcademico = {
    programaElegido: true,
    plan: {
      codigo: 'ISC-2020-FUSA',
      programa: PROGRAMA,
      periodos: [
        {
          periodo: 1,
          creditos: 16,
          asignaturas: [
            { codigo: 'A1', nombre: 'Álgebra Lineal', creditos: 3, tipo: 'obligatoria', prerrequisitos: [] },
            {
              codigo: 'DN-1',
              nombre: 'Diagnóstico y Nivelatorio Razonamiento Lógico',
              creditos: 0,
              tipo: 'obligatoria',
              prerrequisitos: [],
            },
          ],
        },
        {
          periodo: 2,
          creditos: 18,
          asignaturas: [
            { codigo: 'B1', nombre: 'Programación I', creditos: 4, tipo: 'obligatoria', prerrequisitos: ['A1'] },
          ],
        },
      ],
    },
  };

  const SIN_PLAN: PerfilAcademico = { programaElegido: false, plan: null };

  beforeEach(() => {
    notificador.aviso.mockReset().mockResolvedValue(undefined);
    notificador.problema.mockReset().mockResolvedValue(undefined);
  });

  function crear(
    miPerfil: ReturnType<typeof vi.fn>,
    elegirPrograma = vi.fn().mockReturnValue(of(CON_PLAN)),
    programas = vi.fn().mockReturnValue(of([PROGRAMA])),
  ) {
    TestBed.configureTestingModule({
      imports: [StudyPlan],
      providers: [
        provideRouter([]),
        { provide: PlanDeEstudiosRepository, useValue: { miPerfil, elegirPrograma, programas } },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    const fixture = TestBed.createComponent(StudyPlan);
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement, elegirPrograma };
  }

  function boton(html: HTMLElement, texto: string): HTMLButtonElement {
    return Array.from(html.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(texto),
    )!;
  }

  it('muestra el programa y sus totales cuando ya está elegido', () => {
    const { html } = crear(vi.fn().mockReturnValue(of(CON_PLAN)));

    expect(html.textContent).toContain('Ingeniería de Sistemas y Computación');
    expect(html.textContent).toContain('Sede Fusagasugá');
    expect(html.textContent).toContain('153');
  });

  it('lista un semestre por período con sus créditos', () => {
    const { html } = crear(vi.fn().mockReturnValue(of(CON_PLAN)));

    expect(html.querySelectorAll('.plan__period')).toHaveLength(2);
    expect(html.textContent).toContain('Semestre 1');
    expect(html.textContent).toContain('16 créditos');
  });

  it('abre el primer semestre y deja los demás cerrados', () => {
    const { html } = crear(vi.fn().mockReturnValue(of(CON_PLAN)));

    expect(html.textContent).toContain('Álgebra Lineal');
    expect(html.textContent).not.toContain('Programación I');
  });

  it('abre y cierra un semestre al tocarlo', async () => {
    const { fixture, html } = crear(vi.fn().mockReturnValue(of(CON_PLAN)));

    boton(html, 'Semestre 2').click();
    fixture.detectChanges();
    expect(html.textContent).toContain('Programación I');

    boton(html, 'Semestre 2').click();
    fixture.detectChanges();
    expect(html.textContent).not.toContain('Programación I');
  });

  it('traduce el prerrequisito a su nombre y no muestra el código', () => {
    const { fixture, html } = crear(vi.fn().mockReturnValue(of(CON_PLAN)));

    boton(html, 'Semestre 2').click();
    fixture.detectChanges();

    const requisito = html.querySelector('.plan__requirement');
    expect(requisito?.textContent).toContain('Álgebra Lineal');
    expect(requisito?.textContent).not.toContain('A1');
  });

  it('marca como "No pondera" la asignatura de 0 créditos', () => {
    const { html } = crear(vi.fn().mockReturnValue(of(CON_PLAN)));

    expect(html.textContent).toContain('No pondera');
  });

  it('ofrece elegir programa cuando todavía no hay uno', () => {
    const { html } = crear(vi.fn().mockReturnValue(of(SIN_PLAN)));

    expect(html.textContent).toContain('Elige tu programa');
    expect(boton(html, 'Elegir este programa')).toBeDefined();
  });

  it('al elegir un programa muestra el plan sin volver a pedir el perfil', async () => {
    const miPerfil = vi.fn().mockReturnValue(of(SIN_PLAN));
    const { fixture, html, elegirPrograma } = crear(miPerfil);

    boton(html, 'Elegir este programa').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(elegirPrograma).toHaveBeenCalledWith('109964');
    expect(miPerfil).toHaveBeenCalledTimes(1);
    expect(html.textContent).toContain('Semestre 1');
  });

  it('avisa en pantalla cuando el plan no carga', () => {
    const { html } = crear(vi.fn().mockReturnValue(throwError(() => ({ status: 500 }))));

    expect(html.querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar tu plan');
  });
});

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
import {
  AsignaturaMatriculada,
  EstructuraDeEvaluacion,
  EvaluacionRepository,
} from '../../../data-access/evaluacion.repository';
import { EvaluationStructure } from './evaluation-structure';

describe('EvaluationStructure', () => {
  const notificador = { exito: vi.fn(), problema: vi.fn(), aviso: vi.fn(), confirmar: vi.fn() };

  const ALGEBRA: AsignaturaMatriculada = {
    idMatricula: 7,
    codigoAsignatura: 'CAD612021101',
    nombre: 'Álgebra Lineal',
    creditos: 3,
    codigoPeriodo: '2026-2',
    estado: 'en_curso',
    enCurso: true,
    tieneEstructura: false,
    categorias: 0,
    actividades: 0,
  };

  const FISICA: AsignaturaMatriculada = {
    ...ALGEBRA,
    idMatricula: 8,
    codigoAsignatura: 'CAD612021106',
    nombre: 'Física I',
    tieneEstructura: true,
    categorias: 3,
    actividades: 5,
  };

  const SIN_NOTAS = {
    puntos: 0,
    porcentajeEvaluado: 0,
    promedioDeLoEvaluado: null,
    actividadesCalificadas: 0,
    actividadesTotales: 0,
  };

  /** Lo que devuelve el servidor para una asignatura sin configurar: la plantilla, sin guardar. */
  const PROPUESTA: EstructuraDeEvaluacion = {
    asignatura: ALGEBRA,
    guardada: false,
    categorias: [
      { consecutivo: 1, nombre: 'Primer corte', porcentaje: 30, origen: 'plantilla', actividades: [] },
      { consecutivo: 2, nombre: 'Segundo corte', porcentaje: 30, origen: 'plantilla', actividades: [] },
      { consecutivo: 3, nombre: 'Tercer corte', porcentaje: 40, origen: 'plantilla', actividades: [] },
    ],
    acumulado: SIN_NOTAS,
  };

  /** Una asignatura ya configurada, con un parcial calificado: lo que se usa a diario. */
  const CON_NOTA: EstructuraDeEvaluacion = {
    asignatura: { ...ALGEBRA, tieneEstructura: true, categorias: 1, actividades: 2 },
    guardada: true,
    categorias: [
      {
        consecutivo: 1,
        nombre: 'Primer corte',
        porcentaje: 100,
        origen: 'estudiante',
        actividades: [
          {
            consecutivo: 1,
            nombre: 'Parcial',
            porcentaje: 70,
            fechaProgramada: null,
            tipo: 'parcial',
            estadoEntrega: 'calificada',
            nota: 4,
          },
          {
            consecutivo: 2,
            nombre: 'Taller',
            porcentaje: 30,
            fechaProgramada: null,
            tipo: 'taller',
            estadoEntrega: 'no_entregada',
            nota: null,
          },
        ],
      },
    ],
    acumulado: {
      puntos: 2.8,
      porcentajeEvaluado: 70,
      promedioDeLoEvaluado: 4,
      actividadesCalificadas: 1,
      actividadesTotales: 2,
    },
  };

  beforeEach(() => {
    notificador.exito.mockReset().mockResolvedValue(undefined);
    notificador.problema.mockReset().mockResolvedValue(undefined);
    notificador.aviso.mockReset().mockResolvedValue(undefined);
    notificador.confirmar.mockReset().mockResolvedValue(true);
  });

  function crear(
    misAsignaturas = vi.fn().mockReturnValue(of([ALGEBRA, FISICA])),
    estructuraDe = vi.fn().mockReturnValue(of(PROPUESTA)),
    guardar = vi.fn().mockReturnValue(
      of({
        ...PROPUESTA,
        guardada: true,
        asignatura: { ...ALGEBRA, tieneEstructura: true, categorias: 3, actividades: 0 },
        categorias: PROPUESTA.categorias.map((c) => ({ ...c, origen: 'estudiante' })),
      } satisfies EstructuraDeEvaluacion),
    ),
    consulta: Record<string, string> = {},
  ) {
    TestBed.configureTestingModule({
      imports: [EvaluationStructure],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(consulta) } } },
        { provide: EvaluacionRepository, useValue: { misAsignaturas, estructuraDe, guardar, registrarNota: vi.fn(), quitarNota: vi.fn() } },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    const fixture = TestBed.createComponent(EvaluationStructure);
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement, estructuraDe, guardar, misAsignaturas };
  }

  function boton(html: HTMLElement, texto: string): HTMLButtonElement {
    return Array.from(html.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(texto),
    )!;
  }

  function escribir(entrada: HTMLInputElement, valor: string): void {
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
  }

  function entradas(html: HTMLElement, selector: string): HTMLInputElement[] {
    return Array.from(html.querySelectorAll<HTMLInputElement>(selector));
  }

  function abrirAlgebra(creado: ReturnType<typeof crear>) {
    boton(creado.html, 'Álgebra Lineal').click();
    creado.fixture.detectChanges();
  }

  it('empieza mostrando las asignaturas matriculadas', () => {
    const { html } = crear();

    expect(html.textContent).toContain('Elige la asignatura');
    expect(html.querySelectorAll('.evaluacion__asignatura')).toHaveLength(2);
    expect(html.textContent).toContain('Álgebra Lineal');
  });

  it('si llega con la asignatura pedida (desde la pantalla del día) la abre sin pasar por la lista (SCRUM-31)', () => {
    const { estructuraDe, html } = crear(undefined, undefined, undefined, { matricula: '7' });

    expect(estructuraDe).toHaveBeenCalledWith(7);
    expect(html.querySelector('.evaluacion__lista')).toBeNull();
  });

  it('una asignatura pedida que no es del estudiante deja la lista como siempre', () => {
    const { estructuraDe, html } = crear(undefined, undefined, undefined, { matricula: '999' });

    expect(estructuraDe).not.toHaveBeenCalled();
    expect(html.querySelector('.evaluacion__lista')).not.toBeNull();
  });

  it('distingue las asignaturas sin configurar de las que ya tienen estructura', () => {
    const { html } = crear();

    const etiquetas = Array.from(html.querySelectorAll('.badge')).map((b) => b.textContent?.trim());
    expect(etiquetas[0]).toBe('Sin configurar');
    expect(etiquetas[1]).toContain('3 categorías');
    expect(etiquetas[1]).toContain('5 actividades');
  });

  it('pide solo las asignaturas del semestre actual (SCRUM-86)', () => {
    const { misAsignaturas, html } = crear();

    expect(misAsignaturas).toHaveBeenCalledWith('actual');
    expect(html.textContent).toContain('del semestre que cursas ahora');
  });

  it('si no hay asignaturas en curso ofrece importar el horario, no el reporte de notas', () => {
    const { html } = crear(vi.fn().mockReturnValue(of([])));

    expect(html.textContent).toContain('No tienes asignaturas en curso');
    expect(html.textContent).toContain('Mi historial');
    expect(html.querySelector('a[href="/cuenta/importar-horario"]')).not.toBeNull();
    expect(html.querySelector('a[href="/cuenta/importar-reporte"]')).toBeNull();
  });

  it('una asignatura sin configurar se abre con la plantilla y avisa que no hay nada guardado', () => {
    const creado = crear();

    abrirAlgebra(creado);

    expect(creado.estructuraDe).toHaveBeenCalledWith(7);
    expect(creado.html.querySelectorAll('.evaluacion__categoria')).toHaveLength(3);
    expect(creado.html.textContent).toContain('mientras no guardes, no hay nada registrado');
    expect(creado.html.textContent).toContain('Las categorías suman 100 %');
  });

  it('dice cuánto falta mientras el estudiante cambia los pesos', () => {
    const creado = crear();
    abrirAlgebra(creado);

    escribir(entradas(creado.html, '.evaluacion__peso input')[0], '20');
    creado.fixture.detectChanges();

    expect(creado.html.querySelector('.evaluacion__suma')?.textContent).toContain('suman 90');
    expect(creado.html.querySelector('.evaluacion__suma')?.textContent).toContain('faltan 10');
    expect(creado.html.querySelector('.evaluacion__suma--mal')).not.toBeNull();
  });

  it('también dice cuánto se pasa', () => {
    const creado = crear();
    abrirAlgebra(creado);

    escribir(entradas(creado.html, '.evaluacion__peso input')[0], '50');
    creado.fixture.detectChanges();

    expect(creado.html.querySelector('.evaluacion__suma')?.textContent).toContain('se pasan 20');
  });

  it('no deja guardar mientras las categorías no sumen 100', () => {
    const creado = crear();
    abrirAlgebra(creado);

    escribir(entradas(creado.html, '.evaluacion__peso input')[0], '20');
    creado.fixture.detectChanges();

    expect(boton(creado.html, 'Guardar').disabled).toBe(true);
  });

  it('se pueden agregar y quitar categorías', () => {
    const creado = crear();
    abrirAlgebra(creado);

    boton(creado.html, 'Agregar categoría').click();
    creado.fixture.detectChanges();
    expect(creado.html.querySelectorAll('.evaluacion__categoria')).toHaveLength(4);

    Array.from(creado.html.querySelectorAll<HTMLButtonElement>('button'))
      .filter((b) => b.textContent?.includes('Quitar categoría'))[3]
      .click();
    creado.fixture.detectChanges();
    expect(creado.html.querySelectorAll('.evaluacion__categoria')).toHaveLength(3);
  });

  it('una categoría sin actividades dice que se puede dejar así', () => {
    const creado = crear();
    abrirAlgebra(creado);

    expect(creado.html.textContent).toContain('Todavía sin desglosar');
  });

  it('avisa cuando las actividades de un corte no suman 100', () => {
    const creado = crear();
    abrirAlgebra(creado);

    boton(creado.html, 'Agregar actividad').click();
    creado.fixture.detectChanges();
    escribir(entradas(creado.html, '.evaluacion__actividad .evaluacion__peso input')[0], '60');
    creado.fixture.detectChanges();

    expect(creado.html.querySelector('.evaluacion__suma-interna')?.textContent).toContain('suman 60');
    expect(creado.html.querySelector('.evaluacion__suma-interna.field__error')).not.toBeNull();
    expect(boton(creado.html, 'Guardar').disabled).toBe(true);
  });

  it('tampoco deja guardar una actividad sin nombre', () => {
    const creado = crear();
    abrirAlgebra(creado);

    boton(creado.html, 'Agregar actividad').click();
    creado.fixture.detectChanges();
    escribir(entradas(creado.html, '.evaluacion__actividad .evaluacion__peso input')[0], '100');
    creado.fixture.detectChanges();

    expect(boton(creado.html, 'Guardar').disabled).toBe(true);
  });

  it('manda el árbol completo con los números de orden que ya traía', async () => {
    const creado = crear();
    abrirAlgebra(creado);

    boton(creado.html, 'Agregar actividad').click();
    creado.fixture.detectChanges();
    escribir(entradas(creado.html, '.evaluacion__actividad .evaluacion__nombre input')[0], 'Parcial');
    escribir(entradas(creado.html, '.evaluacion__actividad .evaluacion__peso input')[0], '100');
    creado.fixture.detectChanges();

    boton(creado.html, 'Guardar').click();
    await creado.fixture.whenStable();

    expect(creado.guardar).toHaveBeenCalled();
    const [idMatricula, categorias] = creado.guardar.mock.calls[0];
    expect(idMatricula).toBe(7);
    expect(categorias.map((c: { consecutivo: number }) => c.consecutivo)).toEqual([1, 2, 3]);
    expect(categorias[0].actividades).toEqual([
      { consecutivo: 1, nombre: 'Parcial', porcentaje: 100, fechaProgramada: null, tipo: 'taller' },
    ]);
  });

  it('una categoría que el estudiante toca deja de ser la de la plantilla', async () => {
    const creado = crear();
    abrirAlgebra(creado);

    escribir(entradas(creado.html, '.evaluacion__nombre input')[0], 'Seguimiento');
    creado.fixture.detectChanges();
    boton(creado.html, 'Guardar').click();
    await creado.fixture.whenStable();

    const [, categorias] = creado.guardar.mock.calls[0];
    expect(categorias[0].origen).toBe('estudiante');
    expect(categorias[1].origen).toBe('plantilla');
  });

  it('al guardar lo confirma y la lista de atrás queda al día', async () => {
    const creado = crear();
    abrirAlgebra(creado);

    boton(creado.html, 'Guardar').click();
    await creado.fixture.whenStable();

    expect(notificador.aviso).toHaveBeenCalledWith(expect.stringContaining('Guardamos'));

    // La flecha de volver es un icono: se busca por su etiqueta, no por su texto.
    creado.html.querySelector<HTMLButtonElement>('button[aria-label="Volver a mis asignaturas"]')!.click();
    creado.fixture.detectChanges();
    expect(creado.html.querySelectorAll('.badge')[0].textContent).toContain('3 categorías');
  });

  it('se puede dejar la asignatura sin configurar quitando todas las categorías', async () => {
    const guardar = vi.fn().mockReturnValue(of({ ...PROPUESTA, guardada: false }));
    const creado = crear(undefined, undefined, guardar);
    abrirAlgebra(creado);

    Array.from(creado.html.querySelectorAll<HTMLButtonElement>('button'))
      .filter((b) => b.textContent?.includes('Quitar categoría'))
      .reverse()
      .forEach((b) => {
        b.click();
        creado.fixture.detectChanges();
      });

    expect(creado.html.textContent).toContain('la asignatura queda sin configurar');
    expect(boton(creado.html, 'Guardar').disabled).toBe(false);

    boton(creado.html, 'Guardar').click();
    await creado.fixture.whenStable();

    expect(guardar).toHaveBeenCalledWith(7, []);
  });

  it('un rechazo del servidor se muestra junto al formulario, con su mensaje', async () => {
    const guardar = vi.fn().mockReturnValue(
      throwError(() => ({
        status: 422,
        error: { detail: 'Los porcentajes de las categorías de la asignatura suman 60 %, faltan 40 %' },
      })),
    );
    const creado = crear(undefined, undefined, guardar);
    abrirAlgebra(creado);

    boton(creado.html, 'Guardar').click();
    await creado.fixture.whenStable();

    expect(creado.html.querySelector('[role="alert"]')?.textContent).toContain('faltan 40');
    expect(notificador.problema).not.toHaveBeenCalled();
  });

  it('una asignatura ya configurada abre en Notas y la propuesta de la plantilla en Estructura', () => {
    const conNota = crear(undefined, vi.fn().mockReturnValue(of(CON_NOTA)));
    abrirAlgebra(conNota);

    expect(conNota.html.querySelector('app-activity-grades')).not.toBeNull();
    expect(conNota.html.querySelector('.chip--active')?.textContent).toContain('Notas');
    expect(conNota.html.querySelector('.evaluacion__categoria')).toBeNull();
  });

  it('se puede pasar de Notas a Estructura y volver', () => {
    const creado = crear(undefined, vi.fn().mockReturnValue(of(CON_NOTA)));
    abrirAlgebra(creado);

    boton(creado.html, 'Estructura').click();
    creado.fixture.detectChanges();
    expect(creado.html.querySelector('app-activity-grades')).toBeNull();
    expect(creado.html.querySelectorAll('.evaluacion__categoria')).toHaveLength(1);

    boton(creado.html, 'Notas').click();
    creado.fixture.detectChanges();
    expect(creado.html.querySelector('app-activity-grades')).not.toBeNull();
  });

  it('una estructura guardada sin actividades sigue ofreciendo importar del CMAD y no deja una tarjeta vacía', () => {
    const guardadaSinActividades: EstructuraDeEvaluacion = {
      ...PROPUESTA,
      guardada: true,
      asignatura: { ...ALGEBRA, tieneEstructura: true, categorias: 3, actividades: 0 },
    };
    const creado = crear(undefined, vi.fn().mockReturnValue(of(guardadaSinActividades)));
    abrirAlgebra(creado);

    const importar = creado.html.querySelector<HTMLAnchorElement>('a[href*="importar-cmad"]');
    expect(importar?.textContent).toContain('Importar mis actividades del CMAD');
    expect(creado.html.querySelector('.evaluacion__cabecera')?.textContent?.trim()).not.toBe('');
  });

  it('antes de quitar una actividad con nota pregunta, y si dice que no la conserva', async () => {
    notificador.confirmar.mockResolvedValue(false);
    const creado = crear(undefined, vi.fn().mockReturnValue(of(CON_NOTA)));
    abrirAlgebra(creado);
    boton(creado.html, 'Estructura').click();
    creado.fixture.detectChanges();

    boton(creado.html, 'Quitar actividad').click();
    await creado.fixture.whenStable();
    creado.fixture.detectChanges();

    expect(notificador.confirmar).toHaveBeenCalledWith(
      'Esta actividad tiene una nota',
      expect.stringContaining('se borra su nota'),
      expect.any(String),
    );
    expect(creado.html.querySelectorAll('.evaluacion__actividad')).toHaveLength(2);
  });

  it('una actividad sin nota se quita sin preguntar', async () => {
    const creado = crear(undefined, vi.fn().mockReturnValue(of(CON_NOTA)));
    abrirAlgebra(creado);
    boton(creado.html, 'Estructura').click();
    creado.fixture.detectChanges();

    Array.from(creado.html.querySelectorAll<HTMLButtonElement>('button'))
      .filter((b) => b.textContent?.includes('Quitar actividad'))[1]
      .click();
    await creado.fixture.whenStable();
    creado.fixture.detectChanges();

    expect(notificador.confirmar).not.toHaveBeenCalled();
    expect(creado.html.querySelectorAll('.evaluacion__actividad')).toHaveLength(1);
  });

  it('si no se puede traer la lista lo dice y avisa de la falla del servidor', () => {
    const { html } = crear(vi.fn().mockReturnValue(throwError(() => ({ status: 500 }))));

    expect(html.querySelector('[role="alert"]')?.textContent).toContain('No pudimos traer tus asignaturas');
    expect(notificador.problema).toHaveBeenCalled();
  });
});

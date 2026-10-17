import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
import {
  AsignaturaMatriculada,
  EstructuraDeEvaluacion,
  EvaluacionRepository,
} from '../../../data-access/evaluacion.repository';
import { ProyeccionDeNota, ProyeccionRepository } from '../../../data-access/proyeccion.repository';
import { SimulatorScreen } from './simulator-screen';

describe('SimulatorScreen', () => {
  const notificador = { problema: vi.fn(), aviso: vi.fn(), confirmar: vi.fn() };

  const ALGEBRA = { idMatricula: 7, nombre: 'Álgebra', tieneEstructura: true } as AsignaturaMatriculada;
  const REDES = { idMatricula: 8, nombre: 'Redes', tieneEstructura: true } as AsignaturaMatriculada;
  const SIN_ESTRUCTURA = { idMatricula: 9, nombre: 'Física', tieneEstructura: false } as AsignaturaMatriculada;

  const ESTRUCTURA = {
    asignatura: ALGEBRA,
    guardada: true,
    categorias: [
      {
        consecutivo: 1,
        nombre: 'Primer corte',
        porcentaje: 30,
        origen: 'estudiante',
        actividades: [
          { consecutivo: 1, nombre: 'Parcial', porcentaje: 70, fechaProgramada: null, tipo: 'parcial', estadoEntrega: 'calificada', nota: 4 },
          { consecutivo: 2, nombre: 'Taller', porcentaje: 30, fechaProgramada: null, tipo: 'taller', estadoEntrega: 'no_entregada', nota: null },
        ],
      },
      { consecutivo: 2, nombre: 'Tercer corte', porcentaje: 40, origen: 'estudiante', actividades: [] },
    ],
    acumulado: { puntos: 0.84, porcentajeEvaluado: 21, promedioDeLoEvaluado: 4, actividadesCalificadas: 1, actividadesTotales: 2 },
  } as EstructuraDeEvaluacion;

  const ALCANZABLE: ProyeccionDeNota = {
    asignatura: ALGEBRA,
    meta: 3,
    puntos: 0.84,
    porcentajeEvaluado: 21,
    porcentajeRestante: 79,
    notaRequerida: 2.74,
    maximoPosible: 4.79,
    situacion: 'alcanzable',
  };

  const proyecciones = {
    proyeccion: vi.fn(),
    simular: vi.fn(),
    miConfiguracion: vi.fn(),
    cambiarMeta: vi.fn(),
  };
  const evaluaciones = { misAsignaturas: vi.fn(), estructuraDe: vi.fn() };

  beforeEach(() => {
    vi.useFakeTimers();
    notificador.problema.mockReset().mockResolvedValue(undefined);
    notificador.aviso.mockReset().mockResolvedValue(undefined);
    proyecciones.simular.mockReset().mockReturnValue(of(ALCANZABLE));
    proyecciones.miConfiguracion.mockReset().mockReturnValue(of({ meta: 3 }));
    proyecciones.cambiarMeta.mockReset().mockImplementation((meta: number) => of({ meta }));
    evaluaciones.misAsignaturas.mockReset().mockReturnValue(of([ALGEBRA, REDES, SIN_ESTRUCTURA]));
    evaluaciones.estructuraDe.mockReset().mockReturnValue(of(ESTRUCTURA));
  });

  afterEach(() => vi.useRealTimers());

  async function crear(urlInicial?: string) {
    TestBed.configureTestingModule({
      imports: [SimulatorScreen],
      providers: [
        provideRouter([]),
        { provide: ProyeccionRepository, useValue: proyecciones },
        { provide: EvaluacionRepository, useValue: evaluaciones },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    if (urlInicial) {
      await TestBed.inject(Router).navigateByUrl(urlInicial);
    }
    const fixture = TestBed.createComponent(SimulatorScreen);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement };
  }

  function escribir(html: HTMLElement, selector: string, valor: string) {
    const campo = html.querySelector<HTMLInputElement>(selector)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  it('ofrece solo las asignaturas del semestre que ya dicen cómo se evalúan y simula la primera', async () => {
    const { html } = await crear();

    expect(evaluaciones.misAsignaturas).toHaveBeenCalledWith('actual');
    const opciones = Array.from(html.querySelectorAll('#simulador-asignatura option')).map((o) => o.textContent?.trim());
    expect(opciones).toEqual(['Álgebra', 'Redes']);
    expect(proyecciones.simular).toHaveBeenCalledWith(7, [], 3);
  });

  it('muestra la nota que necesita con la cuenta que hizo el servidor', async () => {
    const { html } = await crear();

    const resultado = html.querySelector('.simulador__resultado')!.textContent!;
    expect(resultado).toContain('2.74');
    expect(resultado).toContain('79 %');
    expect(resultado).toContain('4.79');
  });

  it('cuando ya llegó a la meta lo dice', async () => {
    proyecciones.simular.mockReturnValue(of({ ...ALCANZABLE, puntos: 3.2, notaRequerida: 0, situacion: 'alcanzada' }));
    const { html } = await crear();

    expect(html.querySelector('.simulador__resultado')!.textContent).toContain('Ya llegaste a tu meta');
  });

  it('cuando ya no se llega lo dice con claridad y no muestra una nota imposible', async () => {
    proyecciones.simular.mockReturnValue(
      of({ ...ALCANZABLE, meta: 4.5, notaRequerida: null, maximoPosible: 2.84, situacion: 'inalcanzable' }),
    );
    const { html } = await crear();

    const resultado = html.querySelector('.simulador__resultado')!.textContent!;
    expect(resultado).toContain('ya no se llega');
    expect(resultado).toContain('2.84');
    expect(html.querySelector('.simulador__numero')).toBeNull();
  });

  it('lo que ya tiene nota no se puede probar y lo que no, sí', async () => {
    const { html } = await crear();

    expect(html.textContent).toContain('Ya tienes 4.0');
    expect(html.querySelectorAll('.simulador__nota')).toHaveLength(1);
    expect(html.textContent).not.toContain('Tercer corte');
  });

  it('escribir una nota espera la pausa y manda solo la última, sin guardar nada', async () => {
    const { fixture, html } = await crear();
    proyecciones.simular.mockClear();

    escribir(html, '.simulador__nota', '3');
    escribir(html, '.simulador__nota', '3,5');
    expect(proyecciones.simular).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();

    expect(proyecciones.simular).toHaveBeenCalledTimes(1);
    expect(proyecciones.simular).toHaveBeenCalledWith(7, [{ consecCategoria: 1, consecActividad: 2, nota: 3.5 }], 3);
    expect(html.textContent).toContain('No se guardan');
  });

  it('un texto que no es número se avisa junto al campo y no se manda', async () => {
    const { fixture, html } = await crear();
    proyecciones.simular.mockClear();

    escribir(html, '.simulador__nota', 'abc');
    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();

    expect(html.querySelector('.simulador__actividad .field__error')?.textContent).toContain('como número');
    expect(proyecciones.simular).toHaveBeenCalledWith(7, [], 3);
  });

  it('borrar lo probado vuelve a la cuenta con lo real', async () => {
    const { fixture, html } = await crear();
    escribir(html, '.simulador__nota', '4');
    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();
    proyecciones.simular.mockClear();

    html.querySelector<HTMLButtonElement>('.button--outline')!.click();
    fixture.detectChanges();

    expect(proyecciones.simular).toHaveBeenCalledWith(7, [], 3);
    expect(html.querySelector<HTMLInputElement>('.simulador__nota')!.value).toBe('');
  });

  it('cambiar la meta recalcula con la nueva y deja guardarla como la propia', async () => {
    const { fixture, html } = await crear();
    expect(html.querySelector('.simulador__guardar-meta')).toBeNull();
    proyecciones.simular.mockClear();

    escribir(html, '.simulador__meta', '3.8');
    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();

    expect(proyecciones.simular).toHaveBeenCalledWith(7, [], 3.8);
    html.querySelector<HTMLButtonElement>('.simulador__guardar-meta')!.click();
    fixture.detectChanges();

    expect(proyecciones.cambiarMeta).toHaveBeenCalledWith(3.8);
    expect(notificador.aviso).toHaveBeenCalledWith('Guardamos tu meta.');
    expect(html.querySelector('.simulador__guardar-meta')).toBeNull();
  });

  it('una meta que no es número se avisa y no se manda', async () => {
    const { fixture, html } = await crear();
    proyecciones.simular.mockClear();

    escribir(html, '.simulador__meta', 'alta');
    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();

    expect(html.textContent).toContain('Escribe la meta como número');
    expect(proyecciones.simular).not.toHaveBeenCalled();
  });

  it('lo que el servidor rechaza se muestra junto a la cuenta', async () => {
    const { fixture, html } = await crear();
    proyecciones.simular.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { detail: 'La meta tiene que estar entre 0.0 y 5.0' } })),
    );

    escribir(html, '.simulador__meta', '7');
    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();

    expect(html.querySelector('[role="alert"]')?.textContent).toContain('entre 0.0 y 5.0');
  });

  it('cambiar de asignatura pide su estructura y vuelve a simular', async () => {
    const { fixture, html } = await crear();
    proyecciones.simular.mockClear();

    const select = html.querySelector<HTMLSelectElement>('#simulador-asignatura')!;
    select.value = '8';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(evaluaciones.estructuraDe).toHaveBeenLastCalledWith(8);
    expect(proyecciones.simular).toHaveBeenCalledWith(8, [], 3);
  });

  it('abre la asignatura que pide el enlace de Mis notas', async () => {
    const { html } = await crear('/?asignatura=8');

    expect(proyecciones.simular).toHaveBeenCalledWith(8, [], 3);
    expect(html.querySelector<HTMLSelectElement>('#simulador-asignatura')!.value).toBe('8');
  });

  it('sin ninguna asignatura con estructura manda a definirla', async () => {
    evaluaciones.misAsignaturas.mockReturnValue(of([SIN_ESTRUCTURA]));
    const { html } = await crear();

    expect(html.textContent).toContain('Primero cuéntanos cómo te evalúan');
    expect(html.querySelector('a[href="/calificaciones/mis-notas"]')).not.toBeNull();
    expect(proyecciones.simular).not.toHaveBeenCalled();
  });

  it('si no se puede preparar lo dice, avisa de la falla del sistema y deja reintentar', async () => {
    evaluaciones.misAsignaturas.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));
    const { fixture, html } = await crear();

    expect(html.querySelector('[role="alert"]')?.textContent).toContain('No pudimos preparar el simulador');
    expect(notificador.problema).toHaveBeenCalled();

    html.querySelector<HTMLButtonElement>('.button--soft')!.click();
    fixture.detectChanges();

    expect(html.querySelectorAll('#simulador-asignatura option')).toHaveLength(2);
  });
});

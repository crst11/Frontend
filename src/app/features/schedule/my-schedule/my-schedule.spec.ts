import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { AsignaturaMatriculada, EvaluacionRepository } from '../../../data-access/evaluacion.repository';
import { ClaseDelHorario, Horario, HorarioRepository } from '../../../data-access/horario.repository';
import { MySchedule } from './my-schedule';

describe('MySchedule', () => {
  const notificador = { aviso: vi.fn(), problema: vi.fn(), confirmar: vi.fn() };

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
  const TERMINADA: AsignaturaMatriculada = { ...ALGEBRA, idMatricula: 9, nombre: 'Cálculo I', estado: 'aprobada', enCurso: false };

  function clase(parcial: Partial<ClaseDelHorario>): ClaseDelHorario {
    return {
      idMatricula: 7,
      consecutivo: 1,
      codigoAsignatura: 'CAD612021101',
      asignatura: 'Álgebra Lineal',
      dia: 'lunes',
      horaInicio: '08:00',
      horaFin: '10:00',
      duracionEnMinutos: 120,
      salon: 'F-203',
      bloque: 'Bloque F',
      sede: 'Fusagasugá',
      docente: { nombres: 'María José', apellidos: 'Pérez Gómez' },
      ...parcial,
    };
  }

  const LUNES = clase({});
  const LUNES_TARDE = clase({ consecutivo: 2, asignatura: 'Física I', horaInicio: '14:00', horaFin: '16:30', duracionEnMinutos: 150, salon: null, bloque: null, sede: null, docente: null });
  const VIERNES = clase({ consecutivo: 3, dia: 'viernes', asignatura: 'Electrónica' });

  const HORARIO: Horario = {
    totalDeClases: 3,
    dias: [
      { dia: 'lunes', clases: [LUNES, LUNES_TARDE] },
      { dia: 'viernes', clases: [VIERNES] },
    ],
  };
  const VACIO: Horario = { totalDeClases: 0, dias: [] };

  beforeEach(() => {
    // Miércoles 14 de octubre de 2026: abre en el día de hoy.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 14, 9, 0, 0));
    notificador.aviso.mockReset().mockResolvedValue(undefined);
    notificador.problema.mockReset().mockResolvedValue(undefined);
    notificador.confirmar.mockReset().mockResolvedValue(true);
  });

  afterEach(() => vi.useRealTimers());

  function crear(
    miHorario = vi.fn().mockReturnValue(of(HORARIO)),
    asignaturas: AsignaturaMatriculada[] = [ALGEBRA, TERMINADA],
    agregar = vi.fn().mockReturnValue(of(LUNES)),
    quitar = vi.fn().mockReturnValue(of(undefined)),
  ) {
    TestBed.configureTestingModule({
      imports: [MySchedule],
      providers: [
        provideRouter([]),
        { provide: HorarioRepository, useValue: { miHorario, agregar, quitar } },
        { provide: EvaluacionRepository, useValue: { misAsignaturas: vi.fn().mockReturnValue(of(asignaturas)) } },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    const fixture = TestBed.createComponent(MySchedule);
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement, miHorario, agregar, quitar };
  }

  function boton(html: HTMLElement, texto: string): HTMLButtonElement {
    return Array.from(html.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === texto)!;
  }

  function chipDelDia(html: HTMLElement, nombre: string): HTMLButtonElement {
    return html.querySelector<HTMLButtonElement>(`.horario__dias button[aria-label="${nombre}"]`)!;
  }

  function escribir(html: HTMLElement, selector: string, valor: string): void {
    const campo = html.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
    campo.value = valor;
    campo.dispatchEvent(new Event(campo instanceof HTMLSelectElement ? 'change' : 'input'));
  }

  it('abre en el día de hoy y no muestra clases si ese día no hay', () => {
    const { html } = crear();

    expect(html.querySelector('.horario__titulo-dia')?.textContent).toContain('Miércoles');
    expect(chipDelDia(html, 'Miércoles').getAttribute('aria-pressed')).toBe('true');
    expect(html.textContent).toContain('No tienes clases este día');
    expect(html.querySelectorAll('.horario__clase')).toHaveLength(0);
  });

  it('al elegir otro día muestra sus clases, con la hora, el lugar y el docente', () => {
    const { fixture, html } = crear();

    chipDelDia(html, 'Lunes').click();
    fixture.detectChanges();

    const tarjetas = html.querySelectorAll('.horario__clase');
    expect(tarjetas).toHaveLength(2);
    // Tal como las entrega el servidor: la pantalla no reordena.
    expect(tarjetas[0].textContent).toContain('08:00 – 10:00');
    expect(tarjetas[0].textContent).toContain('Álgebra Lineal');
    expect(tarjetas[0].textContent).toContain('F-203 · Bloque F · Fusagasugá');
    expect(tarjetas[0].textContent).toContain('María José Pérez Gómez');
    expect(tarjetas[1].textContent).toContain('14:00 – 16:30');
  });

  it('una clase sin salón ni docente lo dice en vez de inventarlo o dejar un hueco', () => {
    const { fixture, html } = crear();

    chipDelDia(html, 'Lunes').click();
    fixture.detectChanges();

    const tarde = html.querySelectorAll('.horario__clase')[1];
    expect(tarde.textContent).toContain('Todavía sin salón');
    expect(tarde.textContent).not.toContain('Docente');
  });

  it('la vista por semana muestra los siete días y marca los que no tienen clases', () => {
    const { fixture, html } = crear();

    boton(html, 'Semana').click();
    fixture.detectChanges();

    expect(html.querySelectorAll('.horario__dia-semana')).toHaveLength(7);
    expect(html.querySelectorAll('.horario__clase')).toHaveLength(3);
    expect(html.textContent?.match(/Sin clases\./g)).toHaveLength(5);
  });

  it('sin asignaturas en curso manda a importar el reporte en vez de ofrecer agregar', () => {
    const { html } = crear(vi.fn().mockReturnValue(of(VACIO)), [TERMINADA]);

    expect(html.textContent).toContain('necesitas tener asignaturas en curso');
    expect(html.querySelector('a[href="/cuenta/importar-reporte"]')).not.toBeNull();
    expect(boton(html, 'Agregar una clase')).toBeUndefined();
  });

  it('un horario vacío con asignaturas en curso invita a agregar la primera clase', () => {
    const { html } = crear(vi.fn().mockReturnValue(of(VACIO)));

    expect(html.textContent).toContain('Cuando agregues una, la verás aquí');
    expect(boton(html, 'Agregar una clase')).toBeDefined();
  });

  it('solo se pueden elegir las asignaturas que se están cursando', () => {
    const { fixture, html } = crear();

    boton(html, 'Agregar una clase').click();
    fixture.detectChanges();

    const opciones = Array.from(html.querySelectorAll('select[formControlName="idMatricula"] option')).map((o) => o.textContent?.trim());
    expect(opciones).toEqual(['Álgebra Lineal']);
  });

  it('no deja agregar mientras falten las horas', () => {
    const { fixture, html } = crear();
    boton(html, 'Agregar una clase').click();
    fixture.detectChanges();

    expect(boton(html, 'Agregar').disabled).toBe(true);

    escribir(html, 'input[formControlName="horaInicio"]', '08:00');
    escribir(html, 'input[formControlName="horaFin"]', '10:00');
    fixture.detectChanges();
    expect(boton(html, 'Agregar').disabled).toBe(false);
  });

  it('manda solo lo que el estudiante escribió: sin lugar ni docente si los dejó vacíos', () => {
    const { fixture, html, agregar } = crear();
    boton(html, 'Agregar una clase').click();
    fixture.detectChanges();

    escribir(html, 'select[formControlName="dia"]', 'martes');
    escribir(html, 'input[formControlName="horaInicio"]', '08:00');
    escribir(html, 'input[formControlName="horaFin"]', '10:00');
    fixture.detectChanges();
    boton(html, 'Agregar').click();

    expect(agregar).toHaveBeenCalledWith(7, { dia: 'martes', horaInicio: '08:00', horaFin: '10:00' });
  });

  it('manda el lugar y el docente cuando los escribió, recortados', () => {
    const { fixture, html, agregar } = crear();
    boton(html, 'Agregar una clase').click();
    fixture.detectChanges();

    escribir(html, 'input[formControlName="horaInicio"]', '14:00');
    escribir(html, 'input[formControlName="horaFin"]', '16:00');
    escribir(html, 'input[formControlName="salon"]', ' F-203 ');
    escribir(html, 'input[formControlName="sede"]', 'Fusagasugá');
    escribir(html, 'input[formControlName="docenteNombres"]', 'María');
    escribir(html, 'input[formControlName="docenteApellidos"]', 'Pérez');
    fixture.detectChanges();
    boton(html, 'Agregar').click();

    const [, enviada] = agregar.mock.calls[0];
    expect(enviada.salon).toBe('F-203');
    expect(enviada.sede).toBe('Fusagasugá');
    expect(enviada.bloque).toBeUndefined();
    expect(enviada.docente).toEqual({ nombres: 'María', apellidos: 'Pérez' });
  });

  it('al agregar cierra el formulario, vuelve a pedir el horario y avisa', () => {
    const miHorario = vi.fn().mockReturnValue(of(HORARIO));
    const { fixture, html } = crear(miHorario);
    boton(html, 'Agregar una clase').click();
    fixture.detectChanges();
    escribir(html, 'input[formControlName="horaInicio"]', '08:00');
    escribir(html, 'input[formControlName="horaFin"]', '10:00');
    fixture.detectChanges();

    boton(html, 'Agregar').click();
    fixture.detectChanges();

    expect(miHorario).toHaveBeenCalledTimes(2);
    expect(html.querySelector('form')).toBeNull();
    expect(notificador.aviso).toHaveBeenCalledWith(expect.stringContaining('Agregamos la clase'));
    // Se muestra el día de la clase que acaba de agregar.
    expect(chipDelDia(html, 'Lunes').getAttribute('aria-pressed')).toBe('true');
  });

  it('un rechazo del servidor se muestra junto al formulario, con su mensaje, y no lo cierra', () => {
    const agregar = vi.fn().mockReturnValue(
      throwError(() => ({ status: 422, error: { detail: 'La clase tiene que empezar antes de terminar' } })),
    );
    const { fixture, html } = crear(undefined, undefined, agregar);
    boton(html, 'Agregar una clase').click();
    fixture.detectChanges();
    escribir(html, 'input[formControlName="horaInicio"]', '10:00');
    escribir(html, 'input[formControlName="horaFin"]', '08:00');
    fixture.detectChanges();

    boton(html, 'Agregar').click();
    fixture.detectChanges();

    expect(html.querySelector('form [role="alert"]')?.textContent).toContain('empezar antes de terminar');
    expect(html.querySelector('form')).not.toBeNull();
    expect(notificador.problema).not.toHaveBeenCalled();
  });

  it('una caída del servidor al agregar va a la ventana emergente', () => {
    const agregar = vi.fn().mockReturnValue(throwError(() => ({ status: 500 })));
    const { fixture, html } = crear(undefined, undefined, agregar);
    boton(html, 'Agregar una clase').click();
    fixture.detectChanges();
    escribir(html, 'input[formControlName="horaInicio"]', '08:00');
    escribir(html, 'input[formControlName="horaFin"]', '10:00');
    fixture.detectChanges();

    boton(html, 'Agregar').click();

    expect(notificador.problema).toHaveBeenCalledWith('No pudimos guardar la clase', expect.any(String));
  });

  it('quitar una clase pregunta antes, y si se confirma la quita y recarga', async () => {
    const miHorario = vi.fn().mockReturnValue(of(HORARIO));
    const { fixture, html, quitar } = crear(miHorario);
    chipDelDia(html, 'Viernes').click();
    fixture.detectChanges();

    boton(html, 'Quitar').click();
    await fixture.whenStable();

    expect(notificador.confirmar).toHaveBeenCalledWith('Quitar esta clase', expect.stringContaining('Electrónica'), 'Quitar');
    expect(quitar).toHaveBeenCalledWith(7, 3);
    expect(miHorario).toHaveBeenCalledTimes(2);
  });

  it('si se cancela la confirmación no se quita nada', async () => {
    notificador.confirmar.mockResolvedValue(false);
    const { fixture, html, quitar } = crear();
    chipDelDia(html, 'Viernes').click();
    fixture.detectChanges();

    boton(html, 'Quitar').click();
    await fixture.whenStable();

    expect(quitar).not.toHaveBeenCalled();
  });

  it('si no se puede traer el horario lo dice y avisa de la falla del servidor', () => {
    const { html } = crear(vi.fn().mockReturnValue(throwError(() => ({ status: 500 }))));

    expect(html.querySelector('[role="alert"]')?.textContent).toContain('No pudimos traer tu horario');
    expect(notificador.problema).toHaveBeenCalled();
  });
});

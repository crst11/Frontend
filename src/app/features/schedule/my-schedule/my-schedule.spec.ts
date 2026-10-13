import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { AsignaturaMatriculada, EvaluacionRepository } from '../../../data-access/evaluacion.repository';
import {
  ClaseDelHorario,
  Horario,
  HorarioRepository,
  PreferenciaDeHorario,
} from '../../../data-access/horario.repository';
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

  const SIN_FILTRO = { asignatura: null, sede: null, orden: 'hora' as const };
  const HORARIO: Horario = {
    totalDeClases: 3,
    dias: [
      { dia: 'lunes', clases: [LUNES, LUNES_TARDE] },
      { dia: 'viernes', clases: [VIERNES] },
    ],
    sedes: ['Fusagasugá', 'Soacha'],
    asignaturas: [
      { codigo: 'CAD612021101', nombre: 'Álgebra Lineal' },
      { codigo: 'CAD612021106', nombre: 'Electrónica' },
    ],
    aplicado: SIN_FILTRO,
  };
  const VACIO: Horario = { totalDeClases: 0, dias: [], sedes: [], asignaturas: [], aplicado: SIN_FILTRO };
  const PREDETERMINADA: PreferenciaDeHorario = { vista: 'dia', sede: null, orden: 'hora' };

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
    miPreferencia = vi.fn().mockReturnValue(of(PREDETERMINADA)),
    guardarPreferencia = vi.fn().mockImplementation((p: PreferenciaDeHorario) => of(p)),
  ) {
    TestBed.configureTestingModule({
      imports: [MySchedule],
      providers: [
        provideRouter([]),
        { provide: HorarioRepository, useValue: { miHorario, agregar, quitar, miPreferencia, guardarPreferencia } },
        { provide: EvaluacionRepository, useValue: { misAsignaturas: vi.fn().mockReturnValue(of(asignaturas)) } },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    const fixture = TestBed.createComponent(MySchedule);
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement, miHorario, agregar, quitar, miPreferencia, guardarPreferencia };
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

  function elegir(html: HTMLElement, etiqueta: string, valor: string): void {
    const campo = Array.from(html.querySelectorAll<HTMLLabelElement>('.horario__filtros label')).find((l) =>
      l.textContent?.includes(etiqueta),
    )!.querySelector('select')!;
    campo.value = valor;
    campo.dispatchEvent(new Event('change'));
  }

  describe('organizar el horario (SCRUM-26)', () => {
    it('ofrece elegir asignatura, sede y orden con las opciones que trae el servidor', () => {
      const { html } = crear();

      const asignaturas = Array.from(html.querySelectorAll('.horario__filtros label')[0].querySelectorAll('option')).map((o) => o.textContent?.trim());
      const sedes = Array.from(html.querySelectorAll('.horario__filtros label')[1].querySelectorAll('option')).map((o) => o.textContent?.trim());
      expect(asignaturas).toEqual(['Todas', 'Álgebra Lineal', 'Electrónica']);
      expect(sedes).toEqual(['Todas', 'Fusagasugá', 'Soacha']);
    });

    it('sin clases en el horario no muestra filtros que no tendrían nada que filtrar', () => {
      const { html } = crear(vi.fn().mockReturnValue(of(VACIO)));

      expect(html.querySelector('.horario__filtros')).toBeNull();
    });

    it('abre con la vista, la sede y el orden guardados y se los pide al servidor', () => {
      const guardada: PreferenciaDeHorario = { vista: 'semana', sede: 'Soacha', orden: 'asignatura' };
      const { html, miHorario } = crear(undefined, undefined, undefined, undefined, vi.fn().mockReturnValue(of(guardada)));

      expect(miHorario).toHaveBeenCalledWith({ asignatura: undefined, sede: 'Soacha', orden: 'asignatura' });
      expect(html.querySelectorAll('.horario__dia-semana')).toHaveLength(7);
      expect(html.textContent).toContain('Esta es tu vista guardada');
    });

    it('si no se puede leer la preferencia abre con lo predeterminado sin decirle nada a nadie', () => {
      const { html, miHorario } = crear(undefined, undefined, undefined, undefined, vi.fn().mockReturnValue(throwError(() => ({ status: 500 }))));

      expect(miHorario).toHaveBeenCalledWith({ asignatura: undefined, sede: undefined, orden: 'hora' });
      expect(notificador.problema).not.toHaveBeenCalled();
      expect(html.querySelector('[role="alert"]')).toBeNull();
    });

    it('elegir una sede vuelve a pedir el horario con ese filtro y no filtra en el navegador', () => {
      const { fixture, html, miHorario } = crear();

      elegir(html, 'Sede', 'Soacha');
      fixture.detectChanges();

      expect(miHorario).toHaveBeenLastCalledWith({ asignatura: undefined, sede: 'Soacha', orden: 'hora' });
      expect(html.textContent).toContain('Quitar filtros');
    });

    it('elegir una asignatura y un orden también los manda al servidor', () => {
      const { fixture, html, miHorario } = crear();

      elegir(html, 'Asignatura', 'CAD612021101');
      fixture.detectChanges();
      elegir(html, 'Ordenar por', 'asignatura');
      fixture.detectChanges();

      expect(miHorario).toHaveBeenLastCalledWith({ asignatura: 'CAD612021101', sede: undefined, orden: 'asignatura' });
    });

    it('quitar los filtros vuelve a pedir todo, pero conserva el orden', () => {
      const { fixture, html, miHorario } = crear();
      elegir(html, 'Sede', 'Soacha');
      elegir(html, 'Ordenar por', 'asignatura');
      fixture.detectChanges();

      boton(html, 'Quitar filtros').click();
      fixture.detectChanges();

      expect(miHorario).toHaveBeenLastCalledWith({ asignatura: undefined, sede: undefined, orden: 'asignatura' });
      expect(html.textContent).not.toContain('Quitar filtros');
    });

    it('un filtro sin coincidencias dice que ninguna clase coincide y deja las opciones para quitarlo', () => {
      const sinCoincidencias: Horario = { ...VACIO, sedes: HORARIO.sedes, asignaturas: HORARIO.asignaturas, aplicado: { asignatura: null, sede: 'Soacha', orden: 'hora' } };
      const miHorario = vi.fn().mockReturnValueOnce(of(HORARIO)).mockReturnValue(of(sinCoincidencias));
      const { fixture, html } = crear(miHorario);

      elegir(html, 'Sede', 'Soacha');
      fixture.detectChanges();

      expect(html.textContent).toContain('Ninguna clase coincide con tus filtros');
      expect(html.querySelector('.horario__filtros')).not.toBeNull();
    });

    it('guardar como mi vista manda la vista, la sede y el orden, pero no la asignatura', () => {
      const { fixture, html, guardarPreferencia } = crear();
      elegir(html, 'Asignatura', 'CAD612021101');
      elegir(html, 'Sede', 'Fusagasugá');
      elegir(html, 'Ordenar por', 'asignatura');
      boton(html, 'Semana').click();
      fixture.detectChanges();

      boton(html, 'Guardar como mi vista').click();
      fixture.detectChanges();

      expect(guardarPreferencia).toHaveBeenCalledWith({ vista: 'semana', sede: 'Fusagasugá', orden: 'asignatura' });
      expect(notificador.aviso).toHaveBeenCalledWith(expect.stringContaining('Guardamos tu vista'));
      expect(html.textContent).toContain('Esta es tu vista guardada');
    });

    it('no deja guardar lo que ya está guardado', () => {
      const { html } = crear();

      expect(boton(html, 'Esta es tu vista guardada').disabled).toBe(true);
    });

    it('si no se puede guardar la vista lo dice en la pantalla', () => {
      const guardarPreferencia = vi.fn().mockReturnValue(throwError(() => ({ status: 422, error: { detail: 'La sede no puede pasar de 60 caracteres' } })));
      const { fixture, html } = crear(undefined, undefined, undefined, undefined, undefined, guardarPreferencia);
      boton(html, 'Semana').click();
      fixture.detectChanges();

      boton(html, 'Guardar como mi vista').click();
      fixture.detectChanges();

      expect(html.querySelector('[role="alert"]')?.textContent).toContain('60 caracteres');
    });
  });

  it('si no se puede traer el horario lo dice y avisa de la falla del servidor', () => {
    const { html } = crear(vi.fn().mockReturnValue(throwError(() => ({ status: 500 }))));

    expect(html.querySelector('[role="alert"]')?.textContent).toContain('No pudimos traer tu horario');
    expect(notificador.problema).toHaveBeenCalled();
  });
});

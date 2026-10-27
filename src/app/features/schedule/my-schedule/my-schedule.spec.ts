import { HttpErrorResponse } from '@angular/common/http';
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
  const anadirExtra = vi.fn();
  const quitarExtra = vi.fn();

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
      esExtra: false,
      idActividadExtra: null,
      lugar: null,
      responsable: null,
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
    anadirExtra.mockReset().mockReturnValue(of([]));
    quitarExtra.mockReset().mockReturnValue(of(undefined));
  });

  afterEach(() => vi.useRealTimers());

  function crear(
    miHorario = vi.fn().mockReturnValue(of(HORARIO)),
    asignaturas: AsignaturaMatriculada[] = [ALGEBRA, TERMINADA],
    agregar = vi.fn().mockReturnValue(of(LUNES)),
    quitar = vi.fn().mockReturnValue(of(undefined)),
    miPreferencia = vi.fn().mockReturnValue(of(PREDETERMINADA)),
    guardarPreferencia = vi.fn().mockImplementation((p: PreferenciaDeHorario) => of(p)),
    estructuraDe = vi.fn().mockReturnValue(of({ categorias: [] })),
  ) {
    TestBed.configureTestingModule({
      imports: [MySchedule],
      providers: [
        provideRouter([]),
        { provide: HorarioRepository, useValue: { miHorario, agregar, quitar, miPreferencia, guardarPreferencia, anadirActividadExtra: anadirExtra, quitarActividadExtra: quitarExtra } },
        { provide: EvaluacionRepository, useValue: { misAsignaturas: vi.fn().mockReturnValue(of(asignaturas)), estructuraDe } },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    const fixture = TestBed.createComponent(MySchedule);
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement, miHorario, agregar, quitar, miPreferencia, guardarPreferencia, estructuraDe };
  }

  function boton(html: HTMLElement, texto: string): HTMLButtonElement {
    return Array.from(html.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === texto)!;
  }

  function chipDelDia(html: HTMLElement, nombre: string): HTMLButtonElement {
    return html.querySelector<HTMLButtonElement>(`.horario__dias button[aria-label$=", ${nombre}"]`)!;
  }

  function escribir(html: HTMLElement, selector: string, valor: string): void {
    const campo = html.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
    campo.value = valor;
    campo.dispatchEvent(new Event(campo instanceof HTMLSelectElement ? 'change' : 'input'));
  }

  it('el nombre accesible de cada día incluye el texto que se ve (WCAG 2.5.3)', () => {
    const { html } = crear();

    const chips = Array.from(html.querySelectorAll<HTMLButtonElement>('.horario__dias button'));

    expect(chips).toHaveLength(7);
    for (const chip of chips) {
      const visible = (chip.textContent ?? '').trim();
      const palabrasDelNombre = (chip.getAttribute('aria-label') ?? '').split(/[\s,]+/);
      expect(palabrasDelNombre, `«${visible}» tiene que ser una palabra del nombre accesible`).toContain(visible);
    }
  });

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

  it('una clase se despliega hacia abajo con lo que falta por calificar, y se vuelve a recoger', () => {
    const estructuraDe = vi.fn().mockReturnValue(
      of({
        categorias: [
          {
            consecutivo: 1,
            nombre: 'R1',
            porcentaje: 100,
            origen: 'estudiante',
            actividades: [
              { consecutivo: 1, nombre: 'Taller 1', porcentaje: 50, nota: 4.1 },
              { consecutivo: 2, nombre: 'Taller 2', porcentaje: 50, nota: null },
            ],
          },
        ],
      }),
    );
    const { fixture, html } = crear(undefined, undefined, undefined, undefined, undefined, undefined, estructuraDe);
    chipDelDia(html, 'Lunes').click();
    fixture.detectChanges();

    boton(html, 'Ver lo que falta por calificar').click();
    fixture.detectChanges();

    expect(estructuraDe).toHaveBeenCalledWith(7);
    const panel = html.querySelector('.horario__notas')!;
    expect(panel.textContent).toContain('Te falta 1 actividad por calificar');
    expect(panel.textContent).toContain('Taller 2');
    expect(panel.textContent).not.toContain('Taller 1');
    expect(boton(html, 'Ocultar lo que falta por calificar').getAttribute('aria-expanded')).toBe('true');

    boton(html, 'Ocultar lo que falta por calificar').click();
    fixture.detectChanges();

    expect(html.querySelector('.horario__notas')).toBeNull();
  });

  it('una clase sin actividades subidas ofrece subirlas, de vuelta aquí', () => {
    const { fixture, html } = crear();
    chipDelDia(html, 'Lunes').click();
    fixture.detectChanges();

    boton(html, 'Ver lo que falta por calificar').click();
    fixture.detectChanges();

    const subir = html.querySelector<HTMLAnchorElement>('.horario__notas a')!;
    expect(subir.textContent).toContain('Subir actividades');
    expect(subir.getAttribute('href')).toBe('/calificaciones/importar-cmad?matricula=7');
  });

  it('la vista por semana muestra los siete días y marca los que no tienen clases', () => {
    const { fixture, html } = crear();

    boton(html, 'Semana').click();
    fixture.detectChanges();

    expect(html.querySelectorAll('.horario__dia-semana')).toHaveLength(7);
    expect(html.querySelectorAll('.horario__clase')).toHaveLength(3);
    expect(html.textContent?.match(/Sin clases\./g)).toHaveLength(5);
  });

  it('sin asignaturas en curso manda a importar el horario, no el reporte de notas, en vez de ofrecer agregar', () => {
    const { html } = crear(vi.fn().mockReturnValue(of(VACIO)), [TERMINADA]);

    expect(html.textContent).toContain('necesitas tener asignaturas en curso');
    expect(html.textContent).toContain('Reporte de Horario');
    expect(html.querySelector('a[href="/cuenta/importar-horario"]')).not.toBeNull();
    expect(html.querySelector('a[href="/cuenta/importar-reporte"]')).toBeNull();
    expect(boton(html, 'Agregar una clase')).toBeUndefined();
  });

  it('con asignaturas en curso sigue ofreciendo importar el horario desde el reporte', () => {
    const { html } = crear();

    expect(html.querySelector('a[href="/cuenta/importar-horario"]')?.textContent).toContain('Importar mi horario');
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

  describe('actividades extra (SCRUM-266)', () => {
    // Hoy es miércoles: la vista por día abre ahí.
    const BAILE = clase({
      idMatricula: null,
      codigoAsignatura: null,
      asignatura: 'Baile',
      dia: 'miercoles',
      horaInicio: '17:00',
      horaFin: '19:00',
      duracionEnMinutos: 120,
      salon: null,
      bloque: null,
      sede: null,
      docente: null,
      esExtra: true,
      idActividadExtra: 5,
      lugar: 'Coliseo',
      responsable: 'Profe Ana',
    });
    const SEMILLERO = { ...BAILE, asignatura: 'Semillero', idActividadExtra: 6, horaInicio: '10:00', horaFin: '12:00', lugar: null, responsable: null };
    const CON_EXTRA: Horario = {
      totalDeClases: 1,
      dias: [{ dia: 'miercoles', clases: [BAILE] }],
      sedes: [],
      asignaturas: [],
      aplicado: SIN_FILTRO,
    };

    function formularioExtra(html: HTMLElement): HTMLElement {
      return html.querySelector<HTMLElement>('.horario__extra-formulario')!;
    }

    function abrirElFormularioExtra(html: HTMLElement, fixture: { detectChanges(): void }): void {
      boton(html, 'Añadir actividad extra').click();
      fixture.detectChanges();
    }

    function chipExtra(html: HTMLElement, nombre: string): HTMLButtonElement {
      return formularioExtra(html).querySelector<HTMLButtonElement>(`.horario__extra-dias button[aria-label$=", ${nombre}"]`)!;
    }

    function llenarExtra(html: HTMLElement, fixture: { detectChanges(): void }): void {
      escribir(formularioExtra(html), 'input[formControlName="nombre"]', 'Baile');
      chipExtra(html, 'Lunes').click();
      chipExtra(html, 'Miércoles').click();
      escribir(formularioExtra(html), 'input[formControlName="horaInicio"]', '17:00');
      escribir(formularioExtra(html), 'input[formControlName="horaFin"]', '19:00');
      fixture.detectChanges();
    }

    it('el bloque de filtros se llama «Filtrar y ordenar» para no confundirlo con armar el horario', () => {
      const { html } = crear();

      const resumen = html.querySelector('.horario__resumen')?.textContent ?? '';

      expect(resumen).toContain('Filtrar y ordenar');
      expect(html.textContent).not.toContain('Organizar mi horario');
    });

    it('ofrece añadir una actividad extra aunque todavía no haya asignaturas en curso', () => {
      const { html } = crear(vi.fn().mockReturnValue(of(VACIO)), []);

      expect(html.querySelector('.horario__extras h2')?.textContent).toContain('Actividades extra');
      expect(boton(html, 'Añadir actividad extra')).toBeTruthy();
    });

    it('al abrirla muestra la guía de tres pasos y aclara que no es una asignatura', () => {
      const { fixture, html } = crear();

      abrirElFormularioExtra(html, fixture);

      const pasos = Array.from(formularioExtra(html).querySelectorAll('.horario__extra-pasos li')).map((p) => p.textContent);
      expect(pasos).toHaveLength(3);
      expect(pasos[0]).toContain('Escribe qué es');
      expect(pasos[1]).toContain('Elige los días y la hora');
      expect(pasos[2]).toContain('Guarda');
      expect(formularioExtra(html).textContent).toContain('no tiene notas ni cuenta en tu Brújula Académica');
    });

    it('el nombre accesible de cada día incluye el texto que se ve (WCAG 2.5.3)', () => {
      const { fixture, html } = crear();
      abrirElFormularioExtra(html, fixture);

      const chips = Array.from(formularioExtra(html).querySelectorAll<HTMLButtonElement>('.horario__extra-dias button'));

      expect(chips).toHaveLength(7);
      for (const chip of chips) {
        const visible = (chip.textContent ?? '').trim();
        expect((chip.getAttribute('aria-label') ?? '').split(/[\s,]+/)).toContain(visible);
      }
    });

    it('no deja guardar sin nombre, sin un día o sin las horas', () => {
      const { fixture, html } = crear();
      abrirElFormularioExtra(html, fixture);
      const guardar = () => boton(formularioExtra(html), 'Añadir');

      expect(guardar().disabled).toBe(true);
      escribir(formularioExtra(html), 'input[formControlName="nombre"]', 'Baile');
      escribir(formularioExtra(html), 'input[formControlName="horaInicio"]', '17:00');
      escribir(formularioExtra(html), 'input[formControlName="horaFin"]', '19:00');
      fixture.detectChanges();
      expect(guardar().disabled, 'falta elegir un día').toBe(true);

      chipExtra(html, 'Lunes').click();
      fixture.detectChanges();
      expect(guardar().disabled).toBe(false);

      chipExtra(html, 'Lunes').click();
      fixture.detectChanges();
      expect(guardar().disabled, 'quitar el único día lo vuelve a bloquear').toBe(true);
    });

    it('manda el nombre, los días elegidos en orden de semana y las horas, sin lugar ni responsable vacíos', () => {
      const { fixture, html } = crear();
      abrirElFormularioExtra(html, fixture);
      // Se eligen al revés para comprobar que viajan en orden de semana.
      escribir(formularioExtra(html), 'input[formControlName="nombre"]', '  Baile ');
      chipExtra(html, 'Miércoles').click();
      chipExtra(html, 'Lunes').click();
      escribir(formularioExtra(html), 'input[formControlName="horaInicio"]', '17:00');
      escribir(formularioExtra(html), 'input[formControlName="horaFin"]', '19:00');
      fixture.detectChanges();

      boton(formularioExtra(html), 'Añadir').click();

      expect(anadirExtra).toHaveBeenCalledWith({ nombre: 'Baile', dias: ['lunes', 'miercoles'], horaInicio: '17:00', horaFin: '19:00' });
    });

    it('manda el lugar y el responsable cuando los escribió, recortados', () => {
      const { fixture, html } = crear();
      abrirElFormularioExtra(html, fixture);
      llenarExtra(html, fixture);
      escribir(formularioExtra(html), 'input[formControlName="lugar"]', ' Coliseo ');
      escribir(formularioExtra(html), 'input[formControlName="responsable"]', 'Profe Ana');
      fixture.detectChanges();

      boton(formularioExtra(html), 'Añadir').click();

      expect(anadirExtra).toHaveBeenCalledWith({
        nombre: 'Baile',
        dias: ['lunes', 'miercoles'],
        horaInicio: '17:00',
        horaFin: '19:00',
        lugar: 'Coliseo',
        responsable: 'Profe Ana',
      });
    });

    it('al añadir cierra el formulario, vuelve a pedir el horario, muestra el primer día y avisa', () => {
      const miHorario = vi.fn().mockReturnValue(of(HORARIO));
      anadirExtra.mockReturnValue(of([{ ...BAILE, dia: 'lunes' }]));
      const { fixture, html } = crear(miHorario);
      abrirElFormularioExtra(html, fixture);
      llenarExtra(html, fixture);
      miHorario.mockClear();

      boton(formularioExtra(html), 'Añadir').click();
      fixture.detectChanges();

      expect(html.querySelector('.horario__extra-formulario')).toBeNull();
      expect(miHorario).toHaveBeenCalledTimes(1);
      expect(chipDelDia(html, 'Lunes').getAttribute('aria-pressed')).toBe('true');
      expect(notificador.aviso).toHaveBeenCalledWith('Añadimos la actividad a tu horario.');
    });

    it('un rechazo del servidor se muestra junto al formulario, con su mensaje, y no lo cierra', () => {
      anadirExtra.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 422, error: { detail: 'Puedes tener hasta 20 actividades extra' } })),
      );
      const { fixture, html } = crear();
      abrirElFormularioExtra(html, fixture);
      llenarExtra(html, fixture);

      boton(formularioExtra(html), 'Añadir').click();
      fixture.detectChanges();

      expect(formularioExtra(html).querySelector('[role="alert"]')?.textContent).toContain('Puedes tener hasta 20 actividades extra');
      expect(notificador.problema).not.toHaveBeenCalled();
    });

    it('una caída del servidor al añadir va a la ventana emergente', () => {
      anadirExtra.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
      const { fixture, html } = crear();
      abrirElFormularioExtra(html, fixture);
      llenarExtra(html, fixture);

      boton(formularioExtra(html), 'Añadir').click();

      expect(notificador.problema).toHaveBeenCalledWith('No pudimos guardar la actividad', expect.any(String));
    });

    it('se ve como una clase más, marcada como actividad extra, con su lugar y su responsable', () => {
      const { html } = crear(vi.fn().mockReturnValue(of(CON_EXTRA)));

      const tarjeta = html.querySelector('.horario__clase')!;

      expect(tarjeta.textContent).toContain('Baile');
      expect(tarjeta.textContent).toContain('17:00 – 19:00');
      expect(tarjeta.querySelector('.badge')?.textContent).toContain('Actividad extra');
      expect(tarjeta.textContent).toContain('Coliseo');
      expect(tarjeta.textContent).toContain('Profe Ana');
      expect(tarjeta.textContent).not.toContain('Todavía sin salón');
    });

    it('no ofrece ver lo que falta por calificar: una actividad extra no tiene notas', () => {
      const { html } = crear(vi.fn().mockReturnValue(of(CON_EXTRA)));

      expect(html.querySelector('.horario__clase')?.textContent).not.toContain('calificar');
    });

    it('los filtros avisan que con una asignatura o una sede elegida las actividades extra no se muestran', () => {
      const { html } = crear();

      expect(html.querySelector('.horario__filtros')?.textContent).toContain('actividades extra no se muestran');
    });

    it('si se añade con un filtro puesto, el aviso dice que hay que quitarlo para verla', () => {
      anadirExtra.mockReturnValue(of([{ ...BAILE, dia: 'lunes' }]));
      const { fixture, html } = crear();
      elegir(html, 'Sede', 'Fusagasugá');
      fixture.detectChanges();
      abrirElFormularioExtra(html, fixture);
      llenarExtra(html, fixture);

      boton(formularioExtra(html), 'Añadir').click();

      expect(notificador.aviso).toHaveBeenCalledWith(expect.stringContaining('Quita los filtros'));
    });

    it('abrir «Agregar una clase» cierra el formulario de la actividad extra: nunca hay dos abiertos', () => {
      const { fixture, html } = crear();
      abrirElFormularioExtra(html, fixture);

      boton(html, 'Agregar una clase').click();
      fixture.detectChanges();

      expect(html.querySelector('.horario__extra-formulario')).toBeNull();
      expect(html.querySelector('.horario__formulario')).not.toBeNull();
    });

    it('dice que hay que elegir al menos un día', () => {
      const { fixture, html } = crear();
      abrirElFormularioExtra(html, fixture);

      expect(formularioExtra(html).textContent).toContain('elige al menos un día');
    });

    it('dos actividades extra del mismo día se dibujan las dos', () => {
      const dos: Horario = { ...CON_EXTRA, totalDeClases: 2, dias: [{ dia: 'miercoles', clases: [SEMILLERO, BAILE] }] };
      const { html } = crear(vi.fn().mockReturnValue(of(dos)));

      const nombres = Array.from(html.querySelectorAll('.horario__clase .horario__asignatura')).map((n) => n.textContent?.trim());

      expect(nombres).toEqual(['Semillero', 'Baile']);
    });

    it('quitar una actividad extra pregunta antes y la quita por su propia ruta, no por la de una asignatura', async () => {
      const miHorario = vi.fn().mockReturnValue(of(CON_EXTRA));
      const { html, quitar } = crear(miHorario);
      miHorario.mockClear();

      boton(html.querySelector<HTMLElement>('.horario__clase')!, 'Quitar').click();
      await Promise.resolve();
      await Promise.resolve();

      expect(notificador.confirmar).toHaveBeenCalled();
      expect(quitarExtra).toHaveBeenCalledWith(5);
      expect(quitar).not.toHaveBeenCalled();
      expect(miHorario).toHaveBeenCalledTimes(1);
    });
  });
});

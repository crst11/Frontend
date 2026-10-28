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

  function botonDeClase(html: HTMLElement, posicion: number): HTMLButtonElement {
    return html.querySelectorAll<HTMLButtonElement>('.horario__clase button[aria-expanded]')[posicion];
  }

  it('tocar la clase despliega hacia abajo lo que falta por calificar, y tocarla otra vez la recoge', () => {
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

    botonDeClase(html, 0).click();
    fixture.detectChanges();

    expect(estructuraDe).toHaveBeenCalledWith(7);
    const panel = html.querySelector('.horario__notas')!;
    expect(panel.textContent).toContain('Te falta 1 actividad por calificar');
    expect(panel.textContent).toContain('Taller 2');
    expect(panel.textContent).not.toContain('Taller 1');
    expect(botonDeClase(html, 0).getAttribute('aria-expanded')).toBe('true');
    expect(botonDeClase(html, 0).getAttribute('aria-controls')).toBe(panel.id);

    botonDeClase(html, 0).click();
    fixture.detectChanges();

    expect(html.querySelector('.horario__notas')).toBeNull();
    expect(botonDeClase(html, 0).getAttribute('aria-expanded')).toBe('false');
  });

  it('ya no hay un botón aparte para ver lo que falta por calificar: es la propia clase', () => {
    const { fixture, html } = crear();
    chipDelDia(html, 'Lunes').click();
    fixture.detectChanges();

    expect(html.textContent).not.toContain('lo que falta por calificar');
    expect(botonDeClase(html, 0).textContent).toContain('Álgebra Lineal');
  });

  it('una clase sin actividades subidas ofrece subirlas, de vuelta aquí', () => {
    const { fixture, html } = crear();
    chipDelDia(html, 'Lunes').click();
    fixture.detectChanges();

    botonDeClase(html, 0).click();
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

  it('sin clases en el horario manda a importar el Reporte de Horario, no el reporte de notas', () => {
    const { html } = crear(vi.fn().mockReturnValue(of(VACIO)), []);

    expect(html.textContent).toContain('Reporte de Horario');
    expect(html.querySelector('a[href="/cuenta/importar-horario"]')).not.toBeNull();
    expect(html.querySelector('a[href="/cuenta/importar-reporte"]')).toBeNull();
  });

  it('con clases en el horario no repite el aviso de importar', () => {
    const { html } = crear();

    expect(html.querySelector('.notice')?.textContent ?? '').not.toContain('Reporte de Horario');
  });


  describe('lo que se puede hacer desde Mi horario', () => {
    it('arriba hay dos acciones, importar el horario y añadir una actividad extra, antes de las clases', () => {
      const { html } = crear();

      const acciones = html.querySelector('.horario__acciones-superiores')!;
      const textos = Array.from(acciones.querySelectorAll('a, button')).map((e) => e.textContent?.trim());

      expect(textos).toEqual(['Importar mi horario', 'Añadir actividad extra']);
      expect(acciones.compareDocumentPosition(html.querySelector('.horario__dias')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('no repite botones: sin armar el horario, sin agregar clases, sin filtros y con un solo importar', () => {
      const { html } = crear();

      expect(html.querySelector('a[href="/horario/armar"]')).toBeNull();
      expect(html.textContent).not.toContain('Armar mi horario');
      expect(html.textContent).not.toContain('Agregar una clase');
      expect(html.textContent).not.toContain('Filtrar y ordenar');
      expect(html.querySelector('.horario__filtros')).toBeNull();
      expect(html.querySelectorAll('a[href="/cuenta/importar-horario"]')).toHaveLength(1);
      const extras = Array.from(html.querySelectorAll('button')).filter((b) => b.textContent?.includes('actividad extra'));
      expect(extras).toHaveLength(1);
    });

    it('las clases de la universidad no se pueden quitar: llegan por el reporte', () => {
      const { fixture, html } = crear();
      chipDelDia(html, 'Lunes').click();
      fixture.detectChanges();

      expect(html.querySelectorAll('.horario__clase')).toHaveLength(2);
      expect(boton(html, 'Quitar')).toBeUndefined();
    });
  });

  describe('la vista (día o semana)', () => {
    it('abre con la vista guardada y pide el horario por hora y sin filtros, aunque haya una sede guardada', () => {
      const miPreferencia = vi.fn().mockReturnValue(of({ vista: 'semana', sede: 'Soacha', orden: 'asignatura' }));
      const miHorario = vi.fn().mockReturnValue(of(HORARIO));
      const { html } = crear(miHorario, undefined, undefined, undefined, miPreferencia);

      expect(miHorario).toHaveBeenCalledWith({ asignatura: undefined, sede: undefined, orden: 'hora' });
      expect(html.querySelectorAll('.horario__dia-semana')).toHaveLength(7);
    });

    it('si no se puede leer la preferencia abre con lo predeterminado sin decirle nada a nadie', () => {
      const miPreferencia = vi.fn().mockReturnValue(throwError(() => ({ status: 500 })));
      const { html } = crear(undefined, undefined, undefined, undefined, miPreferencia);

      expect(html.querySelector('.horario__dias')).not.toBeNull();
      expect(html.querySelector('[role="alert"]')).toBeNull();
      expect(notificador.problema).not.toHaveBeenCalled();
    });

    it('cambiar entre Día y Semana se recuerda para la próxima vez, sin botón de guardar', () => {
      const { fixture, html, guardarPreferencia } = crear();

      boton(html, 'Semana').click();
      fixture.detectChanges();

      expect(guardarPreferencia).toHaveBeenCalledWith({ vista: 'semana', sede: null, orden: 'hora' });
      expect(html.textContent).not.toContain('Guardar como mi vista');
    });

    it('si no se puede recordar la vista no se le dice nada a nadie', () => {
      const guardarPreferencia = vi.fn().mockReturnValue(throwError(() => ({ status: 500 })));
      const { fixture, html } = crear(undefined, undefined, undefined, undefined, undefined, guardarPreferencia);

      boton(html, 'Semana').click();
      fixture.detectChanges();

      expect(html.querySelectorAll('.horario__dia-semana')).toHaveLength(7);
      expect(html.querySelector('[role="alert"]')).toBeNull();
      expect(notificador.problema).not.toHaveBeenCalled();
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

    it('ofrece añadir una actividad extra aunque todavía no haya clases en el horario', () => {
      const { html } = crear(vi.fn().mockReturnValue(of(VACIO)), []);

      expect(boton(html, 'Añadir actividad extra')).toBeTruthy();
    });

    it('una actividad extra no se despliega: no tiene notas que mostrar', () => {
      const { html } = crear(vi.fn().mockReturnValue(of(CON_EXTRA)));

      expect(html.querySelectorAll('.horario__clase button[aria-expanded]')).toHaveLength(0);
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

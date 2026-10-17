import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { AvanceDeInformacion, AvanceRepository } from '../../../data-access/avance.repository';
import { ClaseDelDia, DiaRepository, MiDia } from '../../../data-access/dia.repository';
import { EvaluacionRepository } from '../../../data-access/evaluacion.repository';
import { BrujulaRepository, RiesgoDeAsignatura } from '../../../data-access/brujula.repository';
import { Pendiente, PendienteRepository } from '../../../data-access/pendiente.repository';
import { TodayScreen } from './today-screen';

describe('TodayScreen', () => {
  const notificador = { exito: vi.fn(), problema: vi.fn(), aviso: vi.fn(), confirmar: vi.fn() };

  const ECUACIONES: ClaseDelDia = {
    idMatricula: 7,
    codigoAsignatura: 'CAD1',
    asignatura: 'Ecuaciones Diferenciales',
    horaInicio: '09:00',
    horaFin: '11:00',
    salon: 'E-302',
    bloque: 'BLOQUE E',
    sede: 'Fusagasugá',
    docente: { nombres: 'Ana', apellidos: 'Gomez' },
    estado: 'proxima',
    actividades: 12,
  };
  const SISTEMAS: ClaseDelDia = {
    ...ECUACIONES,
    idMatricula: 8,
    asignatura: 'Sistemas Operativos',
    horaInicio: '15:00',
    horaFin: '18:00',
    salon: null,
    bloque: null,
    docente: null,
    estado: 'luego',
    actividades: 0,
  };

  const MARTES: MiDia = {
    hoy: '2026-10-13',
    fecha: '2026-10-13',
    dia: 'martes',
    tipo: 'lectivo',
    festivo: null,
    clases: [ECUACIONES, SISTEMAS],
    siguiente: { fecha: '2026-10-14', dia: 'miercoles', clases: [{ ...SISTEMAS, estado: 'luego' }] },
  };
  const FESTIVO: MiDia = {
    hoy: '2026-10-12',
    fecha: '2026-10-12',
    dia: 'lunes',
    tipo: 'festivo',
    festivo: 'Día de la Raza',
    clases: [],
    siguiente: { fecha: '2026-10-13', dia: 'martes', clases: [ECUACIONES, SISTEMAS] },
  };

  beforeEach(() => {
    notificador.problema.mockReset().mockResolvedValue(undefined);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const AVANCE_A_MEDIAS: AvanceDeInformacion = { porcentaje: 50, hechos: 2, total: 4, pasos: [] };

  const SIN_ACTIVIDADES = { categorias: [] };

  function crear(
    miDia = vi.fn().mockReturnValue(of(MARTES)),
    avance: AvanceDeInformacion = AVANCE_A_MEDIAS,
    estructuraDe = vi.fn().mockReturnValue(of(SIN_ACTIVIDADES)),
    pendientes: Pendiente[] = [],
    brujula: RiesgoDeAsignatura[] = [],
  ) {
    TestBed.configureTestingModule({
      imports: [TodayScreen],
      providers: [
        provideRouter([]),
        { provide: DiaRepository, useValue: { miDia } },
        { provide: AvanceRepository, useValue: { miAvance: vi.fn().mockReturnValue(of(avance)) } },
        { provide: EvaluacionRepository, useValue: { estructuraDe } },
        { provide: PendienteRepository, useValue: { listar: vi.fn().mockReturnValue(of(pendientes)) } },
        {
          provide: BrujulaRepository,
          useValue: { miBrujula: vi.fn().mockReturnValue(of({ meta: 3, umbrales: { medio: 3.5, alto: 4.5 }, asignaturas: brujula })) },
        },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    const fixture = TestBed.createComponent(TodayScreen);
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement, miDia, estructuraDe };
  }

  it('muestra la fecha de hoy y las clases que tocan con hora, salón y docente', () => {
    const { html } = crear();

    expect(html.querySelector('.hoy__fecha')?.textContent).toContain('martes 13 de octubre');
    const clases = html.querySelectorAll('.hoy__clases:not(.hoy__clases--siguiente) .hoy__clase');
    expect(clases).toHaveLength(2);
    expect(clases[0].textContent).toContain('09:00 – 11:00');
    expect(clases[0].textContent).toContain('Ecuaciones Diferenciales');
    expect(clases[0].textContent).toContain('E-302 · BLOQUE E');
    expect(clases[0].textContent).toContain('Ana Gomez');
  });

  it('destaca la clase que sigue y la que va, y apaga la que ya terminó', () => {
    const miDia = vi.fn().mockReturnValue(of({
      ...MARTES,
      clases: [
        { ...ECUACIONES, estado: 'pasada' },
        { ...SISTEMAS, estado: 'en_curso' },
        { ...SISTEMAS, idMatricula: 9, horaInicio: '19:00', horaFin: '21:00', estado: 'proxima' },
      ],
    }));
    const { html } = crear(miDia);

    expect(html.querySelector('.hoy__clase--pasada')?.textContent).toContain('Terminó');
    expect(html.querySelector('.hoy__clase--en-curso')?.textContent).toContain('En curso');
    expect(html.querySelector('.hoy__clase--proxima')?.textContent).toContain('Sigue');
  });

  it('un festivo dice que no hay clases y cuál festivo es, aunque el horario tenga clase ese día de la semana', () => {
    const { html } = crear(vi.fn().mockReturnValue(of(FESTIVO)));

    expect(html.textContent).toContain('Hoy es festivo');
    expect(html.textContent).toContain('Día de la Raza');
    expect(html.querySelector('.hoy__clases:not(.hoy__clases--siguiente)')).toBeNull();
  });

  it('un festivo muestra mañana con sus materias', () => {
    const { html } = crear(vi.fn().mockReturnValue(of(FESTIVO)));

    expect(html.querySelector('.hoy__siguiente')?.textContent).toContain('Mañana · martes 13 de octubre');
    expect(html.querySelectorAll('.hoy__clases--siguiente .hoy__clase')).toHaveLength(2);
  });

  it('si el siguiente día con clases no es mañana lo dice con su fecha', () => {
    const lejano: MiDia = { ...FESTIVO, siguiente: { fecha: '2026-10-19', dia: 'lunes', clases: [ECUACIONES] } };
    const { html } = crear(vi.fn().mockReturnValue(of(lejano)));

    expect(html.querySelector('.hoy__siguiente')?.textContent).toContain('Próximo día con clases · lunes 19 de octubre');
  });

  it('entre semestres lo dice', () => {
    const receso: MiDia = { ...FESTIVO, tipo: 'fuera_de_periodo', festivo: null, fecha: '2026-12-20', dia: 'domingo' };
    const { html } = crear(vi.fn().mockReturnValue(of(receso)));

    expect(html.textContent).toContain('Estás entre semestres');
  });

  it('un día lectivo sin clases en su horario lo dice y muestra el siguiente', () => {
    const libre: MiDia = { ...MARTES, clases: [], fecha: '2026-10-15', dia: 'jueves' };
    const { html } = crear(vi.fn().mockReturnValue(of(libre)));

    expect(html.textContent).toContain('Hoy no tienes clases');
    expect(html.querySelector('.hoy__siguiente')).not.toBeNull();
  });

  it('sin horario todavía dice que la información se verá después de subirla y lleva a subirla', () => {
    const vacio: MiDia = { ...MARTES, clases: [], siguiente: null };
    const { html } = crear(vi.fn().mockReturnValue(of(vacio)));

    expect(html.textContent).toContain('Aquí se verá tu información después de subirla');
    expect(html.querySelector('a[href="/cuenta/importar-horario"]')).not.toBeNull();
  });

  it('cada clase dice cuántas actividades tiene o que faltan por subir', () => {
    const { html } = crear();

    const clases = html.querySelectorAll('.hoy__clases:not(.hoy__clases--siguiente) .hoy__clase');
    expect(clases[0].querySelector('.hoy__actividades')?.textContent).toContain('12 actividades');
    expect(clases[1].querySelector('.hoy__actividades')?.textContent).toContain('Aún no has subido sus actividades');
  });

  it('avisa cuánta información falta y lleva a subirla', () => {
    const { html } = crear();

    const tarjeta = html.querySelector<HTMLAnchorElement>('.hoy__avance')!;
    expect(tarjeta.textContent).toContain('Tu información está al 50 %');
    expect(tarjeta.getAttribute('href')).toBe('/importar');
    expect(html.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('50');
  });

  it('con toda la información subida no muestra el aviso', () => {
    const { html } = crear(undefined, { porcentaje: 100, hechos: 4, total: 4, pasos: [] });

    expect(html.querySelector('.hoy__avance')).toBeNull();
  });

  it('tocar una clase despliega ahí mismo las actividades que le faltan por calificar, sin cambiar de pantalla', () => {
    const estructuraDe = vi.fn().mockReturnValue(
      of({
        categorias: [
          {
            consecutivo: 1,
            nombre: 'Corte 1',
            porcentaje: 30,
            origen: 'cmad',
            actividades: [
              { consecutivo: 1, nombre: 'Parcial', porcentaje: 60, fechaProgramada: '2026-10-20', nota: null },
              { consecutivo: 2, nombre: 'Quiz', porcentaje: 40, fechaProgramada: null, nota: 4.5 },
            ],
          },
        ],
      }),
    );
    const { fixture, html } = crear(undefined, undefined, estructuraDe);

    const clase = html.querySelectorAll<HTMLButtonElement>('.hoy__clase')[0];
    clase.click();
    fixture.detectChanges();

    expect(estructuraDe).toHaveBeenCalledWith(7);
    expect(clase.getAttribute('aria-expanded')).toBe('true');
    const panel = html.querySelector('.hoy__pendientes')!;
    expect(panel.textContent).toContain('Te falta 1 actividad por calificar');
    expect(panel.textContent).toContain('Parcial');
    expect(panel.textContent).toContain('20 oct');
    expect(panel.textContent).not.toContain('Quiz');
  });

  it('tocar de nuevo la clase recoge las actividades', () => {
    const { fixture, html } = crear();
    const clase = html.querySelectorAll<HTMLButtonElement>('.hoy__clase')[0];

    clase.click();
    fixture.detectChanges();
    expect(html.querySelector('.hoy__pendientes')).not.toBeNull();

    clase.click();
    fixture.detectChanges();
    expect(html.querySelector('.hoy__pendientes')).toBeNull();
    expect(clase.getAttribute('aria-expanded')).toBe('false');
  });

  it('la clase sin actividades subidas ofrece subirlas, de vuelta a Inicio', () => {
    const { fixture, html } = crear();

    html.querySelectorAll<HTMLButtonElement>('.hoy__clase')[1].click();
    fixture.detectChanges();

    const subir = html.querySelector<HTMLAnchorElement>('.hoy__pendientes a')!;
    expect(subir.textContent).toContain('Subir actividades');
    expect(subir.getAttribute('href')).toContain('/calificaciones/importar-cmad?matricula=');
  });

  it('se actualiza solo cada minuto, que es lo que cambia la clase que sigue y el día a la medianoche', () => {
    const miDia = vi.fn().mockReturnValueOnce(of(FESTIVO)).mockReturnValue(of(MARTES));
    const { fixture, html } = crear(miDia);
    expect(html.textContent).toContain('Hoy es festivo');

    vi.advanceTimersByTime(60_000);
    fixture.detectChanges();

    expect(miDia).toHaveBeenCalledTimes(2);
    expect(html.querySelector('.hoy__fecha')?.textContent).toContain('martes 13 de octubre');
    expect(html.textContent).not.toContain('Hoy es festivo');
  });

  it('al destruirse deja de preguntar', () => {
    const { fixture, miDia } = crear();

    fixture.destroy();
    vi.advanceTimersByTime(180_000);

    expect(miDia).toHaveBeenCalledTimes(1);
  });

  it('si no se puede traer el día lo dice y deja reintentar', () => {
    const miDia = vi.fn().mockReturnValueOnce(throwError(() => ({ status: 500 }))).mockReturnValue(of(MARTES));
    const { fixture, html } = crear(miDia);

    expect(html.querySelector('[role="alert"]')?.textContent).toContain('No pudimos traer tu día');
    expect(notificador.problema).toHaveBeenCalled();

    html.querySelector<HTMLButtonElement>('button.button--soft')!.click();
    fixture.detectChanges();

    expect(html.querySelector('.hoy__fecha')).not.toBeNull();
  });

  it('un tropiezo en una actualización no borra el día que ya estaba en pantalla', () => {
    const miDia = vi.fn().mockReturnValueOnce(of(MARTES)).mockReturnValue(throwError(() => ({ status: 500 })));
    const { fixture, html } = crear(miDia);

    vi.advanceTimersByTime(60_000);
    fixture.detectChanges();

    expect(html.querySelector('.hoy__fecha')).not.toBeNull();
    expect(html.querySelector('[role="alert"]')).toBeNull();
  });
  describe('pendientes por atender', () => {
    const base: Pendiente = {
      id: 1,
      titulo: 'Taller de redes',
      descripcion: null,
      fechaLimite: '2026-10-14T04:59:00Z',
      prioridad: 'alta',
      estado: 'abierto',
      situacion: 'urgente',
      idMatricula: null,
    };
    const sinEstructura = () => vi.fn().mockReturnValue(of({ categorias: [] }));

    it('muestra los vencidos y los que vencen pronto, y deja fuera los lejanos', () => {
      const { html } = crear(undefined, AVANCE_A_MEDIAS, sinEstructura(), [
        { ...base, id: 1, titulo: 'Ensayo atrasado', situacion: 'vencido' },
        base,
        { ...base, id: 3, titulo: 'Proyecto final', situacion: 'proximo' },
      ]);

      const items = html.querySelectorAll('.hoy__por-atender-item');
      expect(items).toHaveLength(2);
      expect(items[0].textContent).toContain('Ensayo atrasado');
      expect(items[0].textContent).toContain('Vencido');
      expect(items[1].textContent).toContain('Vence pronto');
      expect(html.textContent).not.toContain('Proyecto final');
    });

    it('muestra a lo sumo tres', () => {
      const cuatro = [1, 2, 3, 4].map((id) => ({ ...base, id, titulo: `Pendiente ${id}` }));
      const { html } = crear(undefined, AVANCE_A_MEDIAS, sinEstructura(), cuatro);

      expect(html.querySelectorAll('.hoy__por-atender-item')).toHaveLength(3);
    });

    it('sin pendientes por atender no muestra el bloque', () => {
      const { html } = crear();

      expect(html.querySelector('.hoy__por-atender')).toBeNull();
    });

    it('lleva a Mis pendientes', () => {
      const { html } = crear(undefined, AVANCE_A_MEDIAS, sinEstructura(), [base]);

      expect(html.querySelector<HTMLAnchorElement>('.hoy__por-atender a')?.getAttribute('href')).toBe('/pendientes');
    });
  });

  describe('Brújula Académica', () => {
    const sinEstructura = () => vi.fn().mockReturnValue(of({ categorias: [] }));
    const riesgo = (id: number, nombre: string, nivel: RiesgoDeAsignatura['nivel']): RiesgoDeAsignatura => ({
      asignatura: { idMatricula: id, nombre } as RiesgoDeAsignatura['asignatura'],
      nivel,
      motivo: 'x',
      explicacion: `Explicación de ${nombre}`,
      notaRequerida: null,
      maximoPosible: null,
    });

    it('muestra solo las asignaturas en riesgo alto o medio, con su nivel escrito y por qué', () => {
      const { html } = crear(undefined, AVANCE_A_MEDIAS, sinEstructura(), [], [
        riesgo(1, 'Cálculo', 'alto'),
        riesgo(2, 'Redes', 'medio'),
        riesgo(3, 'Física', 'bajo'),
        riesgo(4, 'Ética', 'sin_datos'),
      ]);

      const items = html.querySelectorAll('.hoy__brujula .hoy__por-atender-item');
      expect(items).toHaveLength(2);
      expect(items[0].textContent).toContain('Cálculo');
      expect(items[0].textContent).toContain('Riesgo alto');
      expect(items[0].textContent).toContain('Explicación de Cálculo');
      expect(items[1].textContent).toContain('Riesgo medio');
      expect(html.textContent).not.toContain('Física');
    });

    it('muestra a lo sumo tres', () => {
      const cuatro = [1, 2, 3, 4].map((id) => riesgo(id, `Asignatura ${id}`, 'alto'));
      const { html } = crear(undefined, AVANCE_A_MEDIAS, sinEstructura(), [], cuatro);

      expect(html.querySelectorAll('.hoy__brujula .hoy__por-atender-item')).toHaveLength(3);
    });

    it('si nada está en riesgo no muestra el bloque', () => {
      const { html } = crear(undefined, AVANCE_A_MEDIAS, sinEstructura(), [], [riesgo(1, 'Cálculo', 'bajo')]);

      expect(html.querySelector('.hoy__brujula')).toBeNull();
    });

    it('lleva a la Brújula', () => {
      const { html } = crear(undefined, AVANCE_A_MEDIAS, sinEstructura(), [], [riesgo(1, 'Cálculo', 'alto')]);

      expect(html.querySelector<HTMLAnchorElement>('.hoy__brujula a')?.getAttribute('href')).toBe('/brujula');
    });
  });
});

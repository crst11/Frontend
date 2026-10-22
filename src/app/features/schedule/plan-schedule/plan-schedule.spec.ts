import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
import {
  AsignaturaDeOferta,
  PropuestaDeHorario,
  PropuestaDeHorarioRepository,
  PropuestasDeHorario,
} from '../../../data-access/propuesta-de-horario.repository';
import { BorradorDeHorario, BorradorDeHorarioStore } from './borrador-de-horario';
import { OfertaDeLaUniversidad } from './oferta/oferta-de-la-universidad';
import { PlanSchedule } from './plan-schedule';

describe('PlanSchedule', () => {
  const PROPUESTA: PropuestaDeHorario = {
    puntaje: 100,
    elecciones: [
      {
        asignatura: 'Cálculo',
        grupo: '2',
        bloques: [
          { dia: 'miercoles', inicio: '08:00', fin: '10:00' },
          { dia: 'lunes', inicio: '08:00', fin: '10:00' },
        ],
      },
      { asignatura: 'Física', grupo: '1', bloques: [{ dia: 'lunes', inicio: '10:00', fin: '12:00' }] },
    ],
    resumen: {
      minutosEnLaManana: 360,
      minutosEnLaTarde: 0,
      minutosEnLaNoche: 0,
      minutosDeHuecos: 0,
      diasConClase: ['lunes', 'miercoles'],
      diasLibres: ['martes', 'jueves', 'viernes', 'sabado'],
    },
    motivos: ['Sin choques entre tus 2 materias.', 'El 100 % de tus horas de clase queda en la mañana.'],
  };
  const CON_PROPUESTAS: PropuestasDeHorario = { propuestas: [PROPUESTA], choques: [], mensaje: null, busquedaIncompleta: false };

  /** Lo que entrega la carga de la oferta (SCRUM-243): las materias elegidas con la hora de fin ya normalizada. */
  const ALGEBRA: AsignaturaDeOferta = {
    nombre: 'ÁLGEBRA LINEAL',
    grupos: [{ codigo: 'SIS.FUSA 101M', bloques: [{ dia: 'martes', inicio: '07:00', fin: '10:00' }] }],
  };
  const FISICA: AsignaturaDeOferta = {
    nombre: 'FISICA I',
    grupos: [{ codigo: 'SIS.FUSA 201M', bloques: [{ dia: 'jueves', inicio: '07:00', fin: '09:00' }] }],
  };

  const notificador = { problema: vi.fn(), aviso: vi.fn(), confirmar: vi.fn() };
  const repositorio = { proponer: vi.fn() };
  const almacen = { cargar: vi.fn(), guardar: vi.fn() };

  beforeEach(() => {
    notificador.problema.mockReset().mockResolvedValue(undefined);
    repositorio.proponer.mockReset().mockReturnValue(of(CON_PROPUESTAS));
    almacen.cargar.mockReset().mockResolvedValue(null);
    almacen.guardar.mockReset().mockResolvedValue(undefined);
  });

  async function crear() {
    TestBed.configureTestingModule({
      imports: [PlanSchedule],
      providers: [
        provideRouter([]),
        { provide: PropuestaDeHorarioRepository, useValue: repositorio },
        { provide: BorradorDeHorarioStore, useValue: almacen },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    const fixture = TestBed.createComponent(PlanSchedule);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement };
  }

  async function refrescar(fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Lo mismo que pasa cuando la persona sube la oferta y deja marcadas sus materias. */
  async function subirOferta(fixture: ComponentFixture<PlanSchedule>, materias: AsignaturaDeOferta[] = [ALGEBRA, FISICA]) {
    const oferta = fixture.debugElement.query(By.directive(OfertaDeLaUniversidad)).componentInstance as OfertaDeLaUniversidad;
    oferta.materiasElegidas.emit(materias);
    await refrescar(fixture);
  }

  async function crearConOferta() {
    const pantalla = await crear();
    await subirOferta(pantalla.fixture);
    return pantalla;
  }

  const boton = (html: HTMLElement, texto: string) =>
    Array.from(html.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === texto)!;

  // --- La oferta, y nada de escribir a mano ----------------------------------------------------------------

  it('empieza solo con la carga de la oferta: sin formulario de materias, sin preferencias y sin botón de proponer', async () => {
    const { html } = await crear();

    expect(html.querySelector('app-oferta-de-la-universidad')).not.toBeNull();
    expect(html.querySelector('#materia-0')).toBeNull();
    expect(html.querySelector('#armar-materias')).toBeNull();
    expect(boton(html, 'Agregar otra materia')).toBeUndefined();
    expect(html.querySelector('#armar-preferencias')).toBeNull();
    expect(boton(html, 'Proponer horarios')).toBeUndefined();
  });

  it('al elegir materias de la oferta aparecen las preferencias y el botón de proponer', async () => {
    const { html } = await crearConOferta();

    expect(html.querySelector('#armar-preferencias')).not.toBeNull();
    expect(boton(html, 'Proponer horarios')).toBeDefined();
    expect(html.querySelector('#materia-0')).toBeNull();
  });

  it('si la oferta se queda sin materias elegidas, vuelven a ocultarse', async () => {
    const { fixture, html } = await crearConOferta();

    await subirOferta(fixture, []);

    expect(html.querySelector('#armar-preferencias')).toBeNull();
    expect(boton(html, 'Proponer horarios')).toBeUndefined();
  });

  // --- Lo que se manda -------------------------------------------------------------------------------------

  it('manda al servidor las materias de la oferta y lo que se prefiere', async () => {
    const { fixture, html } = await crearConOferta();
    boton(html, 'Mañana').click();
    html.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    boton(html, 'Viernes').click();
    await refrescar(fixture);

    boton(html, 'Proponer horarios').click();

    expect(repositorio.proponer).toHaveBeenCalledWith({
      asignaturas: [ALGEBRA, FISICA],
      criterio: { franja: 'manana', pocosHuecos: true, diasLibres: ['viernes'] },
    });
  });

  it('las preferencias se pueden quitar: me da igual, y volver a tocar un día libre lo desmarca', async () => {
    const { fixture, html } = await crearConOferta();
    boton(html, 'Tarde').click();
    boton(html, 'Sábado').click();
    await refrescar(fixture);
    expect(boton(html, 'Tarde').getAttribute('aria-pressed')).toBe('true');

    boton(html, 'Me da igual').click();
    boton(html, 'Sábado').click();
    await refrescar(fixture);
    boton(html, 'Proponer horarios').click();

    expect(boton(html, 'Tarde').getAttribute('aria-pressed')).toBe('false');
    expect(repositorio.proponer.mock.calls[0][0].criterio).toEqual({ franja: null, pocosHuecos: false, diasLibres: [] });
  });

  it('cambiar las materias de la oferta borra las propuestas anteriores', async () => {
    const { fixture, html } = await crearConOferta();
    boton(html, 'Proponer horarios').click();
    await refrescar(fixture);
    expect(html.querySelectorAll('.armar__opcion').length).toBeGreaterThan(0);

    await subirOferta(fixture, [ALGEBRA]);

    expect(html.querySelectorAll('.armar__opcion')).toHaveLength(0);
  });

  // --- Lo que se muestra -----------------------------------------------------------------------------------

  it('muestra las opciones con lo que hay que matricular, la semana ordenada por día y hora, el puntaje y los motivos', async () => {
    const { fixture, html } = await crearConOferta();
    boton(html, 'Mañana').click();
    await refrescar(fixture);

    boton(html, 'Proponer horarios').click();
    await refrescar(fixture);

    const opcion = html.querySelector('.armar__opcion')!;
    expect(opcion.querySelector('.armar__opcion-titulo')!.textContent).toBe('Opción 1');
    expect(opcion.querySelector('.badge')!.textContent!.trim()).toBe('100 de 100');
    const matricula = Array.from(opcion.querySelectorAll('.armar__lista')[0].querySelectorAll('li')).map((l) => l.textContent!.trim());
    expect(matricula).toEqual(['Cálculo, grupo 2', 'Física, grupo 1']);
    const semana = Array.from(opcion.querySelectorAll('.armar__dia-resumen')).map((d) => ({
      dia: d.querySelector('.armar__dia-titulo')!.textContent!.trim(),
      clases: Array.from(d.querySelectorAll('li')).map((l) => l.textContent!.replace(/\s+/g, ' ').trim()),
    }));
    expect(semana).toEqual([
      { dia: 'Lunes', clases: ['08:00 a 10:00 Cálculo (grupo 2)', '10:00 a 12:00 Física (grupo 1)'] },
      { dia: 'Miércoles', clases: ['08:00 a 10:00 Cálculo (grupo 2)'] },
    ]);
    expect(opcion.textContent).toContain('El 100 % de tus horas de clase queda en la mañana.');
  });

  it('sin preferencias el puntaje no se muestra: todas valen lo mismo', async () => {
    const { fixture, html } = await crearConOferta();

    boton(html, 'Proponer horarios').click();
    await refrescar(fixture);

    expect(html.querySelector('.armar__opcion')).not.toBeNull();
    expect(html.querySelector('.badge')).toBeNull();
  });

  it('si no hay ninguna combinación muestra el motivo que escribió el servidor', async () => {
    repositorio.proponer.mockReturnValue(
      of({
        propuestas: [],
        choques: [{ asignatura: 'Cálculo', otra: 'Física' }],
        mensaje: 'No hay combinación sin choques. «Cálculo» y «Física»: todos sus grupos chocan.',
        busquedaIncompleta: false,
      }),
    );
    const { fixture, html } = await crearConOferta();

    boton(html, 'Proponer horarios').click();
    await refrescar(fixture);

    expect(html.querySelector('.armar__opcion')).toBeNull();
    expect(html.querySelector('[role="alert"]')!.textContent).toContain('todos sus grupos chocan');
  });

  it('avisa cuando la búsqueda se cortó por ser demasiado grande', async () => {
    repositorio.proponer.mockReturnValue(of({ ...CON_PROPUESTAS, busquedaIncompleta: true }));
    const { fixture, html } = await crearConOferta();

    boton(html, 'Proponer horarios').click();
    await refrescar(fixture);

    expect(html.querySelector('.notice')!.textContent).toContain('La búsqueda se cortó');
  });

  // --- Errores ---------------------------------------------------------------------------------------------

  it('si el servidor rechaza lo enviado, muestra su explicación', async () => {
    repositorio.proponer.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { detail: 'La materia no puede tener más de 20 grupos' } })),
    );
    const { fixture, html } = await crearConOferta();

    boton(html, 'Proponer horarios').click();
    await refrescar(fixture);

    expect(html.querySelector('[role="alert"]')!.textContent).toContain('más de 20 grupos');
    expect(notificador.problema).not.toHaveBeenCalled();
  });

  it('si el cuerpo no se puede leer (400) pide revisar las horas', async () => {
    repositorio.proponer.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400 })));
    const { fixture, html } = await crearConOferta();

    boton(html, 'Proponer horarios').click();
    await refrescar(fixture);

    expect(html.querySelector('[role="alert"]')!.textContent).toContain('las horas van como 08:00');
  });

  it('sin conexión con el servidor lo dice con la ventana de falla del sistema y en pantalla', async () => {
    repositorio.proponer.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    const { fixture, html } = await crearConOferta();

    boton(html, 'Proponer horarios').click();
    await refrescar(fixture);

    expect(notificador.problema).toHaveBeenCalledWith('No pudimos armar tu horario', expect.stringContaining('conexión'));
    expect(html.querySelector('[role="alert"]')!.textContent).toContain('conexión');
  });

  it('mientras busca no deja pedir otra vez', async () => {
    let terminar: (r: PropuestasDeHorario) => void = () => undefined;
    repositorio.proponer.mockReturnValue(
      new Observable<PropuestasDeHorario>((suscriptor) => {
        terminar = (r) => {
          suscriptor.next(r);
          suscriptor.complete();
        };
      }),
    );
    const { fixture, html } = await crearConOferta();

    boton(html, 'Proponer horarios').click();
    await refrescar(fixture);

    expect(boton(html, 'Buscando combinaciones…').disabled).toBe(true);
    boton(html, 'Buscando combinaciones…').click();
    expect(repositorio.proponer).toHaveBeenCalledTimes(1);
    terminar(CON_PROPUESTAS);
  });

  // --- Borrador --------------------------------------------------------------------------------------------

  it('recupera las preferencias guardadas al abrir la pantalla, no la oferta', async () => {
    const guardado: BorradorDeHorario = { asignaturas: [], franja: 'tarde', pocosHuecos: true, diasLibres: ['viernes'] };
    almacen.cargar.mockResolvedValue(guardado);

    const { fixture, html } = await crear();
    await subirOferta(fixture);

    expect(boton(html, 'Tarde').getAttribute('aria-pressed')).toBe('true');
    expect(html.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true);
    expect(boton(html, 'Viernes').getAttribute('aria-pressed')).toBe('true');
  });

  it('guarda las preferencias tras una pausa, sin la oferta, y no una vez por toque', async () => {
    vi.useFakeTimers();
    try {
      const { fixture, html } = await crearConOferta();

      boton(html, 'Mañana').click();
      boton(html, 'Tarde').click();
      fixture.detectChanges();
      expect(almacen.guardar).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(600);

      expect(almacen.guardar).toHaveBeenCalledTimes(1);
      expect(almacen.guardar.mock.calls[0][0]).toEqual({
        asignaturas: [],
        franja: 'tarde',
        pocosHuecos: false,
        diasLibres: [],
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

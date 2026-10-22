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

  const boton = (html: HTMLElement, texto: string) =>
    Array.from(html.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === texto)!;

  function escribir(html: HTMLElement, selector: string, valor: string) {
    const campo = html.querySelector<HTMLInputElement>(selector)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  function cambiar(html: HTMLElement, selector: string, valor: string) {
    const campo = html.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('change'));
  }

  async function refrescar(fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  // --- Escribir la oferta ----------------------------------------------------------------------------------

  it('empieza con una materia, un grupo y un bloque listos para escribir', async () => {
    const { html } = await crear();

    expect(html.querySelector('#materia-0')).not.toBeNull();
    expect(html.querySelector('#grupo-0-0')).not.toBeNull();
    expect(html.querySelectorAll('select.armar__dia')).toHaveLength(1);
    expect(html.querySelectorAll('input[type="time"]')).toHaveLength(2);
    expect(html.querySelector('input[type="time"]')!.getAttribute('aria-label')).toBe('Hora de inicio');
  });

  it('agrega y quita materias, grupos y bloques, y no deja quitar lo último que queda', async () => {
    const { fixture, html } = await crear();

    expect(boton(html, 'Quitar materia')).toBeUndefined();
    expect(boton(html, 'Quitar grupo')).toBeUndefined();
    expect(html.querySelector('[aria-label="Quitar este bloque"]')).toBeNull();

    boton(html, 'Agregar otra materia').click();
    boton(html, 'Agregar otro grupo').click();
    boton(html, 'Agregar otro día de este grupo').click();
    await refrescar(fixture);

    expect(html.querySelectorAll('.armar__materia')).toHaveLength(2);
    expect(html.querySelectorAll('.armar__grupo')).toHaveLength(3);
    expect(html.querySelectorAll('select.armar__dia')).toHaveLength(4);

    html.querySelector<HTMLButtonElement>('[aria-label="Quitar este bloque"]')!.click();
    boton(html, 'Quitar grupo').click();
    boton(html, 'Quitar materia').click();
    await refrescar(fixture);

    expect(html.querySelectorAll('.armar__materia')).toHaveLength(1);
    expect(html.querySelectorAll('.armar__grupo')).toHaveLength(1);
    expect(html.querySelectorAll('select.armar__dia')).toHaveLength(1);
  });

  it('apaga los botones de agregar al llegar a los máximos del servidor', async () => {
    const { fixture, html } = await crear();

    for (let n = 0; n < 9; n++) {
      boton(html, 'Agregar otra materia').click();
      await refrescar(fixture);
    }

    expect(html.querySelectorAll('.armar__materia')).toHaveLength(10);
    expect(boton(html, 'Agregar otra materia').disabled).toBe(true);
  });

  // --- La oferta de la universidad (SCRUM-243) -------------------------------------------------------------

  const ALGEBRA: AsignaturaDeOferta = {
    nombre: 'ÁLGEBRA LINEAL',
    grupos: [{ codigo: 'SIS.FUSA 101M', bloques: [{ dia: 'martes', inicio: '07:00', fin: '10:00' }] }],
  };

  function subirOferta(fixture: ComponentFixture<PlanSchedule>, materias: AsignaturaDeOferta[]) {
    const oferta = fixture.debugElement.query(By.directive(OfertaDeLaUniversidad)).componentInstance as OfertaDeLaUniversidad;
    oferta.materiasElegidas.emit(materias);
  }

  it('la oferta que se sube llena las materias y se manda a proponer con el fin ya normalizado', async () => {
    const { fixture, html } = await crear();

    subirOferta(fixture, [ALGEBRA]);
    await refrescar(fixture);

    expect(html.querySelector<HTMLInputElement>('#materia-0')!.value).toBe('ÁLGEBRA LINEAL');
    expect(html.querySelector<HTMLInputElement>('#grupo-0-0')!.value).toBe('SIS.FUSA 101M');
    boton(html, 'Proponer horarios').click();
    expect(repositorio.proponer).toHaveBeenCalledWith({
      asignaturas: [ALGEBRA],
      criterio: { franja: null, pocosHuecos: false, diasLibres: [] },
    });
  });

  it('usar la oferta reemplaza las propuestas anteriores y guarda el borrador', async () => {
    vi.useFakeTimers();
    try {
      const { fixture, html } = await crear();
      boton(html, 'Proponer horarios').click();
      await refrescar(fixture);
      expect(html.querySelectorAll('.armar__opcion').length).toBeGreaterThan(0);

      subirOferta(fixture, [ALGEBRA]);
      await vi.advanceTimersByTimeAsync(600);
      fixture.detectChanges();

      expect(html.querySelectorAll('.armar__opcion')).toHaveLength(0);
      expect(almacen.guardar).toHaveBeenCalledTimes(1);
      expect(almacen.guardar.mock.calls[0][0].asignaturas).toEqual([ALGEBRA]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('el paso de escribir a mano sigue disponible', async () => {
    const { html } = await crear();

    expect(html.querySelector('app-oferta-de-la-universidad')).not.toBeNull();
    expect(html.querySelector('#armar-materias')).not.toBeNull();
    expect(boton(html, 'Agregar otra materia').disabled).toBe(false);
  });

  it('el tope de grupos de la pantalla es 20 y el código de grupo admite 30 caracteres', async () => {
    const { fixture, html } = await crear();
    expect(html.querySelector('#grupo-0-0')!.getAttribute('maxlength')).toBe('30');

    for (let n = 0; n < 19; n++) {
      boton(html, 'Agregar otro grupo').click();
      await refrescar(fixture);
    }

    expect(html.querySelectorAll('.armar__grupo')).toHaveLength(20);
    expect(boton(html, 'Agregar otro grupo').disabled).toBe(true);
  });

  // --- Lo que se manda -------------------------------------------------------------------------------------

  it('manda al servidor lo escrito y lo que se prefiere, sin espacios sobrantes', async () => {
    const { fixture, html } = await crear();
    escribir(html, '#materia-0', '  Cálculo ');
    escribir(html, '#grupo-0-0', ' 2 ');
    cambiar(html, 'select.armar__dia', 'miercoles');
    cambiar(html, 'input[aria-label="Hora de inicio"]', '07:00');
    cambiar(html, 'input[aria-label="Hora de fin"]', '09:00');
    boton(html, 'Mañana').click();
    html.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    boton(html, 'Viernes').click();
    await refrescar(fixture);

    boton(html, 'Proponer horarios').click();

    expect(repositorio.proponer).toHaveBeenCalledWith({
      asignaturas: [
        { nombre: 'Cálculo', grupos: [{ codigo: '2', bloques: [{ dia: 'miercoles', inicio: '07:00', fin: '09:00' }] }] },
      ],
      criterio: { franja: 'manana', pocosHuecos: true, diasLibres: ['viernes'] },
    });
  });

  it('las preferencias se pueden quitar: me da igual, y volver a tocar un día libre lo desmarca', async () => {
    const { fixture, html } = await crear();
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

  // --- Lo que se muestra -----------------------------------------------------------------------------------

  it('muestra las opciones con lo que hay que matricular, la semana ordenada por día y hora, el puntaje y los motivos', async () => {
    const { fixture, html } = await crear();
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
    const { fixture, html } = await crear();

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
    const { fixture, html } = await crear();

    boton(html, 'Proponer horarios').click();
    await refrescar(fixture);

    expect(html.querySelector('.armar__opcion')).toBeNull();
    expect(html.querySelector('[role="alert"]')!.textContent).toContain('todos sus grupos chocan');
  });

  it('avisa cuando la búsqueda se cortó por ser demasiado grande', async () => {
    repositorio.proponer.mockReturnValue(of({ ...CON_PROPUESTAS, busquedaIncompleta: true }));
    const { fixture, html } = await crear();

    boton(html, 'Proponer horarios').click();
    await refrescar(fixture);

    expect(html.querySelector('.notice')!.textContent).toContain('La búsqueda se cortó');
  });

  // --- Errores ---------------------------------------------------------------------------------------------

  it('si el servidor rechaza lo escrito, muestra su explicación', async () => {
    repositorio.proponer.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { detail: 'Falta el nombre de la asignatura' } })),
    );
    const { fixture, html } = await crear();

    boton(html, 'Proponer horarios').click();
    await refrescar(fixture);

    expect(html.querySelector('[role="alert"]')!.textContent).toContain('Falta el nombre de la asignatura');
    expect(notificador.problema).not.toHaveBeenCalled();
  });

  it('si el cuerpo no se puede leer (400) pide revisar las horas', async () => {
    repositorio.proponer.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400 })));
    const { fixture, html } = await crear();

    boton(html, 'Proponer horarios').click();
    await refrescar(fixture);

    expect(html.querySelector('[role="alert"]')!.textContent).toContain('las horas van como 08:00');
  });

  it('sin conexión con el servidor lo dice con la ventana de falla del sistema y en pantalla', async () => {
    repositorio.proponer.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    const { fixture, html } = await crear();

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
    const { fixture, html } = await crear();

    boton(html, 'Proponer horarios').click();
    await refrescar(fixture);

    expect(boton(html, 'Buscando combinaciones…').disabled).toBe(true);
    boton(html, 'Buscando combinaciones…').click();
    expect(repositorio.proponer).toHaveBeenCalledTimes(1);
    terminar(CON_PROPUESTAS);
  });

  // --- Borrador --------------------------------------------------------------------------------------------

  it('recupera el borrador guardado al abrir la pantalla', async () => {
    const guardado: BorradorDeHorario = {
      asignaturas: [
        { nombre: 'Redes', grupos: [{ codigo: '3', bloques: [{ dia: 'jueves', inicio: '14:00', fin: '16:00' }] }] },
      ],
      franja: 'tarde',
      pocosHuecos: true,
      diasLibres: ['viernes'],
    };
    almacen.cargar.mockResolvedValue(guardado);

    const { html } = await crear();

    expect(html.querySelector<HTMLInputElement>('#materia-0')!.value).toBe('Redes');
    expect(html.querySelector<HTMLInputElement>('#grupo-0-0')!.value).toBe('3');
    expect(html.querySelector<HTMLSelectElement>('select.armar__dia')!.value).toBe('jueves');
    expect(boton(html, 'Tarde').getAttribute('aria-pressed')).toBe('true');
    expect(html.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true);
    expect(boton(html, 'Viernes').getAttribute('aria-pressed')).toBe('true');
  });

  it('guarda el borrador tras una pausa al escribir, y no una vez por letra', async () => {
    vi.useFakeTimers();
    try {
      const { html } = await crear();

      escribir(html, '#materia-0', 'C');
      escribir(html, '#materia-0', 'Cá');
      escribir(html, '#materia-0', 'Cálculo');
      expect(almacen.guardar).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(600);

      expect(almacen.guardar).toHaveBeenCalledTimes(1);
      expect(almacen.guardar.mock.calls[0][0].asignaturas[0].nombre).toBe('Cálculo');
    } finally {
      vi.useRealTimers();
    }
  });
});

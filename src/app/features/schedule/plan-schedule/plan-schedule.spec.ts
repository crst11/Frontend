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
import { VerificacionDeCambio, VerificacionDeCambioRepository } from '../../../data-access/verificacion-de-cambio.repository';
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
      diasLiberados: ['viernes', 'sabado'],
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

  /** Las materias de la propuesta, tal como salen de la oferta: Cálculo con tres grupos y Física con uno. */
  const CALCULO_OFERTA: AsignaturaDeOferta = {
    nombre: 'Cálculo',
    grupos: [
      {
        codigo: '2',
        bloques: [
          { dia: 'miercoles', inicio: '08:00', fin: '10:00' },
          { dia: 'lunes', inicio: '08:00', fin: '10:00' },
        ],
      },
      { codigo: '1', bloques: [{ dia: 'martes', inicio: '08:00', fin: '10:00' }] },
      { codigo: '3', bloques: [{ dia: 'lunes', inicio: '10:00', fin: '12:00' }] },
    ],
  };
  const FISICA_OFERTA: AsignaturaDeOferta = {
    nombre: 'Física',
    grupos: [{ codigo: '1', bloques: [{ dia: 'lunes', inicio: '10:00', fin: '12:00' }] }],
  };
  /** Lo que responde el servidor al probar los grupos 1 (cabe) y 3 (choca con Física) de Cálculo. */
  const OTROS_GRUPOS: VerificacionDeCambio = {
    candidatos: [
      { grupo: '1', cabe: true, choques: [] },
      { grupo: '3', cabe: false, choques: [{ asignatura: 'Física', grupo: '1', dia: 'lunes', inicio: '10:00', fin: '12:00' }] },
    ],
  };

  const notificador = { problema: vi.fn(), aviso: vi.fn(), confirmar: vi.fn() };
  const repositorio = { proponer: vi.fn() };
  const verificacion = { verificar: vi.fn() };
  const almacen = { cargar: vi.fn(), guardar: vi.fn() };

  beforeEach(() => {
    notificador.problema.mockReset().mockResolvedValue(undefined);
    repositorio.proponer.mockReset().mockReturnValue(of(CON_PROPUESTAS));
    verificacion.verificar.mockReset().mockReturnValue(of(OTROS_GRUPOS));
    almacen.cargar.mockReset().mockResolvedValue(null);
    almacen.guardar.mockReset().mockResolvedValue(undefined);
  });

  async function crear() {
    TestBed.configureTestingModule({
      imports: [PlanSchedule],
      providers: [
        provideRouter([]),
        { provide: PropuestaDeHorarioRepository, useValue: repositorio },
        { provide: VerificacionDeCambioRepository, useValue: verificacion },
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
    boton(html, 'Quiero tener un día libre').click();
    await refrescar(fixture);

    boton(html, 'Proponer horarios').click();

    expect(repositorio.proponer).toHaveBeenCalledWith({
      asignaturas: [ALGEBRA, FISICA],
      criterio: { franja: 'manana', pocosHuecos: true, diasLibres: [], diaLibre: true },
    });
  });

  it('las preferencias se pueden quitar: me da igual, y volver a tocar el día libre lo desmarca', async () => {
    const { fixture, html } = await crearConOferta();
    boton(html, 'Tarde').click();
    boton(html, 'Quiero tener un día libre').click();
    await refrescar(fixture);
    expect(boton(html, 'Tarde').getAttribute('aria-pressed')).toBe('true');

    boton(html, 'Me da igual').click();
    boton(html, 'Quiero tener un día libre').click();
    await refrescar(fixture);
    boton(html, 'Proponer horarios').click();

    expect(boton(html, 'Tarde').getAttribute('aria-pressed')).toBe('false');
    expect(repositorio.proponer.mock.calls[0][0].criterio).toEqual({
      franja: null,
      pocosHuecos: false,
      diasLibres: [],
      diaLibre: false,
    });
  });

  // --- «Quiero tener un día libre» (SCRUM-251) ---------------------------------------------------------------

  const QUIERO_UN_DIA_LIBRE = 'Quiero tener un día libre';

  it('ofrece un solo botón de día libre en lugar de elegir cuáles días', async () => {
    const { html } = await crearConOferta();

    expect(boton(html, QUIERO_UN_DIA_LIBRE).getAttribute('aria-pressed')).toBe('false');
    expect(html.querySelector('#armar-libres')).toBeNull();
    expect(boton(html, 'Viernes')).toBeUndefined();
  });

  it('al activarlo manda diaLibre verdadero y sin días libres sueltos', async () => {
    const { fixture, html } = await crearConOferta();

    boton(html, QUIERO_UN_DIA_LIBRE).click();
    await refrescar(fixture);
    expect(boton(html, QUIERO_UN_DIA_LIBRE).getAttribute('aria-pressed')).toBe('true');
    boton(html, 'Proponer horarios').click();

    expect(repositorio.proponer.mock.calls[0][0].criterio).toEqual({
      franja: null,
      pocosHuecos: false,
      diasLibres: [],
      diaLibre: true,
    });
  });

  it('cada opción dice qué días quedan libres', async () => {
    const { fixture, html } = await crearConOferta();
    boton(html, QUIERO_UN_DIA_LIBRE).click();
    await refrescar(fixture);

    boton(html, 'Proponer horarios').click();
    await refrescar(fixture);

    expect(html.querySelector('.armar__libres')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('Días libres: viernes y sábado');
  });

  it('sin el modo no muestra la línea de días libres', async () => {
    const { fixture, html } = await crearConOferta();

    boton(html, 'Proponer horarios').click();
    await refrescar(fixture);

    expect(html.querySelector('.armar__libres')).toBeNull();
  });

  it('una opción a la que se le cambió un grupo deja de decir los días libres', async () => {
    const pantalla = await crear();
    await subirOferta(pantalla.fixture, [CALCULO_OFERTA, FISICA_OFERTA]);
    const { fixture, html } = pantalla;
    boton(html, QUIERO_UN_DIA_LIBRE).click();
    await refrescar(fixture);
    boton(html, 'Proponer horarios').click();
    await refrescar(fixture);
    expect(html.querySelector('.armar__libres')).not.toBeNull();

    cambiarGrupoDe(html, 'Cálculo').click();
    await refrescar(fixture);
    html.querySelector<HTMLButtonElement>('.armar__candidato button')!.click();
    await refrescar(fixture);

    expect(html.querySelector('.armar__libres')).toBeNull();
  });

  it('si ningún día se puede liberar muestra el mensaje del servidor', async () => {
    repositorio.proponer.mockReturnValue(
      of({
        propuestas: [],
        choques: [],
        mensaje: 'Con estas materias no se puede dejar ningún día libre: quita la marca.',
        busquedaIncompleta: false,
      }),
    );
    const { fixture, html } = await crearConOferta();
    boton(html, QUIERO_UN_DIA_LIBRE).click();
    await refrescar(fixture);

    boton(html, 'Proponer horarios').click();
    await refrescar(fixture);

    expect(html.querySelector('[role="alert"]')!.textContent).toContain('no se puede dejar ningún día libre');
  });

  it('cambiar las materias de la oferta borra las propuestas anteriores', async () => {
    const { fixture, html } = await crearConOferta();
    boton(html, 'Proponer horarios').click();
    await refrescar(fixture);
    expect(html.querySelectorAll('.armar__opcion').length).toBeGreaterThan(0);

    await subirOferta(fixture, [ALGEBRA]);

    expect(html.querySelectorAll('.armar__opcion')).toHaveLength(0);
  });

  // --- Cambiar grupo de una materia de la opción ---------------------------------------------------------

  async function conOpcion() {
    const pantalla = await crear();
    await subirOferta(pantalla.fixture, [CALCULO_OFERTA, FISICA_OFERTA]);
    boton(pantalla.html, 'Proponer horarios').click();
    await refrescar(pantalla.fixture);
    return pantalla;
  }

  const cambiarGrupoDe = (html: HTMLElement, materia: string) =>
    Array.from(html.querySelectorAll<HTMLButtonElement>('.armar__cambiar')).find((b) =>
      b.getAttribute('aria-label')?.includes(materia),
    )!;
  const matriculaDeLaOpcion = (html: HTMLElement) =>
    Array.from(html.querySelectorAll('.armar__opcion .armar__eleccion-texto')).map((l) => l.textContent!.trim());

  it('cada materia de una opción trae el botón para cambiar su grupo', async () => {
    const { html } = await conOpcion();

    const botones = Array.from(html.querySelectorAll<HTMLButtonElement>('.armar__cambiar'));
    expect(botones.map((b) => b.getAttribute('aria-label'))).toEqual(['Cambiar grupo de Cálculo', 'Cambiar grupo de Física']);
    expect(botones.every((b) => b.getAttribute('aria-expanded') === 'false')).toBe(true);
  });

  it('al tocarlo manda el horario de esa opción y los otros grupos de la materia al servidor', async () => {
    const { fixture, html } = await conOpcion();

    cambiarGrupoDe(html, 'Cálculo').click();
    await refrescar(fixture);

    expect(verificacion.verificar).toHaveBeenCalledWith({
      horario: [
        { asignatura: 'Cálculo', grupo: { codigo: '2', bloques: PROPUESTA.elecciones[0].bloques } },
        { asignatura: 'Física', grupo: { codigo: '1', bloques: PROPUESTA.elecciones[1].bloques } },
      ],
      asignaturaACambiar: 'Cálculo',
      candidatos: [CALCULO_OFERTA.grupos[1], CALCULO_OFERTA.grupos[2]],
    });
    expect(cambiarGrupoDe(html, 'Cálculo').getAttribute('aria-expanded')).toBe('true');
  });

  it('un grupo que cabe se ofrece con «Usar este grupo»; uno que choca dice con cuál materia, grupo, día y hora y no se puede elegir', async () => {
    const { fixture, html } = await conOpcion();

    cambiarGrupoDe(html, 'Cálculo').click();
    await refrescar(fixture);

    const candidatos = Array.from(html.querySelectorAll('.armar__candidato'));
    expect(candidatos.length).toBe(2);
    expect(candidatos[0].textContent).toContain('Grupo 1');
    expect(candidatos[0].textContent).toContain('martes de 08:00 a 10:00');
    expect(candidatos[0].textContent).toContain('Cabe');
    expect(candidatos[0].querySelector('button')!.textContent!.trim()).toBe('Usar este grupo');
    expect(candidatos[1].textContent).toContain('Grupo 3');
    expect(candidatos[1].textContent).toContain('No puedes elegirlo: choca con Física (grupo 1), lunes de 10:00 a 12:00');
    expect(candidatos[1].querySelector('button')).toBeNull();
  });

  it('«Usar este grupo» reemplaza el grupo, y la opción deja de mostrar el puntaje y los motivos de la sugerencia', async () => {
    const { fixture, html } = await conOpcion();
    cambiarGrupoDe(html, 'Cálculo').click();
    await refrescar(fixture);

    html.querySelector<HTMLButtonElement>('.armar__candidato button')!.click();
    await refrescar(fixture);

    expect(matriculaDeLaOpcion(html)).toEqual(['Cálculo, grupo 1', 'Física, grupo 1']);
    const semana = Array.from(html.querySelectorAll('.armar__dia-resumen')).map((d) => ({
      dia: d.querySelector('.armar__dia-titulo')!.textContent!.trim(),
      clases: Array.from(d.querySelectorAll('li')).map((l) => l.textContent!.replace(/\s+/g, ' ').trim()),
    }));
    expect(semana).toEqual([
      { dia: 'Lunes', clases: ['10:00 a 12:00 Física (grupo 1)'] },
      { dia: 'Martes', clases: ['08:00 a 10:00 Cálculo (grupo 1)'] },
    ]);
    expect(html.querySelector('.badge')).toBeNull();
    expect(html.querySelector('.armar__opcion')!.textContent).not.toContain('Sin choques entre tus 2 materias.');
    expect(html.querySelector('.armar__editada')!.textContent).toContain('Cambiaste');
    expect(html.querySelector('.armar__candidato')).toBeNull();
  });

  it('después de un cambio, el siguiente se verifica contra el horario ya cambiado', async () => {
    const { fixture, html } = await conOpcion();
    cambiarGrupoDe(html, 'Cálculo').click();
    await refrescar(fixture);
    html.querySelector<HTMLButtonElement>('.armar__candidato button')!.click();
    await refrescar(fixture);

    cambiarGrupoDe(html, 'Cálculo').click();
    await refrescar(fixture);

    const ultimo = verificacion.verificar.mock.calls.at(-1)![0];
    expect(ultimo.horario[0]).toEqual({ asignatura: 'Cálculo', grupo: { codigo: '1', bloques: CALCULO_OFERTA.grupos[1].bloques } });
    expect(ultimo.candidatos.map((g: { codigo: string }) => g.codigo)).toEqual(['2', '3']);
  });

  it('una materia con un solo grupo en la oferta lo dice sin llamar al servidor', async () => {
    const { fixture, html } = await conOpcion();

    cambiarGrupoDe(html, 'Física').click();
    await refrescar(fixture);

    expect(verificacion.verificar).not.toHaveBeenCalled();
    expect(html.querySelector('.armar__cambio')!.textContent).toContain('solo tiene un grupo');
  });

  it('volver a tocar el botón cierra el panel', async () => {
    const { fixture, html } = await conOpcion();
    cambiarGrupoDe(html, 'Cálculo').click();
    await refrescar(fixture);

    cambiarGrupoDe(html, 'Cálculo').click();
    await refrescar(fixture);

    expect(html.querySelector('.armar__cambio')).toBeNull();
    expect(cambiarGrupoDe(html, 'Cálculo').getAttribute('aria-expanded')).toBe('false');
  });

  it('si el servidor falla al verificar, lo dice en el panel y la opción sigue igual', async () => {
    verificacion.verificar.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { detail: 'Falta al menos un grupo para probar' } })),
    );
    const { fixture, html } = await conOpcion();

    cambiarGrupoDe(html, 'Cálculo').click();
    await refrescar(fixture);

    expect(html.querySelector('.armar__cambio [role="alert"]')!.textContent).toContain('Falta al menos un grupo para probar');
    expect(matriculaDeLaOpcion(html)).toEqual(['Cálculo, grupo 2', 'Física, grupo 1']);
  });

  it('sin conexión al verificar, usa el aviso de falla del sistema y no pierde la opción', async () => {
    verificacion.verificar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    const { fixture, html } = await conOpcion();

    cambiarGrupoDe(html, 'Cálculo').click();
    await refrescar(fixture);

    expect(notificador.problema).toHaveBeenCalled();
    expect(html.querySelector('.armar__cambio [role="alert"]')!.textContent).toContain('No logramos comunicarnos');
    expect(html.querySelector('.armar__opcion')).not.toBeNull();
  });

  it('proponer de nuevo borra los cambios y cierra el panel', async () => {
    const { fixture, html } = await conOpcion();
    cambiarGrupoDe(html, 'Cálculo').click();
    await refrescar(fixture);
    html.querySelector<HTMLButtonElement>('.armar__candidato button')!.click();
    await refrescar(fixture);

    boton(html, 'Proponer horarios').click();
    await refrescar(fixture);

    expect(matriculaDeLaOpcion(html)).toEqual(['Cálculo, grupo 2', 'Física, grupo 1']);
    expect(html.querySelector('.armar__editada')).toBeNull();
    expect(html.querySelector('.armar__cambio')).toBeNull();
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
    const matricula = Array.from(opcion.querySelectorAll('.armar__eleccion-texto')).map((l) => l.textContent!.trim());
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
    const guardado: BorradorDeHorario = { asignaturas: [], franja: 'tarde', pocosHuecos: true, diaLibre: true };
    almacen.cargar.mockResolvedValue(guardado);

    const { fixture, html } = await crear();
    await subirOferta(fixture);

    expect(boton(html, 'Tarde').getAttribute('aria-pressed')).toBe('true');
    expect(html.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true);
    expect(boton(html, 'Quiero tener un día libre').getAttribute('aria-pressed')).toBe('true');
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
        diaLibre: false,
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

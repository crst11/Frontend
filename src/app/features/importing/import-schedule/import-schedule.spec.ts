import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
import {
  AnalisisDeHorario,
  ImportacionDeHorarioRepository,
} from '../../../data-access/importacion-de-horario.repository';
import { ImportSchedule } from './import-schedule';

describe('ImportSchedule', () => {
  const notificador = { exito: vi.fn(), problema: vi.fn(), aviso: vi.fn(), confirmar: vi.fn() };

  const DETECTADO: AnalisisDeHorario = {
    nombreArchivo: 'horario.pdf',
    programaDelReporte: 'INGENIERIA DE SISTEMAS Y COMPUTACION',
    sedeDelReporte: 'FUSAGASUGÁ',
    coincideConMiPrograma: true,
    periodo: '2026-2',
    detectadas: 3,
    clases: 3,
    seVanAGuardar: 2,
    asignaturas: [
      {
        codigo: 'CAD612021519',
        nombre: 'Ecuaciones Diferenciales',
        grupo: 'SIS.FUSA 501M',
        enElPlan: true,
        yaEstaba: false,
        clasesQueTiene: 0,
        clases: [
          {
            dia: 'martes',
            horaInicio: '09:00',
            horaFin: '11:00',
            salon: 'E-302',
            bloque: 'BLOQUE E- CLAUSTRO ACADÉMICO',
            sede: 'CAMPUS UNIVERSITARIO DE FUSAGASUGA',
            docente: { nombres: 'Ana Maria', apellidos: 'Gomez Ruiz' },
          },
          { dia: 'miercoles', horaInicio: '07:00', horaFin: '09:00', salon: null, bloque: null, sede: null, docente: null },
        ],
      },
      {
        codigo: 'CAD612021520',
        nombre: 'Sistemas Operativos',
        grupo: null,
        enElPlan: true,
        yaEstaba: true,
        clasesQueTiene: 2,
        clases: [{ dia: 'jueves', horaInicio: '15:00', horaFin: '18:00', salon: 'A-102', bloque: null, sede: null, docente: null }],
      },
      { codigo: 'XXX', nombre: 'XXX', grupo: null, enElPlan: false, yaEstaba: false, clasesQueTiene: 0, clases: [] },
    ],
  };

  beforeEach(() => {
    notificador.exito.mockReset().mockResolvedValue(undefined);
    notificador.problema.mockReset().mockResolvedValue(undefined);
  });

  function crear(
    analizar = vi.fn().mockReturnValue(of(DETECTADO)),
    confirmar = vi.fn().mockReturnValue(of({ nuevas: 1, actualizadas: 1, omitidas: 1, clases: 3 })),
    estadoDeLaNavegacion: unknown = {},
  ) {
    TestBed.configureTestingModule({
      imports: [ImportSchedule],
      providers: [
        provideRouter([]),
        { provide: ImportacionDeHorarioRepository, useValue: { analizar, confirmar } },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    vi.spyOn(TestBed.inject(Location), 'getState').mockReturnValue(estadoDeLaNavegacion);
    const fixture = TestBed.createComponent(ImportSchedule);
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement, analizar, confirmar, navegar };
  }

  function boton(html: HTMLElement, texto: string): HTMLButtonElement {
    return Array.from(html.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes(texto))!;
  }

  function subir(fixture: ReturnType<typeof crear>['fixture'], html: HTMLElement) {
    const entrada = html.querySelector<HTMLInputElement>('input[type="file"]')!;
    const archivo = new File(['%PDF-1.4'], 'horario.pdf', { type: 'application/pdf' });
    Object.defineProperty(entrada, 'files', { value: [archivo], configurable: true });
    entrada.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('empieza pidiendo el Reporte de Horario y dice cuál es, sin confundirlo con el de notas', () => {
    const { html } = crear();

    expect(html.querySelector('input[type="file"]')).not.toBeNull();
    expect(html.textContent).toContain('Horario - Campo de aprendizaje');
    expect(html.textContent).toContain('Registro Académico Extendido');
    expect(html.querySelector('.alert')).toBeNull();
  });

  it('lee el archivo y muestra lo detectado sin guardar nada', () => {
    const { fixture, html, analizar, confirmar } = crear();

    subir(fixture, html);

    expect(analizar).toHaveBeenCalledTimes(1);
    expect(confirmar).not.toHaveBeenCalled();
    expect(html.textContent).toContain('Esto encontramos en tu horario');
    expect(html.textContent).toContain('Ecuaciones Diferenciales');
    expect(html.textContent).toContain('Grupo SIS.FUSA 501M');
    expect(html.textContent).toContain('2026 · segundo semestre');
  });

  it('muestra cada clase con su día, su hora, su lugar y su docente', () => {
    const { fixture, html } = crear();

    subir(fixture, html);

    const primera = html.querySelector('.horario-import__clase')!;
    expect(primera.textContent).toContain('Martes');
    expect(primera.textContent).toContain('09:00 a 11:00');
    expect(primera.textContent).toContain('E-302 · BLOQUE E- CLAUSTRO ACADÉMICO');
    expect(primera.textContent).toContain('Ana Maria Gomez Ruiz');
    expect(html.textContent).toContain('Miércoles');
  });

  it('dice cuál es nueva y cuántas clases reemplaza la que ya tenía', () => {
    const { fixture, html } = crear();

    subir(fixture, html);

    expect(html.textContent).toContain('Nueva');
    expect(html.textContent).toContain('Ya la tienes · reemplaza sus 2 clases');
    expect(html.textContent).toContain('también');
    expect(html.textContent).toContain('las que hayas agregado a mano');
  });

  it('marca la que no está en la ruta de aprendizaje y avisa que no se guarda', () => {
    const { fixture, html } = crear();

    subir(fixture, html);

    expect(html.textContent).toContain('Una asignatura no está');
    expect(html.textContent).toContain('No está en tu ruta de aprendizaje · no se guarda');
  });

  it('avisa si el reporte es de otro programa', () => {
    const { fixture, html } = crear(vi.fn().mockReturnValue(of({ ...DETECTADO, coincideConMiPrograma: false })));

    subir(fixture, html);

    expect(html.querySelector('[role="alert"]')?.textContent).toContain('no es el programa que elegiste');
  });

  it('al confirmar manda el período y solo lo que está en el plan, con las mismas clases que se mostraron', () => {
    const { fixture, html, confirmar } = crear();
    subir(fixture, html);

    boton(html, 'Confirmar y guardar').click();

    expect(confirmar).toHaveBeenCalledWith({
      periodo: '2026-2',
      asignaturas: [
        { codigo: 'CAD612021519', grupo: 'SIS.FUSA 501M', clases: DETECTADO.asignaturas[0].clases },
        { codigo: 'CAD612021520', grupo: null, clases: DETECTADO.asignaturas[1].clases },
      ],
    });
  });

  it('al guardar celebra y lleva a mi horario', () => {
    const { fixture, html, navegar } = crear();
    subir(fixture, html);

    boton(html, 'Confirmar y guardar').click();

    expect(notificador.exito).toHaveBeenCalledWith(
      'Listo, tu horario quedó cargado',
      expect.stringContaining('1 asignaturas nuevas, 1 actualizadas y 3 clases'),
      'Ver mi horario',
    );
    expect(navegar).toHaveBeenCalledWith(['/horario']);
  });

  it('si no se puede guardar lo dice con el motivo del servidor y no navega', () => {
    const confirmar = vi.fn().mockReturnValue(throwError(() => ({ status: 422, error: { detail: 'Ninguna de las asignaturas del reporte está en tu ruta' } })));
    const { fixture, html, navegar } = crear(undefined, confirmar);
    subir(fixture, html);

    boton(html, 'Confirmar y guardar').click();

    expect(notificador.problema).toHaveBeenCalledWith('No pudimos guardar tu horario', expect.stringContaining('ruta'));
    expect(navegar).not.toHaveBeenCalled();
  });

  it('un archivo que no es el reporte muestra el motivo y deja agregar las clases a mano', () => {
    const analizar = vi.fn().mockReturnValue(throwError(() => ({ status: 422, error: { detail: 'El archivo no parece un Reporte de Horario' } })));
    const { fixture, html } = crear(analizar);

    subir(fixture, html);

    expect(html.querySelector('[role="alert"]')?.textContent).toContain('no parece un Reporte de Horario');
    expect(html.querySelector('a[href="/horario"]')).not.toBeNull();
  });

  it('se puede volver a empezar para subir otro archivo', () => {
    const { fixture, html } = crear();
    subir(fixture, html);

    boton(html, 'Subir otro archivo').click();
    fixture.detectChanges();

    expect(html.querySelector('input[type="file"]')).not.toBeNull();
    expect(html.textContent).not.toContain('Esto encontramos');
  });

  it('la flecha vuelve a mi horario si se llegó desde mi horario', () => {
    const { html } = crear(undefined, undefined, { origen: '/horario' });

    const volver = html.querySelector<HTMLAnchorElement>('.top-bar a.icon-button')!;
    expect(volver.getAttribute('href')).toBe('/horario');
    expect(volver.getAttribute('aria-label')).toBe('Volver a mi horario');
  });
});

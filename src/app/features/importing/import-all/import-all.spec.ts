import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { AvanceDeInformacion, AvanceRepository } from '../../../data-access/avance.repository';
import { ImportAll } from './import-all';

describe('ImportAll', () => {
  const notificador = { exito: vi.fn(), problema: vi.fn(), aviso: vi.fn(), confirmar: vi.fn() };

  const A_MEDIAS: AvanceDeInformacion = {
    porcentaje: 50,
    hechos: 2,
    total: 4,
    pasos: [
      { tipo: 'registro_extendido', texto: 'Registro Académico Extendido', hecho: true, idMatricula: null },
      { tipo: 'horario', texto: 'Reporte de Horario', hecho: true, idMatricula: null },
      { tipo: 'asignatura', texto: 'Actividades de Álgebra Lineal', hecho: false, idMatricula: 7 },
      { tipo: 'asignatura', texto: 'Actividades de Física', hecho: false, idMatricula: 8 },
    ],
  };

  beforeEach(() => {
    notificador.problema.mockReset().mockResolvedValue(undefined);
  });

  function crear(miAvance = vi.fn().mockReturnValue(of(A_MEDIAS))) {
    TestBed.configureTestingModule({
      imports: [ImportAll],
      providers: [
        provideRouter([]),
        { provide: AvanceRepository, useValue: { miAvance } },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    const fixture = TestBed.createComponent(ImportAll);
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement, miAvance };
  }

  it('dibuja la barra con el porcentaje que manda el servidor, sin calcularlo', () => {
    const { html } = crear();

    const barra = html.querySelector('[role="progressbar"]')!;
    expect(barra.getAttribute('aria-valuenow')).toBe('50');
    expect(barra.getAttribute('aria-valuemax')).toBe('100');
    expect(barra.getAttribute('aria-valuetext')).toBe('50 por ciento, 2 de 4 pasos');
    expect((barra.firstElementChild as HTMLElement).style.width).toBe('50%');
    expect(html.querySelector('.todo__cifras')?.textContent).toContain('2 de 4 pasos');
  });

  it('lista los dos reportes y una materia por paso, con lo que ya está y lo que falta', () => {
    const { html } = crear();

    const pasos = html.querySelectorAll('.todo__paso');
    expect(pasos).toHaveLength(4);
    expect(pasos[0].textContent).toContain('Registro Académico Extendido');
    expect(pasos[0].textContent).toContain('Listo');
    expect(pasos[2].textContent).toContain('Actividades de Álgebra Lineal');
    expect(pasos[2].textContent).toContain('Falta subirlo');
    expect(html.querySelectorAll('.todo__paso--hecho')).toHaveLength(2);
  });

  it('cada paso lleva a su pantalla de importar y las materias llegan con la asignatura elegida', () => {
    const { html } = crear();

    const enlaces = Array.from(html.querySelectorAll('.todo__boton')).map((a) => a.getAttribute('href'));
    expect(enlaces).toEqual([
      '/cuenta/importar-reporte',
      '/cuenta/importar-horario',
      '/calificaciones/importar-cmad?matricula=7',
      '/calificaciones/importar-cmad?matricula=8',
    ]);
  });

  it('lo que falta se sube y lo que ya está se actualiza, y el botón dice de qué paso habla', () => {
    const { html } = crear();

    const botones = Array.from(html.querySelectorAll('.todo__boton'));
    expect(botones.map((b) => b.textContent?.trim())).toEqual(['Actualizar', 'Actualizar', 'Subir', 'Subir']);
    expect(botones[2].getAttribute('aria-label')).toBe('Subir: Actividades de Álgebra Lineal');
  });

  it('con todo subido lo celebra y deja de pedir las actividades', () => {
    const completo: AvanceDeInformacion = {
      porcentaje: 100,
      hechos: 3,
      total: 3,
      pasos: [
        { tipo: 'registro_extendido', texto: 'Registro Académico Extendido', hecho: true, idMatricula: null },
        { tipo: 'horario', texto: 'Reporte de Horario', hecho: true, idMatricula: null },
        { tipo: 'asignatura', texto: 'Actividades de Física', hecho: true, idMatricula: 8 },
      ],
    };
    const { html } = crear(vi.fn().mockReturnValue(of(completo)));

    expect(html.querySelector('.todo__titulo')?.textContent).toContain('Tu información está al día');
    expect(html.textContent).not.toContain('sube las actividades de cada materia');
  });

  it('un estudiante nuevo ve los dos reportes por subir y la barra en cero', () => {
    const nuevo: AvanceDeInformacion = {
      porcentaje: 0,
      hechos: 0,
      total: 2,
      pasos: [
        { tipo: 'registro_extendido', texto: 'Registro Académico Extendido', hecho: false, idMatricula: null },
        { tipo: 'horario', texto: 'Reporte de Horario', hecho: false, idMatricula: null },
      ],
    };
    const { html } = crear(vi.fn().mockReturnValue(of(nuevo)));

    expect(html.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('0');
    expect(html.querySelectorAll('.todo__paso--hecho')).toHaveLength(0);
  });

  it('si no logra traer el avance lo dice y deja reintentar', () => {
    const miAvance = vi.fn().mockReturnValueOnce(throwError(() => ({ status: 500 })));
    miAvance.mockReturnValue(of(A_MEDIAS));
    const { fixture, html } = crear(miAvance);

    expect(html.querySelector('.alert')?.textContent).toContain('No pudimos traer tu avance');
    expect(notificador.problema).toHaveBeenCalled();

    (html.querySelector('.button--soft') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(html.querySelector('[role="progressbar"]')).not.toBeNull();
  });
});

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
import {
  AcumuladoDeNotas,
  AsignaturaMatriculada,
  EstructuraDeEvaluacion,
  EvaluacionRepository,
} from '../../../data-access/evaluacion.repository';
import { ActivityGrades, NotasCambiadas } from './activity-grades';

const ASIGNATURA: AsignaturaMatriculada = {
  idMatricula: 7,
  codigoAsignatura: 'CAD612021101',
  nombre: 'Álgebra Lineal',
  creditos: 3,
  codigoPeriodo: '2026-2',
  estado: 'en_curso',
  enCurso: true,
  tieneEstructura: true,
  categorias: 2,
  actividades: 2,
};

const SIN_NOTAS: AcumuladoDeNotas = {
  puntos: 0,
  porcentajeEvaluado: 0,
  promedioDeLoEvaluado: null,
  actividadesCalificadas: 0,
  actividadesTotales: 2,
};

/** Primer corte 60 % con Parcial y Taller; segundo corte 40 % todavía sin actividades. */
const ESTRUCTURA: EstructuraDeEvaluacion = {
  asignatura: ASIGNATURA,
  guardada: true,
  categorias: [
    {
      consecutivo: 1,
      nombre: 'Primer corte',
      porcentaje: 60,
      origen: 'estudiante',
      actividades: [
        { consecutivo: 1, nombre: 'Parcial', porcentaje: 70, fechaProgramada: null, tipo: 'parcial', estadoEntrega: 'no_entregada', nota: null },
        { consecutivo: 2, nombre: 'Taller', porcentaje: 30, fechaProgramada: null, tipo: 'taller', estadoEntrega: 'no_entregada', nota: null },
      ],
    },
    { consecutivo: 2, nombre: 'Segundo corte', porcentaje: 40, origen: 'estudiante', actividades: [] },
  ],
  acumulado: SIN_NOTAS,
};

/** El panel se prueba dentro de un anfitrión, porque su entrada es una señal obligatoria. */
@Component({
  imports: [ActivityGrades],
  template: `<app-activity-grades
    [estructura]="estructura()"
    (cambiaronLasNotas)="cambios.push($event)"
    (irAEstructura)="fueAEstructura = true"
  />`,
})
class Anfitrion {
  readonly estructura = signal<EstructuraDeEvaluacion>(ESTRUCTURA);
  readonly cambios: NotasCambiadas[] = [];
  fueAEstructura = false;
}

describe('ActivityGrades', () => {
  const notificador = { problema: vi.fn() };

  beforeEach(() => notificador.problema.mockReset().mockResolvedValue(undefined));

  let ultimo: ComponentFixture<Anfitrion>;

  function crear(
    estructura: EstructuraDeEvaluacion = ESTRUCTURA,
    registrarNota = vi.fn(),
    quitarNota = vi.fn(),
  ) {
    TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [
        provideRouter([]),
        { provide: EvaluacionRepository, useValue: { registrarNota, quitarNota } },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    const fixture = TestBed.createComponent(Anfitrion);
    ultimo = fixture;
    fixture.componentInstance.estructura.set(estructura);
    fixture.detectChanges();
    return { fixture, anfitrion: fixture.componentInstance, html: fixture.nativeElement as HTMLElement, registrarNota, quitarNota };
  }

  /** El campo de una actividad: las notas se ven de solo lectura, así que primero se toca Editar. */
  function campo(html: HTMLElement, nombre: string): HTMLInputElement {
    const buscar = () => html.querySelector<HTMLInputElement>(`input[aria-label="Nota de ${nombre}"]`);
    if (!buscar()) {
      html.querySelector<HTMLButtonElement>(`button[aria-label="Editar la nota de ${nombre}"]`)?.click();
      ultimo.detectChanges();
    }
    return buscar()!;
  }

  function confirmarCampo(entrada: HTMLInputElement, valor: string): void {
    entrada.value = valor;
    entrada.closest('.notas__actividad')!.querySelector<HTMLButtonElement>('.notas__guardar')!.click();
  }

  it('muestra cada actividad con su campo de nota y lo que lleva acumulado', () => {
    const { html } = crear();

    expect(html.querySelectorAll('.notas__actividad')).toHaveLength(2);
    expect(campo(html, 'Parcial')).not.toBeNull();
    expect(html.textContent).toContain('Todavía no has anotado ninguna nota');
    expect(html.textContent).toContain('0 de 2 actividades');
  });

  it('una categoría sin actividades manda a la estructura en vez de mostrar un campo', () => {
    const { html } = crear();

    expect(html.textContent).toContain('Este corte todavía no tiene actividades');
  });

  it('una asignatura sin configurar ofrece definir cómo la evalúan y no muestra campos', () => {
    const creado = crear({ ...ESTRUCTURA, guardada: false });

    expect(creado.html.querySelector('input')).toBeNull();
    expect(creado.html.textContent).toContain('Primero cuéntanos cómo te evalúan');
    creado.html.querySelector<HTMLButtonElement>('button')!.click();
    expect(creado.anfitrion.fueAEstructura).toBe(true);
  });

  it('una estructura sin actividades también manda a definirlas', () => {
    const sinActividades: EstructuraDeEvaluacion = {
      ...ESTRUCTURA,
      categorias: ESTRUCTURA.categorias.map((c) => ({ ...c, actividades: [] })),
      acumulado: { ...SIN_NOTAS, actividadesTotales: 0 },
    };
    const { html } = crear(sinActividades);

    expect(html.textContent).toContain('todavía no tienen actividades');
  });

  it('anotar una nota la manda al servidor y muestra lo que lleva acumulado', async () => {
    const acumulado: AcumuladoDeNotas = {
      puntos: 1.68,
      porcentajeEvaluado: 42,
      promedioDeLoEvaluado: 4,
      actividadesCalificadas: 1,
      actividadesTotales: 2,
    };
    const registrarNota = vi.fn().mockReturnValue(of({ nota: 4, acumulado }));
    const creado = crear(ESTRUCTURA, registrarNota);

    confirmarCampo(campo(creado.html, 'Parcial'), '4');
    await creado.fixture.whenStable();
    creado.fixture.detectChanges();

    expect(registrarNota).toHaveBeenCalledWith(7, 1, 1, 4);
    expect(creado.html.querySelector('.notas__numero')?.textContent).toContain('1.68');
    expect(creado.html.textContent).toContain('42 %');
    expect(creado.html.textContent).toContain('Promedio de lo evaluado: 4.00');
    // Le avisa a la pantalla para que, al cambiar de vista, no se vea una versión vieja.
    expect(creado.anfitrion.cambios).toHaveLength(1);
    expect(creado.anfitrion.cambios[0].categorias[0].actividades[0].nota).toBe(4);
    expect(creado.anfitrion.cambios[0].categorias[0].actividades[0].estadoEntrega).toBe('calificada');
  });

  it('acepta la coma decimal y no vuelve a preguntarle al servidor por la misma nota', async () => {
    const registrarNota = vi.fn().mockReturnValue(of({ nota: 3.5, acumulado: SIN_NOTAS }));
    const creado = crear(ESTRUCTURA, registrarNota);

    confirmarCampo(campo(creado.html, 'Taller'), '3,5');
    await creado.fixture.whenStable();
    creado.fixture.detectChanges();
    confirmarCampo(campo(creado.html, 'Taller'), '3.5');

    expect(registrarNota).toHaveBeenCalledTimes(1);
    expect(registrarNota).toHaveBeenCalledWith(7, 1, 2, 3.5);
  });

  it('lo que no es un número no llega al servidor', () => {
    const registrarNota = vi.fn();
    const creado = crear(ESTRUCTURA, registrarNota);

    confirmarCampo(campo(creado.html, 'Parcial'), 'abc');
    creado.fixture.detectChanges();

    expect(registrarNota).not.toHaveBeenCalled();
    expect(creado.html.querySelector('[role="alert"]')?.textContent).toContain('con números');
  });

  it('una nota que el servidor rechaza muestra su mensaje y deja el campo como estaba', async () => {
    const registrarNota = vi.fn().mockReturnValue(
      throwError(() => ({ status: 422, error: { detail: 'La nota tiene que estar entre 0.0 y 5.0' } })),
    );
    const creado = crear(ESTRUCTURA, registrarNota);

    confirmarCampo(campo(creado.html, 'Parcial'), '5.5');
    await creado.fixture.whenStable();
    creado.fixture.detectChanges();

    expect(creado.html.querySelector('[role="alert"]')?.textContent).toContain('entre 0.0 y 5.0');
    // No se deja escrita una nota que no quedó registrada.
    expect(campo(creado.html, 'Parcial').value).toBe('');
    expect(notificador.problema).not.toHaveBeenCalled();
    expect(creado.anfitrion.cambios).toHaveLength(0);
  });

  it('una caída del servidor va a la ventana emergente y no junto al campo', async () => {
    const registrarNota = vi.fn().mockReturnValue(throwError(() => ({ status: 500 })));
    const creado = crear(ESTRUCTURA, registrarNota);

    confirmarCampo(campo(creado.html, 'Parcial'), '4');
    await creado.fixture.whenStable();
    creado.fixture.detectChanges();

    expect(notificador.problema).toHaveBeenCalledWith('No pudimos guardar la nota', expect.any(String));
  });

  it('vaciar un campo con nota la quita; vaciar uno que ya estaba vacío no hace nada', async () => {
    const conNota: EstructuraDeEvaluacion = {
      ...ESTRUCTURA,
      categorias: ESTRUCTURA.categorias.map((c, i) =>
        i === 0
          ? { ...c, actividades: c.actividades.map((a) => (a.consecutivo === 1 ? { ...a, nota: 4, estadoEntrega: 'calificada' } : a)) }
          : c,
      ),
      acumulado: { puntos: 1.68, porcentajeEvaluado: 42, promedioDeLoEvaluado: 4, actividadesCalificadas: 1, actividadesTotales: 2 },
    };
    const quitarNota = vi.fn().mockReturnValue(of(SIN_NOTAS));
    const creado = crear(conNota, vi.fn(), quitarNota);

    confirmarCampo(campo(creado.html, 'Taller'), '');
    expect(quitarNota).not.toHaveBeenCalled();

    confirmarCampo(campo(creado.html, 'Parcial'), '');
    await creado.fixture.whenStable();
    creado.fixture.detectChanges();

    expect(quitarNota).toHaveBeenCalledWith(7, 1, 1);
    expect(creado.html.textContent).toContain('Todavía no has anotado ninguna nota');
    expect(creado.anfitrion.cambios[0].categorias[0].actividades[0].estadoEntrega).toBe('no_entregada');
  });

  it('Quitar nota solo aparece al editar una actividad que tiene nota', () => {
    const conNota: EstructuraDeEvaluacion = {
      ...ESTRUCTURA,
      categorias: ESTRUCTURA.categorias.map((c, i) =>
        i === 0 ? { ...c, actividades: c.actividades.map((a) => (a.consecutivo === 1 ? { ...a, nota: 4 } : a)) } : c,
      ),
    };
    const { html } = crear(conNota);

    expect(html.querySelectorAll('.notas__quitar')).toHaveLength(0);
    campo(html, 'Parcial');
    expect(html.querySelectorAll('.notas__quitar')).toHaveLength(1);
  });

  it('ofrece subir de nuevo, que lleva al CMAD con la asignatura, y quitar lo subido', () => {
    const { html } = crear();

    const subir = html.querySelector<HTMLAnchorElement>('.notas__subida a')!;
    expect(subir.textContent).toContain('Subir de nuevo');
    expect(subir.getAttribute('href')).toBe('/calificaciones/importar-cmad?matricula=7');
    expect(html.querySelector('.notas__subida button')?.textContent).toContain('Quitar lo subido');
  });

  it('si la pantalla le pasa otra estructura, el panel se vuelve a armar con ella', () => {
    const creado = crear();
    expect(creado.html.textContent).toContain('Todavía no has anotado ninguna nota');

    creado.anfitrion.estructura.set({
      ...ESTRUCTURA,
      acumulado: { puntos: 2.1, porcentajeEvaluado: 42, promedioDeLoEvaluado: 5, actividadesCalificadas: 1, actividadesTotales: 2 },
    });
    creado.fixture.detectChanges();

    expect(creado.html.querySelector('.notas__numero')?.textContent).toContain('2.10');
  });
});

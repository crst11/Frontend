import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { EvaluacionRepository } from '../../data-access/evaluacion.repository';
import { PendingActivities } from './pending-activities';

describe('PendingActivities', () => {
  const actividad = (consecutivo: number, nombre: string, nota: number | null, fecha: string | null = null) => ({
    consecutivo,
    nombre,
    porcentaje: 25,
    fechaProgramada: fecha,
    tipo: 'taller',
    estadoEntrega: 'pendiente',
    nota,
  });

  const categoria = (consecutivo: number, nombre: string, porcentaje: number, actividades: ReturnType<typeof actividad>[]) => ({
    consecutivo,
    nombre,
    porcentaje,
    origen: 'cmad',
    actividades,
  });

  function crear(estructuraDe: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [PendingActivities],
      providers: [provideRouter([]), { provide: EvaluacionRepository, useValue: { estructuraDe } }],
    });
    const fixture = TestBed.createComponent(PendingActivities);
    fixture.componentRef.setInput('idMatricula', 7);
    fixture.componentRef.setInput('origen', '/horario');
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement };
  }

  it('muestra solo las actividades sin nota, agrupadas por corte, y no las que ya tienen nota', () => {
    const { html } = crear(
      vi.fn().mockReturnValue(
        of({
          categorias: [
            categoria(1, 'Corte 1', 30, [actividad(1, 'Quiz', 4.2), actividad(2, 'Taller', null, '2026-10-05')]),
            categoria(2, 'Corte 2', 30, [actividad(3, 'Foro', 3.0)]),
            categoria(3, 'Corte 3', 40, [actividad(4, 'Examen', null), actividad(5, 'Proyecto', null)]),
          ],
        }),
      ),
    );

    const texto = html.textContent ?? '';
    expect(texto).toContain('Te faltan 3 actividades por calificar');
    expect(texto).toContain('Taller');
    expect(texto).toContain('5 oct');
    expect(texto).toContain('Examen');
    expect(texto).not.toContain('Quiz');
    expect(texto).not.toContain('Foro');
    expect(texto).not.toContain('Corte 2');
  });

  it('el enlace lleva a Mis notas de esa asignatura', () => {
    const { html } = crear(
      vi.fn().mockReturnValue(of({ categorias: [categoria(1, 'Corte', 100, [actividad(1, 'Taller', null)])] })),
    );

    const enlace = html.querySelector<HTMLAnchorElement>('a')!;
    expect(enlace.textContent).toContain('Poner o editar mis notas');
    expect(enlace.getAttribute('href')).toBe('/calificaciones/mis-notas?matricula=7');
  });

  it('con todas las actividades calificadas lo dice y no inventa pendientes', () => {
    const { html } = crear(
      vi.fn().mockReturnValue(of({ categorias: [categoria(1, 'Corte', 100, [actividad(1, 'Quiz', 5)])] })),
    );

    expect(html.textContent).toContain('Ya tienes nota en todas las actividades');
    expect(html.querySelector('.pendientes__lista')).toBeNull();
  });

  it('sin actividades subidas ofrece subirlas', () => {
    const { html } = crear(vi.fn().mockReturnValue(of({ categorias: [] })));

    expect(html.textContent).toContain('Aún no has subido las actividades');
    expect(html.querySelector('a')?.getAttribute('href')).toBe('/calificaciones/importar-cmad?matricula=7');
  });

  it('con los cortes de la plantilla pero sin ninguna actividad ofrece subirlas y no dice que está al día', () => {
    const { html } = crear(
      vi.fn().mockReturnValue(of({ categorias: [categoria(1, 'Corte 1', 30, []), categoria(2, 'Corte 2', 30, []), categoria(3, 'Corte 3', 40, [])] })),
    );

    expect(html.textContent).toContain('Aún no has subido las actividades');
    expect(html.textContent).not.toContain('Ya tienes nota');
  });

  it('si no se pueden traer lo dice', () => {
    const { html } = crear(vi.fn().mockReturnValue(throwError(() => ({ status: 500 }))));

    expect(html.textContent).toContain('No pudimos traer las actividades');
  });

  it('una sola actividad se dice en singular', () => {
    const { html } = crear(
      vi.fn().mockReturnValue(of({ categorias: [categoria(1, 'Corte', 100, [actividad(1, 'Taller', null)])] })),
    );

    expect(html.textContent).toContain('Te falta 1 actividad por calificar');
  });
});

import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { AsignaturaMatriculada, EvaluacionRepository } from '../../../data-access/evaluacion.repository';
import { Pendiente, PendienteRepository } from '../../../data-access/pendiente.repository';
import { MyTasks } from './my-tasks';

describe('MyTasks', () => {
  const notificador = { problema: vi.fn(), aviso: vi.fn(), confirmar: vi.fn() };

  const VENCIDO: Pendiente = {
    id: 1,
    titulo: 'Ensayo atrasado',
    descripcion: 'Entregar por el aula virtual',
    fechaLimite: '2026-10-10T04:59:00Z',
    prioridad: 'media',
    estado: 'abierto',
    situacion: 'vencido',
    idMatricula: 7,
  };
  const URGENTE: Pendiente = {
    id: 2,
    titulo: 'Taller de redes',
    descripcion: null,
    fechaLimite: '2026-10-14T04:59:00Z',
    prioridad: 'alta',
    estado: 'abierto',
    situacion: 'urgente',
    idMatricula: null,
  };
  const LEJANO: Pendiente = {
    ...URGENTE,
    id: 3,
    titulo: 'Proyecto final',
    fechaLimite: '2026-11-20T04:59:00Z',
    prioridad: 'baja',
    situacion: 'proximo',
  };
  const HECHO: Pendiente = { ...LEJANO, id: 4, titulo: 'Lectura', estado: 'cumplido', situacion: 'cumplido' };

  const ASIGNATURA = { idMatricula: 7, nombre: 'Sistemas Operativos' } as AsignaturaMatriculada;

  const repositorio = {
    listar: vi.fn(),
    crear: vi.fn(),
    marcar: vi.fn(),
    eliminar: vi.fn(),
  };

  beforeEach(() => {
    notificador.problema.mockReset().mockResolvedValue(undefined);
    notificador.aviso.mockReset().mockResolvedValue(undefined);
    notificador.confirmar.mockReset().mockResolvedValue(true);
    repositorio.listar.mockReset().mockReturnValue(of([VENCIDO, URGENTE, LEJANO]));
    repositorio.crear.mockReset().mockReturnValue(of(URGENTE));
    repositorio.marcar.mockReset().mockReturnValue(of({ ...URGENTE, estado: 'cumplido', situacion: 'cumplido' }));
    repositorio.eliminar.mockReset().mockReturnValue(of(undefined));
  });

  function crear() {
    TestBed.configureTestingModule({
      imports: [MyTasks],
      providers: [
        { provide: PendienteRepository, useValue: repositorio },
        { provide: EvaluacionRepository, useValue: { misAsignaturas: vi.fn().mockReturnValue(of([ASIGNATURA])) } },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    const fixture = TestBed.createComponent(MyTasks);
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement };
  }

  function escribir(html: HTMLElement, selector: string, valor: string) {
    const campo = html.querySelector<HTMLInputElement>(selector)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  it('lista los pendientes en el orden que manda el servidor, con su situación escrita', () => {
    const { html } = crear();

    const items = html.querySelectorAll('.pendientes__item');
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain('Ensayo atrasado');
    expect(items[0].textContent).toContain('Vencido');
    expect(items[0].textContent).toContain('Sistemas Operativos');
    expect(items[1].textContent).toContain('Vence pronto');
    expect(items[1].textContent).toContain('Prioridad alta');
    expect(items[2].textContent).not.toContain('Vence pronto');
  });

  it('resalta lo vencido y lo urgente', () => {
    const { html } = crear();

    expect(html.querySelector('.pendientes__item--vencido')?.textContent).toContain('Ensayo atrasado');
    expect(html.querySelector('.pendientes__item--urgente')?.textContent).toContain('Taller de redes');
  });

  it('sin pendientes lo dice', () => {
    repositorio.listar.mockReturnValue(of([]));
    const { html } = crear();

    expect(html.textContent).toContain('No tienes pendientes');
    expect(html.querySelector('.pendientes__item')).toBeNull();
  });

  it('por defecto no pide los hechos y con la casilla sí', () => {
    const { fixture, html } = crear();

    expect(repositorio.listar).toHaveBeenLastCalledWith(false);

    repositorio.listar.mockReturnValue(of([URGENTE, HECHO]));
    html.querySelector<HTMLInputElement>('.pendientes__acciones input')!.click();
    fixture.detectChanges();

    expect(repositorio.listar).toHaveBeenLastCalledWith(true);
    expect(html.querySelector('.pendientes__item--hecho')?.textContent).toContain('Lectura');
  });

  it('marcar un pendiente como hecho avisa y vuelve a pedir la lista', () => {
    const { fixture, html } = crear();

    html.querySelectorAll<HTMLInputElement>('.pendientes__marca')[1].click();
    fixture.detectChanges();

    expect(repositorio.marcar).toHaveBeenCalledWith(2, true);
    expect(repositorio.listar).toHaveBeenCalledTimes(2);
    expect(notificador.aviso).toHaveBeenCalledWith('Lo marcaste como hecho.');
  });

  it('un pendiente hecho se reabre', () => {
    repositorio.listar.mockReturnValue(of([HECHO]));
    const { fixture, html } = crear();

    html.querySelector<HTMLInputElement>('.pendientes__marca')!.click();
    fixture.detectChanges();

    expect(repositorio.marcar).toHaveBeenCalledWith(4, false);
  });

  it('borrar pide confirmar y no borra si la persona se arrepiente', async () => {
    notificador.confirmar.mockResolvedValue(false);
    const { fixture, html } = crear();

    html.querySelectorAll<HTMLButtonElement>('.pendientes__borrar')[0].click();
    await fixture.whenStable();

    expect(notificador.confirmar).toHaveBeenCalled();
    expect(repositorio.eliminar).not.toHaveBeenCalled();
  });

  it('borrar, ya confirmado, lo elimina y vuelve a pedir la lista', async () => {
    const { fixture, html } = crear();

    html.querySelectorAll<HTMLButtonElement>('.pendientes__borrar')[0].click();
    await fixture.whenStable();

    expect(repositorio.eliminar).toHaveBeenCalledWith(1);
    expect(repositorio.listar).toHaveBeenCalledTimes(2);
  });

  describe('agregar', () => {
    function abrir() {
      const pantalla = crear();
      pantalla.html.querySelector<HTMLButtonElement>('.pendientes__acciones button')!.click();
      pantalla.fixture.detectChanges();
      return pantalla;
    }

    it('sin título ni día no guarda y lo dice junto al campo', () => {
      const { fixture, html } = abrir();

      html.querySelector<HTMLButtonElement>('.pendientes__formulario button[type="submit"]')!.click();
      fixture.detectChanges();

      expect(repositorio.crear).not.toHaveBeenCalled();
      expect(html.querySelector('.pendientes__formulario')?.textContent).toContain('Escribe un título');
      expect(html.querySelector('.pendientes__formulario')?.textContent).toContain('Elige el día límite');
    });

    it('guarda con la hora por defecto al final del día y la prioridad media', () => {
      const { fixture, html } = abrir();

      escribir(html, 'input[formControlName="titulo"]', '  Taller de redes  ');
      escribir(html, 'input[formControlName="fecha"]', '2026-10-20');
      html.querySelector<HTMLButtonElement>('.pendientes__formulario button[type="submit"]')!.click();
      fixture.detectChanges();

      const enviado = repositorio.crear.mock.calls[0][0];
      expect(enviado.titulo).toBe('Taller de redes');
      expect(enviado.prioridad).toBe('media');
      expect(enviado.fechaLimite).toBe(new Date('2026-10-20T23:59:00').toISOString());
      expect(enviado.descripcion).toBeUndefined();
      expect(enviado.idMatricula).toBeUndefined();
      expect(notificador.aviso).toHaveBeenCalledWith('Guardamos tu pendiente.');
      expect(html.querySelector('.pendientes__formulario')).toBeNull();
    });

    it('lo que el servidor rechaza se muestra en el formulario', () => {
      repositorio.crear.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 422, error: { detail: 'Escribe un título para el pendiente' } })),
      );
      const { fixture, html } = abrir();

      escribir(html, 'input[formControlName="titulo"]', 'Algo');
      escribir(html, 'input[formControlName="fecha"]', '2026-10-20');
      html.querySelector<HTMLButtonElement>('.pendientes__formulario button[type="submit"]')!.click();
      fixture.detectChanges();

      expect(html.querySelector('.pendientes__formulario [role="alert"]')?.textContent).toContain(
        'Escribe un título para el pendiente',
      );
    });
  });

  it('si no se pueden traer lo dice, avisa de la falla del sistema y deja reintentar', () => {
    repositorio.listar.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));
    const { fixture, html } = crear();

    expect(html.querySelector('[role="alert"]')?.textContent).toContain('No pudimos traer tus pendientes');
    expect(notificador.problema).toHaveBeenCalled();

    html.querySelector<HTMLButtonElement>('.button--soft')!.click();
    fixture.detectChanges();

    expect(html.querySelectorAll('.pendientes__item')).toHaveLength(3);
  });
});

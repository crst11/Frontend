import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { AsignaturaMatriculada } from '../../../data-access/evaluacion.repository';
import { Brujula, BrujulaRepository } from '../../../data-access/brujula.repository';
import { CompassScreen } from './compass-screen';

describe('CompassScreen', () => {
  const notificador = { problema: vi.fn(), aviso: vi.fn(), confirmar: vi.fn() };

  const CALCULO = { idMatricula: 7, nombre: 'Cálculo' } as AsignaturaMatriculada;
  const REDES = { idMatricula: 8, nombre: 'Redes' } as AsignaturaMatriculada;
  const FISICA = { idMatricula: 9, nombre: 'Física' } as AsignaturaMatriculada;

  const BRUJULA: Brujula = {
    meta: 3,
    umbrales: { medio: 3.5, alto: 4.5 },
    asignaturas: [
      {
        asignatura: CALCULO,
        nivel: 'alto',
        motivo: 'inalcanzable',
        explicacion: 'Aun sacando 5.0 en todo lo que falta llegarías a 2.84, y tu meta es 3.0.',
        notaRequerida: null,
        maximoPosible: 2.84,
      },
      {
        asignatura: REDES,
        nivel: 'medio',
        motivo: 'sobre_el_umbral_medio',
        explicacion: 'Necesitas 4.00 en lo que falta, más que tu umbral de riesgo medio (3.5).',
        notaRequerida: 4,
        maximoPosible: 5,
      },
      {
        asignatura: FISICA,
        nivel: 'sin_datos',
        motivo: 'sin_estructura',
        explicacion: 'Cuéntanos cómo te evalúan en esta asignatura para poder calcular tu riesgo.',
        notaRequerida: null,
        maximoPosible: null,
      },
    ],
  };

  const repositorio = { miBrujula: vi.fn(), cambiarUmbrales: vi.fn() };

  beforeEach(() => {
    notificador.problema.mockReset().mockResolvedValue(undefined);
    notificador.aviso.mockReset().mockResolvedValue(undefined);
    repositorio.miBrujula.mockReset().mockReturnValue(of(BRUJULA));
    repositorio.cambiarUmbrales.mockReset().mockImplementation((umbrales) => of({ meta: 3, umbrales }));
  });

  function crear() {
    TestBed.configureTestingModule({
      imports: [CompassScreen],
      providers: [
        provideRouter([]),
        { provide: BrujulaRepository, useValue: repositorio },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    const fixture = TestBed.createComponent(CompassScreen);
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement };
  }

  function escribir(html: HTMLElement, selector: string, valor: string) {
    const campo = html.querySelector<HTMLInputElement>(selector)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  it('lista cada asignatura con su nivel escrito y por qué, en el orden del servidor', () => {
    const { html } = crear();

    const items = html.querySelectorAll('.brujula__item');
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain('Cálculo');
    expect(items[0].textContent).toContain('Riesgo alto');
    expect(items[0].textContent).toContain('llegarías a 2.84');
    expect(items[1].textContent).toContain('Riesgo medio');
    expect(items[1].textContent).toContain('umbral de riesgo medio (3.5)');
    expect(items[2].textContent).toContain('Sin datos');
  });

  it('nunca la llama semáforo', () => {
    const { html } = crear();

    expect(html.textContent?.toLowerCase()).not.toContain('semáforo');
  });

  it('lo que tiene datos lleva a simular esa asignatura y lo que no, a definir cómo la evalúan', () => {
    const { html } = crear();

    const enlaces = Array.from(html.querySelectorAll<HTMLAnchorElement>('.brujula__item a')).map((a) =>
      a.getAttribute('href'),
    );
    expect(enlaces).toEqual(['/simulador?asignatura=7', '/simulador?asignatura=8', '/calificaciones/mis-notas']);
  });

  it('muestra los umbrales actuales para editarlos', () => {
    const { html } = crear();

    expect(html.querySelector<HTMLInputElement>('#umbral-medio')!.value).toBe('3.5');
    expect(html.querySelector<HTMLInputElement>('#umbral-alto')!.value).toBe('4.5');
  });

  it('guardar los umbrales los manda, avisa y vuelve a pedir la Brújula recalculada', () => {
    const { fixture, html } = crear();

    escribir(html, '#umbral-medio', '3,0');
    escribir(html, '#umbral-alto', '4');
    html.querySelector<HTMLButtonElement>('.brujula__formulario button[type="submit"]')!.click();
    fixture.detectChanges();

    expect(repositorio.cambiarUmbrales).toHaveBeenCalledWith({ medio: 3, alto: 4 });
    expect(notificador.aviso).toHaveBeenCalledWith('Guardamos tus umbrales.');
    expect(repositorio.miBrujula).toHaveBeenCalledTimes(2);
  });

  it('unos umbrales que no son números se avisan y no se mandan', () => {
    const { fixture, html } = crear();

    escribir(html, '#umbral-medio', 'poco');
    html.querySelector<HTMLButtonElement>('.brujula__formulario button[type="submit"]')!.click();
    fixture.detectChanges();

    expect(html.querySelector('.brujula__formulario [role="alert"]')?.textContent).toContain('como número');
    expect(repositorio.cambiarUmbrales).not.toHaveBeenCalled();
  });

  it('lo que el servidor rechaza se muestra junto a los umbrales', () => {
    repositorio.cambiarUmbrales.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { detail: 'El umbral medio tiene que ser menor que el alto' } })),
    );
    const { fixture, html } = crear();

    escribir(html, '#umbral-medio', '4.9');
    html.querySelector<HTMLButtonElement>('.brujula__formulario button[type="submit"]')!.click();
    fixture.detectChanges();

    expect(html.querySelector('.brujula__formulario [role="alert"]')?.textContent).toContain('menor que el alto');
    expect(repositorio.miBrujula).toHaveBeenCalledTimes(1);
  });

  it('sin asignaturas en curso lo dice y lleva a importar', () => {
    repositorio.miBrujula.mockReturnValue(of({ ...BRUJULA, asignaturas: [] }));
    const { html } = crear();

    expect(html.textContent).toContain('No tienes asignaturas en curso');
    expect(html.querySelector('.brujula__item')).toBeNull();
    expect(html.querySelector('a[href="/importar"]')).not.toBeNull();
  });

  it('si no se puede traer lo dice, avisa de la falla del sistema y deja reintentar', () => {
    repositorio.miBrujula.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));
    const { fixture, html } = crear();

    expect(html.querySelector('[role="alert"]')?.textContent).toContain('No pudimos traer tu Brújula');
    expect(notificador.problema).toHaveBeenCalled();

    html.querySelector<HTMLButtonElement>('.button--soft')!.click();
    fixture.detectChanges();

    expect(html.querySelectorAll('.brujula__item')).toHaveLength(3);
  });
});

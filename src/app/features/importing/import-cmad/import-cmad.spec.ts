import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { AsignaturaMatriculada, EvaluacionRepository } from '../../../data-access/evaluacion.repository';
import { ImportCmad } from './import-cmad';

describe('ImportCmad', () => {
  const notificador = { exito: vi.fn(), problema: vi.fn(), aviso: vi.fn(), confirmar: vi.fn() };

  const INGLES: AsignaturaMatriculada = {
    idMatricula: 7,
    codigoAsignatura: 'CAI1002020507',
    nombre: 'Lengua Extranjera III',
    creditos: 2,
    codigoPeriodo: '2026-2',
    estado: 'en_curso',
    enCurso: true,
    tieneEstructura: false,
    categorias: 0,
    actividades: 0,
  };
  const SISTEMAS: AsignaturaMatriculada = { ...INGLES, idMatricula: 8, codigoAsignatura: 'CAD612021520', nombre: 'Sistemas Operativos' };

  function celdas(nombre: string, peso: string, nota: string): string {
    return `<tr><td class="column-itemname"><a class="gradeitemheader">${nombre}</a></td><td class="column-weight">${peso}</td>
      <td class="column-grade">${nota}</td><td class="column-range">0–5</td><td class="column-feedback">Hola Ana, bien hecho</td></tr>`;
  }

  const PAGINA = `<table class="generaltable user-grade"><tbody>
    <tr><td class="column-itemname"><a class="gradeitemheader">603574/LENGUA EXTRANJERA III/FU/CAI1002020507/LE3-M1/28619</a></td></tr>
    ${celdas('R1-A1-S1 ABOUT ROUTINES!', '50.00 %', '4.0')}
    ${celdas('R1-A2-S2 BROCHURE.', '50.00 %', '-')}
    <tr><td class="column-itemname">Cálculo total Total del curso</td><td class="column-weight">-</td><td class="column-grade">2.0</td><td class="column-range">0–5</td></tr>
  </tbody></table>`;

  function crear(
    matricula: string | null = '7',
    registrarNota = vi.fn().mockImplementation(() => of({ nota: 4, acumulado: { puntos: 2.0, porcentajeEvaluado: 50, promedioDeLoEvaluado: 4, actividadesCalificadas: 1, actividadesTotales: 2 } })),
    guardar = vi.fn().mockReturnValue(of({})),
    misAsignaturas = vi.fn().mockReturnValue(of([INGLES, SISTEMAS])),
    estructuraDe = vi.fn().mockReturnValue(of({ categorias: [] })),
  ) {
    TestBed.configureTestingModule({
      imports: [ImportCmad],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(matricula ? { matricula } : {}) } } },
        { provide: EvaluacionRepository, useValue: { misAsignaturas, guardar, registrarNota, estructuraDe } },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    vi.spyOn(TestBed.inject(Location), 'getState').mockReturnValue({});
    const fixture = TestBed.createComponent(ImportCmad);
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement, guardar, registrarNota, misAsignaturas, navegar };
  }

  async function subirPagina(
    fixture: ReturnType<typeof crear>['fixture'],
    html: HTMLElement,
    contenido = PAGINA,
    nombre = 'cmad.html',
    tipo = 'text/html',
  ) {
    const entrada = html.querySelector<HTMLInputElement>('input[type="file"]')!;
    const archivo = new File([contenido], nombre, { type: tipo });
    Object.defineProperty(entrada, 'files', { value: [archivo], configurable: true });
    entrada.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function boton(html: HTMLElement, texto: string): HTMLButtonElement {
    return Array.from(html.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes(texto))!;
  }

  beforeEach(() => {
    notificador.problema.mockReset().mockResolvedValue(undefined);
  });

  it('pide las asignaturas del semestre actual y deja elegida la que llega por la dirección', () => {
    const { html, misAsignaturas } = crear('8');

    expect(misAsignaturas).toHaveBeenCalledWith('actual');
    const opciones = html.querySelectorAll<HTMLOptionElement>('select option');
    expect(Array.from(opciones).map((o) => o.textContent?.trim())).toEqual(['Lengua Extranjera III', 'Sistemas Operativos']);
    expect(html.querySelector<HTMLOptionElement>('select option:checked')?.textContent).toContain('Sistemas Operativos');
  });

  it('dice que el archivo no se sube y explica de dónde sale la tabla', () => {
    const { fixture, html } = crear();

    expect(html.textContent).toContain('no se sube a ningún servidor');
    expect(html.textContent).toContain('Valoraciones');
    expect(html.textContent).toContain('Ctrl + S');

    html.querySelector<HTMLButtonElement>('.import__guia-head')!.click();
    fixture.detectChanges();
    expect(html.querySelector('#pasos-guia')).toBeNull();
  });

  it('sin asignaturas en curso manda a importar el horario', () => {
    const { html } = crear('7', undefined, undefined, vi.fn().mockReturnValue(of([])));

    expect(html.textContent).toContain('No tienes asignaturas en curso');
    expect(html.querySelector('a[href="/cuenta/importar-horario"]')).not.toBeNull();
  });

  describe('con la página guardada', () => {
    it('muestra lo detectado sin guardar nada y sin la retroalimentación', async () => {
      const { fixture, html, guardar } = crear();

      await subirPagina(fixture, html);

      expect(html.textContent).toContain('Esto encontramos en el CMAD');
      expect(html.querySelector<HTMLInputElement>('input[aria-label^="Nombre"]')?.value).toBe('R1-A1-S1 ABOUT ROUTINES!');
      expect(html.textContent).toContain('Total del CMAD');
      expect(html.textContent).not.toContain('Hola Ana');
      expect(guardar).not.toHaveBeenCalled();
    });

    it('lee igual la página descargada desde el teléfono, que Chrome guarda como .mht', async () => {
      const mht = [
        'From: <Saved by Blink>',
        'MIME-Version: 1.0',
        'Content-Type: multipart/related;',
        '\ttype="text/html";',
        '\tboundary="----MultipartBoundary--prueba----"',
        '',
        '------MultipartBoundary--prueba----',
        'Content-Type: text/html',
        'Content-Transfer-Encoding: binary',
        '',
        PAGINA,
        '------MultipartBoundary--prueba----',
        'Content-Type: text/css',
        'Content-Transfer-Encoding: binary',
        '',
        'body { color: red }',
        '------MultipartBoundary--prueba------',
        '',
      ].join('\r\n');
      const { fixture, html, guardar } = crear();

      await subirPagina(fixture, html, mht, 'Usuario CMAD.mht', 'multipart/related');

      expect(html.textContent).toContain('Esto encontramos en el CMAD');
      expect(html.querySelector<HTMLInputElement>('input[aria-label^="Nombre"]')?.value).toBe('R1-A1-S1 ABOUT ROUTINES!');
      expect(html.textContent).toContain('Total del CMAD');
      expect(html.textContent).not.toContain('Hola Ana');
      expect(guardar).not.toHaveBeenCalled();
    });

    it('ofrece elegir un .mht en el selector de archivos', () => {
      const { html } = crear();

      const aceptados = html.querySelector<HTMLInputElement>('input[type="file"]')!.accept;

      expect(aceptados).toContain('.mht');
      expect(aceptados).toContain('.mhtml');
    });

    it('arma los cortes con el prefijo del nombre y los muestra con su parte de la nota', async () => {
      const { fixture, html } = crear();

      await subirPagina(fixture, html);

      expect(html.querySelector('[aria-label="Corte R1"]')?.textContent).toContain('100 % de la nota');
    });

    it('al confirmar manda la estructura completa y después cada nota', async () => {
      const { fixture, html, guardar, registrarNota } = crear();
      await subirPagina(fixture, html);

      boton(html, 'Confirmar y guardar').click();
      await fixture.whenStable();

      expect(guardar).toHaveBeenCalledWith(7, [
        {
          consecutivo: 1,
          nombre: 'R1',
          porcentaje: 100,
          origen: 'estudiante',
          actividades: [
            { consecutivo: 1, nombre: 'R1-A1-S1 ABOUT ROUTINES!', porcentaje: 50, fechaProgramada: null, tipo: 'taller' },
            { consecutivo: 2, nombre: 'R1-A2-S2 BROCHURE.', porcentaje: 50, fechaProgramada: null, tipo: 'taller' },
          ],
        },
      ]);
      expect(registrarNota).toHaveBeenCalledTimes(1);
      expect(registrarNota).toHaveBeenCalledWith(7, 1, 1, 4);
    });

    it('compara el acumulado del servidor con el total del CMAD y dice que coincide', async () => {
      const { fixture, html } = crear();
      await subirPagina(fixture, html);

      boton(html, 'Confirmar y guardar').click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(html.textContent).toContain('Listo, cargamos tus actividades');
      expect(html.textContent).toContain('Coincide con el CMAD');
    });

    it('si el acumulado no cuadra con el total del CMAD, lo avisa como problema', async () => {
      const registrar = vi.fn().mockReturnValue(of({ nota: 4, acumulado: { puntos: 3.4, porcentajeEvaluado: 50, promedioDeLoEvaluado: 4, actividadesCalificadas: 1, actividadesTotales: 2 } }));
      const { fixture, html } = crear('7', registrar);
      await subirPagina(fixture, html);

      boton(html, 'Confirmar y guardar').click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(html.querySelector('[role="alert"]')?.textContent).toContain('No coincide');
    });

    it('una nota que no es un número entre 0 y 5 impide guardar', async () => {
      const { fixture, html } = crear();
      await subirPagina(fixture, html);

      const nota = html.querySelector<HTMLInputElement>('input[aria-label^="Nota de"]')!;
      nota.value = '9';
      nota.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(boton(html, 'Confirmar y guardar').disabled).toBe(true);
      expect(html.textContent).toContain('no son un número entre 0 y 5');
    });

    it('una actividad que se deja fuera no se guarda y los porcentajes se reparten de nuevo', async () => {
      const { fixture, html, guardar } = crear();
      await subirPagina(fixture, html);

      html.querySelectorAll<HTMLInputElement>('.cmad__incluir')[1].click();
      fixture.detectChanges();
      boton(html, 'Confirmar y guardar').click();
      await fixture.whenStable();

      const estructura = guardar.mock.calls[0][1];
      expect(estructura[0].actividades).toHaveLength(1);
      expect(estructura[0].actividades[0].porcentaje).toBe(100);
    });

    it('avisa si la tabla es de otro curso', async () => {
      const { fixture, html } = crear('8');

      await subirPagina(fixture, html);

      expect(html.querySelector('[role="alert"]')?.textContent).toContain('no parece ser de Sistemas Operativos');
    });

    it('si la asignatura ya tenía actividades dice que se reemplazan', async () => {
      const conEstructura = vi.fn().mockReturnValue(of([{ ...INGLES, tieneEstructura: true }, SISTEMAS]));
      const { fixture, html } = crear('7', undefined, undefined, conEstructura);

      await subirPagina(fixture, html);

      expect(html.textContent).toContain('se reemplazan por estas');
    });

    it('si ya tenía actividades dice qué cambia: lo que se quita y lo nuevo', async () => {
      const conEstructura = vi.fn().mockReturnValue(of([{ ...INGLES, tieneEstructura: true }, SISTEMAS]));
      const estructuraDe = vi.fn().mockReturnValue(
        of({ categorias: [{ consecutivo: 1, nombre: 'R1', porcentaje: 100, origen: 'estudiante', actividades: [{ consecutivo: 1, nombre: 'Actividad vieja', porcentaje: 100, nota: 3 }] }] }),
      );
      const { fixture, html } = crear('7', undefined, undefined, conEstructura, estructuraDe);

      await subirPagina(fixture, html);

      const cambio = html.querySelector('.import__comparacion')!;
      expect(estructuraDe).toHaveBeenCalledWith(7);
      expect(cambio.textContent).toContain('Se quita: Actividad vieja (tenía 3)');
      expect(cambio.textContent).toContain('Nueva:');
    });

    it('un archivo que no es la tabla muestra el motivo y no avanza', async () => {
      const { fixture, html } = crear();

      await subirPagina(fixture, html, '<html><body>hola</body></html>');

      expect(html.querySelector('[role="alert"]')?.textContent).toContain('No encontramos la tabla');
      expect(html.textContent).not.toContain('Esto encontramos');
    });

    it('si el servidor rechaza la estructura lo dice con su motivo y no sigue con las notas', async () => {
      const guardar = vi.fn().mockReturnValue(throwError(() => ({ status: 422, error: { detail: 'Las categorías deben sumar 100 %' } })));
      const { fixture, html, registrarNota } = crear('7', undefined, guardar);
      await subirPagina(fixture, html);

      boton(html, 'Confirmar y guardar').click();
      await fixture.whenStable();

      expect(notificador.problema).toHaveBeenCalledWith('No pudimos guardar las actividades', 'Las categorías deben sumar 100 %');
      expect(registrarNota).not.toHaveBeenCalled();
    });

    it('ver mis notas lleva a esa asignatura', async () => {
      const { fixture, html, navegar } = crear();
      await subirPagina(fixture, html);
      boton(html, 'Confirmar y guardar').click();
      await fixture.whenStable();
      fixture.detectChanges();

      boton(html, 'Ver mis notas').click();

      expect(navegar).toHaveBeenCalledWith(['/calificaciones/mis-notas'], { queryParams: { matricula: 7 } });
    });
  });

  describe('con una imagen', () => {
    function soltar(html: HTMLElement, archivo: File): void {
      const evento = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(evento, 'dataTransfer', { value: { files: [archivo], types: ['Files'] } });
      html.querySelector('.import__zona')!.dispatchEvent(evento);
    }

    it('ya no se lee: explica por qué y manda a la guía, en vez de devolver números mal leídos', async () => {
      const { fixture, html } = crear();

      soltar(html, new File(['x'], 'captura.png', { type: 'image/png' }));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(html.querySelector('.alert')?.textContent).toContain('Las fotos y capturas no se leen');
      expect(html.textContent).not.toContain('Esto encontramos en el CMAD');
      expect(html.querySelector('#pasos-guia')).not.toBeNull();
    });

    it('el selector de archivos no ofrece imágenes', () => {
      const { html } = crear();

      const aceptados = html.querySelector<HTMLInputElement>('input[type="file"]')!.accept;

      expect(aceptados).not.toContain('image');
      expect(aceptados).toContain('.html');
      expect(aceptados).toContain('.mht');
    });
  });

  describe('la guía para conseguir la página', () => {
    it('viene abierta y explica el computador y el teléfono', () => {
      const { html } = crear();

      const guia = html.querySelector('#pasos-guia')?.textContent ?? '';

      expect(guia).toContain('En el computador');
      expect(guia).toContain('Ctrl + S');
      expect(guia).toContain('.html');
      expect(guia).toContain('En el teléfono Android (Chrome)');
      expect(guia).toContain('.mht');
    });

    it('la página guardada es la única vía: no se ofrece pegar una tabla ni subir una imagen', () => {
      const { html } = crear();

      expect(html.querySelector('textarea')).toBeNull();
      expect(boton(html, 'Leer lo pegado')).toBeUndefined();
      expect(html.querySelectorAll('input[type="file"]')).toHaveLength(1);
    });
  });
});

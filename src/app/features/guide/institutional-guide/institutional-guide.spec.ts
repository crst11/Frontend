import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { GuiaRepository, RecursoInstitucional } from '../../../data-access/guia.repository';
import { InstitutionalGuide } from './institutional-guide';

describe('InstitutionalGuide', () => {
  const reglamentos = { id: 1, nombre: 'Reglamentos' };
  const plantillas = { id: 3, nombre: 'Plantillas y formatos' };
  const reglamento: RecursoInstitucional = {
    id: 1,
    titulo: 'Reglamento Estudiantil (versión 4)',
    descripcion: 'Norma que regula la vida académica.',
    url: 'https://www.ucundinamarca.edu.co/documents/estudiantes/REGLAMENTO%20ESTUDIANTIL%20V4.pdf',
    tipo: 'documento',
    formato: 'PDF',
    descargable: true,
    vigente: true,
    fechaVerificacion: '2026-09-26',
    categoria: reglamentos,
  };
  const gaceta: RecursoInstitucional = {
    ...reglamento,
    id: 2,
    titulo: 'Normatividad institucional (Gaceta)',
    url: 'https://www.ucundinamarca.edu.co/gaceta/',
    tipo: 'enlace',
    formato: null,
    descargable: false,
  };
  const plantillaWord: RecursoInstitucional = {
    ...reglamento,
    id: 3,
    titulo: 'Plantilla de documento en Word',
    url: 'https://www.ucundinamarca.edu.co/sgc/documents/plantillas/PLANTILLA-FORMATO-WORD.docx',
    tipo: 'formato',
    formato: 'Word',
    categoria: plantillas,
  };
  const notificador = { problema: vi.fn() };

  beforeEach(() => notificador.problema.mockReset().mockResolvedValue(undefined));

  function crear(buscar: ReturnType<typeof vi.fn>) {
    const repositorio = {
      buscar,
      categorias: vi.fn().mockReturnValue(of([reglamentos, plantillas])),
      sugerencias: vi.fn().mockReturnValue(of(['Plantillas', 'Calendario académico'])),
    };
    TestBed.configureTestingModule({
      imports: [InstitutionalGuide],
      providers: [
        provideRouter([]),
        { provide: GuiaRepository, useValue: repositorio },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    const fixture = TestBed.createComponent(InstitutionalGuide);
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement, buscar };
  }

  function boton(html: HTMLElement, texto: string): HTMLButtonElement {
    return Array.from(html.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === texto)!;
  }

  it('muestra toda la guía agrupada por categoría, con las sugerencias para buscar', () => {
    const { html } = crear(vi.fn().mockReturnValue(of([reglamento, gaceta, plantillaWord])));

    const grupos = Array.from(html.querySelectorAll('.guide__group-title')).map((h) => h.textContent?.replace(/\s+/g, ' ').trim());
    expect(grupos).toEqual(['Reglamentos 2', 'Plantillas y formatos 1']);
    expect(html.textContent).toContain('Búsquedas sugeridas');
    expect(boton(html, 'Plantillas')).toBeTruthy();
  });

  it('cada documento enlaza a su fuente oficial y dice si se descarga, si sigue vigente y cuándo se verificó', () => {
    const { html } = crear(vi.fn().mockReturnValue(of([reglamento, gaceta])));

    const enlaces = Array.from(html.querySelectorAll<HTMLAnchorElement>('.guide__action'));
    expect(enlaces[0].textContent?.trim()).toBe('Descargar PDF');
    expect(enlaces[0].href).toBe(reglamento.url);
    expect(enlaces[0].target).toBe('_blank');
    expect(enlaces[0].rel).toContain('noopener');
    expect(enlaces[1].textContent?.trim()).toBe('Abrir página oficial');
    expect(enlaces[1].hasAttribute('download')).toBe(false);
    expect(html.textContent).toContain('Vigente');
    expect(html.textContent).toContain('Verificado el');
  });

  it('una sugerencia busca de inmediato y queda marcada', () => {
    const buscar = vi.fn().mockReturnValueOnce(of([reglamento, plantillaWord])).mockReturnValueOnce(of([plantillaWord]));
    const { fixture, html } = crear(buscar);

    boton(html, 'Plantillas').click();
    fixture.detectChanges();

    expect(buscar).toHaveBeenLastCalledWith('Plantillas', null);
    expect(html.querySelectorAll('.guide__doc').length).toBe(1);
    expect(boton(html, 'Plantillas').getAttribute('aria-pressed')).toBe('true');
    expect(html.querySelector<HTMLInputElement>('#buscar')!.value).toBe('Plantillas');
  });

  it('al escribir espera a que la persona termine antes de buscar', () => {
    vi.useFakeTimers();
    try {
      const buscar = vi.fn().mockReturnValue(of([reglamento]));
      const { html } = crear(buscar);
      const campo = html.querySelector<HTMLInputElement>('#buscar')!;

      for (const texto of ['c', 'ca', 'cal']) {
        campo.value = texto;
        campo.dispatchEvent(new Event('input'));
      }
      expect(buscar).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(300);

      expect(buscar).toHaveBeenCalledTimes(2);
      expect(buscar).toHaveBeenLastCalledWith('cal', null);
    } finally {
      vi.useRealTimers();
    }
  });

  it('filtra por categoría conservando lo que se buscó', () => {
    const buscar = vi.fn().mockReturnValue(of([plantillaWord]));
    const { fixture, html } = crear(buscar);

    boton(html, 'Plantillas y formatos').click();
    fixture.detectChanges();

    expect(buscar).toHaveBeenLastCalledWith('', 3);
    expect(boton(html, 'Todas').getAttribute('aria-pressed')).toBe('false');
  });

  it('si no encuentra nada lo dice y propone las sugerencias', () => {
    const buscar = vi.fn().mockReturnValueOnce(of([reglamento])).mockReturnValueOnce(of([]));
    const { fixture, html } = crear(buscar);

    boton(html, 'Calendario académico').click();
    fixture.detectChanges();

    expect(html.querySelector('.guide__empty')?.textContent).toContain('No encontramos documentos');
    expect(html.querySelector('.guide__empty')?.textContent).toContain('Prueba con uno de estos temas');
  });

  it('sin búsqueda ni resultados no muestra comillas vacías', () => {
    const { html } = crear(vi.fn().mockReturnValue(of([])));

    expect(html.querySelector('.guide__empty')?.textContent).toContain('La guía todavía no tiene documentos');
    expect(html.querySelector('.guide__empty')?.textContent).not.toContain('«»');
  });

  it('si el servidor no responde lo avisa en pantalla y en una ventana', () => {
    const { html } = crear(vi.fn().mockReturnValue(throwError(() => ({ status: 0 }))));

    expect(html.querySelector('[role="alert"]')).toBeTruthy();
    expect(notificador.problema).toHaveBeenCalledWith('No pudimos cargar la guía', expect.any(String));
  });
});

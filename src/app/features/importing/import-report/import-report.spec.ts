import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotifierService } from '../../../core/feedback/notifier.service';
import {
  AnalisisDeImportacion,
  Importacion,
  ImportacionRepository,
} from '../../../data-access/importacion.repository';
import { ImportReport } from './import-report';

describe('ImportReport', () => {
  const notificador = { exito: vi.fn(), problema: vi.fn(), aviso: vi.fn(), confirmar: vi.fn() };

  const CARGAS: Importacion[] = [
    {
      id: 2,
      tipoReporte: 'historial',
      nombreArchivo: 'registro_extendido.pdf',
      fechaCarga: '2026-10-04T14:30:00Z',
      estado: 'confirmada',
      detectadas: 30,
      confirmadas: 30,
      sePuedeDeshacer: true,
    },
    {
      id: 1,
      tipoReporte: 'historial',
      nombreArchivo: 'registro_extendido.pdf',
      fechaCarga: '2026-09-01T10:00:00Z',
      estado: 'confirmada',
      detectadas: 20,
      confirmadas: 20,
      sePuedeDeshacer: false,
    },
  ];

  const DETECTADO: AnalisisDeImportacion = {
    nombreArchivo: 'registro_extendido.pdf',
    programaDelReporte: 'INGENIERIA DE SISTEMAS Y COMPUTACION',
    sedeDelReporte: 'FUSAGASUGÁ',
    coincideConMiPrograma: true,
    detectadas: 3,
    seVanAGuardar: 2,
    periodos: [
      {
        codigo: '2024-2',
        creditosMatriculados: 16,
        creditosAprobados: 16,
        promedioPeriodo: 4.4,
        promedioAcumulado: 4.4,
        asignaturas: [
          { codigo: 'A', nombre: 'Álgebra Lineal', creditos: 3, nota: 4.2, estado: 'aprobada', enElPlan: true, yaEstaba: false },
          { codigo: 'B', nombre: 'Física I', creditos: 4, nota: 4.9, estado: 'aprobada', enElPlan: true, yaEstaba: true },
          { codigo: 'X', nombre: 'X', creditos: 0, nota: 4.0, estado: 'aprobada', enElPlan: false, yaEstaba: false },
        ],
      },
    ],
  };

  beforeEach(() => {
    notificador.exito.mockReset().mockResolvedValue(undefined);
    notificador.problema.mockReset().mockResolvedValue(undefined);
    notificador.aviso.mockReset().mockResolvedValue(undefined);
    notificador.confirmar.mockReset().mockResolvedValue(true);
  });

  function crear(
    analizar = vi.fn().mockReturnValue(of(DETECTADO)),
    confirmar = vi.fn().mockReturnValue(of({ idImportacion: 1, guardadas: 2, actualizadas: 0, omitidas: 1 })),
    misImportaciones = vi.fn().mockReturnValue(of(CARGAS)),
    deshacer = vi.fn().mockReturnValue(of({ idImportacion: 2, eliminadas: 12, restauradas: 8 })),
  ) {
    TestBed.configureTestingModule({
      imports: [ImportReport],
      providers: [
        provideRouter([]),
        { provide: ImportacionRepository, useValue: { analizar, confirmar, misImportaciones, deshacer } },
        { provide: NotifierService, useValue: notificador },
      ],
    });
    // Sin esto, confirmar lanza una navegación real contra un router sin rutas y Vitest la cuenta
    // como error no manejado aunque la prueba pase.
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ImportReport);
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement, analizar, confirmar, deshacer, navegar };
  }

  function boton(html: HTMLElement, texto: string): HTMLButtonElement {
    return Array.from(html.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(texto),
    )!;
  }

  function subir(fixture: ReturnType<typeof crear>['fixture'], html: HTMLElement) {
    const entrada = html.querySelector<HTMLInputElement>('input[type="file"]')!;
    const archivo = new File(['%PDF-1.4'], 'registro_extendido.pdf', { type: 'application/pdf' });
    Object.defineProperty(entrada, 'files', { value: [archivo], configurable: true });
    entrada.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('empieza pidiendo el archivo y explicando de dónde sale', () => {
    const { html } = crear();

    expect(html.querySelector('input[type="file"]')).not.toBeNull();
    expect(html.textContent).toContain('¿Dónde consigo ese archivo?');
  });

  it('la guía lista los pasos de la plataforma de la universidad', () => {
    const { fixture, html } = crear();

    boton(html, '¿Dónde consigo ese archivo?').click();
    fixture.detectChanges();

    expect(html.querySelectorAll('.import__paso')).toHaveLength(6);
    expect(html.textContent).toContain('Consultar Registro Extendido');
    expect(html.textContent).toContain('Guardar como PDF');
  });

  it('al subir el archivo muestra lo detectado sin guardar nada', () => {
    const { fixture, html, analizar, confirmar } = crear();

    subir(fixture, html);

    expect(analizar).toHaveBeenCalled();
    expect(confirmar).not.toHaveBeenCalled();
    expect(html.textContent).toContain('Esto encontramos en tu reporte');
    expect(html.textContent).toContain('Álgebra Lineal');
  });

  it('cuenta aparte lo nuevo y lo que se actualiza', () => {
    const { fixture, html } = crear();

    subir(fixture, html);

    const cuentas = Array.from(html.querySelectorAll('.import__cuentas dd')).map((d) => d.textContent?.trim());
    expect(cuentas).toEqual(['1', '1', '1']);
  });

  it('avisa cuáles no están en la ruta de aprendizaje en vez de descartarlas en silencio', () => {
    const { fixture, html } = crear();

    subir(fixture, html);

    expect(html.textContent).toContain('no se van a guardar');
    expect(html.querySelector('.import__asignatura--fuera')).not.toBeNull();
  });

  it('avisa si el reporte es de otro programa, pero no bloquea', () => {
    const otroPrograma = { ...DETECTADO, coincideConMiPrograma: false, programaDelReporte: 'OTRA CARRERA' };
    const { fixture, html } = crear(vi.fn().mockReturnValue(of(otroPrograma)));

    subir(fixture, html);

    expect(html.querySelector('[role="alert"]')?.textContent).toContain('OTRA CARRERA');
    expect(boton(html, 'Confirmar y guardar')).toBeDefined();
  });

  it('al confirmar manda solo las que están en el plan', async () => {
    const { fixture, html, confirmar } = crear();
    subir(fixture, html);

    boton(html, 'Confirmar y guardar').click();
    await fixture.whenStable();

    const enviado = confirmar.mock.calls[0][0];
    expect(enviado.periodos[0].notas.map((n: { codigoAsignatura: string }) => n.codigoAsignatura)).toEqual(['A', 'B']);
    expect(enviado.nombreArchivo).toBe('registro_extendido.pdf');
  });

  it('al guardar lleva al historial', async () => {
    const { fixture, html, navegar } = crear();
    subir(fixture, html);

    boton(html, 'Confirmar y guardar').click();
    await fixture.whenStable();

    expect(navegar).toHaveBeenCalledWith(['/cuenta/historial']);
  });

  it('si el archivo no se puede leer lo explica y ofrece el registro manual', () => {
    const { fixture, html } = crear(
      vi.fn().mockReturnValue(throwError(() => ({ status: 422, error: { detail: 'El archivo no parece un Registro Académico Extendido' } }))),
    );

    subir(fixture, html);

    expect(html.querySelector('[role="alert"]')?.textContent).toContain('no parece un Registro Académico Extendido');
    expect(html.textContent).toContain('registrarlas a mano');
  });

  it('muestra las cargas anteriores con su resumen', () => {
    const { html } = crear();

    expect(html.querySelectorAll('.import__carga')).toHaveLength(2);
    expect(html.textContent).toContain('Tus cargas anteriores');
    expect(html.textContent).toContain('30 asignaturas');
  });

  it('solo ofrece deshacer la carga que el servidor marca como deshacible', () => {
    const { html } = crear();

    expect(html.querySelectorAll('.import__deshacer')).toHaveLength(1);
    expect(html.textContent).toContain('Solo se puede deshacer la última carga');
  });

  it('al deshacer dice cuántas se quitaron y cuántas volvieron a su nota', async () => {
    const { fixture, html, deshacer } = crear();

    boton(html, 'Deshacer').click();
    await fixture.whenStable();

    expect(deshacer).toHaveBeenCalledWith(2);
    expect(notificador.aviso).toHaveBeenCalledWith(expect.stringContaining('12 se quitaron'));
    expect(notificador.aviso).toHaveBeenCalledWith(expect.stringContaining('8 volvieron'));
  });

  it('no deshace nada si la persona cancela la confirmación', async () => {
    notificador.confirmar.mockResolvedValue(false);
    const { fixture, html, deshacer } = crear();

    boton(html, 'Deshacer').click();
    await fixture.whenStable();

    expect(deshacer).not.toHaveBeenCalled();
  });

  it('si el historial de cargas no carga, la pantalla sigue sirviendo para importar', () => {
    const { html } = crear(undefined, undefined, vi.fn().mockReturnValue(throwError(() => ({ status: 500 }))));

    expect(html.querySelector('input[type="file"]')).not.toBeNull();
    expect(html.querySelectorAll('.import__carga')).toHaveLength(0);
  });

  it('se puede volver a empezar para subir otro archivo', () => {
    const { fixture, html } = crear();
    subir(fixture, html);

    boton(html, 'Subir otro archivo').click();
    fixture.detectChanges();

    expect(html.querySelector('input[type="file"]')).not.toBeNull();
    expect(html.textContent).not.toContain('Esto encontramos en tu reporte');
  });
});

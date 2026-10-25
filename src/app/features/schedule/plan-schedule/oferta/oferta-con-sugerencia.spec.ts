import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AsignaturaDeOferta } from '../../../../data-access/propuesta-de-horario.repository';
import { MateriaSugerida, SugerenciaDeMatricula } from '../../../../data-access/sugerencia-de-matricula.repository';
import { OfertaDeLaUniversidad, ResumenDeAdelantables } from './oferta-de-la-universidad';
import { OFERTA_DE_EJEMPLO } from './oferta-de-ejemplo';

const enWindows1252 = (texto: string): Uint8Array<ArrayBuffer> => Uint8Array.from(texto, (letra) => letra.charCodeAt(0));

const materia = (
  codigo: string,
  nombre: string,
  creditos: number,
  semestre: number,
  motivoDeSugerencia: MateriaSugerida['motivoDeSugerencia'] = 'siguiente_semestre',
  prerrequisitos: string[] = [],
): MateriaSugerida => ({ codigo, nombre, creditos, semestre, motivoDeSugerencia, dependeDeUnaEnCurso: false, prerrequisitos });

/**
 * La oferta de ejemplo trae el semestre 1 (Álgebra Lineal, Fundamentos de Electrónica), el 2 (Comunicación y Lectura
 * Crítica I, Física I) y el 8 (dos líneas de Profundización I). A esta persona le toca el semestre 2.
 */
const SUGERENCIA: SugerenciaDeMatricula = {
  semestreActual: 1,
  semestreSugerido: 2,
  materias: [
    materia('CAI1002020202', 'Comunicación y lectura crítica I', 3, 2),
    materia('CAD612021208', 'Física I', 3, 2),
    materia('CAD9999', 'Materia que la oferta no trae', 2, 2),
  ],
  creditos: 8,
  adelantables: [
    materia('CAD612021101', 'Álgebra lineal', 3, 1, 'adelantable'),
    materia('CAD612021836', 'Profundización I', 10, 8, 'adelantable', ['Física I']),
    materia('CAD8888', 'Adelantable que la oferta no trae', 2, 5, 'adelantable'),
  ],
  creditosDelSemestre: 6,
  motivo: null,
};

describe('OfertaDeLaUniversidad con la sugerencia de matrícula (SCRUM-244 y SCRUM-257)', () => {
  let fixture: ComponentFixture<OfertaDeLaUniversidad>;
  let emitidas: AsignaturaDeOferta[][];
  let siguiendo: boolean[];
  let resumenes: (ResumenDeAdelantables | null)[];

  const pantalla = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const consultar = <T extends Element>(selector: string): T | null => pantalla().querySelector<T>(selector);
  const ultima = (): string[] => emitidas[emitidas.length - 1].map((m) => m.nombre);
  const ultimoResumen = (): ResumenDeAdelantables | null => resumenes[resumenes.length - 1];
  const texto = (): string => (pantalla().textContent ?? '').replace(/\s+/g, ' ');
  const casilla = (codigo: string): HTMLInputElement => consultar<HTMLInputElement>(`input[data-codigo="${codigo}"]`)!;
  const semestreElegido = (): string => consultar<HTMLSelectElement>('#oferta-semestre')!.value;

  function marcar(codigo: string): void {
    casilla(codigo).click();
    fixture.detectChanges();
  }

  function elegirSemestre(numero: number): void {
    const lista = consultar<HTMLSelectElement>('#oferta-semestre')!;
    lista.value = String(numero);
    lista.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  async function crearConOferta(sugerencia: SugerenciaDeMatricula | null): Promise<void> {
    TestBed.configureTestingModule({ imports: [OfertaDeLaUniversidad] });
    fixture = TestBed.createComponent(OfertaDeLaUniversidad);
    fixture.componentRef.setInput('sugerencia', sugerencia);
    emitidas = [];
    siguiendo = [];
    resumenes = [];
    fixture.componentInstance.materiasElegidas.subscribe((materias) => emitidas.push(materias));
    fixture.componentInstance.siguiendoSugerencia.subscribe((valor) => siguiendo.push(valor));
    fixture.componentInstance.resumenDeAdelantables.subscribe((valor) => resumenes.push(valor));
    fixture.detectChanges();
    const entrada = consultar<HTMLInputElement>('#oferta-archivo')!;
    Object.defineProperty(entrada, 'files', {
      value: [new File([enWindows1252(OFERTA_DE_EJEMPLO)], 'pub_rep_val.html')],
      configurable: true,
    });
    entrada.dispatchEvent(new Event('change'));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(consultar('.oferta__semestre')).not.toBeNull();
    });
  }

  it('arranca en el semestre que le toca, con sus materias marcadas y sin una tarjeta aparte de sugeridos', async () => {
    await crearConOferta(SUGERENCIA);

    expect(semestreElegido()).toBe('2');
    expect(texto()).toContain('Dejamos elegido el semestre 2');
    expect(texto()).not.toContain('Lo que te sugerimos');
    expect(consultar('.oferta__sugerencia')).toBeNull();
    expect(casilla('CAI1002020202').checked).toBe(true);
    expect(casilla('CAD612021208').checked).toBe(true);
    expect(ultima()).toEqual(['COMUNICACIÓN Y LECTURA CRÍTICA I', 'FISICA I']);
  });

  it('avisa de las materias sugeridas que la oferta de este período no trae', async () => {
    await crearConOferta(SUGERENCIA);

    expect(consultar('.oferta__sin-oferta')!.textContent).toContain('Materia que la oferta no trae');
    expect(consultar('.oferta__sin-oferta')!.textContent).not.toContain('Adelantable que la oferta no trae');
  });

  it('avisa que sigue la sugerencia y resume lo adelantable, con los créditos del plan y los marcados', async () => {
    await crearConOferta(SUGERENCIA);

    expect(siguiendo[siguiendo.length - 1]).toBe(true);
    expect(ultimoResumen()).toEqual({
      adelantables: [
        { codigo: 'CAD612021101', nombre: 'Álgebra lineal', creditos: 3, requisito: 'no tiene prerrequisitos' },
        { codigo: 'CAD612021836', nombre: 'Profundización I', creditos: 10, requisito: 'ya aprobaste Física I' },
      ],
      creditosDelSemestre: 6,
      creditosMarcados: 6,
    });
  });

  it('al quitar una materia le resta sus créditos al resumen y al volver a marcarla se los suma', async () => {
    await crearConOferta(SUGERENCIA);

    marcar('CAD612021208');

    expect(ultimoResumen()!.creditosMarcados).toBe(3);
    expect(ultima()).toEqual(['COMUNICACIÓN Y LECTURA CRÍTICA I']);

    marcar('CAD612021208');

    expect(ultimoResumen()!.creditosMarcados).toBe(6);
  });

  it('al elegir otro semestre deja de seguir la sugerencia: sin aviso de adelantables ni resumen', async () => {
    await crearConOferta(SUGERENCIA);

    elegirSemestre(1);

    expect(siguiendo[siguiendo.length - 1]).toBe(false);
    expect(ultimoResumen()).toBeNull();
    expect(texto()).not.toContain('Dejamos elegido');
    expect(consultar('.oferta__sin-oferta')).toBeNull();
    expect(ultima()).toEqual(['ÁLGEBRA LINEAL', 'FUNDAMENTOS DE ELECTRÓNICA']);

    elegirSemestre(2);

    expect(siguiendo[siguiendo.length - 1]).toBe(true);
    expect(ultimoResumen()).not.toBeNull();
  });

  it('sin sugerencia se ve y funciona como siempre: elegir el semestre y las materias', async () => {
    await crearConOferta(null);

    expect(semestreElegido()).toBe('1');
    expect(texto()).not.toContain('Dejamos elegido');
    expect(siguiendo[siguiendo.length - 1]).toBe(false);
    expect(ultimoResumen()).toBeNull();
  });

  it('con una sugerencia sin semestre (sin plan, sin historial) arranca en el primero y no la nombra', async () => {
    await crearConOferta({ ...SUGERENCIA, semestreSugerido: null, materias: [], adelantables: [], creditos: 0, motivo: 'Elige tu programa.' });

    expect(semestreElegido()).toBe('1');
    expect(texto()).not.toContain('Dejamos elegido');
    expect(ultimoResumen()).toBeNull();
  });

  it('si la oferta no trae el semestre sugerido arranca en el primero y no habla de adelantables', async () => {
    await crearConOferta({ ...SUGERENCIA, semestreSugerido: 5 });

    expect(semestreElegido()).toBe('1');
    expect(siguiendo[siguiendo.length - 1]).toBe(false);
    expect(ultimoResumen()).toBeNull();
  });

  it('si la sugerencia llega después de la oferta, deja elegido el semestre sugerido', async () => {
    await crearConOferta(null);

    fixture.componentRef.setInput('sugerencia', SUGERENCIA);
    fixture.detectChanges();

    expect(semestreElegido()).toBe('2');
    expect(texto()).toContain('Dejamos elegido el semestre 2');
    expect(ultima()).toEqual(['COMUNICACIÓN Y LECTURA CRÍTICA I', 'FISICA I']);
    expect(ultimoResumen()).not.toBeNull();
  });
});

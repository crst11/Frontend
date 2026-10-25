import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AsignaturaDeOferta } from '../../../../data-access/propuesta-de-horario.repository';
import { MateriaSugerida, SugerenciaDeMatricula } from '../../../../data-access/sugerencia-de-matricula.repository';
import { OfertaDeLaUniversidad } from './oferta-de-la-universidad';
import { OFERTA_DE_EJEMPLO } from './oferta-de-ejemplo';

const enWindows1252 = (texto: string): Uint8Array<ArrayBuffer> => Uint8Array.from(texto, (letra) => letra.charCodeAt(0));

const materia = (
  codigo: string,
  nombre: string,
  creditos: number,
  motivoDeSugerencia: MateriaSugerida['motivoDeSugerencia'] = 'siguiente_semestre',
  dependeDeUnaEnCurso = false,
): MateriaSugerida => ({ codigo, nombre, creditos, semestre: 3, motivoDeSugerencia, dependeDeUnaEnCurso });

/** La oferta de ejemplo trae Álgebra Lineal, Fundamentos de Electrónica, Física I y dos líneas de Profundización I. */
const SUGERENCIA: SugerenciaDeMatricula = {
  semestreActual: 2,
  semestreSugerido: 3,
  materias: [
    materia('CAD612021101', 'Álgebra lineal', 3),
    materia('CAD612021106', 'Fundamentos de electrónica', 4, 'pendiente', true),
    materia('CAD612021836', 'Profundización I', 10),
    materia('CAD9999', 'Materia que la oferta no trae', 2),
  ],
  creditos: 19,
  adelantables: [materia('CAD612021208', 'Física I', 3, 'adelantable')],
  motivo: null,
};

describe('OfertaDeLaUniversidad con la sugerencia de matrícula (SCRUM-244)', () => {
  let fixture: ComponentFixture<OfertaDeLaUniversidad>;
  let emitidas: AsignaturaDeOferta[][];

  const pantalla = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const consultar = <T extends Element>(selector: string): T | null => pantalla().querySelector<T>(selector);
  const ultima = (): string[] => emitidas[emitidas.length - 1].map((m) => m.nombre);
  const texto = (): string => (pantalla().textContent ?? '').replace(/\s+/g, ' ');
  const casilla = (codigo: string): HTMLInputElement => consultar<HTMLInputElement>(`input[data-codigo="${codigo}"]`)!;

  function marcar(codigo: string): void {
    casilla(codigo).click();
    fixture.detectChanges();
  }

  async function crearConOferta(sugerencia: SugerenciaDeMatricula | null): Promise<void> {
    TestBed.configureTestingModule({ imports: [OfertaDeLaUniversidad] });
    fixture = TestBed.createComponent(OfertaDeLaUniversidad);
    fixture.componentRef.setInput('sugerencia', sugerencia);
    emitidas = [];
    fixture.componentInstance.materiasElegidas.subscribe((materias) => emitidas.push(materias));
    fixture.detectChanges();
    const entrada = consultar<HTMLInputElement>('#oferta-archivo')!;
    Object.defineProperty(entrada, 'files', {
      value: [new File([enWindows1252(OFERTA_DE_EJEMPLO)], 'pub_rep_val.html')],
      configurable: true,
    });
    entrada.dispatchEvent(new Event('change'));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(consultar('.oferta__semestre, .oferta__sugerencia')).not.toBeNull();
    });
  }

  it('muestra lo sugerido para el semestre siguiente sin marcar nada: son sugerencias, la persona decide', async () => {
    await crearConOferta(SUGERENCIA);

    expect(texto()).toContain('Lo que te sugerimos para el semestre 3');
    expect(texto()).toContain('Son solo sugerencias');
    expect(casilla('CAD612021101').checked).toBe(false);
    expect(casilla('CAD612021106').checked).toBe(false);
    expect(consultar('.oferta__creditos')!.textContent).toContain('0 créditos');
    expect(ultima()).toEqual([]);
    expect(consultar('#oferta-semestre')).toBeNull();
  });

  it('dice el motivo de cada materia y avisa cuando depende de una que se cursa ahora', async () => {
    await crearConOferta(SUGERENCIA);

    expect(texto()).toContain('Te toca');
    expect(texto()).toContain('Pendiente');
    expect(texto()).toContain('Depende de una materia que cursas ahora');
  });

  it('suma los créditos de lo que la persona marca y los resta al desmarcar una materia', async () => {
    await crearConOferta(SUGERENCIA);

    marcar('CAD612021101');
    marcar('CAD612021106');

    expect(consultar('.oferta__creditos')!.textContent).toContain('7 créditos');
    expect(ultima()).toEqual(['ÁLGEBRA LINEAL', 'FUNDAMENTOS DE ELECTRÓNICA']);

    marcar('CAD612021106');

    expect(consultar('.oferta__creditos')!.textContent).toContain('3 créditos');
    expect(ultima()).toEqual(['ÁLGEBRA LINEAL']);
  });

  it('dice en texto lo que se podría adelantar según los créditos que sobren, sin casilla para marcarlo', async () => {
    await crearConOferta(SUGERENCIA);

    expect(texto()).toContain('Podrías adelantar');
    expect(texto()).toContain('Si te sobran 3 créditos: Física I.');
    expect(casilla('CAD612021208')).toBeNull();
  });

  it('en una materia con varias líneas la persona elige una y se cuentan sus créditos una sola vez', async () => {
    await crearConOferta(SUGERENCIA);
    expect(casilla('CAD612021836-A').checked).toBe(false);
    expect(casilla('CAD612021836-B').checked).toBe(false);

    marcar('CAD612021836-A');

    expect(consultar('.oferta__creditos')!.textContent).toContain('10 créditos');
  });

  it('avisa de las materias sugeridas que la oferta de este período no trae', async () => {
    await crearConOferta(SUGERENCIA);

    expect(consultar('.oferta__sin-oferta')!.textContent).toContain('Materia que la oferta no trae');
  });

  it('deja volver a elegir a mano, con el semestre y las casillas de siempre, y volver a la sugerencia', async () => {
    await crearConOferta(SUGERENCIA);

    consultar<HTMLButtonElement>('.oferta__modo')!.click();
    fixture.detectChanges();

    expect(consultar('#oferta-semestre')).not.toBeNull();
    expect(consultar('.oferta__sugerencia')).toBeNull();

    consultar<HTMLButtonElement>('.oferta__modo')!.click();
    fixture.detectChanges();

    expect(consultar('.oferta__sugerencia')).not.toBeNull();
    expect(consultar('#oferta-semestre')).toBeNull();
  });

  it('sin sugerencia se ve y funciona como siempre: elegir el semestre y las materias', async () => {
    await crearConOferta(null);

    expect(consultar('#oferta-semestre')).not.toBeNull();
    expect(consultar('.oferta__sugerencia')).toBeNull();
    expect(consultar('.oferta__modo')).toBeNull();
  });

  it('con una sugerencia sin semestre (sin plan, sin historial) cae al armado manual y no la nombra', async () => {
    await crearConOferta({ ...SUGERENCIA, semestreSugerido: null, materias: [], adelantables: [], creditos: 0, motivo: 'Elige tu programa.' });

    expect(consultar('#oferta-semestre')).not.toBeNull();
    expect(consultar('.oferta__modo')).toBeNull();
  });

  it('si la sugerencia llega después de la oferta, se muestra igual y sin nada marcado', async () => {
    await crearConOferta(null);

    fixture.componentRef.setInput('sugerencia', SUGERENCIA);
    fixture.detectChanges();

    expect(texto()).toContain('Lo que te sugerimos para el semestre 3');
    expect(casilla('CAD612021101').checked).toBe(false);
    expect(ultima()).toEqual([]);
  });
});

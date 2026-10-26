import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Adelantable } from './sugerencia-en-oferta';
import { AdelantablesDeLaSugerencia } from './adelantables-de-la-sugerencia';

const GESTION: Adelantable = { codigo: 'G', nombre: 'Gestión', creditos: 2, requisito: 'no tiene prerrequisitos' };
const FISICA: Adelantable = { codigo: 'F', nombre: 'Física I', creditos: 3, requisito: 'ya aprobaste Cálculo I' };
const ADELANTABLES: Adelantable[] = [GESTION, FISICA];

describe('AdelantablesDeLaSugerencia (SCRUM-257)', () => {
  let fixture: ComponentFixture<AdelantablesDeLaSugerencia>;

  const pantalla = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texto = (): string => (pantalla().textContent ?? '').replace(/\s+/g, ' ');
  const campo = (): HTMLInputElement => pantalla().querySelector<HTMLInputElement>('#adelantables-creditos')!;
  const filas = (): string[] => Array.from(pantalla().querySelectorAll('li')).map((li) => (li.textContent ?? '').replace(/\s+/g, ' ').trim());
  const resultado = (): string => (pantalla().querySelector('.adelantables__resultado')?.textContent ?? '').replace(/\s+/g, ' ').trim();

  function crear(adelantables: Adelantable[], creditosDelSemestre: number, creditosMarcados: number): void {
    TestBed.configureTestingModule({ imports: [AdelantablesDeLaSugerencia] });
    fixture = TestBed.createComponent(AdelantablesDeLaSugerencia);
    fixture.componentRef.setInput('adelantables', adelantables);
    fixture.componentRef.setInput('creditosDelSemestre', creditosDelSemestre);
    fixture.componentRef.setInput('creditosMarcados', creditosMarcados);
    fixture.detectChanges();
  }

  function escribir(valor: string): void {
    campo().value = valor;
    campo().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('arranca con los créditos que el plan asigna al semestre', () => {
    crear(ADELANTABLES, 17, 17);

    expect(campo().value).toBe('17');
    expect(texto()).toContain('Empieza con los 17 que el plan asigna a tu semestre');
    expect(pantalla().querySelector('.adelantables__restaurar')).toBeNull();
  });

  it('muestra todas las que podría adelantar, con su requisito, antes de la casilla de créditos', () => {
    crear(ADELANTABLES, 17, 17);

    expect(filas()).toHaveLength(2);
    expect(filas()[0]).toContain('Gestión (2 créditos): no tiene prerrequisitos.');
    expect(filas()[1]).toContain('Física I (3 créditos): ya aprobaste Cálculo I.');
    const lista = pantalla().querySelector('.adelantables__lista')!;
    expect(lista.compareDocumentPosition(campo()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('dice que ahora no puede adelantar ninguna cuando lo marcado ya llena los créditos disponibles', () => {
    crear(ADELANTABLES, 17, 17);

    expect(resultado()).toContain('Ahora no puedes adelantar ninguna');
    expect(resultado()).toContain('Tendrías que tener más créditos disponibles');
    expect(filas()[0]).toContain('Te faltan 2 créditos');
    expect(filas()[1]).toContain('Te faltan 3 créditos');
  });

  it('con créditos que sobran marca las que le caben y dice cuántos le faltarían para las otras', () => {
    crear(ADELANTABLES, 17, 15);

    expect(resultado()).toContain('Te sobran 2 créditos: te alcanza para la primera de la lista');
    expect(filas()[0]).toContain('Gestión');
    expect(filas()[0]).toContain('Te alcanza');
    expect(filas()[1]).toContain('Física I');
    expect(filas()[1]).toContain('Te falta 1 crédito');
  });

  it('con más créditos disponibles le alcanza para todas', () => {
    crear(ADELANTABLES, 17, 14);

    expect(resultado()).toContain('Te sobran 3 créditos: te alcanza para las primeras 2 de la lista');
    expect(filas().every((fila) => fila.includes('Te alcanza'))).toBe(true);
  });

  it('pone primero las que le caben en lo que sobra, aunque la lista llegue en otro orden', () => {
    crear([FISICA, GESTION], 17, 15);

    expect(filas()[0]).toContain('Gestión');
    expect(filas()[1]).toContain('Física I');
  });

  it('deja editar los créditos, reordena y recalcula; se puede volver a los del plan', () => {
    crear(ADELANTABLES, 17, 17);

    escribir('19');

    expect(resultado()).toContain('Te sobran 2 créditos');
    expect(filas()[0]).toContain('Gestión');
    expect(filas()[0]).toContain('Te alcanza');
    expect(pantalla().querySelector('.adelantables__restaurar')).not.toBeNull();

    pantalla().querySelector<HTMLButtonElement>('.adelantables__restaurar')!.click();
    fixture.detectChanges();

    expect(campo().value).toBe('17');
    expect(resultado()).toContain('Ahora no puedes adelantar ninguna');
  });

  it('dice que no le alcanza para ninguna todavía cuando sobra menos de lo que pide cada una', () => {
    crear(ADELANTABLES, 17, 16);

    expect(resultado()).toContain('Te sobra 1 crédito, pero todavía no te alcanza para ninguna');
    expect(resultado()).toContain('Tendrías que tener más créditos disponibles');
    expect(filas()[0]).toContain('Te falta 1 crédito');
  });

  it('con el campo vacío o con algo que no es un entero pide escribir los créditos y no compara', () => {
    crear(ADELANTABLES, 17, 17);

    escribir('');
    expect(resultado()).toContain('Escribe tus créditos');
    expect(filas()).toHaveLength(2);
    expect(texto()).not.toContain('Te alcanza');

    escribir('2.5');
    expect(resultado()).toContain('Escribe tus créditos');

    escribir('999');
    expect(resultado()).toContain('Escribe tus créditos');
  });

  it('avisa cuando la oferta no trae nada para adelantar y no muestra la casilla', () => {
    crear([], 17, 10);

    expect(texto()).toContain('no trae materias de semestres siguientes');
    expect(pantalla().querySelector('#adelantables-creditos')).toBeNull();
  });
});

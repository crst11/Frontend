import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Adelantable } from './sugerencia-en-oferta';
import { AdelantablesDeLaSugerencia } from './adelantables-de-la-sugerencia';

const ADELANTABLES: Adelantable[] = [
  { codigo: 'G', nombre: 'Gestión', creditos: 2, requisito: 'no tiene prerrequisitos' },
  { codigo: 'F', nombre: 'Física I', creditos: 3, requisito: 'ya aprobaste Cálculo I' },
];

describe('AdelantablesDeLaSugerencia (SCRUM-257)', () => {
  let fixture: ComponentFixture<AdelantablesDeLaSugerencia>;

  const pantalla = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texto = (): string => (pantalla().textContent ?? '').replace(/\s+/g, ' ');
  const campo = (): HTMLInputElement => pantalla().querySelector<HTMLInputElement>('#adelantables-creditos')!;

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

  it('dice que no sobran créditos cuando lo marcado ya llena lo disponible', () => {
    crear(ADELANTABLES, 17, 17);

    expect(texto()).toContain('no te sobran créditos para adelantar');
    expect(texto()).not.toContain('Gestión');
  });

  it('con créditos que sobran lista solo las que caben, cada una con su requisito', () => {
    crear(ADELANTABLES, 17, 15);

    expect(texto()).toContain('Te sobran 2 créditos: podrías sumar');
    expect(texto()).toContain('Gestión (2 créditos): no tiene prerrequisitos.');
    expect(texto()).not.toContain('Física I');
  });

  it('con más créditos disponibles caben todas y se dice el requisito de la que lo pide', () => {
    crear(ADELANTABLES, 17, 14);

    expect(texto()).toContain('Te sobran 3 créditos');
    expect(texto()).toContain('Física I (3 créditos): ya aprobaste Cálculo I.');
  });

  it('deja editar los créditos y recalcula lo que sobra; se puede volver a los del plan', () => {
    crear(ADELANTABLES, 17, 17);

    escribir('19');

    expect(texto()).toContain('Te sobran 2 créditos');
    expect(texto()).toContain('Gestión');
    expect(pantalla().querySelector('.adelantables__restaurar')).not.toBeNull();

    pantalla().querySelector<HTMLButtonElement>('.adelantables__restaurar')!.click();
    fixture.detectChanges();

    expect(campo().value).toBe('17');
    expect(texto()).toContain('no te sobran créditos');
  });

  it('dice que ninguna cabe cuando sobra menos de lo que pide cada una', () => {
    crear(ADELANTABLES, 17, 16);

    expect(texto()).toContain('Te sobra 1 crédito, pero ninguna');
  });

  it('con el campo vacío o con algo que no es un entero pide escribir los créditos y muestra todas', () => {
    crear(ADELANTABLES, 17, 17);

    escribir('');
    expect(texto()).toContain('Escribe tus créditos');
    expect(texto()).toContain('Gestión');

    escribir('2.5');
    expect(texto()).toContain('Escribe tus créditos');

    escribir('999');
    expect(texto()).toContain('Escribe tus créditos');
  });

  it('avisa cuando la oferta no trae nada para adelantar', () => {
    crear([], 17, 10);

    expect(texto()).toContain('no trae materias de semestres siguientes');
  });
});

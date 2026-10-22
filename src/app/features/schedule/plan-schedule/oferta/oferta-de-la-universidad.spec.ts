import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AsignaturaDeOferta } from '../../../../data-access/propuesta-de-horario.repository';
import { OfertaDeLaUniversidad } from './oferta-de-la-universidad';
import { ARCHIVO_DE_AFUERA, OFERTA_DE_EJEMPLO } from './oferta-de-ejemplo';

/** Cómo guarda el navegador la página de la universidad: un byte por letra (windows-1252). */
const enWindows1252 = (texto: string): Uint8Array<ArrayBuffer> => Uint8Array.from(texto, (letra) => letra.charCodeAt(0));

describe('OfertaDeLaUniversidad', () => {
  let fixture: ComponentFixture<OfertaDeLaUniversidad>;
  let emitidas: AsignaturaDeOferta[][];

  const pantalla = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const consultar = <T extends Element>(selector: string): T | null => pantalla().querySelector<T>(selector);

  function crear(semestreInicial: number | null = null): void {
    TestBed.configureTestingModule({ imports: [OfertaDeLaUniversidad] });
    fixture = TestBed.createComponent(OfertaDeLaUniversidad);
    fixture.componentRef.setInput('semestreInicial', semestreInicial);
    emitidas = [];
    fixture.componentInstance.materiasElegidas.subscribe((materias) => emitidas.push(materias));
    fixture.detectChanges();
  }

  async function subir(contenido: string, nombre = 'pub_rep_val.html'): Promise<void> {
    const entrada = consultar<HTMLInputElement>('#oferta-archivo')!;
    const archivo = new File([enWindows1252(contenido)], nombre);
    Object.defineProperty(entrada, 'files', { value: [archivo], configurable: true });
    entrada.dispatchEvent(new Event('change'));
    await esperarA(() => consultar('#oferta-semestre') !== null || consultar('[role="alert"]') !== null);
  }

  async function pegar(html: string, plano = ''): Promise<void> {
    const area = consultar<HTMLTextAreaElement>('#oferta-pegado')!;
    const evento = new Event('paste', { cancelable: true });
    Object.defineProperty(evento, 'clipboardData', {
      value: { getData: (tipo: string) => (tipo === 'text/html' ? html : plano) },
    });
    area.dispatchEvent(evento);
    await esperarA(() => consultar('#oferta-semestre') !== null || consultar('[role="alert"]') !== null);
  }

  async function esperarA(condicion: () => boolean): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(condicion()).toBe(true);
    });
  }

  const nombresDeMaterias = (): string[] =>
    Array.from(pantalla().querySelectorAll<HTMLLabelElement>('.oferta__materia')).map((m) =>
      (m.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
  const casillas = (): HTMLInputElement[] => Array.from(pantalla().querySelectorAll<HTMLInputElement>('.oferta__materia input'));
  const boton = (): HTMLButtonElement => consultar<HTMLButtonElement>('.oferta__usar')!;
  const elegirSemestre = (valor: string): void => {
    const lista = consultar<HTMLSelectElement>('#oferta-semestre')!;
    lista.value = valor;
    lista.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  it('al subir el archivo muestra los semestres y marca las materias del primero', async () => {
    crear();

    await subir(OFERTA_DE_EJEMPLO);

    const semestres = Array.from(pantalla().querySelectorAll<HTMLOptionElement>('#oferta-semestre option')).map((o) => o.value);
    expect(semestres).toEqual(['1', '2', '8']);
    expect(nombresDeMaterias()).toEqual(['ÁLGEBRA LINEAL (5 grupos)', 'FUNDAMENTOS DE ELECTRÓNICA (1 grupo)']);
    expect(casillas().every((c) => c.checked)).toBe(true);
  });

  it('al elegir el semestre 2 muestra sus materias marcadas', async () => {
    crear();
    await subir(OFERTA_DE_EJEMPLO);

    elegirSemestre('2');

    expect(nombresDeMaterias().map((n) => n.replace(/ \(\d+ grupos?\)$/, ''))).toEqual([
      'COMUNICACIÓN Y LECTURA CRÍTICA I',
      'FISICA I',
    ]);
    expect(casillas().every((c) => c.checked)).toBe(true);
  });

  it('semestreInicial deja elegido ese semestre', async () => {
    crear(8);

    await subir(OFERTA_DE_EJEMPLO);

    expect(consultar<HTMLSelectElement>('#oferta-semestre')!.value).toBe('8');
    expect(nombresDeMaterias()[0]).toContain('PROFUNDIZACION I (MPD)');
    expect(nombresDeMaterias()[1]).toContain('PROFUNDIZACION I (EASW)');
  });

  it('al desmarcar una materia emite una menos', async () => {
    crear();
    await subir(OFERTA_DE_EJEMPLO);

    casillas()[0].click();
    fixture.detectChanges();
    boton().click();

    expect(emitidas).toHaveLength(1);
    expect(emitidas[0].map((a) => a.nombre)).toEqual(['FUNDAMENTOS DE ELECTRÓNICA']);
  });

  it('el botón Usar estas materias emite la oferta con el fin ya normalizado', async () => {
    crear();
    await subir(OFERTA_DE_EJEMPLO);

    boton().click();

    const algebra = emitidas[0][0];
    expect(algebra.nombre).toBe('ÁLGEBRA LINEAL');
    expect(algebra.grupos[0]).toEqual({
      codigo: 'SIS.FUSA 101M',
      bloques: [{ dia: 'martes', inicio: '07:00', fin: '10:00' }],
    });
  });

  it('con más de 10 materias apaga el botón y lo dice', async () => {
    crear();
    const filas = Array.from(
      { length: 11 },
      (_, i) =>
        `<tr><td>1</td><td>MATERIA ${i}</td><td>CAD${i}</td><td>G1</td><td>20</td><td>LUNES</td><td>0700</td><td>0859</td><td>--</td></tr>`,
    ).join('');
    const tabla =
      '<table><thead><tr><th>SEMESTRE</th><th>MATERIA</th><th>CÓDIGO</th><th>GRUPO</th><th>CUPOS</th><th>DÍA</th>' +
      `<th>HORA INICIO</th><th>HORA FIN</th><th>SALÓN</th></tr></thead><tbody>${filas}</tbody></table>`;

    await pegar(tabla);

    expect(boton().disabled).toBe(true);
    expect(consultar('[role="alert"]')?.textContent).toContain('10 materias');
  });

  it('lo pegado como html se lee igual que el archivo', async () => {
    crear();

    await pegar(OFERTA_DE_EJEMPLO);

    expect(nombresDeMaterias()[0]).toContain('ÁLGEBRA LINEAL');
  });

  it('pegar texto sin formato explica cómo copiar la tabla', async () => {
    crear();

    await pegar('', 'SEMESTRE\tMATERIA');

    expect(consultar('[role="alert"]')?.textContent).toContain('Ctrl+C');
    expect(consultar('#oferta-semestre')).toBeNull();
  });

  it('un error de lectura muestra el mensaje y no emite', async () => {
    crear();

    await subir(ARCHIVO_DE_AFUERA);

    expect(consultar('[role="alert"]')?.textContent).toContain('pub_rep_val.html');
    expect(consultar('#oferta-semestre')).toBeNull();
    expect(emitidas).toHaveLength(0);
  });

  it('una lectura que termina después de cerrar la pantalla no deja nada', async () => {
    crear();
    const entrada = consultar<HTMLInputElement>('#oferta-archivo')!;
    Object.defineProperty(entrada, 'files', {
      value: [new File([enWindows1252(OFERTA_DE_EJEMPLO)], 'pub_rep_val.html')],
      configurable: true,
    });
    const componente = fixture.componentInstance as unknown as { oferta: () => unknown };

    entrada.dispatchEvent(new Event('change'));
    fixture.destroy();
    await new Promise((resolver) => setTimeout(resolver, 50));

    expect(componente.oferta()).toBeNull();
  });
});

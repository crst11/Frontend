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
  const ultima = (): AsignaturaDeOferta[] => emitidas[emitidas.length - 1];

  function crear(semestreInicial: number | null = null): void {
    TestBed.configureTestingModule({ imports: [OfertaDeLaUniversidad] });
    fixture = TestBed.createComponent(OfertaDeLaUniversidad);
    fixture.componentRef.setInput('semestreInicial', semestreInicial);
    emitidas = [];
    fixture.componentInstance.materiasElegidas.subscribe((materias) => emitidas.push(materias));
    fixture.detectChanges();
  }

  function archivoEn(contenido: string, nombre = 'pub_rep_val.html'): File {
    return new File([enWindows1252(contenido)], nombre);
  }

  async function esperarA(condicion: () => boolean): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(condicion()).toBe(true);
    });
  }

  const hayResultado = (): boolean => consultar('#oferta-semestre') !== null || consultar('[role="alert"]') !== null;

  async function subir(contenido: string, nombre = 'pub_rep_val.html'): Promise<void> {
    const entrada = consultar<HTMLInputElement>('#oferta-archivo')!;
    Object.defineProperty(entrada, 'files', { value: [archivoEn(contenido, nombre)], configurable: true });
    entrada.dispatchEvent(new Event('change'));
    await esperarA(hayResultado);
  }

  async function soltar(contenido: string): Promise<void> {
    const zona = consultar<HTMLLabelElement>('.import__zona')!;
    const evento = new Event('drop', { cancelable: true });
    Object.defineProperty(evento, 'dataTransfer', { value: { files: [archivoEn(contenido)] } });
    zona.dispatchEvent(evento);
    await esperarA(hayResultado);
  }

  async function pegar(html: string, plano = ''): Promise<void> {
    consultar<HTMLButtonElement>('.oferta__pegar')!.click();
    fixture.detectChanges();
    const area = consultar<HTMLTextAreaElement>('#oferta-pegado')!;
    const evento = new Event('paste', { cancelable: true });
    Object.defineProperty(evento, 'clipboardData', {
      value: { getData: (tipo: string) => (tipo === 'text/html' ? html : plano) },
    });
    area.dispatchEvent(evento);
    await esperarA(hayResultado);
  }

  const nombresDeMaterias = (): string[] =>
    Array.from(pantalla().querySelectorAll<HTMLLabelElement>('.oferta__materia')).map((m) =>
      (m.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
  const casillas = (): HTMLInputElement[] => Array.from(pantalla().querySelectorAll<HTMLInputElement>('.oferta__materia input'));
  const elegirSemestre = (valor: string): void => {
    const lista = consultar<HTMLSelectElement>('#oferta-semestre')!;
    lista.value = valor;
    lista.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  it('se ve como las demás cargas de archivos: zona para tocar o arrastrar y guía plegable', () => {
    crear();

    expect(consultar('label.import__zona input[type="file"].import__archivo')).not.toBeNull();
    expect(pantalla().textContent).toContain('Toca aquí para elegir el archivo de la oferta');
    expect(pantalla().textContent).toContain('hasta 2 MB');
    expect(consultar('#oferta-pasos')).toBeNull();

    consultar<HTMLButtonElement>('.import__guia-head')!.click();
    fixture.detectChanges();

    expect(consultar('.import__guia-head')!.getAttribute('aria-expanded')).toBe('true');
    expect(consultar('#oferta-pasos')!.textContent).toContain('pub_rep_val.html');
  });

  it('el área para pegar está plegada hasta que se pide', () => {
    crear();
    expect(consultar('#oferta-pegado')).toBeNull();

    consultar<HTMLButtonElement>('.oferta__pegar')!.click();
    fixture.detectChanges();

    expect(consultar('#oferta-pegado')).not.toBeNull();
  });

  it('permite elegir la carpeta guardada completa, para no buscar el archivo adentro', () => {
    crear();

    const carpeta = consultar<HTMLInputElement>('#oferta-carpeta');
    expect(carpeta).not.toBeNull();
    expect(carpeta!.hasAttribute('webkitdirectory')).toBe(true);
    expect(consultar('.oferta__carpeta')!.textContent).toContain('_files');
  });

  async function subirCarpeta(archivos: File[]): Promise<void> {
    const entrada = consultar<HTMLInputElement>('#oferta-carpeta')!;
    Object.defineProperty(entrada, 'files', { value: archivos, configurable: true });
    entrada.dispatchEvent(new Event('change'));
    await esperarA(hayResultado);
  }

  it('al elegir la carpeta guardada encuentra la tabla sola, aunque esté el archivo de afuera', async () => {
    crear();

    await subirCarpeta([
      archivoEn(ARCHIVO_DE_AFUERA, 'Universidad Cundinamarca _ Sistema Institucional.html'),
      archivoEn('<html></html>', 'blank.html'),
      archivoEn(OFERTA_DE_EJEMPLO, 'pub_rep_val.html'),
    ]);

    expect(consultar('#oferta-semestre')).not.toBeNull();
    expect(ultima().map((a) => a.nombre)).toEqual(['ÁLGEBRA LINEAL', 'FUNDAMENTOS DE ELECTRÓNICA']);
  });

  it('una carpeta sin la tabla muestra cuál carpeta elegir', async () => {
    crear();

    await subirCarpeta([archivoEn('<html></html>', 'blank.html')]);

    expect(consultar('[role="alert"]')?.textContent).toContain('_files');
    expect(consultar('#oferta-semestre')).toBeNull();
  });

  it('al subir el archivo de afuera dice en qué carpeta está la tabla', async () => {
    crear();

    await subir(ARCHIVO_DE_AFUERA, 'Universidad Cundinamarca _ Sistema Institucional.html');

    expect(consultar('[role="alert"]')?.textContent).toContain('Universidad Cundinamarca _ Sistema Institucional_files');
    expect(consultar('[role="alert"]')?.textContent).toContain('pub_rep_val.html');
  });

  it('al subir el archivo, la persona ve el botón de elegir carpeta junto al aviso', async () => {
    crear();

    await subir(ARCHIVO_DE_AFUERA);

    expect(consultar('#oferta-carpeta')).not.toBeNull();
  });

  it('al subir el archivo muestra los semestres, marca las materias del primero y las entrega', async () => {
    crear();

    await subir(OFERTA_DE_EJEMPLO);

    const semestres = Array.from(pantalla().querySelectorAll<HTMLOptionElement>('#oferta-semestre option')).map((o) => o.value);
    expect(semestres).toEqual(['1', '2', '8']);
    expect(nombresDeMaterias()).toEqual(['ÁLGEBRA LINEAL (5 grupos)', 'FUNDAMENTOS DE ELECTRÓNICA (1 grupo)']);
    expect(casillas().every((c) => c.checked)).toBe(true);
    expect(ultima().map((a) => a.nombre)).toEqual(['ÁLGEBRA LINEAL', 'FUNDAMENTOS DE ELECTRÓNICA']);
  });

  it('entrega la oferta con el fin ya normalizado: 09:59 es hasta las 10:00', async () => {
    crear();

    await subir(OFERTA_DE_EJEMPLO);

    expect(ultima()[0].grupos[0]).toEqual({
      codigo: 'SIS.FUSA 101M',
      bloques: [{ dia: 'martes', inicio: '07:00', fin: '10:00' }],
    });
  });

  it('un archivo arrastrado hasta la zona se lee igual que uno elegido', async () => {
    crear();

    await soltar(OFERTA_DE_EJEMPLO);

    expect(nombresDeMaterias()[0]).toContain('ÁLGEBRA LINEAL');
    expect(ultima()).toHaveLength(2);
  });

  it('al elegir el semestre 2 entrega sus materias', async () => {
    crear();
    await subir(OFERTA_DE_EJEMPLO);

    elegirSemestre('2');

    expect(nombresDeMaterias().map((n) => n.replace(/ \(\d+ grupos?\)$/, ''))).toEqual([
      'COMUNICACIÓN Y LECTURA CRÍTICA I',
      'FISICA I',
    ]);
    expect(casillas().every((c) => c.checked)).toBe(true);
    expect(ultima().map((a) => a.nombre)).toEqual(['COMUNICACIÓN Y LECTURA CRÍTICA I', 'FISICA I']);
  });

  it('semestreInicial deja elegido ese semestre', async () => {
    crear(8);

    await subir(OFERTA_DE_EJEMPLO);

    expect(consultar<HTMLSelectElement>('#oferta-semestre')!.value).toBe('8');
    expect(nombresDeMaterias()[0]).toContain('PROFUNDIZACION I (MPD)');
    expect(nombresDeMaterias()[1]).toContain('PROFUNDIZACION I (EASW)');
  });

  it('al desmarcar una materia entrega una menos, sin ningún botón de por medio', async () => {
    crear();
    await subir(OFERTA_DE_EJEMPLO);

    casillas()[0].click();
    fixture.detectChanges();

    expect(ultima().map((a) => a.nombre)).toEqual(['FUNDAMENTOS DE ELECTRÓNICA']);
    expect(pantalla().textContent).not.toContain('Usar estas materias');
  });

  it('con más de 10 materias lo dice y no entrega ninguna', async () => {
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

    expect(consultar('[role="alert"]')?.textContent).toContain('10 materias');
    expect(ultima()).toEqual([]);
  });

  it('lo pegado como html se lee igual que el archivo', async () => {
    crear();

    await pegar(OFERTA_DE_EJEMPLO);

    expect(nombresDeMaterias()[0]).toContain('ÁLGEBRA LINEAL');
    expect(ultima()).toHaveLength(2);
  });

  it('pegar texto sin formato explica cómo copiar la tabla', async () => {
    crear();

    await pegar('', 'SEMESTRE\tMATERIA');

    expect(consultar('[role="alert"]')?.textContent).toContain('Ctrl+C');
    expect(consultar('#oferta-semestre')).toBeNull();
  });

  it('un error de lectura muestra el mensaje y no entrega nada', async () => {
    crear();

    await subir(ARCHIVO_DE_AFUERA);

    expect(consultar('[role="alert"]')?.textContent).toContain('pub_rep_val.html');
    expect(consultar('#oferta-semestre')).toBeNull();
    expect(emitidas).toHaveLength(0);
  });

  it('si después de una oferta buena sube un archivo malo, deja de entregar las materias de antes', async () => {
    crear();
    await subir(OFERTA_DE_EJEMPLO);
    expect(ultima()).toHaveLength(2);

    const entrada = consultar<HTMLInputElement>('#oferta-archivo')!;
    Object.defineProperty(entrada, 'files', { value: [archivoEn(ARCHIVO_DE_AFUERA)], configurable: true });
    entrada.dispatchEvent(new Event('change'));
    await esperarA(() => consultar('[role="alert"]') !== null);

    expect(ultima()).toEqual([]);
  });

  it('una lectura que termina después de cerrar la pantalla no deja nada', async () => {
    crear();
    const entrada = consultar<HTMLInputElement>('#oferta-archivo')!;
    Object.defineProperty(entrada, 'files', { value: [archivoEn(OFERTA_DE_EJEMPLO)], configurable: true });
    const componente = fixture.componentInstance as unknown as { oferta: () => unknown };

    entrada.dispatchEvent(new Event('change'));
    fixture.destroy();
    await new Promise((resolver) => setTimeout(resolver, 50));

    expect(componente.oferta()).toBeNull();
  });
});

import { vi } from 'vitest';
import {
  MAXIMO_DE_BYTES,
  MAXIMO_DE_PAGINAS_DE_LA_CARPETA,
  leerArchivoDeOferta,
  leerCarpetaDeOferta,
  leerOfertaPegada,
} from './archivo-de-oferta';
import { OfertaNoLegible } from './lector-de-oferta';
import { ARCHIVO_DE_AFUERA, OFERTA_DE_EJEMPLO } from './oferta-de-ejemplo';

/** Lo que hace el navegador al guardar la página de la universidad: un byte por letra, con tildes en un solo byte. */
const enWindows1252 = (texto: string): Uint8Array<ArrayBuffer> => Uint8Array.from(texto, (letra) => letra.charCodeAt(0));

const conJuego = (juego: string): string =>
  OFERTA_DE_EJEMPLO.replace('<html>', `<html><head><meta http-equiv="Content-Type" content="text/html; charset=${juego}"></head>`);

describe('leerArchivoDeOferta', () => {
  it('un archivo en windows-1252 se lee con sus tildes', async () => {
    const archivo = new File([enWindows1252(conJuego('windows-1252'))], 'pub_rep_val.html');

    const oferta = await leerArchivoDeOferta(archivo);

    expect(oferta.materias[0].nombre).toBe('ÁLGEBRA LINEAL');
  });

  it('sin juego de caracteres declarado se lee como windows-1252', async () => {
    const archivo = new File([enWindows1252(OFERTA_DE_EJEMPLO)], 'pub_rep_val.html');

    expect((await leerArchivoDeOferta(archivo)).materias[0].nombre).toBe('ÁLGEBRA LINEAL');
  });

  it('un archivo en utf-8 se lee con sus tildes', async () => {
    const archivo = new File([new TextEncoder().encode(conJuego('utf-8'))], 'oferta.html');

    expect((await leerArchivoDeOferta(archivo)).materias[0].nombre).toBe('ÁLGEBRA LINEAL');
  });

  it('un juego de caracteres desconocido no rompe la lectura', async () => {
    const archivo = new File([enWindows1252(conJuego('inventado-9'))], 'pub_rep_val.html');

    expect((await leerArchivoDeOferta(archivo)).materias[0].nombre).toBe('ÁLGEBRA LINEAL');
  });

  it('un archivo .mht se desempaqueta antes de leerse', async () => {
    const mhtml = [
      'From: <Guardado por el navegador>',
      'MIME-Version: 1.0',
      'Content-Type: multipart/related; boundary="LIMITE"',
      '',
      '--LIMITE',
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: binary',
      '',
      OFERTA_DE_EJEMPLO,
      '--LIMITE--',
      '',
    ].join('\r\n');
    const archivo = new File([new TextEncoder().encode(mhtml)], 'oferta.mht');

    expect((await leerArchivoDeOferta(archivo)).materias[0].nombre).toBe('ÁLGEBRA LINEAL');
  });

  it('un archivo de más de 2 MB se rechaza sin leerlo', async () => {
    const archivo = new File([new Uint8Array(MAXIMO_DE_BYTES + 1)], 'pub_rep_val.html');
    const lectura = vi.spyOn(archivo, 'arrayBuffer');

    await expect(leerArchivoDeOferta(archivo)).rejects.toThrow(OfertaNoLegible);
    expect(lectura).not.toHaveBeenCalled();
  });

  it('un archivo que no es la tabla dice por qué', async () => {
    const archivo = new File([enWindows1252('<html><body>Hola</body></html>')], 'otra.html');

    await expect(leerArchivoDeOferta(archivo)).rejects.toThrow(OfertaNoLegible);
  });
});

describe('leerCarpetaDeOferta', () => {
  const archivo = (nombre: string, contenido: string): File => new File([enWindows1252(contenido)], nombre);
  const afuera = () => archivo('Universidad Cundinamarca _ Sistema Institucional.html', ARCHIVO_DE_AFUERA);
  const interno = () => archivo('pub_rep_val.html', OFERTA_DE_EJEMPLO);

  it('encuentra la tabla entre los archivos de la carpeta, sin importar el orden', async () => {
    const carpeta = [archivo('blank.html', '<html></html>'), archivo('style.css', 'body{}'), interno()];

    const oferta = await leerCarpetaDeOferta(carpeta);

    expect(oferta.materias[0].nombre).toBe('ÁLGEBRA LINEAL');
  });

  it('prueba primero pub_rep_val y se queda con el primero que sí es la tabla', async () => {
    const carpeta = [afuera(), archivo('otra.html', '<html><body>Hola</body></html>'), interno()];

    const oferta = await leerCarpetaDeOferta(carpeta);

    expect(oferta.periodo).toBe('2026-2');
  });

  it('solo mira páginas (.html, .htm, .mht): ignora imágenes, hojas de estilo y scripts', async () => {
    const lectura = vi.spyOn(File.prototype, 'arrayBuffer');
    const carpeta = [archivo('imagen.gif', 'GIF89a'), archivo('controlador.js.descarga', 'function(){}'), interno()];

    await leerCarpetaDeOferta(carpeta);

    expect(lectura).toHaveBeenCalledTimes(1);
    lectura.mockRestore();
  });

  it('si ninguna página de la carpeta es la tabla, dice cuál carpeta elegir', async () => {
    const carpeta = [afuera(), archivo('blank.html', '<html></html>')];

    await expect(leerCarpetaDeOferta(carpeta)).rejects.toThrow(OfertaNoLegible);
    await expect(leerCarpetaDeOferta(carpeta)).rejects.toThrow(/_files/);
  });

  it('una carpeta vacía o con puros archivos que no son páginas dice lo mismo', async () => {
    await expect(leerCarpetaDeOferta([])).rejects.toThrow(OfertaNoLegible);
    await expect(leerCarpetaDeOferta([archivo('salir.gif', 'GIF89a')])).rejects.toThrow(OfertaNoLegible);
  });

  it('no se traga una carpeta enorme: mira un máximo de páginas', async () => {
    const lectura = vi.spyOn(File.prototype, 'arrayBuffer');
    const muchas = Array.from({ length: 300 }, (_, i) => archivo(`pagina-${i}.html`, '<html></html>'));

    await expect(leerCarpetaDeOferta(muchas)).rejects.toThrow(OfertaNoLegible);

    expect(lectura.mock.calls.length).toBeLessThanOrEqual(MAXIMO_DE_PAGINAS_DE_LA_CARPETA);
    lectura.mockRestore();
  });

  it('una página de más de 2 MB en la carpeta se salta sin leerla', async () => {
    const enorme = new File([new Uint8Array(MAXIMO_DE_BYTES + 1)], 'enorme.html');
    const lectura = vi.spyOn(enorme, 'arrayBuffer');

    const oferta = await leerCarpetaDeOferta([enorme, interno()]);

    expect(oferta.materias.length).toBeGreaterThan(0);
    expect(lectura).not.toHaveBeenCalled();
  });
});

describe('leerOfertaPegada', () => {
  it('lo pegado se lee igual que el archivo', () => {
    expect(leerOfertaPegada(OFERTA_DE_EJEMPLO).materias[0].nombre).toBe('ÁLGEBRA LINEAL');
  });

  it('lo pegado de más de 2 MB se rechaza', () => {
    expect(() => leerOfertaPegada('x'.repeat(MAXIMO_DE_BYTES + 1))).toThrow(OfertaNoLegible);
  });
});

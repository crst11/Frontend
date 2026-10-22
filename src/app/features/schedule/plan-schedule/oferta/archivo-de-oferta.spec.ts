import { vi } from 'vitest';
import { MAXIMO_DE_BYTES, leerArchivoDeOferta, leerOfertaPegada } from './archivo-de-oferta';
import { OfertaNoLegible } from './lector-de-oferta';
import { OFERTA_DE_EJEMPLO } from './oferta-de-ejemplo';

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

describe('leerOfertaPegada', () => {
  it('lo pegado se lee igual que el archivo', () => {
    expect(leerOfertaPegada(OFERTA_DE_EJEMPLO).materias[0].nombre).toBe('ÁLGEBRA LINEAL');
  });

  it('lo pegado de más de 2 MB se rechaza', () => {
    expect(() => leerOfertaPegada('x'.repeat(MAXIMO_DE_BYTES + 1))).toThrow(OfertaNoLegible);
  });
});

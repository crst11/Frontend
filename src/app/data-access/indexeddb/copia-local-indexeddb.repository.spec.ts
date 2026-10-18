import 'fake-indexeddb/auto';
import { CopiaLocalIndexedDbRepository } from './copia-local-indexeddb.repository';

describe('CopiaLocalIndexedDbRepository', () => {
  let copia: CopiaLocalIndexedDbRepository;

  beforeEach(async () => {
    copia = new CopiaLocalIndexedDbRepository();
    await copia.borrarTodo();
  });

  it('guarda una lectura y la devuelve con el momento en que se guardó', async () => {
    await copia.guardar('1|/api/mis/horario', { dias: ['lunes'] }, 1_700_000_000_000);

    expect(await copia.leer('1|/api/mis/horario')).toEqual({ valor: { dias: ['lunes'] }, guardadaEn: 1_700_000_000_000 });
  });

  it('lo que nunca se guardó no existe', async () => {
    expect(await copia.leer('1|/api/mis/dia')).toBeNull();
  });

  it('guardar otra vez la misma lectura reemplaza la anterior', async () => {
    await copia.guardar('1|/api/mis/pendientes', [{ id: 1 }], 10);
    await copia.guardar('1|/api/mis/pendientes', [{ id: 1 }, { id: 2 }], 20);

    expect(await copia.leer('1|/api/mis/pendientes')).toEqual({ valor: [{ id: 1 }, { id: 2 }], guardadaEn: 20 });
  });

  it('la copia sobrevive a una instancia nueva: es lo que queda al cerrar y abrir la aplicación', async () => {
    await copia.guardar('1|/api/mis/horario', { dias: [] }, 5);

    const alAbrirDeNuevo = new CopiaLocalIndexedDbRepository();

    expect((await alAbrirDeNuevo.leer('1|/api/mis/horario'))?.guardadaEn).toBe(5);
  });

  it('borrarTodo no deja nada guardado', async () => {
    await copia.guardar('cuenta', { id: 1 }, 1);
    await copia.guardar('1|/api/mis/horario', { dias: [] }, 1);

    await copia.borrarTodo();

    expect(await copia.leer('cuenta')).toBeNull();
    expect(await copia.leer('1|/api/mis/horario')).toBeNull();
  });

  it('un valor que no se puede guardar no rompe nada y queda en memoria', async () => {
    const conFuncion = { f: () => 1 };

    await expect(copia.guardar('1|/api/mis/dia', conFuncion, 1)).resolves.toBeUndefined();

    expect(await copia.leer('1|/api/mis/dia')).not.toBeNull();
  });
});

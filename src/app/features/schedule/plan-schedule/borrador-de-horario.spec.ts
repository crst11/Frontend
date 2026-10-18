import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SessionService } from '../../../core/session/session.service';
import { CopiaLocalRepository } from '../../../data-access/copia-local.repository';
import { CopiaLocalEnMemoriaRepository } from '../../../data-access/memoria/copia-local-en-memoria.repository';
import { BorradorDeHorario, BorradorDeHorarioStore } from './borrador-de-horario';

describe('BorradorDeHorarioStore', () => {
  const BORRADOR: BorradorDeHorario = {
    asignaturas: [
      { nombre: 'Cálculo', grupos: [{ codigo: '1', bloques: [{ dia: 'lunes', inicio: '08:00', fin: '10:00' }] }] },
    ],
    franja: 'manana',
    pocosHuecos: true,
    diasLibres: ['viernes'],
  };

  const sesion = { cuenta: vi.fn() };
  let copia: CopiaLocalEnMemoriaRepository;

  function crear() {
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionService, useValue: sesion },
        { provide: CopiaLocalRepository, useClass: CopiaLocalEnMemoriaRepository },
      ],
    });
    copia = TestBed.inject(CopiaLocalRepository) as CopiaLocalEnMemoriaRepository;
    return TestBed.inject(BorradorDeHorarioStore);
  }

  beforeEach(() => sesion.cuenta.mockReset().mockReturnValue({ id: 5 }));

  it('guarda el borrador de la cuenta y lo devuelve igual', async () => {
    const almacen = crear();

    await almacen.guardar(BORRADOR);

    expect(await almacen.cargar()).toEqual(BORRADOR);
  });

  it('lleva el id de la cuenta en la clave: otra cuenta del mismo dispositivo no ve el borrador', async () => {
    const almacen = crear();
    await almacen.guardar(BORRADOR);

    sesion.cuenta.mockReturnValue({ id: 6 });

    expect(await almacen.cargar()).toBeNull();
    expect(await copia.leer('5|borrador-de-horario')).not.toBeNull();
  });

  it('sin sesión no guarda ni devuelve nada', async () => {
    sesion.cuenta.mockReturnValue(null);
    const almacen = crear();

    await almacen.guardar(BORRADOR);

    expect(await almacen.cargar()).toBeNull();
    expect(await copia.leer('5|borrador-de-horario')).toBeNull();
  });

  it('lo que se guardó con otra forma, de una versión vieja de la pantalla, no se usa', async () => {
    const almacen = crear();
    await copia.guardar('5|borrador-de-horario', { materias: ['Cálculo'] }, Date.now());

    expect(await almacen.cargar()).toBeNull();
  });

  it('cerrar sesión borra la copia local y con ella el borrador', async () => {
    const almacen = crear();
    await almacen.guardar(BORRADOR);

    await copia.borrarTodo();

    expect(await almacen.cargar()).toBeNull();
  });

  it('si el dispositivo no deja guardar o leer, no lanza', async () => {
    const almacen = crear();
    vi.spyOn(copia, 'guardar').mockRejectedValue(new Error('sin espacio'));
    vi.spyOn(copia, 'leer').mockRejectedValue(new Error('bloqueado'));

    await expect(almacen.guardar(BORRADOR)).resolves.toBeUndefined();
    await expect(almacen.cargar()).resolves.toBeNull();
  });
});

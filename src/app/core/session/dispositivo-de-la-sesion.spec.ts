import { TestBed } from '@angular/core/testing';
import { DispositivoDeLaSesion, PLAZO_DE_INACTIVIDAD_EN_MS } from './dispositivo-de-la-sesion';

describe('DispositivoDeLaSesion', () => {
  const PLAZO = 15 * 60_000;
  const T0 = 1_000_000_000_000;

  function crear() {
    TestBed.configureTestingModule({});
    return TestBed.inject(DispositivoDeLaSesion);
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('por defecto es un dispositivo personal y permite la copia sin conexión', () => {
    const dispositivo = crear();

    expect(dispositivo.esCompartido()).toBe(false);
    expect(dispositivo.permiteCopiaLocal()).toBe(true);
    expect(dispositivo.estaInactivo(T0 + 10 * PLAZO)).toBe(false);
    expect(dispositivo.inactivoDesde(T0)).toBeNull();
  });

  it('un dispositivo compartido no permite la copia sin conexión', () => {
    const dispositivo = crear();

    dispositivo.marcar(false, T0);

    expect(dispositivo.esCompartido()).toBe(true);
    expect(dispositivo.permiteCopiaLocal()).toBe(false);
  });

  it('en uno compartido, pasado el plazo sin actividad está inactivo; antes, no', () => {
    const dispositivo = crear();
    dispositivo.marcar(false, T0);

    expect(dispositivo.estaInactivo(T0 + PLAZO - 1)).toBe(false);
    expect(dispositivo.estaInactivo(T0 + PLAZO)).toBe(true);
    expect(dispositivo.faltaParaCerrar(T0 + PLAZO - 60_000)).toBe(60_000);
    expect(dispositivo.faltaParaCerrar(T0 + 2 * PLAZO)).toBe(0);
  });

  it('la actividad reinicia la cuenta', () => {
    const dispositivo = crear();
    dispositivo.marcar(false, T0);

    dispositivo.registrarActividad(T0 + PLAZO - 1_000);

    expect(dispositivo.estaInactivo(T0 + PLAZO + 5_000)).toBe(false);
    expect(dispositivo.estaInactivo(T0 + 2 * PLAZO)).toBe(true);
  });

  it('no escribe en el almacenamiento a cada movimiento: con menos de 10 s de margen no repite', () => {
    const dispositivo = crear();
    dispositivo.marcar(false, T0);
    const escribir = vi.spyOn(Storage.prototype, 'setItem');

    dispositivo.registrarActividad(T0 + 2_000);
    dispositivo.registrarActividad(T0 + 5_000);
    expect(escribir).not.toHaveBeenCalled();

    dispositivo.registrarActividad(T0 + 11_000);
    expect(escribir).toHaveBeenCalledTimes(1);
    escribir.mockRestore();
  });

  it('en un dispositivo personal la actividad no se registra', () => {
    const dispositivo = crear();

    dispositivo.registrarActividad(T0);

    expect(localStorage.getItem('cundiapp.ultima-actividad')).toBeNull();
  });

  it('lo elegido sobrevive a recargar la aplicación', () => {
    crear().marcar(false, T0);
    TestBed.resetTestingModule();

    const despues = crear();

    expect(despues.esCompartido()).toBe(true);
    expect(despues.estaInactivo(T0 + PLAZO)).toBe(true);
  });

  it('marcar «personal» borra lo que hubiera de un uso compartido', () => {
    const dispositivo = crear();
    dispositivo.marcar(false, T0);

    dispositivo.marcar(true);

    expect(dispositivo.esCompartido()).toBe(false);
    expect(localStorage.getItem('cundiapp.dispositivo')).toBeNull();
    expect(localStorage.getItem('cundiapp.ultima-actividad')).toBeNull();
  });

  it('olvidar deja todo como al principio', () => {
    const dispositivo = crear();
    dispositivo.marcar(false, T0);

    dispositivo.olvidar();

    expect(dispositivo.esCompartido()).toBe(false);
    expect(dispositivo.estaInactivo(T0 + 10 * PLAZO)).toBe(false);
    expect(localStorage.length).toBe(0);
  });

  it('un valor guardado que no es un número se ignora', () => {
    localStorage.setItem('cundiapp.dispositivo', 'compartido');
    localStorage.setItem('cundiapp.ultima-actividad', 'no-es-un-numero');

    const dispositivo = crear();

    expect(dispositivo.esCompartido()).toBe(true);
    expect(dispositivo.estaInactivo(T0)).toBe(false);
  });

  it('si el navegador no deja guardar, sigue funcionando con lo que tiene en memoria', () => {
    const fallo = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('lleno', 'QuotaExceededError');
    });
    const dispositivo = crear();

    dispositivo.marcar(false, T0);

    expect(dispositivo.esCompartido()).toBe(true);
    expect(dispositivo.estaInactivo(T0 + PLAZO)).toBe(true);
    fallo.mockRestore();
  });

  it('el plazo se puede cambiar', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLAZO_DE_INACTIVIDAD_EN_MS, useValue: 1_000 }] });
    const dispositivo = TestBed.inject(DispositivoDeLaSesion);
    dispositivo.marcar(false, T0);

    expect(dispositivo.estaInactivo(T0 + 1_000)).toBe(true);
  });
});

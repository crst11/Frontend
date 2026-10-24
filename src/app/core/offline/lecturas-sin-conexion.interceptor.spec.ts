import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Cuenta } from '../../data-access/estudiante.repository';
import { CopiaLocalRepository } from '../../data-access/copia-local.repository';
import { CopiaLocalEnMemoriaRepository } from '../../data-access/memoria/copia-local-en-memoria.repository';
import { DispositivoDeLaSesion } from '../session/dispositivo-de-la-sesion';
import { SessionService } from '../session/session.service';
import { Conexion } from './conexion.service';
import { PLAZO_DE_UNA_LECTURA_EN_MS, lecturasSinConexionInterceptor } from './lecturas-sin-conexion.interceptor';
import { Sincronizacion } from './sincronizacion.service';

describe('lecturasSinConexionInterceptor', () => {
  const ana: Cuenta = { id: 1, correo: 'ana@ucundinamarca.edu.co', nombres: 'Ana', apellidos: 'Díaz', estado: 'activa' };
  const beto: Cuenta = { id: 2, correo: 'beto@ucundinamarca.edu.co', nombres: 'Beto', apellidos: 'Ruiz', estado: 'activa' };
  const HORARIO = `${environment.apiUrl}/mis/horario`;
  const PENDIENTES = `${environment.apiUrl}/mis/pendientes`;

  const cuentaActual = signal<Cuenta | null>(ana);
  const enLinea = signal(true);

  let http: HttpClient;
  let backend: HttpTestingController;
  let copia: CopiaLocalRepository;
  let sincronizacion: Sincronizacion;

  beforeEach(() => {
    cuentaActual.set(ana);
    enLinea.set(true);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([lecturasSinConexionInterceptor])),
        provideHttpClientTesting(),
        { provide: CopiaLocalRepository, useClass: CopiaLocalEnMemoriaRepository },
        { provide: SessionService, useValue: { cuenta: cuentaActual.asReadonly() } },
        { provide: Conexion, useValue: { enLinea: enLinea.asReadonly() } },
        // Las respuestas se simulan al instante; solo las pruebas del plazo esperan a que se cumpla.
        { provide: PLAZO_DE_UNA_LECTURA_EN_MS, useValue: 20 },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    copia = TestBed.inject(CopiaLocalRepository);
    sincronizacion = TestBed.inject(Sincronizacion);
  });

  afterEach(() => backend.verify());

  /** Lo que sigue a un `subscribe`: deja que las promesas de la copia local terminen. */
  const esperar = () => new Promise((resolver) => setTimeout(resolver));

  function leer(url: string) {
    const resultado: { valor?: unknown; error?: HttpErrorResponse } = {};
    http.get(url).subscribe({
      next: (valor) => (resultado.valor = valor),
      error: (error: HttpErrorResponse) => (resultado.error = error),
    });
    return resultado;
  }

  describe('lecturas', () => {
    it('guarda la última respuesta buena de una lectura permitida y la cuenta como actual', async () => {
      const resultado = leer(HORARIO);
      backend.expectOne(HORARIO).flush({ dias: ['lunes'] });
      await esperar();

      expect(resultado.valor).toEqual({ dias: ['lunes'] });
      expect((await copia.leer(`1|${HORARIO}`))?.valor).toEqual({ dias: ['lunes'] });
      expect(sincronizacion.ultimaActualizacion()).not.toBeNull();
      expect(sincronizacion.mostrandoCopia()).toBe(false);
    });

    it('sin conexión con el servidor entrega la copia guardada y lo anota', async () => {
      await copia.guardar(`1|${HORARIO}`, { dias: ['martes'] }, 1_000);

      const resultado = leer(HORARIO);
      backend.expectOne(HORARIO).error(new ProgressEvent('error'), { status: 0 });
      await esperar();

      expect(resultado.valor).toEqual({ dias: ['martes'] });
      expect(resultado.error).toBeUndefined();
      expect(sincronizacion.mostrandoCopia()).toBe(true);
      expect(sincronizacion.ultimaActualizacion()).toBe(1_000);
    });

    it('con un error 5xx del servidor también entrega la copia', async () => {
      await copia.guardar(`1|${HORARIO}`, { dias: [] }, 5);

      const resultado = leer(HORARIO);
      backend.expectOne(HORARIO).flush('caído', { status: 503, statusText: 'Service Unavailable' });
      await esperar();

      expect(resultado.valor).toEqual({ dias: [] });
    });

    it('si no hay copia, el error sale tal cual', async () => {
      const resultado = leer(HORARIO);
      backend.expectOne(HORARIO).error(new ProgressEvent('error'), { status: 0 });
      await esperar();

      expect(resultado.error?.status).toBe(0);
    });

    describe('si el servidor no contesta nunca', () => {
      it('pasado el plazo entrega la copia guardada', async () => {
        await copia.guardar(`1|${HORARIO}`, { dias: ['guardado'] }, 42);

        const resultado = leer(HORARIO);
        const pedida = backend.expectOne(HORARIO);
        await new Promise((resolver) => setTimeout(resolver, 80));

        expect(resultado.valor).toEqual({ dias: ['guardado'] });
        expect(sincronizacion.ultimaActualizacion()).toBe(42);
        expect(pedida.cancelled).toBe(true);
      });

      it('sin copia responde como falta de conexión, que es lo que las pantallas saben mostrar', async () => {
        const resultado = leer(HORARIO);
        backend.expectOne(HORARIO);
        await new Promise((resolver) => setTimeout(resolver, 80));

        expect(resultado.error?.status).toBe(0);
      });
    });

    it('un 4xx nunca se tapa con la copia: es una respuesta del servidor', async () => {
      await copia.guardar(`1|${HORARIO}`, { dias: ['viejo'] }, 1);

      const resultado = leer(HORARIO);
      backend.expectOne(HORARIO).flush({ detail: 'no' }, { status: 401, statusText: 'Unauthorized' });
      await esperar();

      expect(resultado.error?.status).toBe(401);
      expect(resultado.valor).toBeUndefined();
    });

    it('cada dirección con sus parámetros tiene su propia copia', async () => {
      leer(`${HORARIO}?sede=Fusagasugá`);
      backend.expectOne(`${HORARIO}?sede=Fusagasugá`).flush({ sede: true });
      await esperar();

      expect(await copia.leer(`1|${HORARIO}`)).toBeNull();
    });

    it('la copia de una cuenta no se entrega a otra en el mismo dispositivo', async () => {
      await copia.guardar(`1|${HORARIO}`, { dias: ['de ana'] }, 1);
      cuentaActual.set(beto);

      const resultado = leer(HORARIO);
      backend.expectOne(HORARIO).error(new ProgressEvent('error'), { status: 0 });
      await esperar();

      expect(resultado.valor).toBeUndefined();
      expect(resultado.error?.status).toBe(0);
    });

    it('lo que no es una lectura permitida (la cuenta, las sesiones) nunca se guarda', async () => {
      const resultado = leer(`${environment.apiUrl}/mis/sesiones`);
      backend.expectOne(`${environment.apiUrl}/mis/sesiones`).flush([{ consecutivo: 1 }]);
      await esperar();

      expect(resultado.valor).toEqual([{ consecutivo: 1 }]);
      expect(await copia.leer(`1|${environment.apiUrl}/mis/sesiones`)).toBeNull();
      expect(sincronizacion.ultimaActualizacion()).toBeNull();
    });

    it('sin cuenta (sin sesión) no se guarda nada', async () => {
      cuentaActual.set(null);

      leer(HORARIO);
      backend.expectOne(HORARIO).flush({ dias: [] });
      await esperar();

      expect(await copia.leer(`1|${HORARIO}`)).toBeNull();
    });

    it('las direcciones que no son de la API pasan sin tocarlas', async () => {
      leer('https://ejemplo.com/horario');
      backend.expectOne('https://ejemplo.com/horario').flush({});
      await esperar();

      expect(sincronizacion.ultimaActualizacion()).toBeNull();
    });

    it('el sondeo de la campana se guarda pero no cuenta como lo que muestra la pantalla', async () => {
      const avisos = `${environment.apiUrl}/mis/avisos?soloSinLeer=true`;

      leer(avisos);
      backend.expectOne(avisos).flush({ avisos: [], sinLeer: 0 });
      await esperar();

      expect(await copia.leer(`1|${avisos}`)).not.toBeNull();
      expect(sincronizacion.ultimaActualizacion()).toBeNull();
    });

    it('si una pantalla hace varias lecturas, la fecha que cuenta es la más antigua', async () => {
      await copia.guardar(`1|${PENDIENTES}`, [], 500);

      leer(HORARIO);
      backend.expectOne(HORARIO).flush({ dias: [] });
      leer(PENDIENTES);
      backend.expectOne(PENDIENTES).error(new ProgressEvent('error'), { status: 0 });
      await esperar();

      expect(sincronizacion.ultimaActualizacion()).toBe(500);
    });
  });

  describe('escrituras', () => {
    it('con conexión pasan como siempre', () => {
      http.post(PENDIENTES, { titulo: 'Taller' }).subscribe();

      const peticion = backend.expectOne(PENDIENTES);
      expect(peticion.request.method).toBe('POST');
      peticion.flush({ id: 1 });
    });

    it('sin conexión no salen y responden como falta de conexión', () => {
      enLinea.set(false);
      let error: HttpErrorResponse | undefined;

      http.post(PENDIENTES, { titulo: 'Taller' }).subscribe({ error: (e: HttpErrorResponse) => (error = e) });

      backend.expectNone(PENDIENTES);
      expect(error?.status).toBe(0);
    });

    it('sin conexión tampoco salen los cambios y los borrados', () => {
      enLinea.set(false);
      const errores: number[] = [];

      http.put(PENDIENTES, {}).subscribe({ error: (e: HttpErrorResponse) => errores.push(e.status) });
      http.delete(PENDIENTES).subscribe({ error: (e: HttpErrorResponse) => errores.push(e.status) });

      backend.expectNone(PENDIENTES);
      expect(errores).toEqual([0, 0]);
    });

    it('las lecturas sin conexión siguen saliendo hacia el servidor para intentar la red', async () => {
      enLinea.set(false);
      await copia.guardar(`1|${HORARIO}`, { dias: ['guardado'] }, 1);

      const resultado = leer(HORARIO);
      backend.expectOne(HORARIO).error(new ProgressEvent('error'), { status: 0 });
      await esperar();

      expect(resultado.valor).toEqual({ dias: ['guardado'] });
    });
  });

  it('en un equipo compartido no guarda la lectura (SCRUM-231)', async () => {
    TestBed.inject(DispositivoDeLaSesion).marcar(false);

    http.get(HORARIO).subscribe();
    backend.expectOne(HORARIO).flush({ bloques: ['lunes'] });
    await Promise.resolve();

    expect(await copia.leer(`${ana.id}|${HORARIO}`)).toBeNull();
    localStorage.clear();
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { PedidoDePropuestas, PropuestasDeHorario } from '../propuesta-de-horario.repository';
import { PropuestaDeHorarioHttpRepository } from './propuesta-de-horario-http.repository';

describe('PropuestaDeHorarioHttpRepository', () => {
  const PEDIDO: PedidoDePropuestas = {
    asignaturas: [
      { nombre: 'Cálculo', grupos: [{ codigo: '1', bloques: [{ dia: 'lunes', inicio: '08:00', fin: '10:00' }] }] },
    ],
    criterio: { franja: 'manana', pocosHuecos: true, diasLibres: [], diaLibre: true },
  };

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('manda la oferta y lo que se prefiere por POST a la ruta de propuestas y devuelve lo que responde el servidor', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), PropuestaDeHorarioHttpRepository],
    });
    const respuesta: PropuestasDeHorario = { propuestas: [], choques: [], mensaje: 'No hay', busquedaIncompleta: false };
    let recibida: PropuestasDeHorario | undefined;

    TestBed.inject(PropuestaDeHorarioHttpRepository).proponer(PEDIDO).subscribe((r) => (recibida = r));

    const peticion = TestBed.inject(HttpTestingController).expectOne(`${environment.apiUrl}/mis/horario/propuestas`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(PEDIDO);
    peticion.flush(respuesta);
    expect(recibida).toEqual(respuesta);
  });
});

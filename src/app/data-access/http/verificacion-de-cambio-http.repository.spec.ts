import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { PedidoDeVerificacion } from '../verificacion-de-cambio.repository';
import { VerificacionDeCambioHttpRepository } from './verificacion-de-cambio-http.repository';

describe('VerificacionDeCambioHttpRepository', () => {
  const PEDIDO: PedidoDeVerificacion = {
    horario: [{ asignatura: 'Álgebra lineal', grupo: { codigo: '502', bloques: [{ dia: 'lunes', inicio: '07:00', fin: '09:00' }] } }],
    asignaturaACambiar: 'Física',
    candidatos: [{ codigo: '503', bloques: [{ dia: 'lunes', inicio: '08:00', fin: '10:00' }] }],
  };

  it('manda el horario, la materia y los grupos a /mis/horario/verificaciones y devuelve lo que responde', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), VerificacionDeCambioHttpRepository],
    });
    const repositorio = TestBed.inject(VerificacionDeCambioHttpRepository);
    const http = TestBed.inject(HttpTestingController);
    const respuesta = {
      candidatos: [
        { grupo: '503', cabe: false, choques: [{ asignatura: 'Álgebra lineal', grupo: '502', dia: 'lunes', inicio: '07:00', fin: '09:00' }] },
      ],
    };
    let recibido: unknown;

    repositorio.verificar(PEDIDO).subscribe((r) => (recibido = r));

    const peticion = http.expectOne(`${environment.apiUrl}/mis/horario/verificaciones`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(PEDIDO);
    peticion.flush(respuesta);
    expect(recibido).toEqual(respuesta);
    http.verify();
  });
});

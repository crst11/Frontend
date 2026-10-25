import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { SugerenciaDeMatricula } from '../sugerencia-de-matricula.repository';
import { SugerenciaDeMatriculaHttpRepository } from './sugerencia-de-matricula-http.repository';

describe('SugerenciaDeMatriculaHttpRepository', () => {
  const RESPUESTA: SugerenciaDeMatricula = {
    semestreActual: 2,
    semestreSugerido: 3,
    materias: [
      { codigo: 'A', nombre: 'Materia A', creditos: 3, semestre: 3, motivoDeSugerencia: 'siguiente_semestre', dependeDeUnaEnCurso: false },
    ],
    creditos: 3,
    adelantables: [],
    motivo: null,
  };

  it('pide la sugerencia a /mis/horario/sugerencia-de-matricula sin mandar nada y devuelve lo que responde', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), SugerenciaDeMatriculaHttpRepository],
    });
    const repositorio = TestBed.inject(SugerenciaDeMatriculaHttpRepository);
    const http = TestBed.inject(HttpTestingController);
    let recibido: unknown;

    repositorio.consultar().subscribe((r) => (recibido = r));

    const peticion = http.expectOne(`${environment.apiUrl}/mis/horario/sugerencia-de-matricula`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush(RESPUESTA);
    expect(recibido).toEqual(RESPUESTA);
    http.verify();
  });
});

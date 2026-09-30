import { esCorreoNoEnviado, esFalloDelServidor } from './server-failure';

describe('esCorreoNoEnviado', () => {
  it('reconoce el 503 del correo que no salió y no otros 503', () => {
    expect(esCorreoNoEnviado({ status: 503, error: { title: 'Correo no enviado' } })).toBe(true);
    expect(esCorreoNoEnviado({ status: 503, error: { title: 'Servicio externo no disponible' } })).toBe(false);
    expect(esCorreoNoEnviado({ status: 503, error: null })).toBe(false);
    expect(esCorreoNoEnviado({ status: 0 })).toBe(false);
  });
});

describe('esFalloDelServidor', () => {
  it('reconoce la falta de conexión y los errores internos', () => {
    expect(esFalloDelServidor({ status: 0 })).toBe(true);
    expect(esFalloDelServidor({ status: 500 })).toBe(true);
    expect(esFalloDelServidor({ status: 503 })).toBe(true);
  });

  it('deja como errores del formulario los que trae un mensaje para la persona', () => {
    expect(esFalloDelServidor({ status: 400 })).toBe(false);
    expect(esFalloDelServidor({ status: 401 })).toBe(false);
    expect(esFalloDelServidor({ status: 409 })).toBe(false);
    expect(esFalloDelServidor({})).toBe(false);
  });
});

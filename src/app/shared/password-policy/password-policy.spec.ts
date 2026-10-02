import { FormControl, FormGroup } from '@angular/forms';
import { contrasenaDistintaDelCorreo, contrasenaSegura, REQUISITOS_DE_CONTRASENA } from './password-policy';

describe('política de contraseña', () => {
  function validar(valor: string) {
    return contrasenaSegura(new FormControl(valor));
  }

  it('acepta una contraseña que cumple todos los requisitos', () => {
    expect(validar('Segura2026!')).toBeNull();
  });

  it.each([
    ['menos de 8 caracteres', 'Corta1!'],
    ['sin mayúscula', 'segura2026!'],
    ['sin minúscula', 'SEGURA2026!'],
    ['sin número', 'SeguraClave!'],
    ['sin carácter especial', 'Segura2026'],
  ])('rechaza una contraseña %s', (_caso, candidata) => {
    expect(validar(candidata)).toEqual({ contrasenaInsegura: true });
  });

  it('deja pasar el campo vacío: de eso se encarga Validators.required', () => {
    expect(validar('')).toBeNull();
  });

  it('rechaza la que supera el límite que bcrypt tiene en cuenta', () => {
    expect(validar('Aa1!'.repeat(19))).toEqual({ contrasenaMuyLarga: true });
  });

  it('rechaza la contraseña que contiene el usuario del correo', () => {
    const grupo = new FormGroup({
      correo: new FormControl('ana.diaz@ucundinamarca.edu.co'),
      contrasena: new FormControl('Ana.diaz2026!'),
    });

    expect(contrasenaDistintaDelCorreo(grupo)).toEqual({ contrasenaConElCorreo: true });
  });

  it('un usuario muy corto no bloquea contraseñas razonables', () => {
    const grupo = new FormGroup({
      correo: new FormControl('ana@ucundinamarca.edu.co'),
      contrasena: new FormControl('Manana2026!'),
    });

    expect(contrasenaDistintaDelCorreo(grupo)).toBeNull();
  });

  it('expone los requisitos para mostrarlos en la pantalla', () => {
    expect(REQUISITOS_DE_CONTRASENA).toHaveLength(5);
    expect(REQUISITOS_DE_CONTRASENA.filter((r) => r.cumple('Segura2026!'))).toHaveLength(5);
  });
});

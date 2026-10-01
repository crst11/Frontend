import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Política de contraseña de CundiApp (SCRUM-66). Es el espejo de la clase `Contrasena` del backend,
 * que es quien manda: aquí se repite solo para avisarle a la persona mientras escribe, en vez de
 * dejar que se entere al enviar el formulario.
 *
 * Si la política cambia en el backend, cambia aquí también.
 */

export const LONGITUD_MINIMA = 10;

/** bcrypt solo tiene en cuenta los primeros 72 bytes: más allá no agrega seguridad. */
export const MAXIMO_BYTES = 72;

export interface RequisitoDeContrasena {
  readonly etiqueta: string;
  readonly cumple: (valor: string) => boolean;
}

export const REQUISITOS_DE_CONTRASENA: readonly RequisitoDeContrasena[] = [
  { etiqueta: `Al menos ${LONGITUD_MINIMA} caracteres`, cumple: (v) => v.length >= LONGITUD_MINIMA },
  { etiqueta: 'Una mayúscula', cumple: (v) => /\p{Lu}/u.test(v) },
  { etiqueta: 'Una minúscula', cumple: (v) => /\p{Ll}/u.test(v) },
  { etiqueta: 'Un número', cumple: (v) => /\p{Nd}/u.test(v) },
  { etiqueta: 'Un carácter especial', cumple: (v) => /[^\p{L}\p{N}\s]/u.test(v) },
];

function bytes(valor: string): number {
  return new TextEncoder().encode(valor).length;
}

/** Valida la política completa. Un campo vacío lo deja pasar: de eso se encarga `Validators.required`. */
export const contrasenaSegura: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor: string = control.value ?? '';
  if (!valor) {
    return null;
  }
  if (bytes(valor) > MAXIMO_BYTES) {
    return { contrasenaMuyLarga: true };
  }
  return REQUISITOS_DE_CONTRASENA.every((requisito) => requisito.cumple(valor))
    ? null
    : { contrasenaInsegura: true };
};

/**
 * Rechaza la contraseña que contenga el usuario del correo, igual que el backend. Se aplica sobre el
 * formulario porque necesita los dos campos.
 */
export function contrasenaDistintaDelCorreo(grupo: AbstractControl): ValidationErrors | null {
  const contrasena: string = grupo.get('contrasena')?.value ?? '';
  const correo: string = grupo.get('correo')?.value ?? '';
  const usuario = correo.split('@')[0].toLowerCase();
  return usuario.length >= 4 && contrasena.toLowerCase().includes(usuario)
    ? { contrasenaConElCorreo: true }
    : null;
}

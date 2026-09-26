import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** El único dominio de correo que acepta la app; se ve aquí y lo valida el backend. */
export const DOMINIO_INSTITUCIONAL = '@ucundinamarca.edu.co';

/**
 * Campo de correo institucional: la persona solo escribe su usuario y el dominio queda siempre
 * a la vista, ya puesto. Si pega un correo completo (o le da a la arroba), lo que sigue de la
 * arroba se descarta enseguida, porque el dominio no cambia. Se usa con formControlName como
 * cualquier input y entrega el correo completo ("usuario@ucundinamarca.edu.co") al formulario.
 */
@Component({
  selector: 'app-institutional-email-input',
  templateUrl: './institutional-email-input.html',
  styleUrl: './institutional-email-input.css',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => InstitutionalEmailInput), multi: true }],
})
export class InstitutionalEmailInput implements ControlValueAccessor {
  readonly inputId = input.required<string>();
  readonly placeholder = input('tu.nombre');
  readonly autocomplete = input('username');
  readonly invalid = input(false);

  protected readonly dominio = DOMINIO_INSTITUCIONAL;
  protected readonly usuario = signal('');
  protected readonly deshabilitado = signal(false);

  private avisarCambio: (correo: string) => void = () => undefined;
  private avisarToque: () => void = () => undefined;

  writeValue(correo: string | null): void {
    this.usuario.set(usuarioDe(correo ?? ''));
  }

  registerOnChange(fn: (correo: string) => void): void {
    this.avisarCambio = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.avisarToque = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado.set(deshabilitado);
  }

  protected escribir(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const usuario = usuarioDe(campo.value);
    this.usuario.set(usuario);
    campo.value = usuario; // si pegó el correo completo, el campo se queda solo con el usuario.
    this.avisarCambio(usuario ? usuario + this.dominio : '');
  }

  protected tocar(): void {
    this.avisarToque();
  }
}

/** Antes de la primera arroba: lo que se pegue o se escriba después, incluido el dominio, se ignora. */
function usuarioDe(texto: string): string {
  const arroba = texto.indexOf('@');
  return (arroba === -1 ? texto : texto.slice(0, arroba)).trim();
}

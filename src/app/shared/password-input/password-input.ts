import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Campo de contraseña con el ojo para mostrarla u ocultarla. Se usa con formControlName como
 * cualquier input; la etiqueta, el hint y el error los sigue poniendo la pantalla que lo usa.
 */
@Component({
  selector: 'app-password-input',
  templateUrl: './password-input.html',
  styleUrl: './password-input.css',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PasswordInput), multi: true }],
})
export class PasswordInput implements ControlValueAccessor {
  /** Es el id del input real, para que el label de la pantalla lo apunte con `for`. */
  readonly inputId = input.required<string>();
  readonly placeholder = input('');
  readonly autocomplete = input('current-password');
  readonly invalid = input(false);

  protected readonly visible = signal(false);
  protected readonly valor = signal('');
  protected readonly deshabilitado = signal(false);

  private avisarCambio: (valor: string) => void = () => undefined;
  private avisarToque: () => void = () => undefined;

  writeValue(valor: string | null): void {
    this.valor.set(valor ?? '');
  }

  registerOnChange(fn: (valor: string) => void): void {
    this.avisarCambio = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.avisarToque = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado.set(deshabilitado);
  }

  protected escribir(evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.valor.set(valor);
    this.avisarCambio(valor);
  }

  protected tocar(): void {
    this.avisarToque();
  }

  protected alternar(): void {
    this.visible.update((actual) => !actual);
  }
}

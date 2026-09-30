import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { PasswordInput } from './password-input';

@Component({
  imports: [ReactiveFormsModule, PasswordInput],
  template: `<app-password-input inputId="clave" placeholder="Tu clave" [formControl]="control" />`,
})
class Anfitrion {
  readonly control = new FormControl('', { nonNullable: true, validators: Validators.required });
}

describe('PasswordInput', () => {
  function crear() {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      control: fixture.componentInstance.control,
      campo: html.querySelector<HTMLInputElement>('#clave')!,
      ojo: html.querySelector<HTMLButtonElement>('.password__toggle')!,
    };
  }

  it('empieza oculta y el ojo la muestra y la vuelve a ocultar', () => {
    const { fixture, campo, ojo } = crear();

    expect(campo.type).toBe('password');
    expect(ojo.getAttribute('aria-label')).toBe('Mostrar contraseña');

    ojo.click();
    fixture.detectChanges();
    expect(campo.type).toBe('text');
    expect(ojo.getAttribute('aria-label')).toBe('Ocultar contraseña');
    expect(ojo.getAttribute('aria-pressed')).toBe('true');

    ojo.click();
    fixture.detectChanges();
    expect(campo.type).toBe('password');
  });

  it('lo que se escribe llega al formulario y lo que pone el formulario se ve en el campo', () => {
    const { fixture, campo, control } = crear();

    campo.value = 'unaClaveSegura';
    campo.dispatchEvent(new Event('input'));
    expect(control.value).toBe('unaClaveSegura');

    control.setValue('otraClave');
    fixture.detectChanges();
    expect(campo.value).toBe('otraClave');
  });

  it('salir del campo lo marca como tocado para mostrar el error', () => {
    const { campo, control } = crear();

    campo.dispatchEvent(new Event('blur'));

    expect(control.touched).toBe(true);
  });

  it('respeta el estado deshabilitado del formulario', () => {
    const { fixture, campo, control } = crear();

    control.disable();
    fixture.detectChanges();

    expect(campo.disabled).toBe(true);
  });

  it('mostrar la contraseña no cambia lo escrito', () => {
    const { fixture, campo, ojo, control } = crear();

    campo.value = 'secreta123';
    campo.dispatchEvent(new Event('input'));
    ojo.click();
    fixture.detectChanges();

    expect(campo.value).toBe('secreta123');
    expect(control.value).toBe('secreta123');
  });
});

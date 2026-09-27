import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { InstitutionalEmailInput } from './institutional-email-input';

@Component({
  imports: [ReactiveFormsModule, InstitutionalEmailInput],
  template: `<app-institutional-email-input inputId="correo" [formControl]="control" />`,
})
class Anfitrion {
  readonly control = new FormControl('', { nonNullable: true, validators: Validators.required });
}

describe('InstitutionalEmailInput', () => {
  function crear() {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      control: fixture.componentInstance.control,
      campo: html.querySelector<HTMLInputElement>('#correo')!,
      dominio: html.querySelector('.institutional-email__domain')!,
    };
  }

  it('muestra el dominio institucional ya puesto, sin que la persona lo escriba', () => {
    const { dominio } = crear();

    expect(dominio.textContent?.trim()).toBe('@ucundinamarca.edu.co');
  });

  it('lo que se escribe llega al formulario como el correo completo', () => {
    const { campo, control } = crear();

    campo.value = 'ana.diaz';
    campo.dispatchEvent(new Event('input'));

    expect(control.value).toBe('ana.diaz@ucundinamarca.edu.co');
    expect(campo.value).toBe('ana.diaz');
  });

  it('si escribe la arroba y sigue tecleando, lo que sigue de la arroba se descarta', () => {
    const { campo, control } = crear();

    for (const texto of ['ana', 'ana@', 'ana@g', 'ana@gmail.com']) {
      campo.value = texto;
      campo.dispatchEvent(new Event('input'));
    }

    expect(campo.value).toBe('ana');
    expect(control.value).toBe('ana@ucundinamarca.edu.co');
  });

  it('si pegan el correo completo, el campo se queda solo con el usuario', () => {
    const { campo, control } = crear();

    campo.value = 'ana.diaz@ucundinamarca.edu.co';
    campo.dispatchEvent(new Event('input'));

    expect(campo.value).toBe('ana.diaz');
    expect(control.value).toBe('ana.diaz@ucundinamarca.edu.co');
  });

  it('sin usuario el correo queda vacío, no "@ucundinamarca.edu.co"', () => {
    const { campo, control } = crear();

    campo.value = '';
    campo.dispatchEvent(new Event('input'));

    expect(control.value).toBe('');
  });

  it('un correo ya cargado en el formulario muestra solo el usuario en el campo', () => {
    const { fixture, campo, control } = crear();

    control.setValue('ana.diaz@ucundinamarca.edu.co');
    fixture.detectChanges();

    expect(campo.value).toBe('ana.diaz');
  });

  it('salir del campo lo marca como tocado', () => {
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
});

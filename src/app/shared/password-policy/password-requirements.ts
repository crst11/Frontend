import { Component, computed, input } from '@angular/core';
import { REQUISITOS_DE_CONTRASENA } from './password-policy';

/**
 * Lista los requisitos de la contraseña y marca los que ya se cumplen mientras la persona escribe.
 * Avisar antes es más amable que rechazar el formulario al enviarlo.
 */
@Component({
  selector: 'app-password-requirements',
  templateUrl: './password-requirements.html',
  styleUrl: './password-requirements.css',
})
export class PasswordRequirements {
  readonly valor = input.required<string>();

  protected readonly requisitos = computed(() => {
    const valor = this.valor() ?? '';
    return REQUISITOS_DE_CONTRASENA.map((requisito) => ({
      etiqueta: requisito.etiqueta,
      cumplido: valor.length > 0 && requisito.cumple(valor),
    }));
  });
}

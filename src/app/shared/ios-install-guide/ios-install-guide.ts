import { Component, input, output } from '@angular/core';

/**
 * Cómo instalar CundiApp en un iPhone o iPad para recibir avisos (RF10, SCRUM-37). En iOS los avisos solo
 * llegan a una aplicación instalada en la pantalla de inicio, no a una página abierta en Safari.
 *
 * <p>Se muestra en la pantalla de avisos y, una vez, en el primer ingreso desde un iPhone o iPad; en este
 * segundo caso la persona puede descartarla.
 */
@Component({
  selector: 'app-ios-install-guide',
  templateUrl: './ios-install-guide.html',
  styleUrl: './ios-install-guide.css',
})
export class IosInstallGuide {
  /** Si la guía se puede cerrar: lo pide quien la muestra una sola vez y no la deja fija. */
  readonly descartable = input(false);
  readonly descartada = output<void>();
}

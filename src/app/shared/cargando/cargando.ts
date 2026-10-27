import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Indicador de que la app está trayendo algo (SCRUM-267): cuatro puntos verdes que pulsan uno tras otro, junto al texto de lo que se
 * está haciendo. El texto va siempre, también para los lectores de pantalla (`role="status"`); los puntos son solo adorno.
 */
@Component({
  selector: 'app-cargando',
  templateUrl: './cargando.html',
  styleUrl: './cargando.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Cargando {
  /** Qué se está haciendo, por ejemplo «Buscando tu horario…». */
  readonly mensaje = input.required<string>();
}

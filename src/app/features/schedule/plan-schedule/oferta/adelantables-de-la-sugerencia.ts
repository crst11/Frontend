import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, linkedSignal } from '@angular/core';
import { Adelantable, queCaben } from './sugerencia-en-oferta';

/** Lo más que se acepta escribir en «créditos que puedes llevar»: evita números absurdos, no es un tope de la universidad. */
const MAXIMO_QUE_SE_ACEPTA = 60;

/**
 * «Podrías adelantar» (SCRUM-257): lo que la persona ya puede cursar de semestres siguientes, dicho con su requisito
 * (sin prerrequisitos, o los que ya aprobó). Solo informa: no se marca ni entra al horario. Con «créditos que puedes
 * llevar», que arranca con la carga que el plan asigna al semestre y se puede editar (por si no va nivelada), dice
 * cuáles caben en lo que sobra después de las materias del semestre.
 *
 * <p>La resta y el filtro son aritmética sobre lo que dijo el servidor; no hay reglas de la universidad aquí.
 */
@Component({
  selector: 'app-adelantables-de-la-sugerencia',
  imports: [NgTemplateOutlet],
  templateUrl: './adelantables-de-la-sugerencia.html',
  styleUrl: './adelantables-de-la-sugerencia.css',
})
export class AdelantablesDeLaSugerencia {
  /** Lo adelantable que la oferta del período trae, de menos a más créditos. */
  readonly adelantables = input.required<Adelantable[]>();
  /** Lo que el plan asigna al semestre sugerido: con esto arranca el cuadro. */
  readonly creditosDelSemestre = input.required<number>();
  /** Lo que suman las materias del semestre que la persona dejó marcadas. */
  readonly creditosMarcados = input.required<number>();

  protected readonly maximo = MAXIMO_QUE_SE_ACEPTA;

  /** Lo que la persona escribió; si la carga del plan cambia (otra sugerencia), vuelve a arrancar con ella. */
  protected readonly disponibles = linkedSignal<number | null>(() => this.creditosDelSemestre());

  protected readonly sobran = computed(() => {
    const disponibles = this.disponibles();
    return disponibles === null ? null : disponibles - this.creditosMarcados();
  });
  protected readonly lasQueCaben = computed(() => {
    const sobran = this.sobran();
    return sobran === null ? [] : queCaben(this.adelantables(), sobran);
  });

  protected escribir(evento: Event): void {
    const texto = (evento.target as HTMLInputElement).value.trim();
    const valor = Number(texto);
    const valido = texto !== '' && Number.isInteger(valor) && valor >= 0 && valor <= MAXIMO_QUE_SE_ACEPTA;
    this.disponibles.set(valido ? valor : null);
  }

  protected volverAlPlan(): void {
    this.disponibles.set(this.creditosDelSemestre());
  }
}

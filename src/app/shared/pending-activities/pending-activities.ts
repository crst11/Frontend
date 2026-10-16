import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CategoriaDeEvaluacion, EvaluacionRepository } from '../../data-access/evaluacion.repository';

/** Una categoría con solo las actividades que todavía no tienen nota. */
interface CategoriaPendiente {
  consecutivo: number;
  nombre: string;
  porcentaje: number;
  actividades: CategoriaDeEvaluacion['actividades'];
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Las actividades que le faltan por calificar al estudiante en una asignatura. Se despliega bajo la
 * clase que se tocó, en el horario y en la pantalla del día, para ver lo que viene sin salir de la
 * pantalla. Pide la estructura de la asignatura al abrirse y muestra solo lo que **no** tiene nota: las
 * notas ya puestas se ven y se editan en *Mis notas*, a donde lleva el enlace de abajo.
 */
@Component({
  selector: 'app-pending-activities',
  imports: [RouterLink],
  templateUrl: './pending-activities.html',
  styleUrl: './pending-activities.css',
})
export class PendingActivities implements OnInit {
  private readonly evaluaciones = inject(EvaluacionRepository);
  private readonly destruccion = inject(DestroyRef);

  readonly idMatricula = input.required<number>();
  /** La ruta a la que vuelve el estudiante desde *Mis notas* o desde subir las actividades. */
  readonly origen = input.required<string>();

  protected readonly cargando = signal(true);
  protected readonly fallo = signal(false);
  private readonly categorias = signal<CategoriaDeEvaluacion[]>([]);

  /**
   * Verdadero si la asignatura no tiene ninguna actividad. Se cuentan las actividades y no los cortes:
   * una materia con la plantilla de cortes pero sin actividades todavía no las ha subido.
   */
  protected readonly sinActividades = computed(() =>
    this.categorias().every((categoria) => categoria.actividades.length === 0),
  );

  protected readonly pendientes = computed<CategoriaPendiente[]>(() =>
    this.categorias()
      .map((categoria) => ({
        consecutivo: categoria.consecutivo,
        nombre: categoria.nombre,
        porcentaje: categoria.porcentaje,
        actividades: categoria.actividades.filter((actividad) => actividad.nota === null),
      }))
      .filter((categoria) => categoria.actividades.length > 0),
  );

  protected readonly cuantasFaltan = computed(() =>
    this.pendientes().reduce((suma, categoria) => suma + categoria.actividades.length, 0),
  );

  ngOnInit(): void {
    this.evaluaciones
      .estructuraDe(this.idMatricula())
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (estructura) => {
          this.categorias.set(estructura.categorias);
          this.cargando.set(false);
        },
        error: () => {
          this.fallo.set(true);
          this.cargando.set(false);
        },
      });
  }

  /** «20 oct», o nada si la actividad no tiene fecha programada. */
  protected fechaCorta(fecha: string | null): string {
    if (!fecha) {
      return '';
    }
    const [, mes, dia] = fecha.split('-').map(Number);
    return mes >= 1 && mes <= 12 && dia >= 1 ? `${dia} ${MESES_CORTOS[mes - 1]}` : '';
  }
}

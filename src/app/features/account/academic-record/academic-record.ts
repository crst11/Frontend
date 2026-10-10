import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AsignaturaCursada,
  HistorialRepository,
  MiHistorial,
  PeriodoCursado,
} from '../../../data-access/historial.repository';

/** Cómo se nombra cada semestre cursado. Más allá del doceavo, se cae a "13º", "14º"… */
const ORDINALES = ['1er', '2do', '3er', '4to', '5to', '6to', '7mo', '8vo', '9no', '10mo', '11vo', '12vo'];

/**
 * Mi historial y mis promedios (RF02, SCRUM-22). El frontend no calcula nada: los promedios, los
 * créditos y el avance llegan hechos del backend, donde viven en el dominio.
 */
@Component({
  selector: 'app-academic-record',
  imports: [RouterLink],
  templateUrl: './academic-record.html',
  styleUrl: './academic-record.css',
})
export class AcademicRecord {
  private readonly repositorio = inject(HistorialRepository);

  protected readonly historial = signal<MiHistorial | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal(false);
  protected readonly periodoAbierto = signal<string | null>(null);

  /** Sin períodos no hay nada que mostrar: la carga del reporte llega con su propia historia. */
  protected readonly vacio = computed(() => this.historial()?.periodos.length === 0);

  constructor() {
    this.repositorio.miHistorial().subscribe({
      next: (historial) => {
        this.historial.set(historial);
        // El último período es el que el estudiante quiere ver primero: es su semestre actual.
        this.periodoAbierto.set(historial.periodos.at(-1)?.codigo ?? null);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      },
    });
  }

  protected abierto(codigo: string): boolean {
    return this.periodoAbierto() === codigo;
  }

  protected alternar(codigo: string): void {
    this.periodoAbierto.update((abierto) => (abierto === codigo ? null : codigo));
  }

  /** Los períodos tal como el estudiante los cursó, del primero al último. */
  private readonly enOrden = computed(() => (this.historial()?.periodos ?? []).map((p) => p.codigo));

  /**
   * En qué semestre de su carrera va ese período (SCRUM-75).
   *
   * <p>Se cuenta lo que el estudiante cursó, no el calendario: si dejó de estudiar un semestre, su
   * tercer semestre cursado sigue siendo el tercero. La pantalla lo advierte para que nadie crea
   * que la cuenta está mal.
   */
  protected ordinalDelPeriodo(codigo: string): string {
    const posicion = this.enOrden().indexOf(codigo);
    if (posicion < 0) {
      return codigo;
    }
    return `${ORDINALES[posicion] ?? `${posicion + 1}º`} semestre`;
  }

  /** "2024-2" se lee mejor como "2024 · segundo semestre". */
  protected nombreDelPeriodo(codigo: string): string {
    const [anio, semestre] = codigo.split('-');
    if (!semestre) {
      return codigo;
    }
    return `${anio} · ${semestre === '1' ? 'primer' : 'segundo'} semestre`;
  }

  /** Los períodos se muestran del más reciente al más antiguo: lo de ahora importa más. */
  protected readonly periodosRecientesPrimero = computed(() =>
    [...(this.historial()?.periodos ?? [])].reverse(),
  );

  protected etiquetaDeCreditos(creditos: number): string {
    return creditos === 1 ? '1 crédito' : `${creditos} créditos`;
  }

  protected notaVisible(asignatura: AsignaturaCursada): string {
    return asignatura.nota === null ? 'Sin nota' : asignatura.nota.toFixed(1);
  }

  protected estadoVisible(asignatura: AsignaturaCursada): string {
    const nombres: Record<string, string> = {
      aprobada: 'Aprobada',
      reprobada: 'Reprobada',
      cancelada: 'Cancelada',
      en_curso: 'En curso',
    };
    return nombres[asignatura.estado] ?? asignatura.estado;
  }

  /**
   * El promedio llega con dos decimales cuando lo calcula la app y con uno cuando viene del
   * reporte. Se muestran dos solo si los tiene, para no inventar precisión que la universidad no
   * publica.
   */
  protected promedioVisible(promedio: number | null): string {
    if (promedio === null) {
      return 'Sin promedio';
    }
    return Number.isInteger(promedio * 10) ? promedio.toFixed(1) : promedio.toFixed(2);
  }

  protected esOficial(fuente: string | null): boolean {
    return fuente === 'oficial';
  }

  protected totalDeAsignaturas(periodo: PeriodoCursado): number {
    return periodo.asignaturas.length;
  }
}

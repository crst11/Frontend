import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NotifierService } from '../../../core/feedback/notifier.service';
import {
  Asignatura,
  PerfilAcademico,
  Periodo,
  PlanDeEstudiosRepository,
  Programa,
} from '../../../data-access/plan-de-estudios.repository';

/**
 * Mi plan de estudios (RF02, SCRUM-21): elegir el programa y leer la ruta de aprendizaje
 * período por período. El agrupado y los créditos vienen hechos del backend; aquí solo se muestran.
 */
@Component({
  selector: 'app-study-plan',
  imports: [RouterLink],
  templateUrl: './study-plan.html',
  styleUrl: './study-plan.css',
})
export class StudyPlan {
  private readonly repositorio = inject(PlanDeEstudiosRepository);
  private readonly notificador = inject(NotifierService);

  protected readonly perfil = signal<PerfilAcademico | null>(null);
  protected readonly programas = signal<Programa[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal(false);
  protected readonly guardando = signal<string | null>(null);
  protected readonly periodoAbierto = signal<number | null>(null);

  protected readonly plan = computed(() => this.perfil()?.plan ?? null);

  /** Código de asignatura a nombre, para que un prerrequisito se lea y no haya que descifrarlo. */
  private readonly nombrePorCodigo = computed(() => {
    const nombres = new Map<string, string>();
    for (const periodo of this.plan()?.periodos ?? []) {
      for (const asignatura of periodo.asignaturas) {
        nombres.set(asignatura.codigo, asignatura.nombre);
      }
    }
    return nombres;
  });

  constructor() {
    this.cargarPerfil();
  }

  protected nombreDelRequisito(codigo: string): string {
    return this.nombrePorCodigo().get(codigo) ?? codigo;
  }

  /** Las de diagnóstico y nivelatorio valen 0 créditos: se cursan, pero no ponderan. */
  protected noPondera(asignatura: Asignatura): boolean {
    return asignatura.creditos === 0;
  }

  protected abierto(periodo: number): boolean {
    return this.periodoAbierto() === periodo;
  }

  protected alternar(periodo: number): void {
    this.periodoAbierto.update((abierto) => (abierto === periodo ? null : periodo));
  }

  protected etiquetaDeCreditos(creditos: number): string {
    return creditos === 1 ? '1 crédito' : `${creditos} créditos`;
  }

  protected elegir(programa: Programa): void {
    this.guardando.set(programa.codigo);
    this.repositorio.elegirPrograma(programa.codigo).subscribe({
      next: (perfil) => {
        this.perfil.set(perfil);
        this.guardando.set(null);
        // El primer período es el que la persona quiere ver apenas elige: se abre solo.
        this.periodoAbierto.set(perfil.plan?.periodos[0]?.periodo ?? null);
        void this.notificador.aviso(`Tu programa quedó en ${programa.nombre}.`);
      },
      error: () => {
        this.guardando.set(null);
        void this.notificador.problema(
          'No pudimos guardar tu programa',
          'No logramos comunicarnos con el servidor. Intenta de nuevo en unos minutos.',
        );
      },
    });
  }

  protected totalDeAsignaturas(periodo: Periodo): number {
    return periodo.asignaturas.length;
  }

  private cargarPerfil(): void {
    this.repositorio.miPerfil().subscribe({
      next: (perfil) => {
        this.perfil.set(perfil);
        this.periodoAbierto.set(perfil.plan?.periodos[0]?.periodo ?? null);
        this.cargando.set(false);
        if (!perfil.programaElegido) {
          this.cargarProgramas();
        }
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      },
    });
  }

  private cargarProgramas(): void {
    this.repositorio.programas().subscribe({
      next: (programas) => this.programas.set(programas),
      error: () => this.error.set(true),
    });
  }
}

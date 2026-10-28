import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, debounceTime, forkJoin, merge, switchMap, tap } from 'rxjs';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import {
  ActividadDeEvaluacion,
  AsignaturaMatriculada,
  CategoriaDeEvaluacion,
  EstructuraDeEvaluacion,
  EvaluacionRepository,
} from '../../../data-access/evaluacion.repository';
import {
  NotaSimulada,
  ProyeccionDeNota,
  ProyeccionRepository,
} from '../../../data-access/proyeccion.repository';
import { leerNumero } from '../../../shared/leer-numero';
import { Cargando } from '../../../shared/cargando/cargando';

/** Pausa tras la última tecla antes de preguntarle al servidor: el resultado se siente inmediato sin una petición por letra. */
const PAUSA_AL_ESCRIBIR_EN_MS = 300;

const SIN_CONEXION =
  'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.';

/**
 * El simulador de calificaciones (RF08, SCRUM-33 y SCRUM-34): qué nota necesito en lo que falta y qué
 * pasaría si saco tal nota en tal actividad.
 *
 * <p>Aquí no se calcula nada. Cada cambio (la meta o una nota que se prueba) se manda al servidor tras
 * una pausa corta y la pantalla muestra lo que responde; así la cuenta es la misma que en cualquier
 * otro lugar. Lo que se prueba **no se guarda**: vive solo en esta pantalla.
 */
@Component({
  selector: 'app-simulator-screen',
  imports: [Cargando, DecimalPipe, RouterLink],
  templateUrl: './simulator-screen.html',
  styleUrl: './simulator-screen.css',
})
export class SimulatorScreen {
  private readonly proyecciones = inject(ProyeccionRepository);
  private readonly evaluaciones = inject(EvaluacionRepository);
  private readonly notificador = inject(NotifierService);
  private readonly ruta = inject(ActivatedRoute);

  /** Solo las que ya dicen cómo se evalúan: sin pesos no hay cuenta que hacer. */
  protected readonly asignaturas = signal<AsignaturaMatriculada[]>([]);
  protected readonly seleccionada = signal<number | null>(null);
  protected readonly estructura = signal<EstructuraDeEvaluacion | null>(null);
  protected readonly proyeccion = signal<ProyeccionDeNota | null>(null);
  /** Lo que la persona escribió en cada actividad, por `categoria-actividad`. */
  protected readonly probadas = signal<Readonly<Record<string, string>>>({});
  protected readonly metaTexto = signal('');
  protected readonly metaGuardada = signal<number | null>(null);

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  /** Lo que el servidor rechazó de lo que se está probando, para mostrarlo junto a la cuenta. */
  protected readonly errorDelCalculo = signal<string | null>(null);
  protected readonly guardandoMeta = signal(false);

  /** La meta escrita como número: `null` si está vacía y `NaN` si no es un número. */
  private readonly metaLeida = computed(() => leerNumero(this.metaTexto()));
  protected readonly metaInvalida = computed(() => Number.isNaN(this.metaLeida()));
  protected readonly puedeGuardarLaMeta = computed(() => {
    const meta = this.metaLeida();
    return meta !== null && !Number.isNaN(meta) && meta !== this.metaGuardada();
  });
  protected readonly hayNotasProbadas = computed(() => this.notasPorProbar().length > 0);

  private readonly ahora$ = new Subject<void>();
  private readonly alEscribir$ = new Subject<void>();

  constructor() {
    merge(this.ahora$, this.alEscribir$.pipe(debounceTime(PAUSA_AL_ESCRIBIR_EN_MS)))
      .pipe(
        switchMap(() => this.preguntar()),
        takeUntilDestroyed(),
      )
      .subscribe((proyeccion) => {
        this.proyeccion.set(proyeccion);
        this.errorDelCalculo.set(null);
      });
    this.cargar();
  }

  protected clave(categoria: CategoriaDeEvaluacion, actividad: ActividadDeEvaluacion): string {
    return `${categoria.consecutivo}-${actividad.consecutivo}`;
  }

  /** `true` si lo escrito en esa actividad no se puede leer como número. */
  protected esInvalida(categoria: CategoriaDeEvaluacion, actividad: ActividadDeEvaluacion): boolean {
    return Number.isNaN(leerNumero(this.probadas()[this.clave(categoria, actividad)] ?? ''));
  }

  protected valorProbado(categoria: CategoriaDeEvaluacion, actividad: ActividadDeEvaluacion): string {
    return this.probadas()[this.clave(categoria, actividad)] ?? '';
  }

  protected elegirAsignatura(id: string): void {
    this.seleccionar(Number(id));
  }

  protected probarNota(categoria: CategoriaDeEvaluacion, actividad: ActividadDeEvaluacion, texto: string): void {
    this.probadas.update((actuales) => ({ ...actuales, [this.clave(categoria, actividad)]: texto }));
    this.alEscribir$.next();
  }

  protected cambiarMetaEscrita(texto: string): void {
    this.metaTexto.set(texto);
    this.alEscribir$.next();
  }

  protected limpiarNotasProbadas(): void {
    this.probadas.set({});
    this.ahora$.next();
  }

  /** Deja la meta que se está probando como la meta del estudiante, para todas sus asignaturas. */
  protected guardarMeta(): void {
    const meta = this.metaLeida();
    if (meta === null || Number.isNaN(meta)) {
      return;
    }
    this.guardandoMeta.set(true);
    this.proyecciones.cambiarMeta(meta).subscribe({
      next: (configuracion) => {
        this.guardandoMeta.set(false);
        this.metaGuardada.set(configuracion.meta);
        void this.notificador.aviso('Guardamos tu meta.');
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoMeta.set(false);
        if (esFalloDelServidor(err)) {
          void this.notificador.problema('No pudimos guardar tu meta', SIN_CONEXION);
          return;
        }
        this.errorDelCalculo.set(err.error?.detail ?? 'No pudimos guardar tu meta. Revisa el valor.');
      },
    });
  }

  protected reintentar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.cargar();
  }

  private cargar(): void {
    forkJoin({
      asignaturas: this.evaluaciones.misAsignaturas('actual'),
      configuracion: this.proyecciones.miConfiguracion(),
    }).subscribe({
      next: ({ asignaturas, configuracion }) => {
        const conEstructura = asignaturas.filter((a) => a.tieneEstructura);
        this.asignaturas.set(conEstructura);
        this.metaGuardada.set(configuracion.meta);
        this.metaTexto.set(String(configuracion.meta));
        this.cargando.set(false);
        const pedida = Number(this.ruta.snapshot.queryParamMap.get('asignatura'));
        const inicial = conEstructura.find((a) => a.idMatricula === pedida) ?? conEstructura[0];
        if (inicial) {
          this.seleccionar(inicial.idMatricula);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set('No pudimos preparar el simulador. Intenta de nuevo en un momento.');
        if (esFalloDelServidor(err)) {
          void this.notificador.problema('No pudimos preparar el simulador', SIN_CONEXION);
        }
      },
    });
  }

  private seleccionar(idMatricula: number): void {
    this.seleccionada.set(idMatricula);
    this.probadas.set({});
    this.proyeccion.set(null);
    this.errorDelCalculo.set(null);
    this.evaluaciones.estructuraDe(idMatricula).subscribe({
      next: (estructura) => {
        this.estructura.set(estructura);
        this.ahora$.next();
      },
      error: (err: HttpErrorResponse) => this.mostrarFalla(err),
    });
  }

  /** Las notas que la persona escribió y se pueden leer; lo ilegible se avisa junto al campo y no se manda. */
  private notasPorProbar(): NotaSimulada[] {
    const notas: NotaSimulada[] = [];
    for (const [clave, texto] of Object.entries(this.probadas())) {
      const nota = leerNumero(texto);
      if (nota === null || Number.isNaN(nota)) {
        continue;
      }
      const [consecCategoria, consecActividad] = clave.split('-').map(Number);
      notas.push({ consecCategoria, consecActividad, nota });
    }
    return notas;
  }

  private preguntar() {
    const id = this.seleccionada();
    if (id === null || this.metaInvalida()) {
      return EMPTY;
    }
    const meta = this.metaLeida() ?? undefined;
    return this.proyecciones.simular(id, this.notasPorProbar(), meta).pipe(
      tap(() => this.errorDelCalculo.set(null)),
      catchError((err: HttpErrorResponse) => {
        this.mostrarFalla(err);
        return EMPTY;
      }),
    );
  }

  private mostrarFalla(err: HttpErrorResponse): void {
    if (esFalloDelServidor(err)) {
      void this.notificador.problema('No pudimos hacer la cuenta', SIN_CONEXION);
      this.errorDelCalculo.set('No pudimos hacer la cuenta. Intenta de nuevo en un momento.');
      return;
    }
    this.errorDelCalculo.set(err.error?.detail ?? 'No pudimos hacer la cuenta. Revisa lo que escribiste.');
  }
}

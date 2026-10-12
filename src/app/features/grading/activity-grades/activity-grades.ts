import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import { NotifierService } from '../../../core/feedback/notifier.service';
import {
  AcumuladoDeNotas,
  CategoriaDeEvaluacion,
  EstructuraDeEvaluacion,
  EvaluacionRepository,
} from '../../../data-access/evaluacion.repository';

/** Lo que este panel le avisa a la pantalla que lo contiene cuando cambia una nota. */
export interface NotasCambiadas {
  categorias: CategoriaDeEvaluacion[];
  acumulado: AcumuladoDeNotas;
}

/**
 * Registrar mis calificaciones (RF05, SCRUM-28).
 *
 * <p>Cada actividad lleva su propio campo de nota: se escribe y se guarda con Enter o al salir del
 * campo, sin otro botón de por medio. Eso es lo que permite el criterio de "máximo tres
 * interacciones": elegir la asignatura, escribir la nota y Enter.
 *
 * <p>Aquí no se calcula nada. El peso de cada actividad en la nota final y el acumulado los
 * calcula el servidor y llegan listos con cada respuesta; la escala (0.0 a 5.0) también la valida
 * él, y su mensaje se muestra tal cual.
 */
@Component({
  selector: 'app-activity-grades',
  imports: [DecimalPipe],
  templateUrl: './activity-grades.html',
  styleUrl: './activity-grades.css',
})
export class ActivityGrades {
  private readonly repositorio = inject(EvaluacionRepository);
  private readonly notificador = inject(NotifierService);

  readonly estructura = input.required<EstructuraDeEvaluacion>();
  readonly cambiaronLasNotas = output<NotasCambiadas>();
  readonly irAEstructura = output<void>();

  /**
   * Copia de trabajo de la estructura. Se vuelve a armar cuando la pantalla le pasa otra (por
   * ejemplo, después de guardar cómo la evalúan) y se va actualizando con cada nota.
   */
  protected readonly categorias = linkedSignal(() => this.estructura().categorias);
  protected readonly acumulado = linkedSignal(() => this.estructura().acumulado);

  /** La actividad que se está guardando, para no dejar escribir encima mientras tanto. */
  protected readonly guardando = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly hayActividades = () => this.acumulado().actividadesTotales > 0;

  protected clave(consecCategoria: number, consecActividad: number): string {
    return `${consecCategoria}-${consecActividad}`;
  }

  /**
   * Se llama al confirmar el campo. Vacío es quitar la nota que hubiera; con valor, anotarla o
   * corregirla. Si no cambió nada, no se le pregunta nada al servidor.
   */
  protected confirmar(
    consecCategoria: number,
    consecActividad: number,
    valor: string,
    campo: HTMLInputElement,
  ): void {
    const actual = this.notaDe(consecCategoria, consecActividad);
    const texto = valor.trim();

    if (texto === '') {
      if (actual !== null) {
        this.quitar(consecCategoria, consecActividad);
      }
      return;
    }
    const numero = Number(texto.replace(',', '.'));
    if (!Number.isFinite(numero)) {
      this.error.set('Escribe la nota con números, por ejemplo 3.5.');
      campo.value = actual === null ? '' : String(actual);
      return;
    }
    if (numero === actual) {
      return;
    }
    this.registrar(consecCategoria, consecActividad, numero, campo);
  }

  protected quitar(consecCategoria: number, consecActividad: number): void {
    const asignatura = this.estructura().asignatura.idMatricula;
    this.empezar(consecCategoria, consecActividad);
    this.repositorio.quitarNota(asignatura, consecCategoria, consecActividad).subscribe({
      next: (acumulado) => this.alTerminar(consecCategoria, consecActividad, null, acumulado),
      error: (err: HttpErrorResponse) => this.alFallar(err),
    });
  }

  private registrar(
    consecCategoria: number,
    consecActividad: number,
    nota: number,
    campo: HTMLInputElement,
  ): void {
    const asignatura = this.estructura().asignatura.idMatricula;
    this.empezar(consecCategoria, consecActividad);
    this.repositorio.registrarNota(asignatura, consecCategoria, consecActividad, nota).subscribe({
      next: (resultado) =>
        this.alTerminar(consecCategoria, consecActividad, resultado.nota, resultado.acumulado),
      error: (err: HttpErrorResponse) => {
        // El campo vuelve a lo que de verdad está guardado: dejar escrita una nota que el servidor
        // rechazó haría creer que quedó registrada.
        const guardada = this.notaDe(consecCategoria, consecActividad);
        campo.value = guardada === null ? '' : String(guardada);
        this.alFallar(err);
      },
    });
  }

  private empezar(consecCategoria: number, consecActividad: number): void {
    this.error.set(null);
    this.guardando.set(this.clave(consecCategoria, consecActividad));
  }

  private alTerminar(
    consecCategoria: number,
    consecActividad: number,
    nota: number | null,
    acumulado: AcumuladoDeNotas,
  ): void {
    this.guardando.set(null);
    const categorias = this.categorias().map((categoria) =>
      categoria.consecutivo !== consecCategoria
        ? categoria
        : {
            ...categoria,
            actividades: categoria.actividades.map((actividad) =>
              actividad.consecutivo !== consecActividad
                ? actividad
                : { ...actividad, nota, estadoEntrega: nota === null ? 'no_entregada' : 'calificada' },
            ),
          },
    );
    this.categorias.set(categorias);
    this.acumulado.set(acumulado);
    this.cambiaronLasNotas.emit({ categorias, acumulado });
  }

  /**
   * Lo que el estudiante puede corregir (una nota fuera de escala) va junto al campo; una caída del
   * servidor va a la ventana emergente, porque de eso no tiene culpa.
   */
  private alFallar(err: HttpErrorResponse): void {
    this.guardando.set(null);
    if (esFalloDelServidor(err)) {
      void this.notificador.problema(
        'No pudimos guardar la nota',
        'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.',
      );
      return;
    }
    this.error.set(err.error?.detail ?? 'No pudimos guardar la nota.');
  }

  private notaDe(consecCategoria: number, consecActividad: number): number | null {
    return (
      this.categorias()
        .find((categoria) => categoria.consecutivo === consecCategoria)
        ?.actividades.find((actividad) => actividad.consecutivo === consecActividad)?.nota ?? null
    );
  }
}

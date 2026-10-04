import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import {
  AnalisisDeImportacion,
  AsignaturaDetectada,
  ImportacionRepository,
  PeriodoDetectado,
} from '../../../data-access/importacion.repository';

/** Dónde está el reporte dentro de la plataforma de la universidad. */
interface PasoDeLaGuia {
  texto: string;
  resaltado: string;
}

/**
 * Importar el Registro Académico Extendido (RF03, SCRUM-23).
 *
 * <p>Son dos pantallas en una: primero explica de dónde se saca el archivo y lo recibe, y después
 * muestra lo detectado para que el estudiante confirme. Nada toca su historial hasta que confirme.
 */
@Component({
  selector: 'app-import-report',
  imports: [RouterLink],
  templateUrl: './import-report.html',
  styleUrl: './import-report.css',
})
export class ImportReport {
  private readonly repositorio = inject(ImportacionRepository);
  private readonly notificador = inject(NotifierService);
  private readonly router = inject(Router);

  /** Lo mismo que docs/como-descargar-el-registro-extendido.md, para que no se desincronicen. */
  protected readonly pasos: PasoDeLaGuia[] = [
    { texto: 'En ucundinamarca.edu.co entra a Servicios y luego a Plataforma Institucional, y toca', resaltado: 'ACCESO A PLATAFORMA' },
    { texto: 'Inicia sesión con tu usuario y contraseña, o con', resaltado: 'Iniciar Sesión con Office 365' },
    { texto: 'Ya dentro del Campus TI, en el panel Gestión, abre', resaltado: 'Académico Estudiante' },
    { texto: 'En el menú de la izquierda abre Calificaciones y entra a', resaltado: 'Consultar Registro Extendido' },
    { texto: 'Elige tu programa en la lista y toca', resaltado: 'Continuar' },
    { texto: 'Baja hasta el final, toca Imprimir y en Destino elige', resaltado: 'Guardar como PDF' },
  ];

  protected readonly analisis = signal<AnalisisDeImportacion | null>(null);
  protected readonly analizando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly guiaAbierta = signal(false);

  protected readonly periodos = computed(() => this.analisis()?.periodos ?? []);
  protected readonly fueraDelPlan = computed(() =>
    this.periodos().flatMap((periodo) => periodo.asignaturas.filter((a) => !a.enElPlan)),
  );
  protected readonly nuevas = computed(() =>
    this.periodos().flatMap((p) => p.asignaturas.filter((a) => a.enElPlan && !a.yaEstaba)).length,
  );
  protected readonly actualizadas = computed(() =>
    this.periodos().flatMap((p) => p.asignaturas.filter((a) => a.enElPlan && a.yaEstaba)).length,
  );

  protected alternarGuia(): void {
    this.guiaAbierta.update((abierta) => !abierta);
  }

  protected archivoElegido(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    if (!archivo) {
      return;
    }
    this.analizar(archivo);
    // Se limpia para que elegir el mismo archivo otra vez vuelva a disparar el evento.
    entrada.value = '';
  }

  protected analizar(archivo: File): void {
    this.error.set(null);
    this.analizando.set(true);
    this.repositorio.analizar(archivo).subscribe({
      next: (analisis) => {
        this.analisis.set(analisis);
        this.analizando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.analizando.set(false);
        this.analisis.set(null);
        if (esFalloDelServidor(err)) {
          this.error.set('No logramos comunicarnos con el servidor. Intenta de nuevo en unos minutos.');
          return;
        }
        // El backend explica qué pasó con el archivo; es lo que mejor le sirve al estudiante.
        this.error.set(err.error?.detail ?? 'No pudimos leer el archivo que subiste.');
      },
    });
  }

  protected notaVisible(asignatura: AsignaturaDetectada): string {
    return asignatura.nota === null ? 'Sin nota' : asignatura.nota.toFixed(1);
  }

  protected etiquetaDeCreditos(creditos: number): string {
    return creditos === 1 ? '1 crédito' : `${creditos} créditos`;
  }

  protected nombreDelPeriodo(codigo: string): string {
    const [anio, semestre] = codigo.split('-');
    if (!semestre) {
      return codigo;
    }
    return `${anio} · ${semestre === '1' ? 'primer' : 'segundo'} semestre`;
  }

  protected volverAEmpezar(): void {
    this.analisis.set(null);
    this.error.set(null);
  }

  protected confirmar(): void {
    const analisis = this.analisis();
    if (!analisis) {
      return;
    }

    this.guardando.set(true);
    this.repositorio
      .confirmar({
        nombreArchivo: analisis.nombreArchivo,
        detectadas: analisis.detectadas,
        periodos: analisis.periodos.map((periodo) => ({
          codigo: periodo.codigo,
          creditosMatriculados: periodo.creditosMatriculados ?? 0,
          creditosAprobados: periodo.creditosAprobados ?? 0,
          promedioPeriodo: periodo.promedioPeriodo,
          promedioAcumulado: periodo.promedioAcumulado,
          // Las que no están en el plan no se mandan: el backend las omitiría igual.
          notas: periodo.asignaturas
            .filter((asignatura) => asignatura.enElPlan)
            .map((asignatura) => ({ codigoAsignatura: asignatura.codigo, nota: asignatura.nota })),
        })),
      })
      .subscribe({
        next: (resultado) => {
          this.guardando.set(false);
          void this.notificador.exito(
            'Listo, tus notas quedaron cargadas',
            `${resultado.guardadas} asignaturas nuevas y ${resultado.actualizadas} actualizadas.`,
            'Ver mi historial',
          );
          void this.router.navigate(['/cuenta/historial']);
        },
        error: (err: HttpErrorResponse) => {
          this.guardando.set(false);
          void this.notificador.problema(
            'No pudimos guardar tu reporte',
            err.error?.detail ?? 'Intenta de nuevo en unos minutos.',
          );
        },
      });
  }

  protected totalDeAsignaturas(periodo: PeriodoDetectado): number {
    return periodo.asignaturas.length;
  }
}

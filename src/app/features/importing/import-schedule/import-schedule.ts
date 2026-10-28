import { Location } from '@angular/common';
import { SoltarArchivo } from '../../../shared/file-drop/file-drop';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { NotifierService } from '../../../core/feedback/notifier.service';
import {
  AnalisisDeHorario,
  AsignaturaDelReporte,
  ClaseDetectada,
  ImportacionDeHorarioRepository,
} from '../../../data-access/importacion-de-horario.repository';
import { origenDeLaImportacion } from '../origen-de-la-importacion';

const DIAS: Record<string, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

/** Dónde está el reporte dentro de la plataforma de la universidad. */
interface PasoDeLaGuia {
  texto: string;
  resaltado: string;
  /** Si el texto resaltado lleva a la página de la universidad donde está el botón (SCRUM-250). */
  conEnlace?: boolean;
}

/**
 * Importar el Reporte de Horario (RF04, SCRUM-81).
 *
 * <p>Son dos pantallas en una, como al importar el Registro Académico Extendido: primero recibe el
 * archivo y después muestra lo detectado para que el estudiante confirme. Nada toca su horario hasta
 * que confirme, y lo que se manda de vuelta es lo mismo que se le mostró.
 */
@Component({
  selector: 'app-import-schedule',
  imports: [RouterLink, SoltarArchivo],
  templateUrl: './import-schedule.html',
  styleUrls: ['../import-report/import-report.css', './import-schedule.css'],
})
export class ImportSchedule {
  private readonly repositorio = inject(ImportacionDeHorarioRepository);
  private readonly notificador = inject(NotifierService);
  private readonly router = inject(Router);

  /** Lo mismo que docs/como-descargar-el-reporte-de-horario.md, para que no se desincronicen. */
  protected readonly pasos: PasoDeLaGuia[] = [
    {
      texto: 'En ucundinamarca.edu.co entra a Servicios y luego a Plataforma Institucional, y toca',
      resaltado: 'ACCESO A PLATAFORMA',
      conEnlace: true,
    },
    { texto: 'Inicia sesión con tu usuario y contraseña, o con', resaltado: 'Iniciar Sesión con Office 365' },
    { texto: 'Ya dentro del Campus TI, en el panel Gestión, abre', resaltado: 'Académico Estudiante' },
    { texto: 'En el menú de la izquierda abre', resaltado: 'Horario' },
    { texto: 'Elige tu programa en la lista y toca', resaltado: 'Continuar' },
    { texto: 'Baja hasta el final de la tabla y toca', resaltado: 'Imprimir' },
  ];

  protected readonly urlPlataformaInstitucional = environment.urlPlataformaInstitucional;

  /** A dónde vuelve la flecha: la pantalla de la que se llegó (SCRUM-82). */
  protected readonly origen = origenDeLaImportacion(inject(Location));

  protected readonly analisis = signal<AnalisisDeHorario | null>(null);
  protected readonly analizando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly guiaAbierta = signal(false);

  protected readonly fueraDelPlan = computed(
    () => this.analisis()?.asignaturas.filter((asignatura) => !asignatura.enElPlan) ?? [],
  );
  protected readonly clasesQueSeReemplazan = computed(() =>
    (this.analisis()?.asignaturas ?? [])
      .filter((asignatura) => asignatura.enElPlan)
      .reduce((total, asignatura) => total + asignatura.clasesQueTiene, 0),
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

  /** Soltar un archivo sobre la zona: es lo mismo que elegirlo, pero solo se aceptan PDF. */
  protected soltado(archivo: File): void {
    if (archivo.type !== 'application/pdf' && !/\.pdf$/i.test(archivo.name)) {
      this.error.set('Ese archivo no es un PDF. Suelta el reporte tal como lo descargaste.');
      return;
    }
    this.analizar(archivo);
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
        this.error.set(err.error?.detail ?? 'No pudimos leer el archivo que subiste.');
      },
    });
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
        periodo: analisis.periodo,
        // Las que no están en el plan no se mandan: el backend las omitiría igual.
        asignaturas: analisis.asignaturas
          .filter((asignatura) => asignatura.enElPlan)
          .map((asignatura) => ({ codigo: asignatura.codigo, grupo: asignatura.grupo, clases: asignatura.clases })),
      })
      .subscribe({
        next: (resultado) => {
          this.guardando.set(false);
          void this.notificador.exito(
            'Listo, tu horario quedó cargado',
            `${resultado.nuevas} asignaturas nuevas, ${resultado.actualizadas} actualizadas y ${resultado.clases} clases.`,
            'Ver mi horario',
          );
          // replaceUrl: la importación terminada no queda en el historial, así que el botón atrás del teléfono no vuelve a ella (SCRUM-271).
          void this.router.navigate(['/horario'], { replaceUrl: true });
        },
        error: (err: HttpErrorResponse) => {
          this.guardando.set(false);
          void this.notificador.problema(
            'No pudimos guardar tu horario',
            err.error?.detail ?? 'Intenta de nuevo en unos minutos.',
          );
        },
      });
  }

  protected nombreDelPeriodo(codigo: string): string {
    const [anio, semestre] = codigo.split('-');
    if (!semestre) {
      return codigo;
    }
    return `${anio} · ${semestre === '1' ? 'primer' : 'segundo'} semestre`;
  }

  protected textoDelDia(dia: string): string {
    return DIAS[dia] ?? dia;
  }

  protected lugarDe(clase: ClaseDetectada): string {
    return [clase.salon, clase.bloque].filter((parte) => !!parte).join(' · ');
  }

  protected docenteDe(clase: ClaseDetectada): string {
    return clase.docente ? `${clase.docente.nombres} ${clase.docente.apellidos}` : '';
  }

  protected estadoDe(asignatura: AsignaturaDelReporte): string {
    if (!asignatura.enElPlan) {
      return 'No está en tu ruta de aprendizaje · no se guarda';
    }
    if (!asignatura.yaEstaba) {
      return 'Nueva';
    }
    return asignatura.clasesQueTiene === 0
      ? 'Ya la tienes · se agregan sus clases'
      : `Ya la tienes · reemplaza ${asignatura.clasesQueTiene === 1 ? 'su clase' : `sus ${asignatura.clasesQueTiene} clases`}`;
  }
}

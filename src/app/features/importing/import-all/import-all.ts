import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { AvanceDeInformacion, AvanceRepository, PasoDeAvance } from '../../../data-access/avance.repository';
import { Cargando } from '../../../shared/cargando/cargando';

/** A dónde lleva cada paso. Todas las pantallas de importar vuelven aquí gracias al origen. */
const DESTINOS: Record<string, string> = {
  registro_extendido: '/cuenta/importar-reporte',
  horario: '/cuenta/importar-horario',
  asignatura: '/calificaciones/importar-cmad',
};

/**
 * «Importar todos mis archivos» (RF03, SCRUM-84): lo que ya subió el estudiante y lo que le falta.
 *
 * <p>**El servidor calcula el avance**: la pantalla solo dibuja la barra y la lista, y lleva a la
 * pantalla de importar que corresponde a cada paso. Los pasos son los dos reportes en PDF y una
 * lista de actividades por cada materia que cursa este semestre, así que la barra no llega a 100 %
 * hasta que las materias de ahora estén completas.
 */
@Component({
  selector: 'app-import-all',
  imports: [Cargando, RouterLink],
  templateUrl: './import-all.html',
  styleUrl: './import-all.css',
})
export class ImportAll {
  private readonly repositorio = inject(AvanceRepository);
  private readonly notificador = inject(NotifierService);

  protected readonly avance = signal<AvanceDeInformacion | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  /** Un segmento visual por paso: son solo dibujo, el porcentaje que se anuncia es el que manda el servidor. */
  protected readonly segmentos = computed(() => Array.from({ length: this.avance()?.total ?? 0 }, (_, posicion) => posicion));

  protected readonly completo = computed(() => {
    const avance = this.avance();
    return !!avance && avance.porcentaje === 100;
  });

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.repositorio.miAvance().subscribe({
      next: (avance) => {
        this.avance.set(avance);
        this.error.set(null);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set('No pudimos traer tu avance. Intenta de nuevo en un momento.');
        if (esFalloDelServidor(err)) {
          void this.notificador.problema(
            'No pudimos traer tu avance',
            'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.',
          );
        }
      },
    });
  }

  protected reintentar(): void {
    this.cargando.set(true);
    this.cargar();
  }

  protected destinoDe(paso: PasoDeAvance): string {
    return DESTINOS[paso.tipo];
  }

  /** Los pasos de una asignatura llegan con la materia elegida; los reportes no necesitan nada. */
  protected parametrosDe(paso: PasoDeAvance): Record<string, number> | null {
    return paso.tipo === 'asignatura' && paso.idMatricula !== null ? { matricula: paso.idMatricula } : null;
  }

  protected textoDelBoton(paso: PasoDeAvance): string {
    return paso.hecho ? 'Actualizar' : 'Subir';
  }
}

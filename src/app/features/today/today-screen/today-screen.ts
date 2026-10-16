import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { AvanceDeInformacion, AvanceRepository } from '../../../data-access/avance.repository';
import { ClaseDelDia, DiaRepository, MiDia } from '../../../data-access/dia.repository';
import { PendingActivities } from '../../../shared/pending-activities/pending-activities';

/** Cada cuánto se vuelve a preguntar: es lo que mantiene la próxima clase y el cambio de día al día. */
const CADA_CUANTO_SE_ACTUALIZA_EN_MS = 60_000;

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DIAS: Record<string, string> = {
  lunes: 'lunes',
  martes: 'martes',
  miercoles: 'miércoles',
  jueves: 'jueves',
  viernes: 'viernes',
  sabado: 'sábado',
  domingo: 'domingo',
};

/**
 * La pantalla del día (RF07, SCRUM-31 y SCRUM-32): lo que le toca al estudiante hoy.
 *
 * <p>**El servidor decide** qué día es, si es festivo, qué clases tocan y cuál va: la pantalla solo lo
 * muestra. Se actualiza sola cada minuto y al volver a la pestaña, así que a la medianoche de Bogotá
 * cambia de día sin que nadie haga nada. Al tocar una clase se abren las actividades de la asignatura.
 */
@Component({
  selector: 'app-today-screen',
  imports: [RouterLink, PendingActivities],
  templateUrl: './today-screen.html',
  styleUrl: './today-screen.css',
})
export class TodayScreen {
  private readonly repositorio = inject(DiaRepository);
  private readonly avances = inject(AvanceRepository);
  private readonly notificador = inject(NotifierService);
  private readonly documento = inject(DOCUMENT);

  protected readonly dia = signal<MiDia | null>(null);
  /** Cuánta información lleva subida; es una ayuda, así que si no llega la pantalla sigue sin ella. */
  protected readonly avance = signal<AvanceDeInformacion | null>(null);
  /** Las clases desplegadas, por `idMatricula-horaInicio`: sobrevive a las actualizaciones de cada minuto. */
  protected readonly abiertas = signal<ReadonlySet<string>>(new Set());
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  /** Sin clases hoy ni en los días que vienen: todavía no subió su horario. */
  protected readonly sinHorario = computed(() => {
    const dia = this.dia();
    return !!dia && dia.clases.length === 0 && dia.siguiente === null;
  });

  constructor() {
    this.cargar();
    this.avances.miAvance().subscribe({ next: (avance) => this.avance.set(avance), error: () => undefined });
    const intervalo = setInterval(() => this.cargar(), CADA_CUANTO_SE_ACTUALIZA_EN_MS);
    const alVolver = () => {
      if (this.documento.visibilityState === 'visible') {
        this.cargar();
      }
    };
    this.documento.addEventListener('visibilitychange', alVolver);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(intervalo);
      this.documento.removeEventListener('visibilitychange', alVolver);
    });
  }

  private cargar(): void {
    this.repositorio.miDia().subscribe({
      next: (dia) => {
        this.dia.set(dia);
        this.error.set(null);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        // Si ya había algo en pantalla se deja: un tropiezo del minuto no debe borrarla.
        if (this.dia() === null) {
          this.error.set('No pudimos traer tu día. Intenta de nuevo en un momento.');
          if (esFalloDelServidor(err)) {
            void this.notificador.problema(
              'No pudimos traer tu día',
              'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.',
            );
          }
        }
      },
    });
  }

  protected reintentar(): void {
    this.cargando.set(true);
    this.cargar();
  }

  /** «lunes 12 de octubre». */
  protected fechaLarga(fecha: string, dia: string): string {
    const [, mes, numero] = fecha.split('-').map(Number);
    return `${DIAS[dia] ?? dia} ${numero} de ${MESES[mes - 1]}`;
  }

  protected tituloDelSiguiente(dia: MiDia): string {
    const siguiente = dia.siguiente;
    if (!siguiente) {
      return '';
    }
    const diferencia = diasEntre(dia.fecha, siguiente.fecha);
    const fecha = this.fechaLarga(siguiente.fecha, siguiente.dia);
    return diferencia === 1 ? `Mañana · ${fecha}` : `Próximo día con clases · ${fecha}`;
  }

  protected lugarDe(clase: ClaseDelDia): string {
    return [clase.salon, clase.bloque].filter((parte) => !!parte).join(' · ');
  }

  protected docenteDe(clase: ClaseDelDia): string {
    return clase.docente ? `${clase.docente.nombres} ${clase.docente.apellidos}` : '';
  }

  protected etiquetaDeEstado(clase: ClaseDelDia): string {
    switch (clase.estado) {
      case 'en_curso':
        return 'En curso';
      case 'proxima':
        return 'Sigue';
      case 'pasada':
        return 'Terminó';
      default:
        return '';
    }
  }

  protected textoDeActividades(clase: ClaseDelDia): string {
    if (clase.actividades === 0) {
      return 'Aún no has subido sus actividades';
    }
    return clase.actividades === 1 ? '1 actividad' : `${clase.actividades} actividades`;
  }

  protected claveDe(clase: ClaseDelDia): string {
    return `${clase.idMatricula}-${clase.horaInicio}`;
  }

  protected estaAbierta(clase: ClaseDelDia): boolean {
    return this.abiertas().has(this.claveDe(clase));
  }

  /** Tocar una clase despliega o recoge, bajo ella, las actividades de su asignatura que no tienen nota. */
  protected alternar(clase: ClaseDelDia): void {
    const clave = this.claveDe(clase);
    const nuevas = new Set(this.abiertas());
    if (!nuevas.delete(clave)) {
      nuevas.add(clave);
    }
    this.abiertas.set(nuevas);
  }
}

/** Días de calendario entre dos fechas `año-mes-día`, sin depender de la zona horaria del teléfono. */
function diasEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

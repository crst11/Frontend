import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import { AsignaturaMatriculada, EvaluacionRepository } from '../../../data-access/evaluacion.repository';
import { Cargando } from '../../../shared/cargando/cargando';
import {
  Pendiente,
  PendienteRepository,
  PrioridadDePendiente,
} from '../../../data-access/pendiente.repository';

/** A qué hora vence un pendiente cuando la persona solo elige el día. */
const HORA_POR_DEFECTO = '23:59';

const PRIORIDADES: { valor: PrioridadDePendiente; texto: string }[] = [
  { valor: 'alta', texto: 'Alta' },
  { valor: 'media', texto: 'Media' },
  { valor: 'baja', texto: 'Baja' },
];

const FORMATO_DE_FECHA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

const SIN_CONEXION = 'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.';

/**
 * Mis pendientes (RF06, SCRUM-29 y SCRUM-30): lo que el estudiante tiene por hacer, del más próximo al
 * más lejano.
 *
 * <p>**El servidor decide** el orden y la situación de cada uno (vencido, urgente, próximo, cumplido):
 * la pantalla solo los dibuja y vuelve a pedir la lista cuando algo cambia. La fecha límite se elige con
 * día y hora, y la hora por defecto es el final del día.
 */
@Component({
  selector: 'app-my-tasks',
  imports: [Cargando, ReactiveFormsModule],
  templateUrl: './my-tasks.html',
  styleUrl: './my-tasks.css',
})
export class MyTasks {
  private readonly repositorio = inject(PendienteRepository);
  private readonly evaluaciones = inject(EvaluacionRepository);
  private readonly notificador = inject(NotifierService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly prioridades = PRIORIDADES;

  protected readonly pendientes = signal<Pendiente[]>([]);
  protected readonly asignaturas = signal<AsignaturaMatriculada[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly conCumplidos = signal(false);
  protected readonly agregando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorDelFormulario = signal<string | null>(null);
  /** El pendiente que se está marcando o borrando: evita tocarlo dos veces. */
  protected readonly ocupado = signal<number | null>(null);

  protected readonly sinPendientes = computed(() => this.pendientes().length === 0);

  protected readonly formulario = this.fb.group({
    titulo: ['', [Validators.required, Validators.maxLength(120)]],
    descripcion: ['', [Validators.maxLength(300)]],
    fecha: ['', [Validators.required]],
    hora: [HORA_POR_DEFECTO, [Validators.required]],
    prioridad: ['media' as PrioridadDePendiente],
    idMatricula: [0],
  });

  constructor() {
    this.cargar();
    // Las asignaturas son un extra del formulario: si no llegan, el pendiente se escribe sin ligarlo a una.
    this.evaluaciones.misAsignaturas('actual').subscribe({
      next: (lista) => this.asignaturas.set(lista),
      error: () => undefined,
    });
  }

  private cargar(): void {
    this.repositorio.listar(this.conCumplidos()).subscribe({
      next: (lista) => {
        this.pendientes.set(lista);
        this.error.set(null);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set('No pudimos traer tus pendientes. Intenta de nuevo en un momento.');
        if (esFalloDelServidor(err)) {
          void this.notificador.problema('No pudimos traer tus pendientes', SIN_CONEXION);
        }
      },
    });
  }

  protected reintentar(): void {
    this.cargando.set(true);
    this.cargar();
  }

  protected alternarCumplidos(): void {
    this.conCumplidos.update((valor) => !valor);
    this.cargar();
  }

  protected abrirFormulario(): void {
    this.formulario.reset({
      titulo: '',
      descripcion: '',
      fecha: '',
      hora: HORA_POR_DEFECTO,
      prioridad: 'media',
      idMatricula: 0,
    });
    this.errorDelFormulario.set(null);
    this.agregando.set(true);
    setTimeout(() => document.querySelector('.pendientes__formulario')?.scrollIntoView({ block: 'start' }));
  }

  protected cerrarFormulario(): void {
    this.agregando.set(false);
  }

  protected agregar(): void {
    if (this.guardando()) {
      return;
    }
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    const v = this.formulario.getRawValue();
    const descripcion = v.descripcion.trim();
    this.guardando.set(true);
    this.errorDelFormulario.set(null);
    this.repositorio
      .crear({
        titulo: v.titulo.trim(),
        ...(descripcion !== '' && { descripcion }),
        fechaLimite: new Date(`${v.fecha}T${v.hora}:00`).toISOString(),
        prioridad: v.prioridad,
        ...(v.idMatricula !== 0 && { idMatricula: v.idMatricula }),
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.agregando.set(false);
          this.cargar();
          void this.notificador.aviso('Guardamos tu pendiente.');
        },
        error: (err: HttpErrorResponse) => {
          this.guardando.set(false);
          if (esFalloDelServidor(err)) {
            void this.notificador.problema('No pudimos guardar tu pendiente', SIN_CONEXION);
            return;
          }
          this.errorDelFormulario.set(err.error?.detail ?? 'No pudimos guardar el pendiente. Revisa los datos.');
        },
      });
  }

  protected marcar(pendiente: Pendiente): void {
    if (this.ocupado() !== null) {
      return;
    }
    const cumplido = pendiente.estado !== 'cumplido';
    this.ocupado.set(pendiente.id);
    this.repositorio.marcar(pendiente.id, cumplido).subscribe({
      next: () => {
        this.ocupado.set(null);
        this.cargar();
        if (cumplido && !this.conCumplidos()) {
          void this.notificador.aviso('Lo marcaste como hecho.');
        }
      },
      error: (err: HttpErrorResponse) => {
        this.ocupado.set(null);
        this.mostrarFalla(err, 'No pudimos actualizar tu pendiente.');
        this.cargar();
      },
    });
  }

  protected async eliminar(pendiente: Pendiente): Promise<void> {
    if (this.ocupado() !== null) {
      return;
    }
    const seguro = await this.notificador.confirmar(
      '¿Borrar este pendiente?',
      `«${pendiente.titulo}» se borra y no se puede recuperar.`,
      'Borrar',
    );
    if (!seguro) {
      return;
    }
    this.ocupado.set(pendiente.id);
    this.repositorio.eliminar(pendiente.id).subscribe({
      next: () => {
        this.ocupado.set(null);
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.ocupado.set(null);
        this.mostrarFalla(err, 'No pudimos borrar tu pendiente.');
      },
    });
  }

  private mostrarFalla(err: HttpErrorResponse, mensaje: string): void {
    if (esFalloDelServidor(err)) {
      void this.notificador.problema(mensaje, SIN_CONEXION);
      return;
    }
    this.error.set(err.error?.detail ?? mensaje);
  }

  protected fechaDe(pendiente: Pendiente): string {
    return FORMATO_DE_FECHA.format(new Date(pendiente.fechaLimite));
  }

  protected asignaturaDe(pendiente: Pendiente): string {
    if (pendiente.idMatricula === null) {
      return '';
    }
    return this.asignaturas().find((a) => a.idMatricula === pendiente.idMatricula)?.nombre ?? '';
  }

  protected etiquetaDeSituacion(pendiente: Pendiente): string {
    switch (pendiente.situacion) {
      case 'vencido':
        return 'Vencido';
      case 'urgente':
        return 'Vence pronto';
      case 'cumplido':
        return 'Hecho';
      default:
        return '';
    }
  }

  protected etiquetaDePrioridad(pendiente: Pendiente): string {
    return `Prioridad ${pendiente.prioridad}`;
  }
}

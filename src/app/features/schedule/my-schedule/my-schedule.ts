import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import { PendingActivities } from '../../../shared/pending-activities/pending-activities';
import { Cargando } from '../../../shared/cargando/cargando';
import {
  ActividadExtraPorAnadir,
  ClaseDelHorario,
  ConsultaDelHorario,
  Horario,
  HorarioRepository,
  VistaDelHorario,
} from '../../../data-access/horario.repository';

/** Los días como los guarda el servidor (sin tildes) y como se leen en pantalla. */
const DIAS = [
  { valor: 'lunes', texto: 'Lunes', corto: 'Lun' },
  { valor: 'martes', texto: 'Martes', corto: 'Mar' },
  { valor: 'miercoles', texto: 'Miércoles', corto: 'Mié' },
  { valor: 'jueves', texto: 'Jueves', corto: 'Jue' },
  { valor: 'viernes', texto: 'Viernes', corto: 'Vie' },
  { valor: 'sabado', texto: 'Sábado', corto: 'Sáb' },
  { valor: 'domingo', texto: 'Domingo', corto: 'Dom' },
] as const;

/** Siempre por hora: es como se consulta un horario. */
const CONSULTA: ConsultaDelHorario = { orden: 'hora' };

/**
 * Mi horario (RF04, SCRUM-25).
 *
 * <p>Dos vistas del mismo dato: por día (la que se consulta en el momento: ¿dónde es mi próxima
 * clase?) y por semana. Abre en el día de hoy y recuerda la última vista que se eligió.
 *
 * <p>Las clases son las que la universidad entrega en el Reporte de Horario: aquí no se agregan ni se
 * quitan, se vuelve a importar el reporte. Lo que sí se puede añadir son actividades extra (un
 * semillero, un deporte, una clase de baile): cosas con día y hora que no son una asignatura y que se
 * ven, como una clase más, aquí y en Hoy. Tocar una clase despliega lo que falta por calificar.
 */
@Component({
  selector: 'app-my-schedule',
  imports: [Cargando, RouterLink, ReactiveFormsModule, NgTemplateOutlet, PendingActivities],
  templateUrl: './my-schedule.html',
  styleUrl: './my-schedule.css',
})
export class MySchedule {
  private readonly repositorio = inject(HorarioRepository);
  private readonly notificador = inject(NotifierService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly dias = DIAS;

  protected readonly horario = signal<Horario | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly vista = signal<VistaDelHorario>('dia');
  protected readonly diaElegido = signal<string>(diaDeHoy());

  /** Las clases desplegadas, por `idMatricula-consecutivo`. */
  protected readonly abiertas = signal<ReadonlySet<string>>(new Set());

  protected readonly clasesDelDia = computed(() => this.clasesDe(this.diaElegido()));

  /** Una actividad extra no es una asignatura: se guarda un registro por cada día que se elige. */
  protected readonly agregandoExtra = signal(false);
  protected readonly guardandoExtra = signal(false);
  protected readonly errorDelFormularioExtra = signal<string | null>(null);
  protected readonly diasExtra = signal<readonly string[]>([]);
  protected readonly formularioExtra = this.fb.group({
    nombre: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(80)]],
    horaInicio: ['', Validators.required],
    horaFin: ['', Validators.required],
    lugar: ['', Validators.maxLength(80)],
    responsable: ['', Validators.maxLength(80)],
  });

  constructor() {
    this.cargar();
  }

  protected clasesDe(dia: string): ClaseDelHorario[] {
    return this.horario()?.dias.find((d) => d.dia === dia)?.clases ?? [];
  }

  protected textoDelDia(dia: string): string {
    return DIAS.find((d) => d.valor === dia)?.texto ?? dia;
  }

  /** «F-203 · Bloque F · Fusagasugá», con lo que haya: un salón sin bloque no deja un punto suelto. */
  protected ubicacion(clase: ClaseDelHorario): string | null {
    const partes = [clase.salon, clase.bloque, clase.sede].filter((parte): parte is string => !!parte);
    return partes.length > 0 ? partes.join(' · ') : null;
  }

  protected claveDe(clase: ClaseDelHorario): string {
    return clase.esExtra ? `extra-${clase.idActividadExtra}` : `${clase.idMatricula}-${clase.consecutivo}`;
  }

  protected estaAbierta(clase: ClaseDelHorario): boolean {
    return this.abiertas().has(this.claveDe(clase));
  }

  /** Despliega o recoge, bajo la clase, las actividades de su asignatura que no tienen nota. */
  protected alternarDetalle(clase: ClaseDelHorario): void {
    const clave = this.claveDe(clase);
    const nuevas = new Set(this.abiertas());
    if (nuevas.has(clave)) {
      nuevas.delete(clave);
    } else {
      nuevas.add(clave);
    }
    this.abiertas.set(nuevas);
  }

  protected docente(clase: ClaseDelHorario): string | null {
    return clase.docente ? `${clase.docente.nombres} ${clase.docente.apellidos}` : null;
  }

  /** Cambia la vista y la recuerda para la próxima vez; si no se puede recordar, no es motivo para avisar. */
  protected cambiarVista(vista: VistaDelHorario): void {
    this.vista.set(vista);
    this.repositorio.guardarPreferencia({ vista, sede: null, orden: 'hora' }).subscribe({ error: () => undefined });
  }

  protected elegirDia(dia: string): void {
    this.diaElegido.set(dia);
  }

  protected abrirFormularioExtra(): void {
    // El botón que se tocó desaparece: el foco pasa al primer campo para que el teclado no se pierda.
    setTimeout(() => {
      const formulario = document.querySelector('.horario__extra-formulario');
      formulario?.scrollIntoView({ block: 'start' });
      formulario?.querySelector<HTMLElement>('input')?.focus();
    });
    this.formularioExtra.reset({ nombre: '', horaInicio: '', horaFin: '', lugar: '', responsable: '' });
    this.diasExtra.set([]);
    this.errorDelFormularioExtra.set(null);
    this.agregandoExtra.set(true);
  }

  protected cerrarFormularioExtra(): void {
    this.agregandoExtra.set(false);
    this.devolverElFoco();
  }

  /** Al cerrar el formulario, el foco vuelve al botón que lo abre. */
  private devolverElFoco(): void {
    setTimeout(() => document.querySelector<HTMLElement>('.horario__acciones-superiores > button')?.focus());
  }

  protected alternarDiaExtra(dia: string): void {
    this.diasExtra.update((elegidos) => (elegidos.includes(dia) ? elegidos.filter((d) => d !== dia) : [...elegidos, dia]));
  }

  protected puedeGuardarExtra(): boolean {
    return this.formularioExtra.valid && this.diasExtra().length > 0 && !this.guardandoExtra();
  }

  protected anadirExtra(): void {
    if (!this.puedeGuardarExtra()) {
      return;
    }
    this.guardandoExtra.set(true);
    this.errorDelFormularioExtra.set(null);
    const orden = DIAS.map((d) => d.valor as string);
    const dias = orden.filter((d) => this.diasExtra().includes(d));
    this.repositorio.anadirActividadExtra(aActividadExtra(this.formularioExtra.getRawValue(), dias)).subscribe({
      next: (clases) => {
        this.guardandoExtra.set(false);
        this.agregandoExtra.set(false);
        if (clases.length > 0) {
          this.diaElegido.set(clases[0].dia);
        }
        this.recargarElHorario();
        this.devolverElFoco();
        void this.notificador.aviso('Añadimos la actividad a tu horario.');
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoExtra.set(false);
        if (esFalloDelServidor(err)) {
          void this.notificador.problema(
            'No pudimos guardar la actividad',
            'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.',
          );
          return;
        }
        this.errorDelFormularioExtra.set(err.error?.detail ?? 'No pudimos guardar la actividad. Revisa los datos.');
      },
    });
  }

  /** Solo las actividades extra se quitan: las clases llegan por el reporte de la universidad. */
  protected async quitar(clase: ClaseDelHorario): Promise<void> {
    if (!clase.esExtra || clase.idActividadExtra === null) {
      return;
    }
    const confirmada = await this.notificador.confirmar(
      'Quitar esta actividad',
      `${clase.asignatura}, ${this.textoDelDia(clase.dia)} de ${clase.horaInicio} a ${clase.horaFin}.`,
      'Quitar',
    );
    if (!confirmada) {
      return;
    }
    this.repositorio.quitarActividadExtra(clase.idActividadExtra).subscribe({
      next: () => this.recargarElHorario(),
      error: (err: HttpErrorResponse) => this.mostrarEnLaPantalla(err),
    });
  }

  /**
   * Abre con la última vista que se eligió. Si no se puede leer, no es motivo para no mostrar el
   * horario: se abre con lo predeterminado y no se le dice nada a quien no pidió nada.
   */
  private cargar(): void {
    this.repositorio.miPreferencia().subscribe({
      next: (preferencia) => {
        this.vista.set(preferencia.vista);
        this.cargarElHorario();
      },
      error: () => this.cargarElHorario(),
    });
  }

  private cargarElHorario(): void {
    this.repositorio.miHorario(CONSULTA).subscribe({
      next: (horario) => {
        this.horario.set(horario);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set('No pudimos traer tu horario. Intenta de nuevo en un momento.');
        if (esFalloDelServidor(err)) {
          void this.notificador.problema(
            'No pudimos traer tu horario',
            'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.',
          );
        }
      },
    });
  }

  /** Se vuelve a pedir y la pantalla sigue mostrando lo anterior mientras tanto. */
  private recargarElHorario(): void {
    this.repositorio.miHorario(CONSULTA).subscribe({
      next: (horario) => {
        this.horario.set(horario);
        this.error.set(null);
      },
      error: (err: HttpErrorResponse) => this.mostrarEnLaPantalla(err),
    });
  }

  private mostrarEnLaPantalla(err: HttpErrorResponse): void {
    if (esFalloDelServidor(err)) {
      void this.notificador.problema(
        'No pudimos actualizar tu horario',
        'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.',
      );
      return;
    }
    this.error.set(err.error?.detail ?? 'No pudimos actualizar tu horario.');
  }
}

/** El día de hoy como lo guarda el servidor. Es solo para elegir qué día mostrar al abrir. */
function diaDeHoy(): string {
  // Date va de domingo (0) a sábado (6); DIAS, de lunes a domingo.
  const hoy = new Date().getDay();
  return DIAS[hoy === 0 ? 6 : hoy - 1].valor;
}

function aActividadExtra(
  v: { nombre: string; horaInicio: string; horaFin: string; lugar: string; responsable: string },
  dias: string[],
): ActividadExtraPorAnadir {
  const actividad: ActividadExtraPorAnadir = {
    nombre: v.nombre.trim(),
    dias,
    horaInicio: v.horaInicio,
    horaFin: v.horaFin,
  };
  if (v.lugar.trim()) actividad.lugar = v.lugar.trim();
  if (v.responsable.trim()) actividad.responsable = v.responsable.trim();
  return actividad;
}

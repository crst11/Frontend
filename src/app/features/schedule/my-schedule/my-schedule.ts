import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import { AsignaturaMatriculada, EvaluacionRepository } from '../../../data-access/evaluacion.repository';
import {
  ClaseDelHorario,
  ClasePorAgregar,
  Horario,
  HorarioRepository,
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

/**
 * Mi horario (RF04, SCRUM-25).
 *
 * <p>Dos vistas del mismo dato: por día (la que se consulta en el momento: ¿dónde es mi próxima
 * clase?) y por semana. Abre en el día de hoy.
 *
 * <p>Aquí no se ordena ni se agrupa nada: el servidor entrega los días con clases de lunes a
 * domingo y, dentro de cada uno, las clases en orden de hora. La pantalla solo las dibuja y
 * rellena con «sin clases» los días que no vienen.
 *
 * <p>Las clases se agregan a mano, una por bloque, a las asignaturas que se están cursando. El
 * lugar y el docente son opcionales: se puede saber la hora antes que el salón.
 */
@Component({
  selector: 'app-my-schedule',
  imports: [RouterLink, ReactiveFormsModule, NgTemplateOutlet],
  templateUrl: './my-schedule.html',
  styleUrl: './my-schedule.css',
})
export class MySchedule {
  private readonly repositorio = inject(HorarioRepository);
  private readonly evaluaciones = inject(EvaluacionRepository);
  private readonly notificador = inject(NotifierService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly dias = DIAS;

  protected readonly horario = signal<Horario | null>(null);
  protected readonly asignaturas = signal<AsignaturaMatriculada[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly vista = signal<'dia' | 'semana'>('dia');
  protected readonly diaElegido = signal<string>(diaDeHoy());
  protected readonly agregando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorDelFormulario = signal<string | null>(null);

  protected readonly clasesDelDia = computed(() => this.clasesDe(this.diaElegido()));
  protected readonly sinAsignaturas = computed(() => this.asignaturas().length === 0);

  protected readonly formulario = this.fb.group({
    idMatricula: [0, [Validators.min(1)]],
    dia: [diaDeHoy(), Validators.required],
    horaInicio: ['', Validators.required],
    horaFin: ['', Validators.required],
    salon: [''],
    bloque: [''],
    sede: [''],
    docenteNombres: [''],
    docenteApellidos: [''],
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

  protected docente(clase: ClaseDelHorario): string | null {
    return clase.docente ? `${clase.docente.nombres} ${clase.docente.apellidos}` : null;
  }

  protected cambiarVista(vista: 'dia' | 'semana'): void {
    this.vista.set(vista);
  }

  protected elegirDia(dia: string): void {
    this.diaElegido.set(dia);
  }

  protected abrirFormulario(): void {
    const primera = this.asignaturas()[0];
    this.formulario.reset({
      idMatricula: primera?.idMatricula ?? 0,
      dia: this.diaElegido(),
      horaInicio: '',
      horaFin: '',
      salon: '',
      bloque: '',
      sede: '',
      docenteNombres: '',
      docenteApellidos: '',
    });
    this.errorDelFormulario.set(null);
    this.agregando.set(true);
  }

  protected cerrarFormulario(): void {
    this.agregando.set(false);
  }

  protected agregar(): void {
    if (this.formulario.invalid || this.guardando()) {
      this.formulario.markAllAsTouched();
      return;
    }
    const v = this.formulario.getRawValue();
    this.guardando.set(true);
    this.errorDelFormulario.set(null);
    this.repositorio.agregar(Number(v.idMatricula), aClase(v)).subscribe({
      next: (clase) => {
        this.guardando.set(false);
        this.agregando.set(false);
        this.diaElegido.set(clase.dia);
        this.recargarElHorario();
        void this.notificador.aviso('Agregamos la clase a tu horario.');
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.mostrarEnElFormulario(err);
      },
    });
  }

  protected async quitar(clase: ClaseDelHorario): Promise<void> {
    const confirmada = await this.notificador.confirmar(
      'Quitar esta clase',
      `${clase.asignatura}, ${this.textoDelDia(clase.dia)} de ${clase.horaInicio} a ${clase.horaFin}.`,
      'Quitar',
    );
    if (!confirmada) {
      return;
    }
    this.repositorio.quitar(clase.idMatricula, clase.consecutivo).subscribe({
      next: () => this.recargarElHorario(),
      error: (err: HttpErrorResponse) => this.mostrarEnLaPantalla(err),
    });
  }

  private cargar(): void {
    this.repositorio.miHorario().subscribe({
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
    // Para poder agregar: solo las asignaturas que se están cursando tienen horario.
    this.evaluaciones.misAsignaturas().subscribe({
      next: (asignaturas) => this.asignaturas.set(asignaturas.filter((a) => a.enCurso)),
      error: () => this.asignaturas.set([]),
    });
  }

  private recargarElHorario(): void {
    this.repositorio.miHorario().subscribe({
      next: (horario) => {
        this.horario.set(horario);
        this.error.set(null);
      },
      error: (err: HttpErrorResponse) => this.mostrarEnLaPantalla(err),
    });
  }

  /** Lo que el estudiante puede corregir va junto al formulario; una caída del servidor, a la ventana. */
  private mostrarEnElFormulario(err: HttpErrorResponse): void {
    if (esFalloDelServidor(err)) {
      void this.notificador.problema(
        'No pudimos guardar la clase',
        'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.',
      );
      return;
    }
    this.errorDelFormulario.set(err.error?.detail ?? 'No pudimos guardar la clase. Revisa los datos.');
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

function aClase(v: {
  dia: string;
  horaInicio: string;
  horaFin: string;
  salon: string;
  bloque: string;
  sede: string;
  docenteNombres: string;
  docenteApellidos: string;
}): ClasePorAgregar {
  const clase: ClasePorAgregar = { dia: v.dia, horaInicio: v.horaInicio, horaFin: v.horaFin };
  if (v.salon.trim()) clase.salon = v.salon.trim();
  if (v.bloque.trim()) clase.bloque = v.bloque.trim();
  if (v.sede.trim()) clase.sede = v.sede.trim();
  if (v.docenteNombres.trim() || v.docenteApellidos.trim()) {
    clase.docente = { nombres: v.docenteNombres.trim(), apellidos: v.docenteApellidos.trim() };
  }
  return clase;
}

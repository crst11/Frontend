import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import {
  AsignaturaMatriculada,
  CategoriaDeEvaluacion,
  EvaluacionRepository,
} from '../../../data-access/evaluacion.repository';
import {
  ClaseDelHorario,
  ClasePorAgregar,
  ConsultaDelHorario,
  Horario,
  HorarioRepository,
  OrdenDelHorario,
  PreferenciaDeHorario,
  VistaDelHorario,
} from '../../../data-access/horario.repository';

/** Las actividades y notas de una asignatura, traídas la primera vez que se despliega una de sus clases. */
interface DetalleDeAsignatura {
  cargando: boolean;
  fallo: boolean;
  categorias: CategoriaDeEvaluacion[];
}

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
 * <p>Aquí no se ordena, no se agrupa ni se filtra nada (SCRUM-26): el servidor entrega los días con
 * clases de lunes a domingo y, dentro de cada uno, las clases en el orden y con el filtro que se le
 * pidieron. La pantalla solo las dibuja y rellena con «sin clases» los días que no vienen. Elegir una
 * asignatura, una sede o un orden vuelve a pedir el horario.
 *
 * <p>La vista, la sede y el orden se pueden guardar como «mi vista» y la próxima vez abre con ellos. El
 * filtro por asignatura no se guarda: cambia cada período.
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
  protected readonly vista = signal<VistaDelHorario>('dia');
  protected readonly asignaturaElegida = signal('');
  protected readonly sedeElegida = signal('');
  protected readonly ordenElegido = signal<OrdenDelHorario>('hora');
  /** Lo que hay guardado como «mi vista»; sirve para saber si lo que se ve ya es eso. */
  protected readonly guardadaComoMiVista = signal<PreferenciaDeHorario | null>(null);
  protected readonly guardandoMiVista = signal(false);
  protected readonly actualizando = signal(false);
  protected readonly diaElegido = signal<string>(diaDeHoy());
  protected readonly agregando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorDelFormulario = signal<string | null>(null);

  /** Las clases desplegadas, por `idMatricula-consecutivo`. */
  protected readonly abiertas = signal<ReadonlySet<string>>(new Set());
  private readonly detalles = signal<Record<number, DetalleDeAsignatura>>({});

  protected readonly clasesDelDia = computed(() => this.clasesDe(this.diaElegido()));
  protected readonly sinAsignaturas = computed(() => this.asignaturas().length === 0);

  protected readonly hayFiltro = computed(() => !!this.asignaturaElegida() || !!this.sedeElegida());

  /** Las sedes que se pueden elegir, más la elegida si el horario ya no la trae (se puede quitar). */
  protected readonly sedesParaElegir = computed(() => {
    const sedes = this.horario()?.sedes ?? [];
    const elegida = this.sedeElegida();
    return elegida && !sedes.includes(elegida) ? [...sedes, elegida] : sedes;
  });

  /** Verdadero si lo que se ve ya es lo que está guardado: no hay nada nuevo que guardar. */
  protected readonly yaEsMiVista = computed(() => {
    const guardada = this.guardadaComoMiVista();
    return (
      !!guardada &&
      guardada.vista === this.vista() &&
      (guardada.sede ?? '') === this.sedeElegida() &&
      guardada.orden === this.ordenElegido()
    );
  });

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

  protected claveDe(clase: ClaseDelHorario): string {
    return `${clase.idMatricula}-${clase.consecutivo}`;
  }

  protected estaAbierta(clase: ClaseDelHorario): boolean {
    return this.abiertas().has(this.claveDe(clase));
  }

  protected detalleDe(clase: ClaseDelHorario): DetalleDeAsignatura | undefined {
    return this.detalles()[clase.idMatricula];
  }

  /** Despliega o recoge las actividades y notas de la clase; la primera vez las pide al servidor. */
  protected alternarDetalle(clase: ClaseDelHorario): void {
    const clave = this.claveDe(clase);
    const nuevas = new Set(this.abiertas());
    if (nuevas.has(clave)) {
      nuevas.delete(clave);
    } else {
      nuevas.add(clave);
      if (!this.detalleDe(clase)) {
        this.cargarDetalle(clase.idMatricula);
      }
    }
    this.abiertas.set(nuevas);
  }

  private cargarDetalle(idMatricula: number): void {
    this.detalles.update((d) => ({ ...d, [idMatricula]: { cargando: true, fallo: false, categorias: [] } }));
    this.evaluaciones.estructuraDe(idMatricula).subscribe({
      next: (estructura) =>
        this.detalles.update((d) => ({
          ...d,
          [idMatricula]: { cargando: false, fallo: false, categorias: estructura.categorias },
        })),
      error: () =>
        this.detalles.update((d) => ({ ...d, [idMatricula]: { cargando: false, fallo: true, categorias: [] } })),
    });
  }

  protected docente(clase: ClaseDelHorario): string | null {
    return clase.docente ? `${clase.docente.nombres} ${clase.docente.apellidos}` : null;
  }

  protected cambiarVista(vista: VistaDelHorario): void {
    this.vista.set(vista);
  }

  protected elegirAsignatura(codigo: string): void {
    this.asignaturaElegida.set(codigo);
    this.pedirElHorario();
  }

  protected elegirSede(sede: string): void {
    this.sedeElegida.set(sede);
    this.pedirElHorario();
  }

  protected elegirOrden(orden: string): void {
    this.ordenElegido.set(orden === 'asignatura' ? 'asignatura' : 'hora');
    this.pedirElHorario();
  }

  protected quitarFiltros(): void {
    this.asignaturaElegida.set('');
    this.sedeElegida.set('');
    this.pedirElHorario();
  }

  /** Guarda la vista, la sede y el orden de ahora. El filtro por asignatura no se guarda. */
  protected guardarMiVista(): void {
    if (this.guardandoMiVista() || this.yaEsMiVista()) {
      return;
    }
    this.guardandoMiVista.set(true);
    this.repositorio
      .guardarPreferencia({ vista: this.vista(), sede: this.sedeElegida() || null, orden: this.ordenElegido() })
      .subscribe({
        next: (guardada) => {
          this.guardandoMiVista.set(false);
          this.guardadaComoMiVista.set(guardada);
          void this.notificador.aviso('Guardamos tu vista: la próxima vez abre así.');
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoMiVista.set(false);
          this.mostrarEnLaPantalla(err);
        },
      });
  }

  protected elegirDia(dia: string): void {
    this.diaElegido.set(dia);
  }

  protected abrirFormulario(): void {
    // El formulario está al final de la pantalla: se lleva a la vista para que no pase desapercibido.
    setTimeout(() => document.querySelector('.horario__formulario')?.scrollIntoView({ block: 'start' }));
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

  /**
   * Abre con la preferencia guardada. Si no se puede leer, no es motivo para no mostrar el horario:
   * se abre con lo predeterminado y no se le dice nada a quien no pidió nada.
   */
  private cargar(): void {
    this.repositorio.miPreferencia().subscribe({
      next: (preferencia) => {
        this.guardadaComoMiVista.set(preferencia);
        this.vista.set(preferencia.vista);
        this.sedeElegida.set(preferencia.sede ?? '');
        this.ordenElegido.set(preferencia.orden);
        this.cargarElHorario();
      },
      error: () => this.cargarElHorario(),
    });
    this.cargarLasAsignaturas();
  }

  /** Para poder agregar: solo las asignaturas que se están cursando tienen horario. */
  private cargarLasAsignaturas(): void {
    this.evaluaciones.misAsignaturas().subscribe({
      next: (asignaturas) => this.asignaturas.set(asignaturas.filter((a) => a.enCurso)),
      error: () => this.asignaturas.set([]),
    });
  }

  private consulta(): ConsultaDelHorario {
    return {
      asignatura: this.asignaturaElegida() || undefined,
      sede: this.sedeElegida() || undefined,
      orden: this.ordenElegido(),
    };
  }

  private cargarElHorario(): void {
    this.repositorio.miHorario(this.consulta()).subscribe({
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

  /** Un filtro o un orden nuevos: se vuelve a pedir y la pantalla sigue mostrando lo anterior mientras tanto. */
  private pedirElHorario(): void {
    this.actualizando.set(true);
    this.repositorio.miHorario(this.consulta()).subscribe({
      next: (horario) => {
        this.horario.set(horario);
        this.error.set(null);
        this.actualizando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.actualizando.set(false);
        this.mostrarEnLaPantalla(err);
      },
    });
  }

  private recargarElHorario(): void {
    this.pedirElHorario();
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

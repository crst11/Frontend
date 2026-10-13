import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import {
  ActividadDeEvaluacion,
  AsignaturaMatriculada,
  CategoriaDeEvaluacion,
  CategoriaPorGuardar,
  EstructuraDeEvaluacion,
  EvaluacionRepository,
} from '../../../data-access/evaluacion.repository';
import { ActivityGrades, NotasCambiadas } from '../activity-grades/activity-grades';

/**
 * Una actividad mientras se la edita. El porcentaje admite nulo porque un campo recién agregado
 * está vacío, y mostrar un 0 ahí haría creer que el estudiante ya puso un peso.
 */
interface ActividadEnEdicion {
  consecutivo: number;
  nombre: string;
  porcentaje: number | null;
  fechaProgramada: string | null;
  tipo: string;
  /** Solo para avisar antes de quitar una actividad que ya tiene nota; no se manda al guardar. */
  nota: number | null;
}

interface CategoriaEnEdicion {
  consecutivo: number;
  nombre: string;
  porcentaje: number | null;
  origen: string;
  actividades: ActividadEnEdicion[];
}

/**
 * Definir cómo me evalúan y anotar mis notas (RF05, SCRUM-27 y SCRUM-28).
 *
 * <p>Al elegir una asignatura hay dos vistas: Notas (la que abre cuando la asignatura ya tiene
 * actividades, porque es lo que se usa a diario) y Estructura (donde se arma el árbol).
 *
 * <p>Primero elige la asignatura y después arma el árbol: categorías que suman 100 % y, dentro de
 * cada una, actividades que también suman 100 %. Las sumas se muestran mientras edita, así que no
 * tiene que mandar al servidor para enterarse de que le falta un 10 %.
 *
 * <p>Los cálculos de nota no se hacen aquí: estas sumas son el mismo dato que el estudiante está
 * escribiendo, no una regla de negocio deducida en el navegador. El servidor las vuelve a validar.
 */
@Component({
  selector: 'app-evaluation-structure',
  imports: [RouterLink, ActivityGrades],
  templateUrl: './evaluation-structure.html',
  styleUrl: './evaluation-structure.css',
})
export class EvaluationStructure {
  private readonly repositorio = inject(EvaluacionRepository);
  private readonly notificador = inject(NotifierService);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly tipos = [
    { valor: 'parcial', texto: 'Parcial' },
    { valor: 'taller', texto: 'Taller' },
    { valor: 'quiz', texto: 'Quiz' },
    { valor: 'exposicion', texto: 'Exposición' },
  ];

  protected readonly asignaturas = signal<AsignaturaMatriculada[]>([]);
  protected readonly cargando = signal(true);
  protected readonly seleccionada = signal<AsignaturaMatriculada | null>(null);
  /** La estructura tal como la devolvió el servidor, con notas y acumulado: es lo que muestra Notas. */
  protected readonly detalle = signal<EstructuraDeEvaluacion | null>(null);
  protected readonly vista = signal<'notas' | 'estructura'>('estructura');
  protected readonly guardada = signal(false);
  protected readonly categorias = signal<CategoriaEnEdicion[]>([]);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly totalDeCategorias = computed(() => suma(this.categorias()));
  protected readonly cuadra = computed(() => this.totalDeCategorias() === 100);

  /** Una categoría sin actividades está bien; con actividades, tienen que sumar 100 %. */
  protected readonly categoriasDescuadradas = computed(() =>
    this.categorias().filter((c) => c.actividades.length > 0 && suma(c.actividades) !== 100),
  );

  protected readonly sePuedeGuardar = computed(() => {
    const categorias = this.categorias();
    if (categorias.length === 0) {
      return true; // Vaciar la estructura es una decisión válida: vuelve a quedar sin configurar.
    }
    const completas = categorias.every(
      (c) => c.nombre.trim().length > 0 && c.actividades.every((a) => a.nombre.trim().length > 0),
    );
    return completas && this.cuadra() && this.categoriasDescuadradas().length === 0;
  });

  constructor() {
    this.cargarAsignaturas();
  }

  private cargarAsignaturas(): void {
    this.repositorio.misAsignaturas().subscribe({
      next: (asignaturas) => {
        this.asignaturas.set(asignaturas);
        this.cargando.set(false);
        // Quien llega desde la pantalla del día trae la asignatura que tocó (SCRUM-31).
        const pedida = Number(this.ruta.snapshot.queryParamMap.get('matricula'));
        const asignatura = asignaturas.find((a) => a.idMatricula === pedida);
        if (asignatura) {
          this.elegir(asignatura);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set('No pudimos traer tus asignaturas. Intenta de nuevo en un momento.');
        if (esFalloDelServidor(err)) {
          void this.notificador.problema(
            'No pudimos traer tus asignaturas',
            'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.',
          );
        }
      },
    });
  }

  protected totalDe(categoria: CategoriaEnEdicion): number {
    return suma(categoria.actividades);
  }

  protected elegir(asignatura: AsignaturaMatriculada): void {
    this.error.set(null);
    this.repositorio.estructuraDe(asignatura.idMatricula).subscribe({
      next: (estructura) => {
        this.seleccionada.set(estructura.asignatura);
        this.guardada.set(estructura.guardada);
        this.categorias.set(estructura.categorias.map(aEdicion));
        this.detalle.set(estructura);
        // Notas es lo que se usa a diario; Estructura abre sola solo mientras no haya nada que calificar.
        this.vista.set(estructura.guardada && estructura.acumulado.actividadesTotales > 0 ? 'notas' : 'estructura');
      },
      error: (err: HttpErrorResponse) => this.mostrar(err),
    });
  }

  protected cambiarVista(vista: 'notas' | 'estructura'): void {
    this.vista.set(vista);
  }

  /**
   * El panel de notas ya habló con el servidor: aquí solo se recoge lo que cambió, para que al
   * volver de una vista a la otra no se vea una versión vieja.
   */
  protected alCambiarLasNotas(cambio: NotasCambiadas): void {
    this.detalle.update((detalle) =>
      detalle ? { ...detalle, categorias: cambio.categorias, acumulado: cambio.acumulado } : detalle,
    );
    this.categorias.update((categorias) =>
      categorias.map((categoria) => {
        const nueva = cambio.categorias.find((c) => c.consecutivo === categoria.consecutivo);
        return {
          ...categoria,
          actividades: categoria.actividades.map((actividad) => ({
            ...actividad,
            nota: nueva?.actividades.find((a) => a.consecutivo === actividad.consecutivo)?.nota ?? null,
          })),
        };
      }),
    );
  }

  protected volverALaLista(): void {
    this.seleccionada.set(null);
    this.detalle.set(null);
    this.categorias.set([]);
    this.error.set(null);
  }

  protected agregarCategoria(): void {
    this.categorias.update((categorias) => [
      ...categorias,
      { consecutivo: siguiente(categorias), nombre: '', porcentaje: null, origen: 'estudiante', actividades: [] },
    ]);
  }

  /** Una categoría con notas se lleva sus notas al guardar: antes se le avisa, no después. */
  protected async quitarCategoria(consecutivo: number): Promise<void> {
    const categoria = this.categorias().find((c) => c.consecutivo === consecutivo);
    const conNotas = categoria?.actividades.filter((a) => a.nota !== null).length ?? 0;
    if (conNotas > 0 && !(await this.confirmarPerderNotas(conNotas))) {
      return;
    }
    this.categorias.update((categorias) => categorias.filter((c) => c.consecutivo !== consecutivo));
  }

  protected agregarActividad(consecutivo: number): void {
    this.cambiarCategoria(consecutivo, (categoria) => ({
      ...categoria,
      actividades: [
        ...categoria.actividades,
        { consecutivo: siguiente(categoria.actividades), nombre: '', porcentaje: null, fechaProgramada: null, tipo: 'taller', nota: null },
      ],
    }));
  }

  protected async quitarActividad(consecutivo: number, consecutivoActividad: number): Promise<void> {
    const actividad = this.categorias()
      .find((c) => c.consecutivo === consecutivo)
      ?.actividades.find((a) => a.consecutivo === consecutivoActividad);
    if (actividad?.nota != null && !(await this.confirmarPerderNotas(1))) {
      return;
    }
    this.cambiarCategoria(consecutivo, (categoria) => ({
      ...categoria,
      actividades: categoria.actividades.filter((a) => a.consecutivo !== consecutivoActividad),
    }));
  }

  protected escribirNombreDeCategoria(consecutivo: number, valor: string): void {
    this.cambiarCategoria(consecutivo, (categoria) => ({ ...categoria, nombre: valor, origen: 'estudiante' }));
  }

  protected escribirPesoDeCategoria(consecutivo: number, valor: string): void {
    this.cambiarCategoria(consecutivo, (categoria) => ({
      ...categoria,
      porcentaje: aNumero(valor),
      origen: 'estudiante',
    }));
  }

  protected escribirCampoDeActividad(
    consecutivo: number,
    consecutivoActividad: number,
    campo: 'nombre' | 'porcentaje' | 'fechaProgramada' | 'tipo',
    valor: string,
  ): void {
    this.cambiarCategoria(consecutivo, (categoria) => ({
      ...categoria,
      actividades: categoria.actividades.map((actividad) =>
        actividad.consecutivo === consecutivoActividad
          ? {
              ...actividad,
              [campo]: campo === 'porcentaje' ? aNumero(valor) : valor === '' ? null : valor,
            }
          : actividad,
      ),
    }));
  }

  protected guardar(): void {
    const asignatura = this.seleccionada();
    if (!asignatura || !this.sePuedeGuardar()) {
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    this.repositorio.guardar(asignatura.idMatricula, this.categorias().map(aGuardar)).subscribe({
      next: (estructura) => {
        this.guardando.set(false);
        this.guardada.set(estructura.guardada);
        this.categorias.set(estructura.categorias.map(aEdicion));
        this.detalle.set(estructura);
        this.refrescarLaLista(asignatura.idMatricula, estructura.asignatura);
        void this.notificador.aviso(
          estructura.guardada
            ? 'Guardamos cómo te evalúan en esta asignatura.'
            : 'La asignatura quedó otra vez sin configurar.',
        );
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.mostrar(err);
      },
    });
  }

  private confirmarPerderNotas(cuantas: number): Promise<boolean> {
    return this.notificador.confirmar(
      cuantas === 1 ? 'Esta actividad tiene una nota' : `Hay ${cuantas} actividades con nota`,
      cuantas === 1
        ? 'Si la quitas y guardas, también se borra su nota.'
        : 'Si las quitas y guardas, también se borran sus notas.',
      'Quitar de todos modos',
    );
  }

  /** La lista de atrás tiene que reflejar lo que acabó de guardar, sin volver a pedirla al servidor. */
  private refrescarLaLista(idMatricula: number, actualizada: AsignaturaMatriculada): void {
    this.asignaturas.update((asignaturas) =>
      asignaturas.map((a) => (a.idMatricula === idMatricula ? actualizada : a)),
    );
  }

  private cambiarCategoria(
    consecutivo: number,
    cambio: (categoria: CategoriaEnEdicion) => CategoriaEnEdicion,
  ): void {
    this.categorias.update((categorias) =>
      categorias.map((categoria) => (categoria.consecutivo === consecutivo ? cambio(categoria) : categoria)),
    );
  }

  /**
   * Lo que el estudiante puede corregir va junto al formulario; una caída del servidor va a la
   * ventana emergente, porque de eso no tiene culpa.
   */
  private mostrar(err: HttpErrorResponse): void {
    if (esFalloDelServidor(err)) {
      void this.notificador.problema(
        'No pudimos guardar',
        'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.',
      );
      return;
    }
    this.error.set(err.error?.detail ?? 'No pudimos guardar los cambios.');
  }
}

function suma(pesos: { porcentaje: number | null }[]): number {
  return pesos.reduce((total, uno) => total + (uno.porcentaje ?? 0), 0);
}

/** Un número de orden nuevo nunca reusa uno ya dado: el servidor los usa para no perder notas. */
function siguiente(existentes: { consecutivo: number }[]): number {
  return existentes.reduce((mayor, uno) => Math.max(mayor, uno.consecutivo), 0) + 1;
}

function aNumero(valor: string): number | null {
  if (valor.trim() === '') {
    return null;
  }
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function aEdicion(categoria: CategoriaDeEvaluacion): CategoriaEnEdicion {
  return {
    consecutivo: categoria.consecutivo,
    nombre: categoria.nombre,
    porcentaje: categoria.porcentaje,
    origen: categoria.origen,
    actividades: categoria.actividades.map((actividad: ActividadDeEvaluacion) => ({
      consecutivo: actividad.consecutivo,
      nombre: actividad.nombre,
      porcentaje: actividad.porcentaje,
      fechaProgramada: actividad.fechaProgramada,
      tipo: actividad.tipo,
      nota: actividad.nota,
    })),
  };
}

function aGuardar(categoria: CategoriaEnEdicion): CategoriaPorGuardar {
  return {
    consecutivo: categoria.consecutivo,
    nombre: categoria.nombre.trim(),
    porcentaje: categoria.porcentaje ?? 0,
    origen: categoria.origen,
    actividades: categoria.actividades.map((actividad) => ({
      consecutivo: actividad.consecutivo,
      nombre: actividad.nombre.trim(),
      porcentaje: actividad.porcentaje ?? 0,
      fechaProgramada: actividad.fechaProgramada,
      tipo: actividad.tipo,
    })),
  };
}

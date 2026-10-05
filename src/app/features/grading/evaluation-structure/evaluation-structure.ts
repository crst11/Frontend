import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import {
  ActividadDeEvaluacion,
  AsignaturaMatriculada,
  CategoriaDeEvaluacion,
  CategoriaPorGuardar,
  EvaluacionRepository,
} from '../../../data-access/evaluacion.repository';

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
}

interface CategoriaEnEdicion {
  consecutivo: number;
  nombre: string;
  porcentaje: number | null;
  origen: string;
  actividades: ActividadEnEdicion[];
}

/**
 * Definir cómo me evalúan (RF05, SCRUM-27).
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
  imports: [RouterLink],
  templateUrl: './evaluation-structure.html',
  styleUrl: './evaluation-structure.css',
})
export class EvaluationStructure {
  private readonly repositorio = inject(EvaluacionRepository);
  private readonly notificador = inject(NotifierService);

  protected readonly tipos = [
    { valor: 'parcial', texto: 'Parcial' },
    { valor: 'taller', texto: 'Taller' },
    { valor: 'quiz', texto: 'Quiz' },
    { valor: 'exposicion', texto: 'Exposición' },
  ];

  protected readonly asignaturas = signal<AsignaturaMatriculada[]>([]);
  protected readonly cargando = signal(true);
  protected readonly seleccionada = signal<AsignaturaMatriculada | null>(null);
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
      },
      error: (err: HttpErrorResponse) => this.mostrar(err),
    });
  }

  protected volverALaLista(): void {
    this.seleccionada.set(null);
    this.categorias.set([]);
    this.error.set(null);
  }

  protected agregarCategoria(): void {
    this.categorias.update((categorias) => [
      ...categorias,
      { consecutivo: siguiente(categorias), nombre: '', porcentaje: null, origen: 'estudiante', actividades: [] },
    ]);
  }

  protected quitarCategoria(consecutivo: number): void {
    this.categorias.update((categorias) => categorias.filter((c) => c.consecutivo !== consecutivo));
  }

  protected agregarActividad(consecutivo: number): void {
    this.cambiarCategoria(consecutivo, (categoria) => ({
      ...categoria,
      actividades: [
        ...categoria.actividades,
        { consecutivo: siguiente(categoria.actividades), nombre: '', porcentaje: null, fechaProgramada: null, tipo: 'taller' },
      ],
    }));
  }

  protected quitarActividad(consecutivo: number, consecutivoActividad: number): void {
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
